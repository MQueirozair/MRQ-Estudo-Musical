"""Real BPM, Beat Tracking, Time Signature, Tempo Variation and Tap Tempo analyzer."""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple
import numpy as np

from core.audio_engine.bridge import NativeDSPEngine, get_dsp_engine


def _estimate_tempo_from_envelope(
    env: np.ndarray,
    frame_rate: float,
    min_bpm: float = 55.0,
    max_bpm: float = 210.0,
) -> Tuple[float, float]:
    """
    Comb-weighted autocorrelation tempo estimator with perceptual log-normal prior
    and parabolic lag refinement. Returns (bpm, confidence in [0, 1]).
    """
    n = env.size
    if n < 16 or float(np.std(env)) < 1e-6:
        return 120.0, 0.0

    # Zero-mean onset envelope
    x = env - np.mean(env)
    # Fast FFT autocorrelation
    n_fft = 1 << int(np.ceil(np.log2(2 * n)))
    spec = np.fft.rfft(x, n=n_fft)
    ac = np.fft.irfft(spec * np.conj(spec), n=n_fft)[:n]
    if ac[0] <= 1e-9:
        return 120.0, 0.0
    ac = ac / ac[0]

    min_lag = max(2, int(np.floor(60.0 * frame_rate / max_bpm)))
    max_lag = min(n // 2, int(np.ceil(60.0 * frame_rate / min_bpm)))
    if max_lag <= min_lag + 2:
        return 120.0, 0.0

    lags = np.arange(min_lag, max_lag + 1)
    bpms = 60.0 * frame_rate / lags

    # Perceptual tempo preference (log-normal centered near 118 BPM, gentle width)
    prior = np.exp(-0.5 * ((np.log2(bpms / 118.0)) / 0.65) ** 2)

    # Multi-harmonic comb score (sum autocorrelation at 1x, 2x, 3x, 4x beat period)
    scores = np.zeros_like(lags, dtype=np.float64)
    for idx, lag in enumerate(lags):
        s = 0.0
        w_sum = 0.0
        for mult, w in ((1, 1.0), (2, 0.65), (3, 0.35), (4, 0.25)):
            m_lag = lag * mult
            if m_lag < n:
                s += w * max(0.0, float(ac[m_lag]))
                w_sum += w
        # Also reward sub-beat (half-lag) consistency gently
        half_lag = lag // 2
        if half_lag >= 2:
            s += 0.20 * max(0.0, float(ac[half_lag]))
            w_sum += 0.20
        scores[idx] = (s / max(1e-6, w_sum)) * prior[idx]

    best_i = int(np.argmax(scores))
    best_lag = float(lags[best_i])

    # Parabolic interpolation around best_i for sub-BPM precision
    if 0 < best_i < scores.size - 1:
        y0, y1, y2 = scores[best_i - 1], scores[best_i], scores[best_i + 1]
        denom = 2.0 * (2.0 * y1 - y2 - y0)
        if abs(denom) > 1e-9:
            delta = np.clip((y2 - y0) / denom, -0.5, 0.5)
            best_lag += delta

    best_bpm = float(60.0 * frame_rate / best_lag)

    # Confidence from peak-to-median SNR + raw autocorrelation strength at best lag
    med = float(np.median(scores)) + 1e-6
    peak_ratio = float(scores[best_i]) / med
    raw_ac = float(max(0.0, ac[int(round(best_lag))]))
    confidence = float(np.clip(0.55 * min(1.0, raw_ac * 1.6) + 0.45 * min(1.0, (peak_ratio - 1.0) / 4.0), 0.0, 1.0))

    return round(best_bpm, 2), round(confidence, 3)


def _track_beats_dp(env: np.ndarray, frame_rate: float, bpm: float) -> List[float]:
    """
    Ellis (2007) Dynamic Programming Beat Tracker.
    Finds optimal beat sequence aligning with onset peaks while respecting target beat period.
    """
    n = env.size
    if n < 8 or bpm <= 20.0:
        return []

    period = (60.0 / bpm) * frame_rate
    if period < 3.0:
        return []

    # Local onset score smoothed slightly
    local = np.convolve(env, np.array([0.25, 0.5, 0.25]), mode="same")
    cum_score = np.zeros(n, dtype=np.float64)
    backlink = np.full(n, -1, dtype=np.int32)

    tightness = 100.0
    win_min = max(1, int(round(period * 0.5)))
    win_max = max(win_min + 1, int(round(period * 2.0)))

    for t in range(n):
        best_prev = -1
        best_val = 0.0
        start_p = max(0, t - win_max)
        end_p = t - win_min
        if end_p >= start_p:
            p_indices = np.arange(start_p, end_p + 1)
            dt = t - p_indices
            penalty = -tightness * (np.log(dt / period) ** 2)
            cand = cum_score[p_indices] + penalty
            bi = int(np.argmax(cand))
            if cand[bi] > 0.0:
                best_val = float(cand[bi])
                best_prev = int(p_indices[bi])
        cum_score[t] = float(local[t]) + best_val
        backlink[t] = best_prev

    # Backtrack from the strongest beat near the end of the track
    tail_start = max(0, n - int(round(period * 2.0)))
    cur = tail_start + int(np.argmax(cum_score[tail_start:]))
    beat_frames = []
    while cur >= 0:
        beat_frames.append(cur)
        cur = int(backlink[cur])
    beat_frames.reverse()

    # Fill leading beats if DP started late
    if beat_frames:
        first_f = beat_frames[0]
        while first_f - period >= 0:
            first_f -= period
            beat_frames.insert(0, int(round(first_f)))

    return [round(f / frame_rate, 4) for f in beat_frames]


def _estimate_time_signature(
    env: np.ndarray,
    frame_rate: float,
    beats_sec: List[float],
) -> Tuple[int, int, List[float]]:
    """
    Estimates meter (4/4 vs 3/4 vs 6/8) by comparing downbeat accent periodicity across beats,
    and returns (numerator, denominator, downbeat_times_sec).
    """
    if len(beats_sec) < 8:
        downbeats = beats_sec[::4]
        return 4, 4, downbeats

    beat_strengths = []
    for t in beats_sec:
        idx = int(round(t * frame_rate))
        lo = max(0, idx - 2)
        hi = min(env.size, idx + 3)
        beat_strengths.append(float(np.max(env[lo:hi])) if hi > lo else 0.0)
    bs = np.array(beat_strengths, dtype=np.float64)

    def meter_score(beats_per_bar: int) -> Tuple[float, int]:
        best_phase = 0
        best_contrast = -1e9
        for phase in range(beats_per_bar):
            down = bs[phase::beats_per_bar]
            others = np.delete(bs, np.arange(phase, bs.size, beats_per_bar))
            if down.size == 0 or others.size == 0:
                continue
            contrast = float(np.mean(down) - np.mean(others))
            if contrast > best_contrast:
                best_contrast = contrast
                best_phase = phase
        return best_contrast, best_phase

    s4, p4 = meter_score(4)
    s3, p3 = meter_score(3)
    s6, p6 = meter_score(6)

    # Slight prior toward 4/4 unless 3/4 or 6/8 clearly dominates
    if s3 > s4 * 1.25 and s3 > 0.03:
        return 3, 4, beats_sec[p3::3]
    if s6 > s4 * 1.35 and s6 > 0.03:
        return 6, 8, beats_sec[p6::6]
    return 4, 4, beats_sec[p4::4]


def analyze_bpm_and_beats(
    audio: np.ndarray,
    sample_rate: int,
    dsp: Optional[NativeDSPEngine] = None,
) -> Dict:
    """
    Full real BPM, beat grid, downbeats, time signature and tempo variation analysis.
    """
    dsp = dsp or get_dsp_engine()
    if audio.ndim == 2:
        mono = audio.mean(axis=1).astype(np.float32)
    else:
        mono = audio.astype(np.float32)

    duration_sec = mono.size / float(sample_rate) if sample_rate > 0 else 0.0
    fft_size = 2048
    hop_size = 512
    frame_rate = sample_rate / float(hop_size)

    env = dsp.compute_onset_envelope(mono, sample_rate=sample_rate, fft_size=fft_size, hop_size=hop_size)
    bpm, confidence = _estimate_tempo_from_envelope(env, frame_rate)
    beats_sec = _track_beats_dp(env, frame_rate, bpm)
    ts_num, ts_den, downbeats_sec = _estimate_time_signature(env, frame_rate, beats_sec)

    # Detect tempo variations across 8-second windows for longer tracks
    tempo_changes: List[Dict] = []
    win_frames = int(round(8.0 * frame_rate))
    step_frames = int(round(4.0 * frame_rate))
    if env.size >= win_frames + step_frames:
        prev_local_bpm = bpm
        for start_f in range(0, env.size - win_frames + 1, step_frames):
            sub_bpm, sub_conf = _estimate_tempo_from_envelope(env[start_f : start_f + win_frames], frame_rate)
            if sub_conf >= 0.45 and abs(sub_bpm - prev_local_bpm) >= 6.0:
                tempo_changes.append(
                    {
                        "time_sec": round(start_f / frame_rate, 2),
                        "bpm": sub_bpm,
                        "confidence": sub_conf,
                    }
                )
                prev_local_bpm = sub_bpm

    low_conf = confidence < 0.55
    warning = (
        "Confiança moderada/baixa na detecção de BPM (faixa com pulso livre, rubato ou poucos ataques percussivos). "
        "Use Tap Tempo ou ajuste manualmente."
        if low_conf
        else None
    )

    return {
        "bpm": bpm,
        "confidence": confidence,
        "low_confidence": low_conf,
        "warning": warning,
        "time_signature": f"{ts_num}/{ts_den}",
        "time_sig_num": ts_num,
        "time_sig_den": ts_den,
        "beats": beats_sec,
        "downbeats": downbeats_sec,
        "tempo_changes": tempo_changes,
        "duration_sec": round(duration_sec, 4),
    }


def compute_tap_tempo(tap_timestamps_sec: List[float]) -> Dict:
    """Computes robust BPM from user tap timestamps with outlier filtering."""
    if len(tap_timestamps_sec) < 2:
        return {"bpm": None, "taps": len(tap_timestamps_sec), "stability": 0.0}

    taps = sorted(float(t) for t in tap_timestamps_sec)
    intervals = np.diff(taps)
    # Keep plausible intervals between 30 BPM (2.0s) and 300 BPM (0.2s)
    intervals = intervals[(intervals >= 0.2) & (intervals <= 2.0)]
    if intervals.size == 0:
        return {"bpm": None, "taps": len(taps), "stability": 0.0}

    med = float(np.median(intervals))
    inliers = intervals[np.abs(intervals - med) <= 0.35 * med]
    if inliers.size == 0:
        inliers = intervals

    mean_dt = float(np.mean(inliers))
    bpm = round(60.0 / mean_dt, 2)
    cv = float(np.std(inliers) / max(1e-6, mean_dt))
    stability = round(float(np.clip(1.0 - cv * 3.0, 0.0, 1.0)), 3)
    return {"bpm": bpm, "taps": len(taps), "stability": stability}

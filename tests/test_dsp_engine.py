"""Automated DSP Engine tests: Time Stretching (25%-200%), Independent Pitch Shifting, Waveform & FFT."""

from __future__ import annotations

import math
import numpy as np
import pytest

from core.audio_engine.bridge import get_dsp_engine
from scripts.generate_demo_audio import generate_study_song, synth_bass_note, synth_lead_vocal, synth_piano_note


def _measure_pitch_hz(mono: np.ndarray, sr: int, min_f: float = 70.0, max_f: float = 1800.0) -> float:
    dsp = get_dsp_engine()
    freqs, confs = dsp.detect_pitch_yin(mono, sr, frame_size=2048, hop_size=512, min_freq=min_f, max_freq=max_f)
    mid = freqs[len(freqs) // 5 : (4 * len(freqs)) // 5]
    mid_c = confs[len(confs) // 5 : (4 * len(confs)) // 5]
    valid = mid[(mid > 0) & (mid_c > 0.65)]
    assert valid.size > 0, "Nenhuma frequência estável detectada pelo YIN"
    return float(np.median(valid))


def _make_sine(freq: float, dur: float, sr: int = 44100, channels: int = 1) -> np.ndarray:
    t = np.arange(int(dur * sr), dtype=np.float64) / sr
    sig = (0.65 * np.sin(2 * math.pi * freq * t)).astype(np.float32)
    if channels == 1:
        return sig[:, np.newaxis]
    return np.stack([sig, sig], axis=1)


@pytest.mark.parametrize("speed", [0.25, 0.35, 0.50, 0.60, 0.75, 0.85, 1.00, 1.25, 1.50, 2.00])
def test_time_stretch_all_speeds_preserve_pitch(speed: float):
    """Critical requirement: changing speed 25%-200% must preserve exact pitch (440 Hz)."""
    sr = 44100
    dur = 1.5
    sine = _make_sine(440.0, dur, sr=sr, channels=1)
    dsp = get_dsp_engine()

    out = dsp.time_stretch(sine, sample_rate=sr, speed_ratio=speed)
    expected_frames = int(round(sine.shape[0] / speed))
    assert abs(out.shape[0] - expected_frames) <= 16, f"Duração incorreta para velocidade {speed}"
    assert np.all(np.isfinite(out))

    detected_hz = _measure_pitch_hz(out[:, 0], sr)
    assert abs(detected_hz - 440.0) < 4.5, f"Velocidade {speed}: afinação desviou para {detected_hz:.2f} Hz"


@pytest.mark.parametrize(
    "semitones,cents",
    [
        (-12, 0),
        (-5, 0),
        (0, 50),
        (0, -35),
        (7, 0),
        (12, 0),
        (3, -25),
    ],
)
def test_pitch_shift_independent_of_tempo(semitones: float, cents: float):
    """Critical requirement: transposing semitones/octaves/cents must keep exact duration."""
    sr = 44100
    dur = 1.5
    sine = _make_sine(440.0, dur, sr=sr, channels=1)
    dsp = get_dsp_engine()

    out = dsp.pitch_shift(sine, sample_rate=sr, semitones=semitones, cents=cents)
    assert out.shape[0] == sine.shape[0], "Pitch shift alterou a duração do áudio!"

    expected_hz = 440.0 * (2.0 ** ((semitones + cents / 100.0) / 12.0))
    detected_hz = _measure_pitch_hz(out[:, 0], sr, min_f=100.0, max_f=1500.0)
    tol = max(4.0, expected_hz * 0.012)
    assert abs(detected_hz - expected_hz) < tol, (
        f"Esperado {expected_hz:.2f} Hz para ({semitones}st, {cents}c), obtido {detected_hz:.2f} Hz"
    )


def test_time_stretch_quality_across_instruments():
    """Validates clean finite output and RMS preservation across voice, piano, bass and full mix."""
    sr = 44100
    dsp = get_dsp_engine()
    signals = {
        "voice": synth_lead_vocal(69, 1.5, sr)[:, np.newaxis],
        "piano": synth_piano_note(60, 1.5, sr)[:, np.newaxis],
        "bass": synth_bass_note(45, 1.5, sr)[:, np.newaxis],
        "full_mix": generate_study_song(sr=sr, bpm=120.0, bars=2),
    }
    for name, sig in signals.items():
        stretched = dsp.time_and_pitch(sig, sr, speed_ratio=0.75, semitones=-2, cents=0)
        assert stretched.shape[1] == sig.shape[1]
        assert np.all(np.isfinite(stretched)), f"NaN/Inf em {name}"
        in_rms = float(np.sqrt(np.mean(sig ** 2)))
        out_rms = float(np.sqrt(np.mean(stretched ** 2)))
        assert 0.45 * in_rms < out_rms < 1.65 * in_rms, f"Energia RMS anormal em {name}: in={in_rms}, out={out_rms}"


def test_waveform_peaks_and_fft_spectrogram():
    sr = 44100
    dsp = get_dsp_engine()
    stereo = _make_sine(440.0, 2.0, sr=sr, channels=2)

    mn, mx, rms = dsp.compute_waveform_peaks(stereo, num_bins=200)
    assert mn.shape == (200,) and mx.shape == (200,) and rms.shape == (200,)
    assert float(np.max(mx)) > 0.62 and float(np.min(mn)) < -0.62
    assert 0.43 < float(np.median(rms)) < 0.49

    spec_lin = dsp.compute_spectrogram(stereo[:, 0], sr, fft_size=2048, hop_size=512, log_freq_bins=0)
    assert spec_lin.ndim == 2 and spec_lin.shape[1] == 1025
    # Verify 440Hz bin (~20) has peak energy
    avg_spectrum = np.mean(spec_lin, axis=0)
    peak_bin = int(np.argmax(avg_spectrum))
    peak_hz = peak_bin * sr / 2048.0
    assert abs(peak_hz - 440.0) < 25.0

    spec_log = dsp.compute_spectrogram(stereo[:, 0], sr, fft_size=2048, hop_size=512, log_freq_bins=128)
    assert spec_log.shape[1] == 128 and np.all(np.isfinite(spec_log))

"""
Real Musical Key & Scale Detection using Harmonic Chromagram +
Krumhansl-Schmuckler & Temperley psychoacoustic key profiles.
"""

from __future__ import annotations

from typing import Dict, List, Tuple
import numpy as np
from scipy.ndimage import median_filter
from scipy.signal import stft

PITCH_CLASSES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

# Temperley (2007) + Krumhansl-Kessler blended perceptual profiles (normalized)
_MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], dtype=np.float64)
_MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17], dtype=np.float64)

# Scale interval sets for scale identification
SCALES = {
    "Maior (Jônica)": [0, 2, 4, 5, 7, 9, 11],
    "Menor Natural (Eólia)": [0, 2, 3, 5, 7, 8, 10],
    "Menor Harmônica": [0, 2, 3, 5, 7, 8, 11],
    "Dórica": [0, 2, 3, 5, 7, 9, 10],
    "Mixolídia": [0, 2, 4, 5, 7, 9, 10],
    "Pentatônica Maior": [0, 2, 4, 7, 9],
    "Pentatônica Menor": [0, 3, 5, 7, 10],
}


def compute_harmonic_chromagram(
    audio: np.ndarray,
    sample_rate: int,
    n_fft: int = 4096,
    hop_length: int = 1024,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Computes a clean 12-bin chromagram (shape [12, n_frames]) after HPSS harmonic separation
    so drum transients do not corrupt key or chord estimation.
    Returns (chroma [12, T], frame_times [T]).
    """
    if audio.ndim == 2:
        mono = audio.mean(axis=1).astype(np.float32)
    else:
        mono = audio.astype(np.float32)

    if mono.size < n_fft:
        mono = np.pad(mono, (0, n_fft - mono.size))

    freqs, times, Zxx = stft(
        mono,
        fs=sample_rate,
        window="hann",
        nperseg=n_fft,
        noverlap=n_fft - hop_length,
        boundary="zeros",
        padded=True,
    )
    mag = np.abs(Zxx)

    # Harmonic-Percussive Separation via 2D median filtering on magnitude spectrogram
    if mag.shape[1] >= 9:
        harm_med = median_filter(mag, size=(1, 13))
        perc_med = median_filter(mag, size=(13, 1))
        eps = 1e-10
        h_mask = (harm_med ** 2) / (harm_med ** 2 + perc_med ** 2 + eps)
        harm_mag = mag * h_mask
    else:
        harm_mag = mag

    # Map frequency bins (55 Hz to 4200 Hz) to 12 pitch classes with Gaussian bin weighting
    valid_mask = (freqs >= 55.0) & (freqs <= 4200.0)
    valid_freqs = freqs[valid_mask]
    valid_mag = harm_mag[valid_mask, :] ** 1.5  # Power compression emphasizes tonal partials

    midi_floats = 69.0 + 12.0 * np.log2(valid_freqs / 440.0)
    pc_floats = np.mod(midi_floats, 12.0)

    # Build sparse weight matrix [12, n_valid_bins]
    weights = np.zeros((12, valid_freqs.size), dtype=np.float64)
    # Slight emphasis on bass/midrange fundamentals (80Hz - 1000Hz)
    freq_prior = np.exp(-0.5 * ((np.log2(valid_freqs / 320.0)) / 2.2) ** 2)
    for pc in range(12):
        dist = np.abs(pc_floats - pc)
        dist = np.minimum(dist, 12.0 - dist)
        weights[pc, :] = np.exp(-0.5 * (dist / 0.28) ** 2) * freq_prior

    chroma = weights @ valid_mag  # [12, T]
    # L2-normalize each frame gently
    norms = np.linalg.norm(chroma, axis=0, keepdims=True)
    chroma = np.divide(chroma, np.maximum(norms, 1e-8))
    return chroma, times


def _pearson(a: np.ndarray, b: np.ndarray) -> float:
    a0 = a - np.mean(a)
    b0 = b - np.mean(b)
    denom = float(np.linalg.norm(a0) * np.linalg.norm(b0))
    if denom < 1e-12:
        return 0.0
    return float(np.dot(a0, b0) / denom)


def analyze_key_and_scale(audio: np.ndarray, sample_rate: int) -> Dict:
    """Detects global musical key (Major/Minor), scale, pitch-class distribution and confidence."""
    chroma, _ = compute_harmonic_chromagram(audio, sample_rate)
    if chroma.size == 0 or float(np.sum(chroma)) < 1e-6:
        return {
            "key": "Desconhecida",
            "root": "C",
            "mode": "unknown",
            "scale": "Indeterminada",
            "scale_notes": [],
            "confidence": 0.0,
            "low_confidence": True,
            "warning": "Sinal silencioso ou insuficiente para estimar tonalidade.",
            "candidates": [],
            "chroma_profile": [0.0] * 12,
        }

    global_chroma = np.mean(chroma, axis=1)
    max_c = float(np.max(global_chroma)) or 1.0
    chroma_norm = global_chroma / max_c

    candidates: List[Dict] = []
    for root in range(12):
        maj_prof = np.roll(_MAJOR_PROFILE, root)
        min_prof = np.roll(_MINOR_PROFILE, root)
        r_maj = _pearson(global_chroma, maj_prof)
        r_min = _pearson(global_chroma, min_prof)
        candidates.append({"root": PITCH_CLASSES[root], "root_idx": root, "mode": "major", "label": f"{PITCH_CLASSES[root]} Maior", "score": r_maj})
        candidates.append({"root": PITCH_CLASSES[root], "root_idx": root, "mode": "minor", "label": f"{PITCH_CLASSES[root]} Menor", "score": r_min})

    candidates.sort(key=lambda x: x["score"], reverse=True)
    best = candidates[0]
    second = candidates[1]

    # Confidence blends correlation magnitude + separation from 2nd best candidate
    corr_term = np.clip((best["score"] - 0.15) / 0.75, 0.0, 1.0)
    margin_term = np.clip((best["score"] - second["score"]) / 0.18, 0.0, 1.0)
    confidence = round(float(0.68 * corr_term + 0.32 * margin_term), 3)

    # Identify best-matching scale rooted on best["root_idx"]
    root_idx = best["root_idx"]
    best_scale_name = "Maior (Jônica)" if best["mode"] == "major" else "Menor Natural (Eólia)"
    best_scale_score = -1.0
    for s_name, intervals in SCALES.items():
        if best["mode"] == "major" and "Menor" in s_name:
            continue
        if best["mode"] == "minor" and "Maior" in s_name:
            continue
        in_pcs = [(root_idx + iv) % 12 for iv in intervals]
        out_pcs = [p for p in range(12) if p not in in_pcs]
        in_e = float(np.mean(chroma_norm[in_pcs]))
        out_e = float(np.mean(chroma_norm[out_pcs])) if out_pcs else 0.0
        s_score = in_e - 0.85 * out_e
        if s_score > best_scale_score:
            best_scale_score = s_score
            best_scale_name = s_name

    scale_notes = [PITCH_CLASSES[(root_idx + iv) % 12] for iv in SCALES[best_scale_name]]
    low_conf = confidence < 0.55
    warning = (
        "Confiança moderada/baixa na tonalidade (possível modulação, atonalidade ou ambiguidade relativa Maior/Menor). "
        "Verifique as candidatas alternativas ou corrija manualmente."
        if low_conf
        else None
    )

    return {
        "key": best["label"],
        "root": best["root"],
        "mode": best["mode"],
        "scale": f"{best['root']} {best_scale_name}",
        "scale_notes": scale_notes,
        "confidence": confidence,
        "low_confidence": low_conf,
        "warning": warning,
        "candidates": [
            {"key": c["label"], "score": round(float(c["score"]), 3)}
            for c in candidates[:5]
        ],
        "chroma_profile": [round(float(v), 3) for v in chroma_norm],
    }

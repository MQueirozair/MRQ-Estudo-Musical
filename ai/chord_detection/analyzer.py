"""
Real Harmonic Chord Recognition using HPSS Chromagram + 216 Chord Templates
(Major, Minor, Dim, Aug, Sus2, Sus4, 7, Maj7, m7, m7(b5), 9, Maj9, m9, add9, 6, m6, 7sus4, 5)
+ HMM Viterbi temporal smoothing + confidence scoring.
"""

from __future__ import annotations

import uuid
from typing import Dict, List, Optional, Tuple
import numpy as np

from ai.key_detection.analyzer import PITCH_CLASSES, compute_harmonic_chromagram

# Chord quality definitions: (suffix, intervals_from_root, complexity_prior_penalty)
CHORD_QUALITIES: List[Tuple[str, List[int], float]] = [
    ("",       [0, 4, 7],           0.00),  # Major triad
    ("m",      [0, 3, 7],           0.00),  # Minor triad
    ("dim",    [0, 3, 6],           0.04),  # Diminished
    ("aug",    [0, 4, 8],           0.05),  # Augmented
    ("sus2",   [0, 2, 7],           0.075), # Suspended 2nd
    ("sus4",   [0, 5, 7],           0.070), # Suspended 4th
    ("7",      [0, 4, 7, 10],       0.03),  # Dominant 7th
    ("maj7",   [0, 4, 7, 11],       0.035), # Major 7th
    ("m7",     [0, 3, 7, 10],       0.03),  # Minor 7th
    ("m7(b5)", [0, 3, 6, 10],       0.055), # Half-diminished
    ("9",      [0, 4, 7, 10, 2],    0.06),  # Dominant 9th
    ("maj9",   [0, 4, 7, 11, 2],    0.065), # Major 9th
    ("m9",     [0, 3, 7, 10, 2],    0.06),  # Minor 9th
    ("add9",   [0, 4, 7, 2],        0.055), # Add 9
    ("6",      [0, 4, 7, 9],        0.05),  # Major 6th
    ("m6",     [0, 3, 7, 9],        0.055), # Minor 6th
    ("7sus4",  [0, 5, 7, 10],       0.06),  # 7sus4
    ("5",      [0, 7],              0.08),  # Power chord
]


def _build_chord_templates() -> Tuple[np.ndarray, List[Dict], np.ndarray]:
    """Builds L2-normalized binary/weighted chord templates [N_chords, 12] + metadata."""
    templates = []
    meta = []
    penalties = []

    for root in range(12):
        for suffix, intervals, penalty in CHORD_QUALITIES:
            vec = np.zeros(12, dtype=np.float64)
            for idx, iv in enumerate(intervals):
                # Emphasize root and 3rd/5th over upper extensions
                w = 1.25 if idx == 0 else (1.0 if idx <= 2 else 0.78)
                vec[(root + iv) % 12] = max(vec[(root + iv) % 12], w)
            vec /= np.linalg.norm(vec)
            templates.append(vec)
            meta.append(
                {
                    "symbol": f"{PITCH_CLASSES[root]}{suffix}",
                    "root": PITCH_CLASSES[root],
                    "root_idx": root,
                    "quality": suffix or "maj",
                    "notes": [PITCH_CLASSES[(root + iv) % 12] for iv in intervals],
                }
            )
            penalties.append(penalty)

    return np.vstack(templates), meta, np.array(penalties, dtype=np.float64)


_TEMPLATES, _CHORD_META, _PENALTIES = _build_chord_templates()


def _viterbi_smooth(log_emissions: np.ndarray, stay_bonus: float = 0.22) -> np.ndarray:
    """
    HMM Viterbi decoder over chord sequence.
    log_emissions: shape [N_states, T]
    """
    n_states, T = log_emissions.shape
    if T == 0:
        return np.array([], dtype=np.int32)

    dp = np.zeros((n_states, T), dtype=np.float64)
    ptr = np.zeros((n_states, T), dtype=np.int32)
    dp[:, 0] = log_emissions[:, 0]

    for t in range(1, T):
        prev = dp[:, t - 1]
        best_global_idx = int(np.argmax(prev))
        best_global_val = float(prev[best_global_idx])

        # Transition cost: 0 if staying on same chord, -stay_bonus if switching
        for s in range(n_states):
            stay_val = prev[s]
            switch_val = best_global_val - stay_bonus
            if stay_val >= switch_val:
                dp[s, t] = stay_val + log_emissions[s, t]
                ptr[s, t] = s
            else:
                dp[s, t] = switch_val + log_emissions[s, t]
                ptr[s, t] = best_global_idx

    path = np.zeros(T, dtype=np.int32)
    path[T - 1] = int(np.argmax(dp[:, T - 1]))
    for t in range(T - 2, -1, -1):
        path[t] = ptr[path[t + 1], t + 1]
    return path


def analyze_chords(
    audio: np.ndarray,
    sample_rate: int,
    beats_sec: Optional[List[float]] = None,
) -> Dict:
    """
    Real harmonic chord sequence recognition synchronized with audio timeline.
    Uses beat-synchronized chroma pooling when beats are provided, or 0.5s windows otherwise.
    """
    chroma, times = compute_harmonic_chromagram(audio, sample_rate)
    duration_sec = (audio.shape[0] / float(sample_rate)) if sample_rate > 0 else 0.0

    if chroma.shape[1] == 0 or duration_sec <= 0.1:
        return {
            "chords": [],
            "progression_summary": "",
            "average_confidence": 0.0,
            "low_confidence": True,
            "warning": "Áudio insuficiente para reconhecimento harmônico.",
        }

    # Build time segment boundaries (beat-synced when reliable, else 0.5s grid)
    if beats_sec and len(beats_sec) >= 4:
        # Pool every 2 beats (or 1 beat) for crisp harmonic resolution
        bounds = [0.0] + [float(b) for b in beats_sec if 0.05 < b < duration_sec - 0.05] + [duration_sec]
        # Deduplicate close bounds
        clean_bounds = [bounds[0]]
        for b in bounds[1:]:
            if b - clean_bounds[-1] >= 0.25:
                clean_bounds.append(b)
        if clean_bounds[-1] < duration_sec:
            clean_bounds.append(duration_sec)
        bounds = clean_bounds
    else:
        step = 0.5
        bounds = list(np.arange(0.0, duration_sec, step)) + [duration_sec]

    seg_chromas = []
    seg_ranges: List[Tuple[float, float]] = []
    seg_energies = []

    for i in range(len(bounds) - 1):
        t0, t1 = bounds[i], bounds[i + 1]
        mask = (times >= t0) & (times < t1)
        if not np.any(mask):
            idx = int(np.clip(np.searchsorted(times, t0), 0, chroma.shape[1] - 1))
            vec = chroma[:, idx]
        else:
            vec = np.mean(chroma[:, mask], axis=1)
        energy = float(np.linalg.norm(vec))
        seg_energies.append(energy)
        seg_chromas.append(vec / max(energy, 1e-8))
        seg_ranges.append((t0, t1))

    C_mat = np.column_stack(seg_chromas)  # [12, S]

    # Cosine similarity minus complexity penalty -> [N_chords, S]
    raw_sim = _TEMPLATES @ C_mat
    penalized = raw_sim - _PENALTIES[:, np.newaxis]

    path = _viterbi_smooth(penalized, stay_bonus=0.22)

    # Merge consecutive identical chord segments & compute true per-chord confidence
    merged: List[Dict] = []
    for idx, state in enumerate(path):
        t0, t1 = seg_ranges[idx]
        sim_col = raw_sim[:, idx]
        chosen_sim = float(sim_col[state])
        # Second best distinct root/quality similarity
        sorted_sims = np.sort(sim_col)
        second_sim = float(sorted_sims[-2]) if sorted_sims.size >= 2 else 0.0
        margin = max(0.0, chosen_sim - second_sim)
        conf = float(np.clip(0.75 * max(0.0, (chosen_sim - 0.35) / 0.60) + 0.25 * min(1.0, margin / 0.12), 0.0, 0.99))

        if seg_energies[idx] < 0.05:
            symbol = "N.C."
            meta = {"symbol": "N.C.", "root": "-", "quality": "nc", "notes": []}
            conf = 0.2
        else:
            meta = _CHORD_META[int(state)]
            symbol = meta["symbol"]

        if merged and merged[-1]["symbol"] == symbol:
            prev = merged[-1]
            prev_dur = prev["end_sec"] - prev["start_sec"]
            cur_dur = t1 - t0
            total_dur = prev_dur + cur_dur
            prev["confidence"] = round((prev["confidence"] * prev_dur + conf * cur_dur) / max(1e-6, total_dur), 3)
            prev["end_sec"] = round(t1, 4)
        else:
            merged.append(
                {
                    "id": str(uuid.uuid4())[:8],
                    "symbol": symbol,
                    "root": meta["root"],
                    "quality": meta["quality"],
                    "notes": meta["notes"],
                    "start_sec": round(t0, 4),
                    "end_sec": round(t1, 4),
                    "confidence": round(conf, 3),
                    "edited": False,
                }
            )

    valid_confs = [c["confidence"] for c in merged if c["symbol"] != "N.C."]
    avg_conf = round(float(np.mean(valid_confs)), 3) if valid_confs else 0.0
    low_conf = avg_conf < 0.55
    progression_summary = " | ".join(c["symbol"] for c in merged if c["symbol"] != "N.C.")

    warning = (
        "Análise harmônica com confiança moderada/baixa (acordes com inversões complexas, distorção ou arranjo denso). "
        "Clique em qualquer acorde para corrigi-lo manualmente."
        if low_conf
        else None
    )

    return {
        "chords": merged,
        "progression_summary": progression_summary,
        "average_confidence": avg_conf,
        "low_confidence": low_conf,
        "warning": warning,
    }

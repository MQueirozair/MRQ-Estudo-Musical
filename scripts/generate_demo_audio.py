#!/usr/bin/env python3
"""
Generates realistic multi-instrument musical study audio tracks (Piano + Bass + Drums + Lead Melody)
in Am -> F -> C -> G at 120 BPM (4/4) for real end-to-end testing and built-in demo study.
All audio is 100% copyright-free programmatic synthesis.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path
import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from core.audio_engine.decoder import encode_audio


def midi_to_hz(midi: int) -> float:
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def synth_piano_note(midi: int, dur: float, sr: int, amp: float = 0.22) -> np.ndarray:
    n = int(dur * sr)
    t = np.arange(n, dtype=np.float64) / sr
    f0 = midi_to_hz(midi)
    # Harmonic additive piano-like timbre with exponential decay
    sig = (
        1.00 * np.sin(2 * np.pi * f0 * t) * np.exp(-2.2 * t)
        + 0.42 * np.sin(2 * np.pi * 2 * f0 * t) * np.exp(-3.4 * t)
        + 0.18 * np.sin(2 * np.pi * 3 * f0 * t) * np.exp(-4.8 * t)
        + 0.08 * np.sin(2 * np.pi * 4 * f0 * t) * np.exp(-6.5 * t)
    )
    attack = min(int(0.008 * sr), n)
    if attack > 0:
        sig[:attack] *= np.linspace(0.0, 1.0, attack)
    release = min(int(0.04 * sr), n)
    if release > 0:
        sig[-release:] *= np.linspace(1.0, 0.0, release)
    return (sig * amp).astype(np.float32)


def synth_bass_note(midi: int, dur: float, sr: int, amp: float = 0.30) -> np.ndarray:
    n = int(dur * sr)
    t = np.arange(n, dtype=np.float64) / sr
    f0 = midi_to_hz(midi)
    sig = (
        1.00 * np.sin(2 * np.pi * f0 * t) * np.exp(-1.4 * t)
        + 0.35 * np.sin(2 * np.pi * 2 * f0 * t) * np.exp(-2.8 * t)
    )
    attack = min(int(0.01 * sr), n)
    if attack > 0:
        sig[:attack] *= np.linspace(0.0, 1.0, attack)
    return (sig * amp).astype(np.float32)


def synth_kick(sr: int, amp: float = 0.42) -> np.ndarray:
    dur = 0.22
    n = int(dur * sr)
    t = np.arange(n, dtype=np.float64) / sr
    freq = 140.0 * np.exp(-24.0 * t) + 48.0
    phase = 2 * np.pi * np.cumsum(freq) / sr
    env = np.exp(-14.0 * t)
    return (np.sin(phase) * env * amp).astype(np.float32)


def synth_snare(sr: int, rng: np.random.Generator, amp: float = 0.25) -> np.ndarray:
    dur = 0.16
    n = int(dur * sr)
    t = np.arange(n, dtype=np.float64) / sr
    tone = np.sin(2 * np.pi * 190.0 * t) * np.exp(-22.0 * t)
    noise = rng.standard_normal(n) * np.exp(-18.0 * t)
    return ((0.45 * tone + 0.55 * noise) * amp).astype(np.float32)


def synth_hihat(sr: int, rng: np.random.Generator, amp: float = 0.08) -> np.ndarray:
    dur = 0.05
    n = int(dur * sr)
    t = np.arange(n, dtype=np.float64) / sr
    noise = rng.standard_normal(n)
    # Simple high-pass via 1st difference
    hp = np.diff(noise, prepend=0.0)
    return (hp * np.exp(-55.0 * t) * amp).astype(np.float32)


def synth_lead_vocal(midi: int, dur: float, sr: int, amp: float = 0.20) -> np.ndarray:
    """Centered voice-like melody with subtle 5.5Hz vibrato."""
    n = int(dur * sr)
    t = np.arange(n, dtype=np.float64) / sr
    f0 = midi_to_hz(midi)
    vibrato = 1.0 + 0.004 * np.sin(2 * np.pi * 5.5 * t)
    phase = 2 * np.pi * np.cumsum(f0 * vibrato) / sr
    sig = (
        1.0 * np.sin(phase)
        + 0.35 * np.sin(2 * phase)
        + 0.20 * np.sin(3 * phase)
        + 0.10 * np.sin(4 * phase)
    )
    attack = min(int(0.03 * sr), n)
    release = min(int(0.05 * sr), n)
    env = np.ones(n, dtype=np.float64)
    if attack > 0:
        env[:attack] = np.linspace(0.0, 1.0, attack)
    if release > 0:
        env[-release:] = np.linspace(1.0, 0.0, release)
    return (sig * env * amp).astype(np.float32)


def generate_study_song(sr: int = 44100, bpm: float = 120.0, bars: int = 8) -> np.ndarray:
    """
    Produces a stereo 8-bar (16s @ 120 BPM) piece in A minor:
    Progression per 4 bars: | Am | F | C | G | (repeated twice)
    """
    beat_sec = 60.0 / bpm
    bar_sec = beat_sec * 4.0
    total_sec = bars * bar_sec
    total_frames = int(math.ceil(total_sec * sr))

    left = np.zeros(total_frames, dtype=np.float32)
    right = np.zeros(total_frames, dtype=np.float32)
    rng = np.random.default_rng(42)

    def add_stereo(buf: np.ndarray, start_s: float, pan: float = 0.0) -> None:
        idx = int(round(start_s * sr))
        end = min(total_frames, idx + buf.size)
        if idx >= total_frames or end <= idx:
            return
        seg = buf[: end - idx]
        l_gain = math.cos((pan + 1.0) * math.pi / 4.0)
        r_gain = math.sin((pan + 1.0) * math.pi / 4.0)
        left[idx:end] += seg * l_gain
        right[idx:end] += seg * r_gain

    # Progression: Am, F, C, G
    progression = [
        ("Am", [57, 60, 64], 45, [69, 72, 71, 69]),  # A3-C4-E4, bass A2, melody A4-C5-B4-A4
        ("F",  [53, 57, 60], 41, [65, 69, 67, 65]),  # F3-A3-C4, bass F2, melody F4-A4-G4-F4
        ("C",  [48, 52, 55], 36, [64, 67, 69, 67]),  # C3-E3-G3, bass C2, melody E4-G4-A4-G4
        ("G",  [55, 59, 62], 43, [67, 71, 69, 67]),  # G3-B3-D4, bass G2, melody G4-B4-A4-G4
    ]

    kick = synth_kick(sr)
    snare = synth_snare(sr, rng)
    hihat = synth_hihat(sr, rng)

    for bar in range(bars):
        _, chord_notes, bass_note, mel_notes = progression[bar % 4]
        bar_t = bar * bar_sec

        # Piano chords (slightly panned stereo L/R for realistic stereo image)
        for i, midi in enumerate(chord_notes):
            pan = -0.45 if i == 0 else (0.45 if i == 2 else -0.25)
            add_stereo(synth_piano_note(midi, bar_sec * 0.95, sr, amp=0.14), bar_t, pan=pan)
            # Second rhythmic strum on beat 3
            add_stereo(synth_piano_note(midi, beat_sec * 1.9, sr, amp=0.10), bar_t + 2 * beat_sec, pan=-pan)

        # Bass (centered)
        add_stereo(synth_bass_note(bass_note, beat_sec * 1.9, sr, amp=0.28), bar_t, pan=0.0)
        add_stereo(synth_bass_note(bass_note, beat_sec * 1.9, sr, amp=0.24), bar_t + 2 * beat_sec, pan=0.0)

        # Lead melody (centered, like vocal/solo)
        for beat_idx, m_midi in enumerate(mel_notes):
            add_stereo(synth_lead_vocal(m_midi, beat_sec * 0.88, sr, amp=0.16), bar_t + beat_idx * beat_sec, pan=0.0)

        # Drums: kick on 1 & 3, snare on 2 & 4, hi-hat on 8th notes
        add_stereo(kick, bar_t + 0 * beat_sec, pan=0.0)
        add_stereo(snare, bar_t + 1 * beat_sec, pan=0.1)
        add_stereo(kick, bar_t + 2 * beat_sec, pan=0.0)
        add_stereo(snare, bar_t + 3 * beat_sec, pan=0.1)
        for eighth in range(8):
            add_stereo(hihat, bar_t + eighth * (beat_sec / 2.0), pan=0.35)

    stereo = np.stack([left, right], axis=1)
    peak = float(np.max(np.abs(stereo))) or 1.0
    stereo = (stereo / peak) * 0.88
    return stereo.astype(np.float32)


def main() -> None:
    out_dir = REPO_ROOT / "assets" / "samples"
    out_dir.mkdir(parents=True, exist_ok=True)
    pcm = generate_study_song(sr=44100, bpm=120.0, bars=8)
    wav_path = out_dir / "mrq_estudo_demo_120bpm_Am.wav"
    encode_audio(pcm, 44100, wav_path, fmt="wav")
    print(f"Generated demo study track: {wav_path} ({wav_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

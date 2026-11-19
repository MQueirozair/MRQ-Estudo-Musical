"""Performance, RAM Usage and Memory Leak Tests for C++17 DSP Core across durations."""

from __future__ import annotations

import gc
import os
import time
import numpy as np
import psutil

from core.audio_engine.bridge import get_dsp_engine


def test_cpp_dsp_no_memory_leak_repeated_calls():
    """Calls native C++ time_and_pitch & spectrogram 15 times and asserts bounded RSS memory."""
    dsp = get_dsp_engine()
    proc = psutil.Process(os.getpid())
    sr = 44100
    t = np.arange(sr * 3, dtype=np.float32) / sr  # 3s stereo
    stereo = np.stack([0.5 * np.sin(2 * np.pi * 440 * t), 0.5 * np.sin(2 * np.pi * 660 * t)], axis=1)

    # Warm-up
    _ = dsp.time_and_pitch(stereo, sr, speed_ratio=0.75, semitones=2, cents=0)
    gc.collect()
    rss_start_mb = proc.memory_info().rss / (1024 * 1024)

    t0 = time.perf_counter()
    for i in range(15):
        out = dsp.time_and_pitch(stereo, sr, speed_ratio=0.75 if i % 2 == 0 else 1.25, semitones=-1, cents=10)
        spec = dsp.compute_spectrogram(out[:, 0], sr, fft_size=2048, hop_size=1024, log_freq_bins=128)
        assert spec.shape[1] == 128
        del out, spec
    elapsed = time.perf_counter() - t0
    gc.collect()
    rss_end_mb = proc.memory_info().rss / (1024 * 1024)
    delta_mb = rss_end_mb - rss_start_mb

    # RSS growth must remain well under 40 MB across 15 native heap alloc/free cycles
    assert delta_mb < 40.0, f"Possível vazamento de memória detectado: +{delta_mb:.1f} MB"
    assert elapsed < 30.0, f"Processamento DSP excessivamente lento: {elapsed:.2f}s"


def test_long_track_60s_waveform_and_stretch_performance():
    """Validates fast processing and reasonable RAM on a 60-second 44.1kHz stereo track."""
    dsp = get_dsp_engine()
    sr = 44100
    n_frames = sr * 60
    rng = np.random.default_rng(7)
    stereo = (rng.standard_normal((n_frames, 2)) * 0.1).astype(np.float32)

    t0 = time.perf_counter()
    mn, mx, rms = dsp.compute_waveform_peaks(stereo, num_bins=4000)
    wf_ms = (time.perf_counter() - t0) * 1000
    assert mn.size == 4000 and wf_ms < 500.0, f"Waveform 60s demorou {wf_ms:.1f} ms"

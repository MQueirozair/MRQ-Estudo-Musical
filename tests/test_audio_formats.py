"""Multi-format import/export & multi-sample-rate audio tests (MP3, WAV, M4A, FLAC, AAC, OGG, AIFF)."""

from __future__ import annotations

from pathlib import Path
import numpy as np
import pytest

from core.audio_engine.decoder import decode_audio, encode_audio, probe_audio_metadata
from scripts.generate_demo_audio import generate_study_song


@pytest.mark.parametrize("ext", ["mp3", "wav", "m4a", "flac", "aac", "ogg", "aiff"])
def test_encode_probe_decode_all_supported_formats(tmp_path: Path, ext: str):
    pcm = generate_study_song(sr=44100, bpm=120.0, bars=2)  # 4.0 seconds stereo
    out_file = tmp_path / f"sample.{ext}"

    encode_audio(pcm, 44100, out_file, fmt=ext)
    assert out_file.exists() and out_file.stat().st_size > 2000

    meta = probe_audio_metadata(out_file)
    assert meta.channels == 2
    assert meta.duration_sec >= 3.5
    assert meta.sample_rate in (44100, 48000)

    decoded, sr = decode_audio(out_file)
    assert decoded.ndim == 2 and decoded.shape[1] == 2
    assert decoded.shape[0] > sr * 3.5
    assert np.all(np.isfinite(decoded))


@pytest.mark.parametrize("sample_rate", [22050, 44100, 48000])
def test_multiple_sample_rates(tmp_path: Path, sample_rate: int):
    pcm = generate_study_song(sr=sample_rate, bpm=120.0, bars=1)
    wav = tmp_path / f"sr_{sample_rate}.wav"
    encode_audio(pcm, sample_rate, wav, fmt="wav")

    meta = probe_audio_metadata(wav)
    assert meta.sample_rate == sample_rate
    dec, sr = decode_audio(wav)
    assert sr == sample_rate
    assert abs(dec.shape[0] - pcm.shape[0]) <= 8

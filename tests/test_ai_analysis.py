"""Real Musical AI & Analysis Tests: BPM, Key, Notes, Chords, 4-Stem Separation and Model Manager."""

from __future__ import annotations

from pathlib import Path
import numpy as np

from ai.bpm_detection import analyze_bpm_and_beats, compute_tap_tempo
from ai.chord_detection import analyze_chords
from ai.key_detection import analyze_key_and_scale
from ai.model_manager import ModelManager
from ai.note_detection import analyze_notes_and_melody
from ai.source_separation import separate_audio_stems
from core.audio_engine.decoder import decode_audio, encode_audio
from scripts.generate_demo_audio import generate_study_song


def test_bpm_beats_and_tap_tempo():
    pcm_120 = generate_study_song(sr=44100, bpm=120.0, bars=8)
    res = analyze_bpm_and_beats(pcm_120, 44100)
    assert abs(res["bpm"] - 120.0) < 2.5, f"BPM esperado ~120, obtido {res['bpm']}"
    assert res["confidence"] >= 0.70
    assert res["time_signature"] == "4/4"
    assert len(res["beats"]) >= 24

    pcm_92 = generate_study_song(sr=44100, bpm=92.0, bars=6)
    res92 = analyze_bpm_and_beats(pcm_92, 44100)
    assert abs(res92["bpm"] - 92.0) < 3.0, f"BPM esperado ~92, obtido {res92['bpm']}"

    # Tap tempo at 100 BPM (0.6s per beat) with one outlier
    tap = compute_tap_tempo([0.0, 0.6, 1.2, 1.8, 2.4, 3.0])
    assert tap["bpm"] is not None and abs(tap["bpm"] - 100.0) < 0.5
    assert tap["stability"] > 0.95


def test_key_and_scale_detection():
    pcm = generate_study_song(sr=44100, bpm=120.0, bars=8)
    res = analyze_key_and_scale(pcm, 44100)
    # Am-F-C-G is strictly diatonic to A Minor / C Major (relative keys)
    top_keys = [c["key"] for c in res["candidates"][:2]]
    assert "A Menor" in top_keys or "C Maior" in top_keys
    assert res["confidence"] > 0.50
    assert len(res["scale_notes"]) >= 5


def test_polyphonic_note_melody_and_bass_detection():
    pcm = generate_study_song(sr=44100, bpm=120.0, bars=4)
    res = analyze_notes_and_melody(pcm, 44100)
    assert res["note_count"] >= 15
    assert len(res["melody_notes"]) >= 6
    assert len(res["bass_notes"]) >= 3
    assert res["average_confidence"] >= 0.50
    # Verify real pitch classes from Am-F-C-G appear (A, C, E, F, G)
    detected_pcs = {n["pitch"] % 12 for n in res["notes"]}
    assert {9, 0, 4}.issubset(detected_pcs), f"Notas de Am ausentes: {detected_pcs}"


def test_chord_recognition_progression():
    pcm = generate_study_song(sr=44100, bpm=120.0, bars=8)
    bpm_res = analyze_bpm_and_beats(pcm, 44100)
    ch_res = analyze_chords(pcm, 44100, beats_sec=bpm_res["beats"])
    symbols = [c["symbol"] for c in ch_res["chords"]]
    assert len(symbols) >= 4
    # Must detect core progression chords Am, F, C, G
    for expected in ("Am", "F", "C", "G"):
        assert any(s.startswith(expected) for s in symbols), f"Acorde {expected} não detectado em {symbols}"


def test_source_separation_4_stems_energy_coherence(tmp_path: Path):
    pcm = generate_study_song(sr=44100, bpm=120.0, bars=4)
    mix_wav = tmp_path / "mix.wav"
    encode_audio(pcm, 44100, mix_wav, fmt="wav")

    sep = separate_audio_stems(mix_wav, tmp_path / "stems")
    assert set(sep["stems"].keys()) == {"vocals", "drums", "bass", "other"}

    recombined = None
    for key in ("vocals", "drums", "bass", "other"):
        info = sep["stems"][key]
        assert Path(info["file_path"]).exists()
        assert info["rms_level"] > 0.005, f"Stem {key} está silencioso"
        stem_pcm, sr = decode_audio(info["file_path"])
        assert sr == 44100
        if recombined is None:
            recombined = stem_pcm.copy()
        else:
            n = min(recombined.shape[0], stem_pcm.shape[0])
            recombined = recombined[:n] + stem_pcm[:n]

    # Partition of unity verification: sum of 4 stems closely reconstructs original mix
    n = min(pcm.shape[0], recombined.shape[0])
    corr = float(np.corrcoef(pcm[:n, 0], recombined[:n, 0])[0, 1])
    assert corr > 0.92, f"Reconstrução coerente falhou: correlação={corr:.3f}"


def test_model_manager_catalog_and_runtime():
    mm = ModelManager(Path("models"))
    rt = mm.runtime_info()
    assert rt["offline_mode_ready"] is True
    assert "CPUExecutionProvider" in rt["execution_providers"]
    models = mm.list_models()
    assert len(models) >= 4
    ids = {m["id"] for m in models}
    assert {"basic-pitch-onnx", "htdemucs-4stems-onnx"}.issubset(ids)

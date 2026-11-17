"""End-to-End Integration Tests for FastAPI Engine, Multi-file Import, Range Streaming & All Exports."""

from __future__ import annotations

import io
from pathlib import Path
import mido
from fastapi.testclient import TestClient

from backend.main import create_app
from core.audio_engine.decoder import encode_audio
from scripts.generate_demo_audio import generate_study_song


def test_full_studio_api_workflow_and_exports(tmp_path: Path):
    app = create_app(data_dir=tmp_path / "studio_data")
    client = TestClient(app)

    # 1. Health check
    h = client.get("/api/health")
    assert h.status_code == 200
    assert h.json()["dsp"]["dsp_version"].startswith("1.0.0")

    # 2. Import multiple audio files (MP3 + FLAC)
    pcm = generate_study_song(sr=44100, bpm=120.0, bars=4)
    mp3_path = tmp_path / "song_a.mp3"
    flac_path = tmp_path / "song_b.flac"
    encode_audio(pcm, 44100, mp3_path, fmt="mp3")
    encode_audio(pcm, 44100, flac_path, fmt="flac")

    with open(mp3_path, "rb") as f1, open(flac_path, "rb") as f2:
        imp = client.post(
            "/api/audio/import",
            files=[
                ("files", ("song_a.mp3", f1, "audio/mpeg")),
                ("files", ("song_b.flac", f2, "audio/flac")),
            ],
        )
    assert imp.status_code == 200
    assert imp.json()["count"] == 2
    pid = imp.json()["imported"][0]["id"]

    # 3. Stream time-stretched & pitch-shifted audio with HTTP Range Request (206 Partial Content)
    r_audio = client.get(
        f"/api/projects/{pid}/audio?speed=0.75&semitones=-2&cents=0",
        headers={"Range": "bytes=0-4095"},
    )
    assert r_audio.status_code == 206
    assert r_audio.content[:4] == b"RIFF"
    assert len(r_audio.content) == 4096

    # 4. Waveform & Spectrogram
    wf = client.get(f"/api/projects/{pid}/waveform?bins=400").json()
    assert wf["bins"] == 400 and len(wf["max"]) == 400
    sp = client.get(f"/api/projects/{pid}/spectrogram?log_scale=true&bins=64").json()
    assert sp["bins"] == 64 and sp["frames"] > 10

    # 5. Full AI Musical Analysis
    ana = client.post(f"/api/projects/{pid}/analyze/full")
    assert ana.status_code == 200
    body = ana.json()
    assert abs(body["bpm"]["bpm"] - 120.0) < 3.0
    assert body["notes"]["note_count"] > 10
    assert len(body["chords"]["chords"]) >= 4

    # 6. Manual Edit of Piano Roll Notes & Chords
    edited_notes = [
        {"pitch": 69, "note_name": "A4", "start_sec": 0.0, "duration_sec": 0.5, "velocity": 105, "confidence": 1.0, "role": "melody", "channel": 0, "edited": True},
        {"pitch": 72, "note_name": "C5", "start_sec": 0.5, "duration_sec": 0.5, "velocity": 100, "confidence": 1.0, "role": "melody", "channel": 0, "edited": True},
        {"pitch": 76, "note_name": "E5", "start_sec": 1.0, "duration_sec": 1.0, "velocity": 110, "confidence": 1.0, "role": "melody", "channel": 0, "edited": True},
    ]
    rn = client.put(f"/api/projects/{pid}/notes", json={"notes": edited_notes})
    assert rn.status_code == 200 and rn.json()["count"] == 3

    # 7. Separate 4 Stems & stream vocals stem
    sep = client.post(f"/api/projects/{pid}/stems/separate")
    assert sep.status_code == 200
    assert "vocals" in sep.json()["stems"]
    r_stem = client.get(f"/api/projects/{pid}/stems/vocals/audio?speed=1.0&semitones=0&cents=0")
    assert r_stem.status_code == 200 and r_stem.content[:4] == b"RIFF"

    # 8. Export ALL formats and verify real file signatures
    exp_mp3 = client.post(f"/api/projects/{pid}/export", json={"format": "mp3", "scope": "loop", "start_sec": 0.0, "end_sec": 2.0, "speed": 0.5, "semitones": 2, "cents": 0})
    assert exp_mp3.status_code == 200 and len(exp_mp3.content) > 5000

    exp_wav = client.post(f"/api/projects/{pid}/export", json={"format": "wav", "scope": "stem", "stem_key": "bass", "speed": 1.0, "semitones": 0, "cents": 0})
    assert exp_wav.status_code == 200 and exp_wav.content[:4] == b"RIFF"

    exp_flac = client.post(f"/api/projects/{pid}/export", json={"format": "flac", "scope": "stems_mix", "stem_gains": {"vocals": 0.0, "drums": 1.0, "bass": 1.0, "other": 1.0}, "stem_mutes": {"vocals": True}})
    assert exp_flac.status_code == 200 and exp_flac.content[:4] == b"fLaC"

    exp_mid = client.post(f"/api/projects/{pid}/export", json={"format": "mid"})
    assert exp_mid.status_code == 200 and exp_mid.content[:4] == b"MThd"
    mid_parsed = mido.MidiFile(file=io.BytesIO(exp_mid.content))
    note_ons = [msg for track in mid_parsed.tracks for msg in track if msg.type == "note_on" and msg.velocity > 0]
    assert len(note_ons) == 3

    exp_ntxt = client.post(f"/api/projects/{pid}/export", json={"format": "txt_notes"})
    assert exp_ntxt.status_code == 200 and "A4" in exp_ntxt.text

    exp_ctxt = client.post(f"/api/projects/{pid}/export", json={"format": "txt_chords"})
    assert exp_ctxt.status_code == 200 and "PROGRESSÃO HARMÔNICA" in exp_ctxt.text

    exp_pdf = client.post(f"/api/projects/{pid}/export", json={"format": "pdf"})
    assert exp_pdf.status_code == 200 and exp_pdf.content[:5] == b"%PDF-"


def test_youtube_study_project_api_formats_and_persistence(tmp_path: Path):
    """Validates official YouTube IFrame Study Mode project creation (no media download) & study state persistence."""
    app = create_app(data_dir=tmp_path / "yt_studio_data")
    client = TestClient(app)

    valid_urls = [
        ("https://www.youtube.com/watch?v=aNOyvBm9Gfw&t=45s", "aNOyvBm9Gfw"),
        ("https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/shorts/M7lc1UVf-VE", "M7lc1UVf-VE"),
        ("https://www.youtube.com/embed/aqz-KE-bpKQ", "aqz-KE-bpKQ"),
        ("aNOyvBm9Gfw", "aNOyvBm9Gfw"),
    ]
    for url, expected_id in valid_urls:
        res = client.post("/api/projects/youtube", json={"url": url, "name": f"Estudo {expected_id}"})
        assert res.status_code == 200
        data = res.json()
        assert data["source_type"] == "youtube"
        assert data["youtube_video_id"] == expected_id
        assert data["youtube_url"] == f"https://www.youtube.com/watch?v={expected_id}"
        assert data["audio_file_path"] is None

    # Invalid URL rejected cleanly
    bad = client.post("/api/projects/youtube", json={"url": "https://example.com/not-youtube"})
    assert bad.status_code == 400

    # Persist duration, speed, precount, manual beats, loops and markers on YouTube project
    created = client.post(
        "/api/projects/youtube",
        json={"url": "https://www.youtube.com/watch?v=aNOyvBm9Gfw", "name": "Hino Harpa"},
    ).json()
    yt_id = created["id"]

    patched = client.patch(
        f"/api/projects/{yt_id}",
        json={"duration_sec": 412.5, "speed": 0.75, "precount_sec": 2.0, "bpm": 88.0, "manual_beats": [10.0, 10.68, 11.36]},
    )
    assert patched.status_code == 200
    assert patched.json()["duration_sec"] == 412.5
    assert patched.json()["manual_beats"] == [10.0, 10.68, 11.36]

    lp = client.post(
        f"/api/projects/{yt_id}/loops",
        json={"name": "Refrão Lento", "start_sec": 344.2, "end_sec": 351.8, "speed": 0.75, "semitones": 0, "cents": 0},
    )
    assert lp.status_code == 200

    mk = client.post(
        f"/api/projects/{yt_id}/markers",
        json={"label": "Entrada Coral", "section_type": "Refrão", "time_sec": 344.2, "color": "#38BDF8", "note": ""},
    )
    assert mk.status_code == 200

    loaded = client.get(f"/api/projects/{yt_id}").json()
    assert len(loaded["loops"]) == 1
    assert len(loaded["markers"]) == 1
    assert loaded["manual_beats"] == [10.0, 10.68, 11.36]

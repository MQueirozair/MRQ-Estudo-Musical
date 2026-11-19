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

    # Pure YouTube project supports interactive Piano Roll & Chords + real MIDI / Cifras / PDF export!
    rn = client.put(
        f"/api/projects/{yt_id}/notes",
        json={
            "notes": [
                {"pitch": 60, "note_name": "C4", "start_sec": 1.0, "duration_sec": 0.5, "velocity": 100, "confidence": 1.0, "role": "melody", "channel": 0, "edited": True},
                {"pitch": 64, "note_name": "E4", "start_sec": 1.5, "duration_sec": 0.5, "velocity": 100, "confidence": 1.0, "role": "melody", "channel": 0, "edited": True},
            ]
        },
    )
    assert rn.status_code == 200
    rc = client.put(
        f"/api/projects/{yt_id}/chords",
        json={
            "chords": [
                {"symbol": "C", "root": "C", "quality": "maj", "notes": ["C", "E", "G"], "start_sec": 0.0, "end_sec": 4.0, "confidence": 1.0, "edited": True},
            ]
        },
    )
    assert rc.status_code == 200
    assert client.post(f"/api/projects/{yt_id}/export", json={"format": "mid"}).content[:4] == b"MThd"
    assert client.post(f"/api/projects/{yt_id}/export", json={"format": "txt_chords"}).status_code == 200
    assert client.post(f"/api/projects/{yt_id}/export", json={"format": "pdf"}).content[:5] == b"%PDF-"

    # Hybrid YouTube + Attached Audio unlocks full AI Analysis, Pitch Shift, Waveform & 4-Stem Separation on the SAME project!
    pcm = generate_study_song(sr=44100, bpm=120.0, bars=2)
    wav_path = tmp_path / "attached_ref.wav"
    encode_audio(pcm, 44100, wav_path, fmt="wav")
    with open(wav_path, "rb") as f:
        att = client.post(
            f"/api/audio/import?project_id={yt_id}",
            files=[("files", ("attached_ref.wav", f, "audio/wav"))],
        )
    assert att.status_code == 200
    hybrid = client.get(f"/api/projects/{yt_id}").json()
    assert hybrid["source_type"] == "youtube"
    assert hybrid["youtube_video_id"] == "aNOyvBm9Gfw"
    assert hybrid["audio_file_path"] is not None
    assert len(hybrid["loops"]) == 1
    assert len(hybrid["markers"]) == 1

    # Now AI Analysis & 4-Stem Separation run natively on the Hybrid YouTube project!
    ana = client.post(f"/api/projects/{yt_id}/analyze/full")
    assert ana.status_code == 200 and ana.json()["notes"]["note_count"] > 0
    sep = client.post(f"/api/projects/{yt_id}/stems/separate")
    assert sep.status_code == 200 and "vocals" in sep.json()["stems"]


def test_local_video_mp4_import_streaming_dsp_ai_stems_and_ssrf_guard(tmp_path: Path):
    """Tests importing a real .mp4 video (video + audio), Range streaming, DSP/AI/Stems, and video-url SSRF guard."""
    import av
    import numpy as np

    app = create_app(data_dir=tmp_path / "video_studio_data")
    client = TestClient(app)

    # Generate a real minimal MP4 video with a video stream + stereo AAC audio stream via PyAV
    mp4_path = tmp_path / "aula_estudo.mp4"
    pcm = generate_study_song(sr=44100, bpm=120.0, bars=2)
    with av.open(str(mp4_path), mode="w", format="mp4") as container:
        vstream = container.add_stream("mpeg4", rate=10)
        vstream.width = 64
        vstream.height = 64
        vstream.pix_fmt = "yuv420p"
        astream = container.add_stream("aac", rate=44100)
        astream.layout = "stereo"

        for _ in range(10):
            img = np.zeros((64, 64, 3), dtype=np.uint8)
            vframe = av.VideoFrame.from_ndarray(img, format="rgb24")
            for pkt in vstream.encode(vframe):
                container.mux(pkt)
        for pkt in vstream.encode():
            container.mux(pkt)

        # Feed audio in 1024-sample stereo planar float frames
        total_frames = pcm.shape[0]
        pos = 0
        while pos < total_frames:
            chunk = pcm[pos : pos + 1024]
            if chunk.shape[0] < 1024:
                chunk = np.pad(chunk, ((0, 1024 - chunk.shape[0]), (0, 0)))
            planar = np.ascontiguousarray(chunk.T, dtype=np.float32)
            aframe = av.AudioFrame.from_ndarray(planar, format="fltp", layout="stereo")
            aframe.sample_rate = 44100
            for pkt in astream.encode(aframe):
                container.mux(pkt)
            pos += 1024
        for pkt in astream.encode():
            container.mux(pkt)

    with open(mp4_path, "rb") as f:
        imp = client.post("/api/audio/import", files=[("files", ("aula_estudo.mp4", f, "video/mp4"))])
    assert imp.status_code == 200
    vproj = imp.json()["imported"][0]
    vid = vproj["id"]
    assert vproj["source_type"] == "video"

    # Stream video with HTTP Range 206
    rv = client.get(f"/api/projects/{vid}/video", headers={"Range": "bytes=0-1023"})
    assert rv.status_code == 206 and len(rv.content) == 1024

    # DSP audio pitch-shift & time-stretch, AI analysis & 4-Stem separation all work on MP4 video!
    ra = client.get(f"/api/projects/{vid}/audio?speed=0.75&semitones=-2&cents=0", headers={"Range": "bytes=0-1023"})
    assert ra.status_code == 206 and ra.content[:4] == b"RIFF"
    ana = client.post(f"/api/projects/{vid}/analyze/full")
    assert ana.status_code == 200 and ana.json()["notes"]["note_count"] > 0
    sep = client.post(f"/api/projects/{vid}/stems/separate")
    assert sep.status_code == 200 and "bass" in sep.json()["stems"]

    # Unified /api/projects/video-url routes YouTube cleanly and blocks SSRF loopback/private URLs
    yt_via_unified = client.post(
        "/api/projects/video-url",
        json={"url": "https://youtu.be/aNOyvBm9Gfw", "name": "Via Video-URL"},
    )
    assert yt_via_unified.status_code == 200
    assert yt_via_unified.json()["source_type"] == "youtube"

    ssrf_local = client.post("/api/projects/video-url", json={"url": "http://127.0.0.1:8765/api/health"})
    assert ssrf_local.status_code == 400
    ssrf_priv = client.post("/api/projects/video-url", json={"url": "http://192.168.1.10/test.mp4"})
    assert ssrf_priv.status_code == 400


def test_system_audio_capture_waveform_and_non_silent_conversion(tmp_path: Path):
    """
    Verifies the exact Windows WASAPI / System Audio Capture workflow:
    1) Create YouTube study project.
    2) Attach a captured stereo 48 kHz 16-bit PCM WAV (same binary format emitted by MRQAudioCaptureSession).
    3) Confirm waveform peaks are non-flat (audible signal rendered).
    4) Convert/export to MP3, WAV, and FLAC and verify EVERY output decodes with strong audible RMS (never silent/mute).
    """
    import struct
    import numpy as np
    from core.audio_engine.decoder import decode_audio

    app = create_app(data_dir=tmp_path / "sys_capture_data")
    client = TestClient(app)

    yt = client.post(
        "/api/projects/youtube",
        json={"url": "https://www.youtube.com/watch?v=aNOyvBm9Gfw", "name": "Teste Captura Sistema"},
    )
    assert yt.status_code == 200
    pid = yt.json()["id"]

    # Build a stereo 48 kHz 16-bit PCM WAV identical to apps/studio/src/utils/audioCapture.ts encodeStereoWavBlob()
    sr = 48000
    dur = 2.0
    n = int(sr * dur)
    t = np.arange(n, dtype=np.float32) / sr
    left = (0.55 * np.sin(2.0 * np.pi * 440.0 * t)).astype(np.float32)
    right = (0.55 * np.sin(2.0 * np.pi * 554.37 * t)).astype(np.float32)
    interleaved = np.empty(n * 2, dtype=np.int16)
    interleaved[0::2] = np.clip(left * 32767.0, -32768, 32767).astype(np.int16)
    interleaved[1::2] = np.clip(right * 32767.0, -32768, 32767).astype(np.int16)
    data_bytes = interleaved.tobytes()
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + len(data_bytes),
        b"WAVE",
        b"fmt ",
        16,
        1,
        2,
        sr,
        sr * 4,
        4,
        16,
        b"data",
        len(data_bytes),
    )
    cap_wav = tmp_path / "captura_som_sistema.wav"
    cap_wav.write_bytes(header + data_bytes)

    with open(cap_wav, "rb") as f:
        res = client.post(
            f"/api/audio/import?project_id={pid}",
            files=[("files", ("captura_som_sistema.wav", f, "audio/wav"))],
        )
    assert res.status_code == 200
    proj = client.get(f"/api/projects/{pid}").json()
    assert proj["audio_file_path"] is not None
    assert proj["sample_rate"] == 48000
    assert proj["channels"] == 2
    assert abs(proj["duration_sec"] - 2.0) < 0.05

    # Waveform must clearly show the captured audio peaks (never flat)
    wf = client.get(f"/api/projects/{pid}/waveform?bins=512")
    assert wf.status_code == 200
    wf_json = wf.json()
    assert max(wf_json["max"]) > 0.45
    assert min(wf_json["min"]) < -0.45

    # Convert & export to WAV, MP3, and FLAC and verify none of them are mute/silent
    for fmt in ("wav", "mp3", "flac"):
        exp = client.post(
            f"/api/projects/{pid}/export",
            json={"format": fmt, "scope": "full", "speed": 1.0, "semitones": 0, "cents": 0},
        )
        assert exp.status_code == 200 and len(exp.content) > 2000
        out_path = tmp_path / f"exported_{fmt}.{fmt}"
        out_path.write_bytes(exp.content)
        decoded, out_sr = decode_audio(out_path, target_sr=48000, mono=False)
        rms = float(np.sqrt(np.mean(decoded ** 2)))
        peak = float(np.max(np.abs(decoded)))
        assert out_sr == 48000
        assert rms > 0.25, f"{fmt} export was silent/too quiet (rms={rms})"
        assert peak > 0.40, f"{fmt} export peak too low (peak={peak})"


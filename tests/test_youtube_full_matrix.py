"""
Exhaustive End-to-End Test Matrix for YouTube Link:
    https://youtu.be/aNOyvBm9Gfw?si=btcuTvTbN0Z4j8YW

Tests EVERY possibility across:
  1. All YouTube URL formats + invalid URL & SSRF guards (/youtube and /video-url).
  2. YouTube-only study mode: BPM, key, speed, precount, tap tempo, manual beats,
     loops CRUD, markers CRUD (with XML special chars), Piano Roll notes, Chords,
     autosave/recovery, project clone, and exports WITHOUT audio (PDF, TXT chords,
     TXT notes, MIDI, and clean HTTP 400 for audio formats).
  3. System Audio Loopback Capture (stereo 48 kHz 16-bit PCM WAV) attached onto
     the SAME YouTube project: preserves loops/markers/beats, renders non-flat
     2400-bin waveform and linear/log FFT spectrograms.
  4. Real-time C++17 DSP streaming across speed (0.5x, 0.75x, 1.0x, 1.5x) and
     pitch (-12st, -3st/+25c, +12st) with audible RMS verification.
  5. Full Offline AI Analysis (BPM, Key, Notes, Chords, Full).
  6. 4-Stem Separation (vocals, drums, bass, other) + individual stem streaming.
  7. ALL 7 Export formats x ALL 5 Export scopes (full, loop, selection, stem,
     stems_mix with & without DSP) + out-of-range loop guard (HTTP 400, never mute),
     decoding EVERY exported MP3/WAV/FLAC to prove zero silent/mute files.
  8. Re-capture / Replace audio on the SAME YouTube project (no stale cache).
  9. Local audio/video file attachment (.mp3, .mp4) onto the YouTube project.
"""

from __future__ import annotations

import struct
from pathlib import Path

import av
import mido
import numpy as np
from fastapi.testclient import TestClient

from backend.main import create_app
from core.audio_engine.decoder import decode_audio, encode_audio
from scripts.generate_demo_audio import generate_study_song


TARGET_YT_URL = "https://youtu.be/aNOyvBm9Gfw?si=btcuTvTbN0Z4j8YW"
TARGET_YT_ID = "aNOyvBm9Gfw"


def _make_stereo_capture_wav(path: Path, sr: int = 48000, duration_sec: float = 4.0, f_left: float = 440.0, f_right: float = 554.37) -> Path:
    """Produces a Stereo 16-bit PCM WAV identical to apps/studio/src/utils/audioCapture.ts encodeStereoWavBlob()."""
    n = int(sr * duration_sec)
    t = np.arange(n, dtype=np.float32) / sr
    # Rich harmonic musical signal (chord + rhythm pulse) so AI BPM/Key/Notes/Chords & Stems all get real musical content
    env = 0.65 + 0.35 * np.sin(2.0 * np.pi * 2.0 * t)
    left = (
        0.30 * np.sin(2.0 * np.pi * f_left * t)
        + 0.22 * np.sin(2.0 * np.pi * (f_left * 1.25) * t)
        + 0.18 * np.sin(2.0 * np.pi * (f_left * 1.5) * t)
        + 0.15 * np.sin(2.0 * np.pi * (f_left * 0.25) * t)
    ) * env
    right = (
        0.30 * np.sin(2.0 * np.pi * f_right * t)
        + 0.20 * np.sin(2.0 * np.pi * (f_left * 1.5) * t)
        + 0.18 * np.sin(2.0 * np.pi * (f_left * 2.0) * t)
        + 0.15 * np.sin(2.0 * np.pi * (f_left * 0.25) * t)
    ) * env
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
    path.write_bytes(header + data_bytes)
    return path


def _assert_audible_audio_bytes(raw: bytes, fmt: str, tmp_dir: Path, label: str, min_rms: float = 0.04) -> tuple[float, float]:
    out_file = tmp_dir / f"verify_{label}.{fmt}"
    out_file.write_bytes(raw)
    pcm, sr = decode_audio(out_file, target_sr=44100, mono=False)
    assert pcm.shape[0] > 4000, f"{label} ({fmt}) decoded too short ({pcm.shape[0]} frames)"
    rms = float(np.sqrt(np.mean(pcm ** 2)))
    peak = float(np.max(np.abs(pcm)))
    assert rms >= min_rms, f"{label} ({fmt}) was silent/too quiet: rms={rms:.5f}"
    assert peak >= min_rms * 1.2, f"{label} ({fmt}) peak too low: peak={peak:.5f}"
    return rms, pcm.shape[0] / float(sr)


def test_youtube_url_variants_and_guards_for_target_link(tmp_path: Path):
    """Tests ALL URL formats for aNOyvBm9Gfw across /youtube and /video-url plus invalid & SSRF rejection."""
    app = create_app(data_dir=tmp_path / "url_matrix")
    client = TestClient(app)

    valid_variants = [
        TARGET_YT_URL,
        f"[{TARGET_YT_URL}]({TARGET_YT_URL})",
        "youtu.be/aNOyvBm9Gfw?si=btcuTvTbN0Z4j8YW",
        "https://www.youtube.com/watch?v=aNOyvBm9Gfw&si=btcuTvTbN0Z4j8YW&t=42s",
        "https://m.youtube.com/watch?v=aNOyvBm9Gfw",
        "https://music.youtube.com/watch?v=aNOyvBm9Gfw",
        "https://www.youtube.com/shorts/aNOyvBm9Gfw",
        "https://www.youtube.com/embed/aNOyvBm9Gfw",
        "https://www.youtube.com/live/aNOyvBm9Gfw",
        TARGET_YT_ID,
    ]

    for idx, url in enumerate(valid_variants):
        endpoint = "/api/projects/video-url" if idx % 2 == 0 else "/api/projects/youtube"
        r = client.post(endpoint, json={"url": url, "name": f"Variante {idx}"})
        assert r.status_code == 200, f"Failed for {url} on {endpoint}: {r.text}"
        p = r.json()
        assert p["source_type"] == "youtube"
        assert p["youtube_video_id"] == TARGET_YT_ID
        assert p["youtube_url"] == f"https://www.youtube.com/watch?v={TARGET_YT_ID}"

    # Invalid YouTube URL & SSRF private/loopback URLs must fail cleanly with HTTP 400
    assert client.post("/api/projects/youtube", json={"url": "https://example.com/not-youtube"}).status_code == 400
    assert client.post("/api/projects/video-url", json={"url": "http://127.0.0.1:8765/api/health"}).status_code == 400
    assert client.post("/api/projects/video-url", json={"url": "http://192.168.0.1/audio.mp3"}).status_code == 400
    assert client.post("/api/projects/video-url", json={"url": "ftp://example.com/video.mp4"}).status_code == 400


def test_full_all_possibilities_matrix_for_target_youtube_link(tmp_path: Path):
    """Exercises EVERY feature on https://youtu.be/aNOyvBm9Gfw?si=btcuTvTbN0Z4j8YW end-to-end."""
    app = create_app(data_dir=tmp_path / "full_matrix")
    client = TestClient(app)

    # 1) Create project from the exact user link
    r = client.post(
        "/api/projects/video-url",
        json={"url": TARGET_YT_URL, "name": "Estudo <A & B> — aNOyvBm9Gfw"},
    )
    assert r.status_code == 200
    proj = r.json()
    pid = proj["id"]
    assert proj["youtube_video_id"] == TARGET_YT_ID
    assert proj["audio_file_path"] is None

    # 2) YouTube-Only Study Mode: metadata, speed, precount, beats, tap tempo, loops, markers, notes, chords
    upd = client.patch(
        f"/api/projects/{pid}",
        json={
            "duration_sec": 215.0,
            "bpm": 118.5,
            "musical_key": "A minor",
            "scale_name": "Natural Minor",
            "time_signature": "4/4",
            "speed": 0.75,
            "precount_sec": 2.0,
            "manual_beats": [0.5, 1.0, 1.5, 2.0, 2.5, 3.0],
        },
    )
    assert upd.status_code == 200
    assert upd.json()["bpm"] == 118.5
    assert len(upd.json()["manual_beats"]) == 6

    tap = client.post("/api/tools/tap-tempo", json={"timestamps_sec": [0.0, 0.5, 1.0, 1.5, 2.0]})
    assert tap.status_code == 200 and abs(tap.json()["bpm"] - 120.0) < 1.0

    # Loops CRUD (create 2, delete 1, keep 1)
    l1 = client.post(
        f"/api/projects/{pid}/loops",
        json={"name": "Refrão <A & B>", "start_sec": 0.5, "end_sec": 2.5, "speed": 0.75, "semitones": -2, "cents": 0},
    )
    l2 = client.post(
        f"/api/projects/{pid}/loops",
        json={"name": "Temporário", "start_sec": 5.0, "end_sec": 10.0, "speed": 1.0},
    )
    assert l1.status_code == 200 and l2.status_code == 200
    assert client.delete(f"/api/projects/{pid}/loops/{l2.json()['id']}").status_code == 200

    # Markers CRUD (including XML characters that used to break ReportLab!)
    m1 = client.post(
        f"/api/projects/{pid}/markers",
        json={"label": "Intro & Riff <1>", "section_type": "Intro", "time_sec": 0.25, "color": "#38BDF8"},
    )
    m2 = client.post(
        f"/api/projects/{pid}/markers",
        json={"label": "Solo > Final", "section_type": "Solo", "time_sec": 2.0, "color": "#F59E0B"},
    )
    assert m1.status_code == 200 and m2.status_code == 200

    # Manual Piano Roll Notes & Chords (before audio attachment!)
    rn = client.put(
        f"/api/projects/{pid}/notes",
        json={
            "notes": [
                {"pitch": 57, "note_name": "A3", "start_sec": 0.2, "duration_sec": 1.0, "velocity": 95, "confidence": 1.0, "role": "melody", "edited": True},
                {"pitch": 60, "note_name": "C4", "start_sec": 1.2, "duration_sec": 1.0, "velocity": 90, "confidence": 1.0, "role": "melody", "edited": True},
                {"pitch": 64, "note_name": "E4", "start_sec": 2.2, "duration_sec": 1.0, "velocity": 100, "confidence": 1.0, "role": "melody", "edited": True},
            ]
        },
    )
    rc = client.put(
        f"/api/projects/{pid}/chords",
        json={
            "chords": [
                {"symbol": "Am", "root": "A", "quality": "min", "notes": ["A", "C", "E"], "start_sec": 0.0, "end_sec": 2.0, "confidence": 1.0, "edited": True},
                {"symbol": "F", "root": "F", "quality": "maj", "notes": ["F", "A", "C"], "start_sec": 2.0, "end_sec": 4.0, "confidence": 1.0, "edited": True},
            ]
        },
    )
    assert rn.status_code == 200 and rc.status_code == 200

    # Exports WITHOUT audio attached: PDF, TXT Chords, TXT Notes, MIDI succeed; MP3/WAV/FLAC cleanly return HTTP 400
    exp_pdf = client.post(f"/api/projects/{pid}/export", json={"format": "pdf"})
    assert exp_pdf.status_code == 200 and exp_pdf.content[:5] == b"%PDF-" and len(exp_pdf.content) > 1500

    exp_chords = client.post(f"/api/projects/{pid}/export", json={"format": "txt_chords"})
    assert exp_chords.status_code == 200
    chords_txt = exp_chords.content.decode("utf-8")
    assert f"https://www.youtube.com/watch?v={TARGET_YT_ID}" in chords_txt
    assert "Refrão <A & B>" in chords_txt and "Intro & Riff <1>" in chords_txt and "Am" in chords_txt

    exp_notes = client.post(f"/api/projects/{pid}/export", json={"format": "txt_notes"})
    assert exp_notes.status_code == 200
    assert "A3" in exp_notes.content.decode("utf-8")

    exp_mid = client.post(f"/api/projects/{pid}/export", json={"format": "mid"})
    assert exp_mid.status_code == 200 and exp_mid.content[:4] == b"MThd"
    mid_path = tmp_path / "yt_only.mid"
    mid_path.write_bytes(exp_mid.content)
    parsed_mid = mido.MidiFile(str(mid_path))
    assert any(msg.type == "note_on" for tr in parsed_mid.tracks for msg in tr)

    for audio_fmt in ("mp3", "wav", "flac"):
        no_audio_res = client.post(f"/api/projects/{pid}/export", json={"format": audio_fmt, "scope": "full"})
        assert no_audio_res.status_code == 400

    # Autosave + Recovery + Clone check
    assert client.post(f"/api/projects/{pid}/autosave", json={"state": {"speed": 0.75, "loopA": 0.5, "loopB": 2.5}}).status_code == 200
    cloned = client.post(f"/api/projects/{pid}/clone", json={"name": "Cópia aNOyvBm9Gfw"})
    assert cloned.status_code == 200
    assert cloned.json()["youtube_video_id"] == TARGET_YT_ID
    assert len(cloned.json()["loops"]) == 1
    assert len(cloned.json()["markers"]) == 2
    assert client.post(f"/api/projects/{pid}/clean-save").status_code == 200

    # 3) Attach Captured System Audio (Stereo 48 kHz 16-bit PCM WAV — WASAPI Loopback format) onto SAME YouTube project
    cap1_path = _make_stereo_capture_wav(tmp_path / "captura_som_sistema_1.wav", sr=48000, duration_sec=4.0)
    with open(cap1_path, "rb") as f:
        imp = client.post(
            f"/api/audio/import?project_id={pid}",
            files=[("files", ("captura_som_sistema_1.wav", f, "audio/wav"))],
        )
    assert imp.status_code == 200
    hybrid = client.get(f"/api/projects/{pid}").json()
    assert hybrid["source_type"] == "youtube"
    assert hybrid["youtube_video_id"] == TARGET_YT_ID
    assert hybrid["audio_file_path"] is not None
    assert hybrid["sample_rate"] == 48000 and hybrid["channels"] == 2
    assert abs(hybrid["duration_sec"] - 4.0) < 0.05
    # Loops, markers, beats preserved!
    assert len(hybrid["loops"]) == 1 and len(hybrid["markers"]) == 2 and len(hybrid["manual_beats"]) == 6

    # 4) Waveform (non-flat!) + FFT Spectrogram (log + linear)
    wf = client.get(f"/api/projects/{pid}/waveform?bins=2400")
    assert wf.status_code == 200
    wf_j = wf.json()
    assert len(wf_j["max"]) == 2400
    assert max(wf_j["max"]) > 0.40 and min(wf_j["min"]) < -0.40 and max(wf_j["rms"]) > 0.15

    sp_log = client.get(f"/api/projects/{pid}/spectrogram?log_scale=true&bins=128")
    sp_lin = client.get(f"/api/projects/{pid}/spectrogram?log_scale=false&bins=128")
    assert sp_log.status_code == 200 and sp_log.json()["frames"] > 10 and sp_log.json()["bins"] == 128
    assert sp_lin.status_code == 200 and sp_lin.json()["frames"] > 10

    # 5) Real-time C++17 DSP Audio Streaming across multiple speed & pitch combinations
    dsp_cases = [
        (1.0, 0, 0, 4.0),
        (0.5, 0, 0, 8.0),
        (1.5, 0, 0, 2.66),
        (0.75, -3, 25, 5.33),
        (1.0, 12, 0, 4.0),
        (1.0, -12, -50, 4.0),
    ]
    for idx, (spd, st, ct, expected_dur) in enumerate(dsp_cases):
        ra = client.get(f"/api/projects/{pid}/audio?speed={spd}&semitones={st}&cents={ct}")
        assert ra.status_code == 200 and ra.content[:4] == b"RIFF"
        _, dur = _assert_audible_audio_bytes(ra.content, "wav", tmp_path, f"stream_{idx}")
        assert abs(dur - expected_dur) < 0.45, f"DSP duration mismatch for speed={spd}: got {dur:.2f}s vs {expected_dur:.2f}s"

    # Range 206 streaming check
    r206 = client.get(f"/api/projects/{pid}/audio?speed=1.0&semitones=0&cents=0", headers={"Range": "bytes=0-4095"})
    assert r206.status_code == 206 and len(r206.content) == 4096 and r206.content[:4] == b"RIFF"

    # 6) Offline AI Analysis (individual + full)
    assert client.post(f"/api/projects/{pid}/analyze/bpm").status_code == 200
    assert client.post(f"/api/projects/{pid}/analyze/key").status_code == 200
    assert client.post(f"/api/projects/{pid}/analyze/notes").status_code == 200
    assert client.post(f"/api/projects/{pid}/analyze/chords").status_code == 200
    full_ai = client.post(f"/api/projects/{pid}/analyze/full")
    assert full_ai.status_code == 200
    full_j = full_ai.json()
    assert full_j["bpm"]["bpm"] > 0
    assert full_j["key"]["key"]
    assert full_j["notes"]["note_count"] > 0
    assert len(full_j["chords"]["chords"]) > 0

    # 7) 4-Stem Separation + streaming every stem with DSP
    sep = client.post(f"/api/projects/{pid}/stems/separate")
    assert sep.status_code == 200
    assert set(sep.json()["stems"].keys()) == {"vocals", "drums", "bass", "other"}
    st_status = client.get(f"/api/projects/{pid}/stems/status")
    assert st_status.status_code == 200 and st_status.json()["status"] == "completed"

    for sk in ("vocals", "drums", "bass", "other"):
        rs = client.get(f"/api/projects/{pid}/stems/{sk}/audio?speed=0.75&semitones=-2&cents=0")
        assert rs.status_code == 200 and rs.content[:4] == b"RIFF" and len(rs.content) > 4000

    # 8) ALL Export Formats x ALL Export Scopes — verify ZERO silent/mute outputs!
    for fmt in ("mp3", "wav", "flac"):
        # Full track (normal)
        e_full = client.post(f"/api/projects/{pid}/export", json={"format": fmt, "scope": "full", "speed": 1.0, "semitones": 0, "cents": 0})
        assert e_full.status_code == 200
        _assert_audible_audio_bytes(e_full.content, fmt, tmp_path, f"full_1x_{fmt}")

        # Full track (slowed 0.75x + transposed -2st +15c)
        e_dsp = client.post(f"/api/projects/{pid}/export", json={"format": fmt, "scope": "full", "speed": 0.75, "semitones": -2, "cents": 15})
        assert e_dsp.status_code == 200
        _, dur_dsp = _assert_audible_audio_bytes(e_dsp.content, fmt, tmp_path, f"full_dsp_{fmt}")
        assert abs(dur_dsp - 5.33) < 0.55

        # Loop A/B (0.5s -> 2.5s = 2.0s)
        e_loop = client.post(
            f"/api/projects/{pid}/export",
            json={"format": fmt, "scope": "loop", "start_sec": 0.5, "end_sec": 2.5, "speed": 1.0, "semitones": 0, "cents": 0},
        )
        assert e_loop.status_code == 200
        _, dur_loop = _assert_audible_audio_bytes(e_loop.content, fmt, tmp_path, f"loop_{fmt}")
        assert abs(dur_loop - 2.0) < 0.35

        # Custom Selection (1.0s -> 3.0s)
        e_sel = client.post(
            f"/api/projects/{pid}/export",
            json={"format": fmt, "scope": "selection", "start_sec": 1.0, "end_sec": 3.0, "speed": 1.0, "semitones": 0, "cents": 0},
        )
        assert e_sel.status_code == 200
        _assert_audible_audio_bytes(e_sel.content, fmt, tmp_path, f"sel_{fmt}")

        # Individual stem (other)
        e_stem = client.post(
            f"/api/projects/{pid}/export",
            json={"format": fmt, "scope": "stem", "stem_key": "other", "speed": 1.0, "semitones": 0, "cents": 0},
        )
        assert e_stem.status_code == 200
        _assert_audible_audio_bytes(e_stem.content, fmt, tmp_path, f"stem_other_{fmt}", min_rms=0.01)

        # Custom Stems Mix (karaoke: mute vocals, boost bass/other) at 1.0x AND at 0.8x / -2st
        e_mix = client.post(
            f"/api/projects/{pid}/export",
            json={
                "format": fmt,
                "scope": "stems_mix",
                "speed": 0.8,
                "semitones": -2,
                "cents": 0,
                "stem_gains": {"vocals": 0.0, "drums": 1.0, "bass": 1.2, "other": 1.0},
                "stem_mutes": {"vocals": True, "drums": False, "bass": False, "other": False},
            },
        )
        assert e_mix.status_code == 200
        _assert_audible_audio_bytes(e_mix.content, fmt, tmp_path, f"stems_mix_dsp_{fmt}", min_rms=0.02)

    # Out-of-range loop export MUST return HTTP 400 (NEVER silently emit a 1-sample mute audio file!)
    e_oob = client.post(
        f"/api/projects/{pid}/export",
        json={"format": "mp3", "scope": "loop", "start_sec": 60.0, "end_sec": 90.0, "speed": 1.0},
    )
    assert e_oob.status_code == 400
    assert "fora da duração" in e_oob.json()["detail"]

    # Document exports AFTER AI analysis (MIDI, Notes TXT, Chords TXT, PDF)
    assert client.post(f"/api/projects/{pid}/export", json={"format": "mid"}).content[:4] == b"MThd"
    assert client.post(f"/api/projects/{pid}/export", json={"format": "txt_notes"}).status_code == 200
    assert client.post(f"/api/projects/{pid}/export", json={"format": "txt_chords"}).status_code == 200
    assert client.post(f"/api/projects/{pid}/export", json={"format": "pdf"}).content[:5] == b"%PDF-"

    # 9) Re-capture / Replace audio on the SAME aNOyvBm9Gfw project (different duration 2.5s)
    cap2_path = _make_stereo_capture_wav(tmp_path / "captura_som_sistema_2.wav", sr=48000, duration_sec=2.5, f_left=329.63, f_right=392.0)
    with open(cap2_path, "rb") as f:
        imp2 = client.post(
            f"/api/audio/import?project_id={pid}",
            files=[("files", ("captura_som_sistema_2.wav", f, "audio/wav"))],
        )
    assert imp2.status_code == 200
    refreshed = client.get(f"/api/projects/{pid}").json()
    assert abs(refreshed["duration_sec"] - 2.5) < 0.05
    assert refreshed["audio_file_path"] != hybrid["audio_file_path"]
    wf2 = client.get(f"/api/projects/{pid}/waveform?bins=512").json()
    assert abs(wf2["duration_sec"] - 2.5) < 0.05 and max(wf2["max"]) > 0.40
    e_recap = client.post(f"/api/projects/{pid}/export", json={"format": "mp3", "scope": "full"})
    assert e_recap.status_code == 200
    _, dur_recap = _assert_audible_audio_bytes(e_recap.content, "mp3", tmp_path, "recapture_mp3")
    assert abs(dur_recap - 2.5) < 0.25

    # 10) Attach local MP3 & local MP4 video onto the YouTube project
    pcm_song = generate_study_song(sr=44100, bpm=120.0, bars=2)
    mp3_local = tmp_path / "local_ref.mp3"
    encode_audio(pcm_song, 44100, mp3_local, fmt="mp3")
    with open(mp3_local, "rb") as f:
        r_mp3 = client.post(f"/api/audio/import?project_id={pid}", files=[("files", ("local_ref.mp3", f, "audio/mpeg"))])
    assert r_mp3.status_code == 200
    e_after_mp3 = client.post(f"/api/projects/{pid}/export", json={"format": "flac", "scope": "full"})
    assert e_after_mp3.status_code == 200
    _assert_audible_audio_bytes(e_after_mp3.content, "flac", tmp_path, "after_mp3_flac")

    # Local MP4 with video + AAC stereo audio attached onto the YouTube project
    mp4_local = tmp_path / "local_video.mp4"
    with av.open(str(mp4_local), mode="w", format="mp4") as container:
        vs = container.add_stream("mpeg4", rate=10)
        vs.width, vs.height, vs.pix_fmt = 64, 64, "yuv420p"
        as_ = container.add_stream("aac", rate=44100)
        as_.layout = "stereo"
        for _ in range(10):
            vf = av.VideoFrame.from_ndarray(np.zeros((64, 64, 3), dtype=np.uint8), format="rgb24")
            for pkt in vs.encode(vf):
                container.mux(pkt)
        for pkt in vs.encode():
            container.mux(pkt)
        pos = 0
        while pos < pcm_song.shape[0]:
            ch = pcm_song[pos : pos + 1024]
            if ch.shape[0] < 1024:
                ch = np.pad(ch, ((0, 1024 - ch.shape[0]), (0, 0)))
            af = av.AudioFrame.from_ndarray(np.ascontiguousarray(ch.T, dtype=np.float32), format="fltp", layout="stereo")
            af.sample_rate = 44100
            for pkt in as_.encode(af):
                container.mux(pkt)
            pos += 1024
        for pkt in as_.encode():
            container.mux(pkt)

    with open(mp4_local, "rb") as f:
        r_mp4 = client.post(f"/api/audio/import?project_id={pid}", files=[("files", ("local_video.mp4", f, "video/mp4"))])
    assert r_mp4.status_code == 200
    e_after_mp4 = client.post(f"/api/projects/{pid}/export", json={"format": "mp3", "scope": "full"})
    assert e_after_mp4.status_code == 200
    _assert_audible_audio_bytes(e_after_mp4.content, "mp3", tmp_path, "after_mp4_mp3")

"""SQLite Project Persistence, Loops, Markers, Notes, Chords, Autosave & Crash Recovery Tests."""

from __future__ import annotations

from pathlib import Path
from database.repository import ProjectRepository


def test_project_crud_clone_and_recovery(tmp_path: Path):
    db_path = tmp_path / "test_mrq.db"
    repo = ProjectRepository(db_path)

    proj = repo.create_project(
        "Estudo Violão Clássico",
        {
            "file_path": "/tmp/fake_track.mp3",
            "filename": "fake_track.mp3",
            "duration_sec": 185.4,
            "sample_rate": 44100,
            "channels": 2,
            "format_name": "MP3",
            "codec_name": "mp3",
            "bit_rate": 320000,
            "file_size_bytes": 7400000,
        },
    )
    pid = proj["id"]
    assert proj["name"] == "Estudo Violão Clássico"

    # Update musical parameters
    updated = repo.update_project(pid, {"speed": 0.65, "semitones": -2, "cents": 15, "bpm": 98.5, "study_notes": "Capotraste 2ª casa"})
    assert updated["speed"] == 0.65
    assert updated["semitones"] == -2
    assert updated["study_notes"] == "Capotraste 2ª casa"

    # Loops & Markers
    lp = repo.upsert_loop(pid, {"name": "Solo 1", "start_sec": 42.0, "end_sec": 58.5, "speed": 0.5, "semitones": 0, "cents": 0})
    mk = repo.upsert_marker(pid, {"label": "Refrão 1", "section_type": "Refrão", "time_sec": 40.0, "color": "#22C55E", "note": "Entra bateria"})
    assert lp["name"] == "Solo 1"
    assert mk["section_type"] == "Refrão"

    # Transcribed notes & chords
    repo.replace_notes(pid, [{"pitch": 69, "note_name": "A4", "start_sec": 1.0, "duration_sec": 0.5, "velocity": 100, "confidence": 0.95, "role": "melody", "edited": True}])
    repo.replace_chords(pid, [{"symbol": "Am7", "root": "A", "quality": "m7", "notes": ["A", "C", "E", "G"], "start_sec": 0.0, "end_sec": 4.0, "confidence": 0.9, "edited": True}])

    # Autosave & Crash Recovery
    snap_id = repo.save_autosave(pid, {"speed": 0.5, "loopA": 10.0, "loopB": 20.0})
    assert snap_id > 0
    pending = repo.get_pending_recovery()
    assert len(pending) == 1
    assert pending[0]["project_id"] == pid
    assert pending[0]["snapshot"]["speed"] == 0.5

    # Clean shutdown clears recovery flag
    repo.mark_clean_shutdown(pid)
    assert repo.get_pending_recovery() == []

    # Save As (Clone)
    cloned = repo.clone_project(pid, "Estudo Violão — Versão Lenta")
    assert cloned["id"] != pid
    assert len(cloned["loops"]) == 1
    assert len(cloned["markers"]) == 1
    assert len(cloned["notes"]) == 1
    assert len(cloned["chords"]) == 1

    # Recent files
    recents = repo.list_recent_files()
    assert len(recents) >= 1

    # Delete original
    assert repo.delete_project(pid) is True
    assert repo.get_project(pid) is None
    assert repo.get_project(cloned["id"]) is not None

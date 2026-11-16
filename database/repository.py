"""
SQLite Repository for MRQ Estudo Musical.
Provides full project lifecycle, loops, markers, transcribed notes, chords,
analysis caching, recent files, autosave snapshots and crash recovery.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class ProjectRepository:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._init_schema()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        with self._lock:
            conn = sqlite3.connect(str(self.db_path), timeout=30.0)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA foreign_keys = ON;")
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

    def _init_schema(self) -> None:
        schema_file = Path(__file__).resolve().parent / "schema.sql"
        sql = schema_file.read_text(encoding="utf-8")
        with self._connect() as conn:
            conn.executescript(sql)

    # ---------------- PROJECTS ----------------

    def create_project(self, name: str, audio_meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        pid = str(uuid.uuid4())[:12]
        now = _utc_now()
        meta = audio_meta or {}
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO projects (
                    id, name, audio_file_path, original_filename, duration_sec,
                    sample_rate, channels, format_name, codec_name, bit_rate,
                    file_size_bytes, created_at, updated_at, last_opened_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pid,
                    name.strip() or "Novo Estudo",
                    meta.get("file_path"),
                    meta.get("filename"),
                    float(meta.get("duration_sec", 0.0)),
                    int(meta.get("sample_rate", 44100)),
                    int(meta.get("channels", 2)),
                    str(meta.get("format_name", "")),
                    str(meta.get("codec_name", "")),
                    int(meta.get("bit_rate", 0)),
                    int(meta.get("file_size_bytes", 0)),
                    now,
                    now,
                    now,
                ),
            )
            if meta.get("file_path"):
                conn.execute(
                    """
                    INSERT OR REPLACE INTO recent_files (file_path, filename, project_id, last_used_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (meta["file_path"], meta.get("filename", Path(meta["file_path"]).name), pid, now),
                )
        return self.get_project(pid)

    def list_projects(self) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM projects ORDER BY last_opened_at DESC, updated_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            if not row:
                return None
            proj = dict(row)
            proj["loops"] = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM loops WHERE project_id = ? ORDER BY start_sec ASC", (project_id,)
                ).fetchall()
            ]
            proj["markers"] = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM markers WHERE project_id = ? ORDER BY time_sec ASC", (project_id,)
                ).fetchall()
            ]
            proj["notes"] = [
                {**dict(r), "edited": bool(r["edited"])}
                for r in conn.execute(
                    "SELECT * FROM transcribed_notes WHERE project_id = ? ORDER BY start_sec ASC, pitch DESC",
                    (project_id,),
                ).fetchall()
            ]
            chords = []
            for r in conn.execute(
                "SELECT * FROM detected_chords WHERE project_id = ? ORDER BY start_sec ASC", (project_id,)
            ).fetchall():
                d = dict(r)
                d["notes"] = json.loads(d.pop("notes_json", "[]") or "[]")
                d["edited"] = bool(d["edited"])
                chords.append(d)
            proj["chords"] = chords

            analysis: Dict[str, Any] = {}
            for r in conn.execute(
                "SELECT kind, payload_json FROM analysis_cache WHERE project_id = ?", (project_id,)
            ).fetchall():
                analysis[r["kind"]] = json.loads(r["payload_json"])
            proj["analysis"] = analysis
            return proj

    def update_project(self, project_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        allowed = {
            "name",
            "audio_file_path",
            "original_filename",
            "duration_sec",
            "sample_rate",
            "channels",
            "format_name",
            "codec_name",
            "bit_rate",
            "file_size_bytes",
            "speed",
            "semitones",
            "octaves",
            "cents",
            "precount_sec",
            "bpm",
            "bpm_confidence",
            "musical_key",
            "scale_name",
            "key_confidence",
            "time_signature",
            "study_notes",
            "last_opened_at",
        }
        clean = {k: v for k, v in fields.items() if k in allowed}
        if not clean:
            return self.get_project(project_id)
        clean["updated_at"] = _utc_now()
        set_clause = ", ".join(f"{k} = ?" for k in clean)
        values = list(clean.values()) + [project_id]

        with self._connect() as conn:
            conn.execute(f"UPDATE projects SET {set_clause} WHERE id = ?", values)
            if clean.get("audio_file_path"):
                conn.execute(
                    """
                    INSERT OR REPLACE INTO recent_files (file_path, filename, project_id, last_used_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        clean["audio_file_path"],
                        clean.get("original_filename") or Path(clean["audio_file_path"]).name,
                        project_id,
                        clean["updated_at"],
                    ),
                )
        return self.get_project(project_id)

    def clone_project(self, project_id: str, new_name: str) -> Optional[Dict[str, Any]]:
        """Implements 'Save As' by deep-cloning a project and all loops, markers, notes, chords and analyses."""
        orig = self.get_project(project_id)
        if not orig:
            return None
        cloned = self.create_project(
            new_name,
            {
                "file_path": orig["audio_file_path"],
                "filename": orig["original_filename"],
                "duration_sec": orig["duration_sec"],
                "sample_rate": orig["sample_rate"],
                "channels": orig["channels"],
                "format_name": orig["format_name"],
                "codec_name": orig["codec_name"],
                "bit_rate": orig["bit_rate"],
                "file_size_bytes": orig["file_size_bytes"],
            },
        )
        new_id = cloned["id"]
        self.update_project(
            new_id,
            {
                "speed": orig["speed"],
                "semitones": orig["semitones"],
                "octaves": orig["octaves"],
                "cents": orig["cents"],
                "precount_sec": orig["precount_sec"],
                "bpm": orig["bpm"],
                "bpm_confidence": orig["bpm_confidence"],
                "musical_key": orig["musical_key"],
                "scale_name": orig["scale_name"],
                "key_confidence": orig["key_confidence"],
                "time_signature": orig["time_signature"],
                "study_notes": orig["study_notes"],
            },
        )
        for lp in orig["loops"]:
            self.upsert_loop(new_id, {**lp, "id": None})
        for mk in orig["markers"]:
            self.upsert_marker(new_id, {**mk, "id": None})
        if orig["notes"]:
            self.replace_notes(new_id, [{**n, "id": None} for n in orig["notes"]])
        if orig["chords"]:
            self.replace_chords(new_id, [{**c, "id": None} for c in orig["chords"]])
        for kind, payload in orig["analysis"].items():
            self.save_analysis_cache(new_id, kind, payload)
        return self.get_project(new_id)

    def delete_project(self, project_id: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            return cur.rowcount > 0

    def list_recent_files(self, limit: int = 15) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM recent_files ORDER BY last_used_at DESC LIMIT ?", (int(limit),)
            ).fetchall()
            return [dict(r) for r in rows]

    # ---------------- LOOPS ----------------

    def upsert_loop(self, project_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        lid = data.get("id") or str(uuid.uuid4())[:10]
        now = _utc_now()
        start_sec = float(data["start_sec"])
        end_sec = float(data["end_sec"])
        if end_sec < start_sec:
            start_sec, end_sec = end_sec, start_sec

        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO loops
                    (id, project_id, name, start_sec, end_sec, speed, semitones, cents, color, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    lid,
                    project_id,
                    str(data.get("name") or "Loop"),
                    start_sec,
                    end_sec,
                    float(data.get("speed", 1.0)),
                    int(data.get("semitones", 0)),
                    int(data.get("cents", 0)),
                    str(data.get("color") or "#38BDF8"),
                    data.get("created_at") or now,
                ),
            )
            conn.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))
            row = conn.execute("SELECT * FROM loops WHERE id = ?", (lid,)).fetchone()
            return dict(row)

    def delete_loop(self, project_id: str, loop_id: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM loops WHERE id = ? AND project_id = ?", (loop_id, project_id))
            return cur.rowcount > 0

    # ---------------- MARKERS ----------------

    def upsert_marker(self, project_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        mid = data.get("id") or str(uuid.uuid4())[:10]
        now = _utc_now()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO markers
                    (id, project_id, label, section_type, time_sec, end_sec, color, note, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    mid,
                    project_id,
                    str(data.get("label") or "Marcador"),
                    str(data.get("section_type") or "Personalizado"),
                    float(data["time_sec"]),
                    float(data["end_sec"]) if data.get("end_sec") is not None else None,
                    str(data.get("color") or "#A855F7"),
                    str(data.get("note") or ""),
                    data.get("created_at") or now,
                ),
            )
            conn.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))
            row = conn.execute("SELECT * FROM markers WHERE id = ?", (mid,)).fetchone()
            return dict(row)

    def delete_marker(self, project_id: str, marker_id: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM markers WHERE id = ? AND project_id = ?", (marker_id, project_id))
            return cur.rowcount > 0

    # ---------------- NOTES & CHORDS ----------------

    def replace_notes(self, project_id: str, notes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        now = _utc_now()
        with self._connect() as conn:
            conn.execute("DELETE FROM transcribed_notes WHERE project_id = ?", (project_id,))
            rows = []
            for n in notes:
                nid = str(n.get("id") or uuid.uuid4().hex[:8])
                rows.append(
                    (
                        nid,
                        project_id,
                        int(n["pitch"]),
                        str(n.get("note_name") or ""),
                        float(n["start_sec"]),
                        max(0.02, float(n["duration_sec"])),
                        int(n.get("velocity", 90)),
                        float(n.get("confidence", 0.8)),
                        str(n.get("role", "harmony")),
                        int(n.get("channel", 0)),
                        1 if n.get("edited") else 0,
                    )
                )
            conn.executemany(
                """
                INSERT INTO transcribed_notes
                    (id, project_id, pitch, note_name, start_sec, duration_sec, velocity, confidence, role, channel, edited)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
            conn.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))
        return self.get_project(project_id)["notes"]

    def replace_chords(self, project_id: str, chords: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        now = _utc_now()
        with self._connect() as conn:
            conn.execute("DELETE FROM detected_chords WHERE project_id = ?", (project_id,))
            rows = []
            for c in chords:
                cid = str(c.get("id") or uuid.uuid4().hex[:8])
                rows.append(
                    (
                        cid,
                        project_id,
                        str(c["symbol"]),
                        str(c.get("root", "")),
                        str(c.get("quality", "")),
                        json.dumps(c.get("notes", []), ensure_ascii=False),
                        float(c["start_sec"]),
                        float(c["end_sec"]),
                        float(c.get("confidence", 0.7)),
                        1 if c.get("edited") else 0,
                    )
                )
            conn.executemany(
                """
                INSERT INTO detected_chords
                    (id, project_id, symbol, root, quality, notes_json, start_sec, end_sec, confidence, edited)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
            conn.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))
        return self.get_project(project_id)["chords"]

    # ---------------- ANALYSIS CACHE ----------------

    def save_analysis_cache(self, project_id: str, kind: str, payload: Dict[str, Any]) -> None:
        now = _utc_now()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO analysis_cache (project_id, kind, payload_json, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (project_id, kind, json.dumps(payload, ensure_ascii=False), now),
            )
            conn.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))

    # ---------------- AUTOSAVE & CRASH RECOVERY ----------------

    def save_autosave(self, project_id: str, state: Dict[str, Any]) -> int:
        now = _utc_now()
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO autosave_snapshots (project_id, snapshot_json, is_dirty, saved_at)
                VALUES (?, ?, 1, ?)
                """,
                (project_id, json.dumps(state, ensure_ascii=False), now),
            )
            # Keep only the 5 most recent snapshots per project
            conn.execute(
                """
                DELETE FROM autosave_snapshots
                WHERE project_id = ? AND id NOT IN (
                    SELECT id FROM autosave_snapshots WHERE project_id = ? ORDER BY id DESC LIMIT 5
                )
                """,
                (project_id, project_id),
            )
            return int(cur.lastrowid)

    def mark_clean_shutdown(self, project_id: str) -> None:
        with self._connect() as conn:
            conn.execute("UPDATE autosave_snapshots SET is_dirty = 0 WHERE project_id = ?", (project_id,))

    def get_pending_recovery(self) -> List[Dict[str, Any]]:
        """Returns latest dirty autosave snapshot per project for crash recovery."""
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT a.id, a.project_id, p.name AS project_name, a.snapshot_json, a.saved_at
                FROM autosave_snapshots a
                JOIN projects p ON p.id = a.project_id
                WHERE a.is_dirty = 1
                  AND a.id IN (
                      SELECT MAX(id) FROM autosave_snapshots WHERE is_dirty = 1 GROUP BY project_id
                  )
                ORDER BY a.saved_at DESC
                """
            ).fetchall()
            out = []
            for r in rows:
                d = dict(r)
                d["snapshot"] = json.loads(d.pop("snapshot_json"))
                out.append(d)
            return out

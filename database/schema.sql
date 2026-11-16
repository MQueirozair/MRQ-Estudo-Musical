-- MRQ Estudo Musical — SQLite Schema (WAL Mode)
-- Audio files are managed on disk and referenced by path (never stored as BLOBs).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    audio_file_path TEXT,
    original_filename TEXT,
    duration_sec REAL DEFAULT 0.0,
    sample_rate INTEGER DEFAULT 44100,
    channels INTEGER DEFAULT 2,
    format_name TEXT DEFAULT '',
    codec_name TEXT DEFAULT '',
    bit_rate INTEGER DEFAULT 0,
    file_size_bytes INTEGER DEFAULT 0,
    speed REAL DEFAULT 1.0,
    semitones INTEGER DEFAULT 0,
    octaves INTEGER DEFAULT 0,
    cents INTEGER DEFAULT 0,
    precount_sec REAL DEFAULT 0.0,
    bpm REAL,
    bpm_confidence REAL,
    musical_key TEXT,
    scale_name TEXT,
    key_confidence REAL,
    time_signature TEXT DEFAULT '4/4',
    study_notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_opened_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loops (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    start_sec REAL NOT NULL,
    end_sec REAL NOT NULL,
    speed REAL DEFAULT 1.0,
    semitones INTEGER DEFAULT 0,
    cents INTEGER DEFAULT 0,
    color TEXT DEFAULT '#38BDF8',
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS markers (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    label TEXT NOT NULL,
    section_type TEXT DEFAULT 'Personalizado',
    time_sec REAL NOT NULL,
    end_sec REAL,
    color TEXT DEFAULT '#A855F7',
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transcribed_notes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    pitch INTEGER NOT NULL,
    note_name TEXT NOT NULL,
    start_sec REAL NOT NULL,
    duration_sec REAL NOT NULL,
    velocity INTEGER DEFAULT 90,
    confidence REAL DEFAULT 0.8,
    role TEXT DEFAULT 'harmony',
    channel INTEGER DEFAULT 0,
    edited INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS detected_chords (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    root TEXT DEFAULT '',
    quality TEXT DEFAULT '',
    notes_json TEXT DEFAULT '[]',
    start_sec REAL NOT NULL,
    end_sec REAL NOT NULL,
    confidence REAL DEFAULT 0.7,
    edited INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis_cache (
    project_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (project_id, kind),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS autosave_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    is_dirty INTEGER DEFAULT 1,
    saved_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recent_files (
    file_path TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    project_id TEXT,
    last_used_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_loops_project ON loops(project_id);
CREATE INDEX IF NOT EXISTS idx_markers_project ON markers(project_id, time_sec);
CREATE INDEX IF NOT EXISTS idx_notes_project ON transcribed_notes(project_id, start_sec);
CREATE INDEX IF NOT EXISTS idx_chords_project ON detected_chords(project_id, start_sec);
CREATE INDEX IF NOT EXISTS idx_autosave_dirty ON autosave_snapshots(project_id, is_dirty, saved_at);

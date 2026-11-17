"""Pydantic request/response schemas for the MRQ Estudo Musical local API."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ProjectCreateRequest(BaseModel):
    name: str = Field(default="Novo Estudo", min_length=1, max_length=120)


class YouTubeProjectCreateRequest(BaseModel):
    url: str = Field(min_length=5, max_length=1000)
    name: Optional[str] = Field(default=None, max_length=140)


class VideoUrlProjectCreateRequest(BaseModel):
    url: str = Field(min_length=5, max_length=1000)
    name: Optional[str] = Field(default=None, max_length=140)


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    duration_sec: Optional[float] = Field(default=None, ge=0.0)
    manual_beats: Optional[List[float]] = None
    speed: Optional[float] = Field(default=None, ge=0.25, le=2.0)
    semitones: Optional[int] = Field(default=None, ge=-24, le=24)
    octaves: Optional[int] = Field(default=None, ge=-2, le=2)
    cents: Optional[int] = Field(default=None, ge=-100, le=100)
    precount_sec: Optional[float] = Field(default=None, ge=0.0, le=5.0)
    bpm: Optional[float] = Field(default=None, ge=20.0, le=350.0)
    musical_key: Optional[str] = None
    scale_name: Optional[str] = None
    time_signature: Optional[str] = None
    study_notes: Optional[str] = None


class ProjectCloneRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class LoopUpsertRequest(BaseModel):
    id: Optional[str] = None
    name: str = Field(default="Loop A/B", min_length=1, max_length=80)
    start_sec: float = Field(ge=0.0)
    end_sec: float = Field(ge=0.0)
    speed: float = Field(default=1.0, ge=0.25, le=2.0)
    semitones: int = Field(default=0, ge=-24, le=24)
    cents: int = Field(default=0, ge=-100, le=100)
    color: str = "#38BDF8"


class MarkerUpsertRequest(BaseModel):
    id: Optional[str] = None
    label: str = Field(default="Marcador", min_length=1, max_length=80)
    section_type: str = "Personalizado"
    time_sec: float = Field(ge=0.0)
    end_sec: Optional[float] = None
    color: str = "#A855F7"
    note: str = ""


class NoteItem(BaseModel):
    id: Optional[str] = None
    pitch: int = Field(ge=0, le=127)
    note_name: str = ""
    start_sec: float = Field(ge=0.0)
    duration_sec: float = Field(gt=0.0)
    velocity: int = Field(default=90, ge=1, le=127)
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    role: str = "harmony"
    channel: int = Field(default=0, ge=0, le=15)
    edited: bool = False


class NotesReplaceRequest(BaseModel):
    notes: List[NoteItem]


class ChordItem(BaseModel):
    id: Optional[str] = None
    symbol: str
    root: str = ""
    quality: str = ""
    notes: List[str] = Field(default_factory=list)
    start_sec: float = Field(ge=0.0)
    end_sec: float = Field(ge=0.0)
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    edited: bool = False


class ChordsReplaceRequest(BaseModel):
    chords: List[ChordItem]


class TapTempoRequest(BaseModel):
    timestamps_sec: List[float]


class AutosaveRequest(BaseModel):
    state: Dict[str, Any]


class ExportRequest(BaseModel):
    format: str  # mp3 | wav | flac | mid | txt_notes | txt_chords | pdf
    scope: str = "full"  # full | selection | loop | stem | stems_mix
    start_sec: Optional[float] = None
    end_sec: Optional[float] = None
    speed: float = 1.0
    semitones: float = 0.0
    cents: float = 0.0
    stem_key: Optional[str] = None
    stem_gains: Optional[Dict[str, float]] = None
    stem_mutes: Optional[Dict[str, bool]] = None

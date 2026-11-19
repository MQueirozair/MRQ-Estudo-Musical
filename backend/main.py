"""
MRQ Estudo Musical — Local Audio & AI Service (FastAPI).
Decoupled from UI: serves desktop Electron shell, Android Capacitor shell,
and browser/live preview via clean relative `/api/*` endpoints.
"""

from __future__ import annotations

import ipaddress
import json
import logging
import mimetypes
import multiprocessing
import os
import re
import shutil
import socket
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from packaging.version import InvalidVersion, Version

from ai.bpm_detection import analyze_bpm_and_beats, compute_tap_tempo
from ai.chord_detection import analyze_chords
from ai.key_detection import analyze_key_and_scale
from ai.model_manager import ModelManager
from ai.note_detection import analyze_notes_and_melody, midi_to_note_name
from ai.source_separation import separate_audio_stems
from backend.schemas import (
    AutosaveRequest,
    ChordsReplaceRequest,
    ExportRequest,
    LoopUpsertRequest,
    MarkerUpsertRequest,
    NotesReplaceRequest,
    ProjectCloneRequest,
    ProjectCreateRequest,
    ProjectUpdateRequest,
    TapTempoRequest,
    VideoUrlProjectCreateRequest,
    YouTubeProjectCreateRequest,
)
from core.audio_engine.audio_manager import AudioManager
from core.audio_engine.bridge import get_dsp_engine
from core.audio_engine.decoder import (
    SUPPORTED_IMPORT_EXTENSIONS,
    SUPPORTED_VIDEO_EXTENSIONS,
    encode_audio,
)
from core.audio_engine.exporter import ProjectExporter
from core.audio_engine.musicxml_export import export_musicxml
from database.repository import ProjectRepository
from plugins import registry as plugin_registry
from scripts.generate_demo_audio import generate_study_song

REPO_ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))
RESOURCES_ROOT = Path(os.environ.get("MRQ_RESOURCES_DIR") or REPO_ROOT)
APP_CONFIG_PATH = (
    REPO_ROOT / "app.config.json"
    if (REPO_ROOT / "app.config.json").exists()
    else RESOURCES_ROOT / "app.config.json"
)


def _resolve_studio_dist() -> Path:
    candidates = [
        REPO_ROOT / "apps" / "studio" / "dist",
        RESOURCES_ROOT / "studio-dist",
        RESOURCES_ROOT / "apps" / "studio" / "dist",
    ]
    for p in candidates:
        if p.exists() and (p / "index.html").exists():
            return p
    return candidates[0]


def _resolve_models_dir() -> Path:
    candidates = [
        REPO_ROOT / "models",
        RESOURCES_ROOT / "models",
    ]
    for p in candidates:
        if (p / "manifest.json").exists():
            return p
    return candidates[0]


def create_app(data_dir: Optional[str | Path] = None) -> FastAPI:
    storage_root = Path(data_dir or os.environ.get("MRQ_DATA_DIR") or (REPO_ROOT / "data"))
    storage_root.mkdir(parents=True, exist_ok=True)

    dsp = get_dsp_engine()
    audio_mgr = AudioManager(storage_root, dsp=dsp)
    repo = ProjectRepository(storage_root / "mrq_projects.db")
    exporter = ProjectExporter(audio_mgr, dsp=dsp)
    model_mgr = ModelManager(_resolve_models_dir(), weights_dir=storage_root / "model_weights")

    # Background task progress tracker (for stem separation & full analysis)
    jobs: Dict[str, Dict[str, Any]] = {}
    jobs_lock = threading.RLock()

    def _set_job(key: str, status: str, progress: float, message: str, error: Optional[str] = None) -> None:
        with jobs_lock:
            jobs[key] = {
                "status": status,
                "progress": round(progress, 1),
                "message": message,
                "error": error,
                "updated_at": time.time(),
            }

    def _ensure_demo_project() -> None:
        """Creates a built-in copyright-free musical study project on first run if DB is empty."""
        if repo.list_projects():
            return
        demo_wav = storage_root / "audio_imports" / "mrq_estudo_demo_120bpm_Am.wav"
        if not demo_wav.exists():
            pcm = generate_study_song(sr=44100, bpm=120.0, bars=8)
            encode_audio(pcm, 44100, demo_wav, fmt="wav")
        meta = audio_mgr.import_file(demo_wav, original_filename="MRQ_Demo_Am_F_C_G_120BPM.wav")
        proj = repo.create_project("Estudo Demo — Progressão Am · F · C · G (120 BPM)", meta.to_dict())
        pid = proj["id"]
        # Add realistic section markers & a starter practice loop
        repo.upsert_marker(
            pid,
            {"label": "Introdução (Am–F–C–G)", "section_type": "Introdução", "time_sec": 0.0, "end_sec": 8.0, "color": "#38BDF8", "note": "Observe a linha de baixo em semínimas."},
        )
        repo.upsert_marker(
            pid,
            {"label": "Verso / Melodia Principal", "section_type": "Verso", "time_sec": 8.0, "end_sec": 16.0, "color": "#A855F7", "note": "Pratique a 75% com pré-contagem de 1s."},
        )
        repo.upsert_loop(
            pid,
            {"name": "Frase 1 — Am → F", "start_sec": 0.0, "end_sec": 4.0, "speed": 0.75, "semitones": 0, "cents": 0, "color": "#22C55E"},
        )
        repo.update_project(
            pid,
            {
                "bpm": 120.0,
                "bpm_confidence": 0.99,
                "musical_key": "A Menor",
                "scale_name": "A Menor Natural (Eólia)",
                "key_confidence": 0.88,
                "time_signature": "4/4",
                "study_notes": "Faixa de estudo inclusa no MRQ Estudo Musical. Experimente alterar velocidade (50%-75%), transpor semitons, ativar o Loop A/B, editar o Piano Roll ou separar os 4 stems!",
            },
        )

    _ensure_demo_project()

    app = FastAPI(title="MRQ Estudo Musical Engine API", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---------- SYSTEM & DIAGNOSTICS ----------

    @app.get("/api/health")
    def health() -> Dict[str, Any]:
        cfg = json.loads(APP_CONFIG_PATH.read_text(encoding="utf-8")) if APP_CONFIG_PATH.exists() else {}
        return {
            "status": "ok",
            "app": cfg.get("name", "MRQ Estudo Musical"),
            "version": cfg.get("version", "1.0.0"),
            "dsp": audio_mgr.diagnostics(),
            "ai_runtime": model_mgr.runtime_info(),
            "plugins": plugin_registry.list_plugins(),
        }

    @app.get("/api/updates/check")
    def check_updates() -> Dict[str, Any]:
        cfg = json.loads(APP_CONFIG_PATH.read_text(encoding="utf-8")) if APP_CONFIG_PATH.exists() else {}
        current = cfg.get("version", "1.0.0")
        url = cfg.get("updateCheckUrl", "")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "MRQ-Estudo-Musical/1.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                latest = str(data.get("tag_name", "")).removeprefix("v")
                try:
                    available = Version(latest) > Version(str(current))
                except InvalidVersion:
                    return {
                        "current_version": current, "latest_version": latest,
                        "update_available": False, "online": True,
                        "message": "Não foi possível comparar a versão publicada; consulte as releases manualmente.",
                    }
                return {
                    "current_version": current,
                    "latest_version": latest,
                    "update_available": available,
                    "release_url": data.get("html_url"),
                    "online": True,
                }
        except Exception:
            return {
                "current_version": current,
                "latest_version": current,
                "update_available": False,
                "online": False,
                "message": "Modo offline ou nenhuma release publicada no GitHub ainda.",
            }

    @app.post("/api/cache/clear")
    def clear_cache() -> Dict[str, Any]:
        removed = audio_mgr.clear_cache()
        return {"cleared_temp_files": removed}

    # ---------- PROJECTS & RECOVERY ----------

    @app.get("/api/projects")
    def list_projects() -> Dict[str, Any]:
        return {
            "projects": repo.list_projects(),
            "recent_files": repo.list_recent_files(),
            "pending_recovery": repo.get_pending_recovery(),
        }

    @app.post("/api/projects")
    def create_project(req: ProjectCreateRequest) -> Dict[str, Any]:
        return repo.create_project(req.name)

    def _extract_youtube_video_id(raw: str) -> Optional[str]:
        s = raw.strip()
        if re.fullmatch(r"[A-Za-z0-9_-]{11}", s):
            return s
        patterns = [
            r"(?:youtube\.com/watch\?.*v=)([A-Za-z0-9_-]{11})",
            r"(?:youtu\.be/)([A-Za-z0-9_-]{11})",
            r"(?:youtube\.com/embed/)([A-Za-z0-9_-]{11})",
            r"(?:youtube\.com/shorts/)([A-Za-z0-9_-]{11})",
            r"(?:youtube\.com/live/)([A-Za-z0-9_-]{11})",
        ]
        for pat in patterns:
            m = re.search(pat, s)
            if m:
                return m.group(1)
        return None

    def _create_youtube_project_internal(video_id: str, custom_name: Optional[str]) -> Dict[str, Any]:
        canonical_url = f"https://www.youtube.com/watch?v={video_id}"
        title = custom_name.strip() if custom_name and custom_name.strip() else f"YouTube {video_id}"
        channel = ""

        # Optional public oEmbed metadata fetch (no media download)
        try:
            oembed_url = (
                "https://www.youtube.com/oembed?url="
                + urllib.parse.quote(canonical_url, safe="")
                + "&format=json"
            )
            r = urllib.request.Request(oembed_url, headers={"User-Agent": "MRQ-Estudo-Musical/1.0"})
            with urllib.request.urlopen(r, timeout=3.5) as resp:
                meta_json = json.loads(resp.read().decode("utf-8"))
                if not custom_name and meta_json.get("title"):
                    title = str(meta_json["title"])[:130]
                if meta_json.get("author_name"):
                    channel = str(meta_json["author_name"])[:80]
        except Exception:
            pass

        return repo.create_project(
            title,
            {
                "source_type": "youtube",
                "youtube_video_id": video_id,
                "youtube_url": canonical_url,
                "youtube_channel": channel,
                "filename": f"YouTube {video_id}",
                "format_name": "YouTube",
                "codec_name": "YouTube IFrame API",
                "duration_sec": 0.0,
            },
        )

    def _validate_public_media_url(url: str) -> urllib.parse.ParseResult:
        parsed = urllib.parse.urlparse(url.strip())
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise HTTPException(status_code=400, detail="URL inválida. Use um link http:// ou https://.")
        host = parsed.hostname.lower()
        if host in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            raise HTTPException(status_code=400, detail="Endereços locais não são permitidos em links externos.")
        try:
            infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
            for info in infos:
                ip = ipaddress.ip_address(info[4][0])
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                    raise HTTPException(
                        status_code=400,
                        detail="Endereço de rede privada/interna bloqueado por segurança.",
                    )
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="Não foi possível resolver o endereço informado.")
        return parsed

    @app.post("/api/projects/youtube")
    def create_youtube_project(req: YouTubeProjectCreateRequest) -> Dict[str, Any]:
        """Creates a study project backed by the official embedded YouTube IFrame Player (no unauthorized downloading)."""
        video_id = _extract_youtube_video_id(req.url)
        if not video_id:
            raise HTTPException(
                status_code=400,
                detail="Link do YouTube inválido. Cole uma URL como https://www.youtube.com/watch?v=... ou https://youtu.be/...",
            )
        return _create_youtube_project_internal(video_id, req.name)

    @app.post("/api/projects/video-url")
    def create_video_url_project(req: VideoUrlProjectCreateRequest) -> Dict[str, Any]:
        """
        Smart video/media URL opener:
        - YouTube URL -> Official YouTube IFrame Player API project (no unauthorized YouTube download).
        - Direct video/audio file URL (.mp4, .webm, .mov, .mp3, .wav, .flac, .ogg, .m4a) -> imports locally via FFmpeg/PyAV
          for full C++17 DSP, Pitch Shift, AI Notes/Chords, Piano Roll & 4-Stem Separation.
        """
        raw = req.url.strip()
        yt_id = _extract_youtube_video_id(raw)
        if yt_id:
            return _create_youtube_project_internal(yt_id, req.name)

        parsed = _validate_public_media_url(raw)
        url_filename = Path(urllib.parse.unquote(parsed.path)).name or "video_link"
        ext = Path(url_filename).suffix.lower()

        max_bytes = 150 * 1024 * 1024  # 150 MB safety cap
        req_http = urllib.request.Request(raw, headers={"User-Agent": "MRQ-Estudo-Musical/1.0"})
        tmp_path: Optional[Path] = None
        try:
            with urllib.request.urlopen(req_http, timeout=20.0) as resp:
                ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
                if ext not in SUPPORTED_IMPORT_EXTENSIONS:
                    guessed = mimetypes.guess_extension(ctype) or ""
                    if guessed == ".mpga":
                        guessed = ".mp3"
                    if guessed in SUPPORTED_IMPORT_EXTENSIONS:
                        ext = guessed
                        url_filename = f"{Path(url_filename).stem or 'media'}{ext}"
                    elif ctype.startswith("video/mp4"):
                        ext = ".mp4"
                        url_filename = f"{Path(url_filename).stem or 'video'}.mp4"
                    elif ctype.startswith("video/webm"):
                        ext = ".webm"
                        url_filename = f"{Path(url_filename).stem or 'video'}.webm"
                    elif ctype.startswith("audio/mpeg"):
                        ext = ".mp3"
                        url_filename = f"{Path(url_filename).stem or 'audio'}.mp3"
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                "O link informado não aponta para um vídeo/áudio direto suportado "
                                "(MP4, WebM, MOV, MP3, WAV, FLAC, M4A, OGG) nem para um vídeo do YouTube."
                            ),
                        )

                with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                    total = 0
                    while True:
                        chunk = resp.read(256 * 1024)
                        if not chunk:
                            break
                        total += len(chunk)
                        if total > max_bytes:
                            raise HTTPException(
                                status_code=413,
                                detail="Arquivo de vídeo/áudio remoto excede o limite de 150 MB.",
                            )
                        tmp.write(chunk)
                    tmp_path = Path(tmp.name)

            meta = audio_mgr.import_file(tmp_path, original_filename=url_filename)
            is_video = ext in SUPPORTED_VIDEO_EXTENSIONS
            meta_dict = meta.to_dict()
            meta_dict["source_type"] = "video" if is_video else "audio"
            meta_dict["youtube_url"] = raw
            title = (req.name or "").strip() or Path(url_filename).stem or "Vídeo Online"
            return repo.create_project(title, meta_dict)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Não foi possível carregar o link direto de mídia: {exc}",
            )
        finally:
            if tmp_path and tmp_path.exists():
                try:
                    tmp_path.unlink()
                except OSError:
                    pass

    @app.get("/api/projects/{project_id}")
    def get_project(project_id: str) -> Dict[str, Any]:
        proj = repo.get_project(project_id)
        if not proj:
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        repo.update_project(project_id, {"last_opened_at": time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime())})
        return proj

    @app.patch("/api/projects/{project_id}")
    def update_project(project_id: str, req: ProjectUpdateRequest) -> Dict[str, Any]:
        existing = repo.get_project(project_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        payload = req.model_dump(exclude_none=True)
        return repo.update_project(project_id, payload)

    @app.post("/api/projects/{project_id}/clone")
    def clone_project(project_id: str, req: ProjectCloneRequest) -> Dict[str, Any]:
        cloned = repo.clone_project(project_id, req.name)
        if not cloned:
            raise HTTPException(status_code=404, detail="Projeto original não encontrado")
        return cloned

    @app.delete("/api/projects/{project_id}")
    def delete_project(project_id: str) -> Dict[str, Any]:
        ok = repo.delete_project(project_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        return {"deleted": True, "id": project_id}

    @app.post("/api/projects/{project_id}/autosave")
    def autosave_project(project_id: str, req: AutosaveRequest) -> Dict[str, Any]:
        if not repo.get_project(project_id):
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        snap_id = repo.save_autosave(project_id, req.state)
        return {"snapshot_id": snap_id, "saved": True}

    @app.post("/api/projects/{project_id}/clean-save")
    def mark_clean_save(project_id: str) -> Dict[str, Any]:
        repo.mark_clean_shutdown(project_id)
        return {"clean": True}

    # ---------- AUDIO IMPORT (SINGLE & MULTIPLE) ----------

    @app.post("/api/audio/import")
    async def import_audio_files(
        files: List[UploadFile] = File(...),
        project_id: Optional[str] = Query(default=None),
    ) -> Dict[str, Any]:
        """Imports one or multiple audio files (MP3, WAV, M4A, FLAC, AAC, OGG, AIFF)."""
        imported_projects = []
        for idx, uf in enumerate(files):
            filename = uf.filename or f"audio_{idx}.wav"
            ext = Path(filename).suffix.lower()
            if ext not in SUPPORTED_IMPORT_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Formato '{ext}' não suportado ({filename}). Use: {', '.join(sorted(SUPPORTED_IMPORT_EXTENSIONS))}",
                )

            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                while True:
                    chunk = await uf.read(1024 * 256)
                    if not chunk:
                        break
                    tmp.write(chunk)
                tmp_path = Path(tmp.name)

            try:
                meta = audio_mgr.import_file(tmp_path, original_filename=filename)
            finally:
                try:
                    tmp_path.unlink()
                except OSError:
                    pass

            if project_id and idx == 0 and repo.get_project(project_id):
                proj = repo.update_project(
                    project_id,
                    {
                        "audio_file_path": meta.file_path,
                        "original_filename": meta.filename,
                        "duration_sec": meta.duration_sec,
                        "sample_rate": meta.sample_rate,
                        "channels": meta.channels,
                        "format_name": meta.format_name,
                        "codec_name": meta.codec_name,
                        "bit_rate": meta.bit_rate,
                        "file_size_bytes": meta.file_size_bytes,
                    },
                )
            else:
                meta_dict = meta.to_dict()
                if ext in SUPPORTED_VIDEO_EXTENSIONS:
                    meta_dict["source_type"] = "video"
                proj = repo.create_project(Path(filename).stem, meta_dict)
            imported_projects.append(proj)

        return {"imported": imported_projects, "count": len(imported_projects)}

    # ---------- AUDIO STREAMING WITH TIME-STRETCH & PITCH-SHIFT ----------

    def _stream_file_with_range(file_path: Path, request: Request, media_type: str):
        file_size = file_path.stat().st_size
        range_header = request.headers.get("range")
        if range_header:
            try:
                byte_range = range_header.replace("bytes=", "").split("-")
                start = int(byte_range[0]) if byte_range[0] else 0
                end = int(byte_range[1]) if len(byte_range) > 1 and byte_range[1] else file_size - 1
                end = min(end, file_size - 1)
                length = max(0, end - start + 1)
            except ValueError:
                start, end, length = 0, file_size - 1, file_size

            def iter_range():
                with open(file_path, "rb") as f:
                    f.seek(start)
                    remaining = length
                    while remaining > 0:
                        chunk = f.read(min(65536, remaining))
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk

            return StreamingResponse(
                iter_range(),
                status_code=206,
                media_type=media_type,
                headers={
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(length),
                    "Cache-Control": "no-cache",
                },
            )
        return FileResponse(
            str(file_path),
            media_type=media_type,
            headers={"Accept-Ranges": "bytes"},
        )

    @app.get("/api/projects/{project_id}/audio")
    def stream_project_audio(
        project_id: str,
        request: Request,
        speed: float = Query(default=1.0, ge=0.25, le=2.0),
        semitones: float = Query(default=0.0, ge=-24.0, le=24.0),
        cents: float = Query(default=0.0, ge=-100.0, le=100.0),
    ):
        """
        Streams real C++17 DSP time-stretched & pitch-shifted audio (WAV) for playback.
        When speed=1.0 and pitch=0, serves original decoded WAV cleanly.
        """
        proj = repo.get_project(project_id)
        if not proj or not proj.get("audio_file_path"):
            raise HTTPException(status_code=404, detail="Projeto sem áudio carregado")

        audio_path = Path(proj["audio_file_path"])
        if not audio_path.exists():
            raise HTTPException(status_code=404, detail="Arquivo de áudio não encontrado no disco")

        rendered = audio_mgr.render_processed_audio(
            audio_path,
            speed=speed,
            semitones=semitones,
            cents=cents,
            output_format="wav",
        )
        return _stream_file_with_range(rendered, request, "audio/wav")

    @app.get("/api/projects/{project_id}/video")
    def stream_project_video(project_id: str, request: Request):
        """Streams local or direct-URL imported video (MP4/WebM/MOV/MKV/M4V) with HTTP Range seeking."""
        proj = repo.get_project(project_id)
        if not proj or not proj.get("audio_file_path"):
            raise HTTPException(status_code=404, detail="Projeto sem vídeo carregado")
        video_path = Path(proj["audio_file_path"])
        if not video_path.exists() or video_path.suffix.lower() not in SUPPORTED_VIDEO_EXTENSIONS:
            raise HTTPException(status_code=404, detail="Arquivo de vídeo não encontrado")
        mime_map = {
            ".mp4": "video/mp4",
            ".m4v": "video/mp4",
            ".webm": "video/webm",
            ".mov": "video/quicktime",
            ".mkv": "video/x-matroska",
        }
        return _stream_file_with_range(video_path, request, mime_map.get(video_path.suffix.lower(), "video/mp4"))

    @app.get("/api/projects/{project_id}/waveform")
    def get_waveform(project_id: str, bins: int = Query(default=2400, ge=128, le=12000)) -> Dict[str, Any]:
        proj = repo.get_project(project_id)
        if not proj or not proj.get("audio_file_path"):
            raise HTTPException(status_code=404, detail="Projeto sem áudio")
        return audio_mgr.get_waveform_peaks(proj["audio_file_path"], num_bins=bins)

    @app.get("/api/projects/{project_id}/spectrogram")
    def get_spectrogram(
        project_id: str,
        log_scale: bool = Query(default=True),
        fft_size: int = Query(default=2048),
        bins: int = Query(default=128, ge=32, le=512),
    ) -> Dict[str, Any]:
        proj = repo.get_project(project_id)
        if not proj or not proj.get("audio_file_path"):
            raise HTTPException(status_code=404, detail="Projeto sem áudio")
        return audio_mgr.get_spectrogram(
            proj["audio_file_path"],
            fft_size=fft_size,
            log_freq_bins=bins if log_scale else 0,
        )

    # ---------- LOOPS & MARKERS ----------

    @app.post("/api/projects/{project_id}/loops")
    def upsert_loop(project_id: str, req: LoopUpsertRequest) -> Dict[str, Any]:
        if not repo.get_project(project_id):
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        return repo.upsert_loop(project_id, req.model_dump())

    @app.delete("/api/projects/{project_id}/loops/{loop_id}")
    def delete_loop(project_id: str, loop_id: str) -> Dict[str, Any]:
        return {"deleted": repo.delete_loop(project_id, loop_id)}

    @app.post("/api/projects/{project_id}/markers")
    def upsert_marker(project_id: str, req: MarkerUpsertRequest) -> Dict[str, Any]:
        if not repo.get_project(project_id):
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        return repo.upsert_marker(project_id, req.model_dump())

    @app.delete("/api/projects/{project_id}/markers/{marker_id}")
    def delete_marker(project_id: str, marker_id: str) -> Dict[str, Any]:
        return {"deleted": repo.delete_marker(project_id, marker_id)}

    # ---------- MANUAL EDITING OF NOTES & CHORDS ----------

    @app.put("/api/projects/{project_id}/notes")
    def replace_notes(project_id: str, req: NotesReplaceRequest) -> Dict[str, Any]:
        if not repo.get_project(project_id):
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        notes_dicts = []
        for n in req.notes:
            d = n.model_dump()
            if not d["note_name"]:
                d["note_name"] = midi_to_note_name(d["pitch"])
            notes_dicts.append(d)
        saved = repo.replace_notes(project_id, notes_dicts)
        return {"notes": saved, "count": len(saved)}

    @app.put("/api/projects/{project_id}/chords")
    def replace_chords(project_id: str, req: ChordsReplaceRequest) -> Dict[str, Any]:
        if not repo.get_project(project_id):
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        saved = repo.replace_chords(project_id, [c.model_dump() for c in req.chords])
        return {"chords": saved, "count": len(saved)}

    # ---------- MUSICAL AI ANALYSIS ----------

    def _require_project_audio(project_id: str):
        proj = repo.get_project(project_id)
        if not proj or not proj.get("audio_file_path"):
            raise HTTPException(status_code=404, detail="Projeto sem arquivo de áudio")
        pcm, sr = audio_mgr.load_pcm(proj["audio_file_path"])
        return proj, pcm, sr

    @app.post("/api/projects/{project_id}/analyze/bpm")
    def run_bpm_analysis(project_id: str) -> Dict[str, Any]:
        _, pcm, sr = _require_project_audio(project_id)
        res = analyze_bpm_and_beats(pcm, sr, dsp=dsp)
        repo.save_analysis_cache(project_id, "bpm", res)
        repo.update_project(
            project_id,
            {
                "bpm": res["bpm"],
                "bpm_confidence": res["confidence"],
                "time_signature": res["time_signature"],
            },
        )
        return res

    @app.post("/api/projects/{project_id}/analyze/key")
    def run_key_analysis(project_id: str) -> Dict[str, Any]:
        _, pcm, sr = _require_project_audio(project_id)
        res = analyze_key_and_scale(pcm, sr)
        repo.save_analysis_cache(project_id, "key", res)
        repo.update_project(
            project_id,
            {
                "musical_key": res["key"],
                "scale_name": res["scale"],
                "key_confidence": res["confidence"],
            },
        )
        return res

    @app.post("/api/projects/{project_id}/analyze/notes")
    def run_notes_analysis(project_id: str) -> Dict[str, Any]:
        _, pcm, sr = _require_project_audio(project_id)
        onnx_path = model_mgr.get_model_path("basic-pitch-onnx")
        res = analyze_notes_and_melody(pcm, sr, dsp=dsp, onnx_model_path=onnx_path)
        repo.replace_notes(project_id, res["notes"])
        repo.save_analysis_cache(
            project_id,
            "notes",
            {
                "engine": res["engine"],
                "note_count": res["note_count"],
                "average_confidence": res["average_confidence"],
                "low_confidence": res["low_confidence"],
                "warning": res["warning"],
                "intervals": res["intervals"],
                "pitch_track": res["pitch_track"],
            },
        )
        return res

    @app.post("/api/projects/{project_id}/analyze/chords")
    def run_chords_analysis(project_id: str) -> Dict[str, Any]:
        proj, pcm, sr = _require_project_audio(project_id)
        beats = proj.get("analysis", {}).get("bpm", {}).get("beats")
        if not beats:
            bpm_res = analyze_bpm_and_beats(pcm, sr, dsp=dsp)
            beats = bpm_res["beats"]
            repo.save_analysis_cache(project_id, "bpm", bpm_res)
        res = analyze_chords(pcm, sr, beats_sec=beats)
        repo.replace_chords(project_id, res["chords"])
        repo.save_analysis_cache(
            project_id,
            "chords",
            {
                "progression_summary": res["progression_summary"],
                "average_confidence": res["average_confidence"],
                "low_confidence": res["low_confidence"],
                "warning": res["warning"],
            },
        )
        return res

    @app.post("/api/projects/{project_id}/analyze/full")
    def run_full_analysis(project_id: str) -> Dict[str, Any]:
        """Runs BPM/Beats + Key/Scale + Chords + Polyphonic Notes/Melody/Bass in one pass."""
        _, pcm, sr = _require_project_audio(project_id)
        bpm_res = analyze_bpm_and_beats(pcm, sr, dsp=dsp)
        key_res = analyze_key_and_scale(pcm, sr)
        chord_res = analyze_chords(pcm, sr, beats_sec=bpm_res["beats"])
        onnx_path = model_mgr.get_model_path("basic-pitch-onnx")
        note_res = analyze_notes_and_melody(pcm, sr, dsp=dsp, onnx_model_path=onnx_path)

        repo.save_analysis_cache(project_id, "bpm", bpm_res)
        repo.save_analysis_cache(project_id, "key", key_res)
        repo.save_analysis_cache(
            project_id,
            "chords",
            {
                "progression_summary": chord_res["progression_summary"],
                "average_confidence": chord_res["average_confidence"],
                "low_confidence": chord_res["low_confidence"],
                "warning": chord_res["warning"],
            },
        )
        repo.save_analysis_cache(
            project_id,
            "notes",
            {
                "engine": note_res["engine"],
                "note_count": note_res["note_count"],
                "average_confidence": note_res["average_confidence"],
                "low_confidence": note_res["low_confidence"],
                "warning": note_res["warning"],
                "intervals": note_res["intervals"],
                "pitch_track": note_res["pitch_track"],
            },
        )
        repo.replace_chords(project_id, chord_res["chords"])
        repo.replace_notes(project_id, note_res["notes"])
        repo.update_project(
            project_id,
            {
                "bpm": bpm_res["bpm"],
                "bpm_confidence": bpm_res["confidence"],
                "time_signature": bpm_res["time_signature"],
                "musical_key": key_res["key"],
                "scale_name": key_res["scale"],
                "key_confidence": key_res["confidence"],
            },
        )
        return {
            "bpm": bpm_res,
            "key": key_res,
            "chords": chord_res,
            "notes": note_res,
            "project": repo.get_project(project_id),
        }

    @app.post("/api/tools/tap-tempo")
    def tap_tempo(req: TapTempoRequest) -> Dict[str, Any]:
        return compute_tap_tempo(req.timestamps_sec)

    # ---------- 4-STEM INSTRUMENT SEPARATION ----------

    @app.post("/api/projects/{project_id}/stems/separate")
    def separate_stems(project_id: str) -> Dict[str, Any]:
        proj = repo.get_project(project_id)
        if not proj or not proj.get("audio_file_path"):
            raise HTTPException(status_code=404, detail="Projeto sem áudio")

        job_key = f"stems:{project_id}"
        _set_job(job_key, "running", 5.0, "Iniciando separação de 4 stems...")

        def on_progress(pct: float, msg: str) -> None:
            _set_job(job_key, "running", pct, msg)

        try:
            stem_dir = audio_mgr.stems_dir / project_id
            onnx_path = model_mgr.get_model_path("htdemucs-4stems-onnx") or model_mgr.get_model_path("mdx-vocal-onnx")
            result = separate_audio_stems(
                proj["audio_file_path"],
                stem_dir,
                onnx_model_path=onnx_path,
                progress_cb=on_progress,
            )
            repo.save_analysis_cache(project_id, "stems", result)
            _set_job(job_key, "completed", 100.0, "Separação concluída.")
            return result
        except Exception as exc:
            _set_job(job_key, "error", 0.0, "Erro ao separar stems", error=str(exc))
            raise HTTPException(status_code=500, detail=str(exc))

    @app.get("/api/projects/{project_id}/stems/status")
    def stems_job_status(project_id: str) -> Dict[str, Any]:
        with jobs_lock:
            return jobs.get(f"stems:{project_id}", {"status": "idle", "progress": 0.0, "message": ""})

    @app.get("/api/projects/{project_id}/stems/{stem_key}/audio")
    def stream_stem_audio(
        project_id: str,
        stem_key: str,
        request: Request,
        speed: float = Query(default=1.0, ge=0.25, le=2.0),
        semitones: float = Query(default=0.0, ge=-24.0, le=24.0),
        cents: float = Query(default=0.0, ge=-100.0, le=100.0),
    ):
        if stem_key not in ("vocals", "drums", "bass", "other"):
            raise HTTPException(status_code=400, detail="Stem inválido")
        stem_path = audio_mgr.stems_dir / project_id / f"{stem_key}.wav"
        if not stem_path.exists():
            raise HTTPException(status_code=404, detail="Stem ainda não gerado. Execute a separação primeiro.")
        rendered = audio_mgr.render_processed_audio(
            stem_path, speed=speed, semitones=semitones, cents=cents, output_format="wav"
        )
        return _stream_file_with_range(rendered, request, "audio/wav")

    # ---------- EXPORT (MP3, WAV, FLAC, MIDI, TXT NOTES, TXT CHORDS, PDF REPORT) ----------

    @app.post("/api/projects/{project_id}/export")
    def export_project(project_id: str, req: ExportRequest):
        proj = repo.get_project(project_id)
        if not proj:
            raise HTTPException(status_code=404, detail="Projeto não encontrado")

        safe_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in proj["name"])[:48] or "mrq_export"
        ts = int(time.time())
        fmt = req.format.lower()

        if fmt in ("mp3", "wav", "flac", "m4a", "aac", "ogg", "aiff"):
            out_path = audio_mgr.exports_dir / f"{safe_name}_{req.scope}_{ts}.{fmt}"
            try:
                if req.scope == "stem":
                    stem_key = req.stem_key or "vocals"
                    stem_file = audio_mgr.stems_dir / project_id / f"{stem_key}.wav"
                    if not stem_file.exists():
                        raise HTTPException(status_code=404, detail=f"Stem '{stem_key}' não encontrado.")
                    exporter.export_audio(
                        stem_file,
                        out_path,
                        fmt=fmt,
                        speed=req.speed,
                        semitones=req.semitones,
                        cents=req.cents,
                        start_sec=req.start_sec,
                        end_sec=req.end_sec,
                    )
                elif req.scope == "stems_mix":
                    stem_dir = audio_mgr.stems_dir / project_id
                    paths = {
                        k: stem_dir / f"{k}.wav"
                        for k in ("vocals", "drums", "bass", "other")
                        if (stem_dir / f"{k}.wav").exists()
                    }
                    if not paths:
                        raise HTTPException(status_code=404, detail="Separe os stems antes de exportar o mix.")
                    needs_dsp = (
                        abs(req.speed - 1.0) > 1e-4
                        or abs(req.semitones) > 1e-4
                        or abs(req.cents) > 1e-4
                    )
                    if needs_dsp:
                        tmp_mix = audio_mgr.cache_dir / f"stems_mix_raw_{project_id}_{ts}.wav"
                        exporter.export_stems_mix(
                            paths,
                            gains=req.stem_gains or {},
                            mutes=req.stem_mutes or {},
                            output_path=tmp_mix,
                            fmt="wav",
                        )
                        exporter.export_audio(
                            tmp_mix,
                            out_path,
                            fmt=fmt,
                            speed=req.speed,
                            semitones=req.semitones,
                            cents=req.cents,
                        )
                    else:
                        exporter.export_stems_mix(
                            paths,
                            gains=req.stem_gains or {},
                            mutes=req.stem_mutes or {},
                            output_path=out_path,
                            fmt=fmt,
                        )
                else:
                    if not proj.get("audio_file_path"):
                        raise HTTPException(status_code=400, detail="Projeto sem áudio para exportar.")
                    exporter.export_audio(
                        proj["audio_file_path"],
                        out_path,
                        fmt=fmt,
                        speed=req.speed,
                        semitones=req.semitones,
                        cents=req.cents,
                        start_sec=req.start_sec if req.scope in ("selection", "loop") else None,
                        end_sec=req.end_sec if req.scope in ("selection", "loop") else None,
                    )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))
            mime_map = {
                "mp3": "audio/mpeg",
                "wav": "audio/wav",
                "flac": "audio/flac",
                "m4a": "audio/mp4",
                "aac": "audio/aac",
                "ogg": "audio/ogg",
                "aiff": "audio/aiff",
            }
            return FileResponse(str(out_path), media_type=mime_map[fmt], filename=out_path.name)

        if fmt == "mid":
            out_path = audio_mgr.exports_dir / f"{safe_name}_{ts}.mid"
            exporter.export_midi(
                proj.get("notes", []),
                out_path,
                bpm=float(proj.get("bpm") or 120.0),
                time_signature=proj.get("time_signature") or "4/4",
            )
            return FileResponse(str(out_path), media_type="audio/midi", filename=out_path.name)

        if fmt == "musicxml":
            out_path = audio_mgr.exports_dir / f"{safe_name}_{ts}.musicxml"
            try:
                export_musicxml(proj, out_path)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))
            return FileResponse(str(out_path), media_type="application/vnd.recordare.musicxml+xml", filename=out_path.name)

        if fmt == "txt_notes":
            out_path = audio_mgr.exports_dir / f"{safe_name}_notas_{ts}.txt"
            exporter.export_notes_txt(proj, out_path)
            return FileResponse(str(out_path), media_type="text/plain; charset=utf-8", filename=out_path.name)

        if fmt == "txt_chords":
            out_path = audio_mgr.exports_dir / f"{safe_name}_cifras_{ts}.txt"
            exporter.export_chords_txt(proj, out_path)
            return FileResponse(str(out_path), media_type="text/plain; charset=utf-8", filename=out_path.name)

        if fmt == "pdf":
            out_path = audio_mgr.exports_dir / f"{safe_name}_relatorio_{ts}.pdf"
            exporter.export_analysis_pdf(proj, out_path)
            return FileResponse(str(out_path), media_type="application/pdf", filename=out_path.name)

        raise HTTPException(status_code=400, detail=f"Formato de exportação inválido: {fmt}")

    # ---------- AI MODEL MANAGER ----------

    @app.get("/api/models")
    def list_models() -> Dict[str, Any]:
        return {"runtime": model_mgr.runtime_info(), "models": model_mgr.list_models()}

    @app.post("/api/models/{model_id}/download")
    def download_model(model_id: str) -> Dict[str, Any]:
        try:
            return model_mgr.download_model(model_id)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    @app.delete("/api/models/{model_id}")
    def remove_model(model_id: str) -> Dict[str, Any]:
        return {"removed": model_mgr.remove_model(model_id), "id": model_id}

    # ---------- SERVE BUILT FRONTEND (PRODUCTION / ELECTRON / PREVIEW) ----------

    dist_dir = _resolve_studio_dist()
    if dist_dir.exists() and (dist_dir / "index.html").exists():
        assets_dir = dist_dir / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="studio_assets")

        @app.get("/{full_path:path}")
        def serve_spa(full_path: str):
            if full_path.startswith("api/"):
                return JSONResponse({"detail": "Endpoint não encontrado"}, status_code=404)
            candidate = dist_dir / full_path
            if full_path and candidate.exists() and candidate.is_file():
                return FileResponse(str(candidate))
            return FileResponse(str(dist_dir / "index.html"))

    return app


app = create_app()


if __name__ == "__main__":
    multiprocessing.freeze_support()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    import uvicorn

    port = int(os.environ.get("MRQ_PORT", "8765"))
    host = os.environ.get("MRQ_HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port, log_level="info", log_config=None)

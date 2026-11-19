"""
Multi-format audio decoder & encoder backed by FFmpeg (via PyAV).
Supports real import & metadata extraction for:
  MP3, WAV, M4A, FLAC, AAC, OGG, AIFF
And real export encoding for:
  WAV (PCM 16-bit), MP3 (LAME 192/320kbps), FLAC (lossless), OGG, M4A/AAC, AIFF.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Optional, Tuple

import av
import numpy as np

SUPPORTED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg", ".aiff", ".aif"}
SUPPORTED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".mkv", ".m4v"}
SUPPORTED_IMPORT_EXTENSIONS = SUPPORTED_AUDIO_EXTENSIONS | SUPPORTED_VIDEO_EXTENSIONS


@dataclass
class AudioMetadata:
    file_path: str
    filename: str
    format_name: str
    codec_name: str
    duration_sec: float
    sample_rate: int
    channels: int
    bit_rate: int
    file_size_bytes: int
    channel_layout: str

    def to_dict(self) -> Dict:
        return asdict(self)


def probe_audio_metadata(file_path: str | Path) -> AudioMetadata:
    """Extracts complete technical audio metadata without decoding the entire file."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo de áudio não encontrado: {path}")

    file_size = path.stat().st_size
    with av.open(str(path)) as container:
        audio_streams = [s for s in container.streams if s.type == "audio"]
        if not audio_streams:
            raise ValueError(f"Nenhuma faixa de áudio válida encontrada em {path.name}")
        stream = audio_streams[0]

        duration_sec = 0.0
        if container.duration is not None:
            duration_sec = float(container.duration) / float(av.time_base)
        elif stream.duration is not None and stream.time_base is not None:
            duration_sec = float(stream.duration * stream.time_base)

        sr = int(stream.rate or 44100)
        channels = int(stream.channels or 2)
        bit_rate = int(stream.bit_rate or container.bit_rate or 0)
        codec_name = stream.codec_context.name if stream.codec_context else "unknown"
        fmt_name = path.suffix.lstrip(".").upper() or (container.format.name.split(",")[0].upper())
        layout = stream.layout.name if stream.layout else ("stereo" if channels == 2 else "mono")

        # Fallback accurate duration for containers lacking header duration (e.g. raw AAC/ADTS)
        if duration_sec <= 0.0:
            total_samples = 0
            for frame in container.decode(stream):
                total_samples += frame.samples
            duration_sec = total_samples / float(sr) if sr > 0 else 0.0

    return AudioMetadata(
        file_path=str(path.resolve()),
        filename=path.name,
        format_name=fmt_name,
        codec_name=codec_name,
        duration_sec=round(duration_sec, 4),
        sample_rate=sr,
        channels=channels,
        bit_rate=bit_rate,
        file_size_bytes=file_size,
        channel_layout=layout,
    )


def decode_audio(
    file_path: str | Path,
    target_sr: Optional[int] = None,
    mono: bool = False,
    start_sec: Optional[float] = None,
    end_sec: Optional[float] = None,
) -> Tuple[np.ndarray, int]:
    """
    Decodes any supported audio file into float32 numpy array of shape (frames, channels)
    normalized to [-1.0, 1.0]. Optionally resamples or slices by time range.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo de áudio não encontrado: {path}")

    with av.open(str(path)) as container:
        audio_streams = [s for s in container.streams if s.type == "audio"]
        if not audio_streams:
            raise ValueError(f"Nenhuma faixa de áudio encontrada em {path.name}")
        stream = audio_streams[0]

        out_sr = int(target_sr or stream.rate or 44100)
        out_layout = "mono" if mono else ("stereo" if (stream.channels or 2) >= 2 else "mono")
        out_channels = 1 if out_layout == "mono" else 2

        resampler = av.AudioResampler(format="flt", layout=out_layout, rate=out_sr)

        chunks = []
        for frame in container.decode(stream):
            resampled_frames = resampler.resample(frame)
            if not isinstance(resampled_frames, list):
                resampled_frames = [resampled_frames]
            for rf in resampled_frames:
                if rf is None or rf.samples == 0:
                    continue
                arr = rf.to_ndarray()
                # PyAV packed float 'flt' yields shape (1, samples * channels)
                arr = np.asarray(arr, dtype=np.float32).reshape(-1)
                if arr.size >= out_channels:
                    n_frames = arr.size // out_channels
                    chunks.append(arr[: n_frames * out_channels].reshape((n_frames, out_channels)))

        # Flush resampler
        flushed = resampler.resample(None)
        if flushed:
            if not isinstance(flushed, list):
                flushed = [flushed]
            for rf in flushed:
                if rf is not None and rf.samples > 0:
                    arr = np.asarray(rf.to_ndarray(), dtype=np.float32).reshape(-1)
                    n_frames = arr.size // out_channels
                    if n_frames > 0:
                        chunks.append(arr[: n_frames * out_channels].reshape((n_frames, out_channels)))

    if not chunks:
        return np.zeros((0, out_channels), dtype=np.float32), out_sr

    pcm = np.concatenate(chunks, axis=0)
    np.clip(pcm, -1.0, 1.0, out=pcm)

    # Apply exact sample-accurate range trim if requested
    if start_sec is not None or end_sec is not None:
        s_idx = max(0, int(round((start_sec or 0.0) * out_sr)))
        e_idx = pcm.shape[0] if end_sec is None else min(pcm.shape[0], int(round(end_sec * out_sr)))
        if e_idx > s_idx:
            pcm = pcm[s_idx:e_idx]
        else:
            pcm = np.zeros((0, out_channels), dtype=np.float32)

    return np.ascontiguousarray(pcm, dtype=np.float32), out_sr


def encode_audio(
    audio: np.ndarray,
    sample_rate: int,
    output_path: str | Path,
    fmt: Optional[str] = None,
    bitrate: int = 192000,
) -> Path:
    """
    Encodes float32 PCM array (frames, channels) or (frames,) to WAV, MP3, FLAC, OGG, M4A, AAC or AIFF.
    """
    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    arr = np.asarray(audio, dtype=np.float32)
    if arr.ndim == 1:
        arr = arr[:, np.newaxis]
    arr = np.clip(arr, -1.0, 1.0)
    n_frames, channels = arr.shape
    if channels not in (1, 2):
        arr = arr[:, :2]
        channels = arr.shape[1]

    ext = (fmt or out_path.suffix.lstrip(".")).lower()
    layout = "mono" if channels == 1 else "stereo"

    # Format / codec mapping verified on PyAV FFmpeg
    codec_map = {
        "wav": ("wav", "pcm_s16le", "s16", None, sample_rate),
        "mp3": ("mp3", "libmp3lame", "fltp", bitrate, sample_rate),
        "flac": ("flac", "flac", "s16", None, sample_rate),
        "ogg": ("ogg", "libopus", "s16", bitrate, 48000),
        "m4a": ("ipod", "aac", "fltp", bitrate, sample_rate),
        "aac": ("adts", "aac", "fltp", bitrate, sample_rate),
        "aiff": ("aiff", "pcm_s16be", "s16", None, sample_rate),
        "aif": ("aiff", "pcm_s16be", "s16", None, sample_rate),
    }
    if ext not in codec_map:
        raise ValueError(f"Formato de exportação não suportado: {ext}")

    container_fmt, codec_name, sample_fmt, target_br, enc_sr = codec_map[ext]

    # Write atomically via temp file then rename
    tmp_path = out_path.with_suffix(out_path.suffix + ".tmp")
    try:
        with av.open(str(tmp_path), mode="w", format=container_fmt) as container:
            stream = container.add_stream(codec_name, rate=enc_sr)
            stream.layout = layout
            if target_br:
                stream.bit_rate = target_br

            resampler = av.AudioResampler(format=sample_fmt, layout=layout, rate=enc_sr)

            chunk_size = 4096
            pts = 0
            for start in range(0, n_frames, chunk_size):
                chunk = arr[start : start + chunk_size]
                if sample_fmt == "s16" and enc_sr == sample_rate:
                    pcm_i16 = np.round(chunk * 32767.0).astype(np.int16)
                    # Packed s16 expects shape (1, samples * channels)
                    packed = np.ascontiguousarray(pcm_i16.reshape(1, -1))
                    frame = av.AudioFrame.from_ndarray(packed, format="s16", layout=layout)
                    frame.sample_rate = sample_rate
                    frame.pts = pts
                    pts += chunk.shape[0]
                    for packet in stream.encode(frame):
                        container.mux(packet)
                else:
                    # Planar float 'fltp' expects shape (channels, samples)
                    planar = np.ascontiguousarray(chunk.T, dtype=np.float32)
                    in_frame = av.AudioFrame.from_ndarray(planar, format="fltp", layout=layout)
                    in_frame.sample_rate = sample_rate
                    out_frames = resampler.resample(in_frame)
                    if not isinstance(out_frames, list):
                        out_frames = [out_frames]
                    for rf in out_frames:
                        if rf is not None:
                            rf.pts = pts
                            pts += rf.samples
                            for packet in stream.encode(rf):
                                container.mux(packet)

            # Flush resampler if used
            if not (sample_fmt == "s16" and enc_sr == sample_rate):
                flushed = resampler.resample(None)
                if flushed:
                    if not isinstance(flushed, list):
                        flushed = [flushed]
                    for rf in flushed:
                        if rf is not None:
                            rf.pts = pts
                            pts += rf.samples
                            for packet in stream.encode(rf):
                                container.mux(packet)

            # Flush encoder
            for packet in stream.encode(None):
                container.mux(packet)

        os.replace(tmp_path, out_path)
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass

    return out_path

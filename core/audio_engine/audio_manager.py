"""
Audio Manager: handles imported tracks, temporary storage, LRU RAM cache,
real-time / cached C++ DSP rendering (time-stretch + pitch-shift), waveform peaks,
and real FFT spectrogram computation.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import threading
import time
from collections import OrderedDict
from pathlib import Path
from typing import Dict, Optional, Tuple

import numpy as np

from core.audio_engine.bridge import NativeDSPEngine, get_dsp_engine
from core.audio_engine.decoder import (
    AudioMetadata,
    SUPPORTED_IMPORT_EXTENSIONS,
    decode_audio,
    encode_audio,
    probe_audio_metadata,
)


class AudioManager:
    """Manages audio lifecycle, bounded RAM cache, and temp rendered assets."""

    def __init__(
        self,
        storage_dir: str | Path,
        max_ram_tracks: int = 4,
        max_temp_files: int = 32,
        dsp: Optional[NativeDSPEngine] = None,
    ) -> None:
        self.storage_dir = Path(storage_dir)
        self.imports_dir = self.storage_dir / "audio_imports"
        self.cache_dir = self.storage_dir / "temp_cache"
        self.stems_dir = self.storage_dir / "stems"
        self.exports_dir = self.storage_dir / "exports"

        for d in (self.imports_dir, self.cache_dir, self.stems_dir, self.exports_dir):
            d.mkdir(parents=True, exist_ok=True)

        self.dsp = dsp or get_dsp_engine()
        self.max_ram_tracks = max_ram_tracks
        self.max_temp_files = max_temp_files
        self._lock = threading.RLock()
        # LRU cache: file_path -> (pcm_float32, sample_rate)
        self._pcm_cache: OrderedDict[str, Tuple[np.ndarray, int]] = OrderedDict()

    def import_file(self, source_path: str | Path, original_filename: Optional[str] = None) -> AudioMetadata:
        """Validates, copies into managed audio storage, and probes metadata."""
        src = Path(source_path)
        name = original_filename or src.name
        ext = Path(name).suffix.lower()
        if ext not in SUPPORTED_IMPORT_EXTENSIONS:
            raise ValueError(
                f"Formato '{ext}' não suportado. Use: {', '.join(sorted(SUPPORTED_IMPORT_EXTENSIONS))}"
            )

        # Deduplicate by SHA-256 prefix + safe stem
        h = hashlib.sha256()
        with open(src, "rb") as f:
            for block in iter(lambda: f.read(65536), b""):
                h.update(block)
        digest = h.hexdigest()[:12]
        safe_stem = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in Path(name).stem)[:48]
        dest = self.imports_dir / f"{safe_stem}_{digest}{ext}"

        if not dest.exists():
            shutil.copy2(src, dest)

        meta = probe_audio_metadata(dest)
        return meta

    def load_pcm(
        self,
        file_path: str | Path,
        target_sr: Optional[int] = None,
        mono: bool = False,
    ) -> Tuple[np.ndarray, int]:
        """Loads PCM float32 (frames, channels) with LRU RAM eviction to avoid memory leaks."""
        resolved = str(Path(file_path).resolve())
        cache_key = f"{resolved}|sr={target_sr}|mono={mono}"

        with self._lock:
            if cache_key in self._pcm_cache:
                self._pcm_cache.move_to_end(cache_key)
                return self._pcm_cache[cache_key]

        pcm, sr = decode_audio(resolved, target_sr=target_sr, mono=mono)

        with self._lock:
            self._pcm_cache[cache_key] = (pcm, sr)
            self._pcm_cache.move_to_end(cache_key)
            while len(self._pcm_cache) > self.max_ram_tracks:
                self._pcm_cache.popitem(last=False)

        return pcm, sr

    def get_waveform_peaks(self, file_path: str | Path, num_bins: int = 2400) -> Dict:
        """Computes real waveform peaks via native C++17 DSP."""
        pcm, sr = self.load_pcm(file_path)
        if pcm.shape[0] == 0:
            return {"bins": 0, "duration_sec": 0.0, "min": [], "max": [], "rms": []}

        num_bins = max(64, min(int(num_bins), 16000))
        mn, mx, rms = self.dsp.compute_waveform_peaks(pcm, num_bins=num_bins)
        return {
            "bins": num_bins,
            "sample_rate": sr,
            "duration_sec": round(pcm.shape[0] / float(sr), 4),
            "min": [round(float(v), 4) for v in mn],
            "max": [round(float(v), 4) for v in mx],
            "rms": [round(float(v), 4) for v in rms],
        }

    def get_spectrogram(
        self,
        file_path: str | Path,
        fft_size: int = 2048,
        hop_size: int = 1024,
        log_freq_bins: int = 128,
        min_freq: float = 32.7,
        max_freq: float = 8000.0,
        max_time_frames: int = 900,
    ) -> Dict:
        """Computes real FFT spectrogram in dB via native C++17 DSP."""
        pcm, sr = self.load_pcm(file_path)
        if pcm.shape[0] == 0:
            return {"frames": 0, "bins": 0, "duration_sec": 0.0, "data": []}

        mono = pcm.mean(axis=1).astype(np.float32) if pcm.shape[1] > 1 else pcm[:, 0]
        # Adapt hop_size for long tracks so UI payload remains responsive while keeping full duration
        if mono.size > fft_size:
            min_hop = max(hop_size, int((mono.size - fft_size) // max(1, max_time_frames)))
        else:
            min_hop = hop_size

        mat = self.dsp.compute_spectrogram(
            mono,
            sample_rate=sr,
            fft_size=fft_size,
            hop_size=min_hop,
            log_freq_bins=log_freq_bins,
            min_freq=min_freq,
            max_freq=min(max_freq, sr * 0.49),
        )
        # Quantize dB [-100, 0] to uint8 [0, 255] for compact fast transport
        norm = np.clip((mat + 96.0) / 96.0, 0.0, 1.0)
        u8 = np.round(norm * 255.0).astype(np.uint8)
        return {
            "frames": int(mat.shape[0]),
            "bins": int(mat.shape[1]),
            "sample_rate": sr,
            "duration_sec": round(mono.size / float(sr), 4),
            "min_freq": float(min_freq),
            "max_freq": float(min(max_freq, sr * 0.49)),
            "log_scale": log_freq_bins > 0,
            "db_floor": -96.0,
            "data": u8.tolist(),
        }

    def render_processed_audio(
        self,
        file_path: str | Path,
        speed: float = 1.0,
        semitones: float = 0.0,
        cents: float = 0.0,
        start_sec: Optional[float] = None,
        end_sec: Optional[float] = None,
        output_format: str = "wav",
    ) -> Path:
        """
        Renders real time-stretched and/or pitch-shifted audio using C++17 Phase Vocoder.
        Caches rendered playback files in temp_cache with automatic eviction.
        """
        resolved = Path(file_path).resolve()
        speed_clamped = round(max(0.25, min(2.0, float(speed))), 4)
        semi_clamped = round(max(-24.0, min(24.0, float(semitones))), 3)
        cents_clamped = round(max(-100.0, min(100.0, float(cents))), 2)

        # Fast-path: unmodified full WAV/MP3 original
        if (
            abs(speed_clamped - 1.0) < 1e-4
            and abs(semi_clamped) < 1e-4
            and abs(cents_clamped) < 1e-4
            and start_sec is None
            and end_sec is None
            and resolved.suffix.lower() == f".{output_format.lower()}"
        ):
            return resolved

        key_raw = (
            f"{resolved}|{resolved.stat().st_mtime_ns}|"
            f"spd={speed_clamped}|st={semi_clamped}|ct={cents_clamped}|"
            f"a={start_sec}|b={end_sec}|fmt={output_format}"
        )
        key_hash = hashlib.sha256(key_raw.encode("utf-8")).hexdigest()[:16]
        out_path = self.cache_dir / f"render_{key_hash}.{output_format.lower()}"

        if out_path.exists():
            # Touch mtime for LRU eviction
            os.utime(out_path, None)
            return out_path

        pcm, sr = self.load_pcm(resolved)
        if start_sec is not None or end_sec is not None:
            total_dur = pcm.shape[0] / float(sr)
            s_idx = max(0, int(round((start_sec or 0.0) * sr)))
            e_idx = pcm.shape[0] if end_sec is None else min(pcm.shape[0], int(round(end_sec * sr)))
            if e_idx - s_idx < 64:
                raise ValueError(
                    f"Trecho selecionado ({start_sec or 0.0:.2f}s → {end_sec if end_sec is not None else total_dur:.2f}s) "
                    f"está fora da duração do áudio ({total_dur:.2f}s). Ajuste os pontos A/B antes de exportar."
                )
            pcm = pcm[s_idx:e_idx]

        processed = self.dsp.time_and_pitch(
            pcm,
            sample_rate=sr,
            speed_ratio=speed_clamped,
            semitones=semi_clamped,
            cents=cents_clamped,
        )

        encode_audio(processed, sr, out_path, fmt=output_format)
        self._evict_old_temp_files()
        return out_path

    def _evict_old_temp_files(self) -> None:
        files = sorted(
            [p for p in self.cache_dir.glob("render_*") if p.is_file()],
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        for old in files[self.max_temp_files :]:
            try:
                old.unlink()
            except OSError:
                pass

    def clear_cache(self) -> int:
        """Clears RAM and temporary render cache; returns number of temp files removed."""
        with self._lock:
            self._pcm_cache.clear()
        removed = 0
        for p in self.cache_dir.glob("render_*"):
            try:
                p.unlink()
                removed += 1
            except OSError:
                pass
        return removed

    def diagnostics(self) -> Dict:
        return {
            "dsp_version": self.dsp.version,
            "dsp_library": str(self.dsp.lib_path),
            "ram_cached_tracks": len(self._pcm_cache),
            "temp_render_files": len(list(self.cache_dir.glob("render_*"))),
            "supported_import_formats": sorted(SUPPORTED_IMPORT_EXTENSIONS),
            "timestamp": time.time(),
        }

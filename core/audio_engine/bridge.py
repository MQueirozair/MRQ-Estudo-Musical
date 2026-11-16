"""
ctypes FFI bridge to the compiled C++17 native library `libmrq_dsp`.
Provides zero-copy NumPy float32 interop for:
- Real Phase Vocoder Time Stretching (25% - 200% without pitch shift)
- Independent Pitch Shifting (semitones, octaves, cents)
- Combined single-pass Time + Pitch processing
- Multi-resolution Waveform Peaks (min / max / RMS)
- STFT / FFT Real Spectrogram (linear & logarithmic dB)
- YIN Monophonic Pitch Detection
- Spectral SuperFlux Onset Envelope
- Native Standard MIDI File (SMF Type 1) writer
"""

from __future__ import annotations

import ctypes
import os
import platform
from pathlib import Path
from typing import List, Tuple, Optional

import numpy as np


class MrqMidiNoteC(ctypes.Structure):
    _fields_ = [
        ("pitch", ctypes.c_int32),
        ("start_sec", ctypes.c_double),
        ("duration_sec", ctypes.c_double),
        ("velocity", ctypes.c_int32),
        ("channel", ctypes.c_int32),
    ]


def _find_dsp_library() -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    system = platform.system().lower()
    if system == "windows":
        candidates = [
            repo_root / "core" / "build" / "mrq_dsp.dll",
            repo_root / "core" / "build" / "Release" / "mrq_dsp.dll",
            repo_root / "core" / "build" / "libmrq_dsp.dll",
        ]
    elif system == "darwin":
        candidates = [
            repo_root / "core" / "build" / "libmrq_dsp.dylib",
        ]
    else:
        candidates = [
            repo_root / "core" / "build" / "libmrq_dsp.so",
        ]

    env_path = os.environ.get("MRQ_DSP_LIB")
    if env_path:
        candidates.insert(0, Path(env_path))

    for p in candidates:
        if p.exists():
            return p

    raise FileNotFoundError(
        f"Biblioteca nativa MRQ DSP não encontrada. Compile com `make -C core`. Buscado em: {candidates}"
    )


class NativeDSPEngine:
    """Thread-safe wrapper around libmrq_dsp native C ABI."""

    def __init__(self, lib_path: Optional[Path] = None) -> None:
        self.lib_path = lib_path or _find_dsp_library()
        self._lib = ctypes.CDLL(str(self.lib_path))
        self._configure_signatures()

    def _configure_signatures(self) -> None:
        lib = self._lib

        lib.mrq_dsp_version.argtypes = []
        lib.mrq_dsp_version.restype = ctypes.c_char_p

        lib.mrq_free_buffer.argtypes = [ctypes.c_void_p]
        lib.mrq_free_buffer.restype = None

        lib.mrq_time_stretch_f32.argtypes = [
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_double,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.POINTER(ctypes.POINTER(ctypes.c_float)),
            ctypes.POINTER(ctypes.c_int32),
        ]
        lib.mrq_time_stretch_f32.restype = ctypes.c_int

        lib.mrq_pitch_shift_f32.argtypes = [
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_double,
            ctypes.c_double,
            ctypes.POINTER(ctypes.POINTER(ctypes.c_float)),
            ctypes.POINTER(ctypes.c_int32),
        ]
        lib.mrq_pitch_shift_f32.restype = ctypes.c_int

        lib.mrq_time_and_pitch_f32.argtypes = [
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_double,
            ctypes.c_double,
            ctypes.c_double,
            ctypes.POINTER(ctypes.POINTER(ctypes.c_float)),
            ctypes.POINTER(ctypes.c_int32),
        ]
        lib.mrq_time_and_pitch_f32.restype = ctypes.c_int

        lib.mrq_compute_waveform_peaks_f32.argtypes = [
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.POINTER(ctypes.c_float),
            ctypes.POINTER(ctypes.c_float),
            ctypes.POINTER(ctypes.c_float),
        ]
        lib.mrq_compute_waveform_peaks_f32.restype = ctypes.c_int

        lib.mrq_compute_spectrogram_f32.argtypes = [
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_float,
            ctypes.c_float,
            ctypes.POINTER(ctypes.c_int32),
            ctypes.POINTER(ctypes.c_int32),
            ctypes.POINTER(ctypes.POINTER(ctypes.c_float)),
        ]
        lib.mrq_compute_spectrogram_f32.restype = ctypes.c_int

        lib.mrq_detect_pitch_yin_f32.argtypes = [
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_float,
            ctypes.c_float,
            ctypes.c_float,
            ctypes.POINTER(ctypes.c_int32),
            ctypes.POINTER(ctypes.POINTER(ctypes.c_float)),
            ctypes.POINTER(ctypes.POINTER(ctypes.c_float)),
        ]
        lib.mrq_detect_pitch_yin_f32.restype = ctypes.c_int

        lib.mrq_compute_onset_envelope_f32.argtypes = [
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.POINTER(ctypes.c_int32),
            ctypes.POINTER(ctypes.POINTER(ctypes.c_float)),
        ]
        lib.mrq_compute_onset_envelope_f32.restype = ctypes.c_int

        lib.mrq_write_midi_file.argtypes = [
            ctypes.c_char_p,
            ctypes.c_double,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.POINTER(MrqMidiNoteC),
            ctypes.c_int32,
        ]
        lib.mrq_write_midi_file.restype = ctypes.c_int

    @property
    def version(self) -> str:
        return self._lib.mrq_dsp_version().decode("utf-8")

    @staticmethod
    def _ensure_interleaved_2d(audio: np.ndarray) -> Tuple[np.ndarray, int, int]:
        """Returns contiguous float32 array of shape (frames, channels)."""
        arr = np.asarray(audio, dtype=np.float32)
        if arr.ndim == 1:
            arr = arr[:, np.newaxis]
        arr = np.ascontiguousarray(arr, dtype=np.float32)
        return arr, int(arr.shape[0]), int(arr.shape[1])

    def time_stretch(
        self,
        audio: np.ndarray,
        sample_rate: int,
        speed_ratio: float,
        fft_size: int = 2048,
        hop_factor: int = 4,
    ) -> np.ndarray:
        arr, n_frames, channels = self._ensure_interleaved_2d(audio)
        out_ptr = ctypes.POINTER(ctypes.c_float)()
        out_frames = ctypes.c_int32(0)

        rc = self._lib.mrq_time_stretch_f32(
            arr.ctypes.data_as(ctypes.POINTER(ctypes.c_float)),
            n_frames,
            channels,
            int(sample_rate),
            float(speed_ratio),
            int(fft_size),
            int(hop_factor),
            ctypes.byref(out_ptr),
            ctypes.byref(out_frames),
        )
        if rc != 0:
            raise RuntimeError(f"mrq_time_stretch_f32 failed with code {rc}")
        try:
            total = out_frames.value * channels
            result = np.ctypeslib.as_array(out_ptr, shape=(total,)).copy()
            return result.reshape((out_frames.value, channels))
        finally:
            self._lib.mrq_free_buffer(out_ptr)

    def pitch_shift(
        self,
        audio: np.ndarray,
        sample_rate: int,
        semitones: float = 0.0,
        cents: float = 0.0,
    ) -> np.ndarray:
        arr, n_frames, channels = self._ensure_interleaved_2d(audio)
        out_ptr = ctypes.POINTER(ctypes.c_float)()
        out_frames = ctypes.c_int32(0)

        rc = self._lib.mrq_pitch_shift_f32(
            arr.ctypes.data_as(ctypes.POINTER(ctypes.c_float)),
            n_frames,
            channels,
            int(sample_rate),
            float(semitones),
            float(cents),
            ctypes.byref(out_ptr),
            ctypes.byref(out_frames),
        )
        if rc != 0:
            raise RuntimeError(f"mrq_pitch_shift_f32 failed with code {rc}")
        try:
            total = out_frames.value * channels
            result = np.ctypeslib.as_array(out_ptr, shape=(total,)).copy()
            return result.reshape((out_frames.value, channels))
        finally:
            self._lib.mrq_free_buffer(out_ptr)

    def time_and_pitch(
        self,
        audio: np.ndarray,
        sample_rate: int,
        speed_ratio: float = 1.0,
        semitones: float = 0.0,
        cents: float = 0.0,
    ) -> np.ndarray:
        arr, n_frames, channels = self._ensure_interleaved_2d(audio)
        out_ptr = ctypes.POINTER(ctypes.c_float)()
        out_frames = ctypes.c_int32(0)

        rc = self._lib.mrq_time_and_pitch_f32(
            arr.ctypes.data_as(ctypes.POINTER(ctypes.c_float)),
            n_frames,
            channels,
            int(sample_rate),
            float(speed_ratio),
            float(semitones),
            float(cents),
            ctypes.byref(out_ptr),
            ctypes.byref(out_frames),
        )
        if rc != 0:
            raise RuntimeError(f"mrq_time_and_pitch_f32 failed with code {rc}")
        try:
            total = out_frames.value * channels
            result = np.ctypeslib.as_array(out_ptr, shape=(total,)).copy()
            return result.reshape((out_frames.value, channels))
        finally:
            self._lib.mrq_free_buffer(out_ptr)

    def compute_waveform_peaks(
        self,
        audio: np.ndarray,
        num_bins: int = 2000,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        arr, n_frames, channels = self._ensure_interleaved_2d(audio)
        out_min = np.zeros(num_bins, dtype=np.float32)
        out_max = np.zeros(num_bins, dtype=np.float32)
        out_rms = np.zeros(num_bins, dtype=np.float32)

        rc = self._lib.mrq_compute_waveform_peaks_f32(
            arr.ctypes.data_as(ctypes.POINTER(ctypes.c_float)),
            n_frames,
            channels,
            int(num_bins),
            out_min.ctypes.data_as(ctypes.POINTER(ctypes.c_float)),
            out_max.ctypes.data_as(ctypes.POINTER(ctypes.c_float)),
            out_rms.ctypes.data_as(ctypes.POINTER(ctypes.c_float)),
        )
        if rc != 0:
            raise RuntimeError(f"mrq_compute_waveform_peaks_f32 failed with code {rc}")
        return out_min, out_max, out_rms

    def compute_spectrogram(
        self,
        mono_audio: np.ndarray,
        sample_rate: int,
        fft_size: int = 2048,
        hop_size: int = 512,
        log_freq_bins: int = 128,
        min_freq: float = 32.7,
        max_freq: float = 8000.0,
    ) -> np.ndarray:
        mono = np.ascontiguousarray(mono_audio, dtype=np.float32).reshape(-1)
        out_frames = ctypes.c_int32(0)
        out_bins = ctypes.c_int32(0)
        out_ptr = ctypes.POINTER(ctypes.c_float)()

        rc = self._lib.mrq_compute_spectrogram_f32(
            mono.ctypes.data_as(ctypes.POINTER(ctypes.c_float)),
            int(mono.size),
            int(sample_rate),
            int(fft_size),
            int(hop_size),
            int(log_freq_bins),
            float(min_freq),
            float(max_freq),
            ctypes.byref(out_frames),
            ctypes.byref(out_bins),
            ctypes.byref(out_ptr),
        )
        if rc != 0:
            raise RuntimeError(f"mrq_compute_spectrogram_f32 failed with code {rc}")
        try:
            total = out_frames.value * out_bins.value
            mat = np.ctypeslib.as_array(out_ptr, shape=(total,)).copy()
            return mat.reshape((out_frames.value, out_bins.value))
        finally:
            self._lib.mrq_free_buffer(out_ptr)

    def detect_pitch_yin(
        self,
        mono_audio: np.ndarray,
        sample_rate: int,
        frame_size: int = 2048,
        hop_size: int = 512,
        min_freq: float = 40.0,
        max_freq: float = 2000.0,
        threshold: float = 0.15,
    ) -> Tuple[np.ndarray, np.ndarray]:
        mono = np.ascontiguousarray(mono_audio, dtype=np.float32).reshape(-1)
        out_frames = ctypes.c_int32(0)
        freqs_ptr = ctypes.POINTER(ctypes.c_float)()
        confs_ptr = ctypes.POINTER(ctypes.c_float)()

        rc = self._lib.mrq_detect_pitch_yin_f32(
            mono.ctypes.data_as(ctypes.POINTER(ctypes.c_float)),
            int(mono.size),
            int(sample_rate),
            int(frame_size),
            int(hop_size),
            float(min_freq),
            float(max_freq),
            float(threshold),
            ctypes.byref(out_frames),
            ctypes.byref(freqs_ptr),
            ctypes.byref(confs_ptr),
        )
        if rc != 0:
            raise RuntimeError(f"mrq_detect_pitch_yin_f32 failed with code {rc}")
        try:
            n = out_frames.value
            freqs = np.ctypeslib.as_array(freqs_ptr, shape=(n,)).copy()
            confs = np.ctypeslib.as_array(confs_ptr, shape=(n,)).copy()
            return freqs, confs
        finally:
            self._lib.mrq_free_buffer(freqs_ptr)
            self._lib.mrq_free_buffer(confs_ptr)

    def compute_onset_envelope(
        self,
        mono_audio: np.ndarray,
        sample_rate: int,
        fft_size: int = 2048,
        hop_size: int = 512,
    ) -> np.ndarray:
        mono = np.ascontiguousarray(mono_audio, dtype=np.float32).reshape(-1)
        out_frames = ctypes.c_int32(0)
        env_ptr = ctypes.POINTER(ctypes.c_float)()

        rc = self._lib.mrq_compute_onset_envelope_f32(
            mono.ctypes.data_as(ctypes.POINTER(ctypes.c_float)),
            int(mono.size),
            int(sample_rate),
            int(fft_size),
            int(hop_size),
            ctypes.byref(out_frames),
            ctypes.byref(env_ptr),
        )
        if rc != 0:
            raise RuntimeError(f"mrq_compute_onset_envelope_f32 failed with code {rc}")
        try:
            return np.ctypeslib.as_array(env_ptr, shape=(out_frames.value,)).copy()
        finally:
            self._lib.mrq_free_buffer(env_ptr)

    def write_midi_file(
        self,
        filepath: str | Path,
        notes: List[dict],
        bpm: float = 120.0,
        time_sig_num: int = 4,
        time_sig_den: int = 4,
    ) -> Path:
        out_path = Path(filepath)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        arr_type = MrqMidiNoteC * len(notes)
        c_notes = arr_type()
        for idx, n in enumerate(notes):
            c_notes[idx] = MrqMidiNoteC(
                pitch=int(n["pitch"]),
                start_sec=float(n["start_sec"]),
                duration_sec=float(n["duration_sec"]),
                velocity=int(n.get("velocity", 90)),
                channel=int(n.get("channel", 0)),
            )

        rc = self._lib.mrq_write_midi_file(
            str(out_path).encode("utf-8"),
            float(bpm),
            int(time_sig_num),
            int(time_sig_den),
            c_notes if len(notes) > 0 else None,
            len(notes),
        )
        if rc != 0:
            raise RuntimeError(f"mrq_write_midi_file failed with code {rc}")
        return out_path


_singleton_engine: Optional[NativeDSPEngine] = None


def get_dsp_engine() -> NativeDSPEngine:
    global _singleton_engine
    if _singleton_engine is None:
        _singleton_engine = NativeDSPEngine()
    return _singleton_engine

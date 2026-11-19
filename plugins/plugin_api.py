"""
MRQ Plugin Architecture — Modular extension point for third-party DSP engines
(e.g. optional Rubber Band Library wrapper) and custom music analysis plugins.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Dict, List, Type
import numpy as np


class MRQAudioPlugin(ABC):
    """Base interface for pluggable DSP processors."""

    name: str = "unnamed-plugin"
    version: str = "1.0.0"
    category: str = "dsp"  # dsp | analysis | separation | export
    license_name: str = "MIT"

    @abstractmethod
    def process(self, audio: np.ndarray, sample_rate: int, **params) -> np.ndarray:
        """Processes float32 PCM audio (frames, channels) and returns processed audio."""


class PluginRegistry:
    """Thread-safe registry for dynamically loaded MRQ plugins."""

    def __init__(self) -> None:
        self._plugins: Dict[str, MRQAudioPlugin] = {}

    def register(self, plugin: MRQAudioPlugin) -> None:
        self._plugins[plugin.name] = plugin

    def get(self, name: str) -> MRQAudioPlugin:
        if name not in self._plugins:
            raise KeyError(f"Plugin '{name}' não registrado")
        return self._plugins[name]

    def list_plugins(self) -> List[Dict[str, str]]:
        return [
            {
                "name": p.name,
                "version": p.version,
                "category": p.category,
                "license": p.license_name,
            }
            for p in self._plugins.values()
        ]


class BuiltinWarmEQPlugin(MRQAudioPlugin):
    """Built-in gentle transcription clarity shelf filter (boosts presence 1.5–4 kHz)."""

    name = "mrq-transcription-clarity"
    version = "1.0.0"
    category = "dsp"
    license_name = "MIT"

    def process(self, audio: np.ndarray, sample_rate: int, **params) -> np.ndarray:
        from scipy.signal import butter, sosfilt

        gain_db = float(params.get("presence_db", 3.0))
        if abs(gain_db) < 0.1 or sample_rate < 12000:
            return audio
        sos = butter(2, [1200.0 / (sample_rate * 0.5), 4200.0 / (sample_rate * 0.5)], btype="band", output="sos")
        band = sosfilt(sos, audio, axis=0)
        scale = (10.0 ** (gain_db / 20.0)) - 1.0
        out = np.clip(audio + band * scale, -1.0, 1.0).astype(np.float32)
        return out


registry = PluginRegistry()
registry.register(BuiltinWarmEQPlugin())

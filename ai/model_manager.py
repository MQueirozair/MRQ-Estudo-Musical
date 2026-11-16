"""
Offline AI Model Manager for MRQ Estudo Musical.
Handles catalog inspection, compatibility checks (ONNX Runtime / RAM),
on-demand downloading with progress, SHA-256 verification, installation and removal.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import threading
import urllib.request
from pathlib import Path
from typing import Callable, Dict, List, Optional

import onnxruntime as ort
import psutil


class ModelManager:
    def __init__(self, models_dir: str | Path) -> None:
        self.models_dir = Path(models_dir)
        self.manifest_path = self.models_dir / "manifest.json"
        self.weights_dir = self.models_dir / "weights"
        self.weights_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._download_state: Dict[str, Dict] = {}

    def _load_manifest(self) -> List[Dict]:
        if not self.manifest_path.exists():
            return []
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("models", [])

    def runtime_info(self) -> Dict:
        vm = psutil.virtual_memory()
        providers = ort.get_available_providers()
        return {
            "onnxruntime_version": ort.__version__,
            "execution_providers": providers,
            "gpu_available": any("CUDA" in p or "Dml" in p or "CoreML" in p for p in providers),
            "total_ram_mb": int(vm.total / (1024 * 1024)),
            "available_ram_mb": int(vm.available / (1024 * 1024)),
            "offline_mode_ready": True,
        }

    def list_models(self) -> List[Dict]:
        rt = self.runtime_info()
        models = []
        for entry in self._load_manifest():
            mid = entry["id"]
            weight_path = self.weights_dir / entry["filename"]
            installed = weight_path.exists() and weight_path.stat().st_size > 1024
            actual_size_mb = round(weight_path.stat().st_size / (1024 * 1024), 2) if installed else 0.0

            with self._lock:
                dl = self._download_state.get(mid, {})

            status = "installed" if installed else dl.get("status", "available")
            compatible = rt["total_ram_mb"] >= int(entry.get("min_ram_mb", 256))
            models.append(
                {
                    **entry,
                    "status": status,
                    "installed": installed,
                    "local_path": str(weight_path) if installed else None,
                    "installed_size_mb": actual_size_mb,
                    "compatible": compatible,
                    "compatibility_note": (
                        "Compatível com este dispositivo (ONNX Runtime CPU/Local)"
                        if compatible
                        else f"Requer ao menos {entry.get('min_ram_mb')} MB de RAM"
                    ),
                    "download_progress": dl.get("progress", 100.0 if installed else 0.0),
                    "error": dl.get("error"),
                    "requires_internet_to_download": not installed,
                }
            )
        return models

    def get_model_path(self, model_id: str) -> Optional[Path]:
        for entry in self._load_manifest():
            if entry["id"] == model_id:
                p = self.weights_dir / entry["filename"]
                if p.exists() and p.stat().st_size > 1024:
                    return p
        return None

    def validate_onnx(self, path: Path) -> bool:
        """Verifies that a downloaded file is a real loadable ONNX model."""
        try:
            sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
            _ = sess.get_inputs()
            return True
        except Exception:
            return False

    def download_model(
        self,
        model_id: str,
        progress_cb: Optional[Callable[[float], None]] = None,
    ) -> Dict:
        """Downloads and validates a model into models/weights/. Requires internet access."""
        target_entry = None
        for entry in self._load_manifest():
            if entry["id"] == model_id:
                target_entry = entry
                break
        if target_entry is None:
            raise ValueError(f"Modelo desconhecido: {model_id}")

        url = target_entry.get("download_url")
        if not url:
            raise ValueError(f"Modelo '{model_id}' não possui URL de download direto configurada.")

        dest = self.weights_dir / target_entry["filename"]
        tmp = dest.with_suffix(dest.suffix + ".part")

        with self._lock:
            self._download_state[model_id] = {"status": "downloading", "progress": 0.0, "error": None}

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "MRQ-Estudo-Musical/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                content_type = resp.headers.get("Content-Type", "")
                if "text/html" in content_type.lower():
                    raise RuntimeError(
                        "A URL do modelo aponta para uma página de release (HTML). "
                        f"Baixe manualmente o arquivo '{target_entry['filename']}' em {url} "
                        f"e coloque em {self.weights_dir}."
                    )
                total = int(resp.headers.get("Content-Length", "0") or 0)
                downloaded = 0
                sha = hashlib.sha256()

                with open(tmp, "wb") as out:
                    while True:
                        chunk = resp.read(65536)
                        if not chunk:
                            break
                        out.write(chunk)
                        sha.update(chunk)
                        downloaded += len(chunk)
                        pct = (100.0 * downloaded / total) if total > 0 else 50.0
                        with self._lock:
                            self._download_state[model_id]["progress"] = round(min(99.0, pct), 1)
                        if progress_cb:
                            progress_cb(pct)

            expected_sha = target_entry.get("sha256")
            if expected_sha and sha.hexdigest().lower() != expected_sha.lower():
                raise RuntimeError("Falha na verificação de integridade SHA-256 do modelo baixado.")

            if dest.suffix.lower() == ".onnx" and not self.validate_onnx(tmp):
                raise RuntimeError("Arquivo baixado não é um modelo ONNX válido para o ONNX Runtime.")

            os.replace(tmp, dest)
            with self._lock:
                self._download_state[model_id] = {"status": "installed", "progress": 100.0, "error": None}
            return {"id": model_id, "status": "installed", "local_path": str(dest)}

        except Exception as exc:
            if tmp.exists():
                try:
                    tmp.unlink()
                except OSError:
                    pass
            with self._lock:
                self._download_state[model_id] = {"status": "error", "progress": 0.0, "error": str(exc)}
            raise

    def install_local_file(self, model_id: str, source_file: str | Path) -> Dict:
        """Installs a user-supplied local .onnx file into the managed weights folder."""
        src = Path(source_file)
        if not src.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {src}")
        target_entry = next((m for m in self._load_manifest() if m["id"] == model_id), None)
        if not target_entry:
            raise ValueError(f"Modelo desconhecido: {model_id}")

        dest = self.weights_dir / target_entry["filename"]
        if dest.suffix.lower() == ".onnx" and not self.validate_onnx(src):
            raise ValueError("O arquivo selecionado não é um modelo ONNX válido.")
        shutil.copy2(src, dest)
        with self._lock:
            self._download_state[model_id] = {"status": "installed", "progress": 100.0, "error": None}
        return {"id": model_id, "status": "installed", "local_path": str(dest)}

    def remove_model(self, model_id: str) -> bool:
        target_entry = next((m for m in self._load_manifest() if m["id"] == model_id), None)
        if not target_entry:
            return False
        dest = self.weights_dir / target_entry["filename"]
        removed = False
        if dest.exists():
            dest.unlink()
            removed = True
        with self._lock:
            self._download_state.pop(model_id, None)
        return removed

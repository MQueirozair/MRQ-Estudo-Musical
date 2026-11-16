"""
Smoke test for the frozen PyInstaller `mrq-engine` executable.
Launches the exact packaged binary with MRQ_DSP_LIB & MRQ_DATA_DIR (just like Electron),
and verifies /api/health, UI HTML (/), /api/projects, /waveform and /audio Range 206.
Fails the CI build immediately if the packaged binary crashes or fails to boot.
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: python scripts/smoke_test_engine.py <mrq-engine-exe> <dsp-lib-path>")
        return 2

    engine_exe = Path(sys.argv[1]).resolve()
    dsp_lib = Path(sys.argv[2]).resolve()
    if not engine_exe.exists():
        print(f"ERROR: engine executable not found: {engine_exe}")
        return 1
    if not dsp_lib.exists():
        print(f"ERROR: DSP library not found: {dsp_lib}")
        return 1

    port = _free_port()
    with tempfile.TemporaryDirectory(prefix="mrq_smoke_") as tmpdir:
        env = os.environ.copy()
        env["MRQ_HOST"] = "127.0.0.1"
        env["MRQ_PORT"] = str(port)
        env["MRQ_DATA_DIR"] = tmpdir
        env["MRQ_DSP_LIB"] = str(dsp_lib)
        env["PYTHONUNBUFFERED"] = "1"

        print(f"[smoke] Launching {engine_exe} on 127.0.0.1:{port} ...")
        t0 = time.perf_counter()
        proc = subprocess.Popen(
            [str(engine_exe)],
            cwd=str(engine_exe.parent),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        try:
            deadline = time.time() + 45.0
            base = f"http://127.0.0.1:{port}"
            ready = False
            while time.time() < deadline:
                if proc.poll() is not None:
                    out = proc.stdout.read() if proc.stdout else ""
                    print(f"[smoke] FATAL: mrq-engine exited prematurely with code {proc.returncode}!\n{out}")
                    for line in out.splitlines()[-25:]:
                        print(f"::error::[smoke] {line}")
                    return 1
                try:
                    with urllib.request.urlopen(f"{base}/api/health", timeout=2.0) as resp:
                        if resp.status == 200:
                            health = json.loads(resp.read().decode("utf-8"))
                            print(f"[smoke] /api/health OK in {time.perf_counter() - t0:.2f}s -> DSP {health['dsp']['dsp_version']}")
                            ready = True
                            break
                except Exception:
                    time.sleep(0.3)

            if not ready:
                print("[smoke] FATAL: Timed out waiting for /api/health!")
                proc.terminate()
                out = proc.stdout.read() if proc.stdout else ""
                print(out)
                return 1

            # Check UI HTML
            with urllib.request.urlopen(f"{base}/", timeout=5.0) as resp:
                html = resp.read().decode("utf-8")
                assert resp.status == 200 and "MRQ Estudo Musical" in html, "UI HTML inválido!"
                print(f"[smoke] GET / OK ({len(html)} bytes)")

            # Check Demo Project seeded in SQLite
            with urllib.request.urlopen(f"{base}/api/projects", timeout=5.0) as resp:
                projs = json.loads(resp.read().decode("utf-8"))["projects"]
                assert len(projs) >= 1, "Projeto demo não foi inicializado!"
                pid = projs[0]["id"]
                print(f"[smoke] GET /api/projects OK (demo id={pid})")

            # Check Waveform C++17 DSP
            with urllib.request.urlopen(f"{base}/api/projects/{pid}/waveform?bins=120", timeout=10.0) as resp:
                wf = json.loads(resp.read().decode("utf-8"))
                assert wf["bins"] == 120 and len(wf["max"]) == 120
                print(f"[smoke] GET /waveform OK ({wf['bins']} bins)")

            # Check Time-Stretched + Pitch-Shifted Audio Range 206
            req = urllib.request.Request(
                f"{base}/api/projects/{pid}/audio?speed=0.75&semitones=-2&cents=0",
                headers={"Range": "bytes=0-1023"},
            )
            with urllib.request.urlopen(req, timeout=20.0) as resp:
                chunk = resp.read()
                assert resp.status == 206 and chunk[:4] == b"RIFF" and len(chunk) == 1024
                print(f"[smoke] GET /audio Range 206 (75%, -2st) OK ({len(chunk)} bytes RIFF)")

            print("[smoke] ALL FROZEN ENGINE SMOKE CHECKS PASSED!")
            return 0
        finally:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=5.0)
                except subprocess.TimeoutExpired:
                    proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())

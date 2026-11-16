#!/usr/bin/env bash
# macOS Build Script (.app + .dmg for Apple Silicon arm64 with Universal libmrq_dsp.dylib)
# Must be executed on macOS (Xcode Command Line Tools installed) or GitHub Actions macos-latest runner.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "=== [1/5] Compilando Núcleo C++17 DSP Universal (arm64 + x86_64) ==="
mkdir -p core/build
clang++ -std=c++17 -O3 -arch arm64 -dynamiclib -DMRQ_DSP_EXPORTS -Icore/include \
  core/time_stretch/phase_vocoder.cpp \
  core/pitch_shift/pitch_shifter.cpp \
  core/waveform/waveform_peaks.cpp \
  core/dsp/spectrogram.cpp \
  core/midi/midi_writer.cpp \
  core/audio_engine/mrq_dsp_api.cpp \
  -install_name @rpath/libmrq_dsp.dylib \
  -o core/build/libmrq_dsp_arm64.dylib

clang++ -std=c++17 -O3 -arch x86_64 -dynamiclib -DMRQ_DSP_EXPORTS -Icore/include \
  core/time_stretch/phase_vocoder.cpp \
  core/pitch_shift/pitch_shifter.cpp \
  core/waveform/waveform_peaks.cpp \
  core/dsp/spectrogram.cpp \
  core/midi/midi_writer.cpp \
  core/audio_engine/mrq_dsp_api.cpp \
  -install_name @rpath/libmrq_dsp.dylib \
  -o core/build/libmrq_dsp_x86_64.dylib

lipo -create core/build/libmrq_dsp_arm64.dylib core/build/libmrq_dsp_x86_64.dylib \
  -output core/build/libmrq_dsp.dylib
rm -f core/build/libmrq_dsp_arm64.dylib core/build/libmrq_dsp_x86_64.dylib
file core/build/libmrq_dsp.dylib

# Run native C++ test suite on macOS
clang++ -std=c++17 -O3 -Icore/include core/tests/test_dsp_cpp.cpp \
  -Lcore/build -lmrq_dsp -Wl,-rpath,@executable_path -o core/build/test_dsp_cpp
./core/build/test_dsp_cpp

echo "=== [2/5] Compilando Interface MRQ Studio ==="
npm --prefix apps/studio ci
npm --prefix apps/studio run build

echo "=== [3/5] Empacotando Motor Local (--onedir para boot instantâneo) ==="
rm -rf apps/desktop/backend-dist
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt pyinstaller
pyinstaller --noconfirm --onedir --name mrq-engine \
  --paths . \
  --add-data "database/schema.sql:database" \
  --add-data "models/manifest.json:models" \
  --add-data "app.config.json:." \
  --add-data "apps/studio/dist:apps/studio/dist" \
  --collect-all av \
  --collect-binaries onnxruntime \
  --collect-data onnxruntime \
  --collect-submodules onnxruntime.capi \
  --collect-all reportlab \
  --collect-all mido \
  --collect-submodules scipy.signal \
  --collect-submodules scipy.ndimage \
  --hidden-import scripts.generate_demo_audio \
  --hidden-import uvicorn.logging \
  --hidden-import uvicorn.loops.auto \
  --hidden-import uvicorn.protocols.http.auto \
  --hidden-import uvicorn.protocols.websockets.auto \
  --hidden-import uvicorn.lifespan.on \
  --hidden-import multipart \
  --distpath "apps/desktop/backend-dist" \
  backend/main.py

echo "=== [4/5] Teste de Boot Real do mrq-engine empacotado ==="
python3 scripts/smoke_test_engine.py "apps/desktop/backend-dist/mrq-engine/mrq-engine" "core/build/libmrq_dsp.dylib"

echo "=== [5/5] Gerando .APP e .DMG ==="
if [ -z "${CSC_LINK:-}" ]; then
  export CSC_IDENTITY_AUTO_DISCOVERY=false
fi
npm --prefix apps/desktop install
npm --prefix apps/desktop run dist:mac

ls -lh apps/desktop/release/

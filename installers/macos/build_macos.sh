#!/usr/bin/env bash
# macOS Universal Build Script (.app + .dmg for Apple Silicon arm64 & Intel x86_64)
# Must be executed on macOS (Xcode Command Line Tools installed) or GitHub Actions macos-14 runner.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "=== [1/4] Compilando Núcleo C++17 DSP Universal (arm64 + x86_64) ==="
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
file core/build/libmrq_dsp.dylib

echo "=== [2/4] Compilando Interface MRQ Studio ==="
npm --prefix apps/studio ci
npm --prefix apps/studio run build

echo "=== [3/4] Empacotando Motor Local (PyInstaller) ==="
python3 -m pip install -r requirements.txt pyinstaller
pyinstaller --noconfirm --onefile --name mrq-engine \
  --add-data "database/schema.sql:database" \
  --add-data "models/manifest.json:models" \
  --add-data "app.config.json:." \
  --add-data "apps/studio/dist:apps/studio/dist" \
  --distpath "apps/desktop/backend-dist" \
  backend/main.py

echo "=== [4/4] Gerando .APP e .DMG (Assinatura/Notarização automática se APPLE_ID presente) ==="
npm --prefix apps/desktop ci
npm --prefix apps/desktop run dist:mac

ls -lh apps/desktop/release/

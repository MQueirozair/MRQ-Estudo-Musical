# PowerShell Build Script — Windows x64 (.exe NSIS + .msi)
# Must be executed on a Windows x64 machine or GitHub Actions windows-latest runner.
$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path "$PSScriptRoot\..\.."
Set-Location $RepoRoot

Write-Host "=== [1/4] Compilando Nucleo C++17 DSP (mrq_dsp.dll) ===" -ForegroundColor Cyan
cmake -S core -B core/build -A x64
cmake --build core/build --config Release
Copy-Item "core/build/Release/mrq_dsp.dll" "core/build/mrq_dsp.dll" -Force
& "core/build/Release/test_dsp_cpp.exe"

Write-Host "=== [2/4] Compilando Interface MRQ Studio (Vite/React) ===" -ForegroundColor Cyan
Push-Location apps/studio
npm ci
npm run build
Pop-Location

Write-Host "=== [3/4] Empacotando Motor Local Python/FFmpeg/ONNX (PyInstaller) ===" -ForegroundColor Cyan
python -m pip install -r requirements.txt pyinstaller
pyinstaller --noconfirm --onefile --name mrq-engine `
  --add-data "database/schema.sql;database" `
  --add-data "models/manifest.json;models" `
  --add-data "app.config.json;." `
  --add-data "apps/studio/dist;apps/studio/dist" `
  --distpath "apps/desktop/backend-dist" `
  backend/main.py

Write-Host "=== [4/4] Gerando Instaladores Windows (.EXE NSIS + .MSI) ===" -ForegroundColor Cyan
Push-Location apps/desktop
npm ci
npm run dist:win
Pop-Location

Write-Host "=== CONCLUIDO! Artefatos em apps/desktop/release/ ===" -ForegroundColor Green
Get-ChildItem apps/desktop/release/

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
if ($LASTEXITCODE -ne 0) { throw "test_dsp_cpp.exe falhou com codigo $LASTEXITCODE" }

Write-Host "=== [2/4] Compilando Interface MRQ Studio (Vite/React) ===" -ForegroundColor Cyan
Push-Location apps/studio
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci falhou em apps/studio" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build falhou em apps/studio" }
Pop-Location

Write-Host "=== [3/4] Empacotando Motor Local Python/FFmpeg/ONNX (PyInstaller) ===" -ForegroundColor Cyan
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller
pyinstaller --noconfirm --onefile --name mrq-engine `
  --paths . `
  --add-data "database/schema.sql;database" `
  --add-data "models/manifest.json;models" `
  --add-data "app.config.json;." `
  --add-data "apps/studio/dist;apps/studio/dist" `
  --collect-all av `
  --collect-all reportlab `
  --collect-all mido `
  --collect-binaries onnxruntime `
  --hidden-import uvicorn.logging `
  --hidden-import uvicorn.loops.auto `
  --hidden-import uvicorn.protocols.http.auto `
  --hidden-import uvicorn.protocols.websockets.auto `
  --hidden-import uvicorn.lifespan.on `
  --hidden-import multipart `
  --distpath "apps/desktop/backend-dist" `
  backend/main.py
if ($LASTEXITCODE -ne 0) { throw "PyInstaller falhou" }

Write-Host "=== [4/4] Gerando Instaladores Windows (.EXE NSIS + .MSI) ===" -ForegroundColor Cyan
Push-Location apps/desktop
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install falhou em apps/desktop" }
npm run dist:win
if ($LASTEXITCODE -ne 0) { throw "electron-builder dist:win falhou" }
Pop-Location

Write-Host "=== CONCLUIDO! Artefatos em apps/desktop/release/ ===" -ForegroundColor Green
Get-ChildItem apps/desktop/release/

# PowerShell Build Script — Windows x64 (.exe NSIS + .msi)
# Must be executed on a Windows x64 machine or GitHub Actions windows-latest runner.
$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path "$PSScriptRoot\..\.."
Set-Location $RepoRoot

Write-Host "=== [1/5] Compilando Nucleo C++17 DSP Static-CRT (mrq_dsp.dll) ===" -ForegroundColor Cyan
if (Test-Path "core/build") { Remove-Item -Recurse -Force "core/build" }
cmake -S core -B core/build -A x64
if ($LASTEXITCODE -ne 0) { throw "CMake configure falhou" }
cmake --build core/build --config Release
if ($LASTEXITCODE -ne 0) { throw "CMake build falhou" }
Copy-Item "core/build/Release/mrq_dsp.dll" "core/build/mrq_dsp.dll" -Force
& "core/build/Release/test_dsp_cpp.exe"
if ($LASTEXITCODE -ne 0) { throw "test_dsp_cpp.exe falhou com codigo $LASTEXITCODE" }

Write-Host "=== [2/5] Compilando Interface MRQ Studio (Vite/React) ===" -ForegroundColor Cyan
Push-Location apps/studio
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci falhou em apps/studio" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build falhou em apps/studio" }
Pop-Location

Write-Host "=== [3/5] Empacotando Motor Local Python/FFmpeg/ONNX (--onedir para boot instantaneo) ===" -ForegroundColor Cyan
if (Test-Path "apps/desktop/backend-dist") { Remove-Item -Recurse -Force "apps/desktop/backend-dist" }
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller
pyinstaller --noconfirm --onedir --name mrq-engine `
  --paths . `
  --add-data "database/schema.sql;database" `
  --add-data "models/manifest.json;models" `
  --add-data "app.config.json;." `
  --add-data "apps/studio/dist;apps/studio/dist" `
  --collect-all av `
  --collect-binaries onnxruntime `
  --collect-data onnxruntime `
  --collect-submodules onnxruntime.capi `
  --collect-all reportlab `
  --collect-all mido `
  --collect-submodules scipy.signal `
  --collect-submodules scipy.ndimage `
  --hidden-import scripts.generate_demo_audio `
  --hidden-import uvicorn.logging `
  --hidden-import uvicorn.loops.auto `
  --hidden-import uvicorn.protocols.http.auto `
  --hidden-import uvicorn.protocols.websockets.auto `
  --hidden-import uvicorn.lifespan.on `
  --hidden-import multipart `
  --distpath "apps/desktop/backend-dist" `
  backend/main.py
if ($LASTEXITCODE -ne 0) { throw "PyInstaller falhou" }

Write-Host "=== [4/5] Teste de Boot Real do mrq-engine.exe empacotado ===" -ForegroundColor Cyan
python scripts/smoke_test_engine.py "apps/desktop/backend-dist/mrq-engine/mrq-engine.exe" "core/build/mrq_dsp.dll"
if ($LASTEXITCODE -ne 0) { throw "Smoke test do mrq-engine.exe falhou!" }

Write-Host "=== [5/5] Gerando Instaladores Windows (.EXE NSIS + .MSI) ===" -ForegroundColor Cyan
Push-Location apps/desktop
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install falhou em apps/desktop" }
npm run dist:win
if ($LASTEXITCODE -ne 0) { throw "electron-builder dist:win falhou" }
Pop-Location

Write-Host "=== CONCLUIDO! Artefatos em apps/desktop/release/ ===" -ForegroundColor Green
Get-ChildItem apps/desktop/release/

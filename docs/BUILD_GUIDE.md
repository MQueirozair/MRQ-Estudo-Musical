# Guia de Compilação Multiplataforma — MRQ Estudo Musical

Este documento detalha como compilar o núcleo C++17 DSP, o motor local, a interface gráfica e os instaladores oficiais em cada sistema operacional suportado.

> **Regra de Integridade Multiplataforma**: Cada instalador nativo deve ser gerado em sua plataforma/runner compatível (Windows x64 para `.exe`/`.msi`, macOS para `.app`/`.dmg`, Android SDK/NDK para `.apk`/`.aab`). O repositório já inclui o workflow completo em `.github/workflows/release-installers.yml` que executa esses builds nativos automaticamente no GitHub Actions.

---

## 1. Linux (x86_64) — Compilação Local e Testes

```bash
# 1. Configurar virtualenv Python, compilar libmrq_dsp.so e buildar UI
bash scripts/setup.sh

# 2. Executar todos os testes (C++17 + Python/IA/API/Memória)
make test

# 3. Iniciar aplicativo localmente
make run
```

Para gerar Linux `.AppImage`:
```bash
.venv/bin/pip install pyinstaller
.venv/bin/pyinstaller --noconfirm --onefile --name mrq-engine \
  --add-data "database/schema.sql:database" \
  --add-data "models/manifest.json:models" \
  --add-data "app.config.json:." \
  --add-data "apps/studio/dist:apps/studio/dist" \
  --distpath "apps/desktop/backend-dist" \
  backend/main.py
npm --prefix apps/desktop install
npm --prefix apps/desktop run dist:linux
```

---

## 2. Windows (x64) — Instalador `.EXE` (NSIS) e `.MSI`

### Pré-requisitos no Windows
- Visual Studio 2022 Build Tools (Desktop development with C++) + CMake 3.20+
- Python 3.11+ (64-bit)
- Node.js 20+ (LTS)
- Opcional: NSIS 3.x caso deseje rodar `installers/windows/mrq_installer.nsi` manualmente

### Compilação Automatizada (PowerShell)
```powershell
.\installers\windows\build_windows.ps1
```

Artefatos gerados em `apps/desktop/release/`:
- `MRQ-Estudo-Musical-Setup-1.0.0-x64.exe` (Instalador NSIS com atalhos na Área de Trabalho, Menu Iniciar e desinstalador)
- `MRQ-Estudo-Musical-Setup-1.0.0-x64.msi` (Pacote corporativo MSI)

---

## 3. macOS (Universal: Apple Silicon `arm64` + Intel `x86_64`) — `.APP` e `.DMG`

### Pré-requisitos no macOS
- macOS 13+ com Xcode Command Line Tools (`xcode-select --install`)
- Python 3.11+ (Universal2 recomendado)
- Node.js 20+
- Opcional para assinatura/notarização: variáveis de ambiente `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.

### Compilação Automatizada
```bash
bash installers/macos/build_macos.sh
```

Artefatos gerados em `apps/desktop/release/`:
- `MRQ-Estudo-Musical-1.0.0-universal.dmg`
- `MRQ-Estudo-Musical-1.0.0-universal.zip` (contendo `MRQ Estudo Musical.app`)

---

## 4. Android — `.APK` e `.AAB` com C++17 NDK (JNI)

### Pré-requisitos
- JDK 17 (Temurin/OpenJDK)
- Android SDK Platform 35, Build Tools 35.0.0, Android NDK 26.3+ e CMake 3.22.1
- Node.js 20+

### Compilação Automatizada
```bash
bash installers/android/build_android.sh
```

Artefatos gerados em `apps/android/android/app/build/outputs/`:
- `apk/release/app-release.apk` (instalável em celulares e tablets ARM64/ARMv7)
- `bundle/release/app-release.aab` (pronto para publicação na Google Play Store)

Para assinar em produção, exporte `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD` antes de executar o script.

---

## 5. Compilação Automática via GitHub Actions

1. Faça push de uma tag semântica (ex.: `git tag v1.0.0 && git push origin v1.0.0`) ou execute manualmente **Actions → Release — Instaladores Multiplataforma → Run workflow**.
2. O GitHub Actions compila nativamente em paralelo nos runners `windows-latest`, `macos-14` e `ubuntu-latest` e disponibiliza todos os instaladores (`.exe`, `.msi`, `.dmg`, `.apk`, `.aab`, `.AppImage`) nos artefatos da execução.

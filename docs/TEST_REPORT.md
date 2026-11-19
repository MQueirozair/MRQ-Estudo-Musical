# Relatório de Testes Automatizados — MRQ Estudo Musical v1.0.0

- **Data da Execução**: 2026-11-16
- **Ambiente Executado**: Linux x86_64 (Debian 12 Bookworm, GCC/G++ 12.2.0, Python 3.11.2, Node.js 22.22.3, ONNX Runtime 1.32.0, PyAV/FFmpeg 18.1.0)
- **Status Geral**: **48/48 TESTES APROVADOS (100%)** + Build Frontend TypeScript/Vite aprovado sem erros.

---

## 1. Suite Nativa C++17 DSP (`core/tests/test_dsp_cpp.cpp`)

Compilado com `g++ -std=c++17 -O3 -Wall -Wextra -fPIC` (**0 warnings**):

| # | Teste Nativo C++17 | Resultado Medido | Status |
|---|---|---|---|
| 1 | YIN F0 em senoide 440.0 Hz | `440.02 Hz` (erro 0.02 Hz) | PASS |
| 2 | Time Stretching 50% (0.5x) | `176400` frames (exato), pitch `440.02 Hz` | PASS |
| 3 | Time Stretching 150% (1.5x) | `58800` frames (exato), pitch `440.17 Hz` | PASS |
| 4 | Pitch Shift independente +12 st | `88200` frames (duração exata), pitch `880.34 Hz` | PASS |
| 5 | Combinado 75% + (-5 st, +50¢) | `117600` frames, pitch `339.30 Hz` (esperado `339.29 Hz`) | PASS |
| 6 | Waveform Peaks Stereo (min/max/RMS) | `min=-0.600, max=0.600, rms=0.425` | PASS |
| 7 | Espectrograma FFT Logarítmico | `169 frames × 128 bins` finitos em dB | PASS |
| 8 | Envelope de Onsets SuperFlux | `169 frames` normalizados `[0, 1]` | PASS |
| 9 | Escritor Standard MIDI File Type 1 | Header `MThd` e tracks `MTrk` válidos | PASS |

---

## 2. Suite Automatizada Python / IA / API / Memória (`pytest -v tests/`)

**39 testes executados — 39 aprovados em 15.04s**:

| Módulo de Teste | Cobertura Validada | Qtd | Status |
|---|---|---|---|
| `tests/test_dsp_engine.py` | Time stretching em todas as 10 velocidades (25%–200%) preservando afinação; Pitch shifting em 7 intervalos (-12st a +12st e cents) mantendo duração exata; qualidade em voz, piano, baixo e mix completo; waveform & espectrograma FFT | 19 | PASS |
| `tests/test_audio_formats.py` | Codificação, sondagem de metadados e decodificação em **MP3, WAV, M4A, FLAC, AAC, OGG, AIFF** + amostragem em **22050 Hz, 44100 Hz e 48000 Hz** | 10 | PASS |
| `tests/test_ai_analysis.py` | Detecção de BPM (120 BPM e 92 BPM), compasso 4/4, Tap Tempo; Tonalidade & Escala; Notas polifônicas, melodia e baixo; Acordes HMM (Am, F, C, G); Separação de 4 stems com correlação de reconstrução > 0.92; Gerenciador de modelos ONNX | 6 | PASS |
| `tests/test_database_projects.py` | SQLite WAL CRUD completo, loops, marcadores, notas, acordes, autosave, recuperação após falhas, "Salvar Como" (clone), arquivos recentes | 1 | PASS |
| `tests/test_api_integration.py` | Fluxo ponta-a-ponta HTTP: importação multi-arquivo (MP3+FLAC), streaming Range 206 com time-stretch/pitch-shift, análise completa, edição manual de Piano Roll, separação e streaming de stems, exportação real de **MP3, WAV, FLAC, MIDI (validado via `mido`), Notas TXT, Cifras TXT e Relatório PDF (`%PDF-`)** | 1 | PASS |
| `tests/test_performance_memory.py` | Loop de 15 ciclos C++ `time_and_pitch` + `spectrogram` validando ausência de vazamento de memória (crescimento RSS < 40 MB) + extração de waveform de faixa estéreo de 60s em < 500 ms | 2 | PASS |

---

## 3. Compilação da Interface Frontend (`apps/studio`)

- `tsc --noEmit`: **0 erros**
- `vite build`: bundle de produção gerado em `apps/studio/dist/` (`390.80 kB` / `112.41 kB` gzip) em 2.15s.

---

## 4. Verificação de Plataformas & Runners

| Plataforma | Status neste ambiente Linux x86_64 | Como Compilar / Verificar |
|---|---|---|
| Linux (Núcleo C++17 + Backend + UI Web/Studio) | **Compilado e 100% testado localmente** | `make test` e `make run` |
| Windows (`.exe` NSIS / `.msi`) | Scripts (`build_windows.ps1`, `mrq_installer.nsi`) e workflow GitHub Actions (`windows-latest`) prontos; **não compilado/executado nativamente neste sandbox Linux** | Executar `.github/workflows/release-installers.yml` ou `installers/windows/build_windows.ps1` em Windows x64 |
| macOS (`.app` / `.dmg` Universal) | Script (`build_macos.sh`) e workflow GitHub Actions (`macos-14`) prontos; **não compilado/executado nativamente neste sandbox Linux** | Executar `.github/workflows/release-installers.yml` ou `installers/macos/build_macos.sh` em macOS |
| Android (`.apk` / `.aab` + JNI NDK) | Projeto Gradle + CMake NDK + JNI C++17 (`apps/android/`) e workflow GitHub Actions prontos; **não compilado neste sandbox (sem JDK/Android SDK instalados)** | Executar `.github/workflows/release-installers.yml` ou `installers/android/build_android.sh` com Android SDK/NDK |

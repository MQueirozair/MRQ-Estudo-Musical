# MRQ Estudo Musical

> Software comercial multiplataforma de estudo, desaceleração sem perda de afinação, análise harmônica por IA, transcrição MIDI, separação de instrumentos e edição musical — 100% local e offline-first.

[![CI — Build & Testes](.github/workflows/ci.yml)](.github/workflows/ci.yml)
[![Release — Instaladores Multiplataforma](.github/workflows/release-installers.yml)](.github/workflows/release-installers.yml)
![Versão](https://img.shields.io/badge/versão-1.0.0-38BDF8)
![Licença](https://img.shields.io/badge/licença-MIT-22C55E)

---

## Visão Geral

O **MRQ Estudo Musical** transforma o fluxo clássico de transcrição de ouvido (inspirado na ergonomia do TuneTranscriber) em uma estação completa de estudo musical para **Windows, macOS, Android e Linux**:

- **Núcleo DSP Nativo em C++17 (`core/`)**: independente da interface gráfica, compilado com ABI C (`extern "C"`).
  - **Time Stretching Real (25% a 200%)**: Phase Vocoder com travamento de fase (*Laroche-Dolson Identity Phase Locking*) e detecção de transientes — altera o andamento mantendo a afinação original intacta.
  - **Transposição & Afinação Independente**: semitons (`-12` a `+12`), oitavas (`-2` a `+2`) e cents (`-50¢` a `+50¢`) sem alterar a velocidade.
  - **Waveform Multi-Resolução & Espectrograma FFT Real** (escalas linear e logarítmica dB com tooltip de frequência/nota).
  - **Rastreador YIN, Onset SuperFlux e Escritor MIDI SMF Type 1** nativos em C++17.
- **Importação Real Multi-Formato (FFmpeg/PyAV)**: MP3, WAV, M4A, FLAC, AAC, OGG e AIFF, com drag-and-drop e importação múltipla.
- **Loop A/B Profissional + Pré-contagem**: arraste diretamente no waveform, salve múltiplos loops nomeados no SQLite, e configure pré-contagem real com metrônomo (`Off`, `0,5s`, `1s`, `2s`, `3s`, `5s`).
- **Inteligência Artificial & Análise Musical Real (`ai/`)**:
  - **BPM, Batidas, Compasso e Tap Tempo** (SuperFlux + Autocorrelação + Ellis DP Beat Tracker).
  - **Tonalidade & Escalas** (Cromagrama HPSS + Krumhansl-Schmuckler / Temperley) com escore de confiança e aviso transparente de baixa confiança.
  - **Transcrição Polifônica, Melodia e Baixo** (ONNX Basic Pitch opcional + motor offline Multi-Pitch Harmonic Summation + YIN).
  - **Reconhecimento de Acordes (18 qualidades × 12 tônicas + HMM Viterbi)** com edição manual e **diagramas reais em SVG para Violão e Teclado**.
  - **Separação de Instrumentos em 4 Stems (Vocal, Bateria, Baixo, Outros)** via ONNX Runtime ou motor offline Wiener-HPSS + Mid/Side coerente em fase, com mixer multitrack ao vivo (Volume, Mute, Solo, Export).
- **Piano Roll Editável & Exportação Completa**: crie, mova, redimensione, exclua, quantize, transponha e ouça notas sintetizadas; exporte em **MP3, WAV, FLAC, MIDI (`.mid`), Notas TXT, Cifras TXT e Relatório PDF**.
- **Banco de Dados SQLite (WAL) & Gerenciador de Modelos IA Offline**: histórico de projetos, arquivos recentes, marcadores coloridos, anotações, salvamento automático e recuperação após falhas.

---

## Estrutura do Projeto

```
MRQ-Estudo-Musical/
├── app.config.json            # Metadados de versão, plataformas e dependências
├── core/                      # Núcleo C++17 DSP + Motor de Áudio + Exportador
│   ├── include/mrq_dsp.h      # API C pública desacoplada da UI
│   ├── time_stretch/          # Phase Vocoder C++17 com phase-locking
│   ├── pitch_shift/           # Transposição independente + resampling cúbico
│   ├── dsp/                   # FFT Radix-2 e Espectrograma STFT
│   ├── waveform/              # Extrator multi-resolução min/max/RMS
│   ├── midi/                  # Escritor Standard MIDI File (SMF Type 1)
│   └── audio_engine/          # Bridge Python ctypes, FFmpeg/PyAV, Cache e Exportador PDF/MIDI/Audio
├── ai/                        # BPM, Tonalidade, Notas Polifônicas, Acordes HMM, 4 Stems e Model Manager ONNX
├── database/                  # SQLite WAL, CRUD de projetos, Autosave e Crash Recovery
├── backend/                   # API local FastAPI + Range Streaming (desacoplada da UI)
├── plugins/                   # API modular para plugins DSP/Análise
├── apps/
│   ├── studio/                # Interface escura React + TypeScript + Canvas 2D + Web Audio API
│   ├── desktop/               # Empacotamento Electron (Windows EXE/MSI, macOS APP/DMG, Linux AppImage)
│   └── android/               # Projeto Android Capacitor + Gradle + C++17 NDK JNI (APK/AAB)
├── models/                    # Manifesto e instruções de modelos ONNX offline
├── installers/                # Scripts de build Windows (NSIS/PS1), macOS (DMG) e Android (APK/AAB)
├── tests/                     # 39 testes automatizados Python + 9 testes nativos C++17
├── docs/                      # Arquitetura, Guia de Compilação, Manuais e Relatório de Testes
└── .github/workflows/         # CI contínuo e build nativo multiplataforma
```

---

## Início Rápido (Desenvolvimento & Execução Local)

### Pré-requisitos
- Compilador C++17 (`g++` / `clang++` / MSVC)
- Python 3.11+
- Node.js 20+

### Instalação e Execução em 2 comandos

```bash
bash scripts/setup.sh
make run
```

Acesse `http://localhost:8765` (ou inicie o shell Electron com `npm --prefix apps/desktop start`).

### Executar todos os testes (C++17 + Python + IA + API + Performance)

```bash
make test
```

---

## Documentação Completa

- [Arquitetura Técnica Definitiva](docs/ARCHITECTURE.md)
- [Guia de Compilação Multiplataforma (Windows, macOS, Android, Linux)](docs/BUILD_GUIDE.md)
- [Manual de Instalação](docs/INSTALLATION_MANUAL.md)
- [Manual de Utilização](docs/USER_MANUAL.md)
- [Relatório de Testes Automatizados](docs/TEST_REPORT.md)
- [Limitações Conhecidas](docs/KNOWN_LIMITATIONS.md)
- [Modelos de IA Offline](models/README.md)
- [Guia de Contribuição](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Licença

Distribuído sob a licença **MIT** — consulte [LICENSE](LICENSE) para detalhes e avisos de bibliotecas de terceiros.

# Changelog

Todas as mudanças relevantes no **MRQ Estudo Musical** serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.1] - 2026-11-16

### Adicionado
- **Modo Estudo de Vídeos do YouTube (Player Oficial — YouTube IFrame Player API)**:
  - Botão **Link YouTube** na barra superior, no menu *Arquivo → Abrir Vídeo do YouTube...* (`Ctrl+Shift+Y`) e na faixa rápida.
  - Modal de entrada dupla (*Colar Link do YouTube* com pré-visualização instantânea ou *Carregar Arquivo de Áudio Local*).
  - Player 16:9 incorporado via API oficial do YouTube (sem download nem extração de mídia, 100% compatível com os Termos de Serviço).
  - Linha do tempo interativa com zoom (`-` / `ZOOM` / `+`), arraste para criar **Loop A → B** com alças ajustáveis, playhead ao vivo, **Marcas (`M`)** e **Batidas (`B`)** com estimativa automática de BPM.
  - Velocidade preservando o tom de 25% a 200%, pré-contagem com metrônomo Web Audio antes de repetir loops e persistência completa em SQLite.
  - Migração automática e segura de bancos `mrq_projects.db` existentes (`ALTER TABLE` idempotente) + cabeçalho `Referer` no Electron para evitar Erro 153 em embeds.

## [1.0.0] - 2026-11-16

### Adicionado
- **Núcleo DSP C++17 (`core/`)**: biblioteca nativa independente da interface gráfica com API C (`extern "C"`):
  - Time stretching real de 25% a 200% sem alteração de afinação (Phase Vocoder com phase-locking de Laroche-Dolson + preservação de transientes).
  - Transposição de afinação independente da velocidade (semitons, oitavas e cents).
  - Extrator multi-resolução de forma de onda (min/max/RMS).
  - Espectrograma STFT/FFT Radix-2 em escalas linear e logarítmica (dB).
  - Rastreador de pitch YIN, detector de fluxo espectral (onsets) e escritor de Standard MIDI File (SMF Type 1).
- **Motor de Áudio e Formatos (`core/audio_engine/`)**:
  - Importação real via FFmpeg/PyAV: MP3, WAV, M4A, FLAC, AAC, OGG, AIFF.
  - Exportação real: MP3, WAV, FLAC, MIDI (`.mid`), Notas TXT, Cifras TXT e Relatório PDF.
  - Cache de renderizações time-stretch/pitch-shift e gerenciamento de arquivos temporários.
- **Inteligência Artificial & Análise Musical (`ai/`)**:
  - Detecção de BPM, batidas, compasso, pulsação, variações de andamento e Tap Tempo.
  - Detecção de tonalidade maior/menor e escalas (Krumhansl-Schmuckler & Temperley) com escore de confiança.
  - Detecção polifônica de notas (ONNX Basic Pitch quando instalado + motor offline Multi-Pitch Harmonic Summation), linha melódica (YIN) e baixo.
  - Reconhecimento harmônico de acordes (Maior, Menor, dim, aug, sus2, sus4, 7, maj7, m7, m7b5 e extensões) com suavização HMM Viterbi, edição manual e diagramas de violão e teclado.
  - Separação de instrumentos em 4 stems (Vocal, Bateria, Baixo, Outros) via ONNX Runtime ou motor offline Wiener-HPSS + Mid/Side coerente em fase.
  - Gerenciador de modelos de IA offline (status, download, verificação de integridade, remoção).
- **Banco de Dados e Projetos (`database/`)**:
  - Persistência SQLite (WAL) com projetos, histórico, arquivos recentes, loops, marcadores, notas, acordes, stems, anotações, salvamento automático e recuperação após falhas.
- **Interface Profissional Escura (`apps/studio/`)**:
  - Experiência completa inspirada no TuneTranscriber ampliada com Piano Roll editável, Espectrograma FFT, Mixer de Stems, Diagramas de Acordes, Marcadores coloridos e layout responsivo.
- **Multiplataforma e Distribuição (`apps/desktop/`, `apps/android/`, `installers/`, `.github/workflows/`)**:
  - Empacotamento Electron para Windows (NSIS EXE/MSI), macOS (APP/DMG Universal) e Linux (AppImage).
  - Projeto Capacitor + Android Gradle + JNI/NDK para APK e AAB.
  - Workflows GitHub Actions para CI e compilação nativa multiplataforma.

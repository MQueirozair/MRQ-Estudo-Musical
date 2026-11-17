# Changelog

Todas as mudanças relevantes no **MRQ Estudo Musical** serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.3] - 2026-11-17

### Corrigido e Adicionado
- **Captura Estéreo Nativa do Som do Sistema (Windows WASAPI Loopback / macOS ScreenCaptureKit)**:
  - Adicionado `desktopCapturer` + `session.defaultSession.setDisplayMediaRequestHandler({ audio: 'loopback' })` e gerenciador de permissões locais no Electron (`apps/desktop/main.js`), permitindo capturar diretamente o **áudio de saída do computador (Placa de Som / Estéreo)** em 1 clique — sem depender do microfone mudo e sem silenciar os alto-falantes.
  - Novo motor estéreo `MRQAudioCaptureSession` (`apps/studio/src/utils/audioCapture.ts`) com `await audioContext.resume()`, saída `GainNode(0)` sem microfonia/eco, seletor de dispositivos (`enumerateDevices()`), VU meter estéreo L/R em tempo real e proteção contra gravações mudas (`overallPeak < 0.0005` bloqueia salvar WAV mudo e alerta o músico).
  - Novo painel `SystemAudioCaptureBar` integrado logo abaixo do player do YouTube (com gatilhos em 1 clique no player, nas abas de IA/Stems e no modal **Exportar**): ao clicar em **Parar & Gerar Forma de Onda**, o WAV estéreo 16-bit PCM gera imediatamente a **Forma de Onda + Espectrograma FFT** e desbloqueia conversão/exportação em **MP3, WAV e FLAC**, Análise IA, 4 Stems e Pitch Shift ±12st.
  - Corrigido cache-busting na recarga do áudio (`&v=...`) ao recapturar/substituir áudio no mesmo projeto e preservada a duração real do áudio capturado frente ao player do YouTube.

## [1.0.2] - 2026-11-17

### Adicionado
- **Piano Roll & MIDI + Notas & Acordes desbloqueados em Projetos de Vídeo do YouTube**:
  - Edição interativa de notas no Piano Roll (com síntese Web Audio e exportação `.mid`) e progressão de acordes com diagramas de violão/teclado sincronizados ao playhead do vídeo do YouTube (com exportação de Cifras `.txt` e Relatório `.pdf`).
- **Modo Híbrido Vídeo YouTube + Áudio DSP/Stems Sincronizado (`POST /api/audio/import?project_id=...`)**:
  - Botão **Vincular Áudio/Vídeo Local a este Projeto** e gravador integrado **Microfone / Interface de Áudio (WAV 16-bit PCM)** para anexar áudio diretamente ao projeto do YouTube — liberando **IA automática (BPM, Tom, Notas, Acordes)**, **Separação em 4 Stems**, **Waveform + Espectrograma FFT** e **Afinação ±12 st** sincronizados visualmente ao vídeo!
- **Suporte Completo a Links Diretos de Vídeo (`POST /api/projects/video-url`) e Arquivos de Vídeo Locais (`.mp4`, `.webm`, `.mov`, `.mkv`, `.m4v`)**:
  - Player de Vídeo HTML5 sincronizado quadro-a-quadro (`GET /api/projects/{id}/video` com HTTP Range 206) com áudio processado pelo motor C++17 DSP (Time Stretch, Pitch Shift ±12st, IA completa e Mixer de 4 Stems), incluindo proteção SSRF em URLs remotas.

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

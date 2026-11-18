# Changelog

Todas as mudanças relevantes no **MRQ Estudo Musical** serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado
- Configurações locais para exibir painéis e dicas, optar pelo registro de erros da interface e verificar atualizações ao iniciar.
- Download e exclusão do log local da interface; log do motor desktop preservado entre sessões, com rotação na inicialização e acesso pela tela de configurações.
- Espelhamento horizontal de vídeos locais e do YouTube; link para downloads oficiais. Atualizações continuam sendo instaladas manualmente.

### Corrigido
- Comparação de versões de atualização e validação da origem para captura de áudio/tela no desktop.
- O zoom horizontal por teclado e pela barra agora respeita o mesmo limite de 64× da forma de onda, sem diminuir inesperadamente acima de 32×.
- Eventos rápidos de rolagem acumulam o zoom em vez de perder passos; a linha do tempo usa a posição visível efetiva como âncora.
- A trava de proporção do vídeo iguala os eixos ao ser ativada; cancelamentos de ponteiro encerram o arraste e cliques secundários não iniciam operações de arraste.
- Adicionados testes de interface para zoom, trava, reset e escudo do player, executados no CI.

## [1.0.5] - 2026-11-17

### Adicionado e Melhorado
- **Zoom Horizontal (`Ctrl + Scroll`) e Zoom Vertical (`Shift/Alt + Scroll`) na Forma de Onda, Linha do Tempo e Vídeo**:
  - **`WaveformCanvas.tsx`**: listener nativo não-passivo (`{ passive: false }`) para impedir zoom indesejado da janela no Electron/navegador; **`Ctrl + Scroll`** dá Zoom Horizontal (`1.0× – 64.0×`) centralizado exatamente na posição do cursor do mouse; **`Shift + Scroll`** ou **`Alt + Scroll`** dá Zoom Vertical (`0.5× – 5.0×`) ampliando ganho da onda e altura do canvas em tempo real; **`Ctrl + Shift + Scroll`** amplia ambos juntos; controles visuais `H` e `V` sempre visíveis na barra (aceitando scroll direto sobre os botões) + seletor rápido **`Scroll do Mouse: [Auto | Zoom H | Zoom V]`** para uso com uma mão só + arraste com botão do meio para rolar horizontalmente + correção do auto-follow para não puxar a janela de volta ao dar zoom longe do playhead.
  - **`VideoZoomStage.tsx` (aplicado ao Player do YouTube e ao Vídeo Local)**: Zoom Horizontal (`100% – 400%` via `Ctrl + Scroll`), Zoom Vertical (`100% – 400%` via `Shift/Alt + Scroll`), trava opcional de proporção (`H=V` / `H/V Livre`), escudo transparente automático ao segurar `Ctrl`/`Shift`/`Alt` sobre o iframe do YouTube para capturar o scroll sem falhas, arraste para enquadrar mãos/instrumento (`Mover`), seletor rápido **`[Auto | Zoom H | Zoom V | Mover]`**, HUD visual instantâneo e reset `1:1`.
  - **`YouTubeStudyPlayer.tsx`**: linha do tempo interativa também atualizada com Zoom Horizontal (`Ctrl + Scroll`, `1× – 32×`) e Zoom Vertical (`Shift/Alt + Scroll`, altura `64px – 192px`) + seletor rápido de modo do scroll.

## [1.0.4] - 2026-11-17

### Adicionado e Melhorado
- **Conversor Completo de Vídeo → Áudio em 1 Clique (7 Formatos de Áudio + 4 Documentos)**:
  - Desbloqueados **todos os 7 formatos de áudio de saída** no backend, exportador e interface: **MP3 (192 kbps)**, **WAV (PCM 16-bit)**, **FLAC (Lossless)**, **M4A (AAC)**, **OGG (Opus 48 kHz)**, **AAC (ADTS)** e **AIFF (PCM Estúdio)** — somados a **MIDI (.mid)**, **Notas (.txt)**, **Cifras (.txt)** e **Relatório (.pdf)** (11 formatos no total).
  - Novo modo **Capturar Vídeo Completo (0:00 → Fim) & Converter** na barra `SystemAudioCaptureBar`: volta automaticamente o vídeo do YouTube para `0:00`, dá Play em 100%, monitora VU estéreo L/R + barra de progresso, para automaticamente ao final do vídeo, gera a Forma de Onda completa e já baixa o áudio no formato escolhido.
  - Novo conversor em 1 clique no player de vídeos locais (`LocalVideoStage.tsx`) para extrair e baixar instantaneamente o áudio completo de vídeos `.mp4`, `.webm`, `.mov`, `.mkv` e `.m4v` em qualquer um dos 7 formatos.
- **Central de Ajuda Visual Completa com Texto, 4 Imagens Ilustradas e Tabela de Todos os Formatos**:
  - Botão **Ajuda** dedicado na barra superior + modal `HelpModals.tsx` reformulado com 4 ilustrações PT-BR em alta resolução (`apps/studio/public/help/*.png`) com ampliação em tela cheia, guia passo a passo de todo o programa e tabela completa dos 12 formatos de entrada e 11 de saída.
  - `docs/USER_MANUAL.md` atualizado com todas as imagens e tabelas.

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

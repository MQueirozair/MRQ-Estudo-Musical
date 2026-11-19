# Arquitetura Técnica Definitiva — MRQ Estudo Musical

## 1. Análise da Referência Funcional (TuneTranscriber)

A análise detalhada da referência [tunetranscriber.com](https://www.tunetranscriber.com/) identificou os pilares que tornam a ferramenta tão eficaz para músicos que aprendem de ouvido:

| Recurso na Referência | Como o MRQ Estudo Musical Implementa e Amplia |
|---|---|
| Desaceleração 25%–150% mantendo a afinação | **Ampliado**: 25%, 35%, 50%, 60%, 75%, 85%, 100%, 125%, 150%, 200% + slider contínuo via **Phase Vocoder C++17** com *identity phase-locking* (Laroche-Dolson) e preservação de transientes |
| Loop A→B arrastando na forma de onda + salvar loops | **Ampliado**: múltiplos loops nomeados salvos em SQLite, alças arrastáveis no waveform, edição fina de tempos A/B, reprodução isolada e exportação direta do loop |
| Pré-contagem antes do play/loop (None, ½s, 1s, 2s, 5s) | **Ampliado**: Desligada, 0,5s, 1s, 2s, 3s, 5s com cliques de metrônomo opcionais e contagem visual |
| Transposição independente (Oitavas, Semitons, Cents) | **Implementado em C++17**: ±2 oitavas, ±12 semitons, ±50 cents em tempo real sem alterar o andamento + botão Restaurar |
| Forma de onda + alternância com Espectrograma | **Ampliado**: Zoom H/V, grade de batidas/compassos, regiões coloridas, marcadores de seção, modo Dividido (Waveform + Espectrograma FFT simultâneos) |
| Detecção de notas, melodia, acordes, BPM e tonalidade | **Ampliado**: Confiança por resultado, aviso transparente de baixa confiança, **edição manual completa**, Piano Roll editável com síntese MIDI, diagramas de Violão e Teclado, Tap Tempo |
| Exportar loop desacelerado em MP3 | **Ampliado**: Exportar música completa, seleção, loop A/B, áudio desacelerado/transposto ou stems em **MP3, WAV, FLAC, MIDI, Notas TXT, Cifras TXT e Relatório PDF** |
| Execução local sem upload obrigatório | **100% Local & Offline-First**: Motor DSP nativo + SQLite local + Gerenciador de Modelos ONNX locais (sem APIs pagas ou assinatura) |
| Separação de instrumentos (além da referência) | **Novo**: Separação de 4 stems (Vocal, Bateria, Baixo, Outros) com mixer multitrack em tempo real (Mute, Solo, Volume, Export) |
| Gestão de projetos (além da referência) | **Novo**: Banco SQLite com projetos persistentes, histórico, anotações, autosave periódico e recuperação após falhas |

> **Conformidade de Direitos Autorais**: Em conformidade estrita com termos de uso e direitos autorais, o MRQ Estudo Musical **não realiza download nem extração não autorizada de vídeos do YouTube**. O estudo é feito sobre arquivos de áudio fornecidos legalmente pelo usuário (MP3, WAV, M4A, FLAC, AAC, OGG, AIFF).

---

## 2. Decisões Arquiteturais Fundamentadas

### Por que C++17 DSP + Serviço Local Python/ONNX/FFmpeg + UI React/TypeScript (Electron + Capacitor)?

O projeto exige uma base única multiplataforma (Windows, macOS, Android e Linux), motor DSP próprio de alto desempenho desacoplado da interface, decodificação completa via FFmpeg, inferência ONNX Runtime offline e compilação/testes verificáveis imediatamente.

1. **Núcleo DSP em C++17 com ABI C (`core/include/mrq_dsp.h`)**:
   - **Desacoplamento total**: compila como biblioteca dinâmica (`libmrq_dsp.so`, `mrq_dsp.dll`, `libmrq_dsp.dylib`, ou via Android NDK JNI) sem qualquer dependência de UI.
   - **Performance nativa**: operações críticas de tempo real (FFT Radix-2, Phase Vocoder com *phase-locking*, Pitch Shifting com interpolação cúbica, cálculo de picos de waveform e detecção YIN) rodam em código de máquina compilado com `-O3`.
   - **Licença limpa**: implementação própria em C++17 sob licença MIT, eliminando conflitos GPL de bibliotecas externas (como Rubber Band GPLv2 quando distribuído comercialmente; deixamos interface plugável em `plugins/` caso o usuário deseje linkar Rubber Band comercialmente).

2. **Decodificação e Codificação via FFmpeg (PyAV)**:
   - Suporte nativo e testado para **MP3, WAV, M4A, FLAC, AAC, OGG e AIFF** sem exigir que o usuário instale manualmente o executável `ffmpeg` no PATH.
   - Streaming e extração em blocos para carregar arquivos longos sem congelar a interface.

3. **Camada de IA Musical Híbrida (ONNX Runtime + DSP Determinístico Offline)**:
   - O aplicativo **funciona 100% offline na primeira execução** mesmo antes do download de pesos pesados de redes neurais:
     - **BPM/Batidas/Compasso**: Spectral SuperFlux + Autocorrelação com banco de filtros pente + Dynamic Programming Beat Tracker (Ellis).
     - **Tonalidade/Escalas**: Cromagrama de alta resolução + perfis psicoacústicos Krumhansl-Schmuckler e Temperley.
     - **Notas Polifônicas**: Suporta **Basic Pitch (ONNX)** via `onnxruntime` quando baixado pelo Gerenciador de Modelos, e executa automaticamente o motor offline **Multi-Pitch Harmonic Summation + Iterative Spectral Cancellation** com rastreamento de onsets/offsets e cálculo real de confiança quando o modelo ONNX não está presente.
     - **Acordes**: Separação harmônica (HPSS) + Cromagrama alinhado por batida + Matching probabilístico + **HMM Viterbi** para 18 qualidades harmônicas (Maj, m, dim, aug, sus2, sus4, 7, maj7, m7, m7b5, 9, maj9, m9, add9, 6, m6, 7sus4, 5).
     - **Separação de Stems (4 faixas)**: Suporta modelos **HTDemucs / MDX-Net ONNX** via `onnxruntime`, e oferece motor offline **Wiener-Masking HPSS + Decomposição Mid/Side Vocal + Sub-banda de Baixo** com reconstrução iSTFT coerente em fase.

4. **Persistência SQLite (WAL Mode)**:
   - Armazena metadados de projetos, caminhos de áudio (nunca BLOBs gigantes), loops, marcadores, transcrições de notas editadas, acordes editados, stems, cache de análise e snapshots de autosave/crash recovery.

5. **Interface Única Multiplataforma (`apps/studio/`)**:
   - React 19 + TypeScript + Canvas 2D (60 FPS para Waveform, Espectrograma e Piano Roll) + Web Audio API (reprodução precisa, mixer de stems sincronizado, pré-contagem com metrônomo e sintetizador MIDI).
   - **Desktop (Windows/macOS/Linux)**: empacotada via Electron (`apps/desktop/`) com processo sidecar local e instaladores NSIS `.exe`, `.msi`, `.dmg`/`.app` e `.AppImage`.
   - **Android**: empacotada via Capacitor + Gradle + Android NDK JNI (`apps/android/`) gerando `.apk` e `.aab`, com navegação mobile/tablet adaptativa.

---

## 3. Diagrama de Camadas

```
┌────────────────────────────────────────────────────────────────────────────┐
│  CAMADA DE APRESENTAÇÃO (apps/studio — React + TS + Canvas 2D + WebAudio)  │
│  Desktop Shell: Electron (Win/Mac/Linux) │ Mobile Shell: Capacitor Android │
├────────────────────────────────────────────────────────────────────────────┤
│  CAMADA DE SERVIÇO LOCAL (backend/ — FastAPI REST + Audio Range + WS)      │
├───────────────┬──────────────────┬──────────────────┬──────────────────────┤
│ GERENCIADOR   │ MOTOR DE ÁUDIO   │ IA MUSICAL (ai/) │ EXPORTAÇÃO & PLUGINS │
│ DE PROJETOS   │ (audio_engine/)  │ - BPM & Beats    │ - MP3 / WAV / FLAC   │
│ (database/)   │ - PyAV / FFmpeg  │ - Key & Scale    │ - MIDI (SMF Type 1)  │
│ - SQLite WAL  │ - Cache / Temp   │ - Poly Notes     │ - Notas/Cifras TXT   │
│ - Autosave    │ - Audio Manager  │ - Chords + HMM   │ - Relatório PDF      │
│ - Recovery    │                  │ - 4-Stem Sep.    │ - Model Manager ONNX │
├───────────────┴──────────────────┴──────────────────┴──────────────────────┤
│  NÚCLEO DSP NATIVO C++17 (core/ — libmrq_dsp.so / .dll / .dylib / JNI)     │
│  Phase Vocoder │ Pitch Shifter │ Radix-2 FFT │ Waveform Peaks │ YIN │ MIDI │
└────────────────────────────────────────────────────────────────────────────┘
```

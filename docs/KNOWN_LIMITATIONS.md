# Limitações Conhecidas e Transparência Técnica — MRQ Estudo Musical

Em conformidade com as boas práticas de engenharia de software comercial, documentamos abaixo de forma transparente todas as limitações atuais conhecidas:

## 1. Compilação de Instaladores Nativos em Runners Específicos
- O ambiente de desenvolvimento atual é **Linux x86_64** sem Windows SDK, macOS Xcode ou Android SDK/NDK instalados.
- Por isso, **não afirmamos** que os binários finais `.exe`/`.msi`, `.dmg`/`.app` e `.apk`/`.aab` foram compilados ou testados neste sandbox Linux.
- Todo o código nativo (C++17 cross-platform, Electron, NSIS, PowerShell, Shell macOS Universal, Android Gradle + CMake JNI) e o pipeline automatizado de compilação em runners reais (`windows-latest`, `macos-14`, `ubuntu-latest + Android NDK`) estão prontos em `installers/` e `.github/workflows/release-installers.yml`.

## 2. Separação de Instrumentos (DSP Offline vs Neural ONNX)
- **Sem download prévio de pesos neurais**, a separação de 4 stems (Vocal, Bateria, Baixo, Outros) utiliza o motor offline **Wiener-HPSS 2D + Decomposição Mid/Side**. Ele é rápido (~1.3s para 16s de áudio), coerente em fase e 100% offline, porém:
  - Em gravações **estritamente mono**, a separação entre voz central e instrumentos harmônicos na mesma faixa de frequência é fisicamente limitada.
  - Instrumentos panoramizados no centro (como caixa de bateria ou piano mono) podem apresentar vazamento residual para o stem vocal.
- Para qualidade de separação neural estado-da-arte, baixe o modelo opcional **HTDemucs 4-Stems (ONNX)** (~168 MB) pelo *Gerenciador de Modelos IA* (requer conexão à internet apenas no download inicial).

## 3. Transcrição Polifônica e Acordes em Mixagens Densas
- Gravações com muita distorção (guitarra heavy metal), reverberação extrema ou dezenas de instrumentos simultâneos podem gerar harmônicos detectados como notas extras ou acordes ambíguos.
- O aplicativo exibe **escore de confiança real** em cada análise, emite avisos explícitos quando a confiança é inferior a 55%, e oferece **edição manual completa** no Piano Roll e no Painel de Acordes.

## 4. Direitos Autorais e Fontes de Áudio
- Por respeito estrito a direitos autorais e termos de serviço, o MRQ Estudo Musical **não realiza download nem extração não autorizada de vídeos do YouTube**. O usuário deve importar arquivos de áudio locais (MP3, WAV, M4A, FLAC, AAC, OGG, AIFF) que possua legalmente.

## 5. Áudio em Tempo Real ao Alterar Velocidade/Afinação
- Quando o usuário altera velocidade ou afinação, o núcleo C++17 reprocessa o áudio com Phase Vocoder + Phase Locking (com cache LRU em disco). Em faixas muito longas (>10 minutos) em dispositivos com pouca CPU, pode haver um breve intervalo de renderização antes da retomada automática na mesma posição temporal.
- No Android autônomo (sem servidor remoto), a ponte JNI C++17 (`MrqDspBridge.java` + `mrq_jni.cpp`) já está integrada para DSP nativo; a execução offline completa da camada Python IA no dispositivo Android requer empacotamento adicional (ex.: Chaquopy ou conversão 100% ONNX Runtime Mobile para os modelos), sendo recomendada conexão local ou execução dos modelos ONNX diretamente via `onnxruntime-android` nas próximas versões (v1.1).

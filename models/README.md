# Modelos de Inteligência Artificial — MRQ Estudo Musical

O **MRQ Estudo Musical** prioriza processamento **100% local e offline**, sem assinaturas nem APIs pagas.

## Política de Repositório

Arquivos de pesos neurais (`.onnx`, `.pth`, `.ckpt`) **não são versionados diretamente no Git** para manter o repositório rápido e enxuto. Eles são gerenciados pelo **Gerenciador de Modelos** interno do aplicativo (`Ferramentas -> Gerenciador de Modelos IA`) e armazenados em `models/weights/`.

## Funcionamento Offline Imediato

Mesmo **antes** de baixar qualquer modelo neural opcional, todas as funções principais funcionam 100% offline graças aos motores DSP/ML nativos embutidos:

| Funcionalidade | Motor Offline Embutido (Zero Download) | Modelo Neural ONNX Opcional |
|---|---|---|
| Time Stretching & Pitch Shift | C++17 Phase Vocoder + Phase Locking | — |
| BPM, Batidas e Compasso | C++17 SuperFlux + Ellis DP Beat Tracker | — |
| Tonalidade e Escalas | Cromagrama HPSS + Krumhansl-Schmuckler / Temperley | — |
| Notas Polifônicas & Melodia | Multi-Pitch Harmonic Summation + YIN C++17 | `basic-pitch-onnx` (16.8 MB, Apache-2.0) |
| Reconhecimento de Acordes | Cromagrama HPSS + 216 Templates + HMM Viterbi | — |
| Separação de 4 Stems | Wiener-HPSS 2D + Mid/Side Center Masking coerente | `htdemucs-4stems-onnx` (168 MB, MIT) |

## Instalação Manual de Modelos ONNX

Você pode baixar pelo Gerenciador de Modelos na interface ou copiar manualmente arquivos `.onnx` compatíveis para `models/weights/` seguindo os nomes definidos em `models/manifest.json`:

- `models/weights/basic_pitch_nmp.onnx`
- `models/weights/htdemucs_4stems.onnx`
- `models/weights/mdx_vocal.onnx`

O aplicativo valida automaticamente o carregamento com `onnxruntime` antes de ativar cada modelo.

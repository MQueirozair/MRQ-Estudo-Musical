# Guia de Contribuição — MRQ Estudo Musical

Obrigado por contribuir com o **MRQ Estudo Musical**!

## Estratégia de Branches (Git Flow)

- `main`: código estável pronto para produção e tags de release (`v1.0.0`, `v1.1.0`, etc.).
- `development`: integração contínua de funcionalidades antes da criação de uma release.
- `feature/<nome>`: novas funcionalidades (ex.: `feature/onnx-demucs-v4`).
- `fix/<nome>`: correções de bugs (ex.: `fix/loop-precount-latency`).
- `release/<versao>`: estabilização final e geração de instaladores.

> Nota de fluxo: crie Pull Requests direcionados para `development` (ou `main` em hotfixes), garantindo que o CI (`ci.yml`) passe integralmente antes do merge.

## Convenção de Commits

Adotamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(dsp): adiciona phase-locking ao Phase Vocoder C++`
- `feat(ai): implementa suavizacao Viterbi no detector de acordes`
- `fix(ui): corrige arraste do marcador B em zoom 32x`
- `test(audio): adiciona validacao de exportacao FLAC e AIFF`
- `docs: atualiza guia de compilacao para macOS Apple Silicon`
- `ci: configura build nativo Windows NSIS e Android AAB`

## Padrões de Qualidade

1. **Núcleo C++ (`core/`)**: C++17 padrão, sem warnings com `-Wall -Wextra`, sem vazamentos de memória, exportando API limpa em C (`extern "C"`).
2. **Backend / IA (`ai/`, `database/`, `backend/`)**: Python 3.11+, type hints, algoritmos reais baseados em DSP/ML (nunca dados simulados).
3. **Frontend (`apps/studio/`)**: TypeScript estrito (`tsc --noEmit`), UI acessível e responsiva para Desktop e Mobile/Android.
4. **Arquivos grandes**: nunca faça commit de pesos de modelos (`.onnx`, `.pth`), bancos SQLite locais ou binários compilados no Git; utilize o Gerenciador de Modelos ou Git LFS quando estritamente necessário.

## Executando os Testes Localmente

```bash
make build-dsp
make test
```

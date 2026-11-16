## Descrição

Descreva de forma clara e objetiva o que foi alterado e qual problema ou recurso esta PR resolve.

## Tipo de Alteração

- [ ] Nova funcionalidade (`feat`)
- [ ] Correção de bug (`fix`)
- [ ] Melhoria no motor DSP / IA (`perf` / `refactor`)
- [ ] Empacotamento / Instaladores / CI (`build` / `ci`)
- [ ] Documentação (`docs`)
- [ ] Testes automatizados (`test`)

## Módulos Afetados

- [ ] `core/` (C++17 DSP, FFmpeg/PyAV, Exportador)
- [ ] `ai/` (BPM, Tonalidade, Notas, Acordes, Stems, ONNX)
- [ ] `database/` & `backend/` (SQLite WAL, FastAPI)
- [ ] `apps/studio/` (Interface React/TypeScript/Canvas/WebAudio)
- [ ] `apps/desktop/` (Electron Windows/macOS/Linux)
- [ ] `apps/android/` (Capacitor + Android Gradle + NDK JNI)
- [ ] `installers/` & `.github/workflows/`

## Checklist de Verificação

- [ ] `make -C core test` passou sem warnings (C++17)
- [ ] `python -m pytest -v tests/` passou 100%
- [ ] `npm --prefix apps/studio run build` compilou sem erros TypeScript/Vite
- [ ] Nenhum arquivo temporário, cache ou modelo pesado foi commitado indevidamente
- [ ] Documentação atualizada (`README.md`, `CHANGELOG.md` ou `docs/`) quando aplicável

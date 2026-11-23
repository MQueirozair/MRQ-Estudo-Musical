# MRQ Estudo Musical 🎹

Recriação do app **MRQ Piano Chords** como **programa de computador para Windows e macOS**, com
**instalador** e **base de dados 100% local** — não precisa de internet, conta ou servidor.

O áudio é gerado por síntese dentro do próprio app (não usa samples nem streaming), então tudo
funciona offline desde o primeiro clique.

---

## O que tem dentro

| Seção | O que faz |
| --- | --- |
| **Explorar Acordes** | Teclado de piano interativo (clique ou MIDI), 15 categorias e **74 tipos de acorde**, todas as inversões, partitura em clave de sol e fá, dedilhado sugerido para as duas mãos, metrônomo, pedal, timbres (piano, elétrico, órgão, cordas) |
| **Plano de estudo** | Roteiro guiado de 9 passos (~50 min) com progresso salvo |
| **Acordes & Escalas** | 20 escalas e modos, acordes diatônicos (tríade e sétima) de cada escala |
| **Progressões** | 18 progressões por gênero (Pop, Jazz, Blues, Gospel, Bossa, MPB, Sertanejo, Rock, Funk, Soul, Flamenco, Clássico, Trilha) com baixo + vozes, BPM ajustável e transposição para os 12 tons |
| **Gêneros & Poliacordes** | Voicings de Gospel piano, jazz, bossa e sobreposições de tríades |
| **Quiz de Acordes** | 4 modos de treino auditivo com precisão, sequência e recorde |
| **Ditado musical** | Intervalos, acordes e notas de ouvido, com dois níveis |
| **Leitura** | Identifique o acorde a partir da partitura |
| **Intervalos** | Tabela completa com audição melódica e harmônica |
| **Licks & frases** | 10 frases prontas com ritmo, por estilo |
| **Dicionário** | Todos os acordes com notas, intervalos e categorias, busca instantânea |
| **Composição** | Monte sua progressão (até 32 acordes), toque e exporte em `.txt` |
| **Minha evolução** | Atividade por dia, precisão, o que você mais usa |
| **Conquistas** | 16 marcos com XP e barras de progresso |

Notas em português (Dó, Ré, Mi…) com alternância ♯/♭, atalhos de teclado (A–K, ←/→, ↑/↓, Espaço)
e suporte a **teclado MIDI** via Web MIDI.

---

## Rodar em desenvolvimento

Pré-requisitos: **Node.js 20+**.

```bash
npm install
npm run dev          # abre no navegador em http://localhost:5173
npm run electron:dev # build + abre na janela do app desktop
```

## Gerar os instaladores

```bash
npm run dist:win     # Windows  → .exe (instalador NSIS) + versão portátil
npm run dist:mac     # macOS    → .dmg + .zip (Intel e Apple Silicon)
npm run dist:linux   # Linux    → AppImage + .deb
```

Os arquivos saem na pasta `release/`.

> ⚠️ **Gerar instalador de Windows exige Windows** (ou Wine + Docker no Linux) e **instalador de
> macOS exige macOS** por causa da assinatura/empacotamento da Apple. Se você não tem as duas
> máquinas, use o workflow do GitHub Actions incluído: ele compila Windows, macOS e Linux em
> máquinas reais da Microsoft/Apple e devolve os instaladores prontos como artefatos.
>
> No GitHub: **Actions → "Instaladores (Windows, macOS e Linux)" → Run workflow**.
> Ao final, baixe o artefato `instaladores-win`, `instaladores-mac` ou `instaladores-linux`.
> Também é possível publicar uma release criando uma tag: `git tag v1.0.0 && git push --tags`.

Os builds **não são assinados** com certificado comercial. Por isso:
- **Windows**: o SmartScreen pode pedir “Mais informações → Executar assim mesmo”.
- **macOS**: clique com botão direito no app → **Abrir** (ou `Ajustes → Privacidade e Segurança → Abrir mesmo assim`).

---

## Onde ficam os dados (base local)

Nada é enviado para a nuvem. Cada máquina guarda seus próprios arquivos JSON:

| Sistema | Caminho |
| --- | --- |
| Windows | `%APPDATA%\MRQ Estudo Musical\dados\` |
| macOS | `~/Library/Application Support/MRQ Estudo Musical/dados/` |
| Linux | `~/.config/MRQ Estudo Musical/dados/` |

No menu do app: **Arquivo → Abrir pasta de dados** para ver os arquivos,
**Arquivo → Exportar meus dados (backup)…** para gerar um `.json` e
**Arquivo → Importar backup…** para restaurar em outra máquina.

Quando o mesmo código roda no navegador (`npm run dev`), a persistência cai automaticamente
para o `localStorage`, sem quebrar nada.

---

## Arquitetura

```
electron/
  main.cjs        janela nativa, menu em português, IPC de armazenamento em JSON
  preload.cjs     ponte segura (contextIsolation) expondo window.mrq
src/
  music/          teoria (acordes, escalas, progressões) + motor de áudio (síntese)
  components/     Piano, partitura SVG, dedilhado, metrônomo, biblioteca
  pages/          14 telas do app
  lib/            persistência local + conquistas
  ui/             ícones SVG próprios e toasts
scripts/          verificações de teoria e de renderização
```

Stack: **React 19 + TypeScript + Vite**, empacotado com **Electron + electron-builder**.
Sem fontes, imagens ou bibliotecas de áudio externas — o app inteiro é offline.

## Verificações rápidas

```bash
npm run typecheck    # TypeScript estrito
npm run build        # build de produção
```

---

Feito com carinho para quem estuda harmonia de verdade. 🎶

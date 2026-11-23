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

## Baixar os instaladores prontos (mais rápido)

Os instaladores já compilados estão na página de **Releases**:

**[⬇️ Baixar MRQ Estudo Musical v1.0.0](https://github.com/MQueirozair/MRQ-Estudo-Musical/releases/tag/v1.0.0)**

| Sistema | Arquivo | Tamanho |
| --- | --- | --- |
| **Windows 64 bits** | `MRQ-Estudo-Musical-1.0.0-x64-setup.exe` (instalador) | ~78 MB |
| Windows (sem instalar) | `MRQ-Estudo-Musical-1.0.0-portable.exe` | ~78 MB |
| **macOS Apple Silicon** (M1–M4) | `MRQ-Estudo-Musical-1.0.0-arm64.dmg` | ~89 MB |
| **macOS Intel** | `MRQ-Estudo-Musical-1.0.0-x64.dmg` | ~92 MB |
| macOS (zip, para distribuir) | `.zip` arm64 / x64 | ~93–97 MB |
| **Android** | `MRQ-Estudo-Musical-1.0.0.apk` (instale direto) | ~3,6 MB |
| Android (Play Store) | `MRQ-Estudo-Musical-1.0.0.aab` | ~3,4 MB |
| Linux | `MRQ-Estudo-Musical-1.0.0-x86_64.AppImage` ou `.deb` | ~73–81 MB |

> **Android:** baixe o `.apk` no celular, toque no arquivo e permita *instalar de fontes desconhecidas*.
> O APK é compacto porque usa o WebView do próprio Android (sem Chromium embutido). O `.aab` é o
> formato exigido pela Play Store.

> Os builds **não são assinados** com certificado comercial.
> **Windows:** se aparecer o SmartScreen, clique em *Mais informações → Executar assim mesmo*.
> **macOS:** clique com o botão direito no app → **Abrir** (só na primeira vez).
> **Android:** o APK é assinado com uma chave de demonstração (gerada no CI). Para publicar na
> Play Store, adicione os secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`,
> `ANDROID_KEYSTORE_PASSWORD` e `ANDROID_KEY_PASSWORD` com a sua chave de produção.

## Android

O app Android usa **Capacitor**: o mesmo código React roda dentro de um WebView local, com a base
de dados no próprio aparelho (sem servidor). O projeto nativo fica em `android/`.

```bash
npm run android:sync    # build web + copia para o projeto Android
npm run android:apk     # gera o APK de depuração (precisa do Android SDK)
```

O workflow **"Android (APK e AAB)"** roda no CI, gera o APK assinado + o AAB e publica no mesmo
Release dos instaladores de desktop. Necessário: JDK 21 + Android SDK 34 (o CI já tem os dois).

## Gerar os instaladores você mesmo

```bash
npm run dist:win     # Windows  → .exe (instalador NSIS) + versão portátil
npm run dist:mac     # macOS    → .dmg + .zip (Intel e Apple Silicon)
npm run dist:linux   # Linux    → AppImage + .deb
```

Os arquivos saem na pasta `release/`.

> 💡 O script `npm run electron:check` baixa o binário do Electron antes do empacotamento
> (necessário porque o `npm ci` no CI roda com `ELECTRON_SKIP_BINARY_DOWNLOAD=1`). Se a sua rede
> bloquear o GitHub, use um espelho: `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`.

> ⚠️ **Gerar instalador de Windows exige Windows** (ou Wine + Docker no Linux) e **instalador de
> macOS exige macOS** por causa da assinatura/empacotamento da Apple. Se você não tem as duas
> máquinas, use o workflow do GitHub Actions incluído: ele compila Windows, macOS e Linux em
> máquinas reais da Microsoft/Apple e devolve os instaladores prontos como artefatos.
>
> No GitHub: **Actions → "Instaladores (Windows, macOS e Linux)" → Run workflow**.
> O workflow compila os três sistemas, valida os arquivos e **publica um Release** com download
> direto (sem precisar de login). Ele também roda automaticamente em pull requests, deixando os
> instaladores como artefatos temporários de teste.

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
android/          projeto Android nativo gerado pelo Capacitor (WebView + APK)
capacitor.config.json  identidade e ajustes do app Android
src/
  music/          teoria (acordes, escalas, progressões) + motor de áudio (síntese)
  components/     Piano, partitura SVG, dedilhado, metrônomo, biblioteca
  pages/          14 telas do app
  lib/            persistência local, conquistas e ajustes do Android
  ui/             ícones SVG próprios e toasts
scripts/          verificações de teoria e de renderização
```

Stack: **React 19 + TypeScript + Vite**, empacotado com **Electron + electron-builder** no
desktop e **Capacitor** no Android.
Sem fontes, imagens ou bibliotecas de áudio externas — o app inteiro é offline.

## Verificações rápidas

```bash
npm run typecheck    # TypeScript estrito
npm run build        # build de produção
```

---

Feito com carinho para quem estuda harmonia de verdade. 🎶

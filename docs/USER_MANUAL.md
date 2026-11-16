# Manual de Utilização — MRQ Estudo Musical

Bem-vindo ao **MRQ Estudo Musical**, sua estação profissional para aprender, desacelerar, transpor, analisar e transcrever qualquer música localmente.

---

## 1. Tela Principal

1. **Barra Superior & Menus**: acesso completo a *Arquivo*, *Editar*, *Exibir*, *Ferramentas*, *Análise Musical* e *Ajuda*, além dos botões rápidos *Importar Áudio*, *Analisar IA* e *Exportar*.
2. **Área Central (Waveform & Espectrograma FFT)**:
   - Alterne entre **Waveform**, **Espectrograma** ou **Dividido**.
   - Use **Zoom H** (`+`/`−` ou `Ctrl+Scroll`), **Ganho V** e a barra de navegação horizontal para inspecionar frases difíceis.
   - Passe o mouse sobre o Espectrograma para ler tempo, frequência exata (Hz) e nota musical correspondente.
3. **Barra de Transporte**: Play/Pause (`Espaço`), Stop, ±5s (`←`/`→`), Ir ao Ponto A, Volume, **Pré-contagem** (`Off`, `0,5s`, `1s`, `2s`, `3s`, `5s`) e **Tap Tempo** (`T`).
4. **Painel de Velocidade (Time Stretching Real)**: escolha `25%`, `35%`, `50%`, `60%`, `75%`, `85%`, `100%`, `125%`, `150%`, `200%` ou arraste o controle deslizante. O motor C++17 preserva a tonalidade original.
5. **Painel de Afinação & Transposição**: ajuste **Semitons** (`-12` a `+12`), **Oitavas** (`-2` a `+2`) e **Cents** (`-50¢` a `+50¢`) independentemente da velocidade. Clique em **Restaurar** para voltar à afinação original.

---

## 2. Importação de Áudio

- Arraste um ou vários arquivos (**MP3, WAV, M4A, FLAC, AAC, OGG, AIFF**) para qualquer ponto da janela, ou clique em **Importar Áudio**.
- Na primeira execução, o aplicativo já inclui a faixa de demonstração `MRQ_Demo_Am_F_C_G_120BPM.wav` para teste imediato.

---

## 3. Estudo com Loop A/B e Pré-contagem

1. **Arraste diretamente sobre o waveform** para criar o trecho A→B.
2. Arraste as alças **A** e **B** no gráfico ou ajuste os números na aba **Loops A/B**.
3. Escolha uma **pré-contagem** (ex.: `2s`) na barra de transporte: antes de cada repetição, cliques de metrônomo preparam sua entrada no instrumento.
4. Dê um nome ao trecho e clique em **Salvar Loop** para guardar velocidade e afinação específicas daquela passagem no banco SQLite.

---

## 4. Análise Musical com IA & Edição Manual

Clique em **Analisar IA** (ou escolha análises individuais no menu *Análise Musical*):

- **BPM, Batidas e Compasso**: exibe o andamento estimado, score de confiança e sobrepõe a grade de batidas/compassos no waveform. Você pode corrigir o BPM digitando ou usando **Tap Tempo**.
- **Tonalidade & Escala**: apresenta tonalidade principal, escala sugerida, notas da escala e candidatas alternativas. Quando a confiança for inferior a 55%, um alerta transparente é exibido.
- **Piano Roll & Transcrição MIDI**:
  - Clique nas teclas à esquerda para ouvir cada altura.
  - Use o modo **Mover** para arrastar notas (tempo e altura) ou arrastar a borda direita para alterar duração.
  - Use o modo **Criar Nota** (ou duplo clique) para inserir notas; pressione `Delete` para excluir.
  - Utilize **+8ª / −8ª** e **Quantizar (1/4, 1/8, 1/16)** para limpar a transcrição.
  - Clique em **Tocar MIDI** para ouvir suas notas no sintetizador polifônico interno e em **Exportar .MID** para salvar o arquivo MIDI padrão.
- **Notas & Acordes**:
  - Acompanhe os acordes sincronizados em tempo real durante a reprodução.
  - Clique em qualquer acorde para visualizar os **diagramas de Violão e Teclado** e ouvir o acorde.
  - Passe o mouse sobre um acorde e clique no ícone de lápis para corrigir a cifra manualmente.

---

## 5. Separação de Instrumentos (4 Stems)

1. Abra a aba **Separação de Stems (4 Faixas)** e clique em **Separar 4 Stems**.
2. Aguarde a extração de **Vocal**, **Bateria**, **Baixo** e **Outros Instrumentos**.
3. Ative **Ativar Reprodução por Stems** para controlar em tempo real o volume, **M (Mute)** e **S (Solo)** de cada instrumento — inclusive com desaceleração, transposição e Loop A/B!
4. Exporte qualquer stem isolado ou o **Mix Combinado**.

---

## 6. Marcadores, Projetos e Exportação

- **Marcadores**: pressione `M` ou use a aba **Informações & Marcadores** para marcar *Introdução, Verso, Pré-refrão, Refrão, Ponte, Solo, Final* com cores e anotações. Dê duplo clique em um chip de marcador para transformar a seção inteira em Loop A/B.
- **Projetos**: gerencie projetos salvos, *Salvar Como*, histórico de recentes e *Recuperação Automática* em **Arquivo → Abrir / Gerenciar Projetos**.
- **Exportação**: clique em **Exportar** para gerar **MP3, WAV, FLAC** (música inteira, trecho manual, Loop A/B, stem ou mix — com velocidade e afinação aplicadas), **MIDI (.mid)**, **Notas TXT**, **Cifras TXT** ou **Relatório de Análise em PDF**.

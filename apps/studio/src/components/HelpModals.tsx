import React, { useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  FileAudio,
  Film,
  HelpCircle,
  Info,
  Keyboard,
  Layers,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
  ZoomIn,
} from 'lucide-react';
import { api } from '../api/client';
import type { HealthInfo } from '../types/music';

export type HelpTab = 'manual' | 'formats' | 'shortcuts' | 'diagnostics' | 'about';

interface HelpModalsProps {
  tab: HelpTab | null;
  onClose: () => void;
  onChangeTab: (t: HelpTab) => void;
}

const IMPORT_FORMATS = [
  { ext: '.MP3', cat: 'Áudio', codec: 'MPEG Layer 3', desc: 'Formato universal para músicas, playbacks e aulas gravadas.' },
  { ext: '.WAV', cat: 'Áudio', codec: 'PCM 16/24-bit', desc: 'Áudio sem compressão e sem perdas — fidelidade máxima para análise IA e DSP.' },
  { ext: '.FLAC', cat: 'Áudio', codec: 'FLAC Lossless', desc: 'Sem perdas com metade do tamanho do WAV — ideal para arquivos de estúdio.' },
  { ext: '.M4A', cat: 'Áudio', codec: 'AAC / ALAC (MP4)', desc: 'Padrão Apple (iPhone, iPad, Mac, gravador de voz) e plataformas digitais.' },
  { ext: '.AAC', cat: 'Áudio', codec: 'AAC ADTS', desc: 'Áudio leve e eficiente amplamente usado em transmissões e celulares.' },
  { ext: '.OGG', cat: 'Áudio', codec: 'Vorbis / Opus', desc: 'Formato livre com excelente qualidade em arquivos muito leves.' },
  { ext: '.AIFF / .AIF', cat: 'Áudio', codec: 'PCM Big-Endian', desc: 'Sem perdas padrão Apple/Logic Pro/Pro Tools.' },
  { ext: '.MP4', cat: 'Vídeo', codec: 'H.264 / MPEG4 + AAC', desc: 'Abre o vídeo sincronizado + extrai áudio completo para Forma de Onda, IA, Stems e conversão em 1 clique.' },
  { ext: '.WEBM', cat: 'Vídeo', codec: 'VP8/VP9 + Opus', desc: 'Vídeo moderno da web com reprodução sincronizada e conversão completa para áudio.' },
  { ext: '.MOV', cat: 'Vídeo', codec: 'QuickTime', desc: 'Vídeos gravados em iPhone, iPad e câmeras — áudio extraído automaticamente.' },
  { ext: '.MKV / .M4V', cat: 'Vídeo', codec: 'Matroska / MP4', desc: 'Contêineres de vídeo de alta resolução com extração instantânea de áudio.' },
  { ext: 'Link YouTube', cat: 'Online', codec: 'YouTube IFrame API', desc: 'Estudo sincronizado via Player Oficial + Captura Completa (0:00 → Fim) do Som do Sistema (WASAPI).' },
];

const EXPORT_FORMATS = [
  { ext: '.MP3', group: 'Áudio Portátil', quality: '192 kbps Estéreo', lossless: false, bestFor: 'Ouvir no celular, WhatsApp, estudo portátil e compartilhamento rápido.' },
  { ext: '.M4A', group: 'Áudio Portátil', quality: 'AAC 192 kbps', lossless: false, bestFor: 'iPhone, iPad, Mac, Android e ótima qualidade em tamanho reduzido.' },
  { ext: '.OGG', group: 'Áudio Portátil', quality: 'Opus 48 kHz / 192k', lossless: false, bestFor: 'Arquivo ultraleve com altíssima fidelidade sonora.' },
  { ext: '.AAC', group: 'Áudio Portátil', quality: 'ADTS 192 kbps', lossless: false, bestFor: 'Streaming leve, players embarcados e envio rápido.' },
  { ext: '.WAV', group: 'Sem Perdas (Estúdio)', quality: 'PCM 16-bit Estéreo', lossless: true, bestFor: 'Editar em DAWs (Reaper, Ableton, Cubase, FL Studio) sem nenhuma perda.' },
  { ext: '.FLAC', group: 'Sem Perdas (Estúdio)', quality: 'FLAC Lossless', lossless: true, bestFor: 'Guardar áudio em qualidade de estúdio ocupando ~50% menos espaço que WAV.' },
  { ext: '.AIFF', group: 'Sem Perdas (Estúdio)', quality: 'PCM 16-bit BE', lossless: true, bestFor: 'Fluxos Apple, Logic Pro, GarageBand e Pro Tools.' },
  { ext: '.MID', group: 'Transcrição Musical', quality: 'Standard MIDI Type 1', lossless: true, bestFor: 'Importar as notas do Piano Roll em DAWs, MuseScore, Guitar Pro ou sintetizadores.' },
  { ext: 'Notas (.TXT)', group: 'Transcrição Musical', quality: 'Texto UTF-8', lossless: true, bestFor: 'Tabela detalhada com tempo inicial/final, nome da nota, MIDI, velocidade e papel.' },
  { ext: 'Cifras (.TXT)', group: 'Transcrição Musical', quality: 'Texto UTF-8', lossless: true, bestFor: 'Folha de cifras com progressão harmônica, marcadores, loops e link do vídeo.' },
  { ext: 'Relatório (.PDF)', group: 'Documento Completo', quality: 'A4 ReportLab', lossless: true, bestFor: 'Imprimir ou estudar no tablet: resumo completo com BPM, Tom, Loops, Marcas, Cifras e Notas.' },
];

export const HelpModals: React.FC<HelpModalsProps> = ({ tab, onClose, onChangeTab }) => {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [updates, setUpdates] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [zoomImage, setZoomImage] = useState<{ src: string; title: string } | null>(null);

  useEffect(() => {
    if (tab === 'diagnostics' || tab === 'about') {
      void api.health().then(setHealth).catch(() => {});
    }
  }, [tab]);

  if (!tab) return null;

  const checkUpdates = async () => {
    setChecking(true);
    try {
      setUpdates(await api.checkUpdates());
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#0F172A] border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Top Tab Navigation */}
        <div className="px-4 py-3 bg-[#111827] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1.5 pr-2 mr-1 border-r border-slate-800">
              <HelpCircle className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-extrabold text-white tracking-wide">Central de Ajuda</span>
            </div>
            {(
              [
                ['manual', 'Guia Visual Completo', BookOpen],
                ['formats', 'Todos os Formatos', FileAudio],
                ['shortcuts', 'Atalhos', Keyboard],
                ['diagnostics', 'Diagnóstico & Updates', Activity],
                ['about', 'Sobre', Info],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => onChangeTab(id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  tab === id
                    ? 'bg-sky-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Fechar Ajuda"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto text-xs sm:text-[13px] text-slate-300 space-y-6 leading-relaxed">
          {/* TAB 1: FULL ILLUSTRATED VISUAL GUIDE */}
          {tab === 'manual' && (
            <div className="space-y-7">
              {/* Intro Banner */}
              <div className="rounded-2xl bg-gradient-to-r from-sky-950/60 via-indigo-950/50 to-emerald-950/40 border border-sky-500/30 p-4 space-y-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-sky-400" />
                  <span>Bem-vindo ao MRQ Estudo Musical — Guia Completo com Imagens</span>
                </h2>
                <p className="text-xs text-slate-300">
                  O <strong>MRQ Estudo Musical</strong> é um estúdio completo para estudar, transcrever e converter
                  músicas e vídeos: você desacelera trechos sem mudar o tom (25% a 200%), transpõe afinação (±12
                  semitons), cria Loops A/B, analisa BPM/Tom/Notas/Acordes por IA, separa 4 Stems (Vocal, Bateria,
                  Baixo, Outros) e converte qualquer áudio ou vídeo em <strong>7 formatos de áudio</strong> +{' '}
                  <strong>MIDI, TXT e PDF</strong>. Clique em qualquer imagem abaixo para ampliar.
                </p>
              </div>

              {/* SECTION 1: STUDIO OVERVIEW */}
              <article className="space-y-3">
                <h3 className="text-sm sm:text-base font-extrabold text-sky-300 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-sky-500 text-slate-950 text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  <span>Visão Geral do Programa (Como cada área funciona)</span>
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setZoomImage({
                      src: '/help/01-visao-geral-studio.png',
                      title: 'MRQ Estudo Musical — Visão Geral do Estúdio',
                    })
                  }
                  className="group relative block w-full rounded-xl overflow-hidden border border-slate-700/80 hover:border-sky-400/70 transition bg-slate-950"
                >
                  <img
                    src="/help/01-visao-geral-studio.png"
                    alt="Visão Geral do Estúdio MRQ Estudo Musical"
                    className="w-full h-auto object-cover"
                  />
                  <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-950/85 border border-slate-700 text-[11px] text-sky-300 flex items-center gap-1 opacity-90 group-hover:opacity-100">
                    <ZoomIn className="w-3.5 h-3.5" /> Ampliar imagem
                  </span>
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <strong className="text-sky-300">① Barra Superior:</strong> Botões rápidos para{' '}
                    <strong>Link Vídeo / YT</strong>, importar <strong>Áudio / Vídeo</strong> local, rodar{' '}
                    <strong>Analisar IA</strong>, abrir <strong>Exportar</strong> e acessar esta{' '}
                    <strong>Ajuda</strong>. Nos menus suspensos você gerencia projetos, desfaz edições e limpa cache.
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <strong className="text-sky-300">② Palco Central (Vídeo + Forma de Onda / Espectrograma):</strong>{' '}
                    Exibe o player de vídeo (YouTube ou MP4/WebM local) e a <strong>Forma de Onda</strong> de alta
                    resolução. Arraste sobre a onda para criar um <strong>Loop A→B</strong> e use <code>+ / −</code>{' '}
                    para dar zoom.
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <strong className="text-sky-300">③ Transporte, Velocidade e Afinação:</strong> Controles de Play,
                    Pause, Pré-contagem (0,5s a 5s), Tap Tempo, <strong>Velocidade (25% a 200% sem mudar o tom)</strong>{' '}
                    e <strong>Transposição (±12 semitons, oitavas e cents)</strong> via motor C++17 DSP.
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <strong className="text-sky-300">④ e ⑤ Abas de Transcrição &amp; 4 Stems:</strong> Alterne entre{' '}
                    <strong>Piano Roll &amp; MIDI</strong>, <strong>Notas &amp; Acordes</strong> (com diagramas de
                    violão e teclado), <strong>Separação em 4 Stems</strong>, <strong>Loops A/B</strong> e{' '}
                    <strong>Informações &amp; Marcadores</strong>.
                  </div>
                </div>
              </article>

              {/* SECTION 2: CONVERTING FULL VIDEO TO AUDIO */}
              <article className="space-y-3">
                <h3 className="text-sm sm:text-base font-extrabold text-emerald-300 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center">
                    2
                  </span>
                  <span>Como Converter o Vídeo Inteiro para Áudio Completo (Passo a Passo)</span>
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setZoomImage({
                      src: '/help/02-captura-video-audio.png',
                      title: 'Como Converter Vídeo em Áudio Completo',
                    })
                  }
                  className="group relative block w-full rounded-xl overflow-hidden border border-slate-700/80 hover:border-emerald-400/70 transition bg-slate-950"
                >
                  <img
                    src="/help/02-captura-video-audio.png"
                    alt="Fluxo de conversão de vídeo em áudio completo"
                    className="w-full h-auto object-cover"
                  />
                  <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-950/85 border border-slate-700 text-[11px] text-emerald-300 flex items-center gap-1 opacity-90 group-hover:opacity-100">
                    <ZoomIn className="w-3.5 h-3.5" /> Ampliar imagem
                  </span>
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                  {/* Method A: YouTube */}
                  <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/35 space-y-2">
                    <div className="font-extrabold text-emerald-300 flex items-center gap-1.5 text-sm">
                      <Radio className="w-4 h-4" />
                      <span>Opção A — Vídeo do YouTube (Captura Automática 0:00 → Fim)</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                      <li>
                        Clique em <strong>Link Vídeo / YT</strong> na barra superior e cole o link (ex.:{' '}
                        <code>https://youtu.be/...</code> ou <code>youtube.com/watch?v=...</code>).
                      </li>
                      <li>
                        No topo do vídeo, clique no botão verde <strong>Capturar Som do Sistema</strong>.
                      </li>
                      <li>
                        Em <strong>1. Fonte do Áudio</strong>, mantenha selecionado{' '}
                        <strong>Som do Sistema (Saída / Placa)</strong> — no Windows usa{' '}
                        <strong>WASAPI Loopback Estéreo</strong> (não precisa de microfone e nunca fica mudo!).
                      </li>
                      <li>
                        Em <strong>2. Formato para Converter</strong>, escolha o formato desejado:{' '}
                        <strong>MP3, WAV, FLAC, M4A, OGG, AAC ou AIFF</strong>.
                      </li>
                      <li>
                        Clique em <strong>Capturar Vídeo Completo (0:00 → Fim)</strong>: o MRQ volta o vídeo para o
                        início, dá Play sozinho, mostra as barras verdes <strong>L / R</strong> e o progresso,{' '}
                        <strong>para automaticamente quando o vídeo acaba</strong>, desenha a{' '}
                        <strong>Forma de Onda completa</strong> e já baixa o áudio convertido!
                      </li>
                    </ol>
                  </div>

                  {/* Method B: Local Video / Direct Link */}
                  <div className="p-4 rounded-xl bg-sky-950/25 border border-sky-500/35 space-y-2">
                    <div className="font-extrabold text-sky-300 flex items-center gap-1.5 text-sm">
                      <Film className="w-4 h-4" />
                      <span>Opção B — Vídeo Local (.MP4, .WebM, .MOV, .MKV) ou Link Direto</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                      <li>
                        Arraste o arquivo de vídeo (<code>.mp4</code>, <code>.webm</code>, <code>.mov</code>,{' '}
                        <code>.mkv</code>) para dentro da janela — ou clique em <strong>Áudio / Vídeo</strong>.
                      </li>
                      <li>
                        Em poucos segundos, o motor FFmpeg extrai todo o áudio completo automaticamente e exibe o{' '}
                        <strong>Vídeo + Forma de Onda + Espectrograma FFT</strong> sincronizados.
                      </li>
                      <li>
                        Na barra superior do próprio vídeo, escolha o formato (<strong>MP3, WAV, FLAC, M4A, OGG, AAC ou AIFF</strong>)
                        e clique em <strong>Converter Vídeo → [Formato]</strong> para baixar o áudio inteiro em 1 clique!
                      </li>
                      <li>
                        Você também pode abrir <strong>Exportar</strong> para baixar apenas um{' '}
                        <strong>Loop A/B</strong>, alterar velocidade/tom ou exportar <strong>Stems</strong> separados.
                      </li>
                    </ol>
                  </div>
                </div>
              </article>

              {/* SECTION 3: AI ANALYSIS, PIANO ROLL, CHORDS & 4 STEMS */}
              <article className="space-y-3">
                <h3 className="text-sm sm:text-base font-extrabold text-indigo-300 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-black flex items-center justify-center">
                    3
                  </span>
                  <span>Análise IA, Piano Roll, Acordes e Separação em 4 Stems</span>
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setZoomImage({
                      src: '/help/03-ia-stems-transcricao.png',
                      title: 'Análise IA, Piano Roll, Acordes e Separação em 4 Stems',
                    })
                  }
                  className="group relative block w-full rounded-xl overflow-hidden border border-slate-700/80 hover:border-indigo-400/70 transition bg-slate-950"
                >
                  <img
                    src="/help/03-ia-stems-transcricao.png"
                    alt="Análise IA, Piano Roll, Acordes e 4 Stems"
                    className="w-full h-auto object-cover"
                  />
                  <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-950/85 border border-slate-700 text-[11px] text-indigo-300 flex items-center gap-1 opacity-90 group-hover:opacity-100">
                    <ZoomIn className="w-3.5 h-3.5" /> Ampliar imagem
                  </span>
                </button>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="font-bold text-sky-300">Piano Roll &amp; MIDI</div>
                    <p className="text-slate-400">
                      Clique em <strong>Analisar IA</strong> para transcrever notas polifônicas, melodia e baixo.
                      Clique em qualquer nota para ouvir no sintetizador embutido, arraste para corrigir ou exporte em{' '}
                      <strong>.MID</strong>.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="font-bold text-indigo-300">Acordes &amp; Diagramas</div>
                    <p className="text-slate-400">
                      Detecta a progressão harmônica e exibe em tempo real o acorde atual com{' '}
                      <strong>diagrama de Violão/Guitarra</strong> e <strong>Teclado</strong>. Edite cifras à vontade
                      e exporte em <strong>Cifras TXT</strong> ou <strong>PDF</strong>.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="font-bold text-emerald-300 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" /> Separação em 4 Stems
                    </div>
                    <p className="text-slate-400">
                      Isola <strong>Vocal</strong>, <strong>Bateria</strong>, <strong>Baixo</strong> e{' '}
                      <strong>Outros</strong>. Use <strong>Solo (S)</strong> para tirar um solo limpo ou{' '}
                      <strong>Mute (M)</strong> no Vocal para gerar uma faixa <strong>Karaokê / Playback</strong> e
                      exportar o mix!
                    </p>
                  </div>
                </div>
              </article>

              {/* SECTION 4: QUICK LINK TO ALL FORMATS TAB */}
              <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white">Quer ver a tabela completa de todos os formatos?</div>
                  <div className="text-xs text-slate-400">
                    Confira os 12 formatos de entrada e os 11 formatos de saída com indicação do melhor uso de cada um.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChangeTab('formats')}
                  className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition"
                >
                  <FileAudio className="w-4 h-4" />
                  <span>Abrir Tabela de Todos os Formatos</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ALL SUPPORTED FORMATS (ILLUSTRATED + COMPLETE TABLES) */}
          {tab === 'formats' && (
            <div className="space-y-6">
              <button
                type="button"
                onClick={() =>
                  setZoomImage({
                    src: '/help/04-formatos-exportacao.png',
                    title: 'Todos os Formatos Suportados — Importação e Exportação',
                  })
                }
                className="group relative block w-full rounded-xl overflow-hidden border border-slate-700/80 hover:border-sky-400/70 transition bg-slate-950"
              >
                <img
                  src="/help/04-formatos-exportacao.png"
                  alt="Mapa visual de todos os formatos suportados"
                  className="w-full h-auto object-cover"
                />
                <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-950/85 border border-slate-700 text-[11px] text-sky-300 flex items-center gap-1 opacity-90 group-hover:opacity-100">
                  <ZoomIn className="w-3.5 h-3.5" /> Ampliar imagem
                </span>
              </button>

              {/* Export Formats Table */}
              <div className="space-y-2">
                <h3 className="text-sm font-extrabold text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>11 Formatos de Exportação &amp; Conversão (Saída)</span>
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3">Formato</th>
                        <th className="py-2.5 px-3">Categoria</th>
                        <th className="py-2.5 px-3">Qualidade / Padrão</th>
                        <th className="py-2.5 px-3">Quando usar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
                      {EXPORT_FORMATS.map((f) => (
                        <tr key={f.ext} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-mono font-bold text-white whitespace-nowrap">{f.ext}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                f.lossless
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                              }`}
                            >
                              {f.group}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                            {f.quality}
                          </td>
                          <td className="py-2 px-3 text-slate-300">{f.bestFor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import Formats Table */}
              <div className="space-y-2">
                <h3 className="text-sm font-extrabold text-sky-300 flex items-center gap-2">
                  <FileAudio className="w-4 h-4" />
                  <span>12 Formatos de Importação (Entrada de Áudio &amp; Vídeo)</span>
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3">Formato</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">Codec / Motor</th>
                        <th className="py-2.5 px-3">Como o MRQ processa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
                      {IMPORT_FORMATS.map((f) => (
                        <tr key={f.ext} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-mono font-bold text-white whitespace-nowrap">{f.ext}</td>
                          <td className="py-2 px-3 whitespace-nowrap text-sky-300 font-semibold">{f.cat}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {f.codec}
                          </td>
                          <td className="py-2 px-3 text-slate-300">{f.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Export Scopes Explanation */}
              <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-4 space-y-2 text-xs">
                <div className="font-bold text-white">5 Escopos de Exportação de Áudio disponíveis em todos os 7 formatos:</div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-300 list-disc list-inside">
                  <li><strong>Música / Vídeo Completo:</strong> converte toda a faixa inteira.</li>
                  <li><strong>Loop A → B Ativo:</strong> exporta apenas o trecho em estudo.</li>
                  <li><strong>Seleção Personalizada:</strong> digite exatamente o início e fim desejados.</li>
                  <li><strong>Stem Individual:</strong> baixa somente Vocal, Bateria, Baixo ou Outros.</li>
                  <li><strong>Mix de Stems (Karaokê/Playback):</strong> aplica seus volumes/mutes + velocidade e tom!</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: KEYBOARD SHORTCUTS */}
          {tab === 'shortcuts' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ['Espaço', 'Reproduzir / Pausar'],
                ['← / →', 'Voltar / Avançar 5 segundos'],
                ['L', 'Ativar / Desativar Loop A/B'],
                ['A / ]', 'Definir Ponto A ou Ponto B do Loop'],
                ['B', 'Marcar Batida (e calcular BPM automaticamente)'],
                ['M', 'Criar Marcador de seção na posição atual'],
                ['Ctrl+Shift+Y', 'Abrir Vídeo do YouTube ou Link Direto'],
                ['T', 'Tap Tempo (marcar andamento)'],
                ['Ctrl + Scroll', 'Zoom Horizontal (Forma de Onda, Linha do Tempo e Vídeo)'],
                ['Shift / Alt + Scroll', 'Zoom Vertical (Altura/Ganho da Onda, Linha do Tempo e Vídeo)'],
                ['Ctrl + Shift + Scroll', 'Zoom Horizontal + Vertical juntos (Proporcional)'],
                ['Arrastar / Botão do Meio', 'Mover enquadramento no Vídeo ampliado ou rolar Waveform'],
                ['+ / −', 'Zoom Horizontal na Forma de Onda'],
                ['0', 'Ajustar Zoom à música inteira'],
                ['Ctrl+Z / Ctrl+Y', 'Desfazer / Refazer no Piano Roll e Acordes'],
                ['Ctrl+S', 'Salvar projeto imediatamente no SQLite'],
                ['?', 'Abrir esta Central de Ajuda'],
              ].map(([k, desc]) => (
                <div
                  key={k}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800"
                >
                  <span className="text-slate-200">{desc}</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-sky-300">
                    {k}
                  </kbd>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: DIAGNOSTICS & UPDATES */}
          {tab === 'diagnostics' && (
            <div className="space-y-3">
              {health ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] space-y-1.5">
                  <div>
                    App: <span className="text-sky-300">{health.app} v{health.version}</span>
                  </div>
                  <div>
                    Motor DSP Nativo: <span className="text-emerald-400">{health.dsp.dsp_version}</span> (
                    {health.dsp.dsp_library})
                  </div>
                  <div>
                    Formatos Importação:{' '}
                    <span className="text-slate-300">{health.dsp.supported_import_formats.join(', ')}</span>
                  </div>
                  <div>
                    Formatos Exportação:{' '}
                    <span className="text-emerald-300">
                      mp3, wav, flac, m4a, aac, ogg, aiff, mid, txt_notes, txt_chords, pdf
                    </span>
                  </div>
                  <div>
                    ONNX Runtime: <span className="text-indigo-300">{health.ai_runtime.onnxruntime_version}</span> (
                    {health.ai_runtime.execution_providers.join(', ')})
                  </div>
                  <div>
                    Memória RAM: {health.ai_runtime.available_ram_mb} MB livres / {health.ai_runtime.total_ram_mb} MB
                  </div>
                  <div>
                    Cache RAM: {health.dsp.ram_cached_tracks} faixas · Temp: {health.dsp.temp_render_files} arquivos
                  </div>
                  <div>Plugins ativos: {health.plugins.map((p) => `${p.name} (${p.version})`).join(', ')}</div>
                </div>
              ) : (
                <div>Carregando diagnóstico...</div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div>
                  <div className="font-bold text-white">Sistema de Atualização</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {updates
                      ? updates.update_available
                        ? `Nova versão v${updates.latest_version} disponível!`
                        : updates.message || `Você está na versão mais recente (v${updates.current_version}).`
                      : 'Verifique releases oficiais no repositório GitHub.'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={checking}
                  onClick={() => void checkUpdates()}
                  className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                  <span>{checking ? 'Verificando...' : 'Verificar Atualizações'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: ABOUT */}
          {tab === 'about' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <img src="/mrq-icon.svg" alt="MRQ" className="w-12 h-12 rounded-xl" />
                <div>
                  <h3 className="text-base font-extrabold text-white">MRQ Estudo Musical v1.0.0</h3>
                  <p className="text-xs text-slate-400">
                    Estúdio Multiplataforma de Transcrição Musical, Análise IA, Separação em 4 Stems e Conversão de
                    Áudio &amp; Vídeo (Windows, macOS, Linux e Android).
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex items-start gap-2.5 text-xs">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-emerald-300">Conformidade &amp; Privacidade 100% Local</div>
                  <p className="text-slate-300">
                    Todo o processamento de áudio (Motor C++17 Phase Vocoder, Pitch Shift, Espectrograma FFT, IA de
                    BPM/Tom/Notas/Acordes, 4 Stems e conversão nos 7 formatos) roda localmente na sua máquina, sem enviar
                    suas gravações para nuvem. Para vídeos do YouTube utilizamos exclusivamente a API oficial do
                    YouTube IFrame Player + captura local de saída de áudio do sistema (WASAPI Loopback).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Lightbox when clicking any help image */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <div className="max-w-6xl w-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between text-white">
              <span className="text-sm font-bold">{zoomImage.title}</span>
              <button
                type="button"
                onClick={() => setZoomImage(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1"
              >
                <X className="w-4 h-4" /> Fechar
              </button>
            </div>
            <img
              src={zoomImage.src}
              alt={zoomImage.title}
              className="w-full max-h-[82vh] object-contain rounded-xl border border-slate-700 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

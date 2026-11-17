import React, { useState } from 'react';
import { Download, FileAudio, FileText, FileMusic, FileCheck2, X, Loader2, Lock, Radio, Upload } from 'lucide-react';
import type { ProjectData, StemKey, StemMixerState } from '../types/music';
import { formatTime } from '../data/chordDiagrams';

interface ExportModalProps {
  open: boolean;
  project: ProjectData;
  speed: number;
  semitones: number;
  octaves: number;
  cents: number;
  loopA: number;
  loopB: number;
  stemMixer: StemMixerState;
  defaultScope?: 'full' | 'loop' | 'stem' | 'stems_mix';
  defaultStemKey?: StemKey;
  onClose: () => void;
  onAttachLocalAudio?: () => void;
  onOpenSystemCapture?: () => void;
  onRunExport: (payload: Record<string, any>, fallbackName: string) => Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  project,
  speed,
  semitones,
  octaves,
  cents,
  loopA,
  loopB,
  stemMixer,
  defaultScope = 'full',
  defaultStemKey = 'vocals',
  onClose,
  onAttachLocalAudio,
  onOpenSystemCapture,
  onRunExport,
}) => {
  const hasAudio = Boolean(project.audio_file_path);
  const [format, setFormat] = useState<
    'mp3' | 'wav' | 'flac' | 'm4a' | 'ogg' | 'aac' | 'aiff' | 'mid' | 'txt_notes' | 'txt_chords' | 'pdf'
  >(hasAudio ? 'mp3' : 'pdf');
  const [scope, setScope] = useState<'full' | 'loop' | 'selection' | 'stem' | 'stems_mix'>(defaultScope);
  const [stemKey, setStemKey] = useState<StemKey>(defaultStemKey);
  const [applyDsp, setApplyDsp] = useState(true);
  const [customA, setCustomA] = useState(loopA);
  const [customB, setCustomB] = useState(loopB > loopA ? loopB : project.duration_sec);
  const [busy, setBusy] = useState(false);

  const isAudioFormatId = (f: string) =>
    f === 'mp3' || f === 'wav' || f === 'flac' || f === 'm4a' || f === 'ogg' || f === 'aac' || f === 'aiff';

  React.useEffect(() => {
    if (open) {
      setFormat((prev) => {
        const prevIsAudio = isAudioFormatId(prev);
        if (!hasAudio && prevIsAudio) return 'pdf';
        if (hasAudio && defaultScope !== 'full' && !prevIsAudio) return 'mp3';
        return prev;
      });
      setScope(defaultScope);
      setStemKey(defaultStemKey);
      setCustomA(loopA);
      setCustomB(loopB > loopA ? loopB : project.duration_sec);
    }
  }, [open, hasAudio, defaultScope, defaultStemKey, loopA, loopB, project.duration_sec]);

  if (!open) return null;

  const isAudioFmt = isAudioFormatId(format);
  const totalSt = semitones + octaves * 12;
  const hasStems = Boolean(project.analysis?.stems?.stems?.vocals);

  const handleSubmit = async () => {
    if (isAudioFmt && !hasAudio) return;
    setBusy(true);
    try {
      const payload: Record<string, any> = {
        format,
        scope: isAudioFmt ? scope : 'full',
        speed: applyDsp ? speed : 1.0,
        semitones: applyDsp ? totalSt : 0,
        cents: applyDsp ? cents : 0,
      };
      if (isAudioFmt && scope === 'loop') {
        payload.start_sec = loopA;
        payload.end_sec = loopB > loopA ? loopB : project.duration_sec;
      } else if (isAudioFmt && scope === 'selection') {
        payload.start_sec = customA;
        payload.end_sec = customB;
      } else if (isAudioFmt && scope === 'stem') {
        payload.stem_key = stemKey;
      } else if (isAudioFmt && scope === 'stems_mix') {
        payload.stem_gains = stemMixer.volumes;
        payload.stem_mutes = stemMixer.mutes;
      }

      const ext = format === 'txt_notes' || format === 'txt_chords' ? 'txt' : format;
      await onRunExport(payload, `${project.name}.${ext}`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const formatOptions: Array<{
    id: typeof format;
    label: string;
    desc: string;
    requiresAudio: boolean;
    Icon: React.FC<any>;
  }> = [
    { id: 'mp3', label: 'MP3 (192 kbps)', desc: 'Universal e compacto para celular e estudo', requiresAudio: true, Icon: FileAudio },
    { id: 'wav', label: 'WAV (PCM 16-bit)', desc: 'Sem perdas, máxima qualidade de estúdio', requiresAudio: true, Icon: FileAudio },
    { id: 'flac', label: 'FLAC (Lossless)', desc: 'Sem perdas com arquivo ~50% menor', requiresAudio: true, Icon: FileAudio },
    { id: 'm4a', label: 'M4A (AAC)', desc: 'Alta eficiência para iPhone, Mac e Windows', requiresAudio: true, Icon: FileAudio },
    { id: 'ogg', label: 'OGG (Opus 48 kHz)', desc: 'Super leve com altíssima fidelidade', requiresAudio: true, Icon: FileAudio },
    { id: 'aac', label: 'AAC (ADTS)', desc: 'Áudio leve pronto para streaming', requiresAudio: true, Icon: FileAudio },
    { id: 'aiff', label: 'AIFF (PCM Estúdio)', desc: 'Sem perdas padrão Logic / Pro Tools / Mac', requiresAudio: true, Icon: FileAudio },
    { id: 'mid', label: 'MIDI (.mid)', desc: 'Transcrição editada do Piano Roll (SMF)', requiresAudio: false, Icon: FileMusic },
    { id: 'txt_notes', label: 'Notas (TXT)', desc: 'Tabela completa de notas, tempos e confiança', requiresAudio: false, Icon: FileText },
    { id: 'txt_chords', label: 'Cifras (TXT)', desc: 'Progressão harmônica, marcadores e loops', requiresAudio: false, Icon: FileText },
    { id: 'pdf', label: 'Relatório PDF', desc: 'Resumo completo: vídeo, loops, marcas, cifras e notas', requiresAudio: false, Icon: FileCheck2 },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Exportar Áudio, MIDI, Cifras & Relatório</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[78vh] overflow-y-auto">
          {!hasAudio && (
            <div className="rounded-xl bg-sky-950/50 border border-sky-500/35 p-3 space-y-2.5">
              <div className="text-[11px] text-slate-300 leading-relaxed">
                <strong className="text-sky-300">Modo Vídeo YouTube:</strong> você já pode exportar{' '}
                <strong>Relatório PDF</strong>, <strong>Cifras (TXT)</strong>, <strong>Notas (TXT)</strong> e{' '}
                <strong>MIDI (.mid)</strong> agora mesmo. Para converter o vídeo inteiro em{' '}
                <strong>MP3 / WAV / FLAC / M4A / OGG / AAC / AIFF</strong>, use o{' '}
                <strong className="text-emerald-300">Conversor &amp; Captura Completa (0:00 → Fim)</strong> ou vincule
                um arquivo local:
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onOpenSystemCapture && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSystemCapture();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow transition"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Capturar Som do Sistema</span>
                  </button>
                )}
                {onAttachLocalAudio && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onAttachLocalAudio();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-200 text-[11px] font-semibold flex items-center gap-1.5 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Vincular Áudio Local</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Format Grid */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              1. Escolha o Formato de Saída
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {formatOptions.map(({ id, label, desc, requiresAudio, Icon }) => {
                const locked = requiresAudio && !hasAudio;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={locked}
                    onClick={() => setFormat(id)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      locked
                        ? 'bg-slate-950/40 border-slate-800/70 text-slate-500 opacity-55 cursor-not-allowed'
                        : format === id
                        ? 'bg-emerald-500/15 border-emerald-400 text-white'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-xs font-bold">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {locked ? (
                          <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        ) : (
                          <Icon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="truncate">{label}</span>
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      {locked ? 'Requer áudio/vídeo local vinculado' : desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio Scope Options */}
          {isAudioFmt && (
            <div className="space-y-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                2. Conteúdo & Processamento DSP
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setScope('full')}
                  className={`py-1.5 px-2 rounded-lg border ${
                    scope === 'full' ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Música Completa
                </button>
                <button
                  type="button"
                  disabled={loopB <= loopA + 0.05}
                  onClick={() => setScope('loop')}
                  className={`py-1.5 px-2 rounded-lg border disabled:opacity-40 ${
                    scope === 'loop' ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Loop A→B
                </button>
                <button
                  type="button"
                  onClick={() => setScope('selection')}
                  className={`py-1.5 px-2 rounded-lg border ${
                    scope === 'selection' ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Trecho Manual
                </button>
                <button
                  type="button"
                  disabled={!hasStems}
                  onClick={() => setScope('stem')}
                  className={`py-1.5 px-2 rounded-lg border disabled:opacity-40 ${
                    scope === 'stem' ? 'bg-purple-500/20 border-purple-400 text-purple-200 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Stem Isolado
                </button>
                <button
                  type="button"
                  disabled={!hasStems}
                  onClick={() => setScope('stems_mix')}
                  className={`py-1.5 px-2 rounded-lg border disabled:opacity-40 ${
                    scope === 'stems_mix' ? 'bg-purple-500/20 border-purple-400 text-purple-200 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Mix de Stems
                </button>
              </div>

              {scope === 'loop' && (
                <div className="text-xs font-mono text-sky-300">
                  Trecho do Loop: {formatTime(loopA)} → {formatTime(loopB)}
                </div>
              )}

              {scope === 'selection' && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px]">Início (s)</span>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={project.duration_sec}
                      value={customA}
                      onChange={(e) => setCustomA(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-white"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Fim (s)</span>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={project.duration_sec}
                      value={customB}
                      onChange={(e) => setCustomB(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-white"
                    />
                  </div>
                </div>
              )}

              {scope === 'stem' && (
                <select
                  value={stemKey}
                  onChange={(e) => setStemKey(e.target.value as StemKey)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="vocals">Vocal</option>
                  <option value="drums">Bateria</option>
                  <option value="bass">Baixo</option>
                  <option value="other">Outros Instrumentos</option>
                </select>
              )}

              {scope !== 'stems_mix' && (
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={applyDsp}
                    onChange={(e) => setApplyDsp(e.target.checked)}
                    className="rounded"
                  />
                  <span>
                    Aplicar velocidade ({Math.round(speed * 100)}%) e afinação ({totalSt >= 0 ? `+${totalSt}` : totalSt} st,{' '}
                    {cents >= 0 ? `+${cents}` : cents}¢)
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>{busy ? 'Renderizando...' : 'Exportar Agora'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

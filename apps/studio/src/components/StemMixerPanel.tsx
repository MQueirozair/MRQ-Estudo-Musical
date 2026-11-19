import React from 'react';
import {
  Mic,
  Drum,
  Guitar,
  Music,
  Layers,
  Download,
  Loader2,
  Info,
  Sliders,
} from 'lucide-react';
import type { StemKey, StemMixerState, StemsAnalysis } from '../types/music';

interface StemMixerPanelProps {
  stemsAnalysis?: StemsAnalysis;
  mixer: StemMixerState;
  separating: boolean;
  progressPct: number;
  progressMsg: string;
  onSeparate: () => void;
  onMixerChange: (next: StemMixerState) => void;
  onExportStem: (key: StemKey) => void;
  onExportCombinedMix: () => void;
}

const STEM_META: Array<{ key: StemKey; label: string; color: string; Icon: React.FC<any> }> = [
  { key: 'vocals', label: 'Vocal', color: '#38BDF8', Icon: Mic },
  { key: 'drums', label: 'Bateria', color: '#F59E0B', Icon: Drum },
  { key: 'bass', label: 'Baixo', color: '#10B981', Icon: Guitar },
  { key: 'other', label: 'Outros Instrumentos', color: '#A855F7', Icon: Music },
];

export const StemMixerPanel: React.FC<StemMixerPanelProps> = ({
  stemsAnalysis,
  mixer,
  separating,
  progressPct,
  progressMsg,
  onSeparate,
  onMixerChange,
  onExportStem,
  onExportCombinedMix,
}) => {
  const hasStems = Boolean(stemsAnalysis?.stems?.vocals);

  const toggleMute = (k: StemKey) => {
    onMixerChange({
      ...mixer,
      mutes: { ...mixer.mutes, [k]: !mixer.mutes[k] },
    });
  };

  const toggleSolo = (k: StemKey) => {
    onMixerChange({
      ...mixer,
      solos: { ...mixer.solos, [k]: !mixer.solos[k] },
    });
  };

  const setVol = (k: StemKey, val: number) => {
    onMixerChange({
      ...mixer,
      volumes: { ...mixer.volumes, [k]: val },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-purple-400" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Separação de Instrumentos (4 Stems)
            </h3>
            <p className="text-[11px] text-slate-400">
              Isole Vocal, Bateria, Baixo e Outros com controle independente de volume, Mute, Solo e exportação.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasStems && (
            <button
              type="button"
              onClick={() => onMixerChange({ ...mixer, enabled: !mixer.enabled })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition ${
                mixer.enabled
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              {mixer.enabled ? 'Mixer Stems ATIVO' : 'Ativar Reprodução por Stems'}
            </button>
          )}

          <button
            type="button"
            disabled={separating}
            onClick={onSeparate}
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            {separating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
            <span>{separating ? 'Separando...' : hasStems ? 'Reprocessar Stems' : 'Separar 4 Stems'}</span>
          </button>

          {hasStems && (
            <button
              type="button"
              onClick={onExportCombinedMix}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar Mix
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {separating && (
        <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-3 flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-purple-200">{progressMsg || 'Processando separação...'}</span>
            <span className="font-mono text-purple-300">{Math.round(progressPct)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-purple-500 transition-all duration-300"
              style={{ width: `${Math.max(8, progressPct)}%` }}
            />
          </div>
        </div>
      )}

      {/* Honest Engine & Quality Notice */}
      {stemsAnalysis && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px] text-slate-300">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <div>
              <strong>Motor utilizado:</strong> {stemsAnalysis.engine}{' '}
              <span className="text-slate-500">({stemsAnalysis.processing_time_sec}s)</span>
            </div>
            <div className="text-slate-400 mt-0.5">{stemsAnalysis.quality_notice}</div>
          </div>
        </div>
      )}

      {/* 4-Channel Stem Mixer */}
      {hasStems ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STEM_META.map(({ key, label, color, Icon }) => {
            const info = stemsAnalysis!.stems[key];
            const isMuted = mixer.mutes[key];
            const isSolo = mixer.solos[key];
            const vol = mixer.volumes[key];
            return (
              <div
                key={key}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${color}22`, color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{label}</div>
                      <div className="text-[10px] font-mono text-slate-500">
                        RMS {info ? (info.rms_level * 100).toFixed(1) : '0.0'}%
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onExportStem(key)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-300"
                    title={`Exportar stem ${label}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.01}
                    value={vol}
                    onChange={(e) => setVol(key, parseFloat(e.target.value))}
                    className="flex-1"
                    aria-label={`Volume ${label}`}
                  />
                  <span className="font-mono text-[11px] text-slate-300 w-9 text-right">
                    {Math.round(vol * 100)}%
                  </span>
                </div>

                {/* Mute & Solo Buttons */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleMute(key)}
                    className={`py-1 rounded-md text-xs font-bold border transition ${
                      isMuted
                        ? 'bg-rose-500/25 border-rose-400 text-rose-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    M (Mute)
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSolo(key)}
                    className={`py-1 rounded-md text-xs font-bold border transition ${
                      isSolo
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    S (Solo)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-slate-500 py-10 text-center border border-dashed border-slate-800 rounded-xl">
          Clique em &ldquo;Separar 4 Stems&rdquo; para extrair faixas independentes de Vocal, Bateria, Baixo e Outros.
        </div>
      )}
    </div>
  );
};

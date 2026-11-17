import React from 'react';
import {
  Activity,
  Flag,
  Play,
  Pause,
  Square,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Repeat,
  Timer,
  Hand,
  SkipBack,
} from 'lucide-react';
import { formatTime } from '../data/chordDiagrams';

const PRECOUNT_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 0.5, label: '0,5s' },
  { value: 1, label: '1s' },
  { value: 2, label: '2s' },
  { value: 3, label: '3s' },
  { value: 5, label: '5s' },
];

interface TransportBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  loopEnabled: boolean;
  loopA: number;
  loopB: number;
  precountSec: number;
  precountRemaining: number;
  tapBpm: number | null;
  currentChordSymbol: string | null;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (sec: number) => void;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  onToggleLoop: () => void;
  onPrecountChange: (sec: number) => void;
  onTapTempo: () => void;
  onApplyTapBpm: () => void;
  onAddMarkerNow?: () => void;
  onAddBeatNow?: () => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  muted,
  loopEnabled,
  loopA,
  loopB,
  precountSec,
  precountRemaining,
  tapBpm,
  currentChordSymbol,
  onTogglePlay,
  onStop,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleLoop,
  onPrecountChange,
  onTapTempo,
  onApplyTapBpm,
  onAddMarkerNow,
  onAddBeatNow,
}) => {
  return (
    <div className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2.5 flex flex-wrap items-center justify-between gap-3">
      {/* Main Playback Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSeek(loopEnabled ? loopA : 0)}
          className="p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 transition"
          title={loopEnabled ? 'Ir para Ponto A' : 'Início da faixa'}
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onSeek(Math.max(0, currentTime - 5))}
          className="p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 transition"
          title="Voltar 5 segundos (←)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-900/40'
              : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-900/40'
          }`}
          title="Reproduzir / Pausar (Espaço)"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={onStop}
          className="p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 transition"
          title="Parar"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>

        <button
          type="button"
          onClick={() => onSeek(Math.min(duration, currentTime + 5))}
          className="p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 transition"
          title="Avançar 5 segundos (→)"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleLoop}
          className={`ml-1 px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
            loopEnabled
              ? 'bg-sky-500/20 border-sky-400 text-sky-300'
              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Ativar/Desativar Loop A/B (L)"
        >
          <Repeat className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {loopB > loopA + 0.05 ? `A ${formatTime(loopA, false)} → B ${formatTime(loopB, false)}` : 'Loop A/B'}
          </span>
        </button>

        {onAddMarkerNow && (
          <button
            type="button"
            onClick={onAddMarkerNow}
            className="px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border bg-slate-800/90 border-slate-700 text-sky-300 hover:bg-slate-700 transition"
            title="Adicionar Marca na posição atual (Tecla M)"
          >
            <Flag className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Marca</span>
            <kbd className="text-[9px] px-1 rounded bg-slate-900 text-slate-400 font-mono">M</kbd>
          </button>
        )}

        {onAddBeatNow && (
          <button
            type="button"
            onClick={onAddBeatNow}
            className="px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border bg-slate-800/90 border-slate-700 text-emerald-300 hover:bg-slate-700 transition"
            title="Registrar Batida na posição atual e estimar BPM (Tecla B)"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Batida</span>
            <kbd className="text-[9px] px-1 rounded bg-slate-900 text-slate-400 font-mono">B</kbd>
          </button>
        )}
      </div>

      {/* Time Readout + Live Chord Pill + Precount Countdown */}
      <div className="flex items-center gap-3">
        <div className="font-mono text-sm sm:text-base bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-1.5 flex items-baseline gap-1.5">
          <span className="text-sky-300 font-bold">{formatTime(currentTime)}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400 text-xs">{formatTime(duration)}</span>
        </div>

        {precountRemaining > 0 && (
          <div className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/60 text-amber-300 text-xs font-bold animate-pulse">
            Pré-contagem: {precountRemaining.toFixed(1)}s
          </div>
        )}

        {currentChordSymbol && currentChordSymbol !== 'N.C.' && (
          <div
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/40"
            title="Acorde sincronizado no momento atual"
          >
            <span className="text-[10px] uppercase tracking-wider text-indigo-300">Acorde</span>
            <span className="text-sm font-extrabold text-white">{currentChordSymbol}</span>
          </div>
        )}
      </div>

      {/* Pre-count Selector + Tap Tempo + Master Volume */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-800 rounded-lg p-1">
          <Timer className="w-3.5 h-3.5 text-slate-400 ml-1" />
          <span className="text-[10px] text-slate-400 mr-1 hidden xl:inline">Pré-cont.:</span>
          {PRECOUNT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onPrecountChange(opt.value)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition ${
                Math.abs(precountSec - opt.value) < 0.01
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Tap Tempo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onTapTempo}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 active:scale-95 transition"
            title="Clique ritmicamente (ou tecla T) para medir o BPM"
          >
            <Hand className="w-3.5 h-3.5 text-amber-400" />
            <span>Tap{tapBpm ? ` ${tapBpm}` : ''}</span>
          </button>
          {tapBpm && (
            <button
              type="button"
              onClick={onApplyTapBpm}
              className="px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold"
              title="Aplicar BPM medido ao projeto"
            >
              Usar
            </button>
          )}
        </div>

        {/* Master Volume */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleMute}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300"
            title={muted ? 'Ativar som' : 'Silenciar'}
          >
            {muted || volume <= 0.01 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1.25}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-20 cursor-pointer"
            aria-label="Volume master"
          />
        </div>
      </div>
    </div>
  );
};

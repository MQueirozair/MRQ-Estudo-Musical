import React from 'react';
import { FolderOpen, Gauge, Music2, Radio, RotateCcw, Minus, Plus } from 'lucide-react';

const SPEED_PRESETS = [0.25, 0.35, 0.5, 0.6, 0.75, 0.85, 1.0, 1.25, 1.5, 2.0];
const YOUTUBE_SPEED_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

interface SpeedPitchPanelProps {
  speed: number;
  semitones: number;
  octaves: number;
  cents: number;
  processingAudio: boolean;
  isYouTubeMode?: boolean;
  onOpenLocalAudio?: () => void;
  onOpenSystemCapture?: () => void;
  onSpeedChange: (speed: number) => void;
  onSemitonesChange: (st: number) => void;
  onOctavesChange: (oct: number) => void;
  onCentsChange: (cents: number) => void;
  onResetPitch: () => void;
}

export const SpeedPitchPanel: React.FC<SpeedPitchPanelProps> = ({
  speed,
  semitones,
  octaves,
  cents,
  processingAudio,
  isYouTubeMode = false,
  onOpenLocalAudio,
  onOpenSystemCapture,
  onSpeedChange,
  onSemitonesChange,
  onOctavesChange,
  onCentsChange,
  onResetPitch,
}) => {
  const totalSemitones = semitones + octaves * 12;
  const presets = isYouTubeMode ? YOUTUBE_SPEED_PRESETS : SPEED_PRESETS;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* SPEED / REAL TIME STRETCHING PANEL */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {isYouTubeMode ? 'Velocidade do Vídeo (YouTube)' : 'Velocidade (Time Stretching Real)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {processingAudio && !isYouTubeMode && (
              <span className="text-[10px] text-sky-300 animate-pulse font-mono">DSP C++...</span>
            )}
            <span className="font-mono text-sm font-extrabold text-sky-300 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-md">
              {Math.round(speed * 100)}%
            </span>
          </div>
        </div>

        {/* Preset Buttons: 25% to 200% */}
        <div className={`grid ${isYouTubeMode ? 'grid-cols-4 sm:grid-cols-8' : 'grid-cols-5 sm:grid-cols-10'} gap-1`}>
          {presets.map((p) => {
            const active = Math.abs(speed - p) < 0.01;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onSpeedChange(p)}
                className={`py-1.5 rounded-md text-[11px] font-mono font-semibold transition border ${
                  active
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow shadow-sky-900/40'
                    : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-600 hover:text-white'
                }`}
              >
                {Math.round(p * 100)}%
              </button>
            );
          })}
        </div>

        {/* Continuous Slider */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500">25%</span>
          <input
            type="range"
            min={0.25}
            max={2.0}
            step={isYouTubeMode ? 0.25 : 0.05}
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="flex-1 cursor-pointer"
            aria-label="Velocidade de reprodução sem alterar afinação"
          />
          <span className="text-[10px] font-mono text-slate-500">200%</span>
          <button
            type="button"
            onClick={() => onSpeedChange(1.0)}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
          >
            100%
          </button>
        </div>
        <p className="text-[10px] text-slate-500">
          {isYouTubeMode
            ? 'Velocidade oficial do Player YouTube (25% a 200%) preservando a afinação original do vídeo.'
            : 'Phase Vocoder C++17 com travamento de fase: mantém a tonalidade original intacta em qualquer andamento.'}
        </p>
      </div>

      {/* PITCH / INDEPENDENT TRANSPOSITION PANEL */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music2 className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Afinação & Transposição
            </span>
          </div>
          {!isYouTubeMode && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded-md">
                {totalSemitones >= 0 ? `+${totalSemitones}` : totalSemitones} st · {cents >= 0 ? `+${cents}` : cents}¢
              </span>
              <button
                type="button"
                onClick={onResetPitch}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 flex items-center gap-1"
                title="Restaurar afinação original"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar</span>
              </button>
            </div>
          )}
        </div>

        {isYouTubeMode ? (
          <div className="flex-1 rounded-xl bg-slate-950/70 border border-slate-800 p-3 flex flex-col justify-between gap-2.5">
            <p className="text-xs text-slate-300 leading-relaxed">
              O Player oficial incorporado do YouTube altera a velocidade mantendo o tom, mas não libera o fluxo de
              áudio para transposição em semitons/cents (conformidade com os Termos do YouTube).
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">
                Capture o <strong className="text-emerald-300">Som do Sistema</strong> ou vincule um áudio para liberar
                Pitch ±12 st, Forma de Onda, IA e 4 Stems:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {onOpenSystemCapture && (
                  <button
                    type="button"
                    onClick={onOpenSystemCapture}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Capturar Som do Sistema</span>
                  </button>
                )}
                {onOpenLocalAudio && (
                  <button
                    type="button"
                    onClick={onOpenLocalAudio}
                    className="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-200 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Vincular Arquivo</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Semitones */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Semitons</span>
              <span className="font-mono text-white font-bold">{semitones >= 0 ? `+${semitones}` : semitones} st</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSemitonesChange(Math.max(-12, semitones - 1))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={semitones}
                onChange={(e) => onSemitonesChange(parseInt(e.target.value, 10))}
                className="flex-1 min-w-0"
                aria-label="Semitons"
              />
              <button
                type="button"
                onClick={() => onSemitonesChange(Math.min(12, semitones + 1))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Octaves */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Oitavas</span>
              <span className="font-mono text-white font-bold">{octaves >= 0 ? `+${octaves}` : octaves} oit</span>
            </div>
            <div className="flex items-center justify-between gap-1">
              {[-2, -1, 0, 1, 2].map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => onOctavesChange(o)}
                  className={`flex-1 py-1 rounded text-[11px] font-mono font-bold transition ${
                    octaves === o
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {o > 0 ? `+${o}` : o}
                </button>
              ))}
            </div>
          </div>

          {/* Cents (Fine Tuning) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Afinação Fina</span>
              <span className="font-mono text-white font-bold">{cents >= 0 ? `+${cents}` : cents}¢</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onCentsChange(Math.max(-50, cents - 5))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={cents}
                onChange={(e) => onCentsChange(parseInt(e.target.value, 10))}
                className="flex-1 min-w-0"
                aria-label="Cents"
              />
              <button
                type="button"
                onClick={() => onCentsChange(Math.min(50, cents + 5))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-slate-500">
          Transposição independente da velocidade: ideal para ajustar gravações fora de A=440Hz ou adaptar ao tom vocal/instrumento.
        </p>
          </>
        )}
      </div>
    </div>
  );
};

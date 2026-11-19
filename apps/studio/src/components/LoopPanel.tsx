import React, { useState } from 'react';
import { Repeat, Save, Trash2, Play, Download, Edit2, Check, X } from 'lucide-react';
import type { LoopItem } from '../types/music';
import { formatTime } from '../data/chordDiagrams';

interface LoopPanelProps {
  loops: LoopItem[];
  duration: number;
  currentTime: number;
  loopEnabled: boolean;
  loopA: number;
  loopB: number;
  speed: number;
  semitones: number;
  cents: number;
  onSetLoop: (a: number, b: number, enable?: boolean) => void;
  onToggleLoop: () => void;
  onSaveLoop: (loop: Partial<LoopItem>) => Promise<void>;
  onDeleteLoop: (id: string) => Promise<void>;
  onApplySavedLoop: (loop: LoopItem, autoPlay: boolean) => void;
  onExportLoop: (a: number, b: number) => void;
}

const LOOP_COLORS = ['#38BDF8', '#22C55E', '#A855F7', '#F59E0B', '#F43F5E'];

export const LoopPanel: React.FC<LoopPanelProps> = ({
  loops,
  duration,
  currentTime,
  loopEnabled,
  loopA,
  loopB,
  speed,
  semitones,
  cents,
  onSetLoop,
  onToggleLoop,
  onSaveLoop,
  onDeleteLoop,
  onApplySavedLoop,
  onExportLoop,
}) => {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleSaveCurrent = async () => {
    if (loopB <= loopA + 0.05) return;
    await onSaveLoop({
      name: newName.trim() || `Loop ${loops.length + 1} (${formatTime(loopA, false)}–${formatTime(loopB, false)})`,
      start_sec: Number(loopA.toFixed(3)),
      end_sec: Number(loopB.toFixed(3)),
      speed,
      semitones,
      cents,
      color: LOOP_COLORS[loops.length % LOOP_COLORS.length],
    });
    setNewName('');
  };

  const commitRename = async (lp: LoopItem) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    await onSaveLoop({ ...lp, name: editName.trim() });
    setEditingId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Active Loop A/B Controls */}
      <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Loop A/B Ativo</h3>
          </div>
          <button
            type="button"
            onClick={onToggleLoop}
            className={`px-3 py-1 rounded-full text-xs font-bold transition ${
              loopEnabled ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {loopEnabled ? 'Ativo' : 'Desligado'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-400">Ponto A (Início)</span>
              <button
                type="button"
                onClick={() => onSetLoop(currentTime, Math.max(currentTime + 0.5, loopB || duration), true)}
                className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[10px] font-semibold"
              >
                Definir Agora
              </button>
            </div>
            <input
              type="number"
              min={0}
              max={Math.max(0, duration)}
              step={0.1}
              value={Number(loopA.toFixed(2))}
              onChange={(e) => {
                const v = Math.max(0, parseFloat(e.target.value) || 0);
                onSetLoop(v, Math.max(v + 0.2, loopB), true);
              }}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-xs text-white"
            />
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-400">Ponto B (Fim)</span>
              <button
                type="button"
                onClick={() => onSetLoop(Math.min(loopA, Math.max(0, currentTime - 0.5)), currentTime, true)}
                className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[10px] font-semibold"
              >
                Definir Agora
              </button>
            </div>
            <input
              type="number"
              min={0}
              max={Math.max(0, duration)}
              step={0.1}
              value={Number(loopB.toFixed(2))}
              onChange={(e) => {
                const v = Math.min(duration, Math.max(loopA + 0.2, parseFloat(e.target.value) || 0));
                onSetLoop(loopA, v, true);
              }}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-xs text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Nome do loop (ex: Solo guitarra 60%)..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
          />
          <button
            type="button"
            disabled={loopB <= loopA + 0.05}
            onClick={handleSaveCurrent}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            Salvar Loop
          </button>
        </div>

        {loopB > loopA + 0.05 && (
          <button
            type="button"
            onClick={() => onExportLoop(loopA, loopB)}
            className="w-full py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Trecho A→B ({formatTime(loopA, false)}–{formatTime(loopB, false)}) na Velocidade/Tom Atual
          </button>
        )}
      </div>

      {/* Saved Loops List */}
      <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Loops Salvos no Projeto ({loops.length})
          </h3>
          <span className="text-[11px] text-slate-500">Persistidos automaticamente em SQLite</span>
        </div>

        {loops.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center border border-dashed border-slate-800 rounded-lg">
            Nenhum loop salvo ainda. Arraste sobre o waveform para marcar A→B e clique em &ldquo;Salvar Loop&rdquo;.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {loops.map((lp) => (
              <div
                key={lp.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: lp.color || '#38BDF8' }}
                  />
                  {editingId === lp.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && commitRename(lp)}
                        className="bg-slate-900 border border-sky-500 rounded px-2 py-0.5 text-xs text-white flex-1"
                        autoFocus
                      />
                      <button type="button" onClick={() => commitRename(lp)} className="text-emerald-400 p-1">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-slate-400 p-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100 truncate">{lp.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {formatTime(lp.start_sec)} → {formatTime(lp.end_sec)} ·{' '}
                        <span className="text-sky-300">{Math.round((lp.speed || 1) * 100)}%</span>
                        {lp.semitones !== 0 && (
                          <span className="text-indigo-300">
                            {' '}
                            · {lp.semitones > 0 ? `+${lp.semitones}` : lp.semitones}st
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onApplySavedLoop(lp, true)}
                    className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[11px] font-semibold flex items-center gap-1"
                    title="Tocar somente este loop na velocidade salva"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Tocar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(lp.id);
                      setEditName(lp.name);
                    }}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Renomear loop"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExportLoop(lp.start_sec, lp.end_sec)}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300"
                    title="Exportar este loop"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteLoop(lp.id)}
                    className="p-1.5 rounded bg-slate-800 hover:bg-rose-900/60 text-rose-400"
                    title="Excluir loop"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Volume2,
  Edit3,
  Plus,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Download,
} from 'lucide-react';
import type { DetectedChord } from '../types/music';
import { formatTime, getGuitarDiagram, getPianoDiagram } from '../data/chordDiagrams';
import { midiSynth } from '../audio/midiSynth';

interface ChordPanelProps {
  chords: DetectedChord[];
  currentTime: number;
  duration: number;
  analysisMeta?: {
    progression_summary?: string;
    average_confidence?: number;
    low_confidence?: boolean;
    warning?: string | null;
  };
  onChordsChange: (chords: DetectedChord[]) => void;
  onAnalyzeChords: () => void;
  onSeek: (sec: number) => void;
  onExportChordsTxt: () => void;
}

/** Real SVG Guitar Fretboard Diagram */
const GuitarChordSVG: React.FC<{ symbol: string }> = ({ symbol }) => {
  const diag = useMemo(() => getGuitarDiagram(symbol), [symbol]);
  const stringX = [24, 42, 60, 78, 96, 114];
  const fretY = [34, 56, 78, 100, 122];

  return (
    <svg viewBox="0 0 144 148" className="w-36 h-36 mx-auto">
      <text x="72" y="16" textAnchor="middle" fill="#F8FAFC" fontSize="14" fontWeight="800">
        {diag.symbol}
      </text>
      {diag.baseFret > 1 && (
        <text x="10" y="50" fill="#38BDF8" fontSize="10" fontWeight="700">
          {diag.baseFret}ª
        </text>
      )}
      {/* Nut or Top Fret */}
      <line
        x1={stringX[0]}
        y1={fretY[0]}
        x2={stringX[5]}
        y2={fretY[0]}
        stroke={diag.baseFret === 1 ? '#F8FAFC' : '#64748B'}
        strokeWidth={diag.baseFret === 1 ? 4 : 1.5}
      />
      {/* Frets */}
      {fretY.slice(1).map((y, i) => (
        <line key={i} x1={stringX[0]} y1={y} x2={stringX[5]} y2={y} stroke="#475569" strokeWidth={1.2} />
      ))}
      {/* Strings */}
      {stringX.map((x, i) => (
        <line key={i} x1={x} y1={fretY[0]} x2={x} y2={fretY[4]} stroke="#94A3B8" strokeWidth={1.6 - i * 0.14} />
      ))}
      {/* Barre */}
      {diag.barre && (
        <rect
          x={stringX[diag.barre.fromString] - 6}
          y={fretY[0] + (diag.barre.fret - diag.baseFret) * 22 + 5}
          width={stringX[diag.barre.toString] - stringX[diag.barre.fromString] + 12}
          height={12}
          rx={6}
          fill="#6366F1"
        />
      )}
      {/* Finger Dots / Open / Muted */}
      {diag.frets.map((f, sIdx) => {
        const x = stringX[sIdx];
        if (f < 0) {
          return (
            <text key={sIdx} x={x} y="28" textAnchor="middle" fill="#F43F5E" fontSize="10" fontWeight="700">
              ×
            </text>
          );
        }
        if (f === 0) {
          return (
            <circle key={sIdx} cx={x} cy="25" r="4" fill="none" stroke="#38BDF8" strokeWidth="1.5" />
          );
        }
        const rel = f - diag.baseFret;
        if (rel < 0 || rel > 3) return null;
        const cy = fretY[0] + rel * 22 + 11;
        return <circle key={sIdx} cx={x} cy={cy} r="6.5" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.2" />;
      })}
      {/* String names */}
      {['E', 'A', 'D', 'G', 'B', 'e'].map((lbl, i) => (
        <text key={i} x={stringX[i]} y="139" textAnchor="middle" fill="#64748B" fontSize="9" fontFamily="monospace">
          {lbl}
        </text>
      ))}
    </svg>
  );
};

/** Real SVG 2-Octave Keyboard Diagram highlighting chord notes */
const PianoChordSVG: React.FC<{ symbol: string }> = ({ symbol }) => {
  const diag = useMemo(() => getPianoDiagram(symbol), [symbol]);
  const noteSet = new Set(diag.midiNotes.map((m) => m % 12));
  const rootPc = diag.rootMidi % 12;

  // Render 14 white keys (C to B × 2 octaves)
  const whiteOffsets = [0, 2, 4, 5, 7, 9, 11];
  const blackPositions: Array<{ afterWhite: number; pc: number }> = [
    { afterWhite: 0, pc: 1 },
    { afterWhite: 1, pc: 3 },
    { afterWhite: 3, pc: 6 },
    { afterWhite: 4, pc: 8 },
    { afterWhite: 5, pc: 10 },
  ];
  const kw = 18;
  const kh = 72;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox={`0 0 ${14 * kw + 4} ${kh + 14}`} className="w-full max-w-[260px] h-24">
        {[0, 1].map((oct) =>
          whiteOffsets.map((pc, idx) => {
            const wIdx = oct * 7 + idx;
            const x = 2 + wIdx * kw;
            const active = noteSet.has(pc);
            const isRoot = active && pc === rootPc;
            return (
              <rect
                key={`w-${oct}-${pc}`}
                x={x}
                y={4}
                width={kw - 1}
                height={kh}
                rx={2}
                fill={isRoot ? '#38BDF8' : active ? '#818CF8' : '#F1F5F9'}
                stroke="#0F172A"
                strokeWidth="1"
              />
            );
          })
        )}
        {[0, 1].map((oct) =>
          blackPositions.map((bp) => {
            const wIdx = oct * 7 + bp.afterWhite;
            const x = 2 + (wIdx + 1) * kw - 6;
            const active = noteSet.has(bp.pc);
            const isRoot = active && bp.pc === rootPc;
            return (
              <rect
                key={`b-${oct}-${bp.pc}`}
                x={x}
                y={4}
                width={11}
                height={44}
                rx={2}
                fill={isRoot ? '#0EA5E9' : active ? '#6366F1' : '#1E293B'}
                stroke="#020617"
                strokeWidth="1"
              />
            );
          })
        )}
      </svg>
      <div className="text-[11px] font-mono text-slate-300">
        Notas: <strong className="text-sky-300">{diag.noteNames.join(' · ') || '—'}</strong>
      </div>
    </div>
  );
};

export const ChordPanel: React.FC<ChordPanelProps> = ({
  chords,
  currentTime,
  duration,
  analysisMeta,
  onChordsChange,
  onAnalyzeChords,
  onSeek,
  onExportChordsTxt,
}) => {
  const [selectedChordId, setSelectedChordId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSymbol, setEditSymbol] = useState('');

  const activeChord =
    chords.find((c) => currentTime >= c.start_sec && currentTime < c.end_sec) ||
    chords.find((c) => c.id === selectedChordId) ||
    chords[0] ||
    null;

  const inspectChord =
    (selectedChordId ? chords.find((c) => c.id === selectedChordId) : null) || activeChord;

  const handlePlayChord = (symbol: string) => {
    const p = getPianoDiagram(symbol);
    if (p.midiNotes.length > 0) {
      midiSynth.playChord(p.midiNotes, 1.15);
    }
  };

  const commitEdit = (chord: DetectedChord) => {
    const sym = editSymbol.trim();
    if (!sym) {
      setEditingId(null);
      return;
    }
    const diag = getPianoDiagram(sym);
    const updated = chords.map((c) =>
      c.id === chord.id ? { ...c, symbol: sym, notes: diag.noteNames, edited: true, confidence: 1.0 } : c
    );
    onChordsChange(updated);
    setEditingId(null);
  };

  const handleAddChordAtCursor = () => {
    const sym = 'Am';
    const diag = getPianoDiagram(sym);
    const created: DetectedChord = {
      id: `ch_${Date.now().toString(36)}`,
      symbol: sym,
      root: 'A',
      quality: 'm',
      notes: diag.noteNames,
      start_sec: Number(currentTime.toFixed(3)),
      end_sec: Number(Math.min(duration || currentTime + 2, currentTime + 2).toFixed(3)),
      confidence: 1.0,
      edited: true,
    };
    const next = [...chords, created].sort((a, b) => a.start_sec - b.start_sec);
    onChordsChange(next);
    setSelectedChordId(created.id);
    setEditingId(created.id);
    setEditSymbol(sym);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Synchronized Chord Progression Timeline */}
      <div className="lg:col-span-7 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Acordes Sincronizados ({chords.length})
            </h3>
            {analysisMeta?.average_confidence !== undefined && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  analysisMeta.average_confidence >= 0.55
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                }`}
              >
                Confiança: {Math.round(analysisMeta.average_confidence * 100)}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleAddChordAtCursor}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
            <button
              type="button"
              onClick={onAnalyzeChords}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Detectar Acordes
            </button>
            <button
              type="button"
              onClick={onExportChordsTxt}
              disabled={chords.length === 0}
              className="px-2 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              Cifra TXT
            </button>
          </div>
        </div>

        {analysisMeta?.warning && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{analysisMeta.warning}</span>
          </div>
        )}

        {chords.length === 0 ? (
          <div className="text-xs text-slate-500 py-10 text-center border border-dashed border-slate-800 rounded-xl">
            Nenhum acorde detectado ainda. Clique em &ldquo;Detectar Acordes&rdquo; ou &ldquo;Analisar IA&rdquo;.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-2 rounded-xl bg-slate-950/70 border border-slate-800">
            {chords.map((c) => {
              const isPlayingHere = currentTime >= c.start_sec && currentTime < c.end_sec;
              const isSelected = inspectChord?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedChordId(c.id);
                    onSeek(c.start_sec);
                    handlePlayChord(c.symbol);
                  }}
                  className={`group relative cursor-pointer rounded-xl px-3 py-2 border transition min-w-[82px] ${
                    isPlayingHere
                      ? 'bg-indigo-600/35 border-indigo-400 shadow-lg shadow-indigo-950/60 scale-[1.03]'
                      : isSelected
                      ? 'bg-sky-500/15 border-sky-400'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {editingId === c.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        value={editSymbol}
                        onChange={(e) => setEditSymbol(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && commitEdit(c)}
                        className="w-16 bg-slate-950 border border-sky-500 rounded px-1 py-0.5 text-xs font-bold text-white"
                        autoFocus
                      />
                      <button type="button" onClick={() => commitEdit(c)} className="text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-slate-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-base font-extrabold text-white">{c.symbol}</span>
                        <div className="hidden group-hover:flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(c.id);
                              setEditSymbol(c.symbol);
                            }}
                            className="p-0.5 text-slate-400 hover:text-sky-300"
                            title="Editar cifra manualmente"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onChordsChange(chords.filter((x) => x.id !== c.id))}
                            className="p-0.5 text-slate-400 hover:text-rose-400"
                            title="Remover acorde"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center justify-between gap-2">
                        <span>{formatTime(c.start_sec, false)}</span>
                        <span className={c.edited ? 'text-amber-400' : 'text-slate-500'}>
                          {c.edited ? 'edit' : `${Math.round(c.confidence * 100)}%`}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Guitar & Piano Diagrams for Selected/Current Chord */}
      <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Diagramas — Violão & Teclado
          </h3>
          {inspectChord && inspectChord.symbol !== 'N.C.' && (
            <button
              type="button"
              onClick={() => handlePlayChord(inspectChord.symbol)}
              className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-semibold flex items-center gap-1"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Ouvir {inspectChord.symbol}
            </button>
          )}
        </div>

        {inspectChord && inspectChord.symbol !== 'N.C.' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 text-center mb-1">Violão / Guitarra</div>
              <GuitarChordSVG symbol={inspectChord.symbol} />
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 flex flex-col justify-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 text-center mb-2">Teclado / Piano</div>
              <PianoChordSVG symbol={inspectChord.symbol} />
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 py-10 text-center">
            Clique em um acorde para visualizar os diagramas de Violão e Teclado e ouvir sua sonoridade.
          </div>
        )}
      </div>
    </div>
  );
};

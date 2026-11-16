import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Square,
  MousePointer2,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlignLeft,
  Download,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import type { TranscribedNote } from '../types/music';
import { midiSynth } from '../audio/midiSynth';

interface PianoRollProps {
  notes: TranscribedNote[];
  duration: number;
  currentTime: number;
  bpm: number;
  speed: number;
  analysisMeta?: {
    engine?: string;
    average_confidence?: number;
    low_confidence?: boolean;
    warning?: string | null;
  };
  onNotesChange: (notes: TranscribedNote[]) => void;
  onExportMidi: () => void;
  onAnalyzeNotes: () => void;
  onSeek: (sec: number) => void;
}

const MIN_MIDI = 36; // C2
const MAX_MIDI = 84; // C6
const KEY_WIDTH = 52;
const ROW_H = 14;
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

function midiName(m: number): string {
  return `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
}

export const PianoRoll: React.FC<PianoRollProps> = ({
  notes,
  duration,
  currentTime,
  bpm,
  speed,
  analysisMeta,
  onNotesChange,
  onExportMidi,
  onAnalyzeNotes,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollWrapRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<'select' | 'draw'>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pxPerSec, setPxPerSec] = useState(110);
  const [midiPlaying, setMidiPlaying] = useState(false);
  const [midiPlayhead, setMidiPlayhead] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | 'melody' | 'harmony' | 'bass'>('all');

  const dragRef = useRef<{
    kind: 'none' | 'move' | 'resize';
    noteId: string;
    origStart: number;
    origDur: number;
    origPitch: number;
    startX: number;
    startY: number;
  }>({ kind: 'none', noteId: '', origStart: 0, origDur: 0.25, origPitch: 60, startX: 0, startY: 0 });

  const totalDur = Math.max(duration || 16, ...notes.map((n) => n.start_sec + n.duration_sec), 8);
  const numRows = MAX_MIDI - MIN_MIDI + 1;
  const gridWidth = Math.max(700, Math.ceil(totalDur * pxPerSec));
  const canvasWidth = KEY_WIDTH + gridWidth;
  const canvasHeight = numRows * ROW_H;

  const visibleNotes = roleFilter === 'all' ? notes : notes.filter((n) => n.role === roleFilter);
  const activeCursor = midiPlayhead !== null ? midiPlayhead : currentTime;

  useEffect(() => {
    return () => {
      midiSynth.stopSequence();
    };
  }, []);

  // Delete key shortcut for selected note
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        onNotesChange(notes.filter((n) => n.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, notes, onNotesChange]);

  // Draw Piano Roll Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvasWidth * dpr);
    canvas.height = Math.round(canvasHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Background pitch lanes + Piano Keyboard
    for (let midi = MAX_MIDI; midi >= MIN_MIDI; midi--) {
      const row = MAX_MIDI - midi;
      const y = row * ROW_H;
      const pc = midi % 12;
      const isBlack = BLACK_PCS.has(pc);

      // Lane background
      ctx.fillStyle = isBlack ? '#0B1220' : '#101A2E';
      ctx.fillRect(KEY_WIDTH, y, gridWidth, ROW_H);
      ctx.strokeStyle = pc === 0 ? '#334155' : '#182338';
      ctx.lineWidth = pc === 0 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(KEY_WIDTH, y + ROW_H);
      ctx.lineTo(canvasWidth, y + ROW_H);
      ctx.stroke();

      // Piano Key on left
      ctx.fillStyle = isBlack ? '#1E293B' : '#E2E8F0';
      ctx.fillRect(0, y, KEY_WIDTH - 1, ROW_H - 0.5);
      ctx.strokeStyle = '#0F172A';
      ctx.strokeRect(0, y, KEY_WIDTH - 1, ROW_H);

      if (pc === 0 || pc === 9) {
        ctx.fillStyle = isBlack ? '#94A3B8' : '#0F172A';
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.fillText(midiName(midi), 6, y + ROW_H - 3);
      }
    }

    // 2. Vertical Beat & Bar Grid
    const beatSec = 60 / Math.max(40, bpm || 120);
    const totalBeats = Math.ceil(totalDur / beatSec);
    for (let b = 0; b <= totalBeats; b++) {
      const x = KEY_WIDTH + b * beatSec * pxPerSec;
      const isBar = b % 4 === 0;
      ctx.strokeStyle = isBar ? 'rgba(148, 163, 184, 0.32)' : 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = isBar ? 1.1 : 0.6;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();

      if (isBar) {
        ctx.fillStyle = '#64748B';
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillText(`C${b / 4 + 1}`, x + 3, 10);
      }
    }

    // 3. Draw Notes with Velocity Intensity & Role Colors
    for (const n of visibleNotes) {
      if (n.pitch < MIN_MIDI || n.pitch > MAX_MIDI) continue;
      const x = KEY_WIDTH + n.start_sec * pxPerSec;
      const w = Math.max(6, n.duration_sec * pxPerSec);
      const y = (MAX_MIDI - n.pitch) * ROW_H + 1;
      const h = ROW_H - 2;
      const isSelected = n.id === selectedId;
      const isActive = activeCursor >= n.start_sec && activeCursor <= n.start_sec + n.duration_sec;

      let fill = '#6366F1'; // harmony
      if (n.role === 'melody') fill = '#0EA5E9';
      else if (n.role === 'bass') fill = '#10B981';
      if (n.edited) fill = '#F59E0B';
      if (isActive) fill = '#FACC15';

      const alpha = Math.max(0.45, Math.min(1, (n.velocity || 90) / 115));
      ctx.globalAlpha = isSelected || isActive ? 1.0 : alpha;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 3);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(15, 23, 42, 0.7)';
      ctx.lineWidth = isSelected ? 1.8 : 0.8;
      ctx.stroke();

      // Resize handle on right edge
      if (w >= 14) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(x + w - 3, y + 2, 2, h - 4);
      }

      if (w >= 26) {
        ctx.fillStyle = isActive || n.edited ? '#0F172A' : '#F8FAFC';
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.fillText(n.note_name || midiName(n.pitch), x + 4, y + h - 2.5);
      }
    }

    // 4. Playhead
    const px = KEY_WIDTH + activeCursor * pxPerSec;
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvasHeight);
    ctx.stroke();

    ctx.restore();
  }, [visibleNotes, canvasWidth, canvasHeight, gridWidth, pxPerSec, bpm, totalDur, selectedId, activeCursor]);

  const coordsFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const midi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, MAX_MIDI - Math.floor(y / ROW_H)));
    const timeSec = Math.max(0, (x - KEY_WIDTH) / pxPerSec);
    return { x, y, midi, timeSec };
  };

  const findNoteAt = (x: number, y: number): { note: TranscribedNote; nearRight: boolean } | null => {
    for (let i = visibleNotes.length - 1; i >= 0; i--) {
      const n = visibleNotes[i];
      const nx = KEY_WIDTH + n.start_sec * pxPerSec;
      const nw = Math.max(6, n.duration_sec * pxPerSec);
      const ny = (MAX_MIDI - n.pitch) * ROW_H;
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + ROW_H) {
        return { note: n, nearRight: x >= nx + nw - 7 };
      }
    }
    return null;
  };

  const addNoteAt = (midi: number, timeSec: number) => {
    const beatSec = 60 / Math.max(40, bpm || 120);
    const created: TranscribedNote = {
      id: `ed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      pitch: midi,
      note_name: midiName(midi),
      start_sec: Number(timeSec.toFixed(4)),
      duration_sec: Number((beatSec * 0.5).toFixed(4)),
      velocity: 98,
      confidence: 1.0,
      role: midi < 50 ? 'bass' : 'melody',
      channel: 0,
      edited: true,
    };
    midiSynth.playNote(midi, 0.35, 98);
    onNotesChange([...notes, created].sort((a, b) => a.start_sec - b.start_sec));
    setSelectedId(created.id);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y, midi, timeSec } = coordsFromEvent(e);

    // Click on left Piano Keyboard -> audition note!
    if (x < KEY_WIDTH) {
      midiSynth.playNote(midi, 0.55, 100);
      return;
    }

    const hit = findNoteAt(x, y);
    if (hit) {
      setSelectedId(hit.note.id);
      midiSynth.playNote(hit.note.pitch, Math.min(0.6, hit.note.duration_sec), hit.note.velocity);
      dragRef.current = {
        kind: hit.nearRight ? 'resize' : 'move',
        noteId: hit.note.id,
        origStart: hit.note.start_sec,
        origDur: hit.note.duration_sec,
        origPitch: hit.note.pitch,
        startX: x,
        startY: y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === 'draw') {
      addNoteAt(midi, timeSec);
    } else {
      setSelectedId(null);
      onSeek(timeSec);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.kind === 'none') return;
    const { x, y } = coordsFromEvent(e);
    const d = dragRef.current;

    if (d.kind === 'resize') {
      const dt = (x - d.startX) / pxPerSec;
      const nextDur = Math.max(0.05, Number((d.origDur + dt).toFixed(4)));
      onNotesChange(
        notes.map((n) => (n.id === d.noteId ? { ...n, duration_sec: nextDur, edited: true } : n))
      );
    } else if (d.kind === 'move') {
      const dt = (x - d.startX) / pxPerSec;
      const dRows = Math.round((y - d.startY) / ROW_H);
      const nextStart = Math.max(0, Number((d.origStart + dt).toFixed(4)));
      const nextPitch = Math.max(MIN_MIDI, Math.min(MAX_MIDI, d.origPitch - dRows));
      onNotesChange(
        notes.map((n) =>
          n.id === d.noteId
            ? { ...n, start_sec: nextStart, pitch: nextPitch, note_name: midiName(nextPitch), edited: true }
            : n
        )
      );
    }
  };

  const handlePointerUp = () => {
    dragRef.current.kind = 'none';
  };

  const handleQuantize = (beatFraction: number) => {
    const gridSec = (60 / Math.max(40, bpm || 120)) * beatFraction;
    const targetIds = selectedId ? new Set([selectedId]) : null;
    const next = notes.map((n) => {
      if (targetIds && !targetIds.has(n.id)) return n;
      const qStart = Math.max(0, Math.round(n.start_sec / gridSec) * gridSec);
      const qDur = Math.max(gridSec * 0.5, Math.round(n.duration_sec / gridSec) * gridSec);
      return {
        ...n,
        start_sec: Number(qStart.toFixed(4)),
        duration_sec: Number(qDur.toFixed(4)),
        edited: true,
      };
    });
    onNotesChange(next);
  };

  const handleTransposeOctave = (delta: number) => {
    const targetIds = selectedId ? new Set([selectedId]) : null;
    const next = notes.map((n) => {
      if (targetIds && !targetIds.has(n.id)) return n;
      const p = Math.max(24, Math.min(108, n.pitch + delta));
      return { ...n, pitch: p, note_name: midiName(p), edited: true };
    });
    onNotesChange(next);
  };

  const handleToggleMidiPlay = () => {
    if (midiPlaying) {
      midiSynth.stopSequence();
      setMidiPlaying(false);
      setMidiPlayhead(null);
      return;
    }
    setMidiPlaying(true);
    midiSynth.playSequence(
      visibleNotes,
      currentTime,
      speed,
      (t) => setMidiPlayhead(t),
      () => {
        setMidiPlaying(false);
        setMidiPlayhead(null);
      }
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Piano Roll Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tools */}
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => setTool('select')}
              className={`px-2 py-1 rounded flex items-center gap-1 ${
                tool === 'select' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Selecionar, mover e redimensionar notas"
            >
              <MousePointer2 className="w-3.5 h-3.5" />
              <span>Mover</span>
            </button>
            <button
              type="button"
              onClick={() => setTool('draw')}
              className={`px-2 py-1 rounded flex items-center gap-1 ${
                tool === 'draw' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Criar novas notas clicando na grade"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Criar Nota</span>
            </button>
          </div>

          <button
            type="button"
            disabled={!selectedId}
            onClick={() => {
              if (!selectedId) return;
              onNotesChange(notes.filter((n) => n.id !== selectedId));
              setSelectedId(null);
            }}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-900/60 disabled:opacity-35 text-rose-300 flex items-center gap-1"
            title="Excluir nota selecionada (Delete)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excluir</span>
          </button>

          {/* Octave Shift */}
          <button
            type="button"
            onClick={() => handleTransposeOctave(12)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-0.5"
            title="Subir 1 oitava (nota selecionada ou todas)"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>+8ª</span>
          </button>
          <button
            type="button"
            onClick={() => handleTransposeOctave(-12)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-0.5"
            title="Descer 1 oitava (nota selecionada ou todas)"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>−8ª</span>
          </button>

          {/* Quantize */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
            <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-400 hidden md:inline">Quantizar:</span>
            <button
              type="button"
              onClick={() => handleQuantize(1)}
              className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono"
            >
              1/4
            </button>
            <button
              type="button"
              onClick={() => handleQuantize(0.5)}
              className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono"
            >
              1/8
            </button>
            <button
              type="button"
              onClick={() => handleQuantize(0.25)}
              className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono"
            >
              1/16
            </button>
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
          >
            <option value="all">Todas ({notes.length})</option>
            <option value="melody">Melodia</option>
            <option value="harmony">Harmonia</option>
            <option value="bass">Baixo</option>
          </select>
        </div>

        {/* Right: Play MIDI + Zoom + Transcribe + Export MIDI */}
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="range"
            min={55}
            max={240}
            value={pxPerSec}
            onChange={(e) => setPxPerSec(parseInt(e.target.value, 10))}
            className="w-20"
            title="Zoom horizontal do Piano Roll"
          />

          <button
            type="button"
            onClick={handleToggleMidiPlay}
            disabled={visibleNotes.length === 0}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition ${
              midiPlaying
                ? 'bg-amber-500 text-slate-950'
                : 'bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white'
            }`}
          >
            {midiPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{midiPlaying ? 'Parar MIDI' : 'Tocar MIDI'}</span>
          </button>

          <button
            type="button"
            onClick={onAnalyzeNotes}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transcrever IA</span>
          </button>

          <button
            type="button"
            onClick={onExportMidi}
            disabled={notes.length === 0}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar .MID</span>
          </button>
        </div>
      </div>

      {/* Confidence / Engine Banner */}
      {analysisMeta && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px]">
          <div className="flex items-center gap-3 text-slate-400">
            <span>
              Motor: <strong className="text-slate-200">{analysisMeta.engine || 'Offline DSP'}</strong>
            </span>
            <span>
              Confiança média:{' '}
              <strong className={(analysisMeta.average_confidence || 0) >= 0.55 ? 'text-emerald-400' : 'text-amber-400'}>
                {Math.round((analysisMeta.average_confidence || 0) * 100)}%
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-sky-500" />Melodia</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-500" />Harmonia</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" />Baixo</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500" />Editada</span>
          </div>
        </div>
      )}

      {analysisMeta?.warning && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{analysisMeta.warning}</span>
        </div>
      )}

      {/* Scrollable Piano Roll Canvas */}
      <div
        ref={scrollWrapRef}
        className="w-full h-[310px] overflow-auto rounded-xl border border-slate-800 bg-[#0B1220] select-none"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={(e) => {
            const { x, midi, timeSec } = coordsFromEvent(e as any);
            if (x >= KEY_WIDTH) addNoteAt(midi, timeSec);
          }}
          style={{ width: canvasWidth, height: canvasHeight }}
          className="block cursor-crosshair"
        />
      </div>
    </div>
  );
};

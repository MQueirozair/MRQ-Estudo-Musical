import React, { useEffect, useMemo, useRef, useState } from 'react';
import { beatIndexAt } from '../audio/rhythm';

interface Props { currentTime: number; playing: boolean; beats: number[]; beatDuration: number; beatsPerBar: number; bpm: number }

/** Follows detected/manual beat times when available; UI-clock timing is approximate. */
export function PracticeMetronome({ currentTime, playing, beats, beatDuration, beatsPerBar, bpm }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const ctx = useRef<AudioContext | null>(null);
  const previous = useRef<{ time: number; index: number } | null>(null);
  const grid = useMemo(() => Array.from(new Set(beats.filter(b => Number.isFinite(b) && b >= 0))).sort((a, b) => a - b), [beats]);
  useEffect(() => () => { void ctx.current?.close(); ctx.current = null; }, []);
  useEffect(() => {
    if (!enabled || !playing || !ctx.current) { previous.current = null; return; }
    const index = beatIndexAt(currentTime, grid, beatDuration);
    const last = previous.current;
    previous.current = { time: currentTime, index };
    // Ignore seeks and loop jumps; never replay a backlog of missed beats.
    if (!last || index < 0 || index <= last.index || currentTime < last.time || currentTime - last.time > 0.5) return;
    const audio = ctx.current;
    try {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      osc.frequency.value = index % beatsPerBar === 0 ? 1320 : 880;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + 0.06);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    } catch { setError('Não foi possível reproduzir o clique do metrônomo.'); setEnabled(false); }
  }, [currentTime, playing, enabled, grid, beatDuration, beatsPerBar]);

  const toggle = async () => {
    if (enabled) { setEnabled(false); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) throw new Error('Áudio indisponível neste navegador.');
      if (!ctx.current) ctx.current = new AC();
      await ctx.current.resume();
      setError(''); setEnabled(true);
    } catch { setError('Não foi possível ativar o metrônomo.'); }
  };
  return <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
    <button type="button" onClick={() => void toggle()} aria-pressed={enabled} className={`rounded px-3 py-2 font-semibold ${enabled ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-200'}`}>Metrônomo {enabled ? 'ligado' : 'desligado'}</button>
    <span>{Math.round(bpm)} BPM · {grid.length ? 'batidas detectadas/marcadas' : 'grade regular a partir de 0:00'} · sincronização aproximada</span>
    {error && <span role="alert" className="text-rose-300">{error}</span>}
  </div>;
}

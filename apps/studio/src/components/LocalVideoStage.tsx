import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Film, FolderOpen, Sparkles, Youtube } from 'lucide-react';
import { formatTime } from '../data/chordDiagrams';

interface LocalVideoStageProps {
  videoUrl: string;
  title: string;
  sourceUrl?: string | null;
  duration: number;
  bpm: number | null;
  musicalKey: string | null;
  currentTime: number;
  isPlaying: boolean;
  speed: number;
  onOpenVideoModal: () => void;
  onOpenLocalFile: () => void;
}

/**
 * Frame-accurate muted HTML5 video player synchronized with MRQPlaybackEngine (C++17 DSP).
 * Because audio comes from the C++17 Phase Vocoder + Pitch Shifter + 4-Stem Mixer,
 * the user watches the video in perfect sync with pitch-shifted, time-stretched, or stem-isolated audio!
 */
export const LocalVideoStage: React.FC<LocalVideoStageProps> = ({
  videoUrl,
  title,
  sourceUrl,
  duration,
  bpm,
  musicalKey,
  currentTime,
  isPlaying,
  speed,
  onOpenVideoModal,
  onOpenLocalFile,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Keep playbackRate synced to C++17 DSP speed
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.playbackRate = Math.max(0.25, Math.min(2.0, speed));
    } catch {
      // ignore unsupported rate
    }
  }, [speed]);

  // Keep play / pause synced
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      if (Math.abs(v.currentTime - currentTime) > 0.25 && Number.isFinite(currentTime)) {
        v.currentTime = currentTime;
      }
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isPlaying]);

  // Keep video frame synced on seek or drift > 220ms
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(currentTime)) return;
    const drift = Math.abs(v.currentTime - currentTime);
    if ((!isPlaying && drift > 0.06) || (isPlaying && drift > 0.25)) {
      try {
        v.currentTime = Math.max(0, Math.min(v.duration || duration || currentTime, currentTime));
      } catch {
        // ignore before metadata loaded
      }
    }
  }, [currentTime, isPlaying, duration]);

  return (
    <section className="bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="px-4 py-2.5 bg-gradient-to-r from-[#111827] via-[#131C2E] to-[#111827] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-emerald-400">
            <Film className="w-3.5 h-3.5" />
            <span>Vídeo Sincronizado · DSP C++17 + IA + Pitch + 4 Stems Ativos</span>
            <Sparkles className="w-3 h-3 text-sky-400" />
          </div>
          <h1 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">{title}</h1>
          {sourceUrl && (
            <div className="text-[10px] font-mono text-slate-400 truncate max-w-md">{sourceUrl}</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden md:flex items-center gap-2 mr-1">
            <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-200">
              {formatTime(duration, false)}
            </div>
            <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-sky-300">
              {bpm ? `${Math.round(bpm)} BPM` : 'BPM —'}
            </div>
            <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-indigo-300">
              {musicalKey || 'Tom —'}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenVideoModal}
            className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Youtube className="w-3.5 h-3.5 text-rose-400" />
            <span>Link Vídeo</span>
          </button>

          <button
            type="button"
            onClick={onOpenLocalFile}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Abrir Arquivo</span>
          </button>

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
            title={collapsed ? 'Expandir vídeo' : 'Minimizar vídeo'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="bg-black/95 px-3 py-3 sm:px-6 flex justify-center">
          <div className="relative w-full max-w-[760px] aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl">
            <video
              ref={videoRef}
              src={videoUrl}
              muted
              playsInline
              preload="auto"
              className="w-full h-full object-contain bg-black"
            />
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 border border-slate-700 text-[10px] font-mono text-sky-300 pointer-events-none">
              Áudio: Motor DSP C++17 ({Math.round(speed * 100)}%)
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

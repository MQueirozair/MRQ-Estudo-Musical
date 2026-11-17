import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  AudioWaveform,
  BarChart3,
  Columns2,
  Flag,
  Grid,
  MoveHorizontal,
  MoveVertical,
} from 'lucide-react';
import type {
  DetectedChord,
  MarkerItem,
  SpectrogramData,
  ViewMode,
  WaveformData,
} from '../types/music';
import { formatTime } from '../data/chordDiagrams';

interface WaveformCanvasProps {
  waveform: WaveformData | null;
  spectrogram: SpectrogramData | null;
  duration: number;
  currentTime: number;
  viewMode: ViewMode;
  showBeats: boolean;
  beats: number[];
  downbeats: number[];
  markers: MarkerItem[];
  chords: DetectedChord[];
  loopEnabled: boolean;
  loopA: number;
  loopB: number;
  zoomH: number;
  zoomV: number;
  specLogScale: boolean;
  onViewModeChange: (m: ViewMode) => void;
  onToggleBeats: () => void;
  onToggleSpecScale: () => void;
  onZoomHChange: (z: number) => void;
  onZoomVChange: (z: number) => void;
  onSeek: (sec: number) => void;
  onLoopChange: (a: number, b: number, enable?: boolean) => void;
  onAddMarkerAt: (sec: number) => void;
  onSelectMarkerLoop: (marker: MarkerItem) => void;
}

type SpecPalette = 'magma' | 'inferno' | 'ocean';

function mapColor(val: number, palette: SpecPalette): [number, number, number] {
  const t = Math.max(0, Math.min(1, val / 255));
  if (palette === 'ocean') {
    const r = Math.round(8 + t * t * 140);
    const g = Math.round(15 + Math.pow(t, 0.85) * 215);
    const b = Math.round(35 + Math.pow(t, 0.55) * 220);
    return [r, g, b];
  }
  if (palette === 'inferno') {
    const r = Math.round(Math.min(255, t < 0.4 ? t * 380 : 152 + (t - 0.4) * 172));
    const g = Math.round(Math.min(255, t < 0.35 ? t * 40 : Math.pow((t - 0.35) / 0.65, 1.35) * 250));
    const b = Math.round(Math.min(255, t < 0.5 ? 24 + t * 220 : Math.max(15, 134 - (t - 0.5) * 220)));
    return [r, g, b];
  }
  // Magma-inspired musical spectrum palette
  const r = Math.round(Math.min(255, 12 + Math.pow(t, 0.85) * 243));
  const g = Math.round(Math.min(255, 10 + Math.pow(t, 1.75) * 225));
  const b = Math.round(Math.min(255, 28 + Math.sin(t * Math.PI) * 185 + Math.pow(t, 3) * 110));
  return [r, g, b];
}

const NOTE_LABELS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
function freqToNote(hz: number): string {
  if (hz < 20) return '';
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_LABELS[((midi % 12) + 12) % 12]}${oct}`;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  waveform,
  spectrogram,
  duration,
  currentTime,
  viewMode,
  showBeats,
  beats,
  downbeats,
  markers,
  chords,
  loopEnabled,
  loopA,
  loopB,
  zoomH,
  zoomV,
  specLogScale,
  onViewModeChange,
  onToggleBeats,
  onToggleSpecScale,
  onZoomHChange,
  onZoomVChange,
  onSeek,
  onLoopChange,
  onAddMarkerAt,
  onSelectMarkerLoop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hZoomBadgeRef = useRef<HTMLDivElement>(null);
  const vZoomBadgeRef = useRef<HTMLDivElement>(null);
  const specOffscreenRef = useRef<HTMLCanvasElement | null>(null);

  const [viewStartSec, setViewStartSec] = useState(0);
  const [palette, setPalette] = useState<SpecPalette>('magma');
  const [wheelMode, setWheelMode] = useState<'auto' | 'zoomH' | 'zoomV'>('auto');
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string } | null>(null);
  const [zoomHud, setZoomHud] = useState<string | null>(null);
  const hudTimerRef = useRef<number | null>(null);
  const prevTimeRef = useRef(currentTime);

  const dragModeRef = useRef<'none' | 'create' | 'moveA' | 'moveB' | 'pan'>('none');
  const dragAnchorSecRef = useRef(0);
  const panStartXRef = useRef(0);
  const panStartViewSecRef = useRef(0);

  const visibleSpan = duration > 0 ? duration / Math.max(1, zoomH) : 10;
  const maxStart = Math.max(0, duration - visibleSpan);
  const clampedStart = Math.min(viewStartSec, maxStart);

  // Smooth vertical canvas height growth when Zoom V > 1 (real vertical magnification + gain!)
  const baseCanvasHeight = viewMode === 'split' ? 300 : 210;
  const extraHeight = zoomV > 1 ? Math.round(Math.min(220, (zoomV - 1) * 72)) : 0;
  const canvasHeight = baseCanvasHeight + extraHeight;

  const flashHud = useCallback((msg: string) => {
    setZoomHud(msg);
    if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    hudTimerRef.current = window.setTimeout(() => setZoomHud(null), 1300);
  }, []);

  useEffect(() => {
    return () => {
      if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    };
  }, []);

  // Keep latest values in ref for native non-passive wheel listeners
  const wheelStateRef = useRef({
    duration,
    zoomH,
    zoomV,
    clampedStart,
    visibleSpan,
    maxStart,
    wheelMode,
  });
  wheelStateRef.current = {
    duration,
    zoomH,
    zoomV,
    clampedStart,
    visibleSpan,
    maxStart,
    wheelMode,
  };

  const applyHorizontalZoom = useCallback(
    (factor: number, anchorClientX?: number) => {
      const s = wheelStateRef.current;
      const nextZoomH = Number(Math.max(1, Math.min(64, s.zoomH * factor)).toFixed(2));
      if (s.duration > 0) {
        const rect = canvasRef.current?.getBoundingClientRect();
        const cursorRatio =
          anchorClientX !== undefined && rect && rect.width > 0
            ? Math.max(0, Math.min(1, (anchorClientX - rect.left) / rect.width))
            : 0.5;
        const anchorTime = s.clampedStart + cursorRatio * s.visibleSpan;
        const nextSpan = s.duration / nextZoomH;
        const nextMaxStart = Math.max(0, s.duration - nextSpan);
        const nextStart =
          nextZoomH <= 1.01
            ? 0
            : Math.max(0, Math.min(nextMaxStart, anchorTime - cursorRatio * nextSpan));
        setViewStartSec(nextStart);
      }
      onZoomHChange(nextZoomH);
      flashHud(`Zoom Horizontal: ${nextZoomH.toFixed(1)}× · Vertical: ${s.zoomV.toFixed(1)}×`);
    },
    [onZoomHChange, flashHud]
  );

  const applyVerticalZoom = useCallback(
    (factor: number) => {
      const s = wheelStateRef.current;
      const nextZoomV = Number(Math.max(0.5, Math.min(5.0, s.zoomV * factor)).toFixed(2));
      onZoomVChange(nextZoomV);
      flashHud(`Zoom Vertical: ${nextZoomV.toFixed(1)}× · Horizontal: ${s.zoomH.toFixed(1)}×`);
    },
    [onZoomVChange, flashHud]
  );

  // Reset viewStart when zoomed all the way back out
  useEffect(() => {
    if (zoomH <= 1.01 && viewStartSec !== 0) {
      setViewStartSec(0);
    }
  }, [zoomH, viewStartSec]);

  // Auto-follow playhead ONLY when currentTime actually changes (so zooming/panning never snaps away!)
  useEffect(() => {
    const moved = Math.abs(currentTime - prevTimeRef.current) > 0.002;
    prevTimeRef.current = currentTime;
    if (!moved || zoomH <= 1.01) return;
    if (currentTime < clampedStart || currentTime > clampedStart + visibleSpan * 0.92) {
      const next = Math.max(0, Math.min(maxStart, currentTime - visibleSpan * 0.15));
      setViewStartSec(next);
    }
  }, [currentTime, zoomH, visibleSpan, maxStart, clampedStart]);

  // Native NON-PASSIVE wheel listener on the Waveform/Spectrogram canvas:
  //   - Ctrl + Scroll              => Cursor-centered Horizontal Zoom (prevents browser/Electron page zoom!)
  //   - Shift + Scroll / Alt+Scroll => Vertical Zoom (amplitude + canvas height!)
  //   - Ctrl + Shift + Scroll      => Horizontal + Vertical Zoom together
  //   - WheelMode 'zoomH'/'zoomV'  => Direct mouse wheel zoom without modifier keys
  //   - Plain Scroll (when zoomed) => Smooth horizontal pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      const s = wheelStateRef.current;
      const hasCtrl = e.ctrlKey || e.metaKey;
      const hasShiftOrAlt = e.shiftKey || e.altKey;
      const rawDelta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (rawDelta === 0) return;

      const factorH = rawDelta < 0 ? 1.22 : 1 / 1.22;
      const factorV = rawDelta < 0 ? 1.16 : 1 / 1.16;

      if (hasCtrl && hasShiftOrAlt) {
        e.preventDefault();
        e.stopPropagation();
        applyHorizontalZoom(factorH, e.clientX);
        applyVerticalZoom(factorV);
        return;
      }

      if (hasCtrl) {
        e.preventDefault();
        e.stopPropagation();
        applyHorizontalZoom(factorH, e.clientX);
        return;
      }

      if (hasShiftOrAlt) {
        e.preventDefault();
        e.stopPropagation();
        applyVerticalZoom(factorV);
        return;
      }

      if (s.wheelMode === 'zoomH') {
        e.preventDefault();
        e.stopPropagation();
        applyHorizontalZoom(factorH, e.clientX);
        return;
      }

      if (s.wheelMode === 'zoomV') {
        e.preventDefault();
        e.stopPropagation();
        applyVerticalZoom(factorV);
        return;
      }

      // Default mode when zoomed horizontally: smooth horizontal pan
      if (s.zoomH > 1.01) {
        e.preventDefault();
        const deltaSec = (rawDelta > 0 ? 1 : -1) * s.visibleSpan * 0.12;
        setViewStartSec((prev) => Math.max(0, Math.min(s.maxStart, prev + deltaSec)));
      }
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleNativeWheel);
  }, [applyHorizontalZoom, applyVerticalZoom]);

  // Direct scroll over toolbar Zoom H / Zoom V badges
  useEffect(() => {
    const hEl = hZoomBadgeRef.current;
    const vEl = vZoomBadgeRef.current;
    const onWheelH = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      applyHorizontalZoom(e.deltaY < 0 ? 1.2 : 1 / 1.2);
    };
    const onWheelV = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      applyVerticalZoom(e.deltaY < 0 ? 1.14 : 1 / 1.14);
    };
    hEl?.addEventListener('wheel', onWheelH, { passive: false });
    vEl?.addEventListener('wheel', onWheelV, { passive: false });
    return () => {
      hEl?.removeEventListener('wheel', onWheelH);
      vEl?.removeEventListener('wheel', onWheelV);
    };
  }, [applyHorizontalZoom, applyVerticalZoom]);

  // Pre-render offscreen spectrogram bitmap whenever spectrogram data or palette changes
  useEffect(() => {
    if (!spectrogram || spectrogram.frames === 0 || spectrogram.bins === 0) {
      specOffscreenRef.current = null;
      return;
    }
    const off = document.createElement('canvas');
    off.width = spectrogram.frames;
    off.height = spectrogram.bins;
    const octx = off.getContext('2d');
    if (!octx) return;

    const img = octx.createImageData(spectrogram.frames, spectrogram.bins);
    const buf = img.data;
    for (let f = 0; f < spectrogram.frames; f++) {
      const col = spectrogram.data[f];
      for (let b = 0; b < spectrogram.bins; b++) {
        const y = spectrogram.bins - 1 - b;
        const idx = (y * spectrogram.frames + f) * 4;
        const [r, g, bl] = mapColor(col[b] ?? 0, palette);
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = bl;
        buf[idx + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    specOffscreenRef.current = off;
  }, [spectrogram, palette]);

  // Main Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = containerRef.current;
    if (!canvas || !wrapper) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, wrapper.clientWidth);
    const height = canvasHeight;

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0B1220';
    ctx.fillRect(0, 0, width, height);

    const rulerH = 24;
    const chordStripH = chords.length > 0 ? 22 : 0;
    const topOffset = rulerH + chordStripH;
    const plotH = height - topOffset;

    const timeToX = (t: number) => ((t - clampedStart) / Math.max(0.001, visibleSpan)) * width;

    // 1. Time Ruler
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, rulerH);
    ctx.strokeStyle = '#1E293B';
    ctx.beginPath();
    ctx.moveTo(0, rulerH);
    ctx.lineTo(width, rulerH);
    ctx.stroke();

    const approxStep = visibleSpan / 10;
    const niceSteps = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
    const step = niceSteps.find((s) => s >= approxStep) || 60;
    const firstTick = Math.ceil(clampedStart / step) * step;

    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px ui-monospace, monospace';
    for (let t = firstTick; t <= clampedStart + visibleSpan; t += step) {
      const x = timeToX(t);
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(x, rulerH - 6);
      ctx.lineTo(x, rulerH);
      ctx.stroke();
      ctx.fillText(formatTime(t, visibleSpan < 12), x + 3, 14);
    }

    // 2. Chord Strip overlay
    if (chordStripH > 0) {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, rulerH, width, chordStripH);
      for (const ch of chords) {
        if (ch.end_sec < clampedStart || ch.start_sec > clampedStart + visibleSpan) continue;
        const x0 = Math.max(0, timeToX(ch.start_sec));
        const x1 = Math.min(width, timeToX(ch.end_sec));
        const active = currentTime >= ch.start_sec && currentTime < ch.end_sec;
        ctx.fillStyle = active ? 'rgba(99, 102, 241, 0.35)' : 'rgba(30, 41, 59, 0.55)';
        ctx.fillRect(x0 + 1, rulerH + 2, Math.max(2, x1 - x0 - 2), chordStripH - 4);
        if (x1 - x0 > 24 && ch.symbol !== 'N.C.') {
          ctx.fillStyle = active ? '#E0E7FF' : '#94A3B8';
          ctx.font = active ? 'bold 11px Inter, sans-serif' : '600 10px Inter, sans-serif';
          ctx.fillText(ch.symbol, x0 + 5, rulerH + 15);
        }
      }
    }

    // 3. Colored Marker Regions
    for (let i = 0; i < markers.length; i++) {
      const mk = markers[i];
      const endSec = mk.end_sec ?? (i + 1 < markers.length ? markers[i + 1].time_sec : duration);
      if (endSec < clampedStart || mk.time_sec > clampedStart + visibleSpan) continue;
      const x0 = Math.max(0, timeToX(mk.time_sec));
      const x1 = Math.min(width, timeToX(endSec));
      ctx.fillStyle = `${mk.color || '#A855F7'}18`;
      ctx.fillRect(x0, topOffset, Math.max(1, x1 - x0), plotH);
    }

    // Helper to draw Waveform in a vertical region
    const drawWaveformRegion = (yTop: number, regH: number) => {
      const midY = yTop + regH / 2;
      ctx.strokeStyle = '#1E293B';
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();

      if (!waveform || waveform.bins === 0 || duration <= 0) {
        ctx.fillStyle = '#475569';
        ctx.font = '13px Inter, sans-serif';
        ctx.fillText('Arraste ou importe um arquivo de áudio (MP3, WAV, M4A, FLAC, AAC, OGG, AIFF)...', 20, midY + 4);
        return;
      }

      const startBin = Math.floor((clampedStart / duration) * waveform.bins);
      const endBin = Math.min(waveform.bins, Math.ceil(((clampedStart + visibleSpan) / duration) * waveform.bins));
      const spanBins = Math.max(1, endBin - startBin);

      // Outer Peak Envelope (Cyan-Indigo gradient)
      const grad = ctx.createLinearGradient(0, yTop, 0, yTop + regH);
      grad.addColorStop(0, '#38BDF8');
      grad.addColorStop(0.5, '#6366F1');
      grad.addColorStop(1, '#38BDF8');

      for (let px = 0; px < width; px++) {
        const b0 = startBin + Math.floor((px / width) * spanBins);
        const b1 = Math.max(b0 + 1, startBin + Math.floor(((px + 1) / width) * spanBins));
        let mn = 0;
        let mx = 0;
        let rms = 0;
        for (let b = b0; b < Math.min(waveform.bins, b1); b++) {
          if (waveform.min[b] < mn) mn = waveform.min[b];
          if (waveform.max[b] > mx) mx = waveform.max[b];
          if (waveform.rms[b] > rms) rms = waveform.rms[b];
        }
        const yMax = midY - Math.min(1, mx * zoomV) * (regH * 0.46);
        const yMin = midY - Math.max(-1, mn * zoomV) * (regH * 0.46);
        ctx.fillStyle = grad;
        ctx.fillRect(px, yMax, 1, Math.max(1, yMin - yMax));

        // Inner RMS core
        const rH = Math.min(1, rms * zoomV) * (regH * 0.44);
        ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
        ctx.fillRect(px, midY - rH, 1, Math.max(1, rH * 2));
      }
    };

    // Helper to draw Real FFT Spectrogram in a vertical region
    const drawSpectrogramRegion = (yTop: number, regH: number) => {
      const off = specOffscreenRef.current;
      if (!off || !spectrogram || duration <= 0) {
        ctx.fillStyle = '#64748B';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('Calculando Espectrograma FFT real no motor C++17...', 20, yTop + regH / 2);
        return;
      }
      const sx = (clampedStart / duration) * off.width;
      const sw = (visibleSpan / duration) * off.width;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, sx, 0, Math.max(1, sw), off.height, 0, yTop, width, regH);

      // Frequency scale labels
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillRect(0, yTop, 46, regH);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '9px ui-monospace, monospace';
      const fLabels = spectrogram.log_scale ? [65, 130, 261, 523, 1046, 2093, 4186] : [500, 1500, 3000, 5000, 7000];
      const fMin = spectrogram.min_freq || 32.7;
      const fMax = spectrogram.max_freq || 8000;
      for (const fl of fLabels) {
        if (fl < fMin || fl > fMax) continue;
        const frac = spectrogram.log_scale
          ? (Math.log(fl) - Math.log(fMin)) / (Math.log(fMax) - Math.log(fMin))
          : (fl - fMin) / (fMax - fMin);
        const y = yTop + regH * (1 - frac);
        ctx.fillText(fl >= 1000 ? `${(fl / 1000).toFixed(1)}k` : `${fl}`, 4, y + 3);
      }
    };

    // 4. Render selected ViewMode
    if (viewMode === 'waveform') {
      drawWaveformRegion(topOffset, plotH);
    } else if (viewMode === 'spectrogram') {
      drawSpectrogramRegion(topOffset, plotH);
    } else {
      const halfH = Math.floor(plotH / 2);
      drawWaveformRegion(topOffset, halfH - 1);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, topOffset + halfH - 1, width, 2);
      drawSpectrogramRegion(topOffset + halfH + 1, plotH - halfH - 1);
    }

    // 5. Beats & Bars Grid Overlay
    if (showBeats && beats.length > 0) {
      const downSet = new Set(downbeats.map((d) => Math.round(d * 20)));
      let barNum = 0;
      for (const b of beats) {
        const isDown = downSet.has(Math.round(b * 20));
        if (isDown) barNum++;
        if (b < clampedStart || b > clampedStart + visibleSpan) continue;
        const x = timeToX(b);
        ctx.strokeStyle = isDown ? 'rgba(250, 204, 21, 0.45)' : 'rgba(148, 163, 184, 0.18)';
        ctx.lineWidth = isDown ? 1.25 : 1;
        ctx.beginPath();
        ctx.moveTo(x, topOffset);
        ctx.lineTo(x, height);
        ctx.stroke();
        if (isDown) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
          ctx.font = 'bold 9px ui-monospace, monospace';
          ctx.fillText(`M${barNum}`, x + 3, topOffset + 11);
        }
      }
    }

    // 6. Loop A/B Region & Draggable Handles
    if (loopB > loopA + 0.05) {
      const xA = timeToX(loopA);
      const xB = timeToX(loopB);
      const left = Math.max(0, xA);
      const right = Math.min(width, xB);
      if (right > left) {
        ctx.fillStyle = loopEnabled ? 'rgba(56, 189, 248, 0.22)' : 'rgba(148, 163, 184, 0.12)';
        ctx.fillRect(left, topOffset, right - left, plotH);
      }

      // Handle A
      if (xA >= -10 && xA <= width + 10) {
        ctx.strokeStyle = loopEnabled ? '#38BDF8' : '#94A3B8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xA, topOffset);
        ctx.lineTo(xA, height);
        ctx.stroke();
        ctx.fillStyle = loopEnabled ? '#0EA5E9' : '#64748B';
        ctx.fillRect(xA, topOffset, 18, 16);
        ctx.fillStyle = '#020617';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText('A', xA + 5, topOffset + 12);
      }

      // Handle B
      if (xB >= -10 && xB <= width + 10) {
        ctx.strokeStyle = loopEnabled ? '#38BDF8' : '#94A3B8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xB, topOffset);
        ctx.lineTo(xB, height);
        ctx.stroke();
        ctx.fillStyle = loopEnabled ? '#0EA5E9' : '#64748B';
        ctx.fillRect(xB - 18, topOffset, 18, 16);
        ctx.fillStyle = '#020617';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText('B', xB - 13, topOffset + 12);
      }
    }

    // 7. Section Markers Pins
    for (const mk of markers) {
      if (mk.time_sec < clampedStart || mk.time_sec > clampedStart + visibleSpan) continue;
      const x = timeToX(mk.time_sec);
      ctx.strokeStyle = mk.color || '#A855F7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x, topOffset);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = mk.color || '#A855F7';
      const label = mk.label.slice(0, 18);
      const tw = ctx.measureText(label).width + 10;
      ctx.fillRect(x, height - 18, tw, 16);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillText(label, x + 5, height - 6);
    }

    // 8. Real-time Playhead
    if (currentTime >= clampedStart && currentTime <= clampedStart + visibleSpan) {
      const px = timeToX(currentTime);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();

      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(px - 6, 0);
      ctx.lineTo(px + 6, 0);
      ctx.lineTo(px, 9);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }, [
    waveform,
    spectrogram,
    duration,
    currentTime,
    viewMode,
    showBeats,
    beats,
    downbeats,
    markers,
    chords,
    loopEnabled,
    loopA,
    loopB,
    zoomH,
    zoomV,
    canvasHeight,
    clampedStart,
    visibleSpan,
    palette,
  ]);

  const clientXToTime = (clientX: number): number => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return clampedStart + ratio * visibleSpan;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (duration <= 0) return;

    // Middle-click drag pans horizontally when zoomed in
    if (e.button === 1 && zoomH > 1.01) {
      e.preventDefault();
      dragModeRef.current = 'pan';
      panStartXRef.current = e.clientX;
      panStartViewSecRef.current = clampedStart;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const t = clientXToTime(e.clientX);

    // Clicking on the top ruler always seeks directly
    if (y < 24) {
      onSeek(t);
      return;
    }

    // Check proximity to Loop A / B handles
    const xA = ((loopA - clampedStart) / visibleSpan) * rect.width;
    const xB = ((loopB - clampedStart) / visibleSpan) * rect.width;

    if (loopB > loopA + 0.05 && Math.abs(x - xA) < 12) {
      dragModeRef.current = 'moveA';
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (loopB > loopA + 0.05 && Math.abs(x - xB) < 12) {
      dragModeRef.current = 'moveB';
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    dragModeRef.current = 'create';
    dragAnchorSecRef.current = t;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || duration <= 0) return;

    if (dragModeRef.current === 'pan') {
      const dx = e.clientX - panStartXRef.current;
      const dt = -(dx / Math.max(1, rect.width)) * visibleSpan;
      setViewStartSec(Math.max(0, Math.min(maxStart, panStartViewSecRef.current + dt)));
      return;
    }

    const t = clientXToTime(e.clientX);

    // Hover frequency tooltip on spectrogram
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const chordStripH = chords.length > 0 ? 22 : 0;
    const topOff = 24 + chordStripH;
    const plotH = rect.height - topOff;

    let tooltipText = formatTime(t);
    const inSpec =
      spectrogram &&
      (viewMode === 'spectrogram' || (viewMode === 'split' && y > topOff + plotH / 2)) &&
      y > topOff;
    if (inSpec && spectrogram) {
      const specTop = viewMode === 'split' ? topOff + plotH / 2 : topOff;
      const specH = viewMode === 'split' ? plotH / 2 : plotH;
      const fracY = Math.max(0, Math.min(1, 1 - (y - specTop) / specH));
      const fMin = spectrogram.min_freq || 32.7;
      const fMax = spectrogram.max_freq || 8000;
      const hz = spectrogram.log_scale
        ? Math.exp(Math.log(fMin) + fracY * (Math.log(fMax) - Math.log(fMin)))
        : fMin + fracY * (fMax - fMin);
      tooltipText = `${formatTime(t)} · ${hz.toFixed(1)} Hz (${freqToNote(hz)})`;
    }
    setHoverInfo({ x, y, text: tooltipText });

    if (dragModeRef.current === 'none') return;
    if (dragModeRef.current === 'moveA') {
      const nextA = Math.max(0, Math.min(loopB - 0.1, t));
      onLoopChange(nextA, loopB, true);
    } else if (dragModeRef.current === 'moveB') {
      const nextB = Math.min(duration, Math.max(loopA + 0.1, t));
      onLoopChange(loopA, nextB, true);
    } else if (dragModeRef.current === 'create') {
      const a = Math.min(dragAnchorSecRef.current, t);
      const b = Math.max(dragAnchorSecRef.current, t);
      if (b - a > 0.12) {
        onLoopChange(a, b, true);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragModeRef.current === 'create') {
      const t = clientXToTime(e.clientX);
      if (Math.abs(t - dragAnchorSecRef.current) <= 0.12) {
        // Simple click -> seek!
        onSeek(t);
      }
    }
    dragModeRef.current = 'none';
  };

  return (
    <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="px-3 py-2 bg-[#111827] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-0.5 border border-slate-800">
          <button
            type="button"
            onClick={() => onViewModeChange('waveform')}
            className={`px-2 py-1 rounded-md flex items-center gap-1 font-medium transition ${
              viewMode === 'waveform' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <AudioWaveform className="w-3.5 h-3.5" />
            <span>Waveform</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('spectrogram')}
            className={`px-2 py-1 rounded-md flex items-center gap-1 font-medium transition ${
              viewMode === 'spectrogram' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Espectrograma</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('split')}
            className={`px-2 py-1 rounded-md flex items-center gap-1 font-medium transition ${
              viewMode === 'split' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dividido</span>
          </button>
        </div>

        {/* Spectrogram options & Beat Grid */}
        <div className="flex flex-wrap items-center gap-2">
          {viewMode !== 'waveform' && (
            <>
              <button
                type="button"
                onClick={onToggleSpecScale}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                title="Alternar escala de frequência Logarítmica (musical) vs Linear"
              >
                Escala: <strong className="text-sky-300">{specLogScale ? 'Log' : 'Linear'}</strong>
              </button>
              <select
                value={palette}
                onChange={(e) => setPalette(e.target.value as SpecPalette)}
                className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-slate-200"
                aria-label="Paleta de cores do espectrograma"
              >
                <option value="magma">Magma</option>
                <option value="inferno">Inferno</option>
                <option value="ocean">Ocean</option>
              </select>
            </>
          )}

          <button
            type="button"
            onClick={onToggleBeats}
            className={`px-2 py-1 rounded-md flex items-center gap-1 border transition ${
              showBeats
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Mostrar/ocultar batidas e compassos"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Batidas</span>
          </button>

          <button
            type="button"
            onClick={() => onAddMarkerAt(currentTime)}
            className="px-2 py-1 rounded-md bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 flex items-center gap-1"
            title="Adicionar marcador na posição atual (M)"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>+ Marcador</span>
          </button>
        </div>

        {/* Horizontal & Vertical Zoom Controls (both support mouse wheel right over the badge!) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Zoom Horizontal */}
          <div
            ref={hZoomBadgeRef}
            className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-0.5"
            title="Zoom Horizontal (Tempo) — Ctrl+Scroll no waveform ou role o mouse aqui"
          >
            <MoveHorizontal className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[10px] text-slate-400 font-semibold">H</span>
            <button
              type="button"
              onClick={() => applyHorizontalZoom(1 / 1.5)}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
              title="Reduzir zoom horizontal (Ctrl+Scroll ↓)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] font-bold text-sky-300 w-9 text-center">
              {zoomH.toFixed(1)}×
            </span>
            <button
              type="button"
              onClick={() => applyHorizontalZoom(1.5)}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
              title="Aumentar zoom horizontal (Ctrl+Scroll ↑)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom Vertical */}
          <div
            ref={vZoomBadgeRef}
            className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-0.5"
            title="Zoom Vertical (Altura & Ganho da Onda) — Shift+Scroll ou Alt+Scroll no waveform, ou role o mouse aqui"
          >
            <MoveVertical className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[10px] text-slate-400 font-semibold">V</span>
            <button
              type="button"
              onClick={() => applyVerticalZoom(1 / 1.25)}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
              title="Reduzir zoom vertical (Shift/Alt+Scroll ↓)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] font-bold text-violet-300 w-9 text-center">
              {zoomV.toFixed(1)}×
            </span>
            <button
              type="button"
              onClick={() => applyVerticalZoom(1.25)}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
              title="Aumentar zoom vertical (Shift/Alt+Scroll ↑)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onZoomHChange(1);
              onZoomVChange(1);
              setViewStartSec(0);
              flashHud('Zoom Waveform: 1.0× (Ajustado à tela)');
            }}
            className="px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 text-[10px] font-bold"
            title="Resetar Zoom Horizontal e Vertical para 1.0×"
          >
            <Maximize2 className="w-3 h-3" />
            <span>1:1</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div ref={containerRef} className="relative w-full select-none">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => setHoverInfo(null)}
          onDoubleClick={(e) => onSeek(clientXToTime(e.clientX))}
          className="block w-full cursor-crosshair touch-none"
          style={{ height: canvasHeight }}
        />

        {zoomHud && (
          <div className="pointer-events-none absolute top-7 right-3 z-20 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-sky-500/60 text-[11px] font-mono font-bold text-sky-300 shadow-lg">
            {zoomHud}
          </div>
        )}

        {hoverInfo && (
          <div
            className="pointer-events-none absolute px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[10px] font-mono text-sky-200 shadow"
            style={{
              left: Math.min(hoverInfo.x + 12, (containerRef.current?.clientWidth || 400) - 170),
              top: Math.max(4, hoverInfo.y - 24),
            }}
          >
            {hoverInfo.text}
          </div>
        )}
      </div>

      {/* Horizontal Navigation Scrollbar + Quick Mouse Wheel Mode Selector + Quick Marker Chips */}
      <div className="px-3 py-1.5 bg-[#0B1120] border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          {zoomH > 1.01 ? (
            <>
              <span className="text-slate-500 shrink-0">Navegar:</span>
              <input
                type="range"
                min={0}
                max={Math.max(0.01, maxStart)}
                step={0.05}
                value={clampedStart}
                onChange={(e) => setViewStartSec(parseFloat(e.target.value))}
                className="flex-1 accent-sky-400"
                aria-label="Navegação temporal horizontal"
              />
              <span className="font-mono text-slate-400 shrink-0">
                {formatTime(clampedStart, false)}–{formatTime(clampedStart + visibleSpan, false)}
              </span>
            </>
          ) : (
            <span className="text-slate-400">
              <strong className="text-sky-300">Ctrl+Scroll</strong>: Zoom Horizontal ·{' '}
              <strong className="text-violet-300">Shift/Alt+Scroll</strong>: Zoom Vertical · Arraste: Loop A/B · Clique: posicionar
            </span>
          )}
        </div>

        {/* Direct Scroll Mode Pills (allows zooming H or V with 1 hand using just the mouse wheel!) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-slate-500 hidden sm:inline">Scroll do Mouse:</span>
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[10px]">
            {(
              [
                {
                  id: 'auto',
                  label: 'Auto',
                  title: 'Ctrl+Scroll: Zoom H · Shift/Alt+Scroll: Zoom V · Scroll: Navegar',
                },
                {
                  id: 'zoomH',
                  label: 'Zoom H',
                  title: 'Roda do mouse dá Zoom Horizontal direto no waveform',
                },
                {
                  id: 'zoomV',
                  label: 'Zoom V',
                  title: 'Roda do mouse dá Zoom Vertical direto no waveform',
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setWheelMode(opt.id)}
                title={opt.title}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  wheelMode === opt.id
                    ? opt.id === 'zoomV'
                      ? 'bg-violet-500 text-slate-950'
                      : 'bg-sky-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Marker Jump Chips */}
        {markers.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto max-w-full">
            {markers.map((mk) => (
              <button
                key={mk.id}
                type="button"
                onClick={() => onSeek(mk.time_sec)}
                onDoubleClick={() => onSelectMarkerLoop(mk)}
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 hover:brightness-125 transition flex items-center gap-1"
                style={{
                  borderColor: `${mk.color || '#A855F7'}66`,
                  backgroundColor: `${mk.color || '#A855F7'}22`,
                  color: '#E2E8F0',
                }}
                title="Clique: saltar para seção · Duplo clique: criar Loop A/B da seção"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: mk.color || '#A855F7' }} />
                {mk.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

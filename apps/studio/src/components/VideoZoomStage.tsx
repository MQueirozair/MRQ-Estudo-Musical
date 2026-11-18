import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Link2,
  Link2Off,
  Maximize2,
  Move,
  MoveHorizontal,
  MoveVertical,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export type WheelZoomMode = 'auto' | 'zoomH' | 'zoomV' | 'pan';

interface VideoZoomStageProps {
  children: React.ReactNode;
  /** True when wrapping a cross-origin iframe (e.g., YouTube) so modifier keys or active tool modes activate an interactive capture shield over the iframe. */
  isIframe?: boolean;
  /** Optional status pill displayed in the bottom-right corner of the video stage. */
  badgeText?: string;
  /** Optional max width class at 1x zoom (expands to full width when zoomed). */
  baseMaxWidthClass?: string;
}

const MIN_ZOOM = 1.0;
const MAX_ZOOM = 4.0;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export const VideoZoomStage: React.FC<VideoZoomStageProps> = ({
  children,
  isIframe = false,
  badgeText,
  baseMaxWidthClass = 'max-w-[820px]',
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const hBadgeRef = useRef<HTMLDivElement | null>(null);
  const vBadgeRef = useRef<HTMLDivElement | null>(null);

  const [zoomH, setZoomH] = useState(1.0);
  const [zoomV, setZoomV] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [lockAspect, setLockAspect] = useState(false);
  const [wheelMode, setWheelMode] = useState<WheelZoomMode>('auto');
  const [modifierActive, setModifierActive] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hudText, setHudText] = useState<string | null>(null);

  const hudTimerRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Refs for fresh state inside native non-passive wheel listeners
  const stateRef = useRef({ zoomH, zoomV, panX, panY, lockAspect, wheelMode });
  stateRef.current = { zoomH, zoomV, panX, panY, lockAspect, wheelMode };

  const flashHud = useCallback((msg: string) => {
    setHudText(msg);
    if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    hudTimerRef.current = window.setTimeout(() => setHudText(null), 1400);
  }, []);

  useEffect(() => {
    return () => {
      if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    };
  }, []);

  const clampPan = useCallback((nx: number, ny: number, zh: number, zv: number): [number, number] => {
    const vp = viewportRef.current;
    if (!vp) return [0, 0];
    const maxPx = Math.max(0, ((zh - 1) * vp.clientWidth) / 2);
    const maxPy = Math.max(0, ((zv - 1) * vp.clientHeight) / 2);
    return [clamp(nx, -maxPx, maxPx), clamp(ny, -maxPy, maxPy)];
  }, []);

  const applyZoom = useCallback(
    (nextH: number, nextV: number, labelPrefix?: string) => {
      const zh = Number(clamp(nextH, MIN_ZOOM, MAX_ZOOM).toFixed(2));
      const zv = Number(clamp(nextV, MIN_ZOOM, MAX_ZOOM).toFixed(2));
      // Wheel events can arrive together before React renders; preserve every step.
      stateRef.current.zoomH = zh;
      stateRef.current.zoomV = zv;
      setZoomH(zh);
      setZoomV(zv);
      setPanX((px) => {
        const [cpx] = clampPan(px, stateRef.current.panY, zh, zv);
        return zh <= 1.01 ? 0 : cpx;
      });
      setPanY((py) => {
        const [, cpy] = clampPan(stateRef.current.panX, py, zh, zv);
        return zv <= 1.01 ? 0 : cpy;
      });
      const prefix = labelPrefix ? `${labelPrefix} · ` : '';
      flashHud(`${prefix}H ${Math.round(zh * 100)}% · V ${Math.round(zv * 100)}%`);
    },
    [clampPan, flashHud]
  );

  const resetZoom = useCallback(() => {
    setZoomH(1.0);
    setZoomV(1.0);
    setPanX(0);
    setPanY(0);
    flashHud('Zoom Vídeo: 100% (1:1)');
  }, [flashHud]);

  const stepZoomH = useCallback(
    (factor: number) => {
      const cur = stateRef.current;
      const nextH = clamp(cur.zoomH * factor, MIN_ZOOM, MAX_ZOOM);
      const nextV = cur.lockAspect ? clamp(cur.zoomV * factor, MIN_ZOOM, MAX_ZOOM) : cur.zoomV;
      applyZoom(nextH, nextV, cur.lockAspect ? 'Zoom H+V' : 'Zoom H');
    },
    [applyZoom]
  );

  const stepZoomV = useCallback(
    (factor: number) => {
      const cur = stateRef.current;
      const nextV = clamp(cur.zoomV * factor, MIN_ZOOM, MAX_ZOOM);
      const nextH = cur.lockAspect ? clamp(cur.zoomH * factor, MIN_ZOOM, MAX_ZOOM) : cur.zoomH;
      applyZoom(nextH, nextV, cur.lockAspect ? 'Zoom H+V' : 'Zoom V');
    },
    [applyZoom]
  );

  // Track modifier keys (Ctrl / Meta / Shift / Alt) so the transparent shield over YouTube's
  // cross-origin iframe activates automatically the moment the user holds a zoom modifier key.
  useEffect(() => {
    if (!isIframe) return;
    const onKeyChange = (e: KeyboardEvent) => {
      setModifierActive(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey);
    };
    const onBlur = () => setModifierActive(false);
    window.addEventListener('keydown', onKeyChange);
    window.addEventListener('keyup', onKeyChange);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyChange);
      window.removeEventListener('keyup', onKeyChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [isIframe]);

  // Native NON-PASSIVE wheel listener on the video viewport:
  //   - Ctrl + Scroll          => Zoom Horizontal (or H+V if locked)
  //   - Shift + Scroll / Alt + Scroll => Zoom Vertical (or H+V if locked)
  //   - Ctrl + Shift + Scroll  => Zoom Horizontal + Vertical together
  //   - Direct Scroll when wheelMode === 'zoomH' or 'zoomV' => zooms without needing a key!
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      const cur = stateRef.current;
      const hasCtrl = e.ctrlKey || e.metaKey;
      const hasShiftOrAlt = e.shiftKey || e.altKey;
      const rawDelta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (rawDelta === 0) return;
      const factor = rawDelta < 0 ? 1.15 : 1 / 1.15;

      // 1. Both Ctrl + Shift/Alt => Proportional Zoom H+V
      if (hasCtrl && hasShiftOrAlt) {
        e.preventDefault();
        e.stopPropagation();
        applyZoom(cur.zoomH * factor, cur.zoomV * factor, 'Zoom H+V');
        return;
      }

      // 2. Ctrl + Scroll => Horizontal Zoom (or locked H+V)
      if (hasCtrl) {
        e.preventDefault();
        e.stopPropagation();
        stepZoomH(factor);
        return;
      }

      // 3. Shift + Scroll or Alt + Scroll => Vertical Zoom (or locked H+V)
      if (hasShiftOrAlt) {
        e.preventDefault();
        e.stopPropagation();
        stepZoomV(factor);
        return;
      }

      // 4. Direct mouse wheel modes (handy for 1-hand practice on guitar/piano!)
      if (cur.wheelMode === 'zoomH') {
        e.preventDefault();
        e.stopPropagation();
        stepZoomH(factor);
      } else if (cur.wheelMode === 'zoomV') {
        e.preventDefault();
        e.stopPropagation();
        stepZoomV(factor);
      }
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleNativeWheel);
  }, [applyZoom, stepZoomH, stepZoomV]);

  // Also allow scrolling directly over the Zoom H / Zoom V badges in the toolbar!
  useEffect(() => {
    const hEl = hBadgeRef.current;
    const vEl = vBadgeRef.current;

    const onWheelH = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stepZoomH(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    const onWheelV = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stepZoomV(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };

    hEl?.addEventListener('wheel', onWheelH, { passive: false });
    vEl?.addEventListener('wheel', onWheelV, { passive: false });
    return () => {
      hEl?.removeEventListener('wheel', onWheelH);
      vEl?.removeEventListener('wheel', onWheelV);
    };
  }, [stepZoomH, stepZoomV]);

  const isZoomed = zoomH > 1.01 || zoomV > 1.01;
  const overlayInteractive =
    !isIframe ? isZoomed && (wheelMode === 'pan' || dragging) : modifierActive || wheelMode !== 'auto';

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Allow drag-to-pan when zoomed (left click in pan/shield mode or middle click anytime)
    const allowPan =
      isZoomed &&
      (e.button === 1 || (e.button === 0 && (wheelMode === 'pan' || modifierActive || !isIframe)));
    if (!allowPan) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX,
      panY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const [cpx, cpy] = clampPan(
      dragStartRef.current.panX + dx,
      dragStartRef.current.panY + dy,
      zoomH,
      zoomV
    );
    setPanX(cpx);
    setPanY(cpy);
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
    setDragging(false);
  };

  // Smoothly grow video height slightly when Zoom V > 1 so vertical magnification uses vertical space well
  const extraHeightPct = zoomV > 1 ? Math.min(42, (zoomV - 1) * 18) : 0;

  return (
    <div className="bg-black/95 px-3 py-3 sm:px-6 flex flex-col items-center gap-2.5 border-b border-slate-800/80">
      {/* Video Viewport */}
      <div
        ref={viewportRef}
        onPointerDown={!isIframe ? handlePointerDown : undefined}
        onPointerMove={!isIframe ? handlePointerMove : undefined}
        onPointerUp={!isIframe ? handlePointerUp : undefined}
        onPointerCancel={!isIframe ? handlePointerUp : undefined}
        onLostPointerCapture={!isIframe ? handlePointerUp : undefined}
        onDoubleClick={!isIframe && isZoomed ? resetZoom : undefined}
        className={`relative w-full ${
          isZoomed ? 'max-w-full' : baseMaxWidthClass
        } aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl transition-[max-width] duration-200 select-none ${
          !isIframe && isZoomed ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        style={
          extraHeightPct > 0
            ? {
                aspectRatio: 'auto',
                height: `min(72vh, calc(42vw + ${extraHeightPct}vh))`,
                minHeight: '300px',
              }
            : undefined
        }
      >
        {/* Scaled & Panned Video Content */}
        <div
          className="w-full h-full will-change-transform"
          style={{
            transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoomH}, ${zoomV})`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 110ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {children}
        </div>

        {/* Transparent Interactive Shield for Cross-Origin YouTube Iframe during Ctrl/Shift/Alt or Active Zoom/Pan Tool */}
        {isIframe && overlayInteractive && (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onLostPointerCapture={handlePointerUp}
            onDoubleClick={resetZoom}
            className={`absolute inset-0 z-20 ${
              wheelMode === 'pan' || (isZoomed && modifierActive)
                ? dragging
                  ? 'cursor-grabbing'
                  : 'cursor-grab'
                : 'cursor-zoom-in'
            }`}
            title="Ctrl+Scroll: Zoom Horizontal · Shift/Alt+Scroll: Zoom Vertical · Arraste para enquadrar · Duplo clique: 100%"
          >
            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-slate-950/85 border border-sky-500/50 text-[10px] font-semibold text-sky-200 shadow-lg pointer-events-none">
              {wheelMode === 'zoomH'
                ? 'Modo Scroll: Zoom Horizontal (role o mouse ou clique em Auto para voltar ao player)'
                : wheelMode === 'zoomV'
                ? 'Modo Scroll: Zoom Vertical (role o mouse ou clique em Auto para voltar ao player)'
                : wheelMode === 'pan'
                ? 'Modo Mover: arraste o vídeo para enquadrar (duplo clique: 100%)'
                : 'Zoom Vídeo Ativo · Ctrl+Scroll: Horizontal · Shift/Alt+Scroll: Vertical'}
            </div>
          </div>
        )}

        {/* Live Zoom HUD Feedback Pill */}
        {hudText && (
          <div className="pointer-events-none absolute top-3 right-3 z-30 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-sky-500/60 text-[11px] font-mono font-bold text-sky-300 shadow-xl">
            {hudText}
          </div>
        )}

        {/* Active Zoom Indicator Corner Pill */}
        {isZoomed && !hudText && (
          <div className="pointer-events-none absolute top-2.5 right-2.5 z-20 px-2 py-0.5 rounded bg-black/75 border border-sky-500/40 text-[10px] font-mono text-sky-300">
            H {Math.round(zoomH * 100)}% · V {Math.round(zoomV * 100)}%
          </div>
        )}

        {/* Optional Status Badge (e.g. Motor DSP C++17) */}
        {badgeText && (
          <div className="absolute bottom-2 right-2 z-20 px-2 py-0.5 rounded bg-black/75 border border-slate-700 text-[10px] font-mono text-sky-300 pointer-events-none">
            {badgeText}
          </div>
        )}
      </div>

      {/* Video Zoom Control Strip (Horizontal + Vertical + Scroll Mode + Pan + Reset) */}
      <div className="w-full max-w-[920px] px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom H control (supports direct wheel over pill!) */}
          <div
            ref={hBadgeRef}
            className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-0.5"
            title="Zoom Horizontal do Vídeo — use Ctrl+Scroll no vídeo ou role o mouse aqui"
          >
            <MoveHorizontal className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[10px] font-semibold text-slate-400">H:</span>
            <button
              type="button"
              onClick={() => stepZoomH(1 / 1.2)}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
              title="Reduzir Zoom Horizontal do Vídeo"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="font-mono text-[11px] font-bold text-sky-300 w-10 text-center">
              {Math.round(zoomH * 100)}%
            </span>
            <button
              type="button"
              onClick={() => stepZoomH(1.2)}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
              title="Aumentar Zoom Horizontal do Vídeo"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {/* Zoom V control (supports direct wheel over pill!) */}
          <div
            ref={vBadgeRef}
            className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-0.5"
            title="Zoom Vertical do Vídeo — use Shift+Scroll ou Alt+Scroll no vídeo, ou role o mouse aqui"
          >
            <MoveVertical className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[10px] font-semibold text-slate-400">V:</span>
            <button
              type="button"
              onClick={() => stepZoomV(1 / 1.2)}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
              title="Reduzir Zoom Vertical do Vídeo"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="font-mono text-[11px] font-bold text-violet-300 w-10 text-center">
              {Math.round(zoomV * 100)}%
            </span>
            <button
              type="button"
              onClick={() => stepZoomV(1.2)}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
              title="Aumentar Zoom Vertical do Vídeo"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {/* Lock Proportional H=V toggle */}
          <button
            type="button"
            onClick={() => {
              if (!lockAspect) applyZoom(zoomH, zoomH, 'Proporção travada');
              setLockAspect(!lockAspect);
            }}
            className={`px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 transition ${
              lockAspect
                ? 'bg-sky-500/20 border-sky-500/50 text-sky-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={
              lockAspect
                ? 'Proporção travada: Zoom H e V escalam juntos (clique para separar H e V)'
                : 'H e V independentes (clique para travar proporção H=V)'
            }
          >
            {lockAspect ? <Link2 className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />}
            <span>{lockAspect ? 'H=V' : 'H/V Livre'}</span>
          </button>

          {/* Reset 1:1 */}
          {isZoomed && (
            <button
              type="button"
              onClick={resetZoom}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] font-bold flex items-center gap-1 transition"
              title="Resetar Zoom e Enquadramento do Vídeo para 100%"
            >
              <Maximize2 className="w-3 h-3" />
              <span>1:1</span>
            </button>
          )}
        </div>

        {/* Mouse Wheel Direct Mode (especially great for 1-hand use & YouTube iframe!) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-slate-500 hidden lg:inline">
            Ctrl+Scroll: H · Shift/Alt+Scroll: V · Roda:
          </span>
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[10px]">
            {(
              [
                { id: 'auto', label: 'Auto', title: 'Normal (clique no vídeo; segure Ctrl para Zoom H ou Shift/Alt para Zoom V)' },
                { id: 'zoomH', label: 'Zoom H', title: 'Rolar mouse direto no vídeo dá Zoom Horizontal' },
                { id: 'zoomV', label: 'Zoom V', title: 'Rolar mouse direto no vídeo dá Zoom Vertical' },
                { id: 'pan', label: 'Mover', title: 'Arrastar o vídeo ampliado para enquadrar mãos/instrumento' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setWheelMode(opt.id)}
                title={opt.title}
                className={`px-2 py-0.5 rounded font-semibold flex items-center gap-1 transition ${
                  wheelMode === opt.id
                    ? opt.id === 'zoomV'
                      ? 'bg-violet-500 text-slate-950'
                      : 'bg-sky-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.id === 'pan' && <Move className="w-2.5 h-2.5" />}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

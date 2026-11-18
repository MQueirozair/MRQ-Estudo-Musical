import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Flag,
  FolderOpen,
  Maximize2,
  Minus,
  MoveHorizontal,
  MoveVertical,
  Plus,
  Radio,
  RefreshCw,
  Repeat,
  Youtube,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { MarkerItem } from '../types/music';
import { formatTime } from '../data/chordDiagrams';
import { VideoZoomStage } from './VideoZoomStage';

export interface YouTubeStudyPlayerHandle {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stop: () => void;
  seek: (sec: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (vol: number, muted: boolean) => void;
  startFromBeginningForCapture: () => void;
}

interface YouTubeStudyPlayerProps {
  videoId: string;
  videoUrl?: string | null;
  title: string;
  channel?: string;
  duration: number;
  bpm: number | null;
  musicalKey: string | null;
  currentTime: number;
  isPlaying: boolean;
  speed: number;
  volume: number;
  muted: boolean;
  loopEnabled: boolean;
  loopA: number;
  loopB: number;
  precountSec: number;
  markers: MarkerItem[];
  manualBeats: number[];
  onTimeUpdate: (sec: number) => void;
  onSeekRequest?: (sec: number) => void;
  onDurationReady: (sec: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onPrecountTick: (remaining: number) => void;
  onLoopChange: (a: number, b: number, enabled?: boolean) => void;
  onSeekMarkerLoop: (marker: MarkerItem) => void;
  onOpenYouTubeModal: () => void;
  onOpenLocalAudio: () => void;
  hasAttachedAudio?: boolean;
  audioSourceMode?: 'youtube' | 'dsp';
  onAudioSourceModeChange?: (mode: 'youtube' | 'dsp') => void;
  onAttachAudioToVideo?: () => void;
  onOpenSystemCapture?: () => void;
  onVideoEnded?: () => void;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    __mrqYtApiPromise?: Promise<any>;
  }
}

function loadYouTubeIframeAPI(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (window.__mrqYtApiPromise) return window.__mrqYtApiPromise;

  window.__mrqYtApiPromise = new Promise((resolve, reject) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      reject(new Error('Tempo esgotado ao carregar a API oficial do YouTube. Verifique sua conexão com a internet.'));
    }, 15000);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      if (prevReady) {
        try {
          prevReady();
        } catch {
          // ignore
        }
      }
      resolve(window.YT);
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => {
        window.clearTimeout(timeout);
        window.__mrqYtApiPromise = undefined;
        reject(new Error('Não foi possível conectar ao YouTube (verifique sua conexão com a internet).'));
      };
      document.head.appendChild(tag);
    }
  });

  return window.__mrqYtApiPromise;
}

function playClickSound(accent: boolean): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = accent ? 1180 : 820;
    gain.gain.setValueAtTime(accent ? 0.22 : 0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 150);
  } catch {
    // ignore Web Audio failure
  }
}

export const YouTubeStudyPlayer = forwardRef<YouTubeStudyPlayerHandle, YouTubeStudyPlayerProps>(
  function YouTubeStudyPlayer(props, ref) {
    const {
      videoId,
      videoUrl,
      title,
      channel,
      duration,
      bpm,
      musicalKey,
      currentTime,
      isPlaying,
      speed,
      volume,
      muted,
      loopEnabled,
      loopA,
      loopB,
      precountSec,
      markers,
      manualBeats,
      onTimeUpdate,
      onSeekRequest,
      onDurationReady,
      onPlayStateChange,
      onPrecountTick,
      onLoopChange,
      onSeekMarkerLoop,
      onOpenYouTubeModal,
      onOpenLocalAudio,
      hasAttachedAudio = false,
      audioSourceMode = 'youtube',
      onAudioSourceModeChange,
      onAttachAudioToVideo,
      onOpenSystemCapture,
      onVideoEnded,
    } = props;

    const isDspMaster = hasAttachedAudio && audioSourceMode === 'dsp';
    const isDspMasterRef = useRef(isDspMaster);
    isDspMasterRef.current = isDspMaster;

    const mountRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<any>(null);
    const [playerReady, setPlayerReady] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadSeed, setReloadSeed] = useState(0);

    // Timeline zoom & drag state
    const [zoom, setZoom] = useState(1);
    const [timelineZoomV, setTimelineZoomV] = useState(1);
    const [timelineWheelMode, setTimelineWheelMode] = useState<'auto' | 'zoomH' | 'zoomV'>('auto');
    const [viewStartFrac, setViewStartFrac] = useState(0);
    const timelineRef = useRef<HTMLDivElement | null>(null);
    const dragModeRef = useRef<'none' | 'create' | 'moveA' | 'moveB' | 'scrub'>('none');
    const dragAnchorSecRef = useRef(0);

    // Keep latest props in refs for rAF loop & precount callbacks
    const loopRef = useRef({ enabled: loopEnabled, a: loopA, b: loopB, precount: precountSec });
    loopRef.current = { enabled: loopEnabled, a: loopA, b: loopB, precount: precountSec };

    const speedRef = useRef(speed);
    speedRef.current = speed;

    const volumeRef = useRef({ volume, muted });
    volumeRef.current = { volume, muted };

    const onDurationReadyRef = useRef(onDurationReady);
    onDurationReadyRef.current = onDurationReady;

    const onPlayStateChangeRef = useRef(onPlayStateChange);
    onPlayStateChangeRef.current = onPlayStateChange;

    const onPrecountTickRef = useRef(onPrecountTick);
    onPrecountTickRef.current = onPrecountTick;

    const onVideoEndedRef = useRef(onVideoEnded);
    onVideoEndedRef.current = onVideoEnded;

    const precountTimersRef = useRef<number[]>([]);
    const precountBusyRef = useRef(false);

    const clearPrecount = useCallback(() => {
      precountTimersRef.current.forEach((id) => window.clearTimeout(id));
      precountTimersRef.current = [];
      precountBusyRef.current = false;
      onPrecountTickRef.current(0);
    }, []);

    const runWithPrecount = useCallback(
      (action: () => void) => {
        clearPrecount();
        const pc = loopRef.current.precount;
        if (pc <= 0) {
          action();
          return;
        }
        precountBusyRef.current = true;
        const steps = pc < 1 ? 2 : Math.round(pc);
        const stepMs = (pc * 1000) / steps;
        for (let i = 0; i < steps; i++) {
          const timerId = window.setTimeout(() => {
            onPrecountTickRef.current(Number((pc - (i * stepMs) / 1000).toFixed(1)));
            playClickSound(i === 0);
          }, i * stepMs);
          precountTimersRef.current.push(timerId);
        }
        const finalId = window.setTimeout(() => {
          precountBusyRef.current = false;
          onPrecountTickRef.current(0);
          action();
        }, pc * 1000);
        precountTimersRef.current.push(finalId);
      },
      [clearPrecount]
    );

    // Initialize official YouTube IFrame Player whenever videoId or reloadSeed changes
    useEffect(() => {
      let cancelled = false;
      setPlayerReady(false);
      setLoadError(null);
      clearPrecount();

      const container = mountRef.current;
      if (!container || !videoId) return;

      // Prepare clean host element for YT.Player
      container.innerHTML = '';
      const hostEl = document.createElement('div');
      hostEl.className = 'w-full h-full';
      container.appendChild(hostEl);

      loadYouTubeIframeAPI()
        .then((YT) => {
          if (cancelled || !mountRef.current) return;
          const origin =
            window.location.origin && window.location.origin.startsWith('http')
              ? window.location.origin
              : undefined;

          const player = new YT.Player(hostEl, {
            videoId,
            width: '100%',
            height: '100%',
            playerVars: {
              autoplay: 0,
              controls: 1,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              enablejsapi: 1,
              fs: 1,
              ...(origin ? { origin } : {}),
            },
            events: {
              onReady: (ev: any) => {
                if (cancelled) return;
                playerRef.current = ev.target;
                try {
                  const iframe = ev.target.getIframe?.();
                  if (iframe) {
                    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = '0';
                  }
                } catch {
                  // ignore
                }
                setPlayerReady(true);
                const dur = Number(ev.target.getDuration?.() || 0);
                if (dur > 0) onDurationReadyRef.current(dur);
                try {
                  ev.target.setPlaybackRate(speedRef.current);
                  ev.target.setVolume(Math.round(volumeRef.current.volume * 100));
                  if (volumeRef.current.muted || isDspMasterRef.current) ev.target.mute();
                  else ev.target.unMute();
                } catch {
                  // ignore
                }
              },
              onStateChange: (ev: any) => {
                if (cancelled) return;
                const YTState = window.YT?.PlayerState;
                if (!YTState) return;
                const dur = Number(ev.target.getDuration?.() || 0);
                if (dur > 0) onDurationReadyRef.current(dur);

                if (isDspMasterRef.current) {
                  // In hybrid DSP/Stems mode, MRQPlaybackEngine owns play state; keep YouTube muted
                  try {
                    ev.target.mute();
                  } catch {
                    // ignore
                  }
                  return;
                }

                if (ev.data === YTState.PLAYING) {
                  onPlayStateChangeRef.current(true);
                  try {
                    ev.target.setPlaybackRate(speedRef.current);
                  } catch {
                    // ignore
                  }
                } else if (ev.data === YTState.PAUSED || ev.data === YTState.ENDED) {
                  onPlayStateChangeRef.current(false);
                  if (ev.data === YTState.ENDED) {
                    onVideoEndedRef.current?.();
                    if (
                      loopRef.current.enabled &&
                      loopRef.current.b > loopRef.current.a + 0.1
                    ) {
                      ev.target.seekTo(loopRef.current.a, true);
                      runWithPrecount(() => ev.target.playVideo());
                    }
                  }
                }
              },
              onError: (ev: any) => {
                if (cancelled) return;
                const code = ev?.data;
                if (code === 101 || code === 150) {
                  setLoadError(
                    'O proprietário deste vídeo desativou a reprodução incorporada fora do YouTube (Erro ' +
                      code +
                      '). Tente outro vídeo ou importe o arquivo de áudio local.'
                  );
                } else if (code === 100) {
                  setLoadError('Vídeo não encontrado ou privado no YouTube (Erro 100).');
                } else if (code === 153) {
                  setLoadError(
                    'O YouTube bloqueou a incorporação por política de origem (Erro 153). Clique em Recarregar ou abra o vídeo no navegador.'
                  );
                } else {
                  setLoadError(`Erro ao reproduzir o vídeo no YouTube (código ${code ?? 'desconhecido'}).`);
                }
              },
            },
          });
          playerRef.current = player;
        })
        .catch((err) => {
          if (!cancelled) {
            setLoadError(err?.message || 'Erro ao inicializar o Player do YouTube.');
          }
        });

      return () => {
        cancelled = true;
        clearPrecount();
        try {
          playerRef.current?.destroy?.();
        } catch {
          // ignore
        }
        playerRef.current = null;
      };
    }, [videoId, reloadSeed, clearPrecount, runWithPrecount]);

    // Sync speed changes directly to YouTube IFrame Player
    useEffect(() => {
      if (!playerReady || !playerRef.current) return;
      try {
        // Snap smoothly to nearest rate supported by YT player if needed
        const rates: number[] = playerRef.current.getAvailablePlaybackRates?.() || [
          0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2,
        ];
        let best = speed;
        if (rates.length > 0) {
          best = rates.reduce((prev, cur) => (Math.abs(cur - speed) < Math.abs(prev - speed) ? cur : prev), rates[0]);
        }
        playerRef.current.setPlaybackRate(best);
      } catch {
        // ignore
      }
    }, [speed, playerReady]);

    // Sync volume / mute changes (always muted when Hybrid C++17 DSP/Stems drives audio)
    useEffect(() => {
      if (!playerReady || !playerRef.current) return;
      try {
        playerRef.current.setVolume(Math.round(Math.max(0, Math.min(1, volume)) * 100));
        if (muted || isDspMaster) playerRef.current.mute();
        else playerRef.current.unMute();
      } catch {
        // ignore
      }
    }, [volume, muted, isDspMaster, playerReady]);

    // When Hybrid C++17 DSP/Stems is master clock, keep muted YouTube video visually synced
    useEffect(() => {
      if (!playerReady || !playerRef.current || !isDspMaster) return;
      const p = playerRef.current;
      try {
        p.mute();
        const YTState = window.YT?.PlayerState;
        const st = p.getPlayerState?.();
        if (isPlaying) {
          const ytTime = Number(p.getCurrentTime?.() || 0);
          if (Math.abs(ytTime - currentTime) > 0.45) {
            p.seekTo?.(currentTime, true);
          }
          if (YTState && st !== YTState.PLAYING && st !== YTState.BUFFERING) {
            p.playVideo?.();
          }
        } else if (YTState && st === YTState.PLAYING) {
          p.pauseVideo?.();
        }
      } catch {
        // ignore
      }
    }, [isDspMaster, isPlaying, playerReady]);

    // Sync seek jumps to muted YouTube player in hybrid DSP mode
    useEffect(() => {
      if (!playerReady || !playerRef.current || !isDspMaster) return;
      try {
        const ytTime = Number(playerRef.current.getCurrentTime?.() || 0);
        const threshold = isPlaying ? 0.65 : 0.2;
        if (Math.abs(ytTime - currentTime) > threshold) {
          playerRef.current.seekTo?.(currentTime, true);
        }
      } catch {
        // ignore
      }
    }, [currentTime, isDspMaster, isPlaying, playerReady]);

    // High-precision 60fps time polling & A→B Loop Engine (only when YouTube is master clock)
    useEffect(() => {
      if (!playerReady || isDspMaster) return;
      let rafId = 0;
      const tick = () => {
        const p = playerRef.current;
        if (p && typeof p.getCurrentTime === 'function') {
          try {
            const t = Number(p.getCurrentTime() || 0);
            const dur = Number(p.getDuration?.() || 0);
            if (dur > 0 && Math.abs(dur - duration) > 0.5) {
              onDurationReady(dur);
            }
            onTimeUpdate(t);

            const YTState = window.YT?.PlayerState;
            const playingNow = YTState && p.getPlayerState?.() === YTState.PLAYING;
            const lp = loopRef.current;
            if (
              playingNow &&
              !precountBusyRef.current &&
              lp.enabled &&
              lp.b > lp.a + 0.15 &&
              t >= lp.b - 0.04
            ) {
              if (lp.precount > 0) {
                p.pauseVideo();
                p.seekTo(lp.a, true);
                runWithPrecount(() => p.playVideo());
              } else {
                p.seekTo(lp.a, true);
              }
            }
          } catch {
            // ignore transient poll error
          }
        }
        rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
      return () => window.cancelAnimationFrame(rafId);
    }, [playerReady, duration, onTimeUpdate, onDurationReady, runWithPrecount]);

    // Imperative handle for TransportBar / keyboard shortcuts
    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          const p = playerRef.current;
          if (!p) return;
          const lp = loopRef.current;
          if (lp.enabled && lp.b > lp.a + 0.15) {
            const cur = Number(p.getCurrentTime?.() || 0);
            if (cur < lp.a - 0.1 || cur >= lp.b - 0.05) {
              p.seekTo(lp.a, true);
            }
          }
          runWithPrecount(() => p.playVideo?.());
        },
        pause: () => {
          clearPrecount();
          playerRef.current?.pauseVideo?.();
        },
        togglePlay: () => {
          const p = playerRef.current;
          if (!p) return;
          const YTState = window.YT?.PlayerState;
          if (precountBusyRef.current) {
            clearPrecount();
            return;
          }
          if (YTState && p.getPlayerState?.() === YTState.PLAYING) {
            p.pauseVideo?.();
          } else {
            const lp = loopRef.current;
            if (lp.enabled && lp.b > lp.a + 0.15) {
              const cur = Number(p.getCurrentTime?.() || 0);
              if (cur < lp.a - 0.1 || cur >= lp.b - 0.05) {
                p.seekTo(lp.a, true);
              }
            }
            runWithPrecount(() => p.playVideo?.());
          }
        },
        stop: () => {
          clearPrecount();
          const p = playerRef.current;
          if (!p) return;
          p.pauseVideo?.();
          const target = loopRef.current.enabled && loopRef.current.b > loopRef.current.a ? loopRef.current.a : 0;
          p.seekTo?.(target, true);
          onTimeUpdate(target);
        },
        seek: (sec: number) => {
          const clamped = Math.max(0, Math.min(duration || 36000, sec));
          playerRef.current?.seekTo?.(clamped, true);
          onTimeUpdate(clamped);
        },
        setPlaybackRate: (rate: number) => {
          try {
            playerRef.current?.setPlaybackRate?.(rate);
          } catch {
            // ignore
          }
        },
        setVolume: (vol: number, isMuted: boolean) => {
          try {
            playerRef.current?.setVolume?.(Math.round(vol * 100));
            if (isMuted) playerRef.current?.mute?.();
            else playerRef.current?.unMute?.();
          } catch {
            // ignore
          }
        },
        startFromBeginningForCapture: () => {
          clearPrecount();
          const p = playerRef.current;
          if (!p) return;
          try {
            p.unMute?.();
            p.setVolume?.(100);
            p.setPlaybackRate?.(1.0);
            p.seekTo?.(0, true);
            onTimeUpdate(0);
            p.playVideo?.();
          } catch {
            // ignore
          }
        },
      }),
      [clearPrecount, duration, onTimeUpdate, runWithPrecount]
    );

    // ---- Zoomable Loop A -> B Timeline Math ----
    const visibleDur = useMemo(() => (duration > 0 ? duration / zoom : 1), [duration, zoom]);
    const maxStartFrac = useMemo(() => Math.max(0, 1 - 1 / zoom), [zoom]);
    const clampedStartFrac = Math.min(maxStartFrac, Math.max(0, viewStartFrac));
    const viewStartSec = clampedStartFrac * duration;
    const viewEndSec = viewStartSec + visibleDur;

    const secToPct = useCallback(
      (sec: number) => {
        if (visibleDur <= 0) return 0;
        return ((sec - viewStartSec) / visibleDur) * 100;
      },
      [viewStartSec, visibleDur]
    );

    const clientXToSec = useCallback(
      (clientX: number) => {
        const el = timelineRef.current;
        if (!el || duration <= 0) return 0;
        const rect = el.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.max(0, Math.min(duration, viewStartSec + frac * visibleDur));
      },
      [duration, viewStartSec, visibleDur]
    );

    const handleTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (duration <= 0 || e.button !== 0) return;
      const target = e.target as HTMLElement;
      const handleRole = target.dataset.handle;
      const sec = clientXToSec(e.clientX);
      e.currentTarget.setPointerCapture(e.pointerId);

      if (handleRole === 'A') {
        dragModeRef.current = 'moveA';
      } else if (handleRole === 'B') {
        dragModeRef.current = 'moveB';
      } else {
        dragModeRef.current = 'create';
        dragAnchorSecRef.current = sec;
      }
    };

    const handleTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragModeRef.current === 'none' || duration <= 0) return;
      const sec = clientXToSec(e.clientX);
      if (dragModeRef.current === 'moveA') {
        const nextA = Math.min(sec, Math.max(0, loopB - 0.25));
        onLoopChange(nextA, loopB, true);
      } else if (dragModeRef.current === 'moveB') {
        const nextB = Math.max(sec, Math.min(duration, loopA + 0.25));
        onLoopChange(loopA, nextB, true);
      } else if (dragModeRef.current === 'create') {
        const dist = Math.abs(sec - dragAnchorSecRef.current);
        if (dist > 0.2) {
          const a = Math.min(dragAnchorSecRef.current, sec);
          const b = Math.max(dragAnchorSecRef.current, sec);
          onLoopChange(a, b, true);
        }
      }
    };

    const handleTimelinePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragModeRef.current === 'none') return;
      const sec = clientXToSec(e.clientX);
      if (dragModeRef.current === 'create' && Math.abs(sec - dragAnchorSecRef.current) <= 0.2) {
        // Simple click => seek
        if (onSeekRequest) {
          onSeekRequest(sec);
        } else {
          playerRef.current?.seekTo?.(sec, true);
          onTimeUpdate(sec);
        }
      }
      dragModeRef.current = 'none';
    };

    const ticks = useMemo(() => {
      if (duration <= 0) return [];
      const approxCount = 10;
      const rawStep = visibleDur / approxCount;
      const niceSteps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
      const step = niceSteps.find((s) => s >= rawStep) || 600;
      const first = Math.ceil(viewStartSec / step) * step;
      const out: number[] = [];
      for (let t = first; t <= viewEndSec; t += step) {
        out.push(t);
      }
      return out;
    }, [duration, visibleDur, viewStartSec, viewEndSec]);

    const loopLeftPct = secToPct(loopA);
    const loopRightPct = secToPct(loopB);
    const playheadPct = secToPct(currentTime);

    const timelineWheelStateRef = useRef({
      zoom,
      timelineZoomV,
      viewStartFrac,
      duration,
      currentTime,
      timelineWheelMode,
    });
    timelineWheelStateRef.current = {
      zoom,
      timelineZoomV,
      viewStartFrac: clampedStartFrac,
      duration,
      currentTime,
      timelineWheelMode,
    };

    const adjustZoom = useCallback((factor: number, anchorClientX?: number) => {
      const s = timelineWheelStateRef.current;
      const next = Math.max(1, Math.min(32, Number((s.zoom * factor).toFixed(2))));
      if (next <= 1.01) {
        s.viewStartFrac = 0;
        setViewStartFrac(0);
      } else {
        const el = timelineRef.current;
        const rect = el?.getBoundingClientRect();
        const cursorRatio =
          anchorClientX !== undefined && rect && rect.width > 0
            ? Math.max(0, Math.min(1, (anchorClientX - rect.left) / rect.width))
            : s.duration > 0
            ? Math.max(0, Math.min(1, (s.currentTime / s.duration - s.viewStartFrac) * s.zoom))
            : 0.5;
        const curSpanFrac = 1 / Math.max(1, s.zoom);
        const anchorFrac = s.viewStartFrac + cursorRatio * curSpanFrac;
        const nextSpanFrac = 1 / next;
        const nextStart = Math.max(0, Math.min(1 - nextSpanFrac, anchorFrac - cursorRatio * nextSpanFrac));
        s.viewStartFrac = nextStart;
        setViewStartFrac(nextStart);
      }
      s.zoom = next;
      setZoom(next);
    }, []);

    const adjustTimelineZoomV = useCallback((factor: number) => {
      setTimelineZoomV((prev) => Math.max(1, Math.min(3.0, Number((prev * factor).toFixed(2)))));
    }, []);

    // Native NON-PASSIVE wheel listener on the YouTube timeline track:
    //   - Ctrl + Scroll          => Cursor-centered Horizontal Zoom (1x - 32x)
    //   - Shift/Alt + Scroll     => Vertical Height Zoom (64px - 192px)
    //   - Ctrl + Shift + Scroll  => Horizontal + Vertical Zoom together
    //   - Direct Scroll mode     => Zoom H or Zoom V without modifier keys
    //   - Plain Scroll (zoomed)  => Smooth horizontal pan
    useEffect(() => {
      const el = timelineRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        const s = timelineWheelStateRef.current;
        const hasCtrl = e.ctrlKey || e.metaKey;
        const hasShiftOrAlt = e.shiftKey || e.altKey;
        const rawDelta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (rawDelta === 0) return;

        const factorH = rawDelta < 0 ? 1.22 : 1 / 1.22;
        const factorV = rawDelta < 0 ? 1.15 : 1 / 1.15;

        if (hasCtrl && hasShiftOrAlt) {
          e.preventDefault();
          e.stopPropagation();
          adjustZoom(factorH, e.clientX);
          adjustTimelineZoomV(factorV);
          return;
        }
        if (hasCtrl) {
          e.preventDefault();
          e.stopPropagation();
          adjustZoom(factorH, e.clientX);
          return;
        }
        if (hasShiftOrAlt) {
          e.preventDefault();
          e.stopPropagation();
          adjustTimelineZoomV(factorV);
          return;
        }
        if (s.timelineWheelMode === 'zoomH') {
          e.preventDefault();
          e.stopPropagation();
          adjustZoom(factorH, e.clientX);
          return;
        }
        if (s.timelineWheelMode === 'zoomV') {
          e.preventDefault();
          e.stopPropagation();
          adjustTimelineZoomV(factorV);
          return;
        }
        if (s.zoom > 1.01) {
          e.preventDefault();
          const spanFrac = 1 / s.zoom;
          const maxStart = Math.max(0, 1 - spanFrac);
          const step = (rawDelta > 0 ? 1 : -1) * spanFrac * 0.14;
          setViewStartFrac((prev) => Math.max(0, Math.min(maxStart, prev + step)));
        }
      };

      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }, [adjustZoom, adjustTimelineZoomV]);

    const timelineHeightPx = Math.round(64 * timelineZoomV);

    return (
      <section className="bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Top Track Banner (TuneTranscriber v3 inspired) */}
        <div className="px-4 py-3 bg-gradient-to-r from-[#111827] via-[#131C2E] to-[#111827] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-amber-400">
              <Youtube className="w-3.5 h-3.5 text-rose-500" />
              <span>Transcrevendo Agora · Player Oficial YouTube</span>
              {channel && <span className="text-slate-400 normal-case tracking-normal font-medium">· {channel}</span>}
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white truncate mt-0.5">{title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Key Metric Pills (DURAÇÃO, TEMPO, TOM) */}
            <div className="hidden md:flex items-center gap-2 mr-1">
              <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-center min-w-[74px]">
                <div className="text-[9px] uppercase tracking-wider text-slate-400">Duração</div>
                <div className="text-xs font-mono font-bold text-slate-100">{formatTime(duration, false)}</div>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-center min-w-[74px]">
                <div className="text-[9px] uppercase tracking-wider text-slate-400">Tempo</div>
                <div className="text-xs font-mono font-bold text-sky-300">
                  {bpm ? `${Math.round(bpm)} BPM` : '—'}
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-center min-w-[74px]">
                <div className="text-[9px] uppercase tracking-wider text-slate-400">Tom</div>
                <div className="text-xs font-bold text-indigo-300 truncate max-w-[96px]">
                  {musicalKey || '—'}
                </div>
              </div>
            </div>

            {hasAttachedAudio && onAudioSourceModeChange ? (
              <div className="flex items-center rounded-lg bg-slate-900 border border-slate-700 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => onAudioSourceModeChange('dsp')}
                  className={`px-2 py-1 rounded-md font-bold transition ${
                    audioSourceMode === 'dsp'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Usa o áudio vinculado processado pelo Motor DSP C++17 (Pitch, IA e 4 Stems) sincronizado ao vídeo"
                >
                  DSP / Stems
                </button>
                <button
                  type="button"
                  onClick={() => onAudioSourceModeChange('youtube')}
                  className={`px-2 py-1 rounded-md font-bold transition ${
                    audioSourceMode === 'youtube'
                      ? 'bg-rose-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Usa o áudio direto do Player Oficial do YouTube"
                >
                  YouTube
                </button>
              </div>
            ) : (
              onAttachAudioToVideo && (
                <button
                  type="button"
                  onClick={onAttachAudioToVideo}
                  className="px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-200 text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Vincular arquivo de áudio/vídeo local a este projeto do YouTube para liberar IA, Pitch ±12st e 4 Stems sincronizados"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Vincular Arquivo</span>
                </button>
              )
            )}

            {onOpenSystemCapture && (
              <button
                type="button"
                onClick={onOpenSystemCapture}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition"
                title="Capturar o Som do Sistema (saída estéreo do computador) para gerar Forma de Onda, IA, 4 Stems e exportar MP3/WAV/FLAC"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{hasAttachedAudio ? 'Recapturar Som' : 'Capturar Som do Sistema'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenYouTubeModal}
              className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Youtube className="w-3.5 h-3.5 text-rose-400" />
              <span>Trocar Vídeo</span>
            </button>

            <button
              type="button"
              onClick={onOpenLocalAudio}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition"
              title="Importar arquivo de áudio local para DSP C++17, Espectrograma FFT, IA e Stems"
            >
              <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Áudio Local</span>
            </button>

            {videoUrl && (
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-100 transition"
                title="Abrir vídeo original no YouTube"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Official YouTube 16:9 Cinema Stage with Horizontal + Vertical Zoom & Pan */}
        <VideoZoomStage isIframe baseMaxWidthClass="max-w-[820px]">
          <div className="relative w-full h-full">
            <div ref={mountRef} className="w-full h-full" />

            {!playerReady && !loadError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-slate-300 gap-2 pointer-events-none">
                <Youtube className="w-9 h-9 text-rose-500 animate-pulse" />
                <div className="text-xs font-medium">Carregando Player Oficial do YouTube...</div>
              </div>
            )}

            {loadError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center gap-3">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
                <p className="text-xs sm:text-sm text-slate-200 max-w-md">{loadError}</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReloadSeed((s) => s + 1)}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Recarregar Player
                  </button>
                  <button
                    type="button"
                    onClick={onOpenYouTubeModal}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                  >
                    Colar Outro Link
                  </button>
                  {videoUrl && (
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-200 text-xs font-medium flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Abrir no YouTube
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </VideoZoomStage>

        {/* Interactive Zoomable Loop A -> B Timeline (TuneTranscriber v3 style) */}
        <div className="px-4 pt-3 pb-3 bg-[#0B1220] select-none">
          {/* Timeline Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-100 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded">
                {formatTime(currentTime, true)}
              </span>
              <span className="text-slate-500">/</span>
              <span className="font-mono text-slate-400">{formatTime(duration, false)}</span>
              {loopEnabled && loopB > loopA + 0.1 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono font-semibold flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  A {formatTime(loopA, true)} → B {formatTime(loopB, true)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 hidden lg:inline">
                {markers.length} marcas · {manualBeats.length} batidas
              </span>
              {/* Zoom Horizontal (Timeline) */}
              <div
                className="flex items-center rounded-lg bg-slate-900 border border-slate-700 overflow-hidden"
                title="Zoom Horizontal da Linha do Tempo (Ctrl+Scroll)"
              >
                <span className="px-1.5 text-sky-400 flex items-center gap-0.5 text-[10px] font-bold">
                  <MoveHorizontal className="w-3 h-3" /> H
                </span>
                <button
                  type="button"
                  onClick={() => adjustZoom(1 / 1.5)}
                  className="px-1.5 py-1 text-slate-300 hover:bg-slate-800 transition"
                  title="Reduzir zoom horizontal (Ctrl+Scroll ↓)"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-1.5 py-1 text-[10px] font-mono font-bold text-sky-300 border-x border-slate-800">
                  {zoom.toFixed(1)}×
                </span>
                <button
                  type="button"
                  onClick={() => adjustZoom(1.5)}
                  className="px-1.5 py-1 text-slate-300 hover:bg-slate-800 transition"
                  title="Aumentar zoom horizontal (Ctrl+Scroll ↑)"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Zoom Vertical (Timeline Height) */}
              <div
                className="flex items-center rounded-lg bg-slate-900 border border-slate-700 overflow-hidden"
                title="Zoom Vertical da Linha do Tempo (Shift/Alt+Scroll)"
              >
                <span className="px-1.5 text-violet-400 flex items-center gap-0.5 text-[10px] font-bold">
                  <MoveVertical className="w-3 h-3" /> V
                </span>
                <button
                  type="button"
                  onClick={() => adjustTimelineZoomV(1 / 1.25)}
                  className="px-1.5 py-1 text-slate-300 hover:bg-slate-800 transition"
                  title="Reduzir zoom vertical (Shift/Alt+Scroll ↓)"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-1.5 py-1 text-[10px] font-mono font-bold text-violet-300 border-x border-slate-800">
                  {timelineZoomV.toFixed(1)}×
                </span>
                <button
                  type="button"
                  onClick={() => adjustTimelineZoomV(1.25)}
                  className="px-1.5 py-1 text-slate-300 hover:bg-slate-800 transition"
                  title="Aumentar zoom vertical (Shift/Alt+Scroll ↑)"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {(zoom > 1.01 || timelineZoomV > 1.01) && (
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setTimelineZoomV(1);
                    setViewStartFrac(0);
                  }}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 flex items-center gap-1"
                  title="Resetar Zoom H e V da Linha do Tempo"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>1:1</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Loop & Marker Scrubber Track */}
          <div
            ref={timelineRef}
            onPointerDown={handleTimelinePointerDown}
            onPointerMove={handleTimelinePointerMove}
            onPointerUp={handleTimelinePointerUp}
            onPointerCancel={() => { dragModeRef.current = 'none'; }}
            onLostPointerCapture={() => { dragModeRef.current = 'none'; }}
            style={{ height: `${timelineHeightPx}px` }}
            className="relative rounded-xl bg-slate-950/90 border border-slate-800 overflow-hidden cursor-crosshair touch-none transition-[height] duration-150"
          >
            {/* Subtle time grid ticks */}
            {ticks.map((t) => {
              const pct = secToPct(t);
              return (
                <div
                  key={t}
                  style={{ left: `${pct}%` }}
                  className="absolute top-0 bottom-0 border-l border-slate-800/80 pointer-events-none"
                >
                  <span className="absolute bottom-1 left-1 text-[9px] font-mono text-slate-500">
                    {formatTime(t, false)}
                  </span>
                </div>
              );
            })}

            {/* Manual Beats (B) ticks */}
            {manualBeats.map((b, idx) => {
              if (b < viewStartSec || b > viewEndSec) return null;
              const pct = secToPct(b);
              return (
                <div
                  key={`${b}-${idx}`}
                  style={{ left: `${pct}%` }}
                  className="absolute top-0 h-3 w-[2px] bg-emerald-400/75 pointer-events-none"
                  title={`Batida @ ${formatTime(b, true)}`}
                />
              );
            })}

            {/* Saved Markers (M) */}
            {markers.map((mk) => {
              if (mk.time_sec < viewStartSec || mk.time_sec > viewEndSec) return null;
              const pct = secToPct(mk.time_sec);
              return (
                <button
                  key={mk.id}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    if (onSeekRequest) onSeekRequest(mk.time_sec);
                    else {
                      playerRef.current?.seekTo?.(mk.time_sec, true);
                      onTimeUpdate(mk.time_sec);
                    }
                  }}
                  onDoubleClick={() => onSeekMarkerLoop(mk)}
                  style={{ left: `${pct}%` }}
                  className="absolute top-0 bottom-0 z-10 group"
                  title={`${mk.label} (${formatTime(mk.time_sec, true)}) — Clique: ir · Duplo clique: loop da seção`}
                >
                  <div
                    className="w-[2px] h-full opacity-80 group-hover:opacity-100"
                    style={{ backgroundColor: mk.color || '#38bdf8' }}
                  />
                  <span
                    className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-semibold text-white whitespace-nowrap shadow flex items-center gap-0.5"
                    style={{ backgroundColor: mk.color || '#0284c7' }}
                  >
                    <Flag className="w-2.5 h-2.5" />
                    {mk.label}
                  </span>
                </button>
              );
            })}

            {/* Active Loop A -> B Highlight Region */}
            {loopB > loopA + 0.1 && (
              <div
                style={{
                  left: `${Math.max(0, loopLeftPct)}%`,
                  width: `${Math.max(0, Math.min(100, loopRightPct) - Math.max(0, loopLeftPct))}%`,
                }}
                className={`absolute top-0 bottom-0 transition-colors ${
                  loopEnabled
                    ? 'bg-amber-500/25 border-y-2 border-amber-400/80'
                    : 'bg-amber-500/10 border-y border-amber-500/30'
                }`}
              />
            )}

            {/* Draggable Loop A Handle */}
            {loopB > loopA + 0.1 && loopLeftPct >= -2 && loopLeftPct <= 102 && (
              <div
                data-handle="A"
                style={{ left: `${loopLeftPct}%` }}
                className="absolute top-0 bottom-0 -ml-2.5 w-5 z-20 flex flex-col items-center cursor-ew-resize group"
                title={`Arrastar ponto A (${formatTime(loopA, true)})`}
              >
                <div
                  data-handle="A"
                  className="mt-1 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px] shadow-lg group-hover:scale-110 transition"
                >
                  A
                </div>
                <div data-handle="A" className="w-[2px] flex-1 bg-amber-400" />
              </div>
            )}

            {/* Draggable Loop B Handle */}
            {loopB > loopA + 0.1 && loopRightPct >= -2 && loopRightPct <= 102 && (
              <div
                data-handle="B"
                style={{ left: `${loopRightPct}%` }}
                className="absolute top-0 bottom-0 -ml-2.5 w-5 z-20 flex flex-col items-center cursor-ew-resize group"
                title={`Arrastar ponto B (${formatTime(loopB, true)})`}
              >
                <div
                  data-handle="B"
                  className="mt-1 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px] shadow-lg group-hover:scale-110 transition"
                >
                  B
                </div>
                <div data-handle="B" className="w-[2px] flex-1 bg-amber-400" />
              </div>
            )}

            {/* Live Playhead Indicator */}
            {playheadPct >= 0 && playheadPct <= 100 && (
              <div
                style={{ left: `${playheadPct}%` }}
                className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] z-30 pointer-events-none"
              >
                <div className="absolute -top-0.5 -translate-x-1/2 px-1.5 py-0.5 rounded bg-white text-slate-950 font-mono font-bold text-[9px] shadow">
                  {formatTime(currentTime, true)}
                </div>
              </div>
            )}
          </div>

          {/* Pan Scrollbar when zoomed */}
          {zoom > 1 && (
            <div className="mt-2 flex items-center gap-2">
              <ZoomOut className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input
                type="range"
                min={0}
                max={maxStartFrac}
                step={0.001}
                value={clampedStartFrac}
                onChange={(e) => setViewStartFrac(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
                aria-label="Deslocar janela de zoom da linha do tempo"
              />
              <ZoomIn className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>
              <strong className="text-sky-300">Ctrl+Scroll</strong>: Zoom Horizontal ·{' '}
              <strong className="text-violet-300">Shift/Alt+Scroll</strong>: Zoom Vertical · Arraste: Loop A→B ·{' '}
              <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">M</kbd> marcar ·{' '}
              <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">B</kbd> batida
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[10px]">
                {(
                  [
                    { id: 'auto', label: 'Auto', title: 'Ctrl+Scroll: Zoom H · Shift/Alt+Scroll: Zoom V · Scroll: Navegar' },
                    { id: 'zoomH', label: 'Zoom H', title: 'Roda do mouse dá Zoom Horizontal direto na linha do tempo' },
                    { id: 'zoomV', label: 'Zoom V', title: 'Roda do mouse dá Zoom Vertical direto na linha do tempo' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTimelineWheelMode(opt.id)}
                    title={opt.title}
                    className={`px-2 py-0.5 rounded font-semibold transition ${
                      timelineWheelMode === opt.id
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
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                {isPlaying ? 'Reproduzindo' : 'Pausado'} · {Math.round(speed * 100)}%
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }
);

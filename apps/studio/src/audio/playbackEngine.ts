import type { StemKey, StemMixerState } from '../types/music';

export interface PlaybackCallbacks {
  onTimeUpdate: (origTimeSec: number) => void;
  onPlayStateChange: (isPlaying: boolean) => void;
  onPrecountUpdate: (remainingSec: number) => void;
  onLoadingChange: (loading: boolean, message?: string) => void;
  onError: (msg: string) => void;
}

/**
 * Sample-accurate Web Audio API Playback Engine synchronized with the native C++17 DSP backend.
 *
 * Key architecture:
 * - Audio buffers are pre-processed by the real C++17 Phase Vocoder (time stretch without pitch shift)
 *   and independent Pitch Shifter (semitones + cents without tempo change).
 * - Maps rendered buffer time <-> original track timeline seamlessly (`origTime = bufTime * speed`)
 *   so waveform, spectrogram, chords, markers and piano roll stay locked to the exact musical instant.
 * - Real A/B Looping with configurable pre-count delay (0, 0.5s, 1s, 2s, 3s, 5s) + synthesized metronome clicks.
 * - Real 4-Stem synchronized multitrack playback (Vocals, Drums, Bass, Other) with instant Mute/Solo/Volume.
 */
export class MRQPlaybackEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private mainBuffer: AudioBuffer | null = null;
  private mainSource: AudioBufferSourceNode | null = null;
  private mainBufferUrl = '';

  private stemBuffers: Partial<Record<StemKey, AudioBuffer>> = {};
  private stemSources: Partial<Record<StemKey, AudioBufferSourceNode>> = {};
  private stemGains: Partial<Record<StemKey, GainNode>> = {};
  private stemsLoadedKey = '';

  private speed = 1.0;
  private origDuration = 0;
  private pausedOrigTime = 0;
  private startCtxTime = 0;
  private startBufOffset = 0;
  private isPlaying = false;

  private volume = 0.9;
  private muted = false;

  private loopEnabled = false;
  private loopA = 0;
  private loopB = 0;
  private precountSec = 0;

  private stemMixer: StemMixerState = {
    enabled: false,
    volumes: { vocals: 1, drums: 1, bass: 1, other: 1 },
    mutes: { vocals: false, drums: false, bass: false, other: false },
    solos: { vocals: false, drums: false, bass: false, other: false },
  };

  private rafId: number | null = null;
  private precountTimer: number | null = null;
  private precountEndPerf = 0;
  private inPrecount = false;
  private loadSeq = 0;
  private cb: PlaybackCallbacks;

  constructor(callbacks: PlaybackCallbacks) {
    this.cb = callbacks;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setOriginalDuration(dur: number): void {
    this.origDuration = Math.max(0, dur);
  }

  public setVolume(vol: number, muted = this.muted): void {
    this.volume = Math.max(0, Math.min(1.5, vol));
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.015);
    }
  }

  public setLoop(enabled: boolean, a: number, b: number): void {
    this.loopEnabled = enabled && b > a + 0.05;
    this.loopA = Math.max(0, a);
    this.loopB = Math.max(this.loopA, b);
  }

  public setPrecount(sec: number): void {
    this.precountSec = Math.max(0, sec);
  }

  public setStemMixer(mixer: StemMixerState): void {
    this.stemMixer = {
      enabled: mixer.enabled,
      volumes: { ...mixer.volumes },
      mutes: { ...mixer.mutes },
      solos: { ...mixer.solos },
    };
    this.applyStemGains();
  }

  private applyStemGains(): void {
    if (!this.ctx) return;
    const keys: StemKey[] = ['vocals', 'drums', 'bass', 'other'];
    const anySolo = keys.some((k) => this.stemMixer.solos[k]);
    for (const k of keys) {
      const g = this.stemGains[k];
      if (!g) continue;
      const audible = !this.stemMixer.mutes[k] && (!anySolo || this.stemMixer.solos[k]);
      const target = audible ? this.stemMixer.volumes[k] : 0;
      g.gain.setTargetAtTime(target, this.ctx.currentTime, 0.015);
    }
  }

  /**
   * Loads processed stereo audio from the native C++17 DSP backend.
   * Preserves playback position seamlessly across speed or pitch changes!
   */
  public async loadMainAudio(url: string, speed: number, preserveTimeSec?: number): Promise<void> {
    const seq = ++this.loadSeq;
    const wasPlaying = this.isPlaying || this.inPrecount;
    const resumeTime = preserveTimeSec !== undefined ? preserveTimeSec : this.getCurrentOrigTime();

    if (url === this.mainBufferUrl && this.mainBuffer) {
      this.speed = speed;
      return;
    }

    this.stopNodesOnly();
    this.cancelPrecount();
    this.cb.onLoadingChange(true, 'Processando áudio no motor C++17 DSP...');

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Erro ao carregar áudio (${res.status})`);
      const arrBuf = await res.arrayBuffer();
      if (seq !== this.loadSeq) return; // superseded by newer change

      const ctx = this.ensureContext();
      const decoded = await ctx.decodeAudioData(arrBuf);
      if (seq !== this.loadSeq) return;

      this.mainBuffer = decoded;
      this.mainBufferUrl = url;
      this.speed = speed;
      if (this.origDuration <= 0) {
        this.origDuration = decoded.duration * speed;
      }
      this.pausedOrigTime = Math.min(resumeTime, Math.max(0, this.origDuration - 0.02));
      this.cb.onLoadingChange(false);
      this.cb.onTimeUpdate(this.pausedOrigTime);

      if (wasPlaying) {
        this.startBufferPlaybackAt(this.pausedOrigTime);
      }
    } catch (err: any) {
      if (seq === this.loadSeq) {
        this.cb.onLoadingChange(false);
        this.cb.onError(err?.message || 'Falha ao decodificar áudio');
      }
    }
  }

  /**
   * Loads all 4 separated stems (vocals, drums, bass, other) at current speed & pitch.
   */
  public async loadStems(
    urls: Record<StemKey, string>,
    speed: number,
    cacheKey: string
  ): Promise<boolean> {
    if (this.stemsLoadedKey === cacheKey && this.stemBuffers.vocals) {
      this.speed = speed;
      return true;
    }

    const wasPlaying = this.isPlaying;
    const curTime = this.getCurrentOrigTime();
    this.stopNodesOnly();
    this.cb.onLoadingChange(true, 'Carregando 4 stems sincronizados...');

    try {
      const ctx = this.ensureContext();
      const keys: StemKey[] = ['vocals', 'drums', 'bass', 'other'];
      const buffers = await Promise.all(
        keys.map(async (k) => {
          const r = await fetch(urls[k]);
          if (!r.ok) throw new Error(`Stem ${k} indisponível`);
          const ab = await r.arrayBuffer();
          return [k, await ctx.decodeAudioData(ab)] as const;
        })
      );
      this.stemBuffers = {};
      for (const [k, buf] of buffers) {
        this.stemBuffers[k] = buf;
      }
      this.stemsLoadedKey = cacheKey;
      this.speed = speed;
      this.cb.onLoadingChange(false);
      if (wasPlaying && this.stemMixer.enabled) {
        this.startBufferPlaybackAt(curTime);
      }
      return true;
    } catch (err: any) {
      this.cb.onLoadingChange(false);
      this.cb.onError(err?.message || 'Falha ao carregar stems');
      return false;
    }
  }

  public getCurrentOrigTime(): number {
    if (!this.isPlaying || !this.ctx) {
      return this.pausedOrigTime;
    }
    const elapsedBuf = this.ctx.currentTime - this.startCtxTime;
    const bufTime = this.startBufOffset + elapsedBuf;
    return Math.min(this.origDuration || bufTime * this.speed, Math.max(0, bufTime * this.speed));
  }

  private playMetronomeClick(accent: boolean): void {
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(accent ? 1320 : 880, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(accent ? 0.25 : 0.16, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // ignore audio context block
    }
  }

  private cancelPrecount(): void {
    if (this.precountTimer !== null) {
      window.clearInterval(this.precountTimer);
      this.precountTimer = null;
    }
    if (this.inPrecount) {
      this.inPrecount = false;
      this.cb.onPrecountUpdate(0);
    }
  }

  private startWithOptionalPrecount(origStartSec: number): void {
    this.cancelPrecount();
    if (this.precountSec <= 0.05) {
      this.startBufferPlaybackAt(origStartSec);
      return;
    }

    this.inPrecount = true;
    this.pausedOrigTime = origStartSec;
    this.cb.onTimeUpdate(origStartSec);
    this.cb.onPlayStateChange(true);

    const totalMs = this.precountSec * 1000;
    this.precountEndPerf = performance.now() + totalMs;
    let lastWholeSec = Math.ceil(this.precountSec);
    this.playMetronomeClick(true);
    this.cb.onPrecountUpdate(this.precountSec);

    this.precountTimer = window.setInterval(() => {
      if (!this.inPrecount) return;
      const remMs = this.precountEndPerf - performance.now();
      if (remMs <= 20) {
        this.cancelPrecount();
        this.startBufferPlaybackAt(origStartSec);
        return;
      }
      const remSec = remMs / 1000;
      const whole = Math.ceil(remSec);
      if (whole < lastWholeSec) {
        lastWholeSec = whole;
        this.playMetronomeClick(whole === 1);
      }
      this.cb.onPrecountUpdate(Math.round(remSec * 10) / 10);
    }, 50);
  }

  private stopNodesOnly(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.mainSource) {
      try {
        this.mainSource.onended = null;
        this.mainSource.stop();
        this.mainSource.disconnect();
      } catch {
        // ignore
      }
      this.mainSource = null;
    }
    const keys: StemKey[] = ['vocals', 'drums', 'bass', 'other'];
    for (const k of keys) {
      const src = this.stemSources[k];
      if (src) {
        try {
          src.onended = null;
          src.stop();
          src.disconnect();
        } catch {
          // ignore
        }
      }
      this.stemSources[k] = undefined;
      const g = this.stemGains[k];
      if (g) {
        try {
          g.disconnect();
        } catch {
          // ignore
        }
      }
      this.stemGains[k] = undefined;
    }
    this.isPlaying = false;
  }

  private startBufferPlaybackAt(origSec: number): void {
    const ctx = this.ensureContext();
    this.stopNodesOnly();

    const useStems =
      this.stemMixer.enabled &&
      Boolean(this.stemBuffers.vocals && this.stemBuffers.drums && this.stemBuffers.bass && this.stemBuffers.other);

    const refBuf = useStems ? this.stemBuffers.vocals! : this.mainBuffer;
    if (!refBuf || !this.masterGain) {
      this.cb.onPlayStateChange(false);
      return;
    }

    const bufOffset = Math.max(0, Math.min(refBuf.duration - 0.01, origSec / this.speed));
    const startAt = ctx.currentTime + 0.015;

    if (useStems) {
      const keys: StemKey[] = ['vocals', 'drums', 'bass', 'other'];
      for (const k of keys) {
        const b = this.stemBuffers[k];
        if (!b) continue;
        const src = ctx.createBufferSource();
        src.buffer = b;
        const g = ctx.createGain();
        src.connect(g);
        g.connect(this.masterGain);
        this.stemSources[k] = src;
        this.stemGains[k] = g;
      }
      this.applyStemGains();
      for (const k of keys) {
        this.stemSources[k]?.start(startAt, bufOffset);
      }
    } else {
      const src = ctx.createBufferSource();
      src.buffer = refBuf;
      src.connect(this.masterGain);
      src.start(startAt, bufOffset);
      this.mainSource = src;
    }

    this.startCtxTime = startAt;
    this.startBufOffset = bufOffset;
    this.pausedOrigTime = origSec;
    this.isPlaying = true;
    this.cb.onPlayStateChange(true);

    const tick = () => {
      if (!this.isPlaying) return;
      const curOrig = this.getCurrentOrigTime();
      this.cb.onTimeUpdate(curOrig);

      // Precise A/B loop check
      if (this.loopEnabled && curOrig >= this.loopB - 0.015) {
        this.stopNodesOnly();
        this.startWithOptionalPrecount(this.loopA);
        return;
      }

      // End of track check
      const bufCur = this.startBufOffset + (this.ctx!.currentTime - this.startCtxTime);
      if (bufCur >= refBuf.duration - 0.015) {
        this.stopNodesOnly();
        if (this.loopEnabled) {
          this.startWithOptionalPrecount(this.loopA);
        } else {
          this.pausedOrigTime = 0;
          this.cb.onTimeUpdate(0);
          this.cb.onPlayStateChange(false);
        }
        return;
      }

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public play(): void {
    if (this.isPlaying || this.inPrecount) return;
    let startPos = this.pausedOrigTime;
    if (this.loopEnabled && (startPos < this.loopA || startPos >= this.loopB - 0.05)) {
      startPos = this.loopA;
    }
    this.startWithOptionalPrecount(startPos);
  }

  public pause(): void {
    if (this.inPrecount) {
      this.cancelPrecount();
      this.cb.onPlayStateChange(false);
      return;
    }
    if (!this.isPlaying) return;
    this.pausedOrigTime = this.getCurrentOrigTime();
    this.stopNodesOnly();
    this.cb.onTimeUpdate(this.pausedOrigTime);
    this.cb.onPlayStateChange(false);
  }

  public stop(): void {
    this.cancelPrecount();
    this.stopNodesOnly();
    this.pausedOrigTime = this.loopEnabled ? this.loopA : 0;
    this.cb.onTimeUpdate(this.pausedOrigTime);
    this.cb.onPlayStateChange(false);
  }

  public seek(origSec: number): void {
    const clamped = Math.max(0, Math.min(this.origDuration || 99999, origSec));
    const wasPlaying = this.isPlaying;
    this.cancelPrecount();
    this.pausedOrigTime = clamped;
    this.cb.onTimeUpdate(clamped);
    if (wasPlaying) {
      this.startBufferPlaybackAt(clamped);
    }
  }

  public togglePlay(): void {
    if (this.isPlaying || this.inPrecount) {
      this.pause();
    } else {
      this.play();
    }
  }

  public destroy(): void {
    this.cancelPrecount();
    this.stopNodesOnly();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

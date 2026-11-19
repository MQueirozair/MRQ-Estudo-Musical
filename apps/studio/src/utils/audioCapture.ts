/**
 * Stereo Audio Capture Engine for MRQ Estudo Musical.
 * Supports:
 *  1) 'system' — Native System Audio Output Loopback (Windows WASAPI / macOS ScreenCaptureKit via Electron
 *     setDisplayMediaRequestHandler({ audio: 'loopback' }), or browser getDisplayMedia audio share).
 *  2) 'device' — Any selected OS audio input (USB Audio Interface, Stereo Mix, Line-In, or Microphone).
 *
 * Prevents common silent-capture bugs:
 *  - Explicitly calls `await audioContext.resume()` so Chromium never stalls in 'suspended' state.
 *  - Routes ScriptProcessorNode -> GainNode(0) -> destination so frames always pull with ZERO echo/feedback.
 *  - Tracks real stereo L/R RMS & overall peak amplitude and refuses to save silent/muted captures.
 */

export type CaptureSourceMode = 'system' | 'device';

export interface AudioInputDeviceOption {
  deviceId: string;
  label: string;
}

export interface CaptureLevelInfo {
  elapsedSec: number;
  leftPct: number;
  rightPct: number;
  peakDb: number;
  hasSignal: boolean;
}

export interface CaptureStopResult {
  silent: boolean;
  durationSec: number;
  peak: number;
  peakDb: number;
  sampleRate: number;
  file: File | null;
}

export function isDesktopElectron(): boolean {
  return Boolean(typeof window !== 'undefined' && (window as any).mrqDesktop?.isElectron);
}

export async function listAudioInputDevices(): Promise<AudioInputDeviceOption[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    const inputs = all.filter((d) => d.kind === 'audioinput');
    return inputs.map((d, idx) => ({
      deviceId: d.deviceId,
      label: d.label || (d.deviceId === 'default' ? 'Entrada Padrão do Sistema' : `Dispositivo de Áudio ${idx + 1}`),
    }));
  } catch {
    return [];
  }
}

/** Encodes stereo Float32 PCM chunks into a standard 16-bit Stereo PCM WAV Blob. */
export function encodeStereoWavBlob(
  leftChunks: Float32Array[],
  rightChunks: Float32Array[],
  sampleRate: number
): Blob {
  let totalFrames = 0;
  for (const c of leftChunks) totalFrames += c.length;

  const numChannels = 2;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataBytes = totalFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let c = 0; c < leftChunks.length; c++) {
    const l = leftChunks[c];
    const r = rightChunks[c] || l;
    const len = l.length;
    for (let i = 0; i < len; i++) {
      const sl = Math.max(-1, Math.min(1, l[i]));
      const sr = Math.max(-1, Math.min(1, r[i]));
      view.setInt16(offset, sl < 0 ? sl * 0x8000 : sl * 0x7fff, true);
      view.setInt16(offset + 2, sr < 0 ? sr * 0x8000 : sr * 0x7fff, true);
      offset += 4;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export class MRQAudioCaptureSession {
  private rawStream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private silentGainNode: GainNode | null = null;
  private leftChunks: Float32Array[] = [];
  private rightChunks: Float32Array[] = [];
  private sampleRate = 48000;
  private overallPeak = 0;
  private startedAt = 0;
  private active = false;
  private timerId: number | null = null;
  private latestLeftPct = 0;
  private latestRightPct = 0;

  async start(
    mode: CaptureSourceMode,
    deviceId: string | undefined,
    onLevel: (info: CaptureLevelInfo) => void
  ): Promise<void> {
    this.dispose();

    if (!navigator.mediaDevices) {
      throw new Error('API de captura de áudio indisponível neste ambiente.');
    }

    let stream: MediaStream;
    if (mode === 'system') {
      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error(
          'Captura de Som do Sistema (Loopback) não suportada neste navegador. Use o aplicativo Desktop Windows/macOS.'
        );
      }
      // Keep constraints simple so Electron setDisplayMediaRequestHandler({ audio: 'loopback' }) succeeds on all GPUs
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error(
          'Nenhuma faixa de áudio do sistema foi recebida. No navegador, marque "Compartilhar áudio"; no Windows, use o aplicativo MRQ Desktop.'
        );
      }
    } else {
      const audioConstraint: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        ...(deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}),
      };
      stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint });
    }

    // Keep reference to FULL stream (do not stop display video track prematurely on Windows WASAPI loopback!)
    this.rawStream = stream;

    const audioOnlyStream = new MediaStream(stream.getAudioTracks());
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    // Crucial: resume AudioContext so Chromium/Electron never stays suspended and outputs silence
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    this.ctx = ctx;
    this.sampleRate = ctx.sampleRate || 48000;
    this.leftChunks = [];
    this.rightChunks = [];
    this.overallPeak = 0;
    this.latestLeftPct = 0;
    this.latestRightPct = 0;
    this.startedAt = performance.now();
    this.active = true;

    const source = ctx.createMediaStreamSource(audioOnlyStream);
    const processor = ctx.createScriptProcessor(4096, 2, 2);
    // Zero-gain sink keeps Web Audio pulling samples cleanly with ZERO acoustic feedback / loopback echo
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;

    processor.onaudioprocess = (ev) => {
      if (!this.active) return;
      const inBuf = ev.inputBuffer;
      const ch0 = inBuf.getChannelData(0);
      const ch1 = inBuf.numberOfChannels > 1 ? inBuf.getChannelData(1) : ch0;

      const copyL = new Float32Array(ch0.length);
      const copyR = new Float32Array(ch1.length);
      copyL.set(ch0);
      copyR.set(ch1);

      let sumL = 0;
      let sumR = 0;
      let peakBlock = 0;
      for (let i = 0; i < copyL.length; i++) {
        const al = Math.abs(copyL[i]);
        const ar = Math.abs(copyR[i]);
        if (al > peakBlock) peakBlock = al;
        if (ar > peakBlock) peakBlock = ar;
        sumL += copyL[i] * copyL[i];
        sumR += copyR[i] * copyR[i];
      }

      if (peakBlock > this.overallPeak) this.overallPeak = peakBlock;

      const rmsL = Math.sqrt(sumL / copyL.length);
      const rmsR = Math.sqrt(sumR / copyR.length);
      this.latestLeftPct = Math.min(100, Math.round(Math.pow(rmsL, 0.55) * 180));
      this.latestRightPct = Math.min(100, Math.round(Math.pow(rmsR, 0.55) * 180));

      this.leftChunks.push(copyL);
      this.rightChunks.push(copyR);
    };

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(ctx.destination);

    this.sourceNode = source;
    this.processorNode = processor;
    this.silentGainNode = silentGain;

    this.timerId = window.setInterval(() => {
      if (!this.active) return;
      const elapsedSec = (performance.now() - this.startedAt) / 1000;
      const peakDb = this.overallPeak > 1e-6 ? 20 * Math.log10(this.overallPeak) : -96;
      onLevel({
        elapsedSec,
        leftPct: this.latestLeftPct,
        rightPct: this.latestRightPct,
        peakDb,
        hasSignal: this.overallPeak >= 0.0005,
      });
    }, 100);
  }

  stop(sourceLabel = 'sistema'): CaptureStopResult {
    this.active = false;
    const left = this.leftChunks;
    const right = this.rightChunks;
    const sr = this.sampleRate;
    const peak = this.overallPeak;
    const peakDb = peak > 1e-6 ? 20 * Math.log10(peak) : -96;

    let totalFrames = 0;
    for (const c of left) totalFrames += c.length;
    const durationSec = sr > 0 ? totalFrames / sr : 0;

    this.dispose();

    // Refuse to emit a silent/empty WAV!
    if (totalFrames < sr * 0.25 || peak < 0.0005) {
      return {
        silent: true,
        durationSec,
        peak,
        peakDb,
        sampleRate: sr,
        file: null,
      };
    }

    const blob = encodeStereoWavBlob(left, right, sr);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeLabel = sourceLabel === 'system' ? 'som_sistema' : 'entrada_audio';
    const file = new File([blob], `captura_${safeLabel}_${stamp}.wav`, { type: 'audio/wav' });

    return {
      silent: false,
      durationSec,
      peak,
      peakDb,
      sampleRate: sr,
      file,
    };
  }

  dispose(): void {
    this.active = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    try {
      this.processorNode?.disconnect();
    } catch {
      // ignore
    }
    try {
      this.silentGainNode?.disconnect();
    } catch {
      // ignore
    }
    try {
      this.sourceNode?.disconnect();
    } catch {
      // ignore
    }
    this.processorNode = null;
    this.silentGainNode = null;
    this.sourceNode = null;

    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    if (this.rawStream) {
      this.rawStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      this.rawStream = null;
    }
  }
}

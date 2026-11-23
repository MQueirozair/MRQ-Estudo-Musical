/**
 * Motor de áudio — sintetiza piano de forma aditiva (sem arquivos externos),
 * metrônomo, notas presas/sustentadas e verificação de Web MIDI.
 */
import { midiToFreq } from './theory';

export type Timbre = 'piano' | 'electrico' | 'orgao' | 'cordas';

interface Voice {
  stop: (when?: number) => void;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private waveshaper: WaveShaperNode | null = null;
  private convolver: ConvolverNode | null = null;
  private wet: GainNode | null = null;
  private active: Voice[] = [];
  private sustainOn = false;
  private sustained: Voice[] = [];
  private volume = 0.6;
  private timbre: Timbre = 'piano';
  private metronomeTimer: number | null = null;
  private harmonicCache = new Map<number, Float32Array>();

  ensure(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;

      // Compressor suave para acordes grandes não estourarem
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 3;
      comp.attack.value = 0.004;
      comp.release.value = 0.24;

      // Leve saturação para dar corpo
      this.waveshaper = this.ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4);
      }
      this.waveshaper.curve = curve;
      this.waveshaper.oversample = '2x';

      // Reverb curto gerado por ruído decrescente (impulso sintético)
      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = this.makeImpulse(1.6, 2.4);
      this.wet = this.ctx.createGain();
      this.wet.gain.value = 0.22;

      this.master.connect(comp);
      comp.connect(this.waveshaper);
      this.waveshaper.connect(this.ctx.destination);

      const send = this.ctx.createGain();
      send.gain.value = 1;
      comp.connect(send);
      send.connect(this.convolver);
      this.convolver.connect(this.wet);
      this.wet.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private makeImpulse(seconds: number, decay: number) {
    const ctx = this.ensure();
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  getVolume() {
    return this.volume;
  }

  setTimbre(t: Timbre) {
    this.timbre = t;
  }

  getTimbre() {
    return this.timbre;
  }

  /** Perfil harmônico por timbre */
  private harmonics(midi: number): Float32Array {
    const key = midi * 10 + ['piano', 'electrico', 'orgao', 'cordas'].indexOf(this.timbre);
    const cached = this.harmonicCache.get(key);
    if (cached) return cached;

    const n = 24;
    const out = new Float32Array(n);
    const bright = Math.min(1, Math.max(0, (midi - 24) / 72)); // graves mais escuros
    for (let h = 1; h <= n; h++) {
      let amp = 1 / Math.pow(h, 1.35);
      switch (this.timbre) {
        case 'piano':
          amp *= h === 1 ? 1 : 0.9 - bright * 0.25;
          if (h === 2) amp *= 1.1;
          if (h === 3) amp *= 0.85;
          break;
        case 'electrico':
          amp = h % 2 === 1 ? 1 / Math.pow(h, 1.1) : 1 / Math.pow(h, 2.4);
          break;
        case 'orgao':
          amp = h % 2 === 1 ? 1 / h : 1 / (h * 2.2);
          amp *= h <= 8 ? 1 : 0.4;
          break;
        case 'cordas':
          amp *= 1 / Math.pow(h, 1.9);
          break;
      }
      out[h - 1] = amp;
    }
    this.harmonicCache.set(key, out);
    return out;
  }

  private envelope(midi: number) {
    // notas graves soam mais tempo
    const base = 1.6 + (96 - midi) * 0.055;
    switch (this.timbre) {
      case 'piano':
        return { attack: 0.004, decay: 0.32, sustain: 0.28, hold: base, release: 0.28 };
      case 'electrico':
        return { attack: 0.008, decay: 0.5, sustain: 0.42, hold: base * 1.1, release: 0.5 };
      case 'orgao':
        return { attack: 0.02, decay: 0.05, sustain: 0.9, hold: base * 1.2, release: 0.12 };
      case 'cordas':
        return { attack: 0.14, decay: 0.3, sustain: 0.6, hold: base * 1.4, release: 0.6 };
    }
  }

  noteOn(midi: number, velocity = 0.8, when?: number): Voice {
    const ctx = this.ensure();
    const t = when ?? ctx.currentTime;
    const freq = midiToFreq(midi);
    const env = this.envelope(midi);
    const harm = this.harmonics(midi);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    const peak = (velocity * 0.24) / Math.sqrt(Math.max(1, this.active.length + 1));
    amp.gain.linearRampToValueAtTime(peak, t + env.attack);
    amp.gain.linearRampToValueAtTime(peak * env.sustain, t + env.attack + env.decay);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoff = Math.min(12000, freq * (this.timbre === 'cordas' ? 4 : 8) + 900);
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(400, cutoff * 0.45), t + env.hold);
    filter.Q.value = 0.6;

    const nodes: OscillatorNode[] = [];
    const parts = this.timbre === 'cordas' ? 8 : 14;
    for (let h = 1; h <= parts; h++) {
      const a = harm[h - 1];
      if (a < 0.006) continue;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      // leve desafinação nos harmônicos altos = sensação acústica
      const detune = (h > 4 ? (Math.random() - 0.5) * 6 : 0) + (this.timbre === 'cordas' ? (Math.random() - 0.5) * 10 : 0);
      osc.frequency.value = freq * h;
      osc.detune.value = detune;

      const g = ctx.createGain();
      const harmAmp = a * (h > 1 ? 1 / Math.pow(1 + (midi - 30) / 60, 0.3) : 1);
      g.gain.setValueAtTime(harmAmp, t);
      if (this.timbre === 'piano' || this.timbre === 'electrico') {
        // harmônicos agudos decaem mais rápido que os graves (caráter de piano)
        g.gain.exponentialRampToValueAtTime(
          Math.max(0.0005, harmAmp * Math.pow(0.45, h / 4)),
          t + env.hold * 0.9,
        );
      }
      osc.connect(g);
      g.connect(filter);
      osc.start(t);
      nodes.push(osc);
    }

    filter.connect(amp);
    amp.connect(this.master!);

    let stopped = false;
    const voice: Voice = {
      stop: (whenStop?: number) => {
        if (stopped) return;
        stopped = true;
        const now = Math.max(whenStop ?? ctx.currentTime, t + 0.03);
        const g = Math.max(0.0001, peak * env.sustain);
        amp.gain.cancelScheduledValues(now);
        amp.gain.setValueAtTime(Math.max(g, 0.0001), now);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + env.release);
        for (const o of nodes) {
          try {
            o.stop(now + env.release + 0.05);
          } catch {
            /* já parado */
          }
        }
        setTimeout(() => {
          amp.disconnect();
          filter.disconnect();
        }, (env.release + 0.2) * 1000);
        this.active = this.active.filter((v) => v !== voice);
      },
    };

    this.active.push(voice);
    if (this.sustainOn) {
      // com pedal ligado a nota fica presa até soltar o pedal
      this.sustained.push(voice);
    }
    // libera sozinho após a duração natural (dobrada quando o pedal está ligado)
    const natural = (env.attack + env.decay + env.hold) * 1000;
    setTimeout(
      () => voice.stop(),
      Math.min(60000, natural * (this.sustainOn ? 2 : 1)),
    );
    return voice;
  }

  playNotes(midis: number[], duration = 1.4, velocity = 0.82, spread = 0.012) {
    const ctx = this.ensure();
    const t0 = ctx.currentTime + 0.02;
    midis.forEach((m, i) => {
      const v = this.noteOn(m, velocity, t0 + i * spread);
      setTimeout(() => v.stop(), duration * 1000 + i * spread * 1000);
    });
  }

  /** Toca uma sequência de acordes. Retorna função de cancelamento. */
  playChordProgression(
    chords: number[][],
    bpm: number,
    onChord?: (index: number) => void,
    beatsPerChord = 4,
  ) {
    const ctx = this.ensure();
    const secondsPerBeat = 60 / bpm;
    const dur = secondsPerBeat * beatsPerChord;
    const timers: number[] = [];
    let cancelled = false;
    const localVoices: Voice[] = [];

    chords.forEach((notes, i) => {
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          onChord?.(i);
          const t0 = ctx.currentTime;
          const group: Voice[] = [];
          notes.forEach((m, k) => group.push(this.noteOn(m, 0.82, t0 + k * 0.012)));
          localVoices.push(...group);
          timers.push(
            window.setTimeout(() => {
              group.forEach((v) => v.stop());
              group.forEach((v) => {
                const idx = localVoices.indexOf(v);
                if (idx >= 0) localVoices.splice(idx, 1);
              });
            }, dur * 1000 * 0.97),
          );
        }, i * dur * 1000),
      );
    });

    const totalMs = chords.length * dur * 1000;
    return {
      totalMs,
      stop: () => {
        cancelled = true;
        timers.forEach((t) => clearTimeout(t));
        localVoices.forEach((v) => v.stop());
        localVoices.length = 0;
      },
    };
  }

  stopAll() {
    const all = [...this.active];
    this.active = [];
    this.sustained = [];
    all.forEach((v) => v.stop());
  }

  setSustain(on: boolean) {
    this.sustainOn = on;
    if (!on) {
      this.sustained.forEach((v) => v.stop());
      this.sustained = [];
    }
  }

  isSustainOn() {
    return this.sustainOn;
  }

  /** Metrônomo: chama o callback a cada tempo */
  startMetronome(bpm: number, beatsPerBar: number, onBeat?: (beat: number) => void) {
    this.stopMetronome();
    const ctx = this.ensure();
    const ms = (60 / bpm) * 1000;
    let beat = 0;
    const tick = () => {
      const accent = beat === 0;
      this.click(accent);
      onBeat?.(beat);
      beat = (beat + 1) % beatsPerBar;
    };
    tick();
    this.metronomeTimer = window.setInterval(tick, ms);
    void ctx;
  }

  private click(accent: boolean) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1100;
    osc.type = 'square';
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(accent ? 0.12 : 0.07, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  stopMetronome() {
    if (this.metronomeTimer !== null) {
      clearInterval(this.metronomeTimer);
      this.metronomeTimer = null;
    }
  }

  /** Som curto de acerto/erro para quizzes */
  feedback(ok: boolean) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const notes = ok ? [72, 76, 79] : [64, 63];
    notes.forEach((m, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = midiToFreq(m);
      const st = t + i * 0.06;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.14, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.25);
      osc.connect(g);
      g.connect(this.master!);
      osc.start(st);
      osc.stop(st + 0.3);
    });
  }
}

export const audio = new AudioEngine();

/* ---------------- Web MIDI ---------------- */

export interface MidiNoteEvent {
  midi: number;
  velocity: number;
  on: boolean;
}

export async function requestMidiAccess(): Promise<{ ok: boolean; inputs: string[]; error?: string }> {
  const nav = navigator as any;
  if (!nav.requestMIDIAccess) {
    return { ok: false, inputs: [], error: 'Seu sistema não oferece suporte a Web MIDI neste app.' };
  }
  try {
    const access = await nav.requestMIDIAccess({ sysex: false });
    const names: string[] = [];
    access.inputs.forEach((input: any) => names.push(input.name ?? 'Teclado MIDI'));
    return { ok: true, inputs: names };
  } catch (err) {
    return { ok: false, inputs: [], error: 'Acesso ao MIDI negado ou indisponível.' };
  }
}

export function listenMidi(onEvent: (e: MidiNoteEvent) => void): () => void {
  const nav = navigator as any;
  let access: any = null;
  let disposed = false;

  const attach = () => {
    if (!access) return;
    access.inputs.forEach((input: any) => {
      input.onmidimessage = (msg: any) => {
        const [status, note, velocity] = msg.data;
        const cmd = status & 0xf0;
        if (cmd === 0x90 && velocity > 0) onEvent({ midi: note, velocity: velocity / 127, on: true });
        else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) onEvent({ midi: note, velocity: 0, on: false });
      };
    });
  };

  if (nav.requestMIDIAccess) {
    nav.requestMIDIAccess({ sysex: false }).then((acc: any) => {
      if (disposed) return;
      access = acc;
      attach();
      access.onstatechange = attach;
    }).catch(() => {
      /* sem MIDI */
    });
  }
  return () => {
    disposed = true;
    if (access) {
      access.inputs.forEach((input: any) => (input.onmidimessage = null));
      access.onstatechange = null;
    }
  };
}

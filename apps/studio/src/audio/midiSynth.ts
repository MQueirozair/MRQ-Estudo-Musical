import type { TranscribedNote } from '../types/music';

/**
 * Polyphonic Web Audio API synthesizer for auditioning Piano Roll notes,
 * chord voicings, and playing back full MIDI transcriptions with zero external samples.
 */
class MidiSynth {
  private ctx: AudioContext | null = null;
  private scheduledTimers: number[] = [];
  private activeNodes: AudioNode[] = [];
  private isPlayingSeq = false;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  public playNote(midi: number, durationSec = 0.45, velocity = 95, whenOffsetSec = 0): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime + Math.max(0, whenOffsetSec);
    const freq = this.midiToFreq(midi);
    const gainPeak = Math.min(0.28, (velocity / 127) * 0.22);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    // Warm electric piano blend (triangle fundamental + soft sine 2nd harmonic)
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(0.24, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(5500, freq * 6), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 2), now + durationSec);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(gainPeak * 0.55, now + Math.min(0.18, durationSec * 0.5));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.06);

    osc1.connect(filter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationSec + 0.08);
    osc2.stop(now + durationSec + 0.08);

    this.activeNodes.push(osc1, osc2, gain);
    osc1.onended = () => {
      try {
        gain.disconnect();
      } catch {
        // ignore
      }
    };
  }

  public playChord(midiPitches: number[], durationSec = 1.1): void {
    midiPitches.forEach((p, idx) => {
      // Gentle arpeggio strum (22ms spread)
      this.playNote(p, durationSec, 88, idx * 0.022);
    });
  }

  public playSequence(
    notes: TranscribedNote[],
    startFromSec = 0,
    speed = 1.0,
    onProgress?: (origTimeSec: number) => void,
    onEnd?: () => void
  ): void {
    this.stopSequence();
    const filtered = notes
      .filter((n) => n.start_sec + n.duration_sec >= startFromSec)
      .sort((a, b) => a.start_sec - b.start_sec);

    if (filtered.length === 0) {
      onEnd?.();
      return;
    }

    this.isPlayingSeq = true;
    const t0 = performance.now();
    const maxEndOrig = Math.max(...filtered.map((n) => n.start_sec + n.duration_sec));

    filtered.forEach((note) => {
      const relStart = Math.max(0, (note.start_sec - startFromSec) / speed);
      const dur = Math.max(0.06, note.duration_sec / speed);
      const timer = window.setTimeout(() => {
        if (!this.isPlayingSeq) return;
        this.playNote(note.pitch, dur, note.velocity);
      }, relStart * 1000);
      this.scheduledTimers.push(timer);
    });

    const tick = () => {
      if (!this.isPlayingSeq) return;
      const elapsedSec = (performance.now() - t0) / 1000;
      const origTime = startFromSec + elapsedSec * speed;
      onProgress?.(origTime);
      if (origTime >= maxEndOrig + 0.15) {
        this.stopSequence();
        onEnd?.();
        return;
      }
      const id = window.setTimeout(tick, 33);
      this.scheduledTimers.push(id);
    };
    tick();
  }

  public stopSequence(): void {
    this.isPlayingSeq = false;
    this.scheduledTimers.forEach((t) => window.clearTimeout(t));
    this.scheduledTimers = [];
  }

  public get playing(): boolean {
    return this.isPlayingSeq;
  }
}

export const midiSynth = new MidiSynth();

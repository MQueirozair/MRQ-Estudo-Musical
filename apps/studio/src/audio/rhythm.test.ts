import { describe, expect, it } from 'vitest';
import { beatIndexAt, rhythmAtTime } from './rhythm';

describe('practice rhythm', () => {
  it('calculates notated beats in real seconds at playback speed', () => {
    expect(rhythmAtTime(120, '4/4', [], 0, 0.5)).toEqual({ bpm: 120, beatsPerBar: 4, beatSec: 1 });
    expect(rhythmAtTime(120, '6/8', [], 0, 1)).toEqual({ bpm: 120, beatsPerBar: 6, beatSec: 0.25 });
  });
  it('selects the latest valid tempo change and safe defaults', () => {
    const changes = [{ time_sec: 4, bpm: 160 }, { time_sec: 2, bpm: 90 }, { time_sec: 3, bpm: NaN }];
    expect(rhythmAtTime(120, '3/4', changes, 3, 1).bpm).toBe(90);
    expect(rhythmAtTime(null, 'oops', [], 0, 0)).toEqual({ bpm: 120, beatsPerBar: 4, beatSec: 0.5 });
  });
  it('finds beats in a variable beat grid without triggering before first beat', () => {
    expect(beatIndexAt(0.2, [0.5, 1.1, 1.8], 0.5)).toBe(-1);
    expect(beatIndexAt(1.2, [0.5, 1.1, 1.8], 0.5)).toBe(1);
    expect(beatIndexAt(1.2, [], 0.5)).toBe(2);
  });
});

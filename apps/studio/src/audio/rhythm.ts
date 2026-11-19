export interface TempoChange { time_sec: number; bpm: number }

/** Quarter-note BPM and notated beat length; the effective interval is in real seconds. */
export function rhythmAtTime(bpm: number | null | undefined, timeSignature: string | undefined, changes: TempoChange[], time: number, speed: number) {
  const valid = changes.filter(c => Number.isFinite(c.time_sec) && c.time_sec <= time && Number.isFinite(c.bpm) && c.bpm >= 20 && c.bpm <= 400).sort((a, b) => a.time_sec - b.time_sec);
  const fallback = bpm && Number.isFinite(bpm) && bpm >= 20 && bpm <= 400 ? bpm : 120;
  const currentBpm = valid.length ? valid[valid.length - 1].bpm : fallback;
  const match = /^(\d{1,2})\/(1|2|4|8|16)$/.exec(timeSignature || '');
  const beatsPerBar = match && Number(match[1]) >= 1 && Number(match[1]) <= 32 ? Number(match[1]) : 4;
  const denominator = match ? Number(match[2]) : 4;
  const playbackSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
  return { bpm: currentBpm, beatsPerBar, beatSec: 60 / currentBpm * 4 / denominator / playbackSpeed };
}

export function beatIndexAt(time: number, beats: number[], beatDuration: number): number {
  if (!Number.isFinite(time) || time < 0) return -1;
  if (beats.length) {
    let low = 0, high = beats.length;
    while (low < high) { const mid = (low + high) >>> 1; if (beats[mid] <= time) low = mid + 1; else high = mid; }
    return low - 1;
  }
  return beatDuration > 0 ? Math.floor(time / beatDuration) : -1;
}

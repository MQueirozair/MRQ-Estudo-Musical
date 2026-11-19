/**
 * Real Guitar & Piano Chord Diagram Generator for MRQ Estudo Musical.
 * Supports all 12 roots × 18 chord qualities:
 *   Major, m, dim, aug, sus2, sus4, 7, maj7, m7, m7(b5), 9, maj9, m9, add9, 6, m6, 7sus4, 5.
 * Computes ergonomic open & barre guitar fingerings and exact keyboard voicings.
 */

export interface GuitarDiagram {
  symbol: string;
  baseFret: number;
  /** 6 strings from low E (6th) to high E (1st): -1 = muted (X), 0 = open (O), >0 = absolute fret */
  frets: [number, number, number, number, number, number];
  barre?: { fret: number; fromString: number; toString: number };
}

export interface PianoDiagram {
  symbol: string;
  rootMidi: number;
  midiNotes: number[];
  noteNames: string[];
}

const NOTE_TO_PC: Record<string, number> = {
  C: 0, 'B#': 0,
  'C#': 1, Db: 1,
  D: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, 'E#': 5,
  'F#': 6, Gb: 6,
  G: 7,
  'G#': 8, Ab: 8,
  A: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11,
};

const PC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const QUALITY_INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  'm7(b5)': [0, 3, 6, 10],
  m7b5: [0, 3, 6, 10],
  '9': [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  add9: [0, 4, 7, 14],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7sus4': [0, 5, 7, 10],
  '5': [0, 7],
};

/** Hand-crafted open chord shapes for the most common guitar voicings */
const OPEN_GUITAR_VOICINGS: Record<string, [number, number, number, number, number, number]> = {
  C: [-1, 3, 2, 0, 1, 0],
  Cmaj7: [-1, 3, 2, 0, 0, 0],
  C7: [-1, 3, 2, 3, 1, 0],
  Cadd9: [-1, 3, 2, 0, 3, 0],
  D: [-1, -1, 0, 2, 3, 2],
  Dm: [-1, -1, 0, 2, 3, 1],
  D7: [-1, -1, 0, 2, 1, 2],
  Dm7: [-1, -1, 0, 2, 1, 1],
  Dmaj7: [-1, -1, 0, 2, 2, 2],
  Dsus2: [-1, -1, 0, 2, 3, 0],
  Dsus4: [-1, -1, 0, 2, 3, 3],
  E: [0, 2, 2, 1, 0, 0],
  Em: [0, 2, 2, 0, 0, 0],
  E7: [0, 2, 0, 1, 0, 0],
  Em7: [0, 2, 2, 0, 3, 0],
  Emaj7: [0, 2, 1, 1, 0, 0],
  Esus4: [0, 2, 2, 2, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  Fmaj7: [-1, -1, 3, 2, 1, 0],
  G: [3, 2, 0, 0, 0, 3],
  G7: [3, 2, 0, 0, 0, 1],
  G6: [3, 2, 0, 0, 0, 0],
  A: [-1, 0, 2, 2, 2, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  A7: [-1, 0, 2, 0, 2, 0],
  Am7: [-1, 0, 2, 0, 1, 0],
  Amaj7: [-1, 0, 2, 1, 2, 0],
  Asus2: [-1, 0, 2, 2, 0, 0],
  Asus4: [-1, 0, 2, 2, 3, 0],
  B7: [-1, 2, 1, 2, 0, 2],
  Bm: [-1, 2, 4, 4, 3, 2],
  Bm7: [-1, 2, 4, 2, 3, 2],
  'Bm7(b5)': [-1, 2, 3, 2, 3, -1],
};

/** Movable E-shape (root on 6th string) and A-shape (root on 5th string) offsets */
const E_SHAPES: Record<string, [number, number, number, number, number, number]> = {
  '': [0, 2, 2, 1, 0, 0],
  m: [0, 2, 2, 0, 0, 0],
  '7': [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, -1, 1, 1, 0, -1],
  sus4: [0, 2, 2, 2, 0, 0],
  '7sus4': [0, 2, 0, 2, 0, 0],
  dim: [0, -1, 2, 0, -1, -1],
  aug: [0, 3, 2, 1, 1, -1],
  'm7(b5)': [0, -1, 0, 0, -1, -1],
  '6': [0, -1, 2, 1, 2, -1],
  m6: [0, -1, 2, 0, 2, -1],
  '5': [0, 2, 2, -1, -1, -1],
};

const A_SHAPES: Record<string, [number, number, number, number, number, number]> = {
  '': [-1, 0, 2, 2, 2, 0],
  m: [-1, 0, 2, 2, 1, 0],
  '7': [-1, 0, 2, 0, 2, 0],
  m7: [-1, 0, 2, 0, 1, 0],
  maj7: [-1, 0, 2, 1, 2, 0],
  sus2: [-1, 0, 2, 2, 0, 0],
  sus4: [-1, 0, 2, 2, 3, 0],
  '7sus4': [-1, 0, 2, 0, 3, 0],
  '9': [-1, 0, -1, 0, 0, 0],
  m9: [-1, 0, -1, 0, 0, -1],
  maj9: [-1, 0, -1, 1, 0, 0],
  add9: [-1, 0, 2, 4, 2, 0],
  dim: [-1, 0, 1, 2, 1, -1],
  aug: [-1, 0, 3, 2, 2, -1],
  'm7(b5)': [-1, 0, 1, 0, 1, -1],
  '6': [-1, 0, 2, 2, 2, 2],
  m6: [-1, 0, 2, 2, 1, 2],
  '5': [-1, 0, 2, 2, -1, -1],
};

export function parseChordSymbol(symbol: string): { root: string; rootPc: number; quality: string } | null {
  const clean = symbol.trim();
  if (!clean || clean === 'N.C.') return null;
  const match = clean.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return null;
  const root = match[1];
  const rootPc = NOTE_TO_PC[root];
  if (rootPc === undefined) return null;
  const quality = (match[2] || '').replace(/\/[A-G][#b]?$/, ''); // strip slash bass for shape lookup
  return { root, rootPc, quality };
}

export function getPianoDiagram(symbol: string): PianoDiagram {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) {
    return { symbol, rootMidi: 60, midiNotes: [], noteNames: [] };
  }
  const intervals = QUALITY_INTERVALS[parsed.quality] || QUALITY_INTERVALS[''];
  const rootMidi = 60 + parsed.rootPc; // C4..B4
  const midiNotes = intervals.map((iv) => rootMidi + iv);
  const noteNames = intervals.map((iv) => PC_NAMES[(parsed.rootPc + iv) % 12]);
  return { symbol, rootMidi, midiNotes, noteNames };
}

export function getGuitarDiagram(symbol: string): GuitarDiagram {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) {
    return { symbol, baseFret: 1, frets: [-1, -1, -1, -1, -1, -1] };
  }

  // Exact open voicing lookup first
  const exact = OPEN_GUITAR_VOICINGS[symbol];
  if (exact) {
    const positive = exact.filter((f) => f > 0);
    const minF = positive.length ? Math.min(...positive) : 1;
    const maxF = positive.length ? Math.max(...positive) : 1;
    const baseFret = maxF > 4 ? minF : 1;
    const hasBarre = exact.filter((f) => f === minF).length >= 3 && minF > 0 && !exact.includes(0);
    return {
      symbol,
      baseFret,
      frets: exact,
      barre: hasBarre ? { fret: minF, fromString: exact.indexOf(minF), toString: 5 } : undefined,
    };
  }

  // Movable E-shape (root on 6th string E=4) vs A-shape (root on 5th string A=9)
  const eShift = (parsed.rootPc - 4 + 12) % 12;
  const aShift = (parsed.rootPc - 9 + 12) % 12;

  const useA = (A_SHAPES[parsed.quality] && (aShift <= eShift || !E_SHAPES[parsed.quality])) || !E_SHAPES[parsed.quality];
  const baseShape = useA ? (A_SHAPES[parsed.quality] || A_SHAPES['']) : (E_SHAPES[parsed.quality] || E_SHAPES['']);
  const shift = useA ? aShift : eShift;

  const frets = baseShape.map((f) => (f < 0 ? -1 : f + shift)) as [number, number, number, number, number, number];
  const positive = frets.filter((f) => f > 0);
  const minF = positive.length ? Math.min(...positive) : 1;
  const maxF = positive.length ? Math.max(...positive) : 1;
  const baseFret = maxF > 4 ? minF : 1;

  const barre =
    shift > 0 && frets.filter((f) => f === shift).length >= 2
      ? { fret: shift, fromString: useA ? 1 : 0, toString: 5 }
      : undefined;

  return { symbol, baseFret, frets, barre };
}

export function formatTime(sec: number, showMs = true): string {
  const s = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const mins = Math.floor(s / 60);
  const rem = s - mins * 60;
  if (showMs) {
    return `${String(mins).padStart(2, '0')}:${rem.toFixed(2).padStart(5, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(Math.floor(rem)).padStart(2, '0')}`;
}

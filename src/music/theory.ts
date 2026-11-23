/**
 * Teoria musical — tudo local, sem dependências externas.
 * Notas em português, acordes por categoria, escalas, progressões e intervalos.
 */

export const PT_SHARP = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];
export const PT_FLAT = ['Dó', 'Ré♭', 'Ré', 'Mi♭', 'Mi', 'Fá', 'Sol♭', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si'];
export const EN_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const EN_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SHARP_LETTER = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const FLAT_LETTER = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
const IS_SHARP = [false, true, false, true, false, false, true, false, true, false, true, false];
const IS_FLAT = [false, true, false, true, false, false, true, false, true, false, true, false];

export type AccidentalPref = 'sustenidos' | 'bemois';

export function noteName(pc: number, pref: AccidentalPref = 'sustenidos', pt = true): string {
  const p = ((pc % 12) + 12) % 12;
  return (pref === 'bemois' ? (pt ? PT_FLAT : EN_FLAT) : pt ? PT_SHARP : EN_SHARP)[p];
}

export function noteLetter(pc: number, pref: AccidentalPref = 'sustenidos'): number {
  const p = ((pc % 12) + 12) % 12;
  return pref === 'bemois' ? FLAT_LETTER[p] : SHARP_LETTER[p];
}

export function noteAccidental(pc: number, pref: AccidentalPref = 'sustenidos'): 0 | 1 | -1 {
  const p = ((pc % 12) + 12) % 12;
  if (pref === 'bemois') return IS_FLAT[p] ? -1 : 0;
  return IS_SHARP[p] ? 1 : 0;
}

export const midiToPc = (m: number) => ((m % 12) + 12) % 12;
export const midiToOctave = (m: number) => Math.floor(m / 12) - 1;
export const pcOctaveToMidi = (pc: number, octave: number) => (octave + 1) * 12 + (((pc % 12) + 12) % 12);
export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export function midiLabel(m: number, pref: AccidentalPref = 'sustenidos') {
  return `${noteName(midiToPc(m), pref)}${midiToOctave(m)}`;
}

/* ------------------------------------------------------------------ */
/* Acordes                                                             */
/* ------------------------------------------------------------------ */

export type Categoria =
  | 'Básicos'
  | 'Add (com)'
  | 'Sétimas'
  | 'Suspensões'
  | 'Dim Extensões'
  | 'Sextas'
  | 'Extensões 9ª'
  | 'Extensões 11ª'
  | 'Extensões 13ª'
  | 'Alterados (Jazz)'
  | 'Power'
  | 'Sofisticados'
  | 'Quartal/Quintal'
  | 'Clusters'
  | 'Poliacordes';

export const CATEGORIAS: Categoria[] = [
  'Básicos',
  'Add (com)',
  'Sétimas',
  'Suspensões',
  'Dim Extensões',
  'Sextas',
  'Extensões 9ª',
  'Extensões 11ª',
  'Extensões 13ª',
  'Alterados (Jazz)',
  'Power',
  'Sofisticados',
  'Quartal/Quintal',
  'Clusters',
  'Poliacordes',
];

export type Qualidade = 'Maior' | 'Menor' | 'Diminuto' | 'Aumentado' | 'Outro';
export const QUALIDADES: Qualidade[] = ['Maior', 'Menor', 'Diminuto', 'Aumentado', 'Outro'];

export interface ChordType {
  id: string;
  suffix: string;
  nome: string;
  categoria: Categoria;
  qualidade: Qualidade;
  intervalos: number[];
}

const T = (
  id: string,
  suffix: string,
  nome: string,
  categoria: Categoria,
  qualidade: Qualidade,
  intervalos: number[],
): ChordType => ({ id, suffix, nome, categoria, qualidade, intervalos });

export const CHORD_TYPES: ChordType[] = [
  // Básicos
  T('maj', '', 'Maior', 'Básicos', 'Maior', [0, 4, 7]),
  T('min', 'm', 'Menor', 'Básicos', 'Menor', [0, 3, 7]),
  T('dim', 'dim', 'Diminuto', 'Básicos', 'Diminuto', [0, 3, 6]),
  T('aug', 'aug', 'Aumentado', 'Básicos', 'Aumentado', [0, 4, 8]),

  // Add
  T('add9', 'add9', 'Maior com nona adicionada', 'Add (com)', 'Maior', [0, 4, 7, 14]),
  T('add2', 'add2', 'Maior com segunda adicionada', 'Add (com)', 'Maior', [0, 2, 4, 7]),
  T('add4', 'add4', 'Maior com quarta adicionada', 'Add (com)', 'Maior', [0, 4, 5, 7]),
  T('add11', 'add11', 'Maior com décima primeira', 'Add (com)', 'Maior', [0, 4, 7, 17]),
  T('madd9', 'madd9', 'Menor com nona adicionada', 'Add (com)', 'Menor', [0, 3, 7, 14]),
  T('add#11', 'add#11', 'Maior com #11', 'Add (com)', 'Maior', [0, 4, 7, 18]),

  // Sétimas
  T('7', '7', 'Sétima dominante', 'Sétimas', 'Maior', [0, 4, 7, 10]),
  T('maj7', 'maj7', 'Sétima maior', 'Sétimas', 'Maior', [0, 4, 7, 11]),
  T('m7', 'm7', 'Menor com sétima', 'Sétimas', 'Menor', [0, 3, 7, 10]),
  T('mMaj7', 'm(maj7)', 'Menor com sétima maior', 'Sétimas', 'Menor', [0, 3, 7, 11]),
  T('m7b5', 'm7(b5)', 'Meio diminuto', 'Sétimas', 'Diminuto', [0, 3, 6, 10]),
  T('dim7', 'dim7', 'Diminuto com sétima', 'Sétimas', 'Diminuto', [0, 3, 6, 9]),
  T('aug7', '7(#5)', 'Sétima com quinta aumentada', 'Sétimas', 'Aumentado', [0, 4, 8, 10]),
  T('7sus4', '7sus4', 'Sétima com quarta suspensa', 'Sétimas', 'Outro', [0, 5, 7, 10]),

  // Suspensões
  T('sus2', 'sus2', 'Segunda suspensa', 'Suspensões', 'Outro', [0, 2, 7]),
  T('sus4', 'sus4', 'Quarta suspensa', 'Suspensões', 'Outro', [0, 5, 7]),
  T('sus2sus4', 'sus2sus4', 'Suspensões combinadas', 'Suspensões', 'Outro', [0, 2, 5, 7]),
  T('9sus4', '9sus4', 'Nona com quarta suspensa', 'Suspensões', 'Outro', [0, 5, 7, 10, 14]),
  T('7sus4b9', '7sus4(b9)', 'Sétima suspensa com nona menor', 'Suspensões', 'Outro', [0, 5, 7, 10, 13]),

  // Dim extensões
  T('dimMaj7', 'dim(maj7)', 'Diminuto com sétima maior', 'Dim Extensões', 'Diminuto', [0, 3, 6, 11]),
  T('dim9', 'dim9', 'Diminuto com nona', 'Dim Extensões', 'Diminuto', [0, 3, 6, 9, 14]),
  T('m7b5add11', 'm7(b5)add11', 'Meio diminuto com décima primeira', 'Dim Extensões', 'Diminuto', [0, 3, 6, 10, 17]),

  // Sextas
  T('6', '6', 'Sexta', 'Sextas', 'Maior', [0, 4, 7, 9]),
  T('m6', 'm6', 'Menor com sexta', 'Sextas', 'Menor', [0, 3, 7, 9]),
  T('69', '6/9', 'Sexta com nona', 'Sextas', 'Maior', [0, 4, 7, 9, 14]),
  T('m69', 'm6/9', 'Menor com sexta e nona', 'Sextas', 'Menor', [0, 3, 7, 9, 14]),

  // Extensões 9ª
  T('9', '9', 'Nona dominante', 'Extensões 9ª', 'Maior', [0, 4, 7, 10, 14]),
  T('maj9', 'maj9', 'Nona maior', 'Extensões 9ª', 'Maior', [0, 4, 7, 11, 14]),
  T('m9', 'm9', 'Nona menor', 'Extensões 9ª', 'Menor', [0, 3, 7, 10, 14]),
  T('7b9', '7(b9)', 'Sétima com nona menor', 'Extensões 9ª', 'Outro', [0, 4, 7, 10, 13]),
  T('7#9', '7(#9)', 'Sétima com nona aumentada', 'Extensões 9ª', 'Outro', [0, 4, 7, 10, 15]),
  T('mMaj9', 'm(maj9)', 'Menor com sétima maior e nona', 'Extensões 9ª', 'Menor', [0, 3, 7, 11, 14]),
  T('add9#11', 'add9(#11)', 'Nona com #11', 'Extensões 9ª', 'Maior', [0, 4, 7, 14, 18]),

  // Extensões 11ª
  T('11', '11', 'Décima primeira', 'Extensões 11ª', 'Maior', [0, 4, 7, 10, 14, 17]),
  T('m11', 'm11', 'Décima primeira menor', 'Extensões 11ª', 'Menor', [0, 3, 7, 10, 14, 17]),
  T('maj11', 'maj11', 'Décima primeira maior', 'Extensões 11ª', 'Maior', [0, 4, 7, 11, 14, 17]),
  T('7#11', '7(#11)', 'Sétima com #11 (lídio dominante)', 'Extensões 11ª', 'Outro', [0, 4, 7, 10, 18]),
  T('9#11', '9(#11)', 'Nona com #11', 'Extensões 11ª', 'Outro', [0, 4, 7, 10, 14, 18]),

  // Extensões 13ª
  T('13', '13', 'Décima terceira', 'Extensões 13ª', 'Maior', [0, 4, 7, 10, 14, 21]),
  T('maj13', 'maj13', 'Décima terceira maior', 'Extensões 13ª', 'Maior', [0, 4, 7, 11, 14, 21]),
  T('m13', 'm13', 'Décima terceira menor', 'Extensões 13ª', 'Menor', [0, 3, 7, 10, 14, 21]),
  T('13sus4', '13sus4', 'Décima terceira suspensa', 'Extensões 13ª', 'Outro', [0, 5, 7, 10, 14, 21]),
  T('7b13', '7(b13)', 'Sétima com décima terceira menor', 'Extensões 13ª', 'Outro', [0, 4, 7, 10, 20]),

  // Alterados
  T('7b5', '7(b5)', 'Sétima com quinta bemol', 'Alterados (Jazz)', 'Outro', [0, 4, 6, 10]),
  T('7#5', '7(#5)', 'Sétima com quinta aumentada', 'Alterados (Jazz)', 'Outro', [0, 4, 8, 10]),
  T('7b9b5', '7(b9,b5)', 'Sétima alterada b9/b5', 'Alterados (Jazz)', 'Outro', [0, 4, 6, 10, 13]),
  T('7#9b5', '7(#9,b5)', 'Sétima alterada #9/b5', 'Alterados (Jazz)', 'Outro', [0, 4, 6, 10, 15]),
  T('alt', '7alt', 'Dominante alterado', 'Alterados (Jazz)', 'Outro', [0, 4, 8, 10, 13, 15]),
  T('7b9b13', '7(b9,b13)', 'Sétima com b9 e b13', 'Alterados (Jazz)', 'Outro', [0, 4, 7, 10, 13, 20]),

  // Power
  T('5', '5', 'Power chord (quinta)', 'Power', 'Outro', [0, 7]),
  T('5add9', '5(add9)', 'Power chord com nona', 'Power', 'Outro', [0, 7, 14]),
  T('m5', 'm(no3)', 'Quinta sem terça', 'Power', 'Outro', [0, 7, 12]),

  // Sofisticados
  T('maj7#11', 'maj7(#11)', 'Sétima maior com #11', 'Sofisticados', 'Maior', [0, 4, 7, 11, 18]),
  T('maj9#11', 'maj9(#11)', 'Nona maior com #11', 'Sofisticados', 'Maior', [0, 4, 7, 11, 14, 18]),
  T('7#9#11', '7(#9,#11)', 'Dominante #9 e #11', 'Sofisticados', 'Outro', [0, 4, 7, 10, 15, 18]),
  T('13#11', '13(#11)', 'Décima terceira com #11', 'Sofisticados', 'Outro', [0, 4, 7, 10, 18, 21]),
  T('m11b5', 'm11(b5)', 'Menor com b5 e 11', 'Sofisticados', 'Diminuto', [0, 3, 6, 10, 17]),

  // Quartal / Quintal
  T('quartal', 'Q4', 'Quartal (4ªs empilhadas)', 'Quartal/Quintal', 'Outro', [0, 5, 10]),
  T('quartal4', 'Q4x4', 'Quartal de quatro vozes', 'Quartal/Quintal', 'Outro', [0, 5, 10, 15]),
  T('quintal', 'Q5', 'Quintal (5ªs empilhadas)', 'Quartal/Quintal', 'Outro', [0, 7, 14]),
  T('soWhat', 'SoWhat', 'Voicing So What (quartal)', 'Quartal/Quintal', 'Outro', [0, 5, 10, 15, 19]),

  // Clusters
  T('cluster', 'cl', 'Cluster de semitons', 'Clusters', 'Outro', [0, 1, 2]),
  T('cluster3', 'cl3', 'Cluster de três semitons', 'Clusters', 'Outro', [0, 1, 2, 3]),
  T('cluster5', 'cl5', 'Cluster de cinco notas', 'Clusters', 'Outro', [0, 1, 2, 3, 4]),
  T('clusterWhole', 'clW', 'Cluster de tons inteiros', 'Clusters', 'Outro', [0, 2, 4, 6]),

  // Poliacordes
  T('polyMajOverMaj', '/maj', 'Maior sobre maior', 'Poliacordes', 'Outro', [0, 4, 7, 14, 18, 21]),
  T('polyMajOverMin', '/m', 'Maior sobre menor', 'Poliacordes', 'Outro', [0, 3, 7, 14, 18, 21]),
  T('polyMinOverMaj', 'm/maj', 'Menor sobre maior', 'Poliacordes', 'Outro', [0, 4, 7, 15, 19, 22]),
  T('polySusOverMaj', 'sus/maj', 'Suspenso sobre maior', 'Poliacordes', 'Outro', [0, 4, 7, 14, 17, 21]),
  T('polyDimOverMaj', 'dim/maj', 'Diminuto sobre maior', 'Poliacordes', 'Outro', [0, 4, 7, 15, 18, 21]),
];

export const chordTypeById = (id: string) =>
  CHORD_TYPES.find((c) => c.id === id) ?? CHORD_TYPES[0];

export interface ChordShape {
  root: number;
  type: ChordType;
  inversion: number;
  /** notas (midi) na ordem de execução, da mais grave à mais aguda */
  notes: number[];
  /** pitch classes em ordem */
  pcs: number[];
  symbol: string;
  namePt: string;
}

export const INVERSION_NAMES = ['Fundamental', '1ª Inversão', '2ª Inversão', '3ª Inversão', '4ª Inversão', '5ª Inversão'];

export function buildChord(
  root: number,
  type: ChordType,
  inversion = 0,
  baseOctave = 4,
): ChordShape {
  const pcs: number[] = [];
  for (const iv of type.intervalos) {
    const pc = (((root + iv) % 12) + 12) % 12;
    if (!pcs.includes(pc)) pcs.push(pc);
  }
  const n = pcs.length;
  const inv = n > 0 ? ((inversion % n) + n) % n : 0;
  // voicing fechado, subindo a partir da nota da inversão
  const ordered = [...pcs.slice(inv), ...pcs.slice(0, inv)];
  const notes: number[] = [];
  let last = -1;
  for (let i = 0; i < ordered.length; i++) {
    const pc = ordered[i];
    let m = pcOctaveToMidi(pc, baseOctave);
    while (m <= last) m += 12;
    // primeira nota escolhida para ficar próxima da oitava base
    notes.push(m);
    last = m;
  }
  return {
    root,
    type,
    inversion: inv,
    notes,
    pcs,
    symbol: `${noteName(root)}${type.suffix}`,
    namePt: `${noteName(root)} ${type.nome}`,
  };
}

/** Nome do grau de cada nota do acorde em relação à fundamental */
export function degreeLabel(iv: number): string {
  const table: Record<number, string> = {
    0: 'Fundamental',
    1: '2ª menor',
    2: '2ª maior',
    3: '3ª menor',
    4: '3ª maior',
    5: '4ª justa',
    6: '5ª diminuta',
    7: '5ª justa',
    8: '5ª aumentada',
    9: '6ª maior',
    10: '7ª menor',
    11: '7ª maior',
    12: 'Oitava',
    13: '9ª menor',
    14: '9ª maior',
    15: '9ª aumentada',
    16: '10ª maior',
    17: '11ª justa',
    18: '11ª aumentada',
    19: '12ª justa',
    20: '13ª menor',
    21: '13ª maior',
    22: '14ª maior',
  };
  return table[((iv % 24) + 24) % 24] ?? `${iv} semitons`;
}

/* ------------------------------------------------------------------ */
/* Dedilhado                                                           */
/* ------------------------------------------------------------------ */

export const FINGER_NAMES = ['Polegar', 'Indicador', 'Médio', 'Anelar', 'Mínimo'];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Dedilhado sugerido para a mão direita (1 = polegar) */
export function rightHandFingering(count: number, inversion = 0): number[] {
  const base: Record<number, number[]> = {
    1: [1],
    2: [1, 3],
    3: [1, 2, 3],
    4: [1, 2, 3, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 5],
  };
  const seq = base[clamp(count, 1, 6)] ?? [1, 2, 3, 4, 5];
  if (count === 3 && inversion === 1) return [1, 2, 4];
  if (count === 3 && inversion === 2) return [1, 3, 5];
  return seq;
}

/** Dedilhado sugerido para a mão esquerda (5 = mínimo) */
export function leftHandFingering(count: number, inversion = 0): number[] {
  const base: Record<number, number[]> = {
    1: [5],
    2: [5, 3],
    3: [5, 3, 1],
    4: [5, 4, 2, 1],
    5: [5, 4, 3, 2, 1],
    6: [5, 4, 3, 2, 1, 1],
  };
  const seq = base[clamp(count, 1, 6)] ?? [5, 4, 3, 2, 1];
  if (count === 3 && inversion === 1) return [5, 2, 1];
  if (count === 3 && inversion === 2) return [5, 3, 1];
  return seq;
}

/* ------------------------------------------------------------------ */
/* Escalas                                                             */
/* ------------------------------------------------------------------ */

export interface ScaleType {
  id: string;
  nome: string;
  graus: number[];
  descricao: string;
  categoria: 'Maiores' | 'Menores' | 'Modos' | 'Pentatônicas' | 'Blues' | 'Simétricas' | 'Bebop' | 'Exóticas';
}

export const SCALES: ScaleType[] = [
  { id: 'maior', nome: 'Maior (Jônio)', graus: [0, 2, 4, 5, 7, 9, 11], descricao: 'A escala base da música tonal.', categoria: 'Maiores' },
  { id: 'menorNatural', nome: 'Menor Natural (Eólio)', graus: [0, 2, 3, 5, 7, 8, 10], descricao: 'Menor relativa da maior.', categoria: 'Menores' },
  { id: 'menorHarmonica', nome: 'Menor Harmônica', graus: [0, 2, 3, 5, 7, 8, 11], descricao: 'Sétima elevada, som oriental.', categoria: 'Menores' },
  { id: 'menorMelodica', nome: 'Menor Melódica', graus: [0, 2, 3, 5, 7, 9, 11], descricao: 'Usada no jazz sobre menor.', categoria: 'Menores' },
  { id: 'dorico', nome: 'Dórico', graus: [0, 2, 3, 5, 7, 9, 10], descricao: 'Modo menor com sexta maior.', categoria: 'Modos' },
  { id: 'frigio', nome: 'Frígio', graus: [0, 1, 3, 5, 7, 8, 10], descricao: 'Segunda menor, som espanhol.', categoria: 'Modos' },
  { id: 'lidio', nome: 'Lídio', graus: [0, 2, 4, 6, 7, 9, 11], descricao: 'Quarta aumentada, som etéreo.', categoria: 'Modos' },
  { id: 'mixolidio', nome: 'Mixolídio', graus: [0, 2, 4, 5, 7, 9, 10], descricao: 'Dominante, sétima menor.', categoria: 'Modos' },
  { id: 'locrio', nome: 'Lócrio', graus: [0, 1, 3, 5, 6, 8, 10], descricao: 'Quinta diminuta, som instável.', categoria: 'Modos' },
  { id: 'pentaMaior', nome: 'Pentatônica Maior', graus: [0, 2, 4, 7, 9], descricao: 'Cinco notas, som limpo.', categoria: 'Pentatônicas' },
  { id: 'pentaMenor', nome: 'Pentatônica Menor', graus: [0, 3, 5, 7, 10], descricao: 'Base do blues e do rock.', categoria: 'Pentatônicas' },
  { id: 'blues', nome: 'Blues', graus: [0, 3, 5, 6, 7, 10], descricao: 'Pentatônica menor com blue note.', categoria: 'Blues' },
  { id: 'bluesMaior', nome: 'Blues Maior', graus: [0, 2, 3, 4, 7, 9], descricao: 'Pentatônica maior com terça menor.', categoria: 'Blues' },
  { id: 'tonsInteiros', nome: 'Tons Inteiros', graus: [0, 2, 4, 6, 8, 10], descricao: 'Simétrica, som de sonho.', categoria: 'Simétricas' },
  { id: 'diminuta', nome: 'Diminuta (semitom-tom)', graus: [0, 1, 3, 4, 6, 7, 9, 10], descricao: 'Simétrica de 8 notas.', categoria: 'Simétricas' },
  { id: 'cromatica', nome: 'Cromática', graus: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], descricao: 'Todas as 12 notas.', categoria: 'Simétricas' },
  { id: 'bebopDominante', nome: 'Bebop Dominante', graus: [0, 2, 4, 5, 7, 9, 10, 11], descricao: 'Mixolídio com sétima maior de passagem.', categoria: 'Bebop' },
  { id: 'bebopMaior', nome: 'Bebop Maior', graus: [0, 2, 4, 5, 7, 8, 9, 11], descricao: 'Maior com #5 de passagem.', categoria: 'Bebop' },
  { id: 'hijaz', nome: 'Hijaz (Frígio dominante)', graus: [0, 1, 4, 5, 7, 8, 10], descricao: 'Som árabe.', categoria: 'Exóticas' },
  { id: 'japonesa', nome: 'Japonesa (Hirajoshi)', graus: [0, 2, 3, 7, 8], descricao: 'Pentatônica japonesa.', categoria: 'Exóticas' },
];

export function buildScale(root: number, scale: ScaleType, octave = 4): number[] {
  return scale.graus.map((g) => pcOctaveToMidi((root + g) % 12, octave + Math.floor((root + g) / 12)));
}

export const GRAU_ROMANO = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°', 'I'];

/* ------------------------------------------------------------------ */
/* Intervalos                                                          */
/* ------------------------------------------------------------------ */

export interface IntervalInfo {
  semitons: number;
  nome: string;
  curto: string;
  exemplo: string;
}

export const INTERVALS: IntervalInfo[] = [
  { semitons: 0, nome: 'Uníssono', curto: '1J', exemplo: 'Dó – Dó' },
  { semitons: 1, nome: '2ª menor', curto: '2m', exemplo: 'Dó – Ré♭' },
  { semitons: 2, nome: '2ª maior', curto: '2M', exemplo: 'Dó – Ré' },
  { semitons: 3, nome: '3ª menor', curto: '3m', exemplo: 'Dó – Mi♭' },
  { semitons: 4, nome: '3ª maior', curto: '3M', exemplo: 'Dó – Mi' },
  { semitons: 5, nome: '4ª justa', curto: '4J', exemplo: 'Dó – Fá' },
  { semitons: 6, nome: 'Trítono', curto: '4A/5d', exemplo: 'Dó – Fá#' },
  { semitons: 7, nome: '5ª justa', curto: '5J', exemplo: 'Dó – Sol' },
  { semitons: 8, nome: '6ª menor', curto: '6m', exemplo: 'Dó – Lá♭' },
  { semitons: 9, nome: '6ª maior', curto: '6M', exemplo: 'Dó – Lá' },
  { semitons: 10, nome: '7ª menor', curto: '7m', exemplo: 'Dó – Si♭' },
  { semitons: 11, nome: '7ª maior', curto: '7M', exemplo: 'Dó – Si' },
  { semitons: 12, nome: 'Oitava', curto: '8J', exemplo: 'Dó – Dó' },
];

/* ------------------------------------------------------------------ */
/* Progressões                                                         */
/* ------------------------------------------------------------------ */

export interface Progression {
  id: string;
  nome: string;
  graus: number[]; // graus da escala (0-based)
  qualidades: string[]; // ids de ChordType
  genero: string;
  descricao: string;
  bpm: number;
}

export const PROGRESSIONS: Progression[] = [
  { id: 'pop1564', nome: 'I–V–vi–IV', graus: [0, 4, 5, 3], qualidades: ['maj', 'maj', 'min', 'maj'], genero: 'Pop', descricao: 'A progressão mais usada da música pop.', bpm: 92 },
  { id: 'pop6415', nome: 'vi–IV–I–V', graus: [5, 3, 0, 4], qualidades: ['min', 'maj', 'maj', 'maj'], genero: 'Pop', descricao: 'Versão emotiva da I–V–vi–IV.', bpm: 88 },
  { id: 'doowop', nome: 'I–vi–IV–V', graus: [0, 5, 3, 4], qualidades: ['maj', 'min', 'maj', 'maj'], genero: 'Pop', descricao: 'Progressão dos anos 50 (doo-wop).', bpm: 104 },
  { id: 'jazz251', nome: 'ii–V–I', graus: [1, 4, 0], qualidades: ['m7', '7', 'maj7'], genero: 'Jazz', descricao: 'A cadência fundamental do jazz.', bpm: 120 },
  { id: 'jazz1625', nome: 'I–vi–ii–V', graus: [0, 5, 1, 4], qualidades: ['maj7', 'm7', 'm7', '7'], genero: 'Jazz', descricao: 'Turnaround clássico.', bpm: 132 },
  { id: 'jazz36251', nome: 'iii–vi–ii–V', graus: [2, 5, 1, 4], qualidades: ['m7', 'm7', 'm7', '7'], genero: 'Jazz', descricao: 'Ciclo de quintas descendente.', bpm: 138 },
  { id: 'blues12', nome: 'Blues de 12 compassos', graus: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4], qualidades: ['7', '7', '7', '7', '7', '7', '7', '7', '7', '7', '7', '7'], genero: 'Blues', descricao: 'A forma clássica do blues: I7, IV7, V7.', bpm: 96 },
  { id: 'gospel251', nome: 'ii–V–I gospel', graus: [1, 4, 0], qualidades: ['m9', '13', 'maj9'], genero: 'Gospel', descricao: 'Cadência gospel com extensões.', bpm: 76 },
  { id: 'gospel736251', nome: 'vii–iii–vi–ii–V–I', graus: [6, 2, 5, 1, 4, 0], qualidades: ['m7b5', 'm7', 'm7', 'm7', '7', 'maj7'], genero: 'Gospel', descricao: 'O famoso 7-3-6-2-5-1.', bpm: 72 },
  { id: 'bossa251', nome: 'ii–V–I bossa', graus: [1, 4, 0], qualidades: ['m9', '7b9', 'maj7#11'], genero: 'Bossa Nova', descricao: 'Cadência bossa com cores de jazz.', bpm: 128 },
  { id: 'mpb6415', nome: 'vi–IV–V–I', graus: [5, 3, 4, 0], qualidades: ['m7', 'maj7', '7', 'maj7'], genero: 'MPB', descricao: 'Harmonia brasileira suave.', bpm: 96 },
  { id: 'sertanejo', nome: 'I–V–vi–IV (sertanejo)', graus: [0, 4, 5, 3], qualidades: ['maj', 'maj', 'min', 'maj'], genero: 'Sertanejo', descricao: 'Base do sertanejo moderno.', bpm: 100 },
  { id: 'rock', nome: 'i–VI–III–VII', graus: [0, 5, 2, 6], qualidades: ['min', 'maj', 'maj', 'maj'], genero: 'Rock', descricao: 'Progressão épica menor.', bpm: 116 },
  { id: 'funk', nome: 'i7–IV7 (funk)', graus: [0, 3], qualidades: ['7', '7'], genero: 'Funk', descricao: 'Vamp de dominantes.', bpm: 108 },
  { id: 'soul', nome: 'I–iii–IV–V', graus: [0, 2, 3, 4], qualidades: ['maj7', 'm7', 'maj7', '7'], genero: 'Soul', descricao: 'Soul clássico com sétimas.', bpm: 92 },
  { id: 'andalusian', nome: 'i–VII–VI–V', graus: [0, 6, 5, 4], qualidades: ['min', 'maj', 'maj', 'maj'], genero: 'Flamenco', descricao: 'Cadência andaluza.', bpm: 104 },
  { id: 'canon', nome: 'I–V–vi–iii–IV–I–IV–V', graus: [0, 4, 5, 2, 3, 0, 3, 4], qualidades: ['maj', 'maj', 'min', 'min', 'maj', 'maj', 'maj', 'maj'], genero: 'Clássico', descricao: 'Canon de Pachelbel.', bpm: 84 },
  { id: 'epic', nome: 'i–VI–III–VII (menor)', graus: [0, 5, 2, 6], qualidades: ['min', 'maj', 'maj', 'maj'], genero: 'Trilha', descricao: 'Som cinematográfico.', bpm: 90 },
];

export const GENEROS = Array.from(new Set(PROGRESSIONS.map((p) => p.genero)));

/** Converte graus + qualidades em acordes reais */
export function progressionToChords(prog: Progression, keyRoot: number, octave = 3): ChordShape[] {
  const major = SCALES[0].graus;
  return prog.graus.map((g, i) => {
    const semi = major[g % 7] + (Math.floor(g / 7) * 12);
    const root = (keyRoot + semi) % 12;
    const type = chordTypeById(prog.qualidades[i] ?? 'maj');
    return buildChord(root, type, 0, octave);
  });
}

/** Cifra brasileira simplificada (Dó, Ré...) usada nas listas */
export function chordSymbol(root: number, suffix: string) {
  return `${noteName(root)}${suffix}`;
}

/* ------------------------------------------------------------------ */
/* Voicings gospel                                                     */
/* ------------------------------------------------------------------ */

export interface GospelVoicing {
  id: string;
  nome: string;
  descricao: string;
  /** semitons relativos à fundamental da tonalidade, por acorde */
  acordes: { grau: number; suffix: string; voicing: number[] }[];
}

export const GOSPEL_VOICINGS: GospelVoicing[] = [
  {
    id: 'g251',
    nome: '2-5-1 com nonas',
    descricao: 'Voicing aberto: m9, 13 e maj9. Ideal para baladas gospel.',
    acordes: [
      { grau: 1, suffix: 'm9', voicing: [0, 3, 7, 10, 14] },
      { grau: 4, suffix: '13', voicing: [0, 4, 10, 14, 21] },
      { grau: 0, suffix: 'maj9', voicing: [0, 4, 11, 14] },
    ],
  },
  {
    id: 'g736',
    nome: '7-3-6 turnaround',
    descricao: 'O clássico 7-3-6 que gira a harmonia gospel.',
    acordes: [
      { grau: 6, suffix: 'm7(b5)', voicing: [0, 3, 6, 10] },
      { grau: 2, suffix: '7', voicing: [0, 4, 10, 14] },
      { grau: 5, suffix: 'm9', voicing: [0, 3, 7, 10, 14] },
    ],
  },
  {
    id: 'gdim',
    nome: 'Diminuto de passagem',
    descricao: 'Uso do diminuto como acorde de passagem entre graus.',
    acordes: [
      { grau: 0, suffix: 'maj7', voicing: [0, 4, 7, 11] },
      { grau: 1, suffix: 'dim7', voicing: [0, 3, 6, 9] },
      { grau: 1, suffix: 'm7', voicing: [0, 3, 7, 10] },
    ],
  },
  {
    id: 'gquartal',
    nome: 'Voicing quartal',
    descricao: 'Empilhamento de quartas, som moderno de gospel/jazz.',
    acordes: [
      { grau: 1, suffix: 'Q4', voicing: [0, 5, 10, 15] },
      { grau: 4, suffix: 'Q4', voicing: [0, 5, 10, 15] },
      { grau: 0, suffix: 'Q4x4', voicing: [0, 5, 10, 15] },
    ],
  },
  {
    id: 'g6',
    nome: '1-6-4-5 com sexta',
    descricao: 'Progressão de louvor com sextas e nonas.',
    acordes: [
      { grau: 0, suffix: '6/9', voicing: [0, 4, 9, 14] },
      { grau: 5, suffix: 'm9', voicing: [0, 3, 7, 10, 14] },
      { grau: 3, suffix: 'maj7(#11)', voicing: [0, 4, 11, 18] },
      { grau: 4, suffix: '7(b9)', voicing: [0, 4, 10, 13] },
    ],
  },
];

import { useMemo } from 'react';
import { midiToPc, noteLetter, noteAccidental, midiToOctave, type AccidentalPref } from '../music/theory';

/**
 * Partitura em SVG (clave de sol + clave de fá) desenhada à mão.
 * Sem fontes externas: glifos geométricos, funciona 100% offline.
 */

const TREBLE_LINES = [0, 1, 2, 3, 4]; // posições
const WHITE_NOTES = [0, 2, 4, 5, 7, 9, 11];

/** converte midi em passo diatônico (diatonic step) */
function diatonicStep(midi: number) {
  const pc = midiToPc(midi);
  const oct = midiToOctave(midi);
  const letter = noteLetter(pc);
  return oct * 7 + letter;
}

interface StaffProps {
  notes: number[];
  rootPc?: number | null;
  leftHand?: number[];
  width?: number;
  accidental?: AccidentalPref;
}

export function Staff({ notes, rootPc = null, leftHand = [], width = 460, accidental = 'sustenidos' }: StaffProps) {
  const height = 250;

  const layout = useMemo(() => {
    const trebleBase = 4 * 7 + 2; // E4 = linha 1 (mais grave da clave de sol)
    const bassBase = 2 * 7 + 4; // G2 = linha 1 da clave de fá
    const lineGap = 11;
    const trebleTop = 58; // y da 5ª linha (F5)
    const bassTop = 168;

    const toY = (midi: number, base: number, topY: number) => {
      const step = diatonicStep(midi) - base;
      // passo 0 => linha inferior; cada passo sobe meio espaço
      return topY + (8 - step) * (lineGap / 2);
    };

    const trebleNotes = notes.map((m) => ({
      midi: m,
      x: 0,
      y: toY(m, trebleBase, trebleTop),
      root: rootPc !== null && midiToPc(m) === rootPc,
      acc: noteAccidental(midiToPc(m), accidental),
    }));

    const bassNotes = leftHand.map((m) => ({
      midi: m,
      x: 0,
      y: toY(m, bassBase, bassTop),
      root: rootPc !== null && midiToPc(m) === rootPc,
      acc: noteAccidental(midiToPc(m), accidental),
    }));

    const spread = (arr: typeof trebleNotes, startX: number, gap: number) => {
      // notas simultâneas um pouco deslocadas quando muito próximas
      const sorted = [...arr].sort((a, b) => a.y - b.y);
      return sorted.map((n, i) => {
        let dx = 0;
        for (let k = 0; k < i; k++) {
          if (Math.abs(sorted[k].y - n.y) < 4.5) dx = Math.max(dx, 11);
        }
        return { ...n, x: startX + dx + i * gap };
      });
    };

    const gap = notes.length > 1 ? Math.min(26, (width - 190) / Math.max(1, notes.length)) : 0;
    const t = spread(trebleNotes, 150, gap);
    const b = leftHand.length ? spread(bassNotes, 150, Math.min(26, (width - 190) / leftHand.length)) : [];
    return {
      treble: t,
      bass: b,
      lineGap,
      trebleTop,
      bassTop,
      trebleY: [trebleTop, trebleTop + lineGap, trebleTop + lineGap * 2, trebleTop + lineGap * 3, trebleTop + lineGap * 4],
      bassY: [bassTop, bassTop + lineGap, bassTop + lineGap * 2, bassTop + lineGap * 3, bassTop + lineGap * 4],
      width,
      height,
    };
  }, [notes, leftHand, rootPc, width, accidental]);

  const staffLeft = 26;
  const staffRight = width - 25;

  const ledger = (y: number, x: number, top: number, bottom: number) => {
    const lines: number[] = [];
    if (y > bottom) {
      for (let ly = bottom + layout.lineGap; ly <= y + 0.5; ly += layout.lineGap) lines.push(ly);
    } else if (y < top) {
      for (let ly = top - layout.lineGap; ly >= y - 0.5; ly -= layout.lineGap) lines.push(ly);
    }
    return lines.map((ly, i) => (
      <line
        key={`${x}-${ly}-${i}`}
        x1={x - 11}
        x2={x + 11}
        y1={ly}
        y2={ly}
        stroke="#3b4a63"
        strokeWidth="1.1"
      />
    ));
  };

  const noteHead = (x: number, y: number, root: boolean, acc: number, i: number) => (
    <g key={`${x}-${y}-${i}`}>
      {acc !== 0 && (
        <text
          x={x - 15}
          y={y + 4}
          fontSize="13"
          fill="#26364f"
          fontFamily="Georgia, serif"
          fontWeight="600"
        >
          {acc > 0 ? '♯' : '♭'}
        </text>
      )}
      <ellipse
        cx={x}
        cy={y}
        rx="5.6"
        ry="4.3"
        transform={`rotate(-18 ${x} ${y})`}
        fill={root ? '#c98a18' : '#22324b'}
        stroke="#1b2739"
        strokeWidth="0.6"
      />
      <line x1={x + 5} x2={x + 5} y1={y - 1} y2={y - 33} stroke={root ? '#c98a18' : '#22324b'} strokeWidth="1.5" />
    </g>
  );

  return (
    <div className="staff-box">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Partitura do acorde">
        <rect width={width} height={height} fill="transparent" />
        {/* pautas */}
        {layout.trebleY.map((y, i) => (
          <line key={`t${i}`} x1={staffLeft} x2={staffRight} y1={y} y2={y} stroke="#4b5a74" strokeWidth="1" />
        ))}
        {layout.bassY.map((y, i) => (
          <line key={`b${i}`} x1={staffLeft} x2={staffRight} y1={y} y2={y} stroke="#4b5a74" strokeWidth="1" />
        ))}
        {/* barra de ligação */}
        <line x1={staffLeft} x2={staffLeft} y1={layout.trebleTop} y2={layout.bassY[4]} stroke="#4b5a74" strokeWidth="1.6" />
        <line x1={staffRight} x2={staffRight} y1={layout.trebleTop} y2={layout.bassY[4]} stroke="#4b5a74" strokeWidth="1.6" />

        {/* clave de sol (desenhada) */}
        <g transform={`translate(${staffLeft + 8}, ${layout.trebleTop + 44})`}>
          <path
            d="M0 0 c 9 -10 16 -22 12 -32 c -3 -8 -13 -8 -14 1 c -1 12 12 22 14 34 c 2 13 -6 22 -14 20 c -6 -2 -8 -9 -4 -13 c 5 -5 12 1 10 9 c -3 11 -16 12 -18 2"
            fill="none"
            stroke="#22324b"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
        </g>

        {/* clave de fá */}
        <g transform={`translate(${staffLeft + 6}, ${layout.bassTop + 4})`}>
          <path
            d="M10 -4 c 10 2 12 12 2 16 c -8 4 -14 0 -12 -6 M10 12 c -2 14 0 24 3 30"
            fill="none"
            stroke="#22324b"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <circle cx="14" cy="6" r="2.2" fill="#22324b" />
        </g>

        {/* armadura ausente: acidentes escritos junto às notas */}

        {/* notas */}
        {layout.treble.map((n, i) => (
          <g key={`tn${n.midi}-${i}`}>
            {ledger(n.y, n.x, layout.trebleTop, layout.trebleY[4])}
            {noteHead(n.x, n.y, n.root, n.acc, i)}
          </g>
        ))}
        {layout.bass.map((n, i) => (
          <g key={`bn${n.midi}-${i}`}>
            {ledger(n.y, n.x, layout.bassTop, layout.bassY[4])}
            {noteHead(n.x, n.y, n.root, n.acc, i)}
          </g>
        ))}

        {notes.length === 0 && leftHand.length === 0 && (
          <text x={width / 2} y={height / 2} fontSize="11" fill="#8d9bae" textAnchor="middle">
            Selecione um acorde
          </text>
        )}
      </svg>
    </div>
  );
}

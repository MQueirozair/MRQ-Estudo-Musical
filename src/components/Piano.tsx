import { useEffect, useMemo, useRef, useState } from 'react';
import { noteName, midiToPc, midiToOctave, type AccidentalPref } from '../music/theory';

interface PianoProps {
  /** range inclusivo de MIDI */
  from?: number;
  to?: number;
  /** notas acesas (destaque) */
  activeNotes?: number[];
  /** fundamental do acorde, recebe destaque extra */
  rootPc?: number | null;
  /** dedilhado por nota midi */
  fingering?: Record<number, { finger: number; hand: 'E' | 'D' }>;
  showLabels?: boolean;
  showFingers?: boolean;
  accidental?: AccidentalPref;
  onNoteDown?: (midi: number) => void;
  onNoteUp?: (midi: number) => void;
  height?: number;
}

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

export function Piano({
  from = 48,
  to = 84,
  activeNotes = [],
  rootPc = null,
  fingering = {},
  showLabels = true,
  showFingers = true,
  accidental = 'sustenidos',
  onNoteDown,
  onNoteUp,
  height = 168,
}: PianoProps) {
  const [pressed, setPressed] = useState<Set<number>>(new Set());
  const activeSet = useMemo(() => new Set(activeNotes), [activeNotes]);
  const pointerDown = useRef(false);

  useEffect(() => {
    const up = () => {
      pointerDown.current = false;
      setPressed(new Set());
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  const keys = useMemo(() => {
    const white: { midi: number }[] = [];
    for (let m = from; m <= to; m++) {
      if (!BLACK_PCS.has(midiToPc(m))) white.push({ midi: m });
    }
    const whiteWidth = 40;
    const gap = 2;
    // deslocamento lateral típico de cada tecla preta dentro da oitava
    const blackOffset: Record<number, number> = { 1: -4, 3: 4, 6: -5, 8: 0, 10: 5 };
    const blacks: { midi: number; left: number }[] = [];
    white.forEach((w, i) => {
      const next = w.midi + 1;
      if (next <= to && BLACK_PCS.has(midiToPc(next))) {
        const off = blackOffset[midiToPc(next)] ?? 0;
        // centro entre a tecla branca atual e a próxima
        const left = i * (whiteWidth + gap) + whiteWidth - 12.5 + off;
        blacks.push({ midi: next, left });
      }
    });
    return { white, blacks, whiteWidth };
  }, [from, to]);

  const handleDown = (midi: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    pointerDown.current = true;
    setPressed((p) => new Set(p).add(midi));
    onNoteDown?.(midi);
  };

  const handleEnter = (midi: number) => () => {
    if (!pointerDown.current) return;
    setPressed((p) => {
      if (p.has(midi)) return p;
      onNoteDown?.(midi);
      return new Set(p).add(midi);
    });
  };

  const handleUp = (midi: number) => () => {
    setPressed((p) => {
      if (!p.has(midi)) return p;
      onNoteUp?.(midi);
      const next = new Set(p);
      next.delete(midi);
      return next;
    });
  };

  return (
    <div className="piano-wrap">
      <div className="piano" style={{ height }}>
        {keys.white.map(({ midi }) => {
          const isActive = activeSet.has(midi);
          const isPressed = pressed.has(midi);
          const isRoot = rootPc !== null && midiToPc(midi) === rootPc;
          const fing = fingering[midi];
          return (
            <div
              key={midi}
              className={`key white ${isActive || isPressed ? 'pressed' : ''} ${
                fing?.hand === 'D' ? 'right-mark' : fing?.hand === 'E' ? 'left-mark' : ''
              }`}
              style={{ height }}
              onPointerDown={handleDown(midi)}
              onPointerEnter={handleEnter(midi)}
              onPointerUp={handleUp(midi)}
              onPointerLeave={handleUp(midi)}
            >
              {showFingers && fing && <span className="finger-dot">{fing.finger}</span>}
              {showLabels && (
                <span style={{ opacity: isActive ? 1 : 0.85 }}>
                  {noteName(midiToPc(midi), accidental)}
                  {midiToPc(midi) === 0 ? midiToOctave(midi) : ''}
                  {isRoot ? ' ●' : ''}
                </span>
              )}
            </div>
          );
        })}
        {keys.blacks.map(({ midi, left }) => {
          const isActive = activeSet.has(midi);
          const isPressed = pressed.has(midi);
          const isRoot = rootPc !== null && midiToPc(midi) === rootPc;
          const fing = fingering[midi];
          return (
            <div
              key={midi}
              className={`key black ${isActive || isPressed ? 'pressed' : ''}`}
              style={{ left, height: height * 0.62 }}
              onPointerDown={handleDown(midi)}
              onPointerEnter={handleEnter(midi)}
              onPointerUp={handleUp(midi)}
              onPointerLeave={handleUp(midi)}
            >
              {showFingers && fing && <span className="finger-dot">{fing.finger}</span>}
              {showLabels && (
                <span style={{ opacity: isActive ? 1 : 0.8 }}>
                  {noteName(midiToPc(midi), accidental)}
                  {isRoot ? ' ●' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

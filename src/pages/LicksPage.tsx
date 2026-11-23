import { useMemo, useState } from 'react';
import { Piano } from '../components/Piano';
import { audio } from '../music/audio';
import { noteName, pcOctaveToMidi, type AccidentalPref } from '../music/theory';
import { IconPlay } from '../ui/icons';
import { useToast } from '../ui/toast';

interface Lick {
  id: string;
  nome: string;
  estilo: string;
  descricao: string;
  /** offsets em semitons a partir da tônica (0) */
  notas: number[];
  /** duração relativa em unidades */
  ritmo: number[];
}

const LICKS: Lick[] = [
  { id: 'pentUp', nome: 'Pentatônica ascendente', estilo: 'Rock / Blues', descricao: 'A frase mais usada em solos.', notas: [0, 3, 5, 7, 10, 12], ritmo: [1, 1, 1, 1, 1, 2] },
  { id: 'pentDown', nome: 'Pentatônica descendente', estilo: 'Rock / Blues', descricao: 'Volta com estilo.', notas: [12, 10, 7, 5, 3, 0], ritmo: [1, 1, 1, 1, 1, 2] },
  { id: 'bluesScale', nome: 'Blues com blue note', estilo: 'Blues', descricao: 'A nota ♭5 é a alma do blues.', notas: [0, 3, 5, 6, 7, 10, 12], ritmo: [1, 1, 1, 0.5, 0.5, 1, 2] },
  { id: 'majorRun', nome: 'Corrida maior', estilo: 'Clássico / Pop', descricao: 'Arpejo e escala misturados.', notas: [0, 4, 7, 12, 11, 9, 7, 4], ritmo: [1, 1, 1, 1, 1, 1, 1, 2] },
  { id: 'gospelRun', nome: 'Corrida gospel', estilo: 'Gospel', descricao: 'Pentatônica menor com passagens cromáticas.', notas: [0, 2, 3, 5, 7, 9, 10, 12], ritmo: [0.5, 0.5, 1, 1, 0.5, 0.5, 1, 2] },
  { id: 'jazzEnclosure', nome: 'Enclosure bebop', estilo: 'Jazz', descricao: 'Cercando a nota alvo por cima e por baixo.', notas: [2, 0, 1, 4, 3, 5], ritmo: [0.5, 0.5, 1, 0.5, 0.5, 2] },
  { id: 'trill', nome: 'Trinado clássico', estilo: 'Clássico', descricao: 'Alternância rápida que enriquece a melodia.', notas: [7, 9, 7, 9, 7], ritmo: [0.5, 0.5, 0.5, 0.5, 2] },
  { id: 'bluesTurn', nome: 'Turnaround de blues', estilo: 'Blues', descricao: 'Frase de virada em 12 compassos.', notas: [0, 3, 5, 6, 7, 6, 5, 3], ritmo: [1, 1, 0.5, 0.5, 1, 0.5, 0.5, 2] },
  { id: 'gospelArp', nome: 'Arpejo 2-5-1', estilo: 'Gospel / Jazz', descricao: 'Arpejo de nona sobre o ii e o V.', notas: [2, 5, 9, 12, 5, 9, 12, 17], ritmo: [1, 1, 1, 1, 1, 1, 1, 2] },
  { id: 'rockRiff', nome: 'Riff de quinta', estilo: 'Rock', descricao: 'Power chord em movimento.', notas: [0, 7, 0, 7, 10, 7, 5, 3], ritmo: [0.5, 0.5, 1, 1, 1, 1, 1, 2] },
];

export function LicksPage({ root, accidental }: { root: number; accidental: AccidentalPref }) {
  const toast = useToast();
  const [selected, setSelected] = useState(LICKS[0].id);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const lick = LICKS.find((l) => l.id === selected) ?? LICKS[0];
  const base = pcOctaveToMidi(root, 4);
  const notes = useMemo(() => lick.notas.map((n) => base + n), [lick, base]);

  const tocar = () => {
    const unit = 190;
    let t = 0;
    audio.ensure();
    notes.forEach((m, i) => {
      const dur = lick.ritmo[i] ?? 1;
      setTimeout(() => {
        setPlayingIdx(i);
        const v = audio.noteOn(m, 0.85);
        setTimeout(() => v.stop(), dur * unit + 120);
      }, t);
      t += dur * unit;
    });
    setTimeout(() => setPlayingIdx(null), t + 400);
    toast(`Tocando: ${lick.nome}`, 'ok');
  };

  return (
    <div className="content-inner fade-in">
      <div className="panel">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 className="panel-title" style={{ marginBottom: 2 }}>
              <span className="dot" /> Licks & frases
            </h2>
            <div className="muted">
              Frases prontas para estudar em {noteName(root, accidental)}. Repita devagar e aumente a velocidade.
            </div>
          </div>
          <button className="btn primary" onClick={tocar}>
            <IconPlay size={12} /> Tocar lick
          </button>
        </div>
      </div>

      <div className="two-col-wide">
        <div className="panel">
          <h2 className="panel-title">
            <span className="dot" /> {lick.nome}
          </h2>
          <div className="muted" style={{ marginBottom: 12 }}>
            {lick.descricao} · {lick.estilo}
          </div>

          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {notes.map((m, i) => (
              <button
                key={`${m}-${i}`}
                className={`chip ${playingIdx === i ? 'active' : ''}`}
                onClick={() => {
                  const v = audio.noteOn(m, 0.9);
                  setTimeout(() => v.stop(), 600);
                }}
              >
                {noteName(m % 12, accidental)}
              </button>
            ))}
          </div>

          <Piano
            from={48}
            to={96}
            activeNotes={playingIdx !== null ? [notes[playingIdx]] : notes}
            rootPc={root}
            accidental={accidental}
            height={140}
            onNoteDown={(m) => audio.noteOn(m, 0.9)}
          />

          <div className="divider" />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="muted">Ritmo:</span>
            {lick.ritmo.map((r, i) => (
              <span key={i} className="kbd">
                {r === 0.5 ? '♪' : r === 1 ? '♩' : '𝅗𝅥'}
              </span>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2 className="panel-title">
            <span className="dot" /> Estilos ({LICKS.length})
          </h2>
          <div className="list">
            {LICKS.map((l) => (
              <button key={l.id} className={`list-item ${selected === l.id ? 'active' : ''}`} onClick={() => setSelected(l.id)}>
                <div>
                  <div className="title">{l.nome}</div>
                  <div className="meta">{l.estilo}</div>
                </div>
                <span className="tag" style={{ marginLeft: 'auto' }}>
                  {l.notas.length}n
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

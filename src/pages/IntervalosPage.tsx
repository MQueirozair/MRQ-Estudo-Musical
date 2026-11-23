import { useState } from 'react';
import { audio } from '../music/audio';
import { INTERVALS, noteName, pcOctaveToMidi, type AccidentalPref } from '../music/theory';
import { IconPlay } from '../ui/icons';

export function IntervalosPage({ root, accidental }: { root: number; accidental: AccidentalPref }) {
  const [playing, setPlaying] = useState<number | null>(null);

  const play = (semitons: number, harm = false) => {
    setPlaying(semitons);
    const a = pcOctaveToMidi(root, 4);
    const b = a + semitons;
    if (harm) {
      audio.playNotes([a, b], 1.6);
    } else {
      audio.ensure();
      [a, b].forEach((m, i) => {
        setTimeout(() => {
          const v = audio.noteOn(m, 0.85);
          setTimeout(() => v.stop(), 700);
        }, i * 420);
      });
    }
    setTimeout(() => setPlaying(null), 900);
  };

  return (
    <div className="content-inner fade-in">
      <div className="panel">
        <h2 className="panel-title">
          <span className="dot" /> Intervalos
        </h2>
        <div className="muted">
          A distância entre duas notas, medida em semitons. Base de tudo: acordes, escalas e melodias.
          Partindo de {noteName(root, accidental)}4.
        </div>
      </div>

      <div className="grid-3">
        {INTERVALS.map((iv) => (
          <div key={iv.semitons} className="panel" style={{ padding: 13 }}>
            <div className="row between">
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{iv.nome}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {iv.curto} · {iv.semitons} semitons
                </div>
              </div>
              <span className="tag">{semitonsLabel(iv.semitons)}</span>
            </div>
            <div className="divider" style={{ margin: '10px 0' }} />
            <div className="row between">
              <span className="muted" style={{ fontSize: 11.5 }}>
                {noteName(root, accidental)} → {noteName((root + iv.semitons) % 12, accidental)}
              </span>
              <div className="row" style={{ gap: 4 }}>
                <button className={`btn sm ${playing === iv.semitons ? 'active' : ''}`} onClick={() => play(iv.semitons, false)}>
                  <IconPlay size={10} /> melodia
                </button>
                <button className="btn sm" onClick={() => play(iv.semitons, true)}>
                  harmonia
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2 className="panel-title">
          <span className="dot" /> Referência
        </h2>
        <div className="grid-2even">
          <div className="list">
            <div className="list-item" style={{ cursor: 'default' }}>
              <div>
                <div className="title">Consonâncias perfeitas</div>
                <div className="meta">4ª justa, 5ª justa e oitava</div>
              </div>
            </div>
            <div className="list-item" style={{ cursor: 'default' }}>
              <div>
                <div className="title">Consonâncias imperfeitas</div>
                <div className="meta">3ªs e 6ªs maiores/menores</div>
              </div>
            </div>
          </div>
          <div className="list">
            <div className="list-item" style={{ cursor: 'default' }}>
              <div>
                <div className="title">Dissonâncias</div>
                <div className="meta">2ªs, 7ªs e trítono</div>
              </div>
            </div>
            <div className="list-item" style={{ cursor: 'default' }}>
              <div>
                <div className="title">Trítono</div>
                <div className="meta">6 semitons — o intervalo mais instável</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function semitonsLabel(n: number) {
  if (n === 0) return 'uníssono';
  if (n === 12) return 'oitava';
  return `${n}st`;
}

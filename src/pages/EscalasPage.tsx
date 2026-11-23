import { useMemo, useState } from 'react';
import { Piano } from '../components/Piano';
import { Staff } from '../components/Staff';
import { audio } from '../music/audio';
import {
  CHORD_TYPES,
  SCALES,
  buildChord,
  buildScale,
  noteName,
  pcOctaveToMidi,
  type AccidentalPref,
  type ScaleType,
} from '../music/theory';
import { IconPlay } from '../ui/icons';
import { useToast } from '../ui/toast';

const CATS: ScaleType['categoria'][] = ['Maiores', 'Menores', 'Modos', 'Pentatônicas', 'Blues', 'Simétricas', 'Bebop', 'Exóticas'];

export function EscalasPage({
  root,
  setRoot,
  accidental,
  onTrack,
}: {
  root: number;
  setRoot: (n: number) => void;
  accidental: AccidentalPref;
  onTrack: (kind: string, detail?: string) => void;
}) {
  const toast = useToast();
  const [scaleId, setScaleId] = useState('maior');
  const [cat, setCat] = useState<ScaleType['categoria']>('Maiores');
  const scale = SCALES.find((s) => s.id === scaleId) ?? SCALES[0];
  const notes = useMemo(() => buildScale(root, scale, 4), [root, scale]);

  // acordes diatônicos (tríades) da escala
  const diatonicos = useMemo(() => {
    if (!['maior', 'menorNatural', 'menorHarmonica', 'menorMelodica', 'dorico'].includes(scale.id)) return [];
    return scale.graus.slice(0, 7).map((g, i) => {
      const rootPc = (root + g) % 12;
      // define qualidade empilhando terças dentro da escala
      const rel = scale.graus.map((x) => (x - g + 12) % 12).sort((a, b) => a - b);
      const third = rel.find((r) => r === 3 || r === 4) ?? 4;
      const fifth = rel.find((r) => r === 6 || r === 7 || r === 8) ?? 7;
      const seventh = rel.find((r) => r === 10 || r === 11) ?? 10;
      const id = third === 3 && fifth === 6 ? 'dim' : third === 3 ? 'min' : fifth === 8 ? 'aug' : 'maj';
      const id7 = third === 3 && fifth === 6 && seventh === 10 ? 'm7b5' : third === 3 && seventh === 10 ? 'm7' : third === 3 ? 'mMaj7' : seventh === 11 ? 'maj7' : '7';
      return { rootPc, triad: id, seventh: id7, degree: i };
    });
  }, [root, scale]);

  const playScale = (up = true) => {
    audio.ensure();
    const seq = up ? [...notes, notes[0] + 12] : [...notes].reverse();
    seq.forEach((m, i) => {
      setTimeout(() => {
        const v = audio.noteOn(m, 0.85);
        setTimeout(() => v.stop(), 420);
      }, i * 190);
    });
    onTrack('escala', scale.id);
    toast(`Tocando ${noteName(root, accidental)} ${scale.nome}`, 'ok');
  };

  return (
    <div className="content-inner fade-in">
      <div className="panel">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 className="panel-title" style={{ marginBottom: 2 }}>
              <span className="dot" /> Acordes & Escalas
            </h2>
            <div className="muted">
              {noteName(root, accidental)} {scale.nome} — {scale.descricao}
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn primary" onClick={() => playScale(true)}>
              <IconPlay size={12} /> Subindo
            </button>
            <button className="btn" onClick={() => playScale(false)}>
              <IconPlay size={12} /> Descendo
            </button>
          </div>
        </div>
        <div className="divider" />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="muted">Tônica:</span>
          <div className="chip-row">
            {Array.from({ length: 12 }).map((_, pc) => (
              <button key={pc} className={`chip ${root === pc ? 'active' : ''}`} onClick={() => setRoot(pc)} style={{ minWidth: 34 }}>
                {noteName(pc, accidental)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="section">
          <div className="panel">
            <div className="chip-row" style={{ marginBottom: 8 }}>
              {CATS.map((c) => (
                <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
                  {c}
                </button>
              ))}
            </div>
            <div className="list" style={{ maxHeight: 240, overflowY: 'auto' }}>
              {SCALES.filter((s) => s.categoria === cat).map((s) => (
                <button key={s.id} className={`list-item ${scaleId === s.id ? 'active' : ''}`} onClick={() => setScaleId(s.id)}>
                  <div>
                    <div className="title">{s.nome}</div>
                    <div className="meta">{s.descricao}</div>
                  </div>
                  <span className="tag" style={{ marginLeft: 'auto' }}>
                    {s.graus.length} notas
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2 className="panel-title">
              <span className="dot" /> Notas da escala
            </h2>
            <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
              {notes.map((m, i) => (
                <button key={`${m}-${i}`} className="note-pill" onClick={() => audio.playNotes([m], 1)}>
                  <strong>{noteName(m % 12, accidental)}</strong>
                  <span>grau {i + 1}</span>
                </button>
              ))}
            </div>
            <div className="divider" />
            <h2 className="panel-title">
              <span className="dot" /> Acordes diatônicos
            </h2>
            {diatonicos.length === 0 ? (
              <div className="muted">Esta escala não gera acordes diatônicos tradicionais.</div>
            ) : (
              <div className="chord-grid" style={{ maxHeight: 190 }}>
                {diatonicos.map((d, i) => {
                  const tri = buildChord(d.rootPc, CHORD_TYPES.find((c) => c.id === d.triad)!, 0, 4);
                  const sev = buildChord(d.rootPc, CHORD_TYPES.find((c) => c.id === d.seventh)!, 0, 4);
                  return (
                    <div key={i} className="chord-tile" style={{ cursor: 'default' }}>
                      <b>
                        {noteName(d.rootPc, accidental)}
                        {tri.type.suffix}
                      </b>
                      <small>
                        {noteName(d.rootPc, accidental)}
                        {sev.type.suffix}
                      </small>
                      <div className="row" style={{ gap: 4, justifyContent: 'center', marginTop: 6 }}>
                        <button className="btn sm" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => audio.playNotes(tri.notes, 1.2)}>
                          tríade
                        </button>
                        <button className="btn sm" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => audio.playNotes(sev.notes, 1.2)}>
                          7ª
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="section">
          <div className="panel">
            <h2 className="panel-title">
              <span className="dot" /> Teclado
            </h2>
            <Piano
              from={48}
              to={84}
              activeNotes={notes}
              rootPc={root}
              accidental={accidental}
              height={150}
              onNoteDown={(m) => audio.noteOn(m, 0.9)}
            />
          </div>
          <div className="panel">
            <h2 className="panel-title">
              <span className="dot" /> Partitura
            </h2>
            <Staff accidental={accidental} notes={notes} rootPc={root} width={430} />
          </div>
          <div className="panel">
            <h2 className="panel-title">
              <span className="dot" /> Fórmula
            </h2>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {scale.graus.map((g, i) => (
                <span key={i} className="kbd">
                  {i === 0 ? 'T' : `${g}st`}
                </span>
              ))}
            </div>
            <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>
              Intervalos em semitons a partir da tônica ({pcOctaveToMidi(0, 4)} C4 = referência de oitava).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

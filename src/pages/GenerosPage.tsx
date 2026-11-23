import { useMemo, useState } from 'react';
import { Piano } from '../components/Piano';
import { IconPlay } from '../ui/icons';
import { audio } from '../music/audio';
import {
  GENEROS,
  GOSPEL_VOICINGS,
  PROGRESSIONS,
  buildChord,
  chordTypeById,
  noteName,
  pcOctaveToMidi,
  progressionToChords,
  type AccidentalPref,
} from '../music/theory';
import { useToast } from '../ui/toast';

export function GenerosPage({
  root,
  accidental,
  onTrack,
}: {
  root: number;
  accidental: AccidentalPref;
  onTrack: (kind: string, detail?: string) => void;
}) {
  const toast = useToast();
  const [genero, setGenero] = useState<string>(GENEROS[0]);
  const [voicing, setVoicing] = useState(GOSPEL_VOICINGS[0].id);

  const gv = GOSPEL_VOICINGS.find((v) => v.id === voicing) ?? GOSPEL_VOICINGS[0];

  const chords = useMemo(() => {
    if (genero === 'Gospel') {
      return gv.acordes.map((a) => {
        const rootPc = (root + [0, 2, 4, 5, 7, 9, 11][a.grau % 7]) % 12;
        const type = chordTypeById(a.suffix);
        const shape = buildChord(rootPc, type, 0, 3);
        return shape;
      });
    }
    const list = PROGRESSIONS.filter((p) => p.genero === genero);
    return progressionToChords(list[0] ?? PROGRESSIONS[0], root, 3);
  }, [genero, gv, root]);

  const allNotes = chords.flatMap((c) => c.notes);

  return (
    <div className="content-inner fade-in">
      <div className="panel">
        <h2 className="panel-title">
          <span className="dot" /> Gêneros & Poliacordes
        </h2>
        <div className="muted" style={{ marginBottom: 10 }}>
          Voicings característicos de cada estilo, prontos para tocar. Gospel piano tem voicings próprios.
        </div>
        <div className="chip-row">
          {GENEROS.map((g) => (
            <button key={g} className={`chip ${genero === g ? 'active' : ''}`} onClick={() => setGenero(g)}>
              {g}
            </button>
          ))}
        </div>
        {genero === 'Gospel' && (
          <>
            <div className="divider" />
            <div className="chip-row">
              {GOSPEL_VOICINGS.map((v) => (
                <button
                  key={v.id}
                  className={`chip ${voicing === v.id ? 'active' : ''}`}
                  onClick={() => setVoicing(v.id)}
                >
                  {v.nome}
                </button>
              ))}
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              {gv.descricao}
            </div>
          </>
        )}
      </div>

      <div className="grid-2even">
        <div className="panel">
          <h2 className="panel-title">
            <span className="dot" /> Acordes do estilo
          </h2>
          <div className="list">
            {chords.map((c, i) => (
              <div key={i} className="list-item">
                <span className="tag" style={{ width: 24, textAlign: 'center' }}>
                  {i + 1}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="title">
                    {noteName(c.root, accidental)}
                    {c.type.suffix}
                  </div>
                  <div className="meta">
                    {c.notes.map((m) => noteName(m % 12, accidental)).join(' · ')}
                  </div>
                </div>
                <button
                  className="btn sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => {
                    audio.playNotes([pcOctaveToMidi(c.root, 2), ...c.notes], 1.5);
                    onTrack('genero', genero);
                  }}
                >
                  <IconPlay size={11} />
                </button>
              </div>
            ))}
          </div>
          <div className="divider" />
          <button
            className="btn primary"
            style={{ width: '100%' }}
            onClick={() => {
              const seq = chords.map((c) => [pcOctaveToMidi(c.root, 2), ...c.notes]);
              audio.playChordProgression(seq, genero === 'Jazz' ? 132 : 92);
              toast('Tocando o encadeamento', 'ok');
              onTrack('genero-sequencia', genero);
            }}
          >
            <IconPlay size={13} /> Tocar tudo
          </button>
        </div>

        <div className="section">
          <div className="panel">
            <h2 className="panel-title">
              <span className="dot" /> Teclado
            </h2>
            <Piano
              from={36}
              to={88}
              activeNotes={allNotes}
              rootPc={root}
              accidental={accidental}
              height={150}
              onNoteDown={(m) => audio.noteOn(m, 0.9)}
            />
            <div className="muted" style={{ marginTop: 8 }}>
              Todas as notas do estilo aceso em <b style={{ color: 'var(--accent)' }}>dourado</b> (fundamental).
            </div>
          </div>
          <div className="panel">
            <h2 className="panel-title">
              <span className="dot" /> Poliacordes
            </h2>
            <div className="muted" style={{ marginBottom: 8 }}>
              Sobreposição de duas tríades. Explore as variações disponíveis na categoria{' '}
              <b>Poliacordes</b> da biblioteca.
            </div>
            <div className="list">
              {['polyMajOverMaj', 'polyMajOverMin', 'polyMinOverMaj', 'polySusOverMaj', 'polyDimOverMaj'].map((id) => {
                const t = chordTypeById(id);
                const c = buildChord(root, t, 0, 3);
                return (
                  <button
                    key={id}
                    className="list-item"
                    onClick={() => {
                      audio.playNotes(c.notes, 1.8);
                      onTrack('poliacorde', id);
                    }}
                  >
                    <div>
                      <div className="title">
                        {noteName(root, accidental)}
                        {t.suffix}
                      </div>
                      <div className="meta">{t.nome}</div>
                    </div>
                    <span className="tag" style={{ marginLeft: 'auto' }}>
                      {c.notes.length} notas
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

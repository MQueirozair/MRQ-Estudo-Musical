import { useMemo, useRef, useState } from 'react';
import { Piano } from '../components/Piano';
import { Staff } from '../components/Staff';
import {
  GENEROS,
  PROGRESSIONS,
  buildChord,
  chordTypeById,
  noteName,
  pcOctaveToMidi,
  progressionToChords,
  type AccidentalPref,
} from '../music/theory';
import { audio } from '../music/audio';
import { useToast } from '../ui/toast';
import { IconPlay, IconStop } from '../ui/icons';

export function ProgressoesPage({
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
  const [genero, setGenero] = useState<string>('Todos');
  const [selected, setSelected] = useState(PROGRESSIONS[0].id);
  const [bpm, setBpm] = useState(PROGRESSIONS[0].bpm);
  const [playing, setPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const stopRef = useRef<(() => void) | null>(null);

  const prog = PROGRESSIONS.find((p) => p.id === selected) ?? PROGRESSIONS[0];
  const lista = useMemo(
    () => (genero === 'Todos' ? PROGRESSIONS : PROGRESSIONS.filter((p) => p.genero === genero)),
    [genero],
  );

  const chords = useMemo(() => progressionToChords(prog, root, 3), [prog, root]);

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    setPlaying(false);
    setActiveIdx(-1);
    audio.stopAll();
  };

  const play = () => {
    if (playing) {
      stop();
      return;
    }
    audio.stopAll();
    const noteSets = chords.map((c) => {
      const bass = pcOctaveToMidi(c.root, 2);
      return [bass, ...c.notes];
    });
    setPlaying(true);
    const session = audio.playChordProgression(noteSets, bpm, (i) => setActiveIdx(i));
    stopRef.current = session.stop;
    onTrack('progressao', prog.id);
    toast(`Tocando ${prog.nome} em ${noteName(root, accidental)}`, 'ok');
    setTimeout(() => {
      setPlaying(false);
      setActiveIdx(-1);
      stopRef.current = null;
    }, session.totalMs + 500);
  };

  const activeChord = activeIdx >= 0 ? chords[activeIdx] : null;
  const pianoNotes = activeChord ? activeChord.notes : chords[0]?.notes ?? [];

  return (
    <div className="content-inner fade-in">
      <div className="panel">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 className="panel-title" style={{ marginBottom: 4 }}>
              <span className="dot" /> Progressões harmônicas
            </h2>
            <div className="muted">
              Escolha uma progressão, o tom e ouça o encadeamento com baixo e vozes.
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="chip-row">
              <button className={`chip ${genero === 'Todos' ? 'active' : ''}`} onClick={() => setGenero('Todos')}>
                Todos
              </button>
              {GENEROS.map((g) => (
                <button key={g} className={`chip ${genero === g ? 'active' : ''}`} onClick={() => setGenero(g)}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divider" />

        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <span className="muted">Tom:</span>
          <div className="chip-row">
            {Array.from({ length: 12 }).map((_, pc) => (
              <button
                key={pc}
                className={`chip ${root === pc ? 'active' : ''}`}
                onClick={() => setRoot(pc)}
                style={{ minWidth: 34 }}
              >
                {noteName(pc, accidental)}
              </button>
            ))}
          </div>
        </div>

        <div className="divider" />

        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className={`btn ${playing ? '' : 'primary'}`} onClick={play}>
            {playing ? <IconStop size={13} /> : <IconPlay size={13} />}
            {playing ? 'Parar' : 'Tocar progressão'}
          </button>
          <div className="row" style={{ gap: 6 }}>
            <span className="muted">BPM</span>
            <input
              className="range"
              type="range"
              min={50}
              max={200}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              style={{ width: 130 }}
            />
            <span className="kbd">{bpm}</span>
          </div>
          <span className="tag">{prog.genero}</span>
          <span className="tag warn">{prog.nome}</span>
        </div>
      </div>

      <div className="two-col-wide">
        <div className="section">
          <div className="panel">
            <h2 className="panel-title">
              <span className="dot" /> {prog.nome} em {noteName(root, accidental)}
            </h2>
            <div className="muted" style={{ marginBottom: 12 }}>
              {prog.descricao}
            </div>
            <div className="chip-row" style={{ gap: 8 }}>
              {chords.map((c, i) => (
                <button
                  key={i}
                  className={`list-item ${activeIdx === i ? 'active' : ''}`}
                  style={{ width: 'auto', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 14px' }}
                  onClick={() => {
                    audio.stopAll();
                    audio.playNotes([pcOctaveToMidi(c.root, 2), ...c.notes], 1.6);
                    setActiveIdx(i);
                    setTimeout(() => setActiveIdx(-1), 1500);
                  }}
                >
                  <div className="row" style={{ gap: 6 }}>
                    <strong style={{ fontSize: 17 }}>
                      {noteName(c.root, accidental)}
                      {c.type.suffix}
                    </strong>
                    <span className="tag" style={{ fontSize: 9 }}>
                      {i + 1}
                    </span>
                  </div>
                  <div className="meta">{c.namePt}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2 className="panel-title">
              <span className="dot" /> Teclado
            </h2>
            <Piano
              from={36}
              to={84}
              activeNotes={pianoNotes}
              rootPc={activeChord ? activeChord.root : root}
              accidental={accidental}
              height={150}
              onNoteDown={(m) => audio.noteOn(m, 0.9)}
            />
          </div>

          <div className="panel">
            <h2 className="panel-title">
              <span className="dot" /> Partitura do primeiro acorde
            </h2>
            <Staff
              accidental={accidental}
              notes={chords[0]?.notes ?? []}
              leftHand={chords[0] ? [pcOctaveToMidi(chords[0].root, 2)] : []}
              rootPc={chords[0]?.root ?? null}
              width={620}
            />
          </div>
        </div>

        <div className="panel">
          <h2 className="panel-title">
            <span className="dot" /> Catálogo ({lista.length})
          </h2>
          <div className="list" style={{ maxHeight: 640, overflowY: 'auto' }}>
            {lista.map((p) => (
              <button
                key={p.id}
                className={`list-item ${selected === p.id ? 'active' : ''}`}
                onClick={() => {
                  stop();
                  setSelected(p.id);
                  setBpm(p.bpm);
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="title">{p.nome}</div>
                  <div className="meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.genero} · {p.descricao}
                  </div>
                </div>
                <span className="tag" style={{ marginLeft: 'auto' }}>
                  {p.qualidades.length}x
                </span>
              </button>
            ))}
          </div>
          <div className="divider" />
          <button
            className="btn"
            style={{ width: '100%' }}
            onClick={() => {
              // transpor a progressão para todos os tons, mostrando os acordes
              const linhas = Array.from({ length: 12 }).map((_, pc) =>
                progressionToChords(prog, pc, 3)
                  .map((c) => `${noteName(c.root, accidental)}${c.type.suffix}`)
                  .join('  '),
              );
              alert(`Progressão ${prog.nome} nos 12 tons:\n\n${linhas.join('\n')}`);
            }}
          >
            Ver nos 12 tons
          </button>
          <div className="muted" style={{ marginTop: 8, fontSize: 10.5 }}>
            Dica: use o catálogo para comparar gêneros e entender os graus.
          </div>
        </div>
      </div>
    </div>
  );
}

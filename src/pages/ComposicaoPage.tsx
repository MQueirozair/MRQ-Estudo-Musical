import { useMemo, useState } from 'react';
import { audio } from '../music/audio';
import {
  CHORD_TYPES,
  buildChord,
  chordTypeById,
  noteName,
  pcOctaveToMidi,
  type AccidentalPref,
} from '../music/theory';
import { usePersisted } from '../lib/storage';
import { useToast } from '../ui/toast';
import { IconPlay, IconStop, IconDownload, IconX } from '../ui/icons';

interface ComposedChord {
  id: string;
  root: number;
  typeId: string;
  beats: number;
}

export function ComposicaoPage({
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
  const [titulo, setTitulo] = usePersisted('composicao:titulo', 'Minha música');
  const [chords, setChords] = usePersisted<ComposedChord[]>('composicao:acordes', []);
  const [bpm, setBpm] = usePersisted('composicao:bpm', 96);
  const [typeId, setTypeId] = useState('maj');
  const [playing, setPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const lista = useMemo(
    () => chords.map((c) => ({ ...c, shape: buildChord(c.root, chordTypeById(c.typeId), 0, 3) })),
    [chords],
  );

  const add = () => {
    if (chords.length >= 32) {
      toast('Máximo de 32 acordes', 'err');
      return;
    }
    setChords([...chords, { id: `${Date.now()}-${Math.random()}`, root, typeId, beats: 4 }]);
  };

  const play = () => {
    if (playing) {
      audio.stopAll();
      setPlaying(false);
      setActiveIdx(-1);
      return;
    }
    if (lista.length === 0) return;
    const totalBeats = lista.reduce((s, c) => s + c.beats, 0);
    const seq = lista.map((c) => {
      const bass = pcOctaveToMidi(c.root, 2);
      return [bass, ...c.shape.notes];
    });
    // toca acorde por acorde com duração relativa
    audio.ensure();
    const beatMs = (60 / bpm) * 1000;
    let t = 0;
    setPlaying(true);
    onTrack('composicao', lista.map((c) => `${c.root}:${c.typeId}`).join('-'));
    seq.forEach((notes, i) => {
      const dur = lista[i].beats * beatMs;
      setTimeout(() => {
        setActiveIdx(i);
        notes.forEach((m, k) => {
          const v = audio.noteOn(m, 0.85);
          setTimeout(() => v.stop(), dur * 0.95 + k * 6);
        });
      }, t);
      t += dur;
    });
    setTimeout(() => {
      setPlaying(false);
      setActiveIdx(-1);
    }, t + 200);
    toast(`Tocando ${titulo} (${lista.length} acordes, ${totalBeats} tempos)`, 'ok');
  };

  const exportar = () => {
    const linhas = lista.map((c) => `${noteName(c.root, accidental)}${chordTypeById(c.typeId).suffix}`).join('  ');
    const texto = `# ${titulo}\nBPM: ${bpm}\nTom: ${noteName(root, accidental)}\n\nProgressão:\n${linhas}\n`;
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${titulo.replace(/[^\w\s-]/g, '') || 'composicao'}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Arquivo exportado', 'ok');
  };

  return (
    <div className="content-inner fade-in">
      <div className="panel">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div style={{ minWidth: 220 }}>
            <h2 className="panel-title" style={{ marginBottom: 6 }}>
              <span className="dot" /> Composição
            </h2>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              style={{
                background: 'rgba(140,168,220,0.08)',
                border: '1px solid var(--border)',
                borderRadius: 9,
                padding: '7px 11px',
                fontSize: 14,
                fontWeight: 650,
                width: '100%',
                outline: 'none',
              }}
            />
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={play}>
              {playing ? <IconStop size={12} /> : <IconPlay size={12} />} {playing ? 'Parar' : 'Tocar'}
            </button>
            <button className="btn" onClick={exportar} disabled={lista.length === 0}>
              <IconDownload size={12} /> Exportar
            </button>
            <button className="btn" onClick={() => setChords([])} disabled={lista.length === 0}>
              Limpar
            </button>
          </div>
        </div>
        <div className="divider" />
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 6 }}>
            <span className="muted">BPM</span>
            <input
              className="range"
              type="range"
              min={50}
              max={200}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              style={{ width: 120 }}
            />
            <span className="kbd">{bpm}</span>
          </div>
          <div className="topbar-spacer" />
          <div className="row" style={{ gap: 6 }}>
            <span className="muted">Tom</span>
            {Array.from({ length: 12 }).map((_, pc) => (
              <button key={pc} className={`chip ${root === pc ? 'active' : ''}`} onClick={() => setRoot(pc)} style={{ minWidth: 30, padding: '3px 6px' }}>
                {noteName(pc, accidental)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">
          <span className="dot" /> Adicionar acorde
        </h2>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <span className="tag warn">
            {noteName(root, accidental)}
            {chordTypeById(typeId).suffix}
          </span>
          <div className="chip-row" style={{ flex: 1 }}>
            {CHORD_TYPES.slice(0, 16).map((t) => (
              <button key={t.id} className={`chip ${typeId === t.id ? 'active' : ''}`} onClick={() => setTypeId(t.id)}>
                {noteName(root, accidental)}
                {t.suffix}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={add}>
            + Adicionar
          </button>
        </div>
        <div className="muted" style={{ fontSize: 11 }}>
          Selecione um tipo acima e adicione. Depois reordene com as setas abaixo.
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">
          <span className="dot" /> Sua progressão ({lista.length}/32)
        </h2>
        {lista.length === 0 ? (
          <div className="empty">Nenhum acorde ainda. Adicione o primeiro acima.</div>
        ) : (
          <div className="chip-row" style={{ gap: 8 }}>
            {lista.map((c, i) => (
              <div
                key={c.id}
                className={`list-item ${activeIdx === i ? 'active' : ''}`}
                style={{ width: 'auto', flexDirection: 'column', alignItems: 'flex-start', gap: 3, padding: '9px 12px' }}
              >
                <div className="row" style={{ gap: 4 }}>
                  <strong style={{ fontSize: 15 }}>
                    {noteName(c.root, accidental)}
                    {chordTypeById(c.typeId).suffix}
                  </strong>
                  <span className="tag" style={{ fontSize: 8.5 }}>
                    {i + 1}
                  </span>
                </div>
                <div className="row" style={{ gap: 3 }}>
                  <button
                    className="btn sm"
                    style={{ padding: '1px 5px', fontSize: 10 }}
                    onClick={() => {
                      audio.playNotes([pcOctaveToMidi(c.root, 2), ...c.shape.notes], 1.2);
                    }}
                  >
                    ▶
                  </button>
                  <button
                    className="btn sm"
                    style={{ padding: '1px 5px', fontSize: 10 }}
                    disabled={i === 0}
                    onClick={() => {
                      const arr = [...chords];
                      [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                      setChords(arr);
                    }}
                  >
                    ←
                  </button>
                  <button
                    className="btn sm"
                    style={{ padding: '1px 5px', fontSize: 10 }}
                    disabled={i === lista.length - 1}
                    onClick={() => {
                      const arr = [...chords];
                      [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
                      setChords(arr);
                    }}
                  >
                    →
                  </button>
                  <button
                    className="btn sm"
                    style={{ padding: '1px 5px', fontSize: 10 }}
                    onClick={() => setChords(chords.filter((x) => x.id !== c.id))}
                  >
                    <IconX size={9} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {lista.length > 0 && (
          <>
            <div className="divider" />
            <div className="muted" style={{ fontSize: 11.5 }}>
              Cifra: {lista.map((c) => `${noteName(c.root, accidental)}${chordTypeById(c.typeId).suffix}`).join(' | ')}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

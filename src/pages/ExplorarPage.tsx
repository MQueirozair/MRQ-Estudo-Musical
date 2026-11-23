import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Piano } from '../components/Piano';
import { Staff } from '../components/Staff';
import { ChordLibrary } from '../components/ChordLibrary';
import { FingeringPanel } from '../components/FingeringPanel';
import { Metronome } from '../components/Metronome';
import {
  INVERSION_NAMES,
  buildChord,
  chordTypeById,
  degreeLabel,
  noteName,
  noteLetter,
  noteAccidental,
  midiToPc,
  midiToOctave,
  pcOctaveToMidi,
  rightHandFingering,
  leftHandFingering,
  type AccidentalPref,
} from '../music/theory';
import { audio, listenMidi, requestMidiAccess } from '../music/audio';
import { usePersisted } from '../lib/storage';
import { useToast } from '../ui/toast';
import { IconMidi, IconPlay, IconVolume, IconMute, IconMusic, IconRefresh } from '../ui/icons';

interface Props {
  root: number;
  setRoot: (n: number) => void;
  typeId: string;
  setTypeId: (s: string) => void;
  inversion: number;
  setInversion: (n: number) => void;
  accidental: AccidentalPref;
  setAccidental: (a: AccidentalPref) => void;
  onTrack: (kind: string, detail?: string) => void;
}

const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11];
const KEYBOARD_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12,
};

export function ExplorarPage({
  root,
  setRoot,
  typeId,
  setTypeId,
  inversion,
  setInversion,
  accidental,
  setAccidental,
  onTrack,
}: Props) {
  const toast = useToast();
  const [bpm, setBpm] = usePersisted('metronomo:bpm', 120);
  const [beats, setBeats] = usePersisted('metronomo:compasso', 4);
  const [volume, setVolume] = usePersisted('audio:volume', 0.6);
  const [soundOn, setSoundOn] = usePersisted('audio:ligado', true);
  const [timbre, setTimbre] = usePersisted<'piano' | 'electrico' | 'orgao' | 'cordas'>('audio:timbre', 'piano');
  const [showLabels, setShowLabels] = usePersisted('piano:rotulos', true);
  const [showFingers, setShowFingers] = usePersisted('piano:dedilhado', true);
  const [midiStatus, setMidiStatus] = useState<string>('Conectar Teclado');
  const [held, setHeld] = useState<number[]>([]);
  const [sustain, setSustain] = useState(false);
  const playingRef = useRef<{ stop: () => void } | null>(null);

  const type = chordTypeById(typeId);
  const chord = useMemo(() => buildChord(root, type, inversion, 4), [root, type, inversion]);

  // vozes: direita = acorde na oitava 4, esquerda = fundamental + quinta na oitava 2
  const rightNotes = chord.notes;
  const leftNotes = useMemo(() => {
    const bassRoot = pcOctaveToMidi(root, 2);
    return [bassRoot, bassRoot + 7];
  }, [root]);

  const fingeringMap = useMemo(() => {
    const rf = rightHandFingering(rightNotes.length, chord.inversion);
    const lf = leftHandFingering(leftNotes.length, chord.inversion);
    const map: Record<number, { finger: number; hand: 'E' | 'D' }> = {};
    rightNotes.forEach((m, i) => (map[m] = { finger: rf[i] ?? 1, hand: 'D' }));
    leftNotes.forEach((m, i) => (map[m] = { finger: lf[i] ?? 5, hand: 'E' }));
    return map;
  }, [rightNotes, leftNotes, chord.inversion]);

  const allActive = useMemo(() => [...new Set([...rightNotes, ...held])], [rightNotes, held]);

  useEffect(() => audio.setVolume(volume), [volume]);
  useEffect(() => audio.setTimbre(timbre), [timbre]);

  const playChord = useCallback(
    (notes: number[], label = true) => {
      if (!soundOn) return;
      audio.stopAll();
      audio.playNotes(notes, 1.8);
      if (label) onTrack('ouvir');
    },
    [soundOn, onTrack],
  );

  const play = useCallback(() => {
    playChord([...leftNotes, ...rightNotes]);
    setHeld([]);
  }, [leftNotes, rightNotes, playChord]);

  // Arpejo do acorde (notas em sequência)
  const playArpeggio = () => {
    if (!soundOn) return;
    audio.stopAll();
    audio.ensure();
    const seq = [...leftNotes, ...rightNotes];
    seq.forEach((m, i) => {
      setTimeout(() => {
        const v = audio.noteOn(m, 0.85);
        setTimeout(() => v.stop(), 900);
      }, i * 150);
    });
    onTrack('arpejo');
  };

  // Pedal de sustentação
  const toggleSustain = () => {
    const on = audio.isSustainOn();
    audio.setSustain(!on);
    setSustain(!on);
    toast(!on ? 'Pedal ligado' : 'Pedal desligado', 'ok');
  };

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === ' ') {
        e.preventDefault();
        play();
      } else if (k === 'arrowright') {
        e.preventDefault();
        setInversion((inversion + 1) % Math.max(1, chord.pcs.length));
      } else if (k === 'arrowleft') {
        e.preventDefault();
        setInversion((inversion - 1 + chord.pcs.length) % Math.max(1, chord.pcs.length));
      } else if (k === 'arrowup') {
        e.preventDefault();
        setRoot((root + 1) % 12);
      } else if (k === 'arrowdown') {
        e.preventDefault();
        setRoot((root + 11) % 12);
      } else if (k === 'escape') {
        audio.stopAll();
      } else if (k in KEYBOARD_MAP) {
        const midi = pcOctaveToMidi((root + KEYBOARD_MAP[k]) % 12, 4);
        audio.setSustain(false);
        audio.noteOn(midi, 0.85);
        setHeld((h) => [...h, midi]);
        setTimeout(() => {
          setHeld((h) => h.filter((x) => x !== midi));
        }, 320);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inversion, chord.pcs.length, root, setInversion, setRoot, play]);

  // MIDI
  useEffect(() => {
    if (midiStatus !== 'Conectado') return;
    const cleanup = listenMidi((e) => {
      if (e.on) {
        audio.noteOn(e.midi, e.velocity);
        setHeld((h) => [...h, e.midi]);
      } else {
        setHeld((h) => h.filter((x) => x !== e.midi));
      }
    });
    return () => cleanup();
  }, [midiStatus]);

  const connectMidi = async () => {
    const res = await requestMidiAccess();
    if (res.ok) {
      setMidiStatus('Conectado');
      toast(res.inputs.length ? `MIDI: ${res.inputs.join(', ')}` : 'MIDI conectado (nenhum teclado detectado)', 'ok');
    } else {
      setMidiStatus('Conectar Teclado');
      toast(res.error ?? 'MIDI indisponível', 'err');
    }
  };

  const inversionCount = Math.max(1, chord.pcs.length);

  const noteDetails = chord.pcs.map((pc) => {
    const diff = ((pc - root + 12) % 12);
    // procura o intervalo mais próximo dentre os usados pelo tipo (inclui extensões > 12)
    let iv = diff;
    for (const base of type.intervalos) {
      if (base % 12 === diff) {
        iv = base;
        break;
      }
    }
    return { pc, iv, label: degreeLabel(iv) };
  });

  return (
    <div className="content-inner fade-in">
      {/* Tonalidade + controles */}
      <div className="panel">
        <div className="row between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <h2 className="panel-title" style={{ margin: 0 }}>
            <span className="dot" /> Tonalidade
          </h2>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button
              className={`btn sm ${soundOn ? 'active' : ''}`}
              onClick={() => setSoundOn(!soundOn)}
              title="Ligar/desligar som"
            >
              {soundOn ? <IconVolume size={13} /> : <IconMute size={13} />} {soundOn ? 'Som ligado' : 'Som desligado'}
            </button>
            <button className="btn sm primary" onClick={play}>
              <IconPlay size={12} /> Tocar acorde
            </button>
            <button className="btn sm" onClick={playArpeggio} title="Arpejo do acorde">
              <IconMusic size={13} /> Arpejo
            </button>
            <button
              className={`btn sm ${sustain ? 'active' : ''}`}
              onClick={toggleSustain}
              title="Pedal de sustentação"
            >
              Pedal
            </button>
            <button className={`btn sm ${midiStatus === 'Conectado' ? 'active' : ''}`} onClick={connectMidi}>
              <IconMidi size={13} /> MIDI: {midiStatus}
            </button>
          </div>
        </div>
        <div className="key-grid">
          {Array.from({ length: 12 }).map((_, pc) => {
            const name = noteName(pc, accidental);
            const isBlack = [1, 3, 6, 8, 10].includes(pc);
            return (
              <button
                key={pc}
                className={`key-btn ${isBlack ? 'black' : ''} ${root === pc ? 'active' : ''}`}
                onClick={() => {
                  setRoot(pc);
                  setInversion(0);
                }}
              >
                {name}
              </button>
            );
          })}
        </div>
        <div className="row between" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
          <div className="row" style={{ gap: 6 }}>
            <span className="muted">Enarmonia:</span>
            <button
              className={`chip ${accidental === 'sustenidos' ? 'active' : ''}`}
              onClick={() => setAccidental('sustenidos')}
            >
              ♯ sustenidos
            </button>
            <button
              className={`chip ${accidental === 'bemois' ? 'active' : ''}`}
              onClick={() => setAccidental('bemois')}
            >
              ♭ bemóis
            </button>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span className="muted">Timbre:</span>
            {([
              ['piano', 'Piano'],
              ['electrico', 'Elétrico'],
              ['orgao', 'Órgão'],
              ['cordas', 'Cordas'],
            ] as const).map(([id, label]) => (
              <button key={id} className={`chip ${timbre === id ? 'active' : ''}`} onClick={() => setTimbre(id)}>
                {label}
              </button>
            ))}
            <span className="muted" style={{ marginLeft: 6 }}>
              <IconVolume size={12} /> Vol
            </span>
            <input
              className="range"
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              style={{ width: 80 }}
            />
          </div>
        </div>
      </div>

      {/* Piano */}
      <div className="panel">
        <div className="row between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <h2 className="panel-title" style={{ margin: 0 }}>
            <span className="dot" /> Teclado
          </h2>
          <div className="row" style={{ gap: 8 }}>
            <button className={`chip ${showLabels ? 'active' : ''}`} onClick={() => setShowLabels(!showLabels)}>
              Rótulos
            </button>
            <button className={`chip ${showFingers ? 'active' : ''}`} onClick={() => setShowFingers(!showFingers)}>
              Dedilhado
            </button>
            <span className="muted" style={{ fontSize: 10.5 }}>
              🤚 Esquerda <span style={{ color: 'var(--accent-3)' }}>●</span> ✋ Direita{' '}
              <span style={{ color: 'var(--accent)' }}>●</span>
            </span>
          </div>
        </div>
        <Piano
          from={36}
          to={84}
          activeNotes={allActive}
          rootPc={root}
          fingering={fingeringMap}
          showLabels={showLabels}
          showFingers={showFingers}
          accidental={accidental}
          height={172}
          onNoteDown={(m) => {
            audio.noteOn(m, 0.9);
            setHeld((h) => [...h, m]);
          }}
          onNoteUp={(m) => setHeld((h) => h.filter((x) => x !== m))}
        />
      </div>

      <div className="grid-2">
        <div className="section">
          {/* Cabeçalho do acorde */}
          <div className="panel">
            <div className="chord-hero">
              <div>
                <div className="chord-symbol">
                  {noteName(root, accidental)}
                  {type.suffix}
                </div>
                <div className="chord-name-pt">
                  {noteName(root, accidental)} {type.nome} · {type.categoria}
                </div>
              </div>
              <div className="topbar-spacer" />
              <div className="row" style={{ gap: 6 }}>
                <span className="tag">{inversionCount} notas</span>
                <span className="tag warn">{INVERSION_NAMES[chord.inversion] ?? `${chord.inversion}ª Inversão`}</span>
              </div>
            </div>

            <div className="divider" />

            <div className="muted" style={{ marginBottom: 7, fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase' }}>
              Notas do acorde
            </div>
            <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
              {noteDetails.map((n, i) => (
                <button
                  key={`${n.pc}-${i}`}
                  className={`note-pill ${i === 0 ? 'root' : ''}`}
                  onClick={() => playChord([pcOctaveToMidi(n.pc, 4)])}
                  title="Ouvir esta nota"
                >
                  <strong>{noteName(n.pc, accidental)}</strong>
                  <span>{n.label}</span>
                </button>
              ))}
            </div>

            <div className="divider" />

            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="muted" style={{ fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase' }}>
                Inversões
              </span>
              <span className="muted" style={{ fontSize: 10.5 }}>
                ← → para navegar
              </span>
            </div>
            <div className="chip-row">
              {Array.from({ length: inversionCount }).map((_, i) => (
                <button
                  key={i}
                  className={`chip ${chord.inversion === i ? 'active' : ''}`}
                  onClick={() => {
                    setInversion(i);
                    const c = buildChord(root, type, i, 4);
                    if (soundOn) audio.playNotes(c.notes, 1.2);
                    onTrack('inversao');
                  }}
                >
                  {INVERSION_NAMES[i] ?? `${i}ª Inversão`}
                </button>
              ))}
              <button
                className="chip"
                onClick={() => {
                  setInversion(0);
                  setRoot((root + 1) % 12);
                }}
                title="Próxima fundamental"
              >
                <IconRefresh size={11} /> Próximo tom
              </button>
            </div>
          </div>

          <ChordLibrary
            root={root}
            selectedId={typeId}
            accidental={accidental}
            onSelect={(id) => {
              setTypeId(id);
              setInversion(0);
              onTrack('acorde', id);
            }}
            onPreview={(id) => {
              if (!soundOn) return;
              const c = buildChord(root, chordTypeById(id), 0, 4);
              audio.playNotes(c.notes, 1.3);
            }}
          />

          <div className="grid-2even">
            <div className="panel">
              <h2 className="panel-title">
                <span className="dot" /> Partitura
              </h2>
              <Staff accidental={accidental} notes={rightNotes} leftHand={leftNotes} rootPc={root} width={430} />
              <div className="staff-legend">
                <span>
                  <span className="legend-dot" style={{ background: 'var(--accent)' }} /> Fundamental
                </span>
                <span>
                  <span className="legend-dot" style={{ background: '#22324b' }} /> Acorde (direita)
                </span>
                <span>
                  <span className="legend-dot" style={{ background: '#7f8ea8' }} /> Baixo (esquerda)
                </span>
              </div>
            </div>
            <FingeringPanel
              rightNotes={rightNotes}
              leftNotes={leftNotes}
              inversion={chord.inversion}
              accidental={accidental}
            />
          </div>
        </div>

        <div className="section">
          <Metronome bpm={bpm} setBpm={setBpm} beats={beats} setBeats={setBeats} />
          <div className="panel">
            <h2 className="panel-title">
              <span className="dot" /> Como soa
            </h2>
            <div className="list">
              {noteDetails.map((n, i) => (
                <button key={i} className="list-item" onClick={() => playChord([pcOctaveToMidi(n.pc, 4)])}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgba(140,168,220,0.12)',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div className="title">{noteName(n.pc, accidental)}</div>
                    <div className="meta">
                      {n.label} · {n.iv} semitons
                    </div>
                  </div>
                  <span className="tag" style={{ marginLeft: 'auto' }}>
                    {noteLetter(n.pc) !== undefined ? `${midiToOctave(pcOctaveToMidi(n.pc, 4))}` : ''}
                  </span>
                </button>
              ))}
            </div>
            <div className="divider" />
            <div className="muted" style={{ fontSize: 11 }}>
              Intervalos do tipo: {type.intervalos.map((i) => `${i}st`).join(' · ')}
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Acidente da fundamental: {noteAccidental(root, accidental) > 0 ? '♯' : noteAccidental(root, accidental) < 0 ? '♭' : 'natural'}
            </div>
          </div>
          <div className="panel">
            <h2 className="panel-title">
              <span className="dot" /> Atalhos
            </h2>
            <div className="list" style={{ gap: 4 }}>
              {[
                ['A–K', 'Toca notas do acorde'],
                ['Espaço', 'Toca o acorde completo'],
                ['← / →', 'Troca de inversão'],
                ['↑ / ↓', 'Muda a fundamental'],
                ['Esc', 'Para todo o som'],
              ].map(([k, d]) => (
                <div key={k} className="row between">
                  <span className="muted" style={{ fontSize: 11 }}>
                    {d}
                  </span>
                  <span className="kbd">{k}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

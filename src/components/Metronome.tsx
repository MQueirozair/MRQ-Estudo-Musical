import { useEffect, useRef, useState } from 'react';
import { audio } from '../music/audio';
import { IconPlay, IconStop } from '../ui/icons';

const COMPASSOS = ['2/4', '3/4', '4/4', '6/4'];

export function Metronome({
  bpm,
  setBpm,
  beats,
  setBeats,
}: {
  bpm: number;
  setBpm: (n: number) => void;
  beats: number;
  setBeats: (n: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0);
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beats);
  bpmRef.current = bpm;
  beatsRef.current = beats;

  useEffect(() => {
    if (!running) return;
    audio.startMetronome(bpmRef.current, Math.round(beatsRef.current), setBeat);
    return () => audio.stopMetronome();
  }, [running]);

  // reinicia quando muda bpm/compasso enquanto ligado
  useEffect(() => {
    if (!running) return;
    audio.startMetronome(bpm, Math.round(beats), setBeat);
  }, [bpm, beats, running]);

  const toggle = () => {
    if (running) {
      audio.stopMetronome();
      setRunning(false);
      setBeat(0);
    } else {
      setRunning(true);
    }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">
        <span className="dot" /> Metrônomo
      </h2>
      <div className="row" style={{ gap: 10, marginBottom: 10 }}>
        <button
          className={`btn ${running ? 'active' : 'primary'}`}
          onClick={toggle}
          style={{ width: 40, height: 34, padding: 0 }}
          title={running ? 'Parar metrônomo' : 'Iniciar metrônomo'}
        >
          {running ? <IconStop size={14} /> : <IconPlay size={14} />}
        </button>
        <div className="metro-bpm">{bpm}</div>
        <span className="muted" style={{ letterSpacing: 1, fontSize: 10 }}>
          BPM
        </span>
        <div className="topbar-spacer" />
        <div className="beat-dots">
          {Array.from({ length: Math.round(beats) }).map((_, i) => (
            <span key={i} className={`beat-dot ${running && beat === i ? 'on' : ''}`} />
          ))}
        </div>
      </div>

      <input
        className="range"
        type="range"
        min={40}
        max={240}
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        style={{ width: '100%' }}
      />
      <div className="row between" style={{ marginTop: 4 }}>
        <span className="muted">40</span>
        <div className="row" style={{ gap: 4 }}>
          {[60, 90, 120, 150, 200].map((v) => (
            <button key={v} className="chip" onClick={() => setBpm(v)} style={{ padding: '2px 8px', fontSize: 10.5 }}>
              {v}
            </button>
          ))}
        </div>
        <span className="muted">240</span>
      </div>

      <div className="divider" />
      <div className="row between">
        <span className="muted">Compasso</span>
        <div className="chip-row">
          {COMPASSOS.map((c) => (
            <button
              key={c}
              className={`chip ${Math.round(beats) === Number(c.split('/')[0]) && c === `${Math.round(beats)}/4` ? 'active' : ''}`}
              onClick={() => setBeats(Number(c.split('/')[0]))}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

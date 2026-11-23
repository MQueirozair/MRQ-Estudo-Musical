import {
  FINGER_NAMES,
  leftHandFingering,
  rightHandFingering,
  midiToPc,
  noteName,
  type AccidentalPref,
} from '../music/theory';

export function FingeringPanel({
  rightNotes,
  leftNotes,
  inversion,
  accidental,
}: {
  rightNotes: number[];
  leftNotes: number[];
  inversion: number;
  accidental: AccidentalPref;
}) {
  const right = rightHandFingering(rightNotes.length, inversion);
  const left = leftHandFingering(leftNotes.length, inversion);

  return (
    <div className="panel">
      <h2 className="panel-title">
        <span className="dot" /> Dedilhado sugerido
      </h2>
      <div style={{ display: 'grid', gap: 10 }}>
        <div>
          <div className="row" style={{ gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 13 }}>🤚</span>
            <strong style={{ fontSize: 11.5, letterSpacing: 0.4 }}>MÃO ESQUERDA</strong>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {leftNotes.length === 0 && <span className="muted">Nenhuma nota</span>}
            {leftNotes.map((m, i) => (
              <div key={m} className="note-pill" style={{ minWidth: 62, padding: '5px 9px' }}>
                <strong style={{ fontSize: 13 }}>{left[i]}</strong>
                <span style={{ fontSize: 9 }}>
                  {noteName(midiToPc(m), accidental)} · {FINGER_NAMES[left[i] - 1] ?? ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="row" style={{ gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 13 }}>✋</span>
            <strong style={{ fontSize: 11.5, letterSpacing: 0.4 }}>MÃO DIREITA</strong>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {rightNotes.map((m, i) => (
              <div key={m} className="note-pill" style={{ minWidth: 62, padding: '5px 9px' }}>
                <strong style={{ fontSize: 13 }}>{right[i]}</strong>
                <span style={{ fontSize: 9 }}>
                  {noteName(midiToPc(m), accidental)} · {FINGER_NAMES[right[i] - 1] ?? ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="divider" />
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {FINGER_NAMES.map((name, i) => (
          <span key={name} className="muted" style={{ fontSize: 10.5 }}>
            <b style={{ color: 'var(--text-dim)' }}>{i + 1}</b> = {name}
          </span>
        ))}
      </div>
    </div>
  );
}

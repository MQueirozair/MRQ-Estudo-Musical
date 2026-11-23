import { useEffect, useMemo, useState } from 'react';
import { Staff } from '../components/Staff';
import { audio } from '../music/audio';
import {
  CHORD_TYPES,
  SCALES,
  buildChord,
  buildScale,
  noteName,
  noteLetter,
  midiToPc,
  pcOctaveToMidi,
  type AccidentalPref,
} from '../music/theory';
import { usePersisted } from '../lib/storage';
import { IconPlay, IconRefresh } from '../ui/icons';

/**
 * Leitura: mostra a partitura e você identifica o acorde.
 * O app também mostra a escala de referência para contextualizar.
 */

export function LeituraPage({
  accidental,
  onTrack,
  onScore,
}: {
  accidental: AccidentalPref;
  onTrack: (kind: string, detail?: string) => void;
  onScore: (ok: boolean) => void;
}) {
  const [round, setRound] = useState(0);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [stats, setStats] = usePersisted('leitura:stats', { total: 0, acertos: 0 });

  const puzzle = useMemo(() => {
    const pool = CHORD_TYPES.filter((t) => ['maj', 'min', 'dim', 'aug', '7', 'maj7', 'm7', 'sus4', '6', 'm7b5', '9', 'add9'].includes(t.id));
    const type = pool[Math.floor(Math.random() * pool.length)];
    const rootPc = Math.floor(Math.random() * 12);
    const shape = buildChord(rootPc, type, 0, 4);
    const opts = [type.id];
    while (opts.length < 4) {
      const t = pool[Math.floor(Math.random() * pool.length)];
      if (!opts.includes(t.id)) opts.push(t.id);
    }
    return {
      type,
      rootPc,
      notes: shape.notes,
      options: opts.sort(() => Math.random() - 0.5).map((id) => ({
        id,
        label: `${noteName(rootPc, accidental)}${CHORD_TYPES.find((c) => c.id === id)!.suffix}`,
      })),
    };
  }, [round, accidental]);

  const responder = (id: string) => {
    if (escolha) return;
    setEscolha(id);
    const ok = id === puzzle.type.id;
    audio.feedback(ok);
    setStats({ total: stats.total + 1, acertos: stats.acertos + (ok ? 1 : 0) });
    onScore(ok);
    onTrack('leitura', puzzle.type.id);
  };

  const proximo = () => {
    setEscolha(null);
    setRound((r) => r + 1);
  };

  useEffect(() => {
    // toca ao trocar de rodada, se o usuário já interagiu
    if (round === 0) return;
    audio.playNotes(puzzle.notes, 1.4);
  }, [round, puzzle.notes]);

  const precisao = stats.total ? Math.round((stats.acertos / stats.total) * 100) : 0;

  return (
    <div className="content-inner fade-in">
      <div className="panel">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 className="panel-title" style={{ marginBottom: 2 }}>
              <span className="dot" /> Leitura de partitura
            </h2>
            <div className="muted">Olhe a partitura, identifique o acorde e confira o som.</div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span className="tag ok">{precisao}% de precisão</span>
            <span className="tag">
              {stats.acertos}/{stats.total}
            </span>
            <button className="btn sm" onClick={proximo}>
              <IconRefresh size={12} /> Outro
            </button>
          </div>
        </div>
      </div>

      <div className="grid-2even">
        <div className="panel">
          <h2 className="panel-title">
            <span className="dot" /> Partitura
          </h2>
          <div style={{ background: '#fff', borderRadius: 12, padding: 6 }}>
            <Staff accidental={accidental} notes={puzzle.notes} rootPc={puzzle.rootPc} width={480} />
          </div>
          <div className="row" style={{ gap: 6, marginTop: 10 }}>
            <button className="btn" onClick={() => audio.playNotes(puzzle.notes, 1.6)}>
              <IconPlay size={12} /> Ouvir o acorde
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                const s = SCALES.find((x) => x.id === 'maior')!;
                const scaleNotes = buildScale(midiToPc(puzzle.rootPc), s, 4);
                audio.playNotes(scaleNotes, 0.9);
              }}
            >
              Ouvir a escala
            </button>
          </div>
        </div>

        <div className="panel">
          <h2 className="panel-title">
            <span className="dot" /> Que acorde é este?
          </h2>
          <div className="answer-grid">
            {puzzle.options.map((o) => {
              const isCorrect = o.id === puzzle.type.id;
              const isChosen = escolha === o.id;
              const cls = escolha ? (isCorrect ? 'correct' : isChosen ? 'wrong' : '') : '';
              return (
                <button key={o.id} className={`answer-btn ${cls}`} disabled={!!escolha} onClick={() => responder(o.id)}>
                  {o.label}
                </button>
              );
            })}
          </div>

          {escolha && (
            <div className="fade-in" style={{ marginTop: 16 }}>
              <div className="divider" />
              <div className="row between" style={{ marginBottom: 6 }}>
                <strong style={{ fontSize: 15 }}>
                  {noteName(puzzle.rootPc, accidental)}
                  {puzzle.type.suffix}
                </strong>
                <span className="tag">{puzzle.type.nome}</span>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {puzzle.notes.map((m) => (
                  <span key={m} className="kbd">
                    {noteName(midiToPc(m), accidental)}
                    {noteLetter(midiToPc(m)) + 1}
                  </span>
                ))}
              </div>
              <button className="btn primary" style={{ marginTop: 12, width: '100%' }} onClick={proximo}>
                Próximo acorde →
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">
          <span className="dot" /> Guia rápido de leitura
        </h2>
        <div className="grid-3">
          {[
            ['Clave de sol', 'Mão direita — acordes e melodias. As linhas de baixo para cima são E, G, B, D, F.'],
            ['Clave de fá', 'Mão esquerda — baixos. As linhas de baixo para cima são G, B, D, F, A.'],
            ['Acidentes', 'O ♯ sobe meio tom e o ♭ desce meio tom. Eles aparecem antes da nota.'],
          ].map(([t, d]) => (
            <div key={t} className="metric">
              <div className="label" style={{ marginTop: 0 }}>
                {t}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

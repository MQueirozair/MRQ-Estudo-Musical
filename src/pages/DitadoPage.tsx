import { useCallback, useEffect, useMemo, useState } from 'react';
import { audio } from '../music/audio';
import {
  CHORD_TYPES,
  INTERVALS,
  buildChord,
  noteName,
  pcOctaveToMidi,
  type AccidentalPref,
} from '../music/theory';
import { usePersisted } from '../lib/storage';
import { IconPlay, IconRefresh } from '../ui/icons';

type Modo = 'intervalo' | 'acorde' | 'nota';

interface Item {
  label: string;
  key: string;
  notes: number[];
}

export function DitadoPage({
  accidental,
  onTrack,
  onScore,
}: {
  accidental: AccidentalPref;
  onTrack: (kind: string, detail?: string) => void;
  onScore: (ok: boolean) => void;
}) {
  const [modo, setModo] = useState<Modo>('intervalo');
  const [nivel, setNivel] = usePersisted('ditado:nivel', 1);
  const [stats, setStats] = usePersisted('ditado:stats', { total: 0, acertos: 0 });
  const [escolha, setEscolha] = useState<string | null>(null);

  // Gera uma nova pergunta (chamada por efeitos e botões, nunca durante o render)
  const gerar = useCallback(() => {
    const oct = 4;
    if (modo === 'intervalo') {
      const pool = INTERVALS.filter((i) => i.semitons > 0 && i.semitons <= (nivel === 1 ? 7 : 12));
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const rootPc = Math.floor(Math.random() * 12);
      const a = pcOctaveToMidi(rootPc, oct);
      const distract = INTERVALS.filter((i) => i.semitons > 0 && i.semitons !== pick.semitons)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      return {
        pergunta: { label: pick.nome, key: String(pick.semitons), notes: [a, a + pick.semitons] } as Item,
        opcoes: [pick, ...distract]
          .sort(() => Math.random() - 0.5)
          .map((i) => ({ key: String(i.semitons), label: i.nome })),
      };
    }
    if (modo === 'acorde') {
      const pool = CHORD_TYPES.filter((t) =>
        ['maj', 'min', 'dim', 'aug', '7', 'maj7', 'm7', 'sus4', '6', 'm7b5'].includes(t.id),
      );
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const rootPc = Math.floor(Math.random() * 12);
      const shape = buildChord(rootPc, pick, 0, 4);
      const distract = pool.filter((t) => t.id !== pick.id).sort(() => Math.random() - 0.5).slice(0, 3);
      return {
        pergunta: { label: pick.nome, key: pick.id, notes: shape.notes } as Item,
        opcoes: [pick, ...distract]
          .sort(() => Math.random() - 0.5)
          .map((t) => ({ key: t.id, label: t.nome })),
      };
    }
    const pc = Math.floor(Math.random() * 12);
    const m = pcOctaveToMidi(pc, oct);
    const opts = [pc];
    while (opts.length < 4) {
      const n = Math.floor(Math.random() * 12);
      if (!opts.includes(n)) opts.push(n);
    }
    return {
      pergunta: { label: noteName(pc, accidental), key: String(pc), notes: [m] } as Item,
      opcoes: opts.sort(() => Math.random() - 0.5).map((p) => ({ key: String(p), label: noteName(p, accidental) })),
    };
  }, [modo, nivel, accidental]);

  const [rodada, setRodada] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { pergunta, opcoes } = useMemo(() => gerar(), [gerar, rodada]);

  const tocar = useCallback(() => {
    audio.playNotes(pergunta.notes, 1.6);
  }, [pergunta]);

  // toca automaticamente ao surgir uma nova pergunta
  useEffect(() => {
    const t = setTimeout(() => audio.playNotes(pergunta.notes, 1.6), 350);
    return () => clearTimeout(t);
  }, [pergunta]);

  const responder = (key: string) => {
    if (escolha) return;
    setEscolha(key);
    const ok = key === pergunta.key;
    audio.feedback(ok);
    setStats({ total: stats.total + 1, acertos: stats.acertos + (ok ? 1 : 0) });
    onScore(ok);
    onTrack('ditado', modo);
    setTimeout(() => {
      setEscolha(null);
      setRodada((r) => r + 1);
    }, 1100);
  };

  const precisao = stats.total ? Math.round((stats.acertos / stats.total) * 100) : 0;

  return (
    <div className="content-inner fade-in">
      <div className="panel">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 className="panel-title" style={{ marginBottom: 2 }}>
              <span className="dot" /> Ditado musical
            </h2>
            <div className="muted">Treine o ouvido: escute e identifique sem ver o teclado.</div>
          </div>
          <div className="chip-row">
            {([
              ['intervalo', 'Intervalo'],
              ['acorde', 'Acorde'],
              ['nota', 'Nota'],
            ] as const).map(([id, label]) => (
              <button key={id} className={`chip ${modo === id ? 'active' : ''}`} onClick={() => setModo(id)}>
                {label}
              </button>
            ))}
            <button className={`chip ${nivel === 2 ? 'active' : ''}`} onClick={() => setNivel(nivel === 1 ? 2 : 1)}>
              {nivel === 1 ? 'Nível 1 (fácil)' : 'Nível 2 (geral)'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid-3">
        <div className="metric">
          <div className="value">{stats.acertos}</div>
          <div className="label">Acertos</div>
          <div className="hint">{stats.total} tentativas</div>
        </div>
        <div className="metric">
          <div className="value">{precisao}%</div>
          <div className="label">Precisão</div>
          <div className="bar-track" style={{ marginTop: 8 }}>
            <div className="bar-fill" style={{ width: `${precisao}%` }} />
          </div>
        </div>
        <div className="metric">
          <div className="value">{modo === 'intervalo' ? '🎼' : modo === 'acorde' ? '🎹' : '🎵'}</div>
          <div className="label">Modo atual</div>
          <div className="hint">{modo}</div>
        </div>
      </div>

      <div className="panel" style={{ padding: 24 }}>
        <div className="row" style={{ justifyContent: 'center', gap: 10, marginBottom: 18 }}>
          <button className="btn primary" onClick={tocar}>
            <IconPlay size={13} /> Ouvir
          </button>
          <button
            className="btn"
            onClick={() => {
              setEscolha(null);
              setRodada((r) => r + 1);
            }}
          >
            <IconRefresh size={13} /> Próximo
          </button>
        </div>

        <div className="answer-grid">
          {opcoes.map((o) => {
            const isCorrect = pergunta && o.key === pergunta.key;
            const isChosen = escolha === o.key;
            const cls = escolha ? (isCorrect ? 'correct' : isChosen ? 'wrong' : '') : '';
            return (
              <button key={o.key} className={`answer-btn ${cls}`} disabled={!!escolha} onClick={() => responder(o.key)}>
                {o.label}
              </button>
            );
          })}
        </div>

        {escolha && (
          <div className="center" style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 650, color: escolha === pergunta.key ? 'var(--ok)' : 'var(--danger)' }}>
              {escolha === pergunta.key ? 'Correto!' : `Era: ${pergunta.label}`}
            </div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
              Notas: {pergunta.notes.map((m) => noteName(m % 12, accidental)).join(' · ')}
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <button className="btn sm" onClick={() => setStats({ total: 0, acertos: 0 })}>
          Zerar estatísticas
        </button>
        <span className="muted" style={{ marginLeft: 10, fontSize: 11 }}>
          Dica: o ditado usa o mesmo motor de áudio do app, então o timbre deve ser o piano.
        </span>
      </div>
    </div>
  );
}

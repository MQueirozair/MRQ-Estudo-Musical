import { useEffect, useMemo, useState } from 'react';
import { audio } from '../music/audio';
import {
  CHORD_TYPES,
  buildChord,
  noteName,
  pcOctaveToMidi,
  type AccidentalPref,
  type ChordType,
} from '../music/theory';
import { usePersisted } from '../lib/storage';
import { IconCheck, IconRefresh, IconX } from '../ui/icons';

interface QuizStats {
  total: number;
  acertos: number;
  sequencia: number;
  melhorSequencia: number;
}

const MODOS = [
  { id: 'ouvir', nome: 'Ouvir o acorde', desc: 'Escute e identifique o acorde' },
  { id: 'fundamental', nome: 'Descobrir a fundamental', desc: 'Escute e diga qual a tônica' },
  { id: 'qualidade', nome: 'Maior ou menor?', desc: 'Identifique a qualidade' },
  { id: 'inversao', nome: 'Identificar inversão', desc: 'Qual inversão está soando?' },
] as const;

type Modo = (typeof MODOS)[number]['id'];

export function QuizPage({
  root,
  accidental,
  onTrack,
  onScore,
}: {
  root: number;
  accidental: AccidentalPref;
  onTrack: (kind: string, detail?: string) => void;
  onScore: (ok: boolean) => void;
}) {
  const [modo, setModo] = useState<Modo>('ouvir');
  const [stats, setStats] = usePersisted<QuizStats>('quiz:stats', {
    total: 0,
    acertos: 0,
    sequencia: 0,
    melhorSequencia: 0,
  });
  const [pergunta, setPergunta] = useState<{ type: ChordType; rootPc: number; inversion: number } | null>(null);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'ok' | 'err' | null>(null);

  const sortear = () => {
    const pool = CHORD_TYPES.filter((t) => t.intervalos.length >= 3);
    const type = pool[Math.floor(Math.random() * pool.length)];
    const rootPc = Math.floor(Math.random() * 12);
    const inversion = modo === 'inversao' ? Math.floor(Math.random() * Math.min(3, type.intervalos.length)) : 0;
    setPergunta({ type, rootPc, inversion });
    setEscolha(null);
    setFeedback(null);
    const c = buildChord(rootPc, type, inversion, 4);
    setTimeout(() => audio.playNotes([pcOctaveToMidi(rootPc, 2), ...c.notes], 1.8), 120);
  };

  useEffect(() => {
    sortear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  const opcoes = useMemo(() => {
    if (!pergunta) return [] as { key: string; label: string }[];
    const { type, rootPc, inversion } = pergunta;
    if (modo === 'ouvir') {
      const outros = CHORD_TYPES.filter((t) => t.id !== type.id && t.intervalos.length >= 3)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      return [type, ...outros]
        .sort(() => Math.random() - 0.5)
        .map((t) => ({ key: t.id, label: `${noteName(rootPc, accidental)}${t.suffix}` }));
    }
    if (modo === 'fundamental') {
      const opts = [rootPc];
      while (opts.length < 4) {
        const n = Math.floor(Math.random() * 12);
        if (!opts.includes(n)) opts.push(n);
      }
      return opts.sort(() => Math.random() - 0.5).map((pc) => ({ key: String(pc), label: noteName(pc, accidental) }));
    }
    if (modo === 'qualidade') {
      return [
        { key: 'Maior', label: 'Maior' },
        { key: 'Menor', label: 'Menor' },
        { key: 'Diminuto', label: 'Diminuto' },
        { key: 'Aumentado', label: 'Aumentado' },
      ];
    }
    return [
      { key: '0', label: 'Fundamental' },
      { key: '1', label: '1ª Inversão' },
      { key: '2', label: '2ª Inversão' },
    ];
  }, [pergunta, modo, accidental]);

  const correta = useMemo(() => {
    if (!pergunta) return '';
    if (modo === 'ouvir') return pergunta.type.id;
    if (modo === 'fundamental') return String(pergunta.rootPc);
    if (modo === 'qualidade') return pergunta.type.qualidade;
    return String(pergunta.inversion);
  }, [pergunta, modo]);

  const responder = (key: string) => {
    if (!pergunta || escolha) return;
    setEscolha(key);
    const ok = key === correta;
    setFeedback(ok ? 'ok' : 'err');
    audio.feedback(ok);
    const sequencia = ok ? (stats.sequencia ?? 0) + 1 : 0;
    const next: QuizStats = {
      total: (stats.total ?? 0) + 1,
      acertos: (stats.acertos ?? 0) + (ok ? 1 : 0),
      sequencia,
      melhorSequencia: Math.max(stats.melhorSequencia ?? 0, sequencia),
    };
    setStats(next);
    onScore(ok);
    onTrack('quiz', modo);
    setTimeout(() => sortear(), 950);
  };

  const precisao = stats.total ? Math.round((stats.acertos / stats.total) * 100) : 0;

  return (
    <div className="content-inner fade-in">
      <div className="panel">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 className="panel-title" style={{ marginBottom: 2 }}>
              <span className="dot" /> Treino de acordes
            </h2>
            <div className="muted">Ouça, responda e acompanhe sua evolução. Cada resposta conta pontos.</div>
          </div>
          <div className="chip-row">
            {MODOS.map((m) => (
              <button key={m.id} className={`chip ${modo === m.id ? 'active' : ''}`} onClick={() => setModo(m.id)}>
                {m.nome}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-3">
        <div className="metric">
          <div className="value">{stats.acertos}</div>
          <div className="label">Acertos</div>
          <div className="hint">{stats.total} respostas</div>
        </div>
        <div className="metric">
          <div className="value">{precisao}%</div>
          <div className="label">Precisão</div>
          <div className="bar-track" style={{ marginTop: 8 }}>
            <div className="bar-fill" style={{ width: `${precisao}%` }} />
          </div>
        </div>
        <div className="metric">
          <div className="value">🔥 {stats.sequencia}</div>
          <div className="label">Sequência atual</div>
          <div className="hint">Recorde: {stats.melhorSequencia}</div>
        </div>
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <span className="muted">{MODOS.find((m) => m.id === modo)?.desc}</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={sortear}>
              <IconRefresh size={12} /> Repetir
            </button>
            <button
              className="btn sm"
              onClick={() => {
                if (!pergunta) return;
                const c = buildChord(pergunta.rootPc, pergunta.type, pergunta.inversion, 4);
                audio.playNotes([pcOctaveToMidi(pergunta.rootPc, 2), ...c.notes], 1.8);
              }}
            >
              <IconPlayIcon /> Ouvir novamente
            </button>
          </div>
        </div>

        <div className="answer-grid">
          {opcoes.map((o) => {
            const isCorrect = o.key === correta;
            const isChosen = escolha === o.key;
            const cls = escolha ? (isCorrect ? 'correct' : isChosen ? 'wrong' : '') : '';
            return (
              <button key={o.key} className={`answer-btn ${cls}`} disabled={!!escolha} onClick={() => responder(o.key)}>
                <span className="row" style={{ justifyContent: 'center', gap: 6 }}>
                  {escolha && isCorrect && <IconCheck size={13} />}
                  {escolha && isChosen && !isCorrect && <IconX size={13} />}
                  {o.label}
                </span>
              </button>
            );
          })}
        </div>

        {feedback && (
          <div
            className="center"
            style={{
              marginTop: 14,
              fontSize: 13,
              fontWeight: 600,
              color: feedback === 'ok' ? 'var(--ok)' : 'var(--danger)',
            }}
          >
            {feedback === 'ok' ? 'Boa! Acertou.' : 'Quase! A resposta certa está destacada em verde.'}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="row between">
          <span className="muted">
            Respostas são salvas localmente. Zere quando quiser recomeçar.
          </span>
          <button
            className="btn sm"
            onClick={() => setStats({ total: 0, acertos: 0, sequencia: 0, melhorSequencia: 0 })}
          >
            Zerar estatísticas
          </button>
        </div>
      </div>
    </div>
  );
}

function IconPlayIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4.5 19 12 7 19.5v-15Z" />
    </svg>
  );
}

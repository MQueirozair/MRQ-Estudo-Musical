import { useMemo } from 'react';
import { usePersisted } from '../lib/storage';

export interface AchievementState {
  acertos: number;
  explorados: string[];
  escalas: string[];
  progressoes: string[];
  composicoes: number;
  composicoesLista?: string[];
  dias: string[];
}

const ACHIEVEMENTS: {
  id: string;
  nome: string;
  desc: string;
  medal: string;
  check: (s: AchievementState) => boolean;
  progress: (s: AchievementState) => number;
}[] = [
  { id: 'primeiro', nome: 'Primeiros passos', desc: 'Explore seu primeiro acorde', medal: '🎹', check: (s) => s.explorados.length >= 1, progress: (s) => s.explorados.length / 1 },
  { id: 'dez', nome: 'Curioso', desc: 'Explore 10 acordes diferentes', medal: '🔍', check: (s) => s.explorados.length >= 10, progress: (s) => s.explorados.length / 10 },
  { id: 'cinquenta', nome: 'Explorador', desc: 'Explore 50 acordes diferentes', medal: '🧭', check: (s) => s.explorados.length >= 50, progress: (s) => s.explorados.length / 50 },
  { id: 'cem', nome: 'Enciclopédia', desc: 'Explore 100 acordes diferentes', medal: '📚', check: (s) => s.explorados.length >= 100, progress: (s) => s.explorados.length / 100 },
  { id: 'acerto10', nome: 'Ouvido atento', desc: 'Acerte 10 questões', medal: '👂', check: (s) => s.acertos >= 10, progress: (s) => s.acertos / 10 },
  { id: 'acerto50', nome: 'Músico de estúdio', desc: 'Acerte 50 questões', medal: '🎧', check: (s) => s.acertos >= 50, progress: (s) => s.acertos / 50 },
  { id: 'acerto200', nome: 'Mestre do ouvido', desc: 'Acerte 200 questões', medal: '🏅', check: (s) => s.acertos >= 200, progress: (s) => s.acertos / 200 },
  { id: 'escala5', nome: 'Escalas na mão', desc: 'Toque 5 escalas', medal: '🎼', check: (s) => s.escalas.length >= 5, progress: (s) => s.escalas.length / 5 },
  { id: 'escala20', nome: 'Virtuose', desc: 'Toque 20 escalas diferentes', medal: '🎻', check: (s) => s.escalas.length >= 20, progress: (s) => s.escalas.length / 20 },
  { id: 'prog3', nome: 'Harmonia', desc: 'Toque 3 progressões', medal: '🔗', check: (s) => s.progressoes.length >= 3, progress: (s) => s.progressoes.length / 3 },
  { id: 'prog10', nome: 'Arranjador', desc: 'Toque 10 progressões', medal: '🎺', check: (s) => s.progressoes.length >= 10, progress: (s) => s.progressoes.length / 10 },
  { id: 'comp1', nome: 'Compositor', desc: 'Crie sua primeira progressão', medal: '✍️', check: (s) => s.composicoes >= 1, progress: (s) => s.composicoes / 1 },
  { id: 'comp5', nome: 'Autor', desc: 'Crie 5 composições', medal: '📝', check: (s) => s.composicoes >= 5, progress: (s) => s.composicoes / 5 },
  { id: 'dias3', nome: 'Constância', desc: 'Pratique em 3 dias diferentes', medal: '🔥', check: (s) => s.dias.length >= 3, progress: (s) => s.dias.length / 3 },
  { id: 'dias7', nome: 'Disciplina', desc: 'Pratique em 7 dias diferentes', medal: '💎', check: (s) => s.dias.length >= 7, progress: (s) => s.dias.length / 7 },
  { id: 'dias30', nome: 'Hábito', desc: 'Pratique em 30 dias diferentes', medal: '👑', check: (s) => s.dias.length >= 30, progress: (s) => s.dias.length / 30 },
];

const EMPTY: AchievementState = { acertos: 0, explorados: [], escalas: [], progressoes: [], composicoes: 0, composicoesLista: [], dias: [] };

export function ConquistasPage() {
  const [state] = usePersisted<AchievementState>('conquistas', EMPTY);
  const s = { ...EMPTY, ...state };

  const { unlocked, xp } = useMemo(() => {
    const un = ACHIEVEMENTS.filter((a) => a.check(s));
    return { unlocked: un.length, xp: un.reduce((sum, a) => sum + 100, 0) };
  }, [state]);

  const pct = Math.round((unlocked / ACHIEVEMENTS.length) * 100);

  return (
    <div className="content-inner fade-in">
      <div className="panel">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 className="panel-title" style={{ marginBottom: 2 }}>
              <span className="dot" /> Conquistas
            </h2>
            <div className="muted">Cada marco vale 100 XP. Tudo salvo localmente.</div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span className="tag warn">{xp} XP</span>
            <span className="tag ok">
              {unlocked}/{ACHIEVEMENTS.length}
            </span>
          </div>
        </div>
        <div className="bar-track" style={{ marginTop: 12, height: 9 }}>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>
          {pct}% concluído
        </div>
      </div>

      <div className="grid-3">
        {ACHIEVEMENTS.map((a) => {
          const ok = a.check(s);
          const prog = Math.min(1, a.progress(s));
          return (
            <div key={a.id} className={`achievement ${ok ? 'unlocked' : ''}`} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div className="row" style={{ gap: 10 }}>
                <div className="medal">{a.medal}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="name">{a.nome}</div>
                  <div className="desc">{a.desc}</div>
                </div>
                {ok && <span className="tag ok" style={{ marginLeft: 'auto' }}>✓</span>}
              </div>
              <div className="bar-track" style={{ marginTop: 9 }}>
                <div className="bar-fill" style={{ width: `${prog * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

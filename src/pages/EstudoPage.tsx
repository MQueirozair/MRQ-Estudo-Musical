import { audio } from '../music/audio';
import { noteName, type AccidentalPref } from '../music/theory';
import { usePersisted } from '../lib/storage';
import { IconPlay, IconCheck } from '../ui/icons';

interface Passo {
  id: string;
  titulo: string;
  desc: string;
  minutos: number;
}

const PLANO: Passo[] = [
  { id: 'p1', titulo: 'Aquecimento: notas e oitavas', desc: 'Toque Dó a Si no teclado, nomeando cada nota em voz alta.', minutos: 3 },
  { id: 'p2', titulo: 'Tríades maiores', desc: 'Explore Dó, Fá e Sol maiores. Ouça a diferença de cada fundamental.', minutos: 5 },
  { id: 'p3', titulo: 'Tríades menores', desc: 'Compare Lá menor com Dó maior. Anote o que muda na terça.', minutos: 5 },
  { id: 'p4', titulo: 'Inversões', desc: 'Pegue um acorde e toque as três inversões. Observe o baixo mudando.', minutos: 6 },
  { id: 'p5', titulo: 'Progressão I–V–vi–IV', desc: 'Toque a progressão em 3 tons diferentes.', minutos: 6 },
  { id: 'p6', titulo: 'Escala maior', desc: 'Toque a escala maior subindo e descendo em 2 tons.', minutos: 5 },
  { id: 'p7', titulo: 'Sétimas', desc: 'Ouça maj7, m7 e 7. A sétima é o tempero da harmonia.', minutos: 5 },
  { id: 'p8', titulo: 'Treino de ouvido', desc: 'Faça 10 questões no quiz de acordes.', minutos: 8 },
  { id: 'p9', titulo: 'Composição', desc: 'Monte uma progressão de 4 acordes com o que aprendeu.', minutos: 8 },
];

export function EstudoPage({
  accidental,
  onTrack,
}: {
  accidental: AccidentalPref;
  onTrack: (kind: string, detail?: string) => void;
}) {
  const [feitos, setFeitos] = usePersisted<string[]>('estudo:passos', []);
  const pct = Math.round((feitos.length / PLANO.length) * 100);

  const toggle = (id: string) => {
    if (feitos.includes(id)) {
      setFeitos(feitos.filter((f) => f !== id));
    } else {
      setFeitos([...feitos, id]);
      onTrack('estudo', id);
      audio.feedback(true);
    }
  };

  return (
    <div className="content-inner fade-in">
      <div className="panel">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 className="panel-title" style={{ marginBottom: 2 }}>
              <span className="dot" /> Plano de estudo guiado
            </h2>
            <div className="muted">
              Roteiro de 9 passos, cerca de 50 minutos. Feito para começar do zero e ir até harmonizar.
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span className="tag warn">{pct}%</span>
            <button className="btn sm" onClick={() => setFeitos([])}>
              Reiniciar
            </button>
          </div>
        </div>
        <div className="bar-track" style={{ marginTop: 12, height: 9 }}>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="panel">
        <div className="list">
          {PLANO.map((p, i) => {
            const done = feitos.includes(p.id);
            return (
              <div key={p.id} className={`list-item ${done ? 'active' : ''}`} style={{ alignItems: 'flex-start' }}>
                <button
                  onClick={() => toggle(p.id)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    border: '1px solid var(--border-strong)',
                    background: done ? 'var(--accent)' : 'transparent',
                    color: '#101725',
                    display: 'grid',
                    placeItems: 'center',
                    flex: 'none',
                    marginTop: 2,
                  }}
                  aria-label={done ? 'Desmarcar passo' : 'Concluir passo'}
                >
                  {done && <IconCheck size={13} />}
                </button>
                <div style={{ minWidth: 0 }}>
                  <div className="title">
                    {i + 1}. {p.titulo}
                  </div>
                  <div className="meta">{p.desc}</div>
                </div>
                <span className="tag" style={{ marginLeft: 'auto' }}>
                  {p.minutos} min
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">
          <span className="dot" /> Vídeos recomendados
        </h2>
        <div className="muted" style={{ marginBottom: 10 }}>
          O app é 100% offline. Os links abaixo abrem no seu navegador quando houver internet.
        </div>
        <div className="list">
          {[
            ['Aulas de acordes para iniciantes', 'https://www.youtube.com/results?search_query=acordes+piano+iniciante'],
            ['Harmonia funcional aplicada', 'https://www.youtube.com/results?search_query=harmonia+funcional+piano'],
            ['Gospel piano voicings', 'https://www.youtube.com/results?search_query=gospel+piano+voicings'],
            ['Treino de ouvido', 'https://www.youtube.com/results?search_query=treino+de+ouvido+acordes'],
          ].map(([title, url]) => (
            <a key={url} className="list-item" href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <div>
                <div className="title">{title}</div>
                <div className="meta">youtube.com</div>
              </div>
              <span className="tag" style={{ marginLeft: 'auto' }}>
                abrir ↗
              </span>
            </a>
          ))}
        </div>
        <div className="divider" />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => audio.playNotes([60, 64, 67, 72], 1.6)}>
            <IconPlay size={12} /> Dó maior para começar
          </button>
          <span className="muted">Tom atual de referência: {noteName(0, accidental)}</span>
        </div>
      </div>
    </div>
  );
}

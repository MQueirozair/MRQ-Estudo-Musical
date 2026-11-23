import { usePersisted } from '../lib/storage';
import { IconPiano, IconEar, IconFlow, IconTrophy } from '../ui/icons';

/** Boas-vindas na primeira execução — mostra o que o app faz e reforça o "offline". */
export function WelcomeModal() {
  const [visto, setVisto] = usePersisted('app:boasVindas', false);
  if (visto) return null;

  const itens = [
    { icon: <IconPiano size={16} />, t: 'Explore acordes', d: '76 tipos, todas as inversões, partitura e dedilhado.' },
    { icon: <IconFlow size={16} />, t: 'Toque progressões', d: '18 encadeamentos por gênero, em qualquer tom.' },
    { icon: <IconEar size={16} />, t: 'Treine o ouvido', d: 'Quiz, ditado e leitura com placar salvo.' },
    { icon: <IconTrophy size={16} />, t: 'Acompanhe a evolução', d: 'Conquistas e estatísticas só no seu computador.' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(4, 8, 16, 0.72)',
        backdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
      onClick={() => setVisto(true)}
    >
      <div
        className="panel fade-in"
        style={{ maxWidth: 520, width: '100%', padding: 26, boxShadow: 'var(--shadow)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ gap: 12, marginBottom: 6 }}>
          <div className="brand-mark" style={{ width: 46, height: 46, fontSize: 17 }}>
            MRQ
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 750, letterSpacing: -0.4 }}>Bem-vindo ao Estudo Musical</div>
            <div className="muted">Seu laboratório de harmonia, 100% offline.</div>
          </div>
        </div>

        <div className="divider" />

        <div className="list" style={{ gap: 10 }}>
          {itens.map((i) => (
            <div key={i.t} className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(245,194,107,0.13)',
                  color: 'var(--accent)',
                  flex: 'none',
                }}
              >
                {i.icon}
              </span>
              <div>
                <div style={{ fontWeight: 650, fontSize: 13 }}>{i.t}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  {i.d}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="divider" />

        <div className="muted" style={{ fontSize: 11, marginBottom: 14 }}>
          Nada é enviado para a internet: seus dados ficam salvos em arquivos JSON na pasta do app.
          Atalhos: <span className="kbd">Espaço</span> toca o acorde, <span className="kbd">←</span>{' '}
          <span className="kbd">→</span> trocam a inversão.
        </div>

        <button className="btn primary" style={{ width: '100%' }} onClick={() => setVisto(true)}>
          Começar a estudar
        </button>
      </div>
    </div>
  );
}

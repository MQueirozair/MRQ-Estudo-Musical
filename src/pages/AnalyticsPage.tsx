import { useMemo } from 'react';
import { usePersisted } from '../lib/storage';
import { noteName } from '../music/theory';
import { useNow } from '../lib/storage';

export interface TrackEvent {
  ts: number;
  kind: string;
  detail?: string;
}

interface Analytics {
  eventos: TrackEvent[];
  acertos: number;
  erros: number;
  streakDias: number;
  ultimoDia: string;
}

const KIND_LABEL: Record<string, string> = {
  ouvir: 'Acordes ouvidos',
  acorde: 'Acordes explorados',
  inversao: 'Inversões praticadas',
  quiz: 'Respostas no quiz',
  ditado: 'Respostas no ditado',
  leitura: 'Acordes lidos',
  escala: 'Escalas tocadas',
  progressao: 'Progressões tocadas',
  genero: 'Estilos explorados',
  poliacorde: 'Poliacordes',
  lick: 'Licks tocados',
  composicao: 'Composições',
};

export function AnalyticsPage({ onReset }: { onReset: () => void }) {
  const [data] = usePersisted<Analytics>('analytics', {
    eventos: [],
    acertos: 0,
    erros: 0,
    streakDias: 0,
    ultimoDia: '',
  });
  const now = useNow(30000);

  const stats = useMemo(() => {
    const hoje = new Date(now).toDateString();
    const eventos = data.eventos ?? [];
    const hojeCount = eventos.filter((e) => new Date(e.ts).toDateString() === hoje).length;
    const ultimos7 = eventos.filter((e) => e.ts > now - 7 * 86400000);
    const porDia = new Map<string, number>();
    for (const e of ultimos7) {
      const d = new Date(e.ts).toLocaleDateString('pt-BR', { weekday: 'short' });
      porDia.set(d, (porDia.get(d) ?? 0) + 1);
    }
    const porTipo = new Map<string, number>();
    for (const e of eventos) porTipo.set(e.kind, (porTipo.get(e.kind) ?? 0) + 1);
    const total = data.acertos + data.erros;
    return {
      hojeCount,
      total: eventos.length,
      semana: ultimos7.length,
      precisao: total ? Math.round((data.acertos / total) * 100) : 0,
      porDia: Array.from(porDia.entries()),
      porTipo: Array.from(porTipo.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [data, now]);

  const maxDia = Math.max(1, ...stats.porDia.map(([, v]) => v));
  const maxTipo = Math.max(1, ...stats.porTipo.map(([, v]) => v));

  return (
    <div className="content-inner fade-in">
      <div className="panel">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 className="panel-title" style={{ marginBottom: 2 }}>
              <span className="dot" /> Sua evolução
            </h2>
            <div className="muted">Dados 100% locais — nada sai do seu computador.</div>
          </div>
          <button className="btn sm" onClick={onReset}>
            Limpar histórico
          </button>
        </div>
      </div>

      <div className="grid-3">
        <div className="metric">
          <div className="value">{stats.hojeCount}</div>
          <div className="label">Atividades hoje</div>
        </div>
        <div className="metric">
          <div className="value">{stats.semana}</div>
          <div className="label">Últimos 7 dias</div>
        </div>
        <div className="metric">
          <div className="value">{data.streakDias ?? 0}</div>
          <div className="label">Dias seguidos</div>
        </div>
        <div className="metric">
          <div className="value">{stats.total}</div>
          <div className="label">Ações no total</div>
        </div>
        <div className="metric">
          <div className="value">{stats.precisao}%</div>
          <div className="label">Precisão nos treinos</div>
          <div className="bar-track" style={{ marginTop: 8 }}>
            <div className="bar-fill" style={{ width: `${stats.precisao}%` }} />
          </div>
        </div>
        <div className="metric">
          <div className="value">
            {data.acertos}/{data.erros}
          </div>
          <div className="label">Acertos / erros</div>
        </div>
      </div>

      <div className="grid-2even">
        <div className="panel">
          <h2 className="panel-title">
            <span className="dot" /> Atividade por dia
          </h2>
          {stats.porDia.length === 0 ? (
            <div className="empty">Sem atividade nos últimos 7 dias. Comece explorando um acorde!</div>
          ) : (
            <div className="list">
              {stats.porDia.map(([dia, valor]) => (
                <div key={dia} className="row" style={{ gap: 10 }}>
                  <span className="muted" style={{ width: 42, fontSize: 11 }}>
                    {dia}
                  </span>
                  <div className="bar-track" style={{ flex: 1 }}>
                    <div className="bar-fill" style={{ width: `${(valor / maxDia) * 100}%` }} />
                  </div>
                  <span className="kbd">{valor}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2 className="panel-title">
            <span className="dot" /> O que você mais usa
          </h2>
          {stats.porTipo.length === 0 ? (
            <div className="empty">Ainda sem dados suficientes.</div>
          ) : (
            <div className="list">
              {stats.porTipo.slice(0, 8).map(([kind, valor]) => (
                <div key={kind} className="row" style={{ gap: 10 }}>
                  <span className="muted" style={{ width: 150, fontSize: 11 }}>
                    {KIND_LABEL[kind] ?? kind}
                  </span>
                  <div className="bar-track" style={{ flex: 1 }}>
                    <div className="bar-fill" style={{ width: `${(valor / maxTipo) * 100}%` }} />
                  </div>
                  <span className="kbd">{valor}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">
          <span className="dot" /> Últimas ações
        </h2>
        {(data.eventos ?? []).length === 0 ? (
          <div className="empty">Nada registrado ainda.</div>
        ) : (
          <div className="list">
            {[...(data.eventos ?? [])]
              .slice(-10)
              .reverse()
              .map((e, i) => (
                <div key={i} className="list-item" style={{ cursor: 'default' }}>
                  <span className="tag">{KIND_LABEL[e.kind] ?? e.kind}</span>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {new Date(e.ts).toLocaleString('pt-BR')}
                  </span>
                  {e.detail && (
                    <span className="meta" style={{ marginLeft: 'auto' }}>
                      {noteName(Number(e.detail) || 0)}
                    </span>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

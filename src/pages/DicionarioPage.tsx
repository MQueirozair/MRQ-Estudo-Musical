import { useMemo, useState } from 'react';
import { audio } from '../music/audio';
import {
  CATEGORIAS,
  CHORD_TYPES,
  buildChord,
  noteName,
  type AccidentalPref,
  type Categoria,
} from '../music/theory';
import { useToast } from '../ui/toast';

export function DicionarioPage({
  root,
  setRoot,
  accidental,
}: {
  root: number;
  setRoot: (n: number) => void;
  accidental: AccidentalPref;
}) {
  const toast = useToast();
  const [cat, setCat] = useState<Categoria | 'Todas'>('Todas');
  const [busca, setBusca] = useState('');

  const lista = useMemo(() => {
    const term = busca.trim().toLowerCase();
    return CHORD_TYPES.filter((t) => {
      if (cat !== 'Todas' && t.categoria !== cat) return false;
      if (!term) return true;
      return (
        t.nome.toLowerCase().includes(term) ||
        t.suffix.toLowerCase().includes(term) ||
        `${noteName(root, accidental)}${t.suffix}`.toLowerCase().includes(term)
      );
    });
  }, [cat, busca, root, accidental]);

  return (
    <div className="content-inner fade-in">
      <div className="panel">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 className="panel-title" style={{ marginBottom: 2 }}>
              <span className="dot" /> Dicionário de acordes
            </h2>
            <div className="muted">Todos os tipos de acorde com intervalos e notas.</div>
          </div>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar (ex.: 7, nona, sus)…"
            style={{
              background: 'rgba(140,168,220,0.08)',
              border: '1px solid var(--border)',
              borderRadius: 9,
              padding: '7px 11px',
              fontSize: 12,
              width: 220,
              outline: 'none',
            }}
          />
        </div>
        <div className="divider" />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="muted">Fundamental:</span>
          <div className="chip-row">
            {Array.from({ length: 12 }).map((_, pc) => (
              <button key={pc} className={`chip ${root === pc ? 'active' : ''}`} onClick={() => setRoot(pc)} style={{ minWidth: 34 }}>
                {noteName(pc, accidental)}
              </button>
            ))}
          </div>
        </div>
        <div className="divider" />
        <div className="chip-row">
          <button className={`chip ${cat === 'Todas' ? 'active' : ''}`} onClick={() => setCat('Todas')}>
            Todas
          </button>
          {CATEGORIAS.map((c) => (
            <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="list">
          {lista.map((t) => {
            const c = buildChord(root, t, 0, 4);
            return (
              <button
                key={t.id}
                className="list-item"
                onClick={() => {
                  audio.playNotes([c.notes[0] - 24, ...c.notes], 1.5);
                  toast(`${noteName(root, accidental)}${t.suffix} — ${t.nome}`, 'ok');
                }}
              >
                <div style={{ minWidth: 132 }}>
                  <div className="title" style={{ fontSize: 14.5 }}>
                    {noteName(root, accidental)}
                    {t.suffix}
                  </div>
                  <div className="meta">{t.nome}</div>
                </div>
                <div className="row" style={{ gap: 5, flexWrap: 'wrap', flex: 1 }}>
                  {c.pcs.map((pc, i) => (
                    <span key={i} className="kbd" style={{ fontSize: 10.5 }}>
                      {noteName(pc, accidental)}
                    </span>
                  ))}
                </div>
                <span className="tag">{t.categoria}</span>
                <span className="tag ok">{t.intervalos.length} notas</span>
              </button>
            );
          })}
          {lista.length === 0 && <div className="empty">Nada encontrado para “{busca}”.</div>}
        </div>
      </div>
    </div>
  );
}

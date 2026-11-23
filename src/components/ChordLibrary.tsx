import { useMemo } from 'react';
import { usePersisted } from '../lib/storage';
import {
  CATEGORIAS,
  CHORD_TYPES,
  QUALIDADES,
  buildChord,
  noteName,
  type AccidentalPref,
  type Categoria,
  type Qualidade,
} from '../music/theory';

interface Props {
  root: number;
  selectedId: string;
  accidental: AccidentalPref;
  onSelect: (id: string) => void;
  onPreview: (typeId: string) => void;
}

export function ChordLibrary({ root, selectedId, accidental, onSelect, onPreview }: Props) {
  const [categoria, setCategoria] = usePersisted<Categoria>('biblioteca:categoria', 'Básicos');
  const [qualidade, setQualidade] = usePersisted<Qualidade | 'Todas'>('biblioteca:qualidade', 'Todas');
  const [busca, setBusca] = usePersisted('biblioteca:busca', '');

  const list = useMemo(() => {
    const term = busca.trim().toLowerCase();
    return CHORD_TYPES.filter((t) => {
      if (term) {
        return (
          t.nome.toLowerCase().includes(term) ||
          t.suffix.toLowerCase().includes(term) ||
          t.categoria.toLowerCase().includes(term)
        );
      }
      if (t.categoria !== categoria) return false;
      if (qualidade !== 'Todas' && t.qualidade !== qualidade) return false;
      return true;
    });
  }, [categoria, qualidade, busca]);

  const counts = useMemo(() => {
    const map = new Map<Categoria, number>();
    for (const t of CHORD_TYPES) map.set(t.categoria, (map.get(t.categoria) ?? 0) + 1);
    return map;
  }, []);

  return (
    <div className="panel">
      <div className="row between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h2 className="panel-title" style={{ margin: 0 }}>
          <span className="dot" /> Biblioteca de acordes
        </h2>
        <div className="row" style={{ gap: 6 }}>
          <span className="tag">{CHORD_TYPES.length} tipos</span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar acorde…"
            style={{
              background: 'rgba(140,168,220,0.08)',
              border: '1px solid var(--border)',
              borderRadius: 9,
              padding: '5px 10px',
              fontSize: 11.5,
              width: 150,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {!busca && (
        <>
          <div className="lib-cats" style={{ marginBottom: 6 }}>
            {CATEGORIAS.map((c) => (
              <button
                key={c}
                className={`chip ${categoria === c ? 'active' : ''}`}
                onClick={() => setCategoria(c)}
              >
                {c} <span style={{ opacity: 0.55 }}>{counts.get(c) ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="chip-row" style={{ marginBottom: 10 }}>
            <button
              className={`chip ${qualidade === 'Todas' ? 'active' : ''}`}
              onClick={() => setQualidade('Todas')}
            >
              Todas
            </button>
            {QUALIDADES.map((q) => (
              <button
                key={q}
                className={`chip ${qualidade === q ? 'active' : ''}`}
                onClick={() => setQualidade(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="chord-grid">
        {list.map((t) => {
          const chord = buildChord(root, t);
          return (
            <button
              key={t.id}
              className={`chord-tile ${selectedId === t.id ? 'active' : ''}`}
              onClick={() => {
                onSelect(t.id);
                onPreview(t.id);
              }}
              title={t.nome}
            >
              <b>
                {noteName(root, accidental)}
                {t.suffix}
              </b>
              <small>{t.nome}</small>
            </button>
          );
        })}
        {list.length === 0 && <div className="empty">Nenhum acorde nessa combinação.</div>}
      </div>
      <div className="muted" style={{ marginTop: 9 }}>
        Clique para ouvir e fixar. Total exibido: {list.length}.
      </div>
    </div>
  );
}

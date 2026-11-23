import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WelcomeModal } from './components/WelcomeModal';
import { ExplorarPage } from './pages/ExplorarPage';
import { ProgressoesPage } from './pages/ProgressoesPage';
import { GenerosPage } from './pages/GenerosPage';
import { QuizPage } from './pages/QuizPage';
import { EscalasPage } from './pages/EscalasPage';
import { DicionarioPage } from './pages/DicionarioPage';
import { IntervalosPage } from './pages/IntervalosPage';
import { DitadoPage } from './pages/DitadoPage';
import { LeituraPage } from './pages/LeituraPage';
import { LicksPage } from './pages/LicksPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ComposicaoPage } from './pages/ComposicaoPage';
import { ConquistasPage } from './pages/ConquistasPage';
import { EstudoPage } from './pages/EstudoPage';
import { audio } from './music/audio';
import { usePersisted, isDesktop } from './lib/storage';
import { useToast } from './ui/toast';
import { addDay, addUnique, emptyAchievements } from './lib/achievements';
import type { AchievementState } from './pages/ConquistasPage';
import type { TrackEvent } from './pages/AnalyticsPage';
import type { AccidentalPref } from './music/theory';
import {
  IconPiano,
  IconFlow,
  IconLayers,
  IconTarget,
  IconScale,
  IconBook,
  IconRuler,
  IconEar,
  IconEye,
  IconBolt,
  IconChart,
  IconPen,
  IconTrophy,
  IconMusic,
  IconSun,
  IconMoon,
  IconMenu,
  IconX,
} from './ui/icons';

type Route =
  | 'explorar'
  | 'estudo'
  | 'progressoes'
  | 'generos'
  | 'quiz'
  | 'escalas'
  | 'dicionario'
  | 'intervalos'
  | 'ditado'
  | 'leitura'
  | 'licks'
  | 'analytics'
  | 'composicao'
  | 'conquistas';

const NAV: { group: string; items: { id: Route; label: string; icon: React.ReactNode }[] }[] = [
  {
    group: 'Estudo',
    items: [
      { id: 'explorar', label: 'Explorar Acordes', icon: <IconPiano size={15} /> },
      { id: 'estudo', label: 'Plano de estudo', icon: <IconTarget size={15} /> },
      { id: 'escalas', label: 'Acordes & Escalas', icon: <IconScale size={15} /> },
      { id: 'progressoes', label: 'Progressões', icon: <IconFlow size={15} /> },
      { id: 'generos', label: 'Gêneros & Poliacordes', icon: <IconLayers size={15} /> },
    ],
  },
  {
    group: 'Treino',
    items: [
      { id: 'quiz', label: 'Quiz de Acordes', icon: <IconTarget size={15} /> },
      { id: 'ditado', label: 'Ditado musical', icon: <IconEar size={15} /> },
      { id: 'leitura', label: 'Leitura', icon: <IconEye size={15} /> },
      { id: 'intervalos', label: 'Intervalos', icon: <IconRuler size={15} /> },
      { id: 'licks', label: 'Licks & frases', icon: <IconBolt size={15} /> },
    ],
  },
  {
    group: 'Referência',
    items: [
      { id: 'dicionario', label: 'Dicionário', icon: <IconBook size={15} /> },
      { id: 'composicao', label: 'Composição', icon: <IconPen size={15} /> },
      { id: 'analytics', label: 'Minha evolução', icon: <IconChart size={15} /> },
      { id: 'conquistas', label: 'Conquistas', icon: <IconTrophy size={15} /> },
    ],
  },
];

const TITLES: Record<Route, { title: string; sub: string }> = {
  explorar: { title: 'Explorar Acordes', sub: 'Teclado, inversões, partitura e dedilhado' },
  estudo: { title: 'Plano de Estudo', sub: 'Roteiro guiado do zero à harmonia' },
  escalas: { title: 'Acordes & Escalas', sub: 'Escalas, modos e acordes diatônicos' },
  progressoes: { title: 'Progressões', sub: 'Cadências e encadeamentos por gênero' },
  generos: { title: 'Gêneros & Poliacordes', sub: 'Voicings característicos de cada estilo' },
  quiz: { title: 'Quiz de Acordes', sub: 'Reconhecimento auditivo com placar' },
  ditado: { title: 'Ditado Musical', sub: 'Intervalos, acordes e notas de ouvido' },
  leitura: { title: 'Leitura', sub: 'Identifique acordes na partitura' },
  intervalos: { title: 'Intervalos', sub: 'Distancias entre notas, som e teoria' },
  licks: { title: 'Licks & Frases', sub: 'Ideias melódicas prontas para estudar' },
  dicionario: { title: 'Dicionário de Acordes', sub: 'Todos os tipos, intervalos e notas' },
  composicao: { title: 'Composição', sub: 'Monte e toque sua própria progressão' },
  analytics: { title: 'Minha Evolução', sub: 'Estatísticas salvas no seu computador' },
  conquistas: { title: 'Conquistas', sub: 'Marcos do seu aprendizado' },
};

export default function App() {
  const toast = useToast();
  const [route, setRoute] = usePersisted<Route>('app:rota', 'explorar');
  const [theme, setTheme] = usePersisted<'dark' | 'light'>('app:tema', 'dark');
  const [root, setRoot] = usePersisted('acorde:fundamental', 0);
  const [typeId, setTypeId] = usePersisted('acorde:tipo', 'maj');
  const [inversion, setInversion] = usePersisted('acorde:inversao', 0);
  const [accidental, setAccidental] = usePersisted<AccidentalPref>('app:acidentes', 'sustenidos');
  const [mobileNav, setMobileNav] = useState(false);
  const [analytics, setAnalytics] = usePersisted<{ eventos: TrackEvent[]; acertos: number; erros: number; streakDias: number; ultimoDia: string }>(
    'analytics',
    { eventos: [], acertos: 0, erros: 0, streakDias: 0, ultimoDia: '' },
  );
  const [conquistas, setConquistas] = usePersisted<AchievementState>('conquistas', emptyAchievements());
  const [appInfo, setAppInfo] = useState<{ version: string; dataDir: string; platform: string } | null>(null);

  // aplica tema
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    void (typeof window !== 'undefined' ? window.mrq?.setTheme?.(theme) : undefined);
  }, [theme]);

  useEffect(() => {
    void (typeof window !== 'undefined' ? window.mrq?.appInfo?.() : undefined)?.then((info) =>
      setAppInfo({ version: info.version, dataDir: info.dataDir, platform: info.platform }),
    );
  }, []);

  // registra o dia de uso e a sequência
  useEffect(() => {
    const hoje = new Date().toDateString();
    setAnalytics((a) => {
      if (a.ultimoDia === hoje) return a;
      const ontem = new Date(Date.now() - 86400000).toDateString();
      const streak = a.ultimoDia === ontem ? (a.streakDias || 0) + 1 : 1;
      return { ...a, ultimoDia: hoje, streakDias: streak };
    });
    setConquistas((c) => ({ ...c, dias: addDay(c.dias, hoje) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const track = useCallback(
    (kind: string, detail?: string) => {
      setAnalytics((a) => ({
        ...a,
        eventos: [...(a.eventos ?? []), { ts: Date.now(), kind, detail }].slice(-600),
      }));
      if (kind === 'acorde' && detail) {
        setConquistas((c) => ({ ...c, explorados: addUnique(c.explorados, detail) }));
      }
      if (kind === 'escala' && detail) {
        setConquistas((c) => ({ ...c, escalas: addUnique(c.escalas, detail) }));
      }
      if (kind === 'progressao' && detail) {
        setConquistas((c) => ({ ...c, progressoes: addUnique(c.progressoes, detail) }));
      }
      if (kind === 'composicao' && detail) {
        setConquistas((c) => {
          const lista = addUnique(c.composicoesLista, detail);
          return { ...c, composicoesLista: lista, composicoes: lista.length };
        });
      }
    },
    [setAnalytics, setConquistas],
  );

  const onScore = useCallback(
    (ok: boolean) => {
      setAnalytics((a) => ({ ...a, acertos: a.acertos + (ok ? 1 : 0), erros: a.erros + (ok ? 0 : 1) }));
      if (ok) setConquistas((c) => ({ ...c, acertos: (c.acertos ?? 0) + 1 }));
    },
    [setAnalytics, setConquistas],
  );

  const go = useCallback(
    (r: Route) => {
      setRoute(r);
      setMobileNav(false);
      document.querySelector('.content')?.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setRoute],
  );

  // Importação de backup dispara recarregamento suave
  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.mrq : undefined;
    const off = bridge?.onDataImported?.(() => {
      toast('Dados importados. Recarregando…', 'ok');
      setTimeout(() => location.reload(), 900);
    });
    return () => off?.();
  }, [toast]);

  const resetHistory = () => {
    setAnalytics({ eventos: [], acertos: 0, erros: 0, streakDias: 0, ultimoDia: '' });
    toast('Histórico limpo', 'ok');
  };

  const page = useMemo(() => {
    switch (route) {
      case 'explorar':
        return (
          <ExplorarPage
            root={root}
            setRoot={setRoot}
            typeId={typeId}
            setTypeId={setTypeId}
            inversion={inversion}
            setInversion={setInversion}
            accidental={accidental}
            setAccidental={setAccidental}
            onTrack={track}
          />
        );
      case 'progressoes':
        return <ProgressoesPage root={root} setRoot={setRoot} accidental={accidental} onTrack={track} />;
      case 'generos':
        return <GenerosPage root={root} accidental={accidental} onTrack={track} />;
      case 'quiz':
        return <QuizPage root={root} accidental={accidental} onTrack={track} onScore={onScore} />;
      case 'escalas':
        return <EscalasPage root={root} setRoot={setRoot} accidental={accidental} onTrack={track} />;
      case 'dicionario':
        return <DicionarioPage root={root} setRoot={setRoot} accidental={accidental} />;
      case 'intervalos':
        return <IntervalosPage root={root} accidental={accidental} />;
      case 'ditado':
        return <DitadoPage accidental={accidental} onTrack={track} onScore={onScore} />;
      case 'leitura':
        return <LeituraPage accidental={accidental} onTrack={track} onScore={onScore} />;
      case 'licks':
        return <LicksPage root={root} accidental={accidental} />;
      case 'analytics':
        return <AnalyticsPage onReset={resetHistory} />;
      case 'composicao':
        return <ComposicaoPage root={root} setRoot={setRoot} accidental={accidental} onTrack={track} />;
      case 'conquistas':
        return <ConquistasPage />;
      case 'estudo':
      default:
        return <EstudoPage accidental={accidental} onTrack={track} />;
    }
  }, [route, root, typeId, inversion, accidental, setAccidental, setInversion, setRoot, setTypeId, track, onScore]);

  return (
    <>
      <div className={`backdrop ${mobileNav ? 'show' : ''}`} onClick={() => setMobileNav(false)} />
      <div className="app">
        <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
          <div className="brand">
            <div className="brand-mark">MRQ</div>
            <div className="brand-text">
              <strong>Estudo Musical</strong>
              <span>Piano & Harmonia</span>
            </div>
          </div>

          {NAV.map((group) => (
            <div key={group.group}>
              <div className="nav-group-label">{group.group}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${route === item.id ? 'active' : ''}`}
                  onClick={() => go(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.id === 'conquistas' && conquistas.acertos > 0 && (
                    <span className="nav-badge">{conquistas.acertos} ✓</span>
                  )}
                </button>
              ))}
            </div>
          ))}

          <div className="sidebar-footer">
            <button className="nav-item" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              <span className="nav-icon">{theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}</span>
              {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            </button>
            <div className="storage-note">
              <div className="row" style={{ gap: 5, marginBottom: 3 }}>
                <IconMusic size={11} />
                <b style={{ color: 'var(--text-dim)' }}>{isDesktop() ? 'Versão desktop' : 'Versão web'}</b>
              </div>
              {isDesktop()
                ? 'Dados salvos nesta máquina, 100% offline.'
                : 'Dados salvos no navegador (localStorage).'}
              {appInfo?.version && <div style={{ marginTop: 3, opacity: 0.75 }}>v{appInfo.version}</div>}
            </div>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <button className="icon-btn mobile-only" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <IconX size={15} /> : <IconMenu size={15} />}
            </button>
            <div>
              <h1>{TITLES[route].title}</h1>
              <div className="sub">{TITLES[route].sub}</div>
            </div>
            <div className="topbar-spacer" />
            <div className="row" style={{ gap: 6 }}>
              <span className="tag warn">{accidental === 'sustenidos' ? '♯' : '♭'} {accidental}</span>
              <button
                className="btn sm"
                onClick={() => {
                  audio.stopAll();
                  toast('Som parado', 'ok');
                }}
              >
                Silenciar tudo
              </button>
              <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Alternar tema">
                {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
              </button>
            </div>
          </header>

          <div className="content">{page}</div>
        </main>
        <WelcomeModal />
      </div>
    </>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Download,
  FolderOpen,
  Sparkles,
  Upload,
  CheckCircle2,
  Loader2,
  ChevronDown,
  Youtube,
} from 'lucide-react';
import type { ViewMode } from '../types/music';

interface MenuAction {
  label: string;
  shortcut?: string;
  onClick: () => void;
  divider?: boolean;
  disabled?: boolean;
}

interface TopMenuBarProps {
  projectName: string;
  autosaveLabel: string;
  isBusy: boolean;
  busyText: string;
  viewMode: ViewMode;
  showBeats: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onImportClick: () => void;
  onOpenYouTubeModal: () => void;
  onOpenProjects: () => void;
  onNewProject: () => void;
  onSaveProject: () => void;
  onSaveAs: () => void;
  onExportOpen: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onQuantizeNotes: (div: number) => void;
  onTransposeNotes: (delta: number) => void;
  onClearLoop: () => void;
  onClearCache: () => void;
  onViewModeChange: (m: ViewMode) => void;
  onToggleBeats: () => void;
  onSelectBottomTab: (tab: 'pianoroll' | 'chords' | 'stems' | 'loops' | 'info') => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onOpenModels: () => void;
  onAnalyzeFull: () => void;
  onAnalyzeBpm: () => void;
  onAnalyzeKey: () => void;
  onAnalyzeNotes: () => void;
  onAnalyzeChords: () => void;
  onSeparateStems: () => void;
  onOpenHelp: (tab: 'shortcuts' | 'manual' | 'diagnostics' | 'about') => void;
  onTapTempoClick: () => void;
}

export const TopMenuBar: React.FC<TopMenuBarProps> = (props) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  const menus: Record<string, MenuAction[]> = {
    Arquivo: [
      { label: 'Novo Projeto', shortcut: 'Ctrl+N', onClick: props.onNewProject },
      { label: 'Abrir / Gerenciar Projetos...', shortcut: 'Ctrl+O', onClick: props.onOpenProjects },
      { label: 'Importar Arquivo(s) de Áudio...', shortcut: 'Ctrl+I', onClick: props.onImportClick },
      { label: 'Abrir Vídeo do YouTube...', shortcut: 'Ctrl+Shift+Y', onClick: props.onOpenYouTubeModal, divider: true },
      { label: 'Salvar Projeto', shortcut: 'Ctrl+S', onClick: props.onSaveProject },
      { label: 'Salvar Como (Clonar Projeto)...', onClick: props.onSaveAs, divider: true },
      { label: 'Exportar (MP3 / WAV / FLAC / MIDI / TXT / PDF)...', shortcut: 'Ctrl+E', onClick: props.onExportOpen },
    ],
    Editar: [
      { label: 'Desfazer (Piano Roll / Acordes)', shortcut: 'Ctrl+Z', onClick: props.onUndo, disabled: !props.canUndo },
      { label: 'Refazer', shortcut: 'Ctrl+Y', onClick: props.onRedo, disabled: !props.canRedo, divider: true },
      { label: 'Quantizar Notas em 1/8 (Colcheia)', onClick: () => props.onQuantizeNotes(0.5) },
      { label: 'Quantizar Notas em 1/16 (Semicolcheia)', onClick: () => props.onQuantizeNotes(0.25) },
      { label: 'Transpor Piano Roll +1 Oitava', onClick: () => props.onTransposeNotes(12) },
      { label: 'Transpor Piano Roll -1 Oitava', onClick: () => props.onTransposeNotes(-12), divider: true },
      { label: 'Limpar Seleção Loop A/B', onClick: props.onClearLoop },
      { label: 'Limpar Cache Temporário de Áudio', onClick: props.onClearCache },
    ],
    Exibir: [
      { label: `${props.viewMode === 'waveform' ? '● ' : ''}Waveform Profissional`, onClick: () => props.onViewModeChange('waveform') },
      { label: `${props.viewMode === 'spectrogram' ? '● ' : ''}Espectrograma FFT Real`, onClick: () => props.onViewModeChange('spectrogram') },
      { label: `${props.viewMode === 'split' ? '● ' : ''}Modo Dividido (Wave + Espectrograma)`, onClick: () => props.onViewModeChange('split'), divider: true },
      { label: `${props.showBeats ? '✓ ' : ''}Grade de Batidas e Compassos`, onClick: props.onToggleBeats, divider: true },
      { label: 'Abrir Piano Roll & MIDI', onClick: () => props.onSelectBottomTab('pianoroll') },
      { label: 'Abrir Painel de Acordes & Diagramas', onClick: () => props.onSelectBottomTab('chords') },
      { label: 'Abrir Mixer de Stems (4 Faixas)', onClick: () => props.onSelectBottomTab('stems') },
      { label: 'Abrir Informações & Marcadores', onClick: () => props.onSelectBottomTab('info'), divider: true },
      { label: 'Zoom +', shortcut: '+', onClick: props.onZoomIn },
      { label: 'Zoom −', shortcut: '−', onClick: props.onZoomOut },
      { label: 'Ajustar Zoom à Música', shortcut: '0', onClick: props.onZoomReset },
    ],
    Ferramentas: [
      { label: 'Tap Tempo (Marcar BPM)', shortcut: 'T', onClick: props.onTapTempoClick },
      { label: 'Separar Instrumentos (Vocal/Bateria/Baixo/Outros)', onClick: props.onSeparateStems, divider: true },
      { label: 'Gerenciador de Modelos de IA Offline (ONNX)...', onClick: props.onOpenModels, divider: true },
      { label: 'Diagnóstico do Motor C++17 DSP & Plugins', onClick: () => props.onOpenHelp('diagnostics') },
    ],
    'Análise Musical': [
      { label: 'Executar Análise Musical Completa (IA + DSP)', shortcut: 'Ctrl+Shift+A', onClick: props.onAnalyzeFull, divider: true },
      { label: 'Detectar BPM, Batidas e Compasso', onClick: props.onAnalyzeBpm },
      { label: 'Detectar Tonalidade e Escala', onClick: props.onAnalyzeKey },
      { label: 'Detectar Notas Polifônicas, Melodia e Baixo', onClick: props.onAnalyzeNotes },
      { label: 'Reconhecer Acordes e Cifras (HMM)', onClick: props.onAnalyzeChords },
    ],
    Ajuda: [
      { label: 'Atalhos de Teclado', shortcut: '?', onClick: () => props.onOpenHelp('shortcuts') },
      { label: 'Manual Rápido de Utilização', onClick: () => props.onOpenHelp('manual') },
      { label: 'Diagnóstico & Verificar Atualizações', onClick: () => props.onOpenHelp('diagnostics'), divider: true },
      { label: 'Sobre o MRQ Estudo Musical', onClick: () => props.onOpenHelp('about') },
    ],
  };

  return (
    <header
      ref={barRef}
      className="sticky top-0 z-40 bg-[#0B1120]/95 backdrop-blur border-b border-slate-800/90 select-none"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        {/* Left: MRQ Brand Logo + Menus */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0 pr-1">
            <img src="/mrq-icon.svg" alt="MRQ" className="w-7 h-7 rounded-lg shadow shadow-indigo-500/30" />
            <div className="leading-tight">
              <div className="text-xs font-extrabold tracking-wider text-white">MRQ</div>
              <div className="text-[9px] font-semibold tracking-[0.18em] text-sky-400">ESTUDO MUSICAL</div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-0.5 text-xs">
            {Object.entries(menus).map(([menuName, items]) => (
              <div key={menuName} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === menuName ? null : menuName)}
                  onMouseEnter={() => openMenu && setOpenMenu(menuName)}
                  className={`px-2.5 py-1.5 rounded-md transition flex items-center gap-1 ${
                    openMenu === menuName
                      ? 'bg-slate-800 text-sky-300'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  {menuName}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>
                {openMenu === menuName && (
                  <div className="absolute left-0 top-full mt-1 w-72 rounded-lg bg-[#111827] border border-slate-700/90 shadow-2xl py-1.5 z-50">
                    {items.map((item, idx) => (
                      <React.Fragment key={idx}>
                        <button
                          type="button"
                          disabled={item.disabled}
                          onClick={() => {
                            setOpenMenu(null);
                            item.onClick();
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 text-slate-200 hover:bg-sky-500/15 hover:text-sky-200 disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <span className="truncate">{item.label}</span>
                          {item.shortcut && (
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">{item.shortcut}</span>
                          )}
                        </button>
                        {item.divider && <div className="my-1 border-t border-slate-800" />}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Center: Active Project Indicator & Autosave */}
        <div className="hidden md:flex items-center gap-2 min-w-0 max-w-sm">
          <button
            type="button"
            onClick={props.onOpenProjects}
            title="Abrir / gerenciar projetos"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 truncate"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate font-medium">{props.projectName}</span>
          </button>
          <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0">
            {props.isBusy ? (
              <>
                <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />
                <span className="text-sky-300 max-w-[140px] truncate">{props.busyText}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>{props.autosaveLabel}</span>
              </>
            )}
          </span>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={props.onOpenYouTubeModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow shadow-rose-950/40 transition"
            title="Colar link do YouTube para estudar vídeo com velocidade e Loop A→B"
          >
            <Youtube className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Link YouTube</span>
          </button>

          <button
            type="button"
            onClick={props.onImportClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium border border-slate-700 transition"
            title="Importar MP3, WAV, M4A, FLAC, AAC, OGG ou AIFF"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Importar Áudio</span>
          </button>

          <button
            type="button"
            onClick={props.onAnalyzeFull}
            disabled={props.isBusy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow shadow-indigo-900/40 transition"
            title="Detectar BPM, Tonalidade, Acordes e Notas Polifônicas"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Analisar IA</span>
          </button>

          <button
            type="button"
            onClick={props.onExportOpen}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold transition"
            title="Exportar Áudio, Loop, MIDI, Cifras ou Relatório PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          <button
            type="button"
            onClick={() => props.onOpenHelp('diagnostics')}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-sky-300 border border-slate-800 lg:hidden"
            title="Diagnóstico e Projetos"
          >
            <Activity className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

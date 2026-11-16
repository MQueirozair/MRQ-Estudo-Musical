import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Piano,
  Music,
  Layers,
  Repeat,
  Info,
  Upload,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api } from './api/client';
import { MRQPlaybackEngine } from './audio/playbackEngine';
import type {
  BottomTab,
  DetectedChord,
  LoopItem,
  MarkerItem,
  ProjectData,
  SpectrogramData,
  StemKey,
  StemMixerState,
  TranscribedNote,
  ViewMode,
  WaveformData,
} from './types/music';
import { TopMenuBar } from './components/TopMenuBar';
import { TransportBar } from './components/TransportBar';
import { WaveformCanvas } from './components/WaveformCanvas';
import { SpeedPitchPanel } from './components/SpeedPitchPanel';
import { LoopPanel } from './components/LoopPanel';
import { PianoRoll } from './components/PianoRoll';
import { ChordPanel } from './components/ChordPanel';
import { StemMixerPanel } from './components/StemMixerPanel';
import { TrackInfoPanel } from './components/TrackInfoPanel';
import { ProjectModal } from './components/ProjectModal';
import { ExportModal } from './components/ExportModal';
import { ModelManagerModal } from './components/ModelManagerModal';
import { HelpModals } from './components/HelpModals';

interface HistorySnapshot {
  notes: TranscribedNote[];
  chords: DetectedChord[];
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<MRQPlaybackEngine | null>(null);
  const tapTimesRef = useRef<number[]>([]);

  // Core Project State
  const [project, setProject] = useState<ProjectData | null>(null);
  const [waveform, setWaveform] = useState<WaveformData | null>(null);
  const [spectrogram, setSpectrogram] = useState<SpectrogramData | null>(null);

  // Playback & DSP Parameters
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [semitones, setSemitones] = useState(0);
  const [octaves, setOctaves] = useState(0);
  const [cents, setCents] = useState(0);
  const [precountSec, setPrecountSec] = useState(0);
  const [precountRemaining, setPrecountRemaining] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopA, setLoopA] = useState(0);
  const [loopB, setLoopB] = useState(0);

  // View & Workspace
  const [viewMode, setViewMode] = useState<ViewMode>('waveform');
  const [bottomTab, setBottomTab] = useState<BottomTab>('pianoroll');
  const [showBeats, setShowBeats] = useState(true);
  const [specLogScale, setSpecLogScale] = useState(true);
  const [zoomH, setZoomH] = useState(1);
  const [zoomV, setZoomV] = useState(1);
  const [dragOver, setDragOver] = useState(false);

  // Stems Mixer
  const [stemMixer, setStemMixer] = useState<StemMixerState>({
    enabled: false,
    volumes: { vocals: 1, drums: 1, bass: 1, other: 1 },
    mutes: { vocals: false, drums: false, bass: false, other: false },
    solos: { vocals: false, drums: false, bass: false, other: false },
  });
  const [separatingStems, setSeparatingStems] = useState(false);
  const [stemProgress, setStemProgress] = useState({ pct: 0, msg: '' });

  // Undo/Redo Stack for Piano Roll & Chords
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  // Tap Tempo
  const [tapBpm, setTapBpm] = useState<number | null>(null);

  // Status, Busy & Toasts
  const [isBusy, setIsBusy] = useState(false);
  const [busyText, setBusyText] = useState('');
  const [processingAudio, setProcessingAudio] = useState(false);
  const [autosaveLabel, setAutosaveLabel] = useState('Salvo');
  const [toast, setToast] = useState<{ kind: 'info' | 'error' | 'success'; msg: string } | null>(null);

  // Modals
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const [exportModalState, setExportModalState] = useState<{
    open: boolean;
    scope: 'full' | 'loop' | 'stem' | 'stems_mix';
    stemKey?: StemKey;
  }>({ open: false, scope: 'full' });
  const [modelsModalOpen, setModelsModalOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<'shortcuts' | 'manual' | 'diagnostics' | 'about' | null>(null);

  const showToast = useCallback((kind: 'info' | 'error' | 'success', msg: string) => {
    setToast({ kind, msg });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Initialize Web Audio Playback Engine
  useEffect(() => {
    const eng = new MRQPlaybackEngine({
      onTimeUpdate: (t) => setCurrentTime(t),
      onPlayStateChange: (p) => setIsPlaying(p),
      onPrecountUpdate: (rem) => setPrecountRemaining(rem),
      onLoadingChange: (loading, msg) => {
        setProcessingAudio(loading);
        if (loading && msg) setBusyText(msg);
      },
      onError: (msg) => showToast('error', msg),
    });
    engineRef.current = eng;
    return () => {
      eng.destroy();
      engineRef.current = null;
    };
  }, [showToast]);

  // Load project + waveform + initial audio
  const loadProject = useCallback(
    async (projectId: string) => {
      setIsBusy(true);
      setBusyText('Carregando projeto...');
      try {
        const p = await api.getProject(projectId);
        setProject(p);
        setSpeed(p.speed || 1.0);
        setSemitones(p.semitones || 0);
        setOctaves(p.octaves || 0);
        setCents(p.cents || 0);
        setPrecountSec(p.precount_sec || 0);
        setUndoStack([]);
        setRedoStack([]);
        setSpectrogram(null);
        setZoomH(1);
        setCurrentTime(0);

        if (p.loops.length > 0) {
          setLoopA(p.loops[0].start_sec);
          setLoopB(p.loops[0].end_sec);
          setLoopEnabled(false);
        } else {
          setLoopA(0);
          setLoopB(0);
          setLoopEnabled(false);
        }

        setStemMixer((prev) => ({ ...prev, enabled: false }));
        engineRef.current?.stop();
        engineRef.current?.setOriginalDuration(p.duration_sec || 0);

        if (p.audio_file_path) {
          const wf = await api.getWaveform(p.id, 2400);
          setWaveform(wf);
        } else {
          setWaveform(null);
        }
      } catch (err: any) {
        showToast('error', err?.message || 'Erro ao carregar projeto');
      } finally {
        setIsBusy(false);
        setBusyText('');
      }
    },
    [showToast]
  );

  // Bootstrap: load most recent project (or demo project created automatically by backend)
  useEffect(() => {
    void (async () => {
      try {
        const list = await api.listProjects();
        if (list.projects.length > 0) {
          await loadProject(list.projects[0].id);
          if (list.pending_recovery && list.pending_recovery.length > 0) {
            showToast('info', 'Há uma sessão de recuperação automática disponível em Arquivo → Abrir Projetos.');
          }
        }
      } catch (err: any) {
        showToast('error', `Não foi possível conectar ao motor local: ${err?.message}`);
      }
    })();
  }, [loadProject, showToast]);

  // Reload DSP-processed audio buffer whenever project, speed, semitones, octaves or cents change (debounced)
  const totalSemitones = semitones + octaves * 12;
  useEffect(() => {
    if (!project?.id || !project.audio_file_path) return;
    const timer = window.setTimeout(() => {
      const url = api.audioUrl(project.id, speed, totalSemitones, cents);
      void engineRef.current?.loadMainAudio(url, speed);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [project?.id, project?.audio_file_path, speed, totalSemitones, cents]);

  // Load 4 stems audio buffers when Stem Mixer is enabled
  useEffect(() => {
    engineRef.current?.setStemMixer(stemMixer);
    if (!stemMixer.enabled || !project?.id || !project.analysis?.stems?.stems) return;
    const cacheKey = `${project.id}|${speed}|${totalSemitones}|${cents}`;
    const urls: Record<StemKey, string> = {
      vocals: api.stemAudioUrl(project.id, 'vocals', speed, totalSemitones, cents),
      drums: api.stemAudioUrl(project.id, 'drums', speed, totalSemitones, cents),
      bass: api.stemAudioUrl(project.id, 'bass', speed, totalSemitones, cents),
      other: api.stemAudioUrl(project.id, 'other', speed, totalSemitones, cents),
    };
    void engineRef.current?.loadStems(urls, speed, cacheKey);
  }, [stemMixer, project?.id, project?.analysis?.stems, speed, totalSemitones, cents]);

  // Keep engine synced with Loop, Precount and Volume
  useEffect(() => {
    engineRef.current?.setLoop(loopEnabled, loopA, loopB);
  }, [loopEnabled, loopA, loopB]);

  useEffect(() => {
    engineRef.current?.setPrecount(precountSec);
  }, [precountSec]);

  useEffect(() => {
    engineRef.current?.setVolume(volume, muted);
  }, [volume, muted]);

  // Lazy-compute real C++17 FFT Spectrogram when user switches to spectrogram or split view
  useEffect(() => {
    if (!project?.id || !project.audio_file_path) return;
    if (viewMode === 'waveform') return;
    let cancelled = false;
    setIsBusy(true);
    setBusyText('Calculando espectrograma FFT...');
    api
      .getSpectrogram(project.id, specLogScale, 128)
      .then((sp) => {
        if (!cancelled) setSpectrogram(sp);
      })
      .catch((e) => showToast('error', e?.message || 'Erro no espectrograma'))
      .finally(() => {
        if (!cancelled) {
          setIsBusy(false);
          setBusyText('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id, project?.audio_file_path, viewMode, specLogScale, showToast]);

  // Periodic Autosave Snapshot to SQLite (every 12s while editing)
  useEffect(() => {
    if (!project?.id) return;
    const timer = window.setInterval(() => {
      void api
        .autosave(project.id, {
          speed,
          semitones,
          octaves,
          cents,
          precount_sec: precountSec,
          loopA,
          loopB,
          loopEnabled,
        })
        .then(() => setAutosaveLabel('Autosave OK'))
        .catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, [project?.id, speed, semitones, octaves, cents, precountSec, loopA, loopB, loopEnabled]);

  // Persist speed/pitch/precount edits to SQLite
  const saveProjectParams = useCallback(
    async (patch: Partial<ProjectData>) => {
      if (!project) return;
      setAutosaveLabel('Salvando...');
      try {
        const updated = await api.updateProject(project.id, patch);
        setProject(updated);
        setAutosaveLabel('Salvo');
      } catch (err: any) {
        showToast('error', err?.message || 'Erro ao salvar');
      }
    },
    [project, showToast]
  );

  // Import Audio (Single or Multiple)
  const handleFilesImport = useCallback(
    async (files: FileList | File[]) => {
      if (!files || files.length === 0) return;
      setIsBusy(true);
      setBusyText(`Importando ${files.length} arquivo(s)...`);
      try {
        const res = await api.importAudioFiles(files);
        if (res.imported.length > 0) {
          await loadProject(res.imported[0].id);
          showToast(
            'success',
            res.count > 1
              ? `${res.count} arquivos importados como projetos! Abrindo "${res.imported[0].name}".`
              : `Áudio "${res.imported[0].original_filename}" importado com sucesso.`
          );
        }
      } catch (err: any) {
        showToast('error', err?.message || 'Erro ao importar arquivo de áudio');
      } finally {
        setIsBusy(false);
        setBusyText('');
      }
    },
    [loadProject, showToast]
  );

  // Musical AI Analysis Runners
  const runAnalysis = useCallback(
    async (kind: 'full' | 'bpm' | 'key' | 'notes' | 'chords') => {
      if (!project?.id || !project.audio_file_path) {
        showToast('error', 'Importe um arquivo de áudio primeiro.');
        return;
      }
      const labels = {
        full: 'Executando análise musical completa (BPM, Tom, Acordes e Notas)...',
        bpm: 'Detectando BPM, batidas e compasso...',
        key: 'Detectando tonalidade e escala...',
        notes: 'Transcrevendo notas polifônicas, melodia e baixo...',
        chords: 'Reconhecendo progressão de acordes (HMM)...',
      };
      setIsBusy(true);
      setBusyText(labels[kind]);
      try {
        if (kind === 'full') await api.analyzeFull(project.id);
        else if (kind === 'bpm') await api.analyzeBpm(project.id);
        else if (kind === 'key') await api.analyzeKey(project.id);
        else if (kind === 'notes') await api.analyzeNotes(project.id);
        else if (kind === 'chords') await api.analyzeChords(project.id);

        const fresh = await api.getProject(project.id);
        setProject(fresh);
        showToast('success', 'Análise musical concluída e salva no projeto.');
      } catch (err: any) {
        showToast('error', err?.message || 'Falha na análise musical');
      } finally {
        setIsBusy(false);
        setBusyText('');
      }
    },
    [project, showToast]
  );

  // 4-Stem Separation Runner with real progress polling
  const handleSeparateStems = useCallback(async () => {
    if (!project?.id || !project.audio_file_path) {
      showToast('error', 'Importe um áudio antes de separar stems.');
      return;
    }
    setBottomTab('stems');
    setSeparatingStems(true);
    setStemProgress({ pct: 10, msg: 'Iniciando separação de 4 stems...' });

    const poller = window.setInterval(async () => {
      try {
        const st = await api.stemsStatus(project.id);
        setStemProgress({ pct: st.progress || 15, msg: st.message || 'Processando...' });
      } catch {
        // ignore
      }
    }, 350);

    try {
      await api.separateStems(project.id);
      const fresh = await api.getProject(project.id);
      setProject(fresh);
      setStemProgress({ pct: 100, msg: 'Concluído!' });
      showToast('success', '4 Stems (Vocal, Bateria, Baixo, Outros) separados com sucesso!');
    } catch (err: any) {
      showToast('error', err?.message || 'Erro ao separar stems');
    } finally {
      window.clearInterval(poller);
      setSeparatingStems(false);
    }
  }, [project, showToast]);

  // Notes & Chords Editing with Undo/Redo + SQLite Persistence
  const notesSaveTimer = useRef<number | null>(null);
  const handleNotesChange = useCallback(
    (nextNotes: TranscribedNote[]) => {
      if (!project) return;
      setUndoStack((prev) => [...prev.slice(-24), { notes: project.notes, chords: project.chords }]);
      setRedoStack([]);
      setProject((p) => (p ? { ...p, notes: nextNotes } : p));
      setAutosaveLabel('Salvando notas...');
      if (notesSaveTimer.current) window.clearTimeout(notesSaveTimer.current);
      notesSaveTimer.current = window.setTimeout(() => {
        void api.saveNotes(project.id, nextNotes).then(() => setAutosaveLabel('Salvo'));
      }, 450);
    },
    [project]
  );

  const handleChordsChange = useCallback(
    (nextChords: DetectedChord[]) => {
      if (!project) return;
      setUndoStack((prev) => [...prev.slice(-24), { notes: project.notes, chords: project.chords }]);
      setRedoStack([]);
      setProject((p) => (p ? { ...p, chords: nextChords } : p));
      setAutosaveLabel('Salvando cifras...');
      void api.saveChords(project.id, nextChords).then(() => setAutosaveLabel('Salvo'));
    },
    [project]
  );

  const handleUndo = useCallback(() => {
    if (!project || undoStack.length === 0) return;
    const prevSnap = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, { notes: project.notes, chords: project.chords }]);
    setUndoStack((u) => u.slice(0, -1));
    setProject((p) => (p ? { ...p, notes: prevSnap.notes, chords: prevSnap.chords } : p));
    void api.saveNotes(project.id, prevSnap.notes);
    void api.saveChords(project.id, prevSnap.chords);
  }, [project, undoStack]);

  const handleRedo = useCallback(() => {
    if (!project || redoStack.length === 0) return;
    const nextSnap = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, { notes: project.notes, chords: project.chords }]);
    setRedoStack((r) => r.slice(0, -1));
    setProject((p) => (p ? { ...p, notes: nextSnap.notes, chords: nextSnap.chords } : p));
    void api.saveNotes(project.id, nextSnap.notes);
    void api.saveChords(project.id, nextSnap.chords);
  }, [project, redoStack]);

  // Tap Tempo handler
  const handleTapTempo = useCallback(async () => {
    const now = performance.now() / 1000;
    const list = tapTimesRef.current;
    if (list.length > 0 && now - list[list.length - 1] > 2.2) {
      tapTimesRef.current = [now];
      setTapBpm(null);
      return;
    }
    tapTimesRef.current = [...list.slice(-11), now];
    if (tapTimesRef.current.length >= 2) {
      try {
        const res = await api.tapTempo(tapTimesRef.current);
        if (res.bpm) setTapBpm(Math.round(res.bpm * 10) / 10);
      } catch {
        // local fallback
        const diffs = tapTimesRef.current.slice(1).map((t, i) => t - tapTimesRef.current[i]);
        const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        setTapBpm(Math.round((60 / avg) * 10) / 10);
      }
    }
  }, []);

  // Section Marker Quick Add & Loop from Section
  const handleAddMarkerAt = useCallback(
    async (sec: number) => {
      if (!project) return;
      await api.upsertMarker(project.id, {
        label: `Marcador ${project.markers.length + 1}`,
        section_type: 'Personalizado',
        time_sec: Number(sec.toFixed(3)),
        color: '#A855F7',
        note: '',
      });
      setProject(await api.getProject(project.id));
      showToast('info', 'Marcador adicionado na posição atual.');
    },
    [project, showToast]
  );

  const handleLoopFromMarker = useCallback(
    (mk: MarkerItem) => {
      if (!project) return;
      const sorted = [...project.markers].sort((a, b) => a.time_sec - b.time_sec);
      const idx = sorted.findIndex((m) => m.id === mk.id);
      const endSec =
        mk.end_sec ?? (idx >= 0 && idx + 1 < sorted.length ? sorted[idx + 1].time_sec : project.duration_sec);
      if (endSec > mk.time_sec + 0.1) {
        setLoopA(mk.time_sec);
        setLoopB(endSec);
        setLoopEnabled(true);
        engineRef.current?.seek(mk.time_sec);
        showToast('info', `Loop A/B definido para seção "${mk.label}".`);
      }
    },
    [project, showToast]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        engineRef.current?.togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        engineRef.current?.seek(Math.max(0, currentTime - 5));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        engineRef.current?.seek(Math.min(project?.duration_sec || 0, currentTime + 5));
      } else if (e.key.toLowerCase() === 'l') {
        setLoopEnabled((v) => !v);
      } else if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey) {
        setLoopA(currentTime);
        if (loopB <= currentTime) setLoopB(Math.min(project?.duration_sec || currentTime + 4, currentTime + 4));
        setLoopEnabled(true);
      } else if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey) {
        if (currentTime > loopA + 0.1) {
          setLoopB(currentTime);
          setLoopEnabled(true);
        }
      } else if (e.key.toLowerCase() === 'm') {
        void handleAddMarkerAt(currentTime);
      } else if (e.key.toLowerCase() === 't') {
        void handleTapTempo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveProjectParams({ speed, semitones, octaves, cents, precount_sec: precountSec });
        if (project) void api.markCleanSave(project.id);
        showToast('success', 'Projeto salvo em SQLite.');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === '+' || e.key === '=') {
        setZoomH((z) => Math.min(32, z * 1.4));
      } else if (e.key === '-') {
        setZoomH((z) => Math.max(1, z / 1.4));
      } else if (e.key === '0') {
        setZoomH(1);
      } else if (e.key === '?') {
        setHelpTab('shortcuts');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    currentTime,
    project,
    loopA,
    loopB,
    speed,
    semitones,
    octaves,
    cents,
    precountSec,
    handleAddMarkerAt,
    handleTapTempo,
    saveProjectParams,
    handleUndo,
    handleRedo,
    showToast,
  ]);

  const currentChord = useMemo(() => {
    if (!project?.chords?.length) return null;
    return project.chords.find((c) => currentTime >= c.start_sec && currentTime < c.end_sec) || null;
  }, [project?.chords, currentTime]);

  const handleExportRun = async (payload: Record<string, any>, fallbackName: string) => {
    if (!project) return;
    try {
      const savedName = await api.exportFile(project.id, payload, fallbackName);
      showToast('success', `Exportação concluída: ${savedName}`);
    } catch (err: any) {
      showToast('error', err?.message || 'Erro ao exportar arquivo');
    }
  };

  return (
    <div
      className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col pb-16 lg:pb-3"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) {
          void handleFilesImport(e.dataTransfer.files);
        }
      }}
    >
      {/* Hidden Multi-file Audio Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".mp3,.wav,.m4a,.flac,.aac,.ogg,.aiff,.aif,audio/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            void handleFilesImport(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Full-window Drag & Drop Overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 bg-sky-950/80 backdrop-blur-sm border-4 border-dashed border-sky-400 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <Upload className="w-12 h-12 text-sky-300 animate-bounce" />
          <div className="text-xl font-extrabold text-white">Solte seus arquivos de áudio aqui</div>
          <div className="text-xs text-sky-200">MP3 · WAV · M4A · FLAC · AAC · OGG · AIFF (suporta múltiplos arquivos)</div>
        </div>
      )}

      {/* 1. TOP MENU BAR */}
      <TopMenuBar
        projectName={project?.name || 'MRQ Estudo Musical'}
        autosaveLabel={autosaveLabel}
        isBusy={isBusy || processingAudio || separatingStems}
        busyText={busyText || (separatingStems ? stemProgress.msg : 'Processando DSP...')}
        viewMode={viewMode}
        showBeats={showBeats}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onImportClick={() => fileInputRef.current?.click()}
        onOpenProjects={() => setProjectsModalOpen(true)}
        onNewProject={async () => {
          const created = await api.createProject(`Novo Estudo ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
          await loadProject(created.id);
          showToast('success', 'Novo projeto criado. Importe um arquivo de áudio para começar.');
        }}
        onSaveProject={async () => {
          await saveProjectParams({ speed, semitones, octaves, cents, precount_sec: precountSec });
          if (project) await api.markCleanSave(project.id);
          showToast('success', 'Projeto salvo com sucesso.');
        }}
        onSaveAs={async () => {
          if (!project) return;
          const cloned = await api.cloneProject(project.id, `${project.name} (Cópia)`);
          await loadProject(cloned.id);
          showToast('success', `Projeto duplicado como "${cloned.name}".`);
        }}
        onExportOpen={() => setExportModalState({ open: true, scope: 'full' })}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onQuantizeNotes={(div) => {
          if (!project?.notes.length) return;
          const grid = (60 / (project.bpm || 120)) * div;
          handleNotesChange(
            project.notes.map((n) => ({
              ...n,
              start_sec: Number((Math.round(n.start_sec / grid) * grid).toFixed(4)),
              duration_sec: Number(Math.max(grid * 0.5, Math.round(n.duration_sec / grid) * grid).toFixed(4)),
              edited: true,
            }))
          );
          showToast('info', 'Notas do Piano Roll quantizadas.');
        }}
        onTransposeNotes={(delta) => {
          if (!project?.notes.length) return;
          const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
          handleNotesChange(
            project.notes.map((n) => {
              const p = Math.max(24, Math.min(108, n.pitch + delta));
              return { ...n, pitch: p, note_name: `${names[p % 12]}${Math.floor(p / 12) - 1}`, edited: true };
            })
          );
        }}
        onClearLoop={() => {
          setLoopEnabled(false);
          setLoopA(0);
          setLoopB(0);
        }}
        onClearCache={async () => {
          const r = await api.clearCache();
          showToast('info', `Cache limpo (${r.cleared_temp_files} arquivos temporários removidos).`);
        }}
        onViewModeChange={setViewMode}
        onToggleBeats={() => setShowBeats((v) => !v)}
        onSelectBottomTab={setBottomTab}
        onZoomIn={() => setZoomH((z) => Math.min(32, z * 1.5))}
        onZoomOut={() => setZoomH((z) => Math.max(1, z / 1.5))}
        onZoomReset={() => {
          setZoomH(1);
          setZoomV(1);
        }}
        onOpenModels={() => setModelsModalOpen(true)}
        onAnalyzeFull={() => void runAnalysis('full')}
        onAnalyzeBpm={() => void runAnalysis('bpm')}
        onAnalyzeKey={() => void runAnalysis('key')}
        onAnalyzeNotes={() => void runAnalysis('notes')}
        onAnalyzeChords={() => void runAnalysis('chords')}
        onSeparateStems={() => void handleSeparateStems()}
        onOpenHelp={(t) => setHelpTab(t)}
        onTapTempoClick={() => void handleTapTempo()}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-16 lg:bottom-4 right-4 z-50 max-w-md animate-fade-in">
          <div
            className={`px-3.5 py-2.5 rounded-xl border shadow-2xl flex items-center gap-2 text-xs font-medium ${
              toast.kind === 'error'
                ? 'bg-rose-950/95 border-rose-500/50 text-rose-200'
                : toast.kind === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
                : 'bg-slate-900/95 border-sky-500/50 text-sky-200'
            }`}
          >
            {toast.kind === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            )}
            <span className="flex-1">{toast.msg}</span>
            <button type="button" onClick={() => setToast(null)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 py-3 flex flex-col gap-3">
        {/* Quick Musical Status Ribbon */}
        {project && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                BPM: <strong className="text-sky-300">{project.bpm ? project.bpm : '—'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                Tom: <strong className="text-indigo-300">{project.musical_key || '—'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                Compasso: <strong className="text-amber-300">{project.time_signature || '4/4'}</strong>
              </span>
              <span className="hidden sm:inline px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                {project.sample_rate} Hz · {project.format_name || 'Áudio'} · {project.notes.length} notas ·{' '}
                {project.chords.length} acordes
              </span>
            </div>
            <div className="text-[11px] text-slate-500 hidden md:block">
              100% Local · Motor DSP C++17 · Arraste arquivos de áudio para abrir
            </div>
          </div>
        )}

        {/* 2. CENTRAL WAVEFORM + SPECTROGRAM CANVAS */}
        <WaveformCanvas
          waveform={waveform}
          spectrogram={spectrogram}
          duration={project?.duration_sec || 0}
          currentTime={currentTime}
          viewMode={viewMode}
          showBeats={showBeats}
          beats={project?.analysis?.bpm?.beats || []}
          downbeats={project?.analysis?.bpm?.downbeats || []}
          markers={project?.markers || []}
          chords={project?.chords || []}
          loopEnabled={loopEnabled}
          loopA={loopA}
          loopB={loopB}
          zoomH={zoomH}
          zoomV={zoomV}
          specLogScale={specLogScale}
          onViewModeChange={setViewMode}
          onToggleBeats={() => setShowBeats((v) => !v)}
          onToggleSpecScale={() => setSpecLogScale((v) => !v)}
          onZoomHChange={setZoomH}
          onZoomVChange={setZoomV}
          onSeek={(sec) => engineRef.current?.seek(sec)}
          onLoopChange={(a, b, en) => {
            setLoopA(a);
            setLoopB(b);
            if (en !== undefined) setLoopEnabled(en);
          }}
          onAddMarkerAt={(sec) => void handleAddMarkerAt(sec)}
          onSelectMarkerLoop={handleLoopFromMarker}
        />

        {/* 3. TRANSPORT BAR */}
        <TransportBar
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={project?.duration_sec || 0}
          volume={volume}
          muted={muted}
          loopEnabled={loopEnabled}
          loopA={loopA}
          loopB={loopB}
          precountSec={precountSec}
          precountRemaining={precountRemaining}
          tapBpm={tapBpm}
          currentChordSymbol={currentChord?.symbol || null}
          onTogglePlay={() => engineRef.current?.togglePlay()}
          onStop={() => engineRef.current?.stop()}
          onSeek={(sec) => engineRef.current?.seek(sec)}
          onVolumeChange={(v) => {
            setVolume(v);
            if (muted && v > 0) setMuted(false);
          }}
          onToggleMute={() => setMuted((m) => !m)}
          onToggleLoop={() => {
            if (!loopEnabled && loopB <= loopA + 0.05 && project?.duration_sec) {
              setLoopA(currentTime);
              setLoopB(Math.min(project.duration_sec, currentTime + 4));
            }
            setLoopEnabled((v) => !v);
          }}
          onPrecountChange={(sec) => {
            setPrecountSec(sec);
            void saveProjectParams({ precount_sec: sec });
          }}
          onTapTempo={() => void handleTapTempo()}
          onApplyTapBpm={() => {
            if (tapBpm) {
              void saveProjectParams({ bpm: tapBpm });
              showToast('success', `BPM atualizado para ${tapBpm}.`);
            }
          }}
        />

        {/* 4. SPEED (TIME STRETCHING) & PITCH (TRANSPOSITION) PANELS */}
        <SpeedPitchPanel
          speed={speed}
          semitones={semitones}
          octaves={octaves}
          cents={cents}
          processingAudio={processingAudio}
          onSpeedChange={(spd) => {
            setSpeed(spd);
            void saveProjectParams({ speed: spd });
          }}
          onSemitonesChange={(st) => {
            setSemitones(st);
            void saveProjectParams({ semitones: st });
          }}
          onOctavesChange={(o) => {
            setOctaves(o);
            void saveProjectParams({ octaves: o });
          }}
          onCentsChange={(c) => {
            setCents(c);
            void saveProjectParams({ cents: c });
          }}
          onResetPitch={() => {
            setSemitones(0);
            setOctaves(0);
            setCents(0);
            void saveProjectParams({ semitones: 0, octaves: 0, cents: 0 });
          }}
        />

        {/* 5. TABBED STUDIO DOCK (PIANO ROLL | CHORDS | STEMS | LOOPS | INFO & MARKERS) */}
        <section className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          {/* Desktop Tabs */}
          <div className="px-3 pt-2 bg-[#111827] border-b border-slate-800 flex items-center gap-1 overflow-x-auto">
            {(
              [
                ['pianoroll', `Piano Roll & MIDI (${project?.notes.length || 0})`, Piano],
                ['chords', `Notas & Acordes (${project?.chords.length || 0})`, Music],
                ['stems', 'Separação de Stems (4 Faixas)', Layers],
                ['loops', `Loops A/B (${project?.loops.length || 0})`, Repeat],
                ['info', `Informações & Marcadores (${project?.markers.length || 0})`, Info],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setBottomTab(id)}
                className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
                  bottomTab === id
                    ? 'border-sky-400 text-sky-300 bg-slate-900/60 rounded-t-lg'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="p-3.5">
            {bottomTab === 'pianoroll' && project && (
              <PianoRoll
                notes={project.notes}
                duration={project.duration_sec}
                currentTime={currentTime}
                bpm={project.bpm || 120}
                speed={speed}
                analysisMeta={project.analysis?.notes}
                onNotesChange={handleNotesChange}
                onExportMidi={() => void handleExportRun({ format: 'mid' }, `${project.name}.mid`)}
                onAnalyzeNotes={() => void runAnalysis('notes')}
                onSeek={(sec) => engineRef.current?.seek(sec)}
              />
            )}

            {bottomTab === 'chords' && project && (
              <ChordPanel
                chords={project.chords}
                currentTime={currentTime}
                duration={project.duration_sec}
                analysisMeta={project.analysis?.chords}
                onChordsChange={handleChordsChange}
                onAnalyzeChords={() => void runAnalysis('chords')}
                onSeek={(sec) => engineRef.current?.seek(sec)}
                onExportChordsTxt={() => void handleExportRun({ format: 'txt_chords' }, `${project.name}_cifras.txt`)}
              />
            )}

            {bottomTab === 'stems' && project && (
              <StemMixerPanel
                stemsAnalysis={project.analysis?.stems}
                mixer={stemMixer}
                separating={separatingStems}
                progressPct={stemProgress.pct}
                progressMsg={stemProgress.msg}
                onSeparate={() => void handleSeparateStems()}
                onMixerChange={setStemMixer}
                onExportStem={(k) => setExportModalState({ open: true, scope: 'stem', stemKey: k })}
                onExportCombinedMix={() => setExportModalState({ open: true, scope: 'stems_mix' })}
              />
            )}

            {bottomTab === 'loops' && project && (
              <LoopPanel
                loops={project.loops}
                duration={project.duration_sec}
                currentTime={currentTime}
                loopEnabled={loopEnabled}
                loopA={loopA}
                loopB={loopB}
                speed={speed}
                semitones={totalSemitones}
                cents={cents}
                onSetLoop={(a, b, en) => {
                  setLoopA(a);
                  setLoopB(b);
                  if (en !== undefined) setLoopEnabled(en);
                }}
                onToggleLoop={() => setLoopEnabled((v) => !v)}
                onSaveLoop={async (lp) => {
                  await api.upsertLoop(project.id, lp);
                  setProject(await api.getProject(project.id));
                  showToast('success', 'Loop salvo no projeto.');
                }}
                onDeleteLoop={async (id) => {
                  await api.deleteLoop(project.id, id);
                  setProject(await api.getProject(project.id));
                }}
                onApplySavedLoop={(lp, autoPlay) => {
                  setLoopA(lp.start_sec);
                  setLoopB(lp.end_sec);
                  setLoopEnabled(true);
                  setSpeed(lp.speed || 1.0);
                  setSemitones(lp.semitones || 0);
                  setOctaves(0);
                  setCents(lp.cents || 0);
                  engineRef.current?.setLoop(true, lp.start_sec, lp.end_sec);
                  engineRef.current?.seek(lp.start_sec);
                  if (autoPlay) engineRef.current?.play();
                }}
                onExportLoop={(a, b) => {
                  setLoopA(a);
                  setLoopB(b);
                  setExportModalState({ open: true, scope: 'loop' });
                }}
              />
            )}

            {bottomTab === 'info' && project && (
              <TrackInfoPanel
                project={project}
                currentTime={currentTime}
                onUpdateProject={saveProjectParams}
                onSaveMarker={async (mk) => {
                  await api.upsertMarker(project.id, mk);
                  setProject(await api.getProject(project.id));
                  showToast('success', 'Marcador salvo.');
                }}
                onDeleteMarker={async (id) => {
                  await api.deleteMarker(project.id, id);
                  setProject(await api.getProject(project.id));
                }}
                onSeek={(sec) => engineRef.current?.seek(sec)}
                onLoopSection={handleLoopFromMarker}
                onAnalyzeBpm={() => void runAnalysis('bpm')}
                onAnalyzeKey={() => void runAnalysis('key')}
              />
            )}
          </div>
        </section>
      </main>

      {/* Mobile / Android Bottom Adaptive Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0B1120]/95 backdrop-blur border-t border-slate-800 grid grid-cols-5 text-[10px]">
        {(
          [
            ['pianoroll', 'Piano Roll', Piano],
            ['chords', 'Acordes', Music],
            ['stems', 'Stems', Layers],
            ['loops', 'Loops', Repeat],
            ['info', 'Info', Info],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setBottomTab(id)}
            className={`py-2 flex flex-col items-center gap-0.5 ${
              bottomTab === id ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* MODALS */}
      <ProjectModal
        open={projectsModalOpen}
        currentProjectId={project?.id || null}
        onClose={() => setProjectsModalOpen(false)}
        onSelectProject={(id) => void loadProject(id)}
        onCreateProject={async (name) => {
          const p = await api.createProject(name);
          await loadProject(p.id);
        }}
        onCloneProject={async (id, newName) => {
          const p = await api.cloneProject(id, newName);
          await loadProject(p.id);
        }}
        onDeleteProject={async (id) => {
          await api.deleteProject(id);
          const list = await api.listProjects();
          if (id === project?.id && list.projects.length > 0) {
            await loadProject(list.projects[0].id);
          }
        }}
        onRenameProject={async (id, name) => {
          const updated = await api.updateProject(id, { name });
          if (id === project?.id) setProject(updated);
        }}
        onRecoverSnapshot={async (pid, snap) => {
          await loadProject(pid);
          if (snap.speed) setSpeed(snap.speed);
          if (snap.semitones !== undefined) setSemitones(snap.semitones);
          if (snap.octaves !== undefined) setOctaves(snap.octaves);
          if (snap.cents !== undefined) setCents(snap.cents);
          if (snap.loopB > snap.loopA) {
            setLoopA(snap.loopA);
            setLoopB(snap.loopB);
            setLoopEnabled(Boolean(snap.loopEnabled));
          }
          await api.markCleanSave(pid);
          showToast('success', 'Sessão recuperada com sucesso!');
        }}
      />

      {project && (
        <ExportModal
          open={exportModalState.open}
          project={project}
          speed={speed}
          semitones={semitones}
          octaves={octaves}
          cents={cents}
          loopA={loopA}
          loopB={loopB}
          stemMixer={stemMixer}
          defaultScope={exportModalState.scope}
          defaultStemKey={exportModalState.stemKey}
          onClose={() => setExportModalState((s) => ({ ...s, open: false }))}
          onRunExport={handleExportRun}
        />
      )}

      <ModelManagerModal open={modelsModalOpen} onClose={() => setModelsModalOpen(false)} />

      <HelpModals tab={helpTab} onClose={() => setHelpTab(null)} onChangeTab={(t) => setHelpTab(t)} />
    </div>
  );
}

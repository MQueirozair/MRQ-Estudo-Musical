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
  Youtube,
  Radio,
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
import { YouTubeStudyPlayer, type YouTubeStudyPlayerHandle } from './components/YouTubeStudyPlayer';
import { LocalVideoStage } from './components/LocalVideoStage';
import { AttachAudioBanner } from './components/AttachAudioBanner';
import { SystemAudioCaptureBar } from './components/SystemAudioCaptureBar';
import { YouTubeModal } from './components/YouTubeModal';
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
  const attachAudioInputRef = useRef<HTMLInputElement>(null);
  const captureBarRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MRQPlaybackEngine | null>(null);
  const ytPlayerRef = useRef<YouTubeStudyPlayerHandle | null>(null);
  const tapTimesRef = useRef<number[]>([]);

  // Core Project State
  const [project, setProject] = useState<ProjectData | null>(null);
  const [ytAudioSource, setYtAudioSource] = useState<'youtube' | 'dsp'>('youtube');
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

  // Modals & Docked Tools
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false);
  const [captureBarOpen, setCaptureBarOpen] = useState(false);
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
        ytPlayerRef.current?.stop();
        setIsPlaying(false);
        engineRef.current?.setOriginalDuration(p.duration_sec || 0);

        if (p.source_type === 'youtube') {
          if (p.audio_file_path) {
            setYtAudioSource('dsp');
            const wf = await api.getWaveform(p.id, 2400);
            setWaveform(wf);
          } else {
            setYtAudioSource('youtube');
            setWaveform(null);
          }
        } else if (p.audio_file_path) {
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

  // Reload DSP-processed audio buffer whenever project, audio file, speed, semitones, octaves or cents change (debounced)
  const totalSemitones = semitones + octaves * 12;
  useEffect(() => {
    if (!project?.id || !project.audio_file_path) return;
    const rev = project.audio_file_path;
    const timer = window.setTimeout(() => {
      const url = api.audioUrl(project.id, speed, totalSemitones, cents, rev);
      void engineRef.current?.loadMainAudio(url, speed);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [project?.id, project?.audio_file_path, speed, totalSemitones, cents]);

  // Load 4 stems audio buffers when Stem Mixer is enabled
  useEffect(() => {
    engineRef.current?.setStemMixer(stemMixer);
    if (!stemMixer.enabled || !project?.id || !project.analysis?.stems?.stems) return;
    const rev = project.audio_file_path || '';
    const cacheKey = `${project.id}|${rev}|${speed}|${totalSemitones}|${cents}`;
    const urls: Record<StemKey, string> = {
      vocals: api.stemAudioUrl(project.id, 'vocals', speed, totalSemitones, cents, rev),
      drums: api.stemAudioUrl(project.id, 'drums', speed, totalSemitones, cents, rev),
      bass: api.stemAudioUrl(project.id, 'bass', speed, totalSemitones, cents, rev),
      other: api.stemAudioUrl(project.id, 'other', speed, totalSemitones, cents, rev),
    };
    void engineRef.current?.loadStems(urls, speed, cacheKey);
  }, [stemMixer, project?.id, project?.audio_file_path, project?.analysis?.stems, speed, totalSemitones, cents]);

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
        if (project?.source_type === 'youtube') {
          setBottomTab('stems');
          showToast(
            'info',
            'Para rodar Análise IA neste vídeo do YouTube, clique em "Vincular Áudio (IA/Stems)" ou grave pelo Microfone/Interface.'
          );
        } else {
          showToast('info', 'Importe um arquivo de áudio ou vídeo primeiro.');
        }
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
      showToast(
        'info',
        project?.source_type === 'youtube'
          ? 'Separação em 4 Stems requer arquivo de áudio local (o Player oficial do YouTube não baixa mídia).'
          : 'Importe um áudio antes de separar stems.'
      );
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

  const isYouTubeMode = project?.source_type === 'youtube' && Boolean(project?.youtube_video_id);
  const isLocalVideoMode = project?.source_type === 'video' && Boolean(project?.audio_file_path);
  const hasAudioTrack = Boolean(project?.audio_file_path);
  const useYouTubeClock = isYouTubeMode && (!hasAudioTrack || ytAudioSource === 'youtube');

  const playbackToggle = useCallback(() => {
    if (useYouTubeClock) ytPlayerRef.current?.togglePlay();
    else engineRef.current?.togglePlay();
  }, [useYouTubeClock]);

  const playbackPlay = useCallback(() => {
    if (useYouTubeClock) ytPlayerRef.current?.play();
    else engineRef.current?.play();
  }, [useYouTubeClock]);

  const playbackStop = useCallback(() => {
    if (useYouTubeClock) ytPlayerRef.current?.stop();
    else engineRef.current?.stop();
  }, [useYouTubeClock]);

  const playbackSeek = useCallback(
    (sec: number) => {
      if (useYouTubeClock) ytPlayerRef.current?.seek(sec);
      else engineRef.current?.seek(sec);
    },
    [useYouTubeClock]
  );

  const handleSwitchYtAudioSource = useCallback(
    (nextMode: 'youtube' | 'dsp') => {
      if (nextMode === ytAudioSource) return;
      engineRef.current?.pause();
      ytPlayerRef.current?.pause();
      setIsPlaying(false);
      setYtAudioSource(nextMode);
      if (nextMode === 'dsp') {
        engineRef.current?.seek(currentTime);
        showToast('info', 'Áudio roteado para o Motor DSP C++17 / 4 Stems (vídeo YouTube sincronizado).');
      } else {
        ytPlayerRef.current?.seek(currentTime);
        showToast('info', 'Áudio roteado para o Player Oficial do YouTube.');
      }
    },
    [ytAudioSource, currentTime, showToast]
  );

  const openSystemCapture = useCallback(() => {
    setCaptureBarOpen(true);
    window.setTimeout(() => {
      captureBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }, []);

  // Attach captured system audio (WASAPI loopback / stereo input) to current project or create new project
  const handleCapturedSystemAudio = useCallback(
    async (file: File, meta: { durationSec: number; peakDb: number }) => {
      setIsBusy(true);
      setBusyText('Gerando forma de onda do som capturado...');
      try {
        const targetId = project?.id;
        const res = await api.importAudioFiles([file], targetId);
        if (res.imported.length > 0) {
          const updatedId = res.imported[0].id;
          await loadProject(updatedId);
          setYtAudioSource('dsp');
          showToast(
            'success',
            `Som capturado (${meta.durationSec.toFixed(1)}s · pico ${meta.peakDb.toFixed(1)} dB)! Forma de onda gerada — MP3/WAV/FLAC, IA, Pitch e 4 Stems desbloqueados!`
          );
        }
      } catch (err: any) {
        showToast('error', err?.message || 'Erro ao importar áudio capturado.');
        throw err;
      } finally {
        setIsBusy(false);
        setBusyText('');
      }
    },
    [project?.id, loadProject, showToast]
  );

  // Attach local audio/video or recording onto the CURRENT project (unlocks AI, Pitch & Stems on YouTube!)
  const handleAttachAudioToProject = useCallback(
    async (files: FileList | File[]) => {
      if (!project?.id || !files || files.length === 0) return;
      setIsBusy(true);
      setBusyText('Vinculando áudio ao projeto...');
      try {
        const res = await api.importAudioFiles([Array.from(files)[0]], project.id);
        if (res.imported.length > 0) {
          await loadProject(project.id);
          setYtAudioSource('dsp');
          showToast(
            'success',
            'Áudio vinculado ao vídeo! Forma de onda, IA, Piano Roll, Acordes, Pitch ±12st e 4 Stems desbloqueados.'
          );
        }
      } catch (err: any) {
        showToast('error', err?.message || 'Erro ao vincular áudio ao projeto');
      } finally {
        setIsBusy(false);
        setBusyText('');
      }
    },
    [project?.id, loadProject, showToast]
  );

  // Open YouTube Video OR Direct Video/Audio URL (.mp4, .webm, .mov, .mp3, .wav...)
  const handleOpenVideoUrl = useCallback(
    async (url: string, customName?: string) => {
      setIsBusy(true);
      setBusyText('Carregando link de vídeo...');
      try {
        engineRef.current?.stop();
        const created = await api.createVideoUrlProject(url, customName);
        await loadProject(created.id);
        if (created.source_type === 'video') {
          showToast(
            'success',
            `Vídeo "${created.name}" carregado com DSP C++17, Pitch ±12st, IA e 4 Stems desbloqueados!`
          );
        } else if (created.source_type === 'youtube') {
          showToast('success', `Vídeo do YouTube carregado: "${created.name}".`);
        } else {
          showToast('success', `Áudio online carregado: "${created.name}".`);
        }
      } finally {
        setIsBusy(false);
        setBusyText('');
      }
    },
    [loadProject, showToast]
  );

  // Save real duration reported by YouTube IFrame Player once video loads (only when no local/captured audio defines duration)
  const handleYouTubeDurationReady = useCallback(
    (durSec: number) => {
      if (!project || project.source_type !== 'youtube' || project.audio_file_path || durSec <= 0) return;
      if (Math.abs((project.duration_sec || 0) - durSec) < 0.8) return;
      setProject((prev) => (prev ? { ...prev, duration_sec: durSec } : prev));
      void api.updateProject(project.id, { duration_sec: Number(durSec.toFixed(2)) }).catch(() => {});
    },
    [project]
  );

  // Record Manual Beat (key B) and estimate BPM from recent beats
  const handleAddBeatAt = useCallback(
    async (sec: number) => {
      if (!project) return;
      const t = Number(Math.max(0, sec).toFixed(3));
      const prevBeats = project.manual_beats || [];
      if (prevBeats.some((b) => Math.abs(b - t) < 0.08)) return;
      const nextBeats = [...prevBeats, t].sort((a, b) => a - b);
      let estimatedBpm: number | undefined;
      const recent = nextBeats.filter((b) => Math.abs(b - t) <= 8.0);
      if (recent.length >= 2) {
        const diffs: number[] = [];
        for (let i = 1; i < recent.length; i++) {
          const d = recent[i] - recent[i - 1];
          if (d >= 0.25 && d <= 1.6) diffs.push(d);
        }
        if (diffs.length > 0) {
          const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
          estimatedBpm = Math.round((60 / avg) * 10) / 10;
        }
      }
      const patch: Partial<ProjectData> = {
        manual_beats: nextBeats,
        ...(estimatedBpm ? { bpm: estimatedBpm } : {}),
      };
      setProject((p) => (p ? { ...p, ...patch } : p));
      await api.updateProject(project.id, patch);
      showToast(
        'info',
        estimatedBpm
          ? `Batida marcada (${nextBeats.length} total · ~${estimatedBpm} BPM).`
          : `Batida marcada em ${t.toFixed(2)}s (${nextBeats.length} total).`
      );
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
        playbackSeek(mk.time_sec);
        showToast('info', `Loop A/B definido para seção "${mk.label}".`);
      }
    },
    [project, playbackSeek, showToast]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        playbackToggle();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        playbackSeek(Math.max(0, currentTime - 5));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        playbackSeek(Math.min(project?.duration_sec || 36000, currentTime + 5));
      } else if (e.key.toLowerCase() === 'l') {
        setLoopEnabled((v) => !v);
      } else if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey) {
        setLoopA(currentTime);
        if (loopB <= currentTime) setLoopB(Math.min(project?.duration_sec || currentTime + 4, currentTime + 4));
        setLoopEnabled(true);
      } else if (e.key === ']' || (e.shiftKey && e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey)) {
        if (currentTime > loopA + 0.1) {
          setLoopB(currentTime);
          setLoopEnabled(true);
        }
      } else if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        void handleAddBeatAt(currentTime);
      } else if (e.key.toLowerCase() === 'm') {
        void handleAddMarkerAt(currentTime);
      } else if (e.key.toLowerCase() === 't') {
        void handleTapTempo();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        setYoutubeModalOpen(true);
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
    playbackToggle,
    playbackSeek,
    handleAddBeatAt,
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
      {/* Hidden Multi-file Audio & Video Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".mp3,.wav,.m4a,.flac,.aac,.ogg,.aiff,.aif,.mp4,.webm,.mov,.mkv,.m4v,audio/*,video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            void handleFilesImport(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Hidden Single-file Input to Attach Audio/Video onto CURRENT Project (Hybrid YouTube + DSP/Stems) */}
      <input
        ref={attachAudioInputRef}
        type="file"
        accept=".mp3,.wav,.m4a,.flac,.aac,.ogg,.aiff,.aif,.mp4,.webm,.mov,.mkv,.m4v,audio/*,video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            void handleAttachAudioToProject(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Full-window Drag & Drop Overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 bg-sky-950/80 backdrop-blur-sm border-4 border-dashed border-sky-400 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <Upload className="w-12 h-12 text-sky-300 animate-bounce" />
          <div className="text-xl font-extrabold text-white">Solte seus arquivos de áudio ou vídeo aqui</div>
          <div className="text-xs text-sky-200">
            MP3 · WAV · M4A · FLAC · AAC · OGG · AIFF · MP4 · WebM · MOV · MKV
          </div>
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
        onOpenYouTubeModal={() => setYoutubeModalOpen(true)}
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
        <div className="fixed top-14 right-4 z-50 max-w-md animate-fade-in">
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
        {/* Quick Musical Status Ribbon (Local Audio Mode) */}
        {project && !isYouTubeMode && (
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openSystemCapture}
                className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/45 text-emerald-200 text-[11px] font-semibold flex items-center gap-1.5 transition"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>Capturar Som do Sistema</span>
              </button>
              <button
                type="button"
                onClick={() => setYoutubeModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/40 text-rose-200 text-[11px] font-semibold flex items-center gap-1.5 transition"
              >
                <Youtube className="w-3.5 h-3.5 text-rose-400" />
                <span>Estudar Vídeo do YouTube</span>
              </button>
              <div className="text-[11px] text-slate-500 hidden xl:block">
                100% Local · Motor DSP C++17 · Arraste arquivos de áudio
              </div>
            </div>
          </div>
        )}

        {/* 2. CENTRAL STAGE: YOUTUBE PLAYER, LOCAL/DIRECT VIDEO PLAYER, AND/OR WAVEFORM + SPECTROGRAM */}
        {isYouTubeMode && project?.youtube_video_id && (
          <YouTubeStudyPlayer
            ref={ytPlayerRef}
            videoId={project.youtube_video_id}
            videoUrl={project.youtube_url}
            title={project.name}
            channel={project.youtube_channel}
            duration={project.duration_sec || 0}
            bpm={project.bpm}
            musicalKey={project.musical_key}
            currentTime={currentTime}
            isPlaying={isPlaying}
            speed={speed}
            volume={volume}
            muted={muted}
            loopEnabled={loopEnabled}
            loopA={loopA}
            loopB={loopB}
            precountSec={precountSec}
            markers={project.markers || []}
            manualBeats={project.manual_beats || []}
            hasAttachedAudio={hasAudioTrack}
            audioSourceMode={ytAudioSource}
            onAudioSourceModeChange={handleSwitchYtAudioSource}
            onAttachAudioToVideo={() => attachAudioInputRef.current?.click()}
            onOpenSystemCapture={openSystemCapture}
            onTimeUpdate={setCurrentTime}
            onSeekRequest={playbackSeek}
            onDurationReady={handleYouTubeDurationReady}
            onPlayStateChange={setIsPlaying}
            onPrecountTick={setPrecountRemaining}
            onLoopChange={(a, b, en) => {
              setLoopA(a);
              setLoopB(b);
              if (en !== undefined) setLoopEnabled(en);
            }}
            onSeekMarkerLoop={handleLoopFromMarker}
            onOpenYouTubeModal={() => setYoutubeModalOpen(true)}
            onOpenLocalAudio={() => fileInputRef.current?.click()}
          />
        )}

        {/* DOCKED SYSTEM AUDIO CAPTURE BAR (WASAPI Stereo Loopback + Selectable Device + Live VU Meter) */}
        <div ref={captureBarRef}>
          <SystemAudioCaptureBar
            open={captureBarOpen}
            onClose={() => setCaptureBarOpen(false)}
            onCapturedFile={handleCapturedSystemAudio}
          />
        </div>

        {isLocalVideoMode && project && (
          <LocalVideoStage
            videoUrl={api.videoUrl(project.id)}
            title={project.name}
            sourceUrl={project.youtube_url}
            duration={project.duration_sec || 0}
            bpm={project.bpm}
            musicalKey={project.musical_key}
            currentTime={currentTime}
            isPlaying={isPlaying}
            speed={speed}
            onOpenVideoModal={() => setYoutubeModalOpen(true)}
            onOpenLocalFile={() => fileInputRef.current?.click()}
          />
        )}

        {(!isYouTubeMode || hasAudioTrack) && (
          <WaveformCanvas
            waveform={waveform}
            spectrogram={spectrogram}
            duration={project?.duration_sec || 0}
            currentTime={currentTime}
            viewMode={viewMode}
            showBeats={showBeats}
            beats={
              (project?.analysis?.bpm?.beats?.length ? project.analysis.bpm.beats : project?.manual_beats) || []
            }
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
            onSeek={playbackSeek}
            onLoopChange={(a, b, en) => {
              setLoopA(a);
              setLoopB(b);
              if (en !== undefined) setLoopEnabled(en);
            }}
            onAddMarkerAt={(sec) => void handleAddMarkerAt(sec)}
            onSelectMarkerLoop={handleLoopFromMarker}
          />
        )}

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
          onTogglePlay={playbackToggle}
          onStop={playbackStop}
          onSeek={playbackSeek}
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
          onAddMarkerNow={() => void handleAddMarkerAt(currentTime)}
          onAddBeatNow={() => void handleAddBeatAt(currentTime)}
        />

        {/* 4. SPEED (TIME STRETCHING) & PITCH (TRANSPOSITION) PANELS */}
        <SpeedPitchPanel
          speed={speed}
          semitones={semitones}
          octaves={octaves}
          cents={cents}
          processingAudio={processingAudio}
          isYouTubeMode={useYouTubeClock}
          onOpenLocalAudio={() =>
            isYouTubeMode ? attachAudioInputRef.current?.click() : fileInputRef.current?.click()
          }
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
              <>
                {isYouTubeMode && !hasAudioTrack && (
                  <AttachAudioBanner
                    variant="compact"
                    contextLabel="Piano Roll & MIDI sincronizado ao vídeo do YouTube"
                    onOpenSystemCapture={openSystemCapture}
                    onAttachLocalAudio={() => attachAudioInputRef.current?.click()}
                    onOpenDirectVideoModal={() => setYoutubeModalOpen(true)}
                  />
                )}
                <PianoRoll
                  notes={project.notes}
                  duration={project.duration_sec || 60}
                  currentTime={currentTime}
                  bpm={project.bpm || 120}
                  speed={speed}
                  analysisMeta={project.analysis?.notes}
                  onNotesChange={handleNotesChange}
                  onExportMidi={() => void handleExportRun({ format: 'mid' }, `${project.name}.mid`)}
                  onAnalyzeNotes={() => void runAnalysis('notes')}
                  onSeek={playbackSeek}
                />
              </>
            )}

            {bottomTab === 'chords' && project && (
              <>
                {isYouTubeMode && !hasAudioTrack && (
                  <AttachAudioBanner
                    variant="compact"
                    contextLabel="Notas, Acordes e Diagramas de Violão/Teclado sincronizados ao vídeo"
                    onOpenSystemCapture={openSystemCapture}
                    onAttachLocalAudio={() => attachAudioInputRef.current?.click()}
                    onOpenDirectVideoModal={() => setYoutubeModalOpen(true)}
                  />
                )}
                <ChordPanel
                  chords={project.chords}
                  currentTime={currentTime}
                  duration={project.duration_sec || 60}
                  analysisMeta={project.analysis?.chords}
                  onChordsChange={handleChordsChange}
                  onAnalyzeChords={() => void runAnalysis('chords')}
                  onSeek={playbackSeek}
                  onExportChordsTxt={() => void handleExportRun({ format: 'txt_chords' }, `${project.name}_cifras.txt`)}
                />
              </>
            )}

            {bottomTab === 'stems' && project && (
              hasAudioTrack ? (
                <StemMixerPanel
                  stemsAnalysis={project.analysis?.stems}
                  mixer={stemMixer}
                  separating={separatingStems}
                  progressPct={stemProgress.pct}
                  progressMsg={stemProgress.msg}
                  onSeparate={() => void handleSeparateStems()}
                  onMixerChange={(nextMixer) => {
                    setStemMixer(nextMixer);
                    if (isYouTubeMode && nextMixer.enabled && ytAudioSource !== 'dsp') {
                      handleSwitchYtAudioSource('dsp');
                    }
                  }}
                  onExportStem={(k) => setExportModalState({ open: true, scope: 'stem', stemKey: k })}
                  onExportCombinedMix={() => setExportModalState({ open: true, scope: 'stems_mix' })}
                />
              ) : (
                <AttachAudioBanner
                  variant="full"
                  contextLabel="Separação de Stems (4 Faixas) & Análise IA para Vídeo"
                  onOpenSystemCapture={openSystemCapture}
                  onAttachLocalAudio={() => attachAudioInputRef.current?.click()}
                  onOpenDirectVideoModal={() => setYoutubeModalOpen(true)}
                />
              )
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
                  if (hasAudioTrack) {
                    setSemitones(lp.semitones || 0);
                    setOctaves(0);
                    setCents(lp.cents || 0);
                    engineRef.current?.setLoop(true, lp.start_sec, lp.end_sec);
                  }
                  playbackSeek(lp.start_sec);
                  if (autoPlay) playbackPlay();
                }}
                onExportLoop={(a, b) => {
                  if (!hasAudioTrack) {
                    showToast('info', 'Vincule um áudio/vídeo local ou gravação ao projeto para exportar o trecho de áudio.');
                    return;
                  }
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
                onSeek={playbackSeek}
                onLoopSection={handleLoopFromMarker}
                onAnalyzeBpm={() => {
                  if (!hasAudioTrack) {
                    showToast('info', 'Use a tecla B / Tap ou vincule um áudio/vídeo ao projeto para detecção automática de BPM.');
                    return;
                  }
                  void runAnalysis('bpm');
                }}
                onAnalyzeKey={() => {
                  if (!hasAudioTrack) {
                    showToast('info', 'Vincule um áudio/vídeo local ou gravação ao projeto para detectar a tonalidade automaticamente.');
                    return;
                  }
                  void runAnalysis('key');
                }}
              />
            )}
          </div>
        </section>

        {/* Bottom Keyboard Shortcut Helper Ribbon (TuneTranscriber v3 style) */}
        <footer className="hidden sm:flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500 py-1">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]">
              space
            </kbd>{' '}
            reproduzir
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]">
              m
            </kbd>{' '}
            marca
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]">
              b
            </kbd>{' '}
            batida
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]">
              l
            </kbd>{' '}
            loop A/B
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]">
              ← →
            </kbd>{' '}
            ±5s
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]">
              a
            </kbd>{' '}
            /{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]">
              ]
            </kbd>{' '}
            pontos A/B
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]">
              Ctrl+Shift+Y
            </kbd>{' '}
            YouTube
          </span>
        </footer>
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
          onAttachLocalAudio={() => attachAudioInputRef.current?.click()}
          onOpenSystemCapture={openSystemCapture}
          onRunExport={handleExportRun}
        />
      )}

      <ModelManagerModal open={modelsModalOpen} onClose={() => setModelsModalOpen(false)} />

      <YouTubeModal
        open={youtubeModalOpen}
        onClose={() => setYoutubeModalOpen(false)}
        onSubmitVideoUrl={handleOpenVideoUrl}
        onChooseLocalMedia={() => fileInputRef.current?.click()}
      />

      <HelpModals tab={helpTab} onClose={() => setHelpTab(null)} onChangeTab={(t) => setHelpTab(t)} />
    </div>
  );
}

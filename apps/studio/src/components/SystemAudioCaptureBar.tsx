import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileAudio,
  Loader2,
  Mic,
  Play,
  Radio,
  RefreshCw,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import {
  MRQAudioCaptureSession,
  isDesktopElectron,
  listAudioInputDevices,
  type AudioInputDeviceOption,
  type CaptureLevelInfo,
  type CaptureSourceMode,
} from '../utils/audioCapture';

export type AutoExportAudioFormat = 'none' | 'mp3' | 'wav' | 'flac' | 'm4a' | 'ogg' | 'aac' | 'aiff';

const AUDIO_FORMAT_CHOICES: Array<{ id: AutoExportAudioFormat; label: string; short: string }> = [
  { id: 'mp3', label: 'MP3 (192 kbps — Universal)', short: 'MP3' },
  { id: 'wav', label: 'WAV (PCM 16-bit — Sem Perdas)', short: 'WAV' },
  { id: 'flac', label: 'FLAC (Lossless Comprimido)', short: 'FLAC' },
  { id: 'm4a', label: 'M4A (AAC — iPhone/Mac/PC)', short: 'M4A' },
  { id: 'ogg', label: 'OGG (Opus 48 kHz — Leve)', short: 'OGG' },
  { id: 'aac', label: 'AAC (ADTS Streaming)', short: 'AAC' },
  { id: 'aiff', label: 'AIFF (PCM Estúdio)', short: 'AIFF' },
  { id: 'none', label: 'Somente importar no Estúdio (Forma de Onda + IA)', short: 'Estúdio' },
];

interface SystemAudioCaptureBarProps {
  open: boolean;
  isYouTubeMode: boolean;
  hasAttachedAudio: boolean;
  videoDuration: number;
  videoCurrentTime: number;
  videoEndSignal: number;
  onClose: () => void;
  onStartFullVideoPlayback?: () => void;
  onPauseVideoPlayback?: () => void;
  onCapturedFile: (
    file: File,
    meta: { durationSec: number; peakDb: number; autoFormat: AutoExportAudioFormat }
  ) => Promise<void>;
  onQuickConvertAttached?: (fmt: Exclude<AutoExportAudioFormat, 'none'>) => Promise<void>;
}

export const SystemAudioCaptureBar: React.FC<SystemAudioCaptureBarProps> = ({
  open,
  isYouTubeMode,
  hasAttachedAudio,
  videoDuration,
  videoCurrentTime,
  videoEndSignal,
  onClose,
  onStartFullVideoPlayback,
  onPauseVideoPlayback,
  onCapturedFile,
  onQuickConvertAttached,
}) => {
  const [sourceMode, setSourceMode] = useState<CaptureSourceMode>('system');
  const [autoFormat, setAutoFormat] = useState<AutoExportAudioFormat>('mp3');
  const [devices, setDevices] = useState<AudioInputDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  const [recording, setRecording] = useState(false);
  const [fullVideoAutoMode, setFullVideoAutoMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quickConvertingFmt, setQuickConvertingFmt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<CaptureLevelInfo>({
    elapsedSec: 0,
    leftPct: 0,
    rightPct: 0,
    peakDb: -96,
    hasSignal: false,
  });

  const sessionRef = useRef<MRQAudioCaptureSession | null>(null);
  const autoStopHandledRef = useRef<number>(videoEndSignal);
  const stoppingRef = useRef(false);

  const refreshDevices = async () => {
    const list = await listAudioInputDevices();
    setDevices(list);
    if (list.length > 0 && !list.some((d) => d.deviceId === selectedDeviceId)) {
      setSelectedDeviceId(list[0].deviceId);
    }
  };

  useEffect(() => {
    if (open) {
      void refreshDevices();
      autoStopHandledRef.current = videoEndSignal;
    }
    return () => {
      sessionRef.current?.dispose();
      sessionRef.current = null;
    };
  }, [open]);

  const handleStopAndSave = useCallback(async () => {
    const cap = sessionRef.current;
    if (!cap || stoppingRef.current) return;
    stoppingRef.current = true;
    setRecording(false);
    setFullVideoAutoMode(false);
    onPauseVideoPlayback?.();

    const res = cap.stop(sourceMode);
    sessionRef.current = null;

    if (res.silent || !res.file) {
      stoppingRef.current = false;
      setError(
        sourceMode === 'system'
          ? 'Nenhum som foi captado (gravação muda). Certifique-se de que o vídeo está tocando e que o volume de saída do Windows não esteja mudo.'
          : 'Nenhum som foi captado nesta entrada (microfone/interface mudo). Troque para "Som do Sistema (Saída)" acima ou selecione outro dispositivo.'
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onCapturedFile(res.file, {
        durationSec: res.durationSec,
        peakDb: res.peakDb,
        autoFormat,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar e converter o áudio capturado.');
    } finally {
      setSaving(false);
      stoppingRef.current = false;
    }
  }, [autoFormat, onCapturedFile, onClose, onPauseVideoPlayback, sourceMode]);

  // Automatically finalize Full-Video Capture when YouTube IFrame Player signals video ENDED!
  useEffect(() => {
    if (!recording || !fullVideoAutoMode) {
      autoStopHandledRef.current = videoEndSignal;
      return;
    }
    if (videoEndSignal !== autoStopHandledRef.current) {
      autoStopHandledRef.current = videoEndSignal;
      // Keep a tiny 600ms tail so the very last note/reverb decays naturally
      const t = window.setTimeout(() => {
        void handleStopAndSave();
      }, 600);
      return () => window.clearTimeout(t);
    }
  }, [videoEndSignal, recording, fullVideoAutoMode, handleStopAndSave]);

  if (!open) return null;

  const startCapture = async (autoFullVideo: boolean) => {
    setError(null);
    stoppingRef.current = false;
    const cap = new MRQAudioCaptureSession();
    sessionRef.current = cap;
    try {
      setLevel({ elapsedSec: 0, leftPct: 0, rightPct: 0, peakDb: -96, hasSignal: false });
      await cap.start(sourceMode, selectedDeviceId, (info) => setLevel(info));
      autoStopHandledRef.current = videoEndSignal;
      setFullVideoAutoMode(autoFullVideo);
      setRecording(true);
      if (sourceMode === 'device') {
        void refreshDevices();
      }
      if (autoFullVideo && onStartFullVideoPlayback) {
        // Short 250ms buffer so WASAPI loopback stream is settled before 0:00 plays
        window.setTimeout(() => {
          onStartFullVideoPlayback();
        }, 250);
      }
    } catch (err: any) {
      cap.dispose();
      sessionRef.current = null;
      setRecording(false);
      setFullVideoAutoMode(false);
      setError(err?.message || 'Não foi possível iniciar a captura de áudio.');
    }
  };

  const fmtSec = (s: number) => {
    const safe = Math.max(0, s);
    const mins = Math.floor(safe / 60);
    const rem = safe % 60;
    return `${String(mins).padStart(2, '0')}:${rem.toFixed(1).padStart(4, '0')}`;
  };

  const fullProgressPct =
    fullVideoAutoMode && videoDuration > 1
      ? Math.max(0, Math.min(100, Math.round((videoCurrentTime / videoDuration) * 100)))
      : 0;

  return (
    <section className="bg-gradient-to-r from-[#0F172A] via-[#121D34] to-[#0F172A] border border-emerald-500/50 rounded-2xl p-4 shadow-xl space-y-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Radio className={`w-4 h-4 text-emerald-400 ${recording ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex flex-wrap items-center gap-2">
              <span>Conversor &amp; Captura Completa de Vídeo → Áudio (Forma de Onda + IA + Stems)</span>
              {isDesktopElectron() && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-bold uppercase">
                  WASAPI Estéreo
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Escolha o formato final abaixo e clique em{' '}
              <strong className="text-emerald-300">Capturar Vídeo Completo (0:00 → Fim)</strong>: o programa volta o vídeo
              para o início, grava todo o áudio estéreo automaticamente, gera a Forma de Onda e já baixa o arquivo
              convertido!
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={recording || saving}
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition"
          title="Fechar painel de captura"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Step 1 & Step 2 Row: Audio Source + Target Export Format */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* Source Selector */}
        <div className="rounded-xl bg-slate-950/75 border border-slate-800 p-2.5 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            1. Fonte do Áudio (Estéreo)
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              disabled={recording || saving}
              onClick={() => {
                setSourceMode('system');
                setError(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                sourceMode === 'system'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Som do Sistema (Saída / Placa)</span>
            </button>
            <button
              type="button"
              disabled={recording || saving}
              onClick={() => {
                setSourceMode('device');
                setError(null);
                void refreshDevices();
              }}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                sourceMode === 'device'
                  ? 'bg-sky-500 text-slate-950 shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Microfone / Interface / Mixagem</span>
            </button>
          </div>

          {sourceMode === 'device' && (
            <div className="flex items-center gap-1.5">
              <select
                disabled={recording || saving}
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              >
                {devices.length === 0 ? (
                  <option value="default">Entrada de áudio padrão</option>
                ) : (
                  devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                disabled={recording || saving}
                onClick={() => void refreshDevices()}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Atualizar lista de dispositivos"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Target Format Selector */}
        <div className="rounded-xl bg-slate-950/75 border border-slate-800 p-2.5 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileAudio className="w-3.5 h-3.5 text-sky-400" />
            <span>2. Formato para Converter &amp; Baixar Automaticamente ao Terminar</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {AUDIO_FORMAT_CHOICES.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={recording || saving}
                onClick={() => setAutoFormat(f.id)}
                title={f.label}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                  autoFormat === f.id
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'
                }`}
              >
                {f.short}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-slate-400">
            Selecionado:{' '}
            <strong className="text-sky-300">
              {AUDIO_FORMAT_CHOICES.find((x) => x.id === autoFormat)?.label}
            </strong>
          </div>
        </div>
      </div>

      {/* Step 3 Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {!recording ? (
            <>
              {isYouTubeMode && onStartFullVideoPlayback && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void startCapture(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando &amp; Convertendo...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        Capturar Vídeo Completo (0:00 → Fim)
                        {autoFormat !== 'none' ? ` e Converter em ${autoFormat.toUpperCase()}` : ''}
                      </span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() => void startCapture(false)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition disabled:opacity-50 ${
                  isYouTubeMode && onStartFullVideoPlayback
                    ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                }`}
              >
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>
                  {isYouTubeMode ? 'Capturar Trecho Manual' : 'Iniciar Captura Estéreo'}
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void handleStopAndSave()}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-rose-950/50 transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>
                Parar &amp; {autoFormat !== 'none' ? `Converter para ${autoFormat.toUpperCase()}` : 'Gerar Forma de Onda'}{' '}
                ({fmtSec(level.elapsedSec)})
              </span>
            </button>
          )}
        </div>

        {/* Instant 1-Click Re-Convert Bar when audio is already attached */}
        {!recording && !saving && hasAttachedAudio && onQuickConvertAttached && (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1 flex items-center gap-1">
              <Download className="w-3 h-3 text-emerald-400" />
              Baixar Áudio Atual:
            </span>
            {(['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac', 'aiff'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                disabled={quickConvertingFmt !== null}
                onClick={async () => {
                  setQuickConvertingFmt(fmt);
                  try {
                    await onQuickConvertAttached(fmt);
                  } finally {
                    setQuickConvertingFmt(null);
                  }
                }}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-[10px] font-bold uppercase transition disabled:opacity-50"
              >
                {quickConvertingFmt === fmt ? '...' : fmt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live Stereo VU Meter + Full-Video Auto Progress Bar while recording */}
      {recording && (
        <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="font-mono font-bold text-white">{fmtSec(level.elapsedSec)}</span>
              {fullVideoAutoMode && videoDuration > 1 && (
                <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-mono font-semibold">
                  Vídeo Completo: {fmtSec(videoCurrentTime)} / {fmtSec(videoDuration)} ({fullProgressPct}%)
                </span>
              )}
              {level.hasSignal ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sinal Estéreo OK ({level.peakDb.toFixed(1)} dB)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Aguardando som... confirme o volume do vídeo!
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              {fullVideoAutoMode
                ? `Finalizará e converterá em ${autoFormat === 'none' ? 'Forma de Onda' : autoFormat.toUpperCase()} ao fim do vídeo`
                : 'Clique em Parar quando desejar finalizar'}
            </span>
          </div>

          {fullVideoAutoMode && videoDuration > 1 && (
            <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 transition-all duration-200"
                style={{ width: `${Math.max(2, fullProgressPct)}%` }}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500 w-3">L</span>
              <div className="flex-1 h-2 rounded-full bg-slate-900 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-400 transition-all duration-75"
                  style={{ width: `${Math.max(2, level.leftPct)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500 w-3">R</span>
              <div className="flex-1 h-2 rounded-full bg-slate-900 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-400 transition-all duration-75"
                  style={{ width: `${Math.max(2, level.rightPct)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </section>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mic,
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

interface SystemAudioCaptureBarProps {
  open: boolean;
  onClose: () => void;
  onCapturedFile: (file: File, meta: { durationSec: number; peakDb: number }) => Promise<void>;
}

export const SystemAudioCaptureBar: React.FC<SystemAudioCaptureBarProps> = ({
  open,
  onClose,
  onCapturedFile,
}) => {
  const [sourceMode, setSourceMode] = useState<CaptureSourceMode>('system');
  const [devices, setDevices] = useState<AudioInputDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<CaptureLevelInfo>({
    elapsedSec: 0,
    leftPct: 0,
    rightPct: 0,
    peakDb: -96,
    hasSignal: false,
  });

  const sessionRef = useRef<MRQAudioCaptureSession | null>(null);

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
    }
    return () => {
      sessionRef.current?.dispose();
      sessionRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  const handleStart = async () => {
    setError(null);
    const cap = new MRQAudioCaptureSession();
    sessionRef.current = cap;
    try {
      setLevel({ elapsedSec: 0, leftPct: 0, rightPct: 0, peakDb: -96, hasSignal: false });
      await cap.start(sourceMode, selectedDeviceId, (info) => setLevel(info));
      setRecording(true);
      if (sourceMode === 'device') {
        void refreshDevices();
      }
    } catch (err: any) {
      cap.dispose();
      sessionRef.current = null;
      setRecording(false);
      setError(err?.message || 'Não foi possível iniciar a captura de áudio.');
    }
  };

  const handleStopAndSave = async () => {
    const cap = sessionRef.current;
    if (!cap) return;
    setRecording(false);
    const res = cap.stop(sourceMode);
    sessionRef.current = null;

    if (res.silent || !res.file) {
      setError(
        sourceMode === 'system'
          ? 'Nenhum som foi captado (gravação muda). Certifique-se de dar PLAY no vídeo/música e que o volume de saída do Windows não esteja mudo.'
          : 'Nenhum som foi captado nesta entrada (microfone/interface mudo). Troque para "Som do Sistema (Saída)" acima ou selecione outro dispositivo.'
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onCapturedFile(res.file, { durationSec: res.durationSec, peakDb: res.peakDb });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar e gerar forma de onda do áudio capturado.');
    } finally {
      setSaving(false);
    }
  };

  const fmtSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(mins).padStart(2, '0')}:${rem.toFixed(1).padStart(4, '0')}`;
  };

  return (
    <section className="bg-gradient-to-r from-[#0F172A] via-[#121D34] to-[#0F172A] border border-emerald-500/45 rounded-2xl p-3.5 shadow-xl space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
            <Radio className={`w-4 h-4 text-emerald-400 ${recording ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>Capturar Som do Sistema (Saída Estéreo) → Forma de Onda, IA, Stems e MP3/WAV/FLAC</span>
              {isDesktopElectron() && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-bold uppercase">
                  WASAPI Loopback
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400">
              Dê <strong>Play no vídeo acima</strong>, clique em <strong>Iniciar Captura</strong> para gravar o som que
              sai do seu computador em Estéreo e depois clique em <strong>Parar &amp; Gerar Forma de Onda</strong>.
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

      {/* Controls Row */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Source Mode Switcher */}
        <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 p-1 text-xs">
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
                : 'text-slate-400 hover:text-white'
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
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Microfone / Interface / Mixagem</span>
          </button>
        </div>

        {/* Specific Device Picker when in 'device' mode */}
        {sourceMode === 'device' && (
          <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
            <select
              disabled={recording || saving}
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
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
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Atualizar lista de dispositivos"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Start / Stop CTA */}
        <div className="ml-auto flex items-center gap-2">
          {!recording ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleStart()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando Forma de Onda...</span>
                </>
              ) : (
                <>
                  <Radio className="w-4 h-4" />
                  <span>Iniciar Captura</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleStopAndSave()}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-rose-950/50 transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Parar &amp; Gerar Forma de Onda ({fmtSec(level.elapsedSec)})</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Stereo VU Meter while recording */}
      {recording && (
        <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="font-mono font-bold text-white">{fmtSec(level.elapsedSec)}</span>
              {level.hasSignal ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sinal Estéreo OK ({level.peakDb.toFixed(1)} dB)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Aguardando som... dê Play no vídeo acima!
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              Fonte: {sourceMode === 'system' ? 'Saída de Som do Sistema (Estéreo)' : 'Entrada Selecionada'}
            </span>
          </div>

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

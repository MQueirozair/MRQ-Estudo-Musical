import React, { useEffect, useRef, useState } from 'react';
import {
  Film,
  FolderOpen,
  Link2,
  Loader2,
  Mic,
  ShieldCheck,
  Sparkles,
  Square,
  Upload,
} from 'lucide-react';

interface AttachAudioBannerProps {
  variant: 'full' | 'compact';
  contextLabel: string;
  onAttachLocalAudio: () => void;
  onAttachRecordedFile: (file: File) => Promise<void>;
  onOpenDirectVideoModal: () => void;
}

/** Encodes mono Float32 PCM chunks into a standard 16-bit PCM WAV Blob. */
function encodeWavBlob(chunks: Float32Array[], sampleRate: number): Blob {
  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const buffer = new ArrayBuffer(44 + totalLen * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + totalLen * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, totalLen * 2, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export const AttachAudioBanner: React.FC<AttachAudioBannerProps> = ({
  variant,
  contextLabel,
  onAttachLocalAudio,
  onAttachRecordedFile,
  onOpenDirectVideoModal,
}) => {
  const [recording, setRecording] = useState(false);
  const [uploadingRec, setUploadingRec] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [levelPct, setLevelPct] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const srRef = useRef<number>(44100);
  const timerRef = useRef<number | null>(null);

  const cleanupMic = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      procRef.current?.disconnect();
    } catch {
      // ignore
    }
    procRef.current = null;
    try {
      ctxRef.current?.close();
    } catch {
      // ignore
    }
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLevelPct(0);
  };

  useEffect(() => cleanupMic, []);

  const startRecording = async () => {
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Captura de microfone/interface não disponível neste ambiente.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      ctxRef.current = ctx;
      srRef.current = ctx.sampleRate || 44100;
      chunksRef.current = [];

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      procRef.current = processor;

      processor.onaudioprocess = (ev) => {
        const data = ev.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(data));
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        setLevelPct(Math.min(100, Math.round(rms * 380)));
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setElapsedSec(0);
      setRecording(true);
      const started = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsedSec((Date.now() - started) / 1000);
      }, 200);
    } catch (err: any) {
      cleanupMic();
      setMicError(err?.message || 'Permissão negada ou nenhum microfone/interface de áudio encontrado.');
    }
  };

  const stopAndAttachRecording = async () => {
    const chunks = chunksRef.current;
    const sr = srRef.current;
    setRecording(false);
    cleanupMic();

    if (!chunks.length) {
      setMicError('Nenhum áudio capturado.');
      return;
    }

    setUploadingRec(true);
    try {
      const wavBlob = encodeWavBlob(chunks, sr);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file = new File([wavBlob], `gravacao_estudo_${stamp}.wav`, { type: 'audio/wav' });
      await onAttachRecordedFile(file);
    } catch (err: any) {
      setMicError(err?.message || 'Erro ao vincular gravação ao projeto.');
    } finally {
      setUploadingRec(false);
    }
  };

  if (variant === 'compact') {
    return (
      <div className="mb-3 rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{contextLabel}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Você já pode editar e exportar em sincronia com o YouTube! Para detecção automática por IA e 4 Stems neste
            mesmo vídeo, vincule um áudio/vídeo local ou grave pela sua interface/microfone:
          </p>
          {micError && <div className="text-[11px] text-rose-300 mt-1">{micError}</div>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onAttachLocalAudio}
            disabled={recording || uploadingRec}
            className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1.5 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Vincular Áudio/Vídeo</span>
          </button>

          {!recording ? (
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={uploadingRec}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5 transition"
            >
              {uploadingRec ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{uploadingRec ? 'Anexando...' : 'Gravar Mic / Interface'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopAndAttachRecording()}
              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1.5 animate-pulse"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Parar ({elapsedSec.toFixed(1)}s)</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-5 sm:p-6 flex flex-col items-center text-center gap-4">
      <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
        <Film className="w-5 h-5 text-sky-400" />
      </div>

      <div className="space-y-1.5 max-w-2xl">
        <h3 className="text-sm sm:text-base font-bold text-white">{contextLabel}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Para liberar <strong className="text-slate-200">Separação em 4 Stems (Vocal, Bateria, Baixo, Outros)</strong>,{' '}
          <strong className="text-slate-200">Análise Automática por IA</strong>,{' '}
          <strong className="text-slate-200">Espectrograma FFT</strong> e{' '}
          <strong className="text-slate-200">Afinação ±12 semitons</strong> sincronizados ao vídeo, escolha uma das 3
          formas abaixo:
        </p>
      </div>

      {/* Live Mic VU Meter while recording */}
      {recording && (
        <div className="w-full max-w-md rounded-xl bg-rose-950/40 border border-rose-500/40 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-rose-300 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              GRAVANDO ÁUDIO LOCAL...
            </span>
            <span className="text-white font-bold">{elapsedSec.toFixed(1)}s</span>
          </div>
          <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-all duration-75"
              style={{ width: `${Math.max(4, levelPct)}%` }}
            />
          </div>
        </div>
      )}

      {micError && (
        <div className="px-3 py-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 max-w-lg">
          {micError}
        </div>
      )}

      {/* 3 Real Functional Options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-3xl text-left">
        <button
          type="button"
          onClick={onAttachLocalAudio}
          disabled={recording || uploadingRec}
          className="p-3.5 rounded-xl bg-sky-600/15 hover:bg-sky-600/25 border border-sky-500/40 flex flex-col gap-1.5 transition disabled:opacity-50"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
            <FolderOpen className="w-4 h-4 shrink-0" />
            <span>1. Vincular Áudio/Vídeo a este Vídeo</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Anexa MP3, WAV, FLAC, M4A, MP4 ou WebM <strong>neste mesmo projeto do YouTube</strong> mantendo o vídeo,
            loops, marcas e batidas em sincronia com os 4 Stems e IA.
          </p>
        </button>

        {!recording ? (
          <button
            type="button"
            onClick={() => void startRecording()}
            disabled={uploadingRec}
            className="p-3.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/40 flex flex-col gap-1.5 transition disabled:opacity-50"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
              {uploadingRec ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4 shrink-0" />}
              <span>{uploadingRec ? 'Anexando gravação...' : '2. Gravar Microfone / Interface'}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Capture áudio da sua interface USB ou microfone em WAV 16-bit local e libere IA, Piano Roll, Acordes e
              Separação em 4 Stems imediatamente.
            </p>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void stopAndAttachRecording()}
            className="p-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-400 flex flex-col gap-1.5 transition text-white"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <Square className="w-4 h-4 fill-current shrink-0" />
              <span>Parar e Vincular ({elapsedSec.toFixed(1)}s)</span>
            </div>
            <p className="text-[11px] text-rose-100 leading-snug">
              Clique para finalizar a captura WAV e liberar imediatamente o motor C++17 DSP, IA e 4 Stems.
            </p>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenDirectVideoModal}
          disabled={recording || uploadingRec}
          className="p-3.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/40 flex flex-col gap-1.5 transition disabled:opacity-50"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
            <Link2 className="w-4 h-4 shrink-0" />
            <span>3. Link Direto de Vídeo (.mp4/.webm)</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Links diretos para arquivos de vídeo (MP4, WebM, MOV) funcionam automaticamente com Vídeo + IA + Pitch + 4
            Stems sem nenhum passo extra!
          </p>
        </button>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-500 max-w-2xl">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Respeitamos os Termos de Serviço do YouTube (que proíbem baixar/extrair streams do YouTube sem autorização —
          assim como o próprio TuneTranscriber).
        </span>
      </div>
    </div>
  );
};

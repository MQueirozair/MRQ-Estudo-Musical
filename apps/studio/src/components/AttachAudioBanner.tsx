import React from 'react';
import {
  Film,
  FolderOpen,
  Link2,
  Radio,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';

interface AttachAudioBannerProps {
  variant: 'full' | 'compact';
  contextLabel: string;
  onOpenSystemCapture: () => void;
  onAttachLocalAudio: () => void;
  onOpenDirectVideoModal: () => void;
}

export const AttachAudioBanner: React.FC<AttachAudioBannerProps> = ({
  variant,
  contextLabel,
  onOpenSystemCapture,
  onAttachLocalAudio,
  onOpenDirectVideoModal,
}) => {
  if (variant === 'compact') {
    return (
      <div className="mb-3 rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{contextLabel}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Você já pode editar e exportar em sincronia com o YouTube! Para gerar a{' '}
            <strong className="text-slate-200">Forma de Onda</strong>, ativar{' '}
            <strong className="text-slate-200">IA + 4 Stems</strong> e exportar{' '}
            <strong className="text-slate-200">MP3 / WAV / FLAC</strong>, capture o{' '}
            <strong className="text-emerald-300">Som do Sistema (Saída Estéreo)</strong> ou vincule um arquivo local:
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenSystemCapture}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow transition"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Capturar Som do Sistema</span>
          </button>

          <button
            type="button"
            onClick={onAttachLocalAudio}
            className="px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-200 text-[11px] font-semibold flex items-center gap-1.5 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Vincular Áudio/Vídeo</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-5 sm:p-6 flex flex-col items-center text-center gap-4">
      <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center">
        <Film className="w-5 h-5 text-emerald-400" />
      </div>

      <div className="space-y-1.5 max-w-2xl">
        <h3 className="text-sm sm:text-base font-bold text-white">{contextLabel}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Para gerar a <strong className="text-slate-200">Forma de Onda + Espectrograma FFT</strong> e liberar{' '}
          <strong className="text-slate-200">Separação em 4 Stems (Vocal, Bateria, Baixo, Outros)</strong>,{' '}
          <strong className="text-slate-200">Análise Automática por IA</strong>,{' '}
          <strong className="text-slate-200">Afinação ±12 semitons</strong> e{' '}
          <strong className="text-slate-200">Exportação MP3/WAV/FLAC</strong>, escolha uma das 3 formas abaixo:
        </p>
      </div>

      {/* 3 Real Functional Options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-3xl text-left">
        <button
          type="button"
          onClick={onOpenSystemCapture}
          className="p-3.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/45 flex flex-col gap-1.5 transition"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
            <Radio className="w-4 h-4 shrink-0" />
            <span>1. Capturar Som do Sistema (Saída)</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            Grava diretamente a <strong>saída estéreo do computador (WASAPI Loopback)</strong> — sem precisar de
            microfone — gerando a Forma de Onda, 4 Stems, IA e MP3/WAV/FLAC!
          </p>
        </button>

        <button
          type="button"
          onClick={onAttachLocalAudio}
          className="p-3.5 rounded-xl bg-sky-600/15 hover:bg-sky-600/25 border border-sky-500/40 flex flex-col gap-1.5 transition"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
            <FolderOpen className="w-4 h-4 shrink-0" />
            <span>2. Vincular Áudio/Vídeo Local</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Anexa MP3, WAV, FLAC, M4A, MP4 ou WebM <strong>neste mesmo projeto do YouTube</strong> mantendo o vídeo,
            loops, marcas e batidas em sincronia com os 4 Stems e IA.
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenDirectVideoModal}
          className="p-3.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/40 flex flex-col gap-1.5 transition"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
            <Link2 className="w-4 h-4 shrink-0" />
            <span>3. Link Direto de Vídeo (.mp4/.webm)</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Links diretos para arquivos de vídeo (MP4, WebM, MOV) funcionam automaticamente com Vídeo + Forma de Onda +
            IA + Pitch + 4 Stems!
          </p>
        </button>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-500 max-w-2xl">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Respeitamos os Termos de Serviço do YouTube: não fazemos download não autorizado de streams — você captura o
          som da saída do sistema em tempo real ou vincula sua mídia local.
        </span>
      </div>
    </div>
  );
};

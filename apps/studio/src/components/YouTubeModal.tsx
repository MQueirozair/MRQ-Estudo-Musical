import React, { useMemo, useState } from 'react';
import { CheckCircle2, Film, FolderOpen, Link2, Loader2, ShieldCheck, Sparkles, X, Youtube } from 'lucide-react';

interface YouTubeModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitVideoUrl: (url: string, customName?: string) => Promise<void>;
  onChooseLocalMedia: () => void;
}

function parseYouTubeId(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const pat of patterns) {
    const m = trimmed.match(pat);
    if (m) return m[1];
  }
  return null;
}

function isDirectMediaUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!/^https?:\/\/.+/i.test(trimmed)) return false;
  if (parseYouTubeId(trimmed)) return false;
  return true;
}

export const YouTubeModal: React.FC<YouTubeModalProps> = ({
  open,
  onClose,
  onSubmitVideoUrl,
  onChooseLocalMedia,
}) => {
  const [url, setUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewYtId = useMemo(() => parseYouTubeId(url), [url]);
  const directMedia = useMemo(() => isDirectMediaUrl(url), [url]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewYtId && !directMedia) {
      setError(
        'Cole um link válido do YouTube (youtube.com/watch?v=... ou youtu.be/...) OU um link direto de vídeo/áudio (https://.../video.mp4, .webm, .mp3, .wav).'
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmitVideoUrl(url.trim(), customName.trim() || undefined);
      setUrl('');
      setCustomName('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao abrir link de vídeo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#111827] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <Youtube className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Abrir Vídeo por Link (YouTube ou Direto) ou Arquivo</h2>
              <p className="text-xs text-slate-400">
                Estude vídeos do YouTube, links diretos (.mp4/.webm) ou arquivos locais de áudio e vídeo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Option 1: Paste YouTube or Direct Video Link */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-rose-300">
              1. Colar Link do YouTube ou Link Direto de Vídeo (.mp4 / .webm / .mov / .mp3)
            </label>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Link2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="https://www.youtube.com/watch?v=... ou https://.../aula.mp4"
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-rose-500 focus:outline-none text-sm text-white placeholder-slate-500"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !url.trim()}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition shrink-0 shadow-lg shadow-rose-900/30"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : previewYtId ? (
                  <Youtube className="w-4 h-4" />
                ) : (
                  <Film className="w-4 h-4" />
                )}
                <span>{submitting ? 'Carregando...' : 'Abrir Vídeo'}</span>
              </button>
            </div>

            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Título personalizado (opcional)"
              className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-slate-600 focus:outline-none text-xs text-slate-200 placeholder-slate-500"
            />

            {/* Live YouTube Preview Card */}
            {previewYtId && (
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                <img
                  src={`https://i.ytimg.com/vi/${previewYtId}/mqdefault.jpg`}
                  alt="Prévia do vídeo"
                  className="w-24 h-14 object-cover rounded-lg border border-slate-700 bg-slate-900 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Link do YouTube reconhecido (Player Oficial)</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">ID: {previewYtId}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Velocidade 25%–200%, Loop A→B, Marcas (M), Batidas (B), Piano Roll & MIDI e Acordes funcionam de
                    imediato — e você pode vincular áudio local/mic para liberar IA e 4 Stems sincronizados ao vídeo!
                  </div>
                </div>
              </div>
            )}

            {/* Direct Video/Audio URL Preview Card */}
            {!previewYtId && directMedia && (
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-sky-950/30 border border-sky-500/30">
                <div className="w-12 h-12 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
                  <Film className="w-6 h-6 text-sky-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Link Direto de Vídeo/Áudio — Modo Estúdio Completo</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Links diretos (.mp4, .webm, .mov, .mp3, .wav, .flac, .ogg) são decodificados via FFmpeg local com{' '}
                    <strong className="text-slate-200">
                      Vídeo + Pitch ±12st + Espectrograma FFT + IA + Piano Roll + 4 Stems automáticos
                    </strong>
                    !
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="px-3 py-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                {error}
              </div>
            )}
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <div className="flex-1 h-px bg-slate-800" />
            <span>OU</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Option 2: Load Local Audio OR Video File */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>2. Abrir Arquivo Local de Áudio ou Vídeo (DSP + IA + 4 Stems)</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Suporta <strong>Áudio</strong> (MP3, WAV, M4A, FLAC, AAC, OGG, AIFF) e <strong>Vídeo</strong> (MP4,
                WebM, MOV, MKV, M4V) — libera Vídeo sincronizado, Espectrograma FFT, Transposição ±12 st, IA, Piano
                Roll e 4 Stems.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onChooseLocalMedia();
              }}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Abrir Áudio / Vídeo</span>
            </button>
          </div>

          {/* Compliance Note */}
          <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800/80 rounded-xl px-3.5 py-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-200">100% legal e compatível com os Termos do YouTube:</strong> links do
              YouTube usam o <em>YouTube IFrame Player API</em> oficial (sem download não autorizado); links diretos de
              arquivos próprios (.mp4/.webm) e arquivos locais liberam DSP, IA e 4 Stems nativamente.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

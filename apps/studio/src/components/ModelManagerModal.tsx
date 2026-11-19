import React, { useEffect, useState } from 'react';
import { Cpu, Download, Trash2, CheckCircle2, Wifi, WifiOff, Loader2, X, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import type { AIModelItem } from '../types/music';

interface ModelManagerModalProps {
  open: boolean;
  onClose: () => void;
}

export const ModelManagerModal: React.FC<ModelManagerModalProps> = ({ open, onClose }) => {
  const [models, setModels] = useState<AIModelItem[]>([]);
  const [runtime, setRuntime] = useState<any>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = async () => {
    const res = await api.listModels();
    setModels(res.models || []);
    setRuntime(res.runtime);
  };

  useEffect(() => {
    if (open) {
      setFeedback(null);
      void load();
    }
  }, [open]);

  if (!open) return null;

  const handleDownload = async (id: string) => {
    setBusyId(id);
    setFeedback(null);
    try {
      await api.downloadModel(id);
      setFeedback(`Modelo '${id}' baixado, validado no ONNX Runtime e pronto para uso 100% offline!`);
      await load();
    } catch (err: any) {
      setFeedback(`Aviso: ${err?.message || 'Erro ao baixar modelo'}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (id: string) => {
    setBusyId(id);
    try {
      await api.removeModel(id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white">Gerenciador de Modelos de IA Offline (ONNX Runtime)</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {/* Runtime Banner */}
          {runtime && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                <WifiOff className="w-4 h-4" />
                <span>Processamento Offline Ativo (sem assinatura ou API paga)</span>
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                ONNX {runtime.onnxruntime_version} · RAM {runtime.available_ram_mb}/{runtime.total_ram_mb} MB
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            Todas as funções musicais básicas já funcionam offline via motores DSP/ML nativos. Os modelos neurais
            abaixo são opcionais, baixados uma única vez (requer internet apenas durante o download) e executados
            localmente no seu dispositivo.
          </p>

          {feedback && (
            <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/40 text-xs text-sky-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Models List */}
          <div className="space-y-2.5">
            {models.map((m) => (
              <div
                key={m.id}
                className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{m.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        v{m.version}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
                        {m.license}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{m.description}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {m.installed ? (
                      <>
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Instalado ({m.installed_size_mb} MB)
                        </span>
                        <button
                          type="button"
                          disabled={busyId === m.id}
                          onClick={() => handleRemove(m.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-rose-400"
                          title="Remover modelo local"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === m.id || !m.compatible}
                        onClick={() => handleDownload(m.id)}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5"
                      >
                        {busyId === m.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>Baixar ({m.size_mb} MB)</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                  <span className="flex items-center gap-1">
                    {m.requires_internet_to_download ? (
                      <Wifi className="w-3 h-3 text-amber-400" />
                    ) : (
                      <WifiOff className="w-3 h-3 text-emerald-400" />
                    )}
                    {m.compatibility_note}
                  </span>
                  <span className="text-sky-400/90">Fallback Offline: {m.offline_fallback}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Keyboard, BookOpen, Activity, Info, X, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import type { HealthInfo } from '../types/music';

interface HelpModalsProps {
  tab: 'shortcuts' | 'manual' | 'diagnostics' | 'about' | null;
  onClose: () => void;
  onChangeTab: (t: 'shortcuts' | 'manual' | 'diagnostics' | 'about') => void;
}

export const HelpModals: React.FC<HelpModalsProps> = ({ tab, onClose, onChangeTab }) => {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [updates, setUpdates] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (tab === 'diagnostics' || tab === 'about') {
      void api.health().then(setHealth).catch(() => {});
    }
  }, [tab]);

  if (!tab) return null;

  const checkUpdates = async () => {
    setChecking(true);
    try {
      setUpdates(await api.checkUpdates());
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {(
              [
                ['shortcuts', 'Atalhos', Keyboard],
                ['manual', 'Manual', BookOpen],
                ['diagnostics', 'Diagnóstico & Updates', Activity],
                ['about', 'Sobre', Info],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => onChangeTab(id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  tab === id ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto text-xs text-slate-300 space-y-3">
          {tab === 'shortcuts' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ['Espaço', 'Reproduzir / Pausar'],
                ['← / →', 'Voltar / Avançar 5 segundos'],
                ['L', 'Ativar / Desativar Loop A/B'],
                ['A / ]', 'Definir Ponto A ou Ponto B do Loop'],
                ['B', 'Marcar Batida (e calcular BPM automaticamente)'],
                ['M', 'Criar Marcador de seção na posição atual'],
                ['Ctrl+Shift+Y', 'Abrir Vídeo do YouTube (Player Oficial)'],
                ['T', 'Tap Tempo (marcar andamento)'],
                ['+ / −', 'Zoom Horizontal no Waveform'],
                ['0', 'Ajustar Zoom à música inteira'],
                ['Delete', 'Excluir nota selecionada no Piano Roll'],
                ['Ctrl+S', 'Salvar projeto imediatamente'],
              ].map(([k, desc]) => (
                <div
                  key={k}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800"
                >
                  <span className="text-slate-300">{desc}</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-sky-300">
                    {k}
                  </kbd>
                </div>
              ))}
            </div>
          )}

          {tab === 'manual' && (
            <div className="space-y-2.5 leading-relaxed">
              <p>
                <strong>1. Importação de Áudio:</strong> Arraste arquivos MP3, WAV, M4A, FLAC, AAC, OGG ou AIFF para
                qualquer área da janela ou clique em <em>Importar Áudio</em>.
              </p>
              <p>
                <strong>2. Desacelerar sem alterar afinação:</strong> Escolha entre 25% e 200% no painel{' '}
                <em>Velocidade</em>. O motor C++17 Phase Vocoder mantém todas as notas exatamente no tom original.
              </p>
              <p>
                <strong>3. Loop A/B + Pré-contagem:</strong> Arraste sobre a forma de onda para selecionar uma frase,
                escolha uma pré-contagem (0,5s a 5s) para posicionar as mãos no instrumento e salve múltiplos loops.
              </p>
              <p>
                <strong>4. Análise Musical IA:</strong> Clique em <em>Analisar IA</em> para detectar BPM, batidas,
                compasso, tonalidade, escala, acordes e notas polifônicas. Edite manualmente qualquer nota no Piano Roll
                ou acorde no painel de cifras.
              </p>
              <p>
                <strong>5. Separação de Instrumentos:</strong> Na aba <em>Stems</em>, separe Vocal, Bateria, Baixo e
                Outros, ative o mixer multitrack em tempo real ou exporte stems isolados.
              </p>
            </div>
          )}

          {tab === 'diagnostics' && (
            <div className="space-y-3">
              {health ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] space-y-1.5">
                  <div>App: <span className="text-sky-300">{health.app} v{health.version}</span></div>
                  <div>Motor DSP Nativo: <span className="text-emerald-400">{health.dsp.dsp_version}</span> ({health.dsp.dsp_library})</div>
                  <div>Formatos Importação: <span className="text-slate-300">{health.dsp.supported_import_formats.join(', ')}</span></div>
                  <div>ONNX Runtime: <span className="text-indigo-300">{health.ai_runtime.onnxruntime_version}</span> ({health.ai_runtime.execution_providers.join(', ')})</div>
                  <div>Memória RAM: {health.ai_runtime.available_ram_mb} MB livres / {health.ai_runtime.total_ram_mb} MB</div>
                  <div>Cache RAM: {health.dsp.ram_cached_tracks} faixas · Temp: {health.dsp.temp_render_files} arquivos</div>
                  <div>Plugins ativos: {health.plugins.map((p) => `${p.name} (${p.version})`).join(', ')}</div>
                </div>
              ) : (
                <div>Carregando diagnóstico...</div>
              )}

              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3">
                <div>
                  <div className="font-bold text-white">Sistema de Atualização</div>
                  <div className="text-[11px] text-slate-400">
                    {updates
                      ? updates.update_available
                        ? `Nova versão v${updates.latest_version} disponível!`
                        : updates.message || `Você está na versão mais recente (v${updates.current_version}).`
                      : 'Verifique releases oficiais no repositório GitHub.'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={checking}
                  onClick={checkUpdates}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                  Verificar
                </button>
              </div>
            </div>
          )}

          {tab === 'about' && (
            <div className="text-center py-4 space-y-2">
              <img src="/mrq-logo.svg" alt="MRQ Estudo Musical" className="h-12 mx-auto" />
              <div className="text-sm font-bold text-white">MRQ Estudo Musical v1.0.0</div>
              <p className="text-slate-400 max-w-md mx-auto">
                Software profissional multiplataforma para estudo, transcrição, análise harmônica e separação de
                instrumentos — 100% local, offline-first e sob licença MIT.
              </p>
              <p className="text-[11px] text-slate-500">
                Núcleo DSP C++17 · FFmpeg/PyAV · ONNX Runtime · SQLite WAL · React + Canvas 2D + Web Audio API
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { X } from 'lucide-react';
import { downloadDiagnostics, LOG_KEY, type Settings } from '../settings';

interface Props { settings: Settings; onChange: (value: Settings) => void; onClose: () => void }

export function SettingsModal({ settings, onChange, onClose }: Props) {
  const choices: Array<[keyof Settings, string, string]> = [
    ['waveform', 'Forma de onda / espectrograma', 'Mostrar ou ocultar o painel de análise visual.'],
    ['speedPanel', 'Controles de velocidade e afinação', 'Mostrar ou ocultar o painel; os valores atuais são mantidos.'],
    ['practiceRecording', 'Gravação de prática', 'Mostrar o gravador de microfone para comparação.'],
    ['metronome', 'Metrônomo', 'Mostrar ou ocultar os controles do metrônomo.'],
    ['shortcuts', 'Dicas de atalhos', 'Mostrar a faixa de dicas no rodapé.'],
    ['diagnostics', 'Registrar erros da interface', 'Guarda até 100 erros localmente neste dispositivo.'],
    ['checkUpdates', 'Verificar atualizações ao abrir', 'Consulta o GitHub quando o aplicativo inicia.'],
  ];
  const desktop = (window as Window & { mrqDesktop?: { showEngineLog?: () => Promise<boolean> } }).mrqDesktop;
  return <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Configurações">
    <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 text-slate-100">
      <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">Configurações</h2><button onClick={onClose} aria-label="Fechar configurações"><X /></button></div>
      <div className="space-y-3">{choices.map(([key, label, description]) => <label key={key} className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 cursor-pointer">
        <input type="checkbox" checked={settings[key]} onChange={e => onChange({ ...settings, [key]: e.target.checked })} className="mt-1 accent-sky-500" />
        <span><strong className="block text-sm">{label}</strong><span className="text-xs text-slate-400">{description}</span></span>
      </label>)}</div>
      <div className="mt-4 text-xs text-slate-400">Os registros podem conter mensagens com informações pessoais. Revise antes de compartilhar. Erros anteriores não são apagados ao desativar o registro.</div>
      <div className="flex gap-2 mt-3"><button type="button" onClick={downloadDiagnostics} className="bg-sky-700 px-3 py-2 rounded text-sm">Baixar log da interface</button><button type="button" onClick={() => { try { localStorage.removeItem(LOG_KEY); } catch { /* storage unavailable */ } }} className="bg-slate-700 px-3 py-2 rounded text-sm">Apagar log</button></div>
      <p className="text-xs text-slate-400 mt-3">O motor desktop mantém um arquivo engine.log na pasta de dados. Ele é independente da opção de registrar erros da interface. Os logs não são enviados automaticamente.</p>
      {desktop?.showEngineLog && <button type="button" onClick={() => { void desktop.showEngineLog?.(); }} className="bg-slate-700 px-3 py-2 rounded text-sm mt-2">Mostrar log do motor</button>}
    </div>
  </div>;
}

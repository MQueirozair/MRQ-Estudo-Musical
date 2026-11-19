export interface Settings {
  waveform: boolean;
  speedPanel: boolean;
  practiceRecording: boolean;
  metronome: boolean;
  shortcuts: boolean;
  diagnostics: boolean;
  checkUpdates: boolean;
}

export const SETTINGS_KEY = 'mrq.settings.v1';
export const LOG_KEY = 'mrq.diagnostics.v1';
export const defaultSettings: Settings = { waveform: true, speedPanel: true, practiceRecording: true, metronome: true, shortcuts: true, diagnostics: false, checkUpdates: false };

export function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const result = { ...defaultSettings };
    for (const key of Object.keys(result) as (keyof Settings)[]) {
      if (typeof saved[key] === 'boolean') result[key] = saved[key];
    }
    return result;
  } catch { return { ...defaultSettings }; }
}

export function saveSettings(settings: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Storage may be disabled. */ }
}

export function recordDiagnostic(kind: string, message: string): void {
  if (!readSettings().diagnostics) return;
  try {
    const stored = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    const entries = Array.isArray(stored) ? stored.slice(-99) : [];
    entries.push({ time: new Date().toISOString(), kind: kind.slice(0, 40), message: message.slice(0, 1000) });
    localStorage.setItem(LOG_KEY, JSON.stringify(entries));
  } catch { /* Never turn a logging failure into an application failure. */ }
}

export function downloadDiagnostics(): void {
  const data = localStorage.getItem(LOG_KEY) || '[]';
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mrq-diagnostico.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

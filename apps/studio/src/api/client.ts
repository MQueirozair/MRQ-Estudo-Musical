import type {
  AIModelItem,
  DetectedChord,
  HealthInfo,
  LoopItem,
  MarkerItem,
  ProjectData,
  SpectrogramData,
  StemsAnalysis,
  TranscribedNote,
  WaveformData,
} from '../types/music';

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `Erro HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err?.detail) detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch {
      // ignore json parse error
    }
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  health: () => apiJson<HealthInfo>('/api/health'),
  checkUpdates: () => apiJson<any>('/api/updates/check'),
  clearCache: () => apiJson<{ cleared_temp_files: number }>('/api/cache/clear', { method: 'POST' }),

  // Projects
  listProjects: () =>
    apiJson<{
      projects: ProjectData[];
      recent_files: Array<{ file_path: string; filename: string; project_id: string; last_used_at: string }>;
      pending_recovery: Array<{ id: number; project_id: string; project_name: string; snapshot: any; saved_at: string }>;
    }>('/api/projects'),

  createProject: (name: string) =>
    apiJson<ProjectData>('/api/projects', { method: 'POST', body: JSON.stringify({ name }) }),

  createYouTubeProject: (url: string, name?: string) =>
    apiJson<ProjectData>('/api/projects/youtube', {
      method: 'POST',
      body: JSON.stringify({ url, ...(name ? { name } : {}) }),
    }),

  createVideoUrlProject: (url: string, name?: string) =>
    apiJson<ProjectData>('/api/projects/video-url', {
      method: 'POST',
      body: JSON.stringify({ url, ...(name ? { name } : {}) }),
    }),

  getProject: (id: string) => apiJson<ProjectData>(`/api/projects/${id}`),

  updateProject: (id: string, patch: Partial<ProjectData>) =>
    apiJson<ProjectData>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  cloneProject: (id: string, name: string) =>
    apiJson<ProjectData>(`/api/projects/${id}/clone`, { method: 'POST', body: JSON.stringify({ name }) }),

  deleteProject: (id: string) => apiJson<{ deleted: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),

  autosave: (id: string, state: Record<string, any>) =>
    apiJson<{ snapshot_id: number; saved: boolean }>(`/api/projects/${id}/autosave`, {
      method: 'POST',
      body: JSON.stringify({ state }),
    }),

  markCleanSave: (id: string) =>
    apiJson<{ clean: boolean }>(`/api/projects/${id}/clean-save`, { method: 'POST' }),

  // Audio Import (supports multiple files)
  importAudioFiles: async (files: FileList | File[], projectId?: string) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    const q = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    return apiJson<{ imported: ProjectData[]; count: number }>(`/api/audio/import${q}`, {
      method: 'POST',
      body: fd,
    });
  },

  audioUrl: (projectId: string, speed: number, semitones: number, cents: number) =>
    `/api/projects/${projectId}/audio?speed=${speed.toFixed(4)}&semitones=${semitones}&cents=${cents}`,

  videoUrl: (projectId: string) => `/api/projects/${projectId}/video`,

  stemAudioUrl: (projectId: string, stemKey: string, speed: number, semitones: number, cents: number) =>
    `/api/projects/${projectId}/stems/${stemKey}/audio?speed=${speed.toFixed(4)}&semitones=${semitones}&cents=${cents}`,

  getWaveform: (projectId: string, bins = 2400) =>
    apiJson<WaveformData>(`/api/projects/${projectId}/waveform?bins=${bins}`),

  getSpectrogram: (projectId: string, logScale = true, bins = 128) =>
    apiJson<SpectrogramData>(
      `/api/projects/${projectId}/spectrogram?log_scale=${logScale ? 'true' : 'false'}&bins=${bins}`
    ),

  // Loops & Markers
  upsertLoop: (projectId: string, loop: Partial<LoopItem>) =>
    apiJson<LoopItem>(`/api/projects/${projectId}/loops`, { method: 'POST', body: JSON.stringify(loop) }),

  deleteLoop: (projectId: string, loopId: string) =>
    apiJson<{ deleted: boolean }>(`/api/projects/${projectId}/loops/${loopId}`, { method: 'DELETE' }),

  upsertMarker: (projectId: string, marker: Partial<MarkerItem>) =>
    apiJson<MarkerItem>(`/api/projects/${projectId}/markers`, { method: 'POST', body: JSON.stringify(marker) }),

  deleteMarker: (projectId: string, markerId: string) =>
    apiJson<{ deleted: boolean }>(`/api/projects/${projectId}/markers/${markerId}`, { method: 'DELETE' }),

  // Notes & Chords manual save
  saveNotes: (projectId: string, notes: TranscribedNote[]) =>
    apiJson<{ notes: TranscribedNote[]; count: number }>(`/api/projects/${projectId}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    }),

  saveChords: (projectId: string, chords: DetectedChord[]) =>
    apiJson<{ chords: DetectedChord[]; count: number }>(`/api/projects/${projectId}/chords`, {
      method: 'PUT',
      body: JSON.stringify({ chords }),
    }),

  // Analysis
  analyzeFull: (projectId: string) =>
    apiJson<any>(`/api/projects/${projectId}/analyze/full`, { method: 'POST' }),

  analyzeBpm: (projectId: string) =>
    apiJson<any>(`/api/projects/${projectId}/analyze/bpm`, { method: 'POST' }),

  analyzeKey: (projectId: string) =>
    apiJson<any>(`/api/projects/${projectId}/analyze/key`, { method: 'POST' }),

  analyzeNotes: (projectId: string) =>
    apiJson<any>(`/api/projects/${projectId}/analyze/notes`, { method: 'POST' }),

  analyzeChords: (projectId: string) =>
    apiJson<any>(`/api/projects/${projectId}/analyze/chords`, { method: 'POST' }),

  tapTempo: (timestamps_sec: number[]) =>
    apiJson<{ bpm: number | null; taps: number; stability: number }>('/api/tools/tap-tempo', {
      method: 'POST',
      body: JSON.stringify({ timestamps_sec }),
    }),

  // Stems
  separateStems: (projectId: string) =>
    apiJson<StemsAnalysis>(`/api/projects/${projectId}/stems/separate`, { method: 'POST' }),

  stemsStatus: (projectId: string) =>
    apiJson<{ status: string; progress: number; message: string; error?: string }>(
      `/api/projects/${projectId}/stems/status`
    ),

  // Export with browser file download
  exportFile: async (projectId: string, payload: Record<string, any>, fallbackFilename: string) => {
    const res = await fetch(`/api/projects/${projectId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let msg = `Falha na exportação (${res.status})`;
      try {
        const j = await res.json();
        if (j?.detail) msg = j.detail;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const disp = res.headers.get('Content-Disposition') || '';
    const match = disp.match(/filename="?([^"]+)"?/i);
    const filename = match ? match[1] : fallbackFilename;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return filename;
  },

  // Models
  listModels: () => apiJson<{ runtime: any; models: AIModelItem[] }>('/api/models'),
  downloadModel: (modelId: string) =>
    apiJson<any>(`/api/models/${modelId}/download`, { method: 'POST' }),
  removeModel: (modelId: string) =>
    apiJson<{ removed: boolean }>(`/api/models/${modelId}`, { method: 'DELETE' }),
};

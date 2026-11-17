export interface LoopItem {
  id: string;
  project_id?: string;
  name: string;
  start_sec: number;
  end_sec: number;
  speed: number;
  semitones: number;
  cents: number;
  color: string;
  created_at?: string;
}

export type SectionType =
  | 'Introdução'
  | 'Verso'
  | 'Pré-refrão'
  | 'Refrão'
  | 'Ponte'
  | 'Solo'
  | 'Final'
  | 'Personalizado';

export interface MarkerItem {
  id: string;
  project_id?: string;
  label: string;
  section_type: SectionType | string;
  time_sec: number;
  end_sec?: number | null;
  color: string;
  note: string;
  created_at?: string;
}

export interface TranscribedNote {
  id: string;
  pitch: number;
  note_name: string;
  start_sec: number;
  duration_sec: number;
  velocity: number;
  confidence: number;
  role: 'melody' | 'harmony' | 'bass' | string;
  channel: number;
  edited: boolean;
}

export interface DetectedChord {
  id: string;
  symbol: string;
  root: string;
  quality: string;
  notes: string[];
  start_sec: number;
  end_sec: number;
  confidence: number;
  edited: boolean;
}

export interface StemFileInfo {
  key: 'vocals' | 'drums' | 'bass' | 'other';
  label: string;
  file_path: string;
  duration_sec: number;
  sample_rate: number;
  rms_level: number;
  file_size_bytes: number;
}

export interface StemsAnalysis {
  engine: string;
  quality_notice: string;
  processing_time_sec: number;
  stems: Record<'vocals' | 'drums' | 'bass' | 'other', StemFileInfo>;
}

export interface BpmAnalysis {
  bpm: number;
  confidence: number;
  low_confidence: boolean;
  warning?: string | null;
  time_signature: string;
  time_sig_num: number;
  time_sig_den: number;
  beats: number[];
  downbeats: number[];
  tempo_changes: Array<{ time_sec: number; bpm: number; confidence: number }>;
  duration_sec: number;
}

export interface KeyAnalysis {
  key: string;
  root: string;
  mode: string;
  scale: string;
  scale_notes: string[];
  confidence: number;
  low_confidence: boolean;
  warning?: string | null;
  candidates: Array<{ key: string; score: number }>;
  chroma_profile: number[];
}

export interface ProjectData {
  id: string;
  name: string;
  source_type?: 'audio' | 'youtube';
  youtube_video_id?: string | null;
  youtube_url?: string | null;
  youtube_channel?: string;
  manual_beats?: number[];
  audio_file_path: string | null;
  original_filename: string | null;
  duration_sec: number;
  sample_rate: number;
  channels: number;
  format_name: string;
  codec_name: string;
  bit_rate: number;
  file_size_bytes: number;
  speed: number;
  semitones: number;
  octaves: number;
  cents: number;
  precount_sec: number;
  bpm: number | null;
  bpm_confidence: number | null;
  musical_key: string | null;
  scale_name: string | null;
  key_confidence: number | null;
  time_signature: string;
  study_notes: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  loops: LoopItem[];
  markers: MarkerItem[];
  notes: TranscribedNote[];
  chords: DetectedChord[];
  analysis: {
    bpm?: BpmAnalysis;
    key?: KeyAnalysis;
    notes?: {
      engine: string;
      note_count: number;
      average_confidence: number;
      low_confidence: boolean;
      warning?: string | null;
      intervals?: Array<{
        time_sec: number;
        from_note: string;
        to_note: string;
        semitones: number;
        name: string;
        direction: string;
      }>;
      pitch_track?: Array<{
        time_sec: number;
        freq_hz: number;
        note: string | null;
        confidence: number;
      }>;
    };
    chords?: {
      progression_summary: string;
      average_confidence: number;
      low_confidence: boolean;
      warning?: string | null;
    };
    stems?: StemsAnalysis;
  };
}

export interface WaveformData {
  bins: number;
  sample_rate: number;
  duration_sec: number;
  min: number[];
  max: number[];
  rms: number[];
}

export interface SpectrogramData {
  frames: number;
  bins: number;
  sample_rate: number;
  duration_sec: number;
  min_freq: number;
  max_freq: number;
  log_scale: boolean;
  db_floor: number;
  data: number[][];
}

export interface AIModelItem {
  id: string;
  name: string;
  category: string;
  version: string;
  size_mb: number;
  license: string;
  description: string;
  filename: string;
  download_url: string;
  min_ram_mb: number;
  requires_gpu: boolean;
  offline_fallback: string;
  status: 'installed' | 'available' | 'downloading' | 'error';
  installed: boolean;
  local_path: string | null;
  installed_size_mb: number;
  compatible: boolean;
  compatibility_note: string;
  download_progress: number;
  error?: string | null;
  requires_internet_to_download: boolean;
}

export interface HealthInfo {
  status: string;
  app: string;
  version: string;
  dsp: {
    dsp_version: string;
    dsp_library: string;
    ram_cached_tracks: number;
    temp_render_files: number;
    supported_import_formats: string[];
  };
  ai_runtime: {
    onnxruntime_version: string;
    execution_providers: string[];
    gpu_available: boolean;
    total_ram_mb: number;
    available_ram_mb: number;
    offline_mode_ready: boolean;
  };
  plugins: Array<{ name: string; version: string; category: string; license: string }>;
}

export type StemKey = 'vocals' | 'drums' | 'bass' | 'other';

export interface StemMixerState {
  enabled: boolean;
  volumes: Record<StemKey, number>;
  mutes: Record<StemKey, boolean>;
  solos: Record<StemKey, boolean>;
}

export type ViewMode = 'waveform' | 'spectrogram' | 'split';
export type BottomTab = 'pianoroll' | 'chords' | 'stems' | 'loops' | 'info';

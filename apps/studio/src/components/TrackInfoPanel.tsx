import React, { useState } from 'react';
import {
  Flag,
  Info,
  Trash2,
  Repeat,
  Plus,
  Sparkles,
  AlertTriangle,
  StickyNote,
} from 'lucide-react';
import type { MarkerItem, ProjectData, SectionType } from '../types/music';
import { formatTime } from '../data/chordDiagrams';

const SECTION_PRESETS: Array<{ type: SectionType; color: string }> = [
  { type: 'Introdução', color: '#38BDF8' },
  { type: 'Verso', color: '#6366F1' },
  { type: 'Pré-refrão', color: '#EC4899' },
  { type: 'Refrão', color: '#22C55E' },
  { type: 'Ponte', color: '#F59E0B' },
  { type: 'Solo', color: '#F43F5E' },
  { type: 'Final', color: '#94A3B8' },
];

interface TrackInfoPanelProps {
  project: ProjectData;
  currentTime: number;
  onUpdateProject: (patch: Partial<ProjectData>) => Promise<void>;
  onSaveMarker: (marker: Partial<MarkerItem>) => Promise<void>;
  onDeleteMarker: (id: string) => Promise<void>;
  onSeek: (sec: number) => void;
  onLoopSection: (marker: MarkerItem) => void;
  onAnalyzeBpm: () => void;
  onAnalyzeKey: () => void;
}

export const TrackInfoPanel: React.FC<TrackInfoPanelProps> = ({
  project,
  currentTime,
  onUpdateProject,
  onSaveMarker,
  onDeleteMarker,
  onSeek,
  onLoopSection,
  onAnalyzeBpm,
  onAnalyzeKey,
}) => {
  const [sectionType, setSectionType] = useState<SectionType>('Refrão');
  const [markerLabel, setMarkerLabel] = useState('');
  const [markerColor, setMarkerColor] = useState('#22C55E');
  const [markerNote, setMarkerNote] = useState('');
  const [notesDraft, setNotesDraft] = useState(project.study_notes || '');

  React.useEffect(() => {
    setNotesDraft(project.study_notes || '');
  }, [project.id, project.study_notes]);

  const handleAddMarker = async () => {
    await onSaveMarker({
      label: markerLabel.trim() || sectionType,
      section_type: sectionType,
      time_sec: Number(currentTime.toFixed(3)),
      color: markerColor,
      note: markerNote.trim(),
    });
    setMarkerLabel('');
    setMarkerNote('');
  };

  const sizeMb = project.file_size_bytes ? (project.file_size_bytes / (1024 * 1024)).toFixed(2) : '0.00';
  const kbps = project.bit_rate ? Math.round(project.bit_rate / 1000) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Musical Analysis (BPM, Key, Scale) + Technical Metadata */}
      <div className="lg:col-span-5 flex flex-col gap-3">
        {/* Musical Metrics (Editable) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Análise de Andamento & Tonalidade
            </h3>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onAnalyzeBpm}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-sky-300"
              >
                Detectar BPM
              </button>
              <button
                type="button"
                onClick={onAnalyzeKey}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-indigo-300"
              >
                Detectar Tom
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>BPM (editável)</span>
                {project.bpm_confidence != null && (
                  <span className={project.bpm_confidence >= 0.55 ? 'text-emerald-400' : 'text-amber-400'}>
                    {Math.round(project.bpm_confidence * 100)}%
                  </span>
                )}
              </div>
              <input
                type="number"
                step={0.5}
                min={30}
                max={300}
                value={project.bpm ?? ''}
                placeholder="120"
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (v >= 30 && v <= 300) void onUpdateProject({ bpm: v });
                }}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v)) void onUpdateProject({ bpm: v });
                }}
                className="w-full bg-transparent text-lg font-extrabold font-mono text-sky-300 outline-none"
              />
              <div className="text-[10px] text-slate-500 mt-0.5">
                Compasso: <strong className="text-slate-300">{project.time_signature || '4/4'}</strong>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Tonalidade (editável)</span>
                {project.key_confidence != null && (
                  <span className={project.key_confidence >= 0.55 ? 'text-emerald-400' : 'text-amber-400'}>
                    {Math.round(project.key_confidence * 100)}%
                  </span>
                )}
              </div>
              <input
                type="text"
                defaultValue={project.musical_key || ''}
                key={`${project.id}-${project.musical_key}`}
                placeholder="Ex: A Menor"
                onBlur={(e) => {
                  if (e.target.value.trim()) void onUpdateProject({ musical_key: e.target.value.trim() });
                }}
                className="w-full bg-transparent text-base font-extrabold text-indigo-300 outline-none"
              />
              <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={project.scale_name || ''}>
                Escala: <strong className="text-slate-300">{project.scale_name || 'Não detectada'}</strong>
              </div>
            </div>
          </div>

          {(project.analysis?.bpm?.warning || project.analysis?.key?.warning) && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{project.analysis?.bpm?.warning || project.analysis?.key?.warning}</span>
            </div>
          )}
        </div>

        {/* Technical Audio Info */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5 mb-2.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            Informações Técnicas do Áudio
          </h3>
          <dl className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
            <dt className="text-slate-500">Arquivo</dt>
            <dd className="text-slate-200 font-medium truncate" title={project.original_filename || ''}>
              {project.original_filename || 'Nenhum áudio'}
            </dd>
            <dt className="text-slate-500">Duração</dt>
            <dd className="font-mono text-slate-200">{formatTime(project.duration_sec)}</dd>
            <dt className="text-slate-500">Amostragem</dt>
            <dd className="font-mono text-slate-200">{project.sample_rate} Hz</dd>
            <dt className="text-slate-500">Canais</dt>
            <dd className="text-slate-200">{project.channels === 2 ? 'Estéreo (2 ch)' : `${project.channels} ch`}</dd>
            <dt className="text-slate-500">Formato / Codec</dt>
            <dd className="font-mono text-slate-200">
              {project.format_name || '—'} / {project.codec_name || '—'}
            </dd>
            <dt className="text-slate-500">Bitrate / Tamanho</dt>
            <dd className="font-mono text-slate-200">
              {kbps ? `${kbps} kbps` : 'Lossless'} · {sizeMb} MB
            </dd>
          </dl>
        </div>
      </div>

      {/* Right: Section Markers & Study Notes */}
      <div className="lg:col-span-7 flex flex-col gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-purple-400" />
              Marcadores de Seção ({project.markers.length})
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Cursor: {formatTime(currentTime)}</span>
          </div>

          {/* Section Preset Buttons */}
          <div className="flex flex-wrap gap-1">
            {SECTION_PRESETS.map((p) => (
              <button
                key={p.type}
                type="button"
                onClick={() => {
                  setSectionType(p.type);
                  setMarkerColor(p.color);
                }}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition ${
                  sectionType === p.type ? 'text-white' : 'text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                style={
                  sectionType === p.type
                    ? { backgroundColor: `${p.color}33`, borderColor: p.color }
                    : undefined
                }
              >
                {p.type}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              placeholder={`Rótulo (ex: ${sectionType} 1)`}
              value={markerLabel}
              onChange={(e) => setMarkerLabel(e.target.value)}
              className="sm:col-span-4 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Observação de estudo..."
              value={markerNote}
              onChange={(e) => setMarkerNote(e.target.value)}
              className="sm:col-span-5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
            <button
              type="button"
              onClick={handleAddMarker}
              className="sm:col-span-3 px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Marcar Aqui
            </button>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {project.markers.map((mk) => (
              <div
                key={mk.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/75 border border-slate-800 text-xs"
              >
                <button
                  type="button"
                  onClick={() => onSeek(mk.time_sec)}
                  className="flex items-center gap-2 text-left min-w-0 flex-1 hover:text-sky-300"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: mk.color }} />
                  <span className="font-mono text-sky-300 shrink-0">{formatTime(mk.time_sec, false)}</span>
                  <span className="font-semibold text-slate-100 truncate">{mk.label}</span>
                  {mk.note && <span className="text-slate-500 truncate hidden md:inline">— {mk.note}</span>}
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onLoopSection(mk)}
                    className="px-1.5 py-0.5 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-[10px] font-semibold flex items-center gap-1"
                    title="Criar Loop A/B desta seção"
                  >
                    <Repeat className="w-3 h-3" />
                    Loop
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMarker(mk.id)}
                    className="p-1 rounded hover:bg-rose-900/50 text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Study Notes */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5 text-amber-400" />
              Anotações do Estudo (salvas no projeto)
            </label>
            <button
              type="button"
              onClick={() => void onUpdateProject({ study_notes: notesDraft })}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-300"
            >
              Salvar Notas
            </button>
          </div>
          <textarea
            rows={3}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => void onUpdateProject({ study_notes: notesDraft })}
            placeholder="Anote dedilhados, digitações, afinações alternativas, dificuldades técnicas..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder:text-slate-600 resize-none focus:border-sky-500 outline-none"
          />
        </div>
      </div>
    </div>
  );
};

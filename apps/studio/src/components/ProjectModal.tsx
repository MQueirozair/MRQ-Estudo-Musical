import React, { useEffect, useState } from 'react';
import {
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  Edit3,
  Clock,
  RotateCcw,
  X,
  Check,
} from 'lucide-react';
import { api } from '../api/client';
import type { ProjectData } from '../types/music';
import { formatTime } from '../data/chordDiagrams';

interface ProjectModalProps {
  open: boolean;
  currentProjectId: string | null;
  onClose: () => void;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string) => Promise<void>;
  onCloneProject: (id: string, newName: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onRenameProject: (id: string, name: string) => Promise<void>;
  onRecoverSnapshot: (projectId: string, snapshot: any) => Promise<void>;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  open,
  currentProjectId,
  onClose,
  onSelectProject,
  onCreateProject,
  onCloneProject,
  onDeleteProject,
  onRenameProject,
  onRecoverSnapshot,
}) => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [recentFiles, setRecentFiles] = useState<any[]>([]);
  const [recovery, setRecovery] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const refresh = async () => {
    const data = await api.listProjects();
    setProjects(data.projects || []);
    setRecentFiles(data.recent_files || []);
    setRecovery(data.pending_recovery || []);
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white">Gerenciador de Projetos (SQLite)</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {/* Crash Recovery Banner */}
          {recovery.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 space-y-2">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" />
                Recuperação Automática Disponível
              </div>
              {recovery.map((rec) => (
                <div key={rec.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-200 truncate">
                    {rec.project_name} <span className="text-slate-500">({rec.saved_at})</span>
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await onRecoverSnapshot(rec.project_id, rec.snapshot);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold shrink-0"
                  >
                    Restaurar Sessão
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Create New Project */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Nome do novo projeto de estudo..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newName.trim()) {
                  await onCreateProject(newName.trim());
                  setNewName('');
                  await refresh();
                }
              }}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            />
            <button
              type="button"
              onClick={async () => {
                await onCreateProject(newName.trim() || `Novo Estudo ${projects.length + 1}`);
                setNewName('');
                await refresh();
              }}
              className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Projeto
            </button>
          </div>

          {/* Saved Projects List */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Histórico de Projetos ({projects.length})
            </h3>
            <div className="space-y-1.5">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition ${
                    p.id === currentProjectId
                      ? 'bg-sky-500/10 border-sky-500/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    {renamingId === p.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && renameVal.trim()) {
                              await onRenameProject(p.id, renameVal.trim());
                              setRenamingId(null);
                              await refresh();
                            }
                          }}
                          className="bg-slate-900 border border-sky-500 rounded px-2 py-0.5 text-xs text-white flex-1"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (renameVal.trim()) await onRenameProject(p.id, renameVal.trim());
                            setRenamingId(null);
                            await refresh();
                          }}
                          className="text-emerald-400 p-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProject(p.id);
                          onClose();
                        }}
                        className="text-left w-full"
                      >
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          {p.source_type === 'youtube' && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[9px] font-bold uppercase shrink-0">
                              {p.audio_file_path ? 'YouTube + DSP' : 'YouTube'}
                            </span>
                          )}
                          {p.source_type === 'video' && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-bold uppercase shrink-0">
                              Vídeo DSP
                            </span>
                          )}
                          <span className="truncate">{p.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {p.original_filename || 'Sem áudio'} · {formatTime(p.duration_sec, false)} ·{' '}
                          {p.bpm ? `${p.bpm} BPM` : 'BPM —'} · {p.musical_key || 'Tom —'}
                        </div>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(p.id);
                        setRenameVal(p.name);
                      }}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Renomear"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await onCloneProject(p.id, `${p.name} (Cópia)`);
                        await refresh();
                      }}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300"
                      title="Salvar Como (Duplicar)"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteProject(p.id);
                          await refresh();
                        }}
                        className="p-1.5 rounded bg-slate-800 hover:bg-rose-900/60 text-rose-400"
                        title="Excluir projeto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Audio Files */}
          {recentFiles.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Arquivos de Áudio Recentes
              </h3>
              <div className="space-y-1">
                {recentFiles.slice(0, 6).map((rf, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded bg-slate-950/60 border border-slate-800/80"
                  >
                    <span className="text-slate-300 truncate">{rf.filename}</span>
                    {rf.project_id && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProject(rf.project_id);
                          onClose();
                        }}
                        className="text-sky-400 hover:underline shrink-0 ml-2"
                      >
                        Abrir
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

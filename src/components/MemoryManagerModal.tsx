import React, { useState } from 'react';
import type { SessionMemoryItem, MemoryCategory } from '../types';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Download,
  Upload,
  User,
  Heart,
  Target,
  Clock,
  BookmarkCheck,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { isContentSensitive } from '../utils/memoryStorage';

interface MemoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: SessionMemoryItem[];
  onSaveMemory: (item: Omit<SessionMemoryItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateMemory: (id: string, updates: Partial<SessionMemoryItem>) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  onClearAllMemories: () => void;
  onExportJSON: () => void;
  onImportJSON: (jsonStr: string) => Promise<void>;
}

const CATEGORIES: { id: MemoryCategory | 'all'; label: string; icon: any }[] = [
  { id: 'all', label: 'All', icon: Brain },
  { id: 'personal', label: 'Personal & Name', icon: User },
  { id: 'interest', label: 'Interests & Hobbies', icon: Heart },
  { id: 'project', label: 'Projects & Goals', icon: Target },
  { id: 'preference', label: 'Preferences', icon: BookmarkCheck },
  { id: 'task', label: 'Tasks & Decisions', icon: Clock },
  { id: 'context', label: 'Context', icon: BookmarkCheck },
];

export const MemoryManagerModal: React.FC<MemoryManagerModalProps> = ({
  isOpen,
  onClose,
  memories,
  onSaveMemory,
  onUpdateMemory,
  onDeleteMemory,
  onClearAllMemories,
  onExportJSON,
  onImportJSON,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MemoryCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editDetail, setEditDetail] = useState('');

  // Add memory form state
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState<MemoryCategory>('personal');
  const [newKey, setNewKey] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [sensitiveWarning, setSensitiveWarning] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredMemories = memories.filter((m) => {
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    const matchesQuery =
      m.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.detail.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const handleStartEdit = (m: SessionMemoryItem) => {
    setEditingId(m.id);
    setEditKey(m.key);
    setEditDetail(m.detail);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editKey.trim() || !editDetail.trim()) return;
    if (isContentSensitive(editDetail)) {
      alert('Security policy: Passwords, tokens, or private secrets cannot be saved.');
      return;
    }
    await onUpdateMemory(id, { key: editKey.trim(), detail: editDetail.trim() });
    setEditingId(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSensitiveWarning(null);

    if (!newKey.trim() || !newDetail.trim()) return;

    if (isContentSensitive(newKey) || isContentSensitive(newDetail)) {
      setSensitiveWarning('Security restriction: Passwords, private keys, or credentials cannot be stored in conversational memory.');
      return;
    }

    await onSaveMemory({
      category: newCategory,
      key: newKey.trim(),
      detail: newDetail.trim(),
      isConfirmedByUser: true,
    });

    setNewKey('');
    setNewDetail('');
    setIsAdding(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        try {
          await onImportJSON(content);
        } catch (err: any) {
          alert(`Failed to import memories: ${err.message}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Persistent Personal Memory</h3>
                <p className="text-xs text-slate-400">
                  Persistent facts, preferences, and goals Myraa remembers across sessions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onExportJSON}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 border border-slate-700 transition-colors"
                title="Export memories as JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>

              <label className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Import</span>
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search & Actions Bar */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search remembered facts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={() => setIsAdding(!isAdding)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Memory</span>
            </button>
          </div>

          {/* Category Tabs */}
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              const count =
                cat.id === 'all'
                  ? memories.length
                  : memories.filter((m) => m.category === cat.id).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-all shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                      : 'bg-slate-800/40 text-slate-400 hover:text-slate-200 border-slate-700/40 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  <span className="text-[10px] opacity-60">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Add Memory Form */}
          {isAdding && (
            <form
              onSubmit={handleCreateSubmit}
              className="mt-3 p-3.5 bg-slate-800/80 rounded-xl border border-indigo-500/30 space-y-2.5 animate-fade-in"
            >
              {sensitiveWarning && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{sensitiveWarning}</span>
                </div>
              )}

              <div className="flex gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="personal">Personal & Nickname</option>
                  <option value="interest">Interest & Hobby</option>
                  <option value="project">Project & Goal</option>
                  <option value="preference">Preference</option>
                  <option value="task">Task & Decision</option>
                  <option value="context">Context</option>
                </select>
                <input
                  type="text"
                  placeholder="Fact Label (e.g. Preferred Language, Name)"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <textarea
                placeholder="What should Myraa remember about you?"
                rows={2}
                value={newDetail}
                onChange={(e) => setNewDetail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 p-2.5 focus:outline-none focus:border-indigo-500 resize-none"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg"
                >
                  Save to Persistent Memory
                </button>
              </div>
            </form>
          )}

          {/* Memory List Area */}
          <div className="mt-3 space-y-2.5 max-h-[44vh] overflow-y-auto pr-1">
            {filteredMemories.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <Brain className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p>No memories found matching your filter.</p>
                <p className="mt-1 text-slate-600">
                  Myraa automatically stores facts during natural conversation, or you can add them manually.
                </p>
              </div>
            ) : (
              filteredMemories.map((m) => {
                const isEditing = editingId === m.id;

                return (
                  <div
                    key={m.id}
                    className="group p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 transition-colors"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editKey}
                          onChange={(e) => setEditKey(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 px-2.5 py-1 focus:outline-none focus:border-indigo-500"
                        />
                        <textarea
                          rows={2}
                          value={editDetail}
                          onChange={(e) => setEditDetail(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 p-2 focus:outline-none focus:border-indigo-500 resize-none"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-slate-400 hover:text-slate-200"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSaveEdit(m.id)}
                            className="p-1 text-emerald-400 hover:text-emerald-300"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                            <span className="capitalize text-indigo-300">{m.category}</span>
                            <span aria-hidden="true" className="text-slate-600">·</span>
                            <span>{m.key}</span>
                            {m.isConfirmedByUser && (
                              <span className="text-[10px] text-emerald-400/80 flex items-center gap-0.5 ml-1">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Verified</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleStartEdit(m)}
                              className="p-1 text-slate-400 hover:text-slate-200"
                              title="Edit memory"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteMemory(m.id)}
                              className="p-1 text-slate-500 hover:text-rose-400"
                              title="Delete memory"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="mt-1 text-xs text-slate-300 leading-relaxed">{m.detail}</p>

                        <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                          <span>Updated {new Date(m.updatedAt).toLocaleDateString()}</span>
                          {m.emotionalTone && (
                            <span className="italic text-slate-400">Tone: {m.emotionalTone}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
          <span className="text-slate-400">
            {memories.length} saved memor{memories.length === 1 ? 'y' : 'ies'} · IndexedDB persistent
          </span>
          {memories.length > 0 && (
            <button
              onClick={onClearAllMemories}
              className="text-rose-400 hover:text-rose-300 transition-colors"
            >
              Clear All Memory
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

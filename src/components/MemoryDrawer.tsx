import React, { useState } from 'react';
import type { SessionMemoryItem, CompanionEmotion } from '../types';
import { Sparkles, Brain, Plus, Trash2, X, BookmarkCheck, Heart, User } from 'lucide-react';

interface MemoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  memories: SessionMemoryItem[];
  companionEmotion?: CompanionEmotion | null;
  onAddMemory: (category: SessionMemoryItem['category'], key: string, detail: string) => void;
  onDeleteMemory: (id: string) => void;
  onClearMemories: () => void;
  onOpenManager?: () => void;
}

export const MemoryDrawer: React.FC<MemoryDrawerProps> = ({
  isOpen,
  onClose,
  memories,
  companionEmotion,
  onAddMemory,
  onDeleteMemory,
  onClearMemories,
  onOpenManager,
}) => {
  const [newKey, setNewKey] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [newCategory, setNewCategory] = useState<SessionMemoryItem['category']>('context');
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newDetail.trim()) return;
    onAddMemory(newCategory, newKey.trim(), newDetail.trim());
    setNewKey('');
    setNewDetail('');
    setIsAdding(false);
  };

  const getCategoryIcon = (cat: SessionMemoryItem['category']) => {
    switch (cat) {
      case 'emotion':
        return <Heart className="w-3.5 h-3.5 text-rose-400" />;
      case 'personal':
        return <User className="w-3.5 h-3.5 text-sky-400" />;
      default:
        return <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl overflow-hidden">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Brain className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100 tracking-tight">Active Session Memory</h3>
                <p className="text-xs text-slate-400">Context Myraa keeps in mind as you talk</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Emotional Resonance Banner */}
          {companionEmotion && (
            <div className="mt-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="font-medium text-slate-200">Current Companion Vibe</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize text-amber-300">{companionEmotion.mood}</span>
                </div>
                {companionEmotion.vocalInflection && (
                  <p className="text-slate-400 leading-relaxed">
                    Voice tone: {companionEmotion.vocalInflection}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Add custom note button */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Recalled Facts ({memories.length})
            </span>
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Context Note</span>
            </button>
          </div>

          {/* Add form */}
          {isAdding && (
            <form onSubmit={handleCreate} className="mt-3 p-3.5 rounded-xl bg-slate-800/80 border border-indigo-500/30 space-y-3">
              <div className="flex gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="context">Context</option>
                  <option value="personal">Personal</option>
                  <option value="emotion">Emotion</option>
                  <option value="preference">Preference</option>
                  <option value="goal">Goal</option>
                </select>
                <input
                  type="text"
                  placeholder="Key (e.g. Current Mood)"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <textarea
                rows={2}
                placeholder="What should Myraa remember about you?"
                value={newDetail}
                onChange={(e) => setNewDetail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 p-2.5 focus:outline-none focus:border-indigo-500 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Save to Session
                </button>
              </div>
            </form>
          )}

          {/* Memory List */}
          <div className="mt-3 space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {memories.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <p>No memories logged yet.</p>
                <p className="mt-1 text-slate-600">
                  Talk naturally with Myraa; she automatically stores important details as you speak!
                </p>
              </div>
            ) : (
              memories.map((item) => (
                <div
                  key={item.id}
                  className="group p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                      {getCategoryIcon(item.category)}
                      <span>{item.key}</span>
                      {item.emotionalTone && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-[11px] text-slate-400 italic">
                            {item.emotionalTone}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => onDeleteMemory(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition-opacity"
                      title="Forget this detail"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    {item.detail}
                  </p>
                  <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1.5">
                    <span className="capitalize">{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>Session Memory</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
          {onOpenManager && (
            <button
              onClick={() => {
                onClose();
                onOpenManager();
              }}
              className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Full Memory Manager & Export →</span>
            </button>
          )}
          {memories.length > 0 && (
            <button
              onClick={onClearMemories}
              className="text-rose-400 hover:text-rose-300 transition-colors ml-auto"
            >
              Reset All
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

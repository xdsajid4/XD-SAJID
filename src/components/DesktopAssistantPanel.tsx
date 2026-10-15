import React, { useState } from 'react';
import {
  DesktopNote,
  DesktopTimer,
  DesktopTask,
  PendingConfirmation,
} from '../types';
import {
  Clock,
  CheckSquare,
  FileText,
  Plus,
  Trash2,
  X,
  VolumeX,
  Volume2,
  Copy,
  Check,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';

interface DesktopAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notes: DesktopNote[];
  timers: DesktopTimer[];
  tasks: DesktopTask[];
  isQuietMode: boolean;
  proactiveMode: boolean;
  onToggleQuietMode: (quiet: boolean) => void;
  onToggleProactiveMode: (proactive: boolean) => void;
  onCreateNote: (title: string, content: string) => void;
  onDeleteNote: (id: string) => void;
  onCreateTimer: (durationSeconds: number, label: string) => void;
  onDeleteTimer: (id: string) => void;
  onToggleTask: (id: string) => void;
  onAddTask: (text: string) => void;
  onDeleteTask: (id: string) => void;
  onClearAllData: () => void;
}

export const DesktopAssistantPanel: React.FC<DesktopAssistantPanelProps> = ({
  isOpen,
  onClose,
  notes,
  timers,
  tasks,
  isQuietMode,
  proactiveMode,
  onToggleQuietMode,
  onToggleProactiveMode,
  onCreateNote,
  onDeleteNote,
  onCreateTimer,
  onDeleteTimer,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onClearAllData,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'timers' | 'tasks'>('notes');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const [newTimerLabel, setNewTimerLabel] = useState('');
  const [newTimerMinutes, setNewTimerMinutes] = useState('5');

  const [newTaskText, setNewTaskText] = useState('');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;
    onCreateNote(newNoteTitle.trim(), newNoteContent.trim() || newNoteTitle.trim());
    setNewNoteTitle('');
    setNewNoteContent('');
    setIsAddingNote(false);
  };

  const handleAddTimer = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseFloat(newTimerMinutes);
    if (isNaN(mins) || mins <= 0) return;
    onCreateTimer(Math.round(mins * 60), newTimerLabel.trim() || `${mins}m Timer`);
    setNewTimerLabel('');
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    onAddTask(newTaskText.trim());
    setNewTaskText('');
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNoteId(id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  const formatTimerRemaining = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl overflow-hidden">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Desktop Assistant</h3>
              <p className="text-xs text-slate-400">Notes, timers, tasks, and silence control</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Assistant Quick Status & Silence Control */}
          <div className="mt-4 p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isQuietMode ? (
                  <VolumeX className="w-4 h-4 text-amber-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
                <span className="text-xs font-medium text-slate-200">
                  {isQuietMode ? 'Quiet Mode Active' : 'Spoken Responses Active'}
                </span>
              </div>
              <button
                onClick={() => onToggleQuietMode(!isQuietMode)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  isQuietMode
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-slate-700'
                }`}
              >
                {isQuietMode ? 'Resume Speaking' : 'Be Quiet'}
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 text-xs">
              <span className="text-slate-400">Proactive Conversation</span>
              <button
                onClick={() => onToggleProactiveMode(!proactiveMode)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  proactiveMode
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-300 border border-slate-700'
                }`}
              >
                {proactiveMode ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 p-1 bg-slate-800/40 border border-slate-700/50 rounded-xl">
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'notes'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Notes ({notes.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('timers')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'timers'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timers ({timers.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'tasks'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Tasks ({tasks.length})</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="mt-3 max-h-[50vh] overflow-y-auto pr-1">
            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider">
                    Scratchpad Notes
                  </span>
                  <button
                    onClick={() => setIsAddingNote(!isAddingNote)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Note</span>
                  </button>
                </div>

                {isAddingNote && (
                  <form onSubmit={handleAddNote} className="p-3 bg-slate-800/80 rounded-xl border border-indigo-500/30 space-y-2">
                    <input
                      type="text"
                      placeholder="Title or reminder..."
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                    />
                    <textarea
                      placeholder="Note body or details..."
                      rows={2}
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingNote(false)}
                        className="px-2 py-1 text-xs text-slate-400"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg"
                      >
                        Save Note
                      </button>
                    </div>
                  </form>
                )}

                {notes.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    <p>No notes yet.</p>
                    <p className="mt-1 text-slate-600">
                      Say &ldquo;Myraa, note down...&rdquo; or click &ldquo;New Note&rdquo;.
                    </p>
                  </div>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="group p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="text-xs font-semibold text-slate-200">{note.title}</h4>
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={() => copyToClipboard(note.id, `${note.title}\n${note.content}`)}
                            className="p-1 text-slate-400 hover:text-slate-200"
                            title="Copy to clipboard"
                          >
                            {copiedNoteId === note.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => onDeleteNote(note.id)}
                            className="p-1 text-slate-500 hover:text-rose-400"
                            title="Delete note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <div className="mt-2 text-[10px] text-slate-500">
                        {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Timers Tab */}
            {activeTab === 'timers' && (
              <div className="space-y-3">
                <form onSubmit={handleAddTimer} className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 flex gap-2">
                  <input
                    type="text"
                    placeholder="Timer label (e.g. Tea)..."
                    value={newTimerLabel}
                    onChange={(e) => setNewTimerLabel(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    placeholder="Mins"
                    value={newTimerMinutes}
                    onChange={(e) => setNewTimerMinutes(e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-center"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg"
                  >
                    Start
                  </button>
                </form>

                {timers.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    <p>No active countdowns.</p>
                    <p className="mt-1 text-slate-600">
                      Say &ldquo;Set a 5 minute timer&rdquo; or create one above.
                    </p>
                  </div>
                ) : (
                  timers.map((timer) => (
                    <div
                      key={timer.id}
                      className="p-3 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200">{timer.label}</span>
                          {timer.remainingSeconds === 0 && (
                            <span className="text-[10px] text-amber-400 font-bold uppercase animate-pulse">
                              Time Up!
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-lg font-mono font-bold text-indigo-300">
                          {formatTimerRemaining(timer.remainingSeconds)}
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteTimer(timer.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400"
                        title="Cancel timer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === 'tasks' && (
              <div className="space-y-3">
                <form onSubmit={handleAddTask} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add task to do..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    className="flex-1 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-slate-200 px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg"
                  >
                    Add
                  </button>
                </form>

                {tasks.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    <p>No tasks yet.</p>
                    <p className="mt-1 text-slate-600">
                      Say &ldquo;Add finish report to my tasks&rdquo;.
                    </p>
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="group p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 flex items-center justify-between gap-2"
                    >
                      <button
                        onClick={() => onToggleTask(task.id)}
                        className="flex items-center gap-2.5 flex-1 text-left"
                      >
                        <input
                          type="checkbox"
                          checked={task.completed}
                          readOnly
                          className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                        />
                        <span
                          className={`text-xs ${
                            task.completed
                              ? 'line-through text-slate-500'
                              : 'text-slate-200'
                          }`}
                        >
                          {task.text}
                        </span>
                      </button>
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
          <span className="text-slate-500">Desktop Assistant Sync</span>
          <button
            onClick={onClearAllData}
            className="text-rose-400 hover:text-rose-300 transition-colors"
          >
            Clear Assistant Data
          </button>
        </div>
      </div>
    </div>
  );
};

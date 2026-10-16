import React from 'react';
import {
  Brain,
  Sliders,
  Volume2,
  VolumeX,
  Sparkles,
  Circle,
  LayoutGrid,
  BellOff,
  Monitor,
  Eye,
  Smartphone,
} from 'lucide-react';
import type { VoicePersona, AmbientSoundType } from '../types';

interface CompanionHeaderProps {
  voice: VoicePersona;
  memoryCount: number;
  desktopItemCount: number;
  isConnected: boolean;
  isLiveApi: boolean;
  isQuietMode: boolean;
  isAgentConnected: boolean;
  ambientSound: AmbientSoundType;
  sessionDuration: number;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
  onOpenDesktopAssistant: () => void;
  onOpenWindowsAutomation: () => void;
  onOpenScreenView?: () => void;
  onOpenPhoneConnect?: () => void;
  onToggleAmbient: () => void;
  onToggleQuietMode: () => void;
}

export const CompanionHeader: React.FC<CompanionHeaderProps> = ({
  voice,
  memoryCount,
  desktopItemCount,
  isConnected,
  isLiveApi,
  isQuietMode,
  isAgentConnected,
  ambientSound,
  sessionDuration,
  onOpenSettings,
  onOpenMemory,
  onOpenDesktopAssistant,
  onOpenWindowsAutomation,
  onOpenScreenView,
  onOpenPhoneConnect,
  onToggleAmbient,
  onToggleQuietMode,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className="w-full flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
      {/* Brand & Connection State */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-serif text-lg sm:text-xl font-medium tracking-tight text-slate-100 font-['Outfit']">
            Myraa
          </span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="hidden sm:inline">
              {isConnected ? (isLiveApi ? 'Live Voice Active' : 'Connected') : 'Connecting...'}
            </span>
          </div>

          {isQuietMode && (
            <button
              onClick={onToggleQuietMode}
              className="ml-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300 flex items-center gap-1 hover:bg-amber-500/25 transition-colors"
              title="Click to resume speaking"
            >
              <BellOff className="w-3 h-3" />
              <span>Quiet Mode</span>
            </button>
          )}
        </div>
      </div>

      {/* Session Metadata & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Session Timer */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 px-2 py-1">
          <span>Active</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-slate-300">{formatTime(sessionDuration)}</span>
        </div>

        {/* Ambient Toggle */}
        <button
          onClick={onToggleAmbient}
          className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
            ambientSound !== 'none'
              ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title={ambientSound !== 'none' ? `Ambient Sound: ${ambientSound}` : 'Toggle Ambient Presence'}
        >
          {ambientSound !== 'none' ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span className="hidden sm:inline capitalize">{ambientSound}</span>
            </>
          ) : (
            <VolumeX className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Screen View Trigger */}
        {onOpenScreenView && (
          <button
            onClick={onOpenScreenView}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
            title="Screen Perception & Vision"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Screen</span>
          </button>
        )}

        {/* Phone Connect Trigger */}
        {onOpenPhoneConnect && (
          <button
            onClick={onOpenPhoneConnect}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
            title="Phone Connect & Mobile Sync"
          >
            <Smartphone className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Phone</span>
          </button>
        )}

        {/* Windows PC Automation Trigger */}
        <button
          onClick={onOpenWindowsAutomation}
          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors relative"
          title="Windows PC Automation"
        >
          <Monitor className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">PC Auto</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isAgentConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
            }`}
            title={isAgentConnected ? 'Local Agent Connected' : 'Local Agent Offline'}
          />
        </button>

        {/* Desktop Productivity Trigger */}
        <button
          onClick={onOpenDesktopAssistant}
          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 flex items-center gap-2 transition-colors relative"
          title="Notes, Timers & Tasks"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Desktop</span>
          {desktopItemCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold flex items-center justify-center">
              {desktopItemCount}
            </span>
          )}
        </button>

        {/* Persistent Memory Trigger */}
        <button
          onClick={onOpenMemory}
          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 flex items-center gap-2 transition-colors relative"
          title="Persistent Personal Memory"
        >
          <Brain className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Memory</span>
          {memoryCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-[10px] font-bold text-white flex items-center justify-center">
              {memoryCount}
            </span>
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
          title="Companion Settings"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};


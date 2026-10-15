import React from 'react';
import type {
  CompanionSettings,
  VoicePersona,
  CompanionPacing,
  LanguageMode,
  AmbientSoundType,
} from '../types';
import {
  Volume2,
  Sliders,
  Mic,
  Languages,
  Sparkles,
  X,
  Gauge,
  Smile,
  Shield,
} from 'lucide-react';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CompanionSettings;
  onUpdateSettings: (newSettings: Partial<CompanionSettings>) => void;
}

const VOICES: { id: VoicePersona; name: string; description: string; vibe: string }[] = [
  { id: 'Kore', name: 'Kore', description: 'Warm, soulful, and deeply empathetic', vibe: 'Gentle Confidant' },
  { id: 'Zephyr', name: 'Zephyr', description: 'Bright, articulate, and friendly', vibe: 'Engaged Companion' },
  { id: 'Puck', name: 'Puck', description: 'Playful, witty, and spontaneous', vibe: 'Lively Spirit' },
  { id: 'Charon', name: 'Charon', description: 'Deep, calm, and grounded reassurance', vibe: 'Quiet Anchor' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Crisp, articulate, and observant', vibe: 'Thoughtful Thinker' },
];

const LANGUAGES: { id: LanguageMode; label: string; desc: string }[] = [
  { id: 'auto', label: 'Auto Detect', desc: 'Adapts to your speech naturally' },
  { id: 'english', label: 'English', desc: 'Natural fluent conversational English' },
  { id: 'bangla', label: 'Bengali (বাংলা)', desc: 'Warm native Bengali conversation' },
  { id: 'banglish', label: 'Bangla-English Mixed', desc: 'Natural urban Banglish bilingual flow' },
];

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Companion Nuance & Voice</h3>
              <p className="text-xs text-slate-400">Persona, language, pacing, and mood sensitivity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* Language Selection */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Languages className="w-3.5 h-3.5 text-indigo-400" />
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Language & Conversational Mode
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((lang) => {
                const isSelected = settings.languageMode === lang.id;
                return (
                  <button
                    key={lang.id}
                    onClick={() => onUpdateSettings({ languageMode: lang.id })}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500/60 text-white shadow-sm ring-1 ring-indigo-500/30'
                        : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/50 text-slate-300'
                    }`}
                  >
                    <span className="font-semibold text-xs text-slate-100 block">{lang.label}</span>
                    <span className="text-[10px] text-slate-400 line-clamp-1">{lang.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice Personas */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2.5">
              Voice Persona
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VOICES.map((v) => {
                const isSelected = settings.voice === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => onUpdateSettings({ voice: v.id })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500/60 text-white shadow-sm ring-1 ring-indigo-500/30'
                        : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/50 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-100">{v.name}</span>
                      <span className="text-[10px] text-slate-400">{v.vibe}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-1">{v.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Speaking Speed & Audio Volume */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-4">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Gauge className="w-3.5 h-3.5 text-sky-400" />
                  <span>Speaking Speed</span>
                </span>
                <span className="text-slate-400">{settings.speakingSpeed}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.3"
                step="0.05"
                value={settings.speakingSpeed}
                onChange={(e) => onUpdateSettings({ speakingSpeed: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Voice Volume</span>
                </span>
                <span className="text-slate-400">{Math.round(settings.speakingVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={settings.speakingVolume}
                onChange={(e) => onUpdateSettings({ speakingVolume: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Conversational Pacing */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Conversational Pacing & Rhythm
              </label>
              <span className="text-[11px] text-slate-400 capitalize">{settings.pacing}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['thoughtful', 'natural', 'brisk'] as CompanionPacing[]).map((pace) => (
                <button
                  key={pace}
                  onClick={() => onUpdateSettings({ pacing: pace })}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium capitalize text-center transition-colors ${
                    settings.pacing === pace
                      ? 'bg-slate-100 text-slate-900 border-white shadow-sm'
                      : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                  }`}
                >
                  {pace}
                </button>
              ))}
            </div>
          </div>

          {/* Mood-Aware Behavior Toggle */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smile className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-xs font-medium text-slate-200">Mood-Aware Companion Tone</span>
                <p className="text-[11px] text-slate-400">
                  Adapts response tone dynamically when you seem happy, tired, or stressed
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.moodAwareness}
              onChange={(e) => onUpdateSettings({ moodAwareness: e.target.checked })}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
            />
          </div>

          {/* Natural Interruption Settings */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-xs font-medium text-slate-200">Hands-Free Natural Interruptions</span>
                  <p className="text-[11px] text-slate-400">
                    Myraa smoothly yields the moment she detects you speaking
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoInterrupt}
                onChange={(e) => onUpdateSettings({ autoInterrupt: e.target.checked })}
                className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
              />
            </div>

            {settings.autoInterrupt && (
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Voice Sensitivity (VAD)</span>
                  <span>{settings.vadSensitivity < 0.03 ? 'High (Quick Cut-in)' : settings.vadSensitivity > 0.06 ? 'Low (Firm Voice)' : 'Medium'}</span>
                </div>
                <input
                  type="range"
                  min="0.015"
                  max="0.08"
                  step="0.005"
                  value={settings.vadSensitivity}
                  onChange={(e) => onUpdateSettings({ vadSensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Proactive Conversation & Quiet Mode */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-200">Proactive Conversation Mode</span>
                <p className="text-[11px] text-slate-400">
                  Allow Myraa to occasionally initiate a thoughtful remark when quiet
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.proactiveMode}
                onChange={(e) => onUpdateSettings({ proactiveMode: e.target.checked })}
                className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
              />
            </div>

            {settings.proactiveMode && (
              <div className="pt-2 border-t border-slate-700/40">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Proactive Check-in Delay</span>
                  <span>{settings.proactiveIntervalSeconds}s of silence</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="180"
                  step="15"
                  value={settings.proactiveIntervalSeconds}
                  onChange={(e) => onUpdateSettings({ proactiveIntervalSeconds: parseInt(e.target.value, 10) })}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-700/40">
              <div>
                <span className="text-xs font-medium text-slate-200">Quiet Mode (Do Not Disturb)</span>
                <p className="text-[11px] text-slate-400">
                  Myraa remains completely silent until explicitly addressed
                </p>
              </div>
              <button
                onClick={() => onUpdateSettings({ isQuietMode: !settings.isQuietMode })}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  settings.isQuietMode
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-slate-700'
                }`}
              >
                {settings.isQuietMode ? 'Active (Silent)' : 'Off (Speaking)'}
              </button>
            </div>
          </div>

          {/* Procedural Ambient Presence */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Ambient Room Presence (Procedural Synthesizer)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['none', 'rain', 'hearth', 'breeze'] as AmbientSoundType[]).map((snd) => (
                <button
                  key={snd}
                  onClick={() => onUpdateSettings({ ambientSound: snd })}
                  className={`py-2 px-2.5 rounded-lg border text-xs font-medium capitalize text-center transition-colors ${
                    settings.ambientSound === snd
                      ? 'bg-slate-100 text-slate-900 border-white shadow-sm'
                      : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                  }`}
                >
                  {snd === 'none' ? 'Silent' : snd}
                </button>
              ))}
            </div>
            {settings.ambientSound !== 'none' && (
              <div className="mt-3 flex items-center gap-3">
                <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.05"
                  value={settings.ambientVolume}
                  onChange={(e) => onUpdateSettings({ ambientVolume: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition-colors"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};

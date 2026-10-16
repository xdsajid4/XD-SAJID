import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Bell,
  Minus,
  Square,
  X,
  Sparkles,
  Camera,
  Folder,
  AlertTriangle,
  CheckCircle,
  Plus,
  Send,
  Eye,
  Cpu,
  Smartphone,
  Brain,
  MessageSquare,
  Layers,
  Hand,
  Heart,
  Play,
  Pause,
  RefreshCw,
  Upload,
  Maximize2,
  ExternalLink,
} from 'lucide-react';
import { MyraaAvatar } from './MyraaAvatar';
import type { AvatarState, CompanionEmotion, ConversationTurn, ScreenEventObservation } from '../types';

interface CenterDashboardWorkspaceProps {
  isMicActive: boolean;
  isMyraaSpeaking: boolean;
  isUserSpeaking: boolean;
  isInterrupted: boolean;
  isThinking: boolean;
  isLiveConnected: boolean;
  isQuietMode: boolean;
  companionEmotion: CompanionEmotion;
  outputAnalyser?: AnalyserNode | null;
  userVolume: number;
  liveStreamingText: string;
  turns: ConversationTurn[];
  onToggleMic: () => void;
  onInterrupt: () => void;
  onSendMessage: (text: string) => void;
  onOpenScreenModal: () => void;
  onOpenPhoneModal?: () => void;
  onOpenComputerModal: () => void;
  onOpenMemoryModal: () => void;
  onToggleQuietMode?: () => void;
  // Live continuous screen perception props
  isScreenSharing?: boolean;
  screenStream?: MediaStream | null;
  latestObservation?: ScreenEventObservation | null;
  isAnalyzingScreen?: boolean;
  screenError?: string | null;
  continuousVisionActive?: boolean;
  onStartScreenShare?: () => Promise<void>;
  onStopScreenShare?: () => void;
  onTriggerQuickScan?: () => void;
  onToggleContinuousVision?: () => void;
  onUploadScreenshot?: (file: File) => void;
  onSelectScreenPreset?: (preset: 'vscode' | 'chrome' | 'taskmgr') => void;
}

export const CenterDashboardWorkspace: React.FC<CenterDashboardWorkspaceProps> = ({
  isMicActive,
  isMyraaSpeaking,
  isUserSpeaking,
  isInterrupted,
  isThinking,
  isLiveConnected,
  isQuietMode,
  companionEmotion,
  outputAnalyser,
  userVolume,
  liveStreamingText,
  turns,
  onToggleMic,
  onInterrupt,
  onSendMessage,
  onOpenScreenModal,
  onOpenComputerModal,
  onOpenMemoryModal,
  onToggleQuietMode,
  isScreenSharing = false,
  screenStream = null,
  latestObservation = null,
  isAnalyzingScreen = false,
  screenError = null,
  continuousVisionActive = true,
  onStartScreenShare,
  onStopScreenShare,
  onTriggerQuickScan,
  onToggleContinuousVision,
  onUploadScreenshot,
  onSelectScreenPreset,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [greetingText, setGreetingText] = useState('Good Evening, Sajid! 🌙');
  const [waveformBars, setWaveformBars] = useState<number[]>(new Array(32).fill(6));
  const miniVideoRef = useRef<HTMLVideoElement | null>(null);
  const miniFileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync video element with screenStream
  useEffect(() => {
    if (miniVideoRef.current && screenStream) {
      miniVideoRef.current.srcObject = screenStream;
      miniVideoRef.current.play().catch(console.warn);
    }
  }, [screenStream, isScreenSharing]);

  // Determine dynamic time-of-day greeting
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreetingText('Good Morning, Sajid! ☀️');
    } else if (hour >= 12 && hour < 17) {
      setGreetingText('Good Afternoon, Sajid! 🌤️');
    } else {
      setGreetingText('Good Evening, Sajid! 🌙');
    }
  }, []);

  // Animate live audio waveform bars based on real playback or mic
  useEffect(() => {
    let animId: number;
    const freqData = new Uint8Array(32);

    const updateWave = () => {
      if (outputAnalyser && isMyraaSpeaking && !isInterrupted) {
        outputAnalyser.getByteFrequencyData(freqData);
        const bars = Array.from(freqData).map((v) => Math.max(4, Math.round((v / 255) * 26)));
        setWaveformBars(bars);
      } else if (isUserSpeaking && userVolume > 0.02) {
        const height = Math.min(26, Math.max(6, Math.round(userVolume * 140)));
        setWaveformBars((prev) =>
          prev.map(() => Math.max(4, Math.round(height * (0.5 + Math.random() * 0.7))))
        );
      } else {
        // Idle gentle breathing baseline
        const t = performance.now() / 300;
        setWaveformBars((prev) =>
          prev.map((_, i) => Math.max(4, Math.round(5 + Math.sin(t + i * 0.3) * 3)))
        );
      }
      animId = requestAnimationFrame(updateWave);
    };

    animId = requestAnimationFrame(updateWave);
    return () => cancelAnimationFrame(animId);
  }, [outputAnalyser, isMyraaSpeaking, isUserSpeaking, isInterrupted, userVolume]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-3 min-w-0 max-w-5xl mx-auto w-full select-none">
      {/* 1. COMPACT GREETING BAR AT TOP */}
      <div className="px-4 py-2.5 rounded-2xl bg-[#090e21]/90 border border-[#1e2a4a]/90 backdrop-blur-xl flex items-center justify-between shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-white font-['Outfit']">
              {greetingText}
            </h2>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Voice Active
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block mt-0.5">
            I&apos;m Myraa — your AI companion. I can see, think, and work for you.
          </p>
        </div>

        {/* Right Controls: Mic, Speaker, Notification, Window Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mic Button */}
          <button
            onClick={onToggleMic}
            className={`p-1.5 rounded-lg border transition-colors ${
              isMicActive
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-[#0f1730] border-[#1e2a4a] text-slate-400 hover:text-slate-200'
            }`}
            title={isMicActive ? 'Mute Microphone' : 'Enable Microphone'}
          >
            {isMicActive ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Speaker Button */}
          <button
            onClick={() => {
              if (onToggleQuietMode) {
                onToggleQuietMode();
              } else {
                setIsSpeakerMuted(!isSpeakerMuted);
              }
            }}
            className={`p-1.5 rounded-lg border transition-colors ${
              isQuietMode || isSpeakerMuted
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-[#0f1730] border-[#1e2a4a] text-slate-400 hover:text-slate-200'
            }`}
            title={isQuietMode || isSpeakerMuted ? 'Quiet Mode Active (Click to Unmute)' : 'Mute Audio Output'}
          >
            {isQuietMode || isSpeakerMuted ? (
              <VolumeX className="w-4 h-4 text-amber-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>

          {/* Notification Button */}
          <button
            className="p-1.5 rounded-lg bg-[#0f1730] border border-[#1e2a4a] text-slate-400 hover:text-slate-200 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-[#1e2a4a] mx-1 hidden sm:block" />

          {/* Desktop Window Controls */}
          <div className="hidden sm:flex items-center gap-1 text-slate-400">
            <button className="p-1 rounded hover:bg-slate-800 transition-colors" title="Minimize">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 rounded hover:bg-slate-800 transition-colors" title="Maximize">
              <Square className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 rounded hover:bg-rose-950/60 hover:text-rose-400 transition-colors" title="Close">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. LARGE HERO PANEL (HERO AVATAR, SPEECH BUBBLE, WAVEFORM OVERLAY) */}
      <div className="relative w-full rounded-3xl bg-[#090d1f] border border-[#1e293b]/90 shadow-2xl overflow-hidden flex flex-col items-center justify-center p-2 sm:p-4 min-h-[380px] sm:min-h-[460px] lg:min-h-[500px]">
        {/* Pink Handwritten Decoration on Left (matching reference image) */}
        <div className="absolute top-8 left-6 select-none pointer-events-none hidden md:block z-10">
          <p className="font-['Caveat',cursive] text-2xl lg:text-3xl text-pink-400/90 drop-shadow-[0_2px_12px_rgba(244,63,94,0.45)] -rotate-6 tracking-wide">
            You make my world brighter ♡
          </p>
        </div>

        {/* Floating Neon Purple Speech Bubble on Right (exact from reference image) */}
        <div className="absolute top-8 right-6 max-w-[240px] lg:max-w-[270px] p-3 rounded-2xl bg-[#140e33]/85 backdrop-blur-xl border border-purple-500/40 shadow-xl shadow-purple-950/60 hidden md:block z-10 animate-fade-in pointer-events-none">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-cyan-300">Myraa</span>
            <span className="text-[10px] text-pink-300 ml-auto font-mono">বাংলা</span>
          </div>
          <p className="text-xs text-slate-100 font-medium leading-relaxed font-['Noto_Sans_Bengali',sans-serif]">
            {liveStreamingText
              ? liveStreamingText
              : isMyraaSpeaking
              ? "হ্যাঁ, আমি শুনছি! বলো কি করতে পারি তোমার জন্য..."
              : isUserSpeaking
              ? "বলো, আমি খুব মনোযোগ দিয়ে শুনছি..."
              : "এই তো তুমি চুপ করে ছিলে... আমি তো ভেবেছিলাম হারিয়ে গেছো! বলো, কি নিয়ে কাজ করবে? ♡"}
          </p>
        </div>

        {/* Center Animated Character Avatar */}
        <div className="relative z-0 flex items-center justify-center my-auto pb-10">
          <MyraaAvatar
            state={
              !isLiveConnected
                ? 'error'
                : isInterrupted
                ? 'interrupted'
                : isMyraaSpeaking
                ? 'speaking'
                : isThinking
                ? 'thinking'
                : isUserSpeaking
                ? 'listening'
                : 'idle'
            }
            isSpeaking={isMyraaSpeaking}
            isUserSpeaking={isUserSpeaking}
            isInterrupted={isInterrupted}
            isThinking={isThinking}
            isQuietMode={isQuietMode}
            isConnected={isLiveConnected}
            emotion={companionEmotion}
            outputAnalyser={outputAnalyser}
            userVolume={userVolume}
            onInterruptClick={onInterrupt}
          />
        </div>

        {/* Bottom Voice Control Overlay Panel */}
        <div className="absolute bottom-4 inset-x-3 sm:inset-x-8 p-3 rounded-2xl bg-[#080d1e]/90 backdrop-blur-2xl border border-cyan-500/35 shadow-2xl flex items-center justify-between gap-3 sm:gap-4 z-10">
          {/* Left Waveform Bars */}
          <div className="flex-1 flex items-center justify-end gap-1 overflow-hidden h-7">
            {waveformBars.slice(0, 16).map((val, i) => (
              <span
                key={i}
                style={{ height: `${val}px` }}
                className="w-1 rounded-full bg-gradient-to-t from-cyan-400 to-purple-500 transition-all duration-75 shrink-0"
              />
            ))}
          </div>

          {/* Center Glowing Mic Button */}
          <button
            onClick={onToggleMic}
            className={`relative group p-3.5 sm:p-4 rounded-full transition-all duration-300 shadow-xl flex items-center justify-center shrink-0 ${
              isMicActive
                ? 'bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-pink-500/40 scale-105'
                : 'bg-gradient-to-tr from-purple-700 to-indigo-600 text-white shadow-purple-600/30 hover:scale-105'
            }`}
            title={isMicActive ? 'Stop Listening' : 'Talk with Myraa'}
          >
            {isMicActive ? <Mic className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
            {isMicActive && (
              <span className="absolute inset-0 rounded-full border-2 border-pink-400 animate-ping opacity-30 pointer-events-none" />
            )}
          </button>

          {/* Right Waveform Bars & Current State */}
          <div className="flex-1 flex items-center justify-between gap-2 overflow-hidden h-7">
            <div className="flex items-center gap-1 overflow-hidden">
              {waveformBars.slice(16, 32).map((val, i) => (
                <span
                  key={i}
                  style={{ height: `${val}px` }}
                  className="w-1 rounded-full bg-gradient-to-t from-purple-500 to-pink-500 transition-all duration-75 shrink-0"
                />
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-semibold text-slate-200 whitespace-nowrap font-mono">
                {isMyraaSpeaking
                  ? 'Speaking…'
                  : isThinking
                  ? 'Thinking…'
                  : isUserSpeaking
                  ? 'Hearing you…'
                  : isMicActive
                  ? 'Listening…'
                  : 'Tap to Talk'}
              </span>

              {isMyraaSpeaking && (
                <button
                  onClick={onInterrupt}
                  className="px-2 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[10px] text-amber-200 font-medium flex items-center gap-1 transition-colors"
                  title="Cut in / Stop speech"
                >
                  <Hand className="w-3 h-3" />
                  <span className="hidden sm:inline">Cut In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. UNDER HERO: TWO SIDE-BY-SIDE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Card 1: Screen View & Continuous Vision Perception (Live) */}
        <div className="p-4 rounded-2xl bg-[#090e21]/95 border border-[#1e2a4a]/90 backdrop-blur-xl shadow-xl space-y-3 relative overflow-hidden group">
          {/* Header with live status and controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white tracking-wide block">
                  Screen View & Live Vision
                </span>
                <span className="text-[10px] text-slate-400">
                  {isScreenSharing ? 'মায়রা সার্বক্ষণিক আপনার স্ক্রিন দেখছে' : 'রিয়েল-টাইম স্ক্রিন পর্যবেক্ষণ'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {isScreenSharing ? (
                <>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Watching Live
                  </span>

                  {/* Manual Quick Scan */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTriggerQuickScan?.();
                    }}
                    disabled={isAnalyzingScreen}
                    className="p-1 rounded-lg bg-slate-800/80 hover:bg-cyan-900/40 text-cyan-300 border border-slate-700 hover:border-cyan-500/40 transition-colors"
                    title="Scan current screen immediately"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzingScreen ? 'animate-spin text-cyan-400' : ''}`} />
                  </button>

                  {/* Pause / Resume Continuous Analysis */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleContinuousVision?.();
                    }}
                    className={`p-1 rounded-lg border transition-colors ${
                      continuousVisionActive
                        ? 'bg-purple-900/30 border-purple-500/40 text-purple-300'
                        : 'bg-amber-900/30 border-amber-500/40 text-amber-300'
                    }`}
                    title={continuousVisionActive ? 'Pause continuous AI vision' : 'Resume continuous AI vision'}
                  >
                    {continuousVisionActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>

                  {/* Expand Fullscreen Modal */}
                  <button
                    onClick={onOpenScreenModal}
                    className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    title="Open Fullscreen Vision Monitor"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Stop Screen Share */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStopScreenShare?.();
                    }}
                    className="p-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 transition-colors"
                    title="Stop Screen Sharing"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={onOpenScreenModal}
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors"
                >
                  Configure
                </button>
              )}
            </div>
          </div>

          {/* Screen Display Area */}
          <div className="relative aspect-video w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner group/vid">
            {isScreenSharing ? (
              <>
                <video
                  ref={miniVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain bg-black"
                />

                {/* Animated horizontal scanning beam if currently analyzing */}
                {isAnalyzingScreen && (
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse shadow-[0_0_12px_#22d3ee] pointer-events-none" />
                )}

                {/* Overlay live indicator */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-slate-200 font-mono text-[9px]">
                    {isAnalyzingScreen ? 'AI Scanning…' : 'Continuous Active'}
                  </span>
                </div>

                {/* Expand overlay button on hover */}
                <button
                  onClick={onOpenScreenModal}
                  className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/vid:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-medium"
                >
                  <Maximize2 className="w-4 h-4 text-cyan-300" />
                  <span>বড় করে দেখুন</span>
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center space-y-2.5 z-10 w-full">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    মায়রা আপনার স্ক্রিন দেখে লাইভ বিশ্লেষণ করবে
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs">
                    কোড এরর, ব্রাউজিং বা যেকোনো কাজে স্বয়ংক্রিয়ভাবে বাংলায় সহায়তা পেতে স্ক্রিন শেয়ার করুন।
                  </p>
                </div>

                {/* Instant Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  <button
                    onClick={onStartScreenShare}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all hover:scale-105"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Start Screen Share</span>
                  </button>

                  <button
                    onClick={() => miniFileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-xl bg-[#141d3d] hover:bg-[#1a254e] text-slate-200 border border-[#233160] text-xs font-medium flex items-center gap-1.5 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5 text-purple-400" />
                    <span>Upload Image</span>
                  </button>
                </div>

                {/* Hidden File Input */}
                <input
                  ref={miniFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadScreenshot?.(f);
                  }}
                />

                {/* Quick Simulated Presets */}
                <div className="flex items-center gap-1 pt-0.5 text-[10px] text-slate-400">
                  <span className="text-slate-500">Quick Test:</span>
                  <button
                    onClick={() => onSelectScreenPreset?.('vscode')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[9px]"
                  >
                    VS Code Error
                  </button>
                  <button
                    onClick={() => onSelectScreenPreset?.('chrome')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 font-mono text-[9px]"
                  >
                    Chrome
                  </button>
                  <button
                    onClick={() => onSelectScreenPreset?.('taskmgr')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-mono text-[9px]"
                  >
                    Tasks
                  </button>
                </div>

                {screenError && (
                  <p className="text-[10px] text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-lg p-1.5 mt-1 max-w-sm">
                    {screenError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Live Observation & Status Strip */}
          <div className="pt-1.5 border-t border-[#17203d] space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-slate-500">Active App:</span>
                <span className="text-slate-200 font-medium">
                  {latestObservation?.detectedApp || (isScreenSharing ? 'Active Desktop' : 'Standby')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-slate-500">Status:</span>
                <span
                  className={`font-medium capitalize ${
                    latestObservation?.riskLevel === 'critical'
                      ? 'text-rose-400'
                      : latestObservation?.riskLevel === 'warning'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {latestObservation?.riskLevel || 'Safe'}
                </span>
              </div>
            </div>

            {/* Myraa's continuous Bengali commentary bubble */}
            <div className="p-2 rounded-xl bg-[#080d21] border border-cyan-500/20 text-[11px] text-slate-200 leading-relaxed font-['Noto_Sans_Bengali',sans-serif]">
              <span className="text-cyan-400 font-semibold mr-1.5">মায়রা:</span>
              {latestObservation?.adviceInBengali ||
                (isScreenSharing
                  ? 'আমি তোমার স্ক্রিন দেখছি! সব ঠিকঠাক চলছে, কাজ চালিয়ে যাও ♡'
                  : 'স্ক্রিন শেয়ার চালু করুন, মায়রা সবসময় আপনার কাজের অগ্রগতি ও সমস্যা পর্যবেক্ষণ করবে ♡')}
            </div>
          </div>
        </div>

        {/* Card 2: Myraa Can Also... */}
        <div className="p-4 rounded-2xl bg-[#090e21]/90 border border-[#1e2a4a]/90 backdrop-blur-xl shadow-xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-white tracking-wide">Myraa Can Also…</span>
            </div>
          </div>

          {/* 5 Feature rows with purple icon tiles */}
          <div className="space-y-1.5">
            <div
              onClick={onOpenScreenModal}
              className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-md bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                <Eye className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-200 font-medium">Understand your screen in real time.</span>
            </div>

            <div
              onClick={onOpenComputerModal}
              className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-200 font-medium">Do computer tasks for you.</span>
            </div>

            <div
              onClick={onToggleMic}
              className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-md bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-300 shrink-0">
                <Heart className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-200 font-medium">Emotional voice conversation in বাংলা.</span>
            </div>

            <div
              onClick={onOpenMemoryModal}
              className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-md bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                <Brain className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-200 font-medium">Remember your habits.</span>
            </div>

            <div
              onClick={onToggleMic}
              className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-md bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 shrink-0">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-200 font-medium">Talk to you anytime.</span>
            </div>
          </div>

          {/* Handwritten Caption at Bottom */}
          <div className="pt-2 border-t border-[#17203d] text-center">
            <p className="font-['Caveat',cursive] text-sm sm:text-base text-pink-300/90 leading-tight">
              Not just an assistant… But a companion ♡
            </p>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM FULL-WIDTH MESSAGE INPUT BAR */}
      <form
        onSubmit={handleSubmit}
        className="w-full flex items-center gap-2 p-2 sm:p-2.5 rounded-2xl bg-[#090e21]/95 border border-cyan-500/30 focus-within:border-cyan-400 shadow-xl transition-all"
      >
        {/* Plus Button */}
        <button
          type="button"
          onClick={onOpenComputerModal}
          className="p-2 rounded-xl bg-[#0f1730] hover:bg-[#1a254c] text-cyan-400 border border-cyan-500/25 transition-colors shrink-0"
          title="Add Action or Attachment"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Avatar / Personality Shortcut */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-[10px] text-white font-bold shrink-0">
          M
        </div>

        {/* Text Input */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a thought or question... (বাংলা বা English লিখুন)"
          className="flex-1 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none px-2"
        />

        {/* Glowing Purple Send Button */}
        <button
          type="submit"
          className="p-2 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white font-semibold text-xs shadow-md shadow-purple-600/30 flex items-center gap-1.5 transition-transform active:scale-95 shrink-0"
          title="Send"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
};

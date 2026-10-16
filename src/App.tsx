import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CompanionEmotion,
  CompanionSettings,
  ConversationTurn,
  SessionMemoryItem,
  VoicePersona,
  DesktopNote,
  DesktopTimer,
  DesktopTask,
  PendingConfirmation,
  WindowsAgentConfig,
  WindowsAutomationAction,
  WindowsAutomationTool,
} from './types';
import {
  calculateRMS,
  floatTo16BitPCM,
  arrayBufferToBase64,
  GaplessAudioPlayer,
  ProceduralAmbientSoundscape,
} from './utils/audio';
import { MyraaAvatar } from './components/MyraaAvatar';
import { DashboardSidebar } from './components/DashboardSidebar';
import { CenterDashboardWorkspace } from './components/CenterDashboardWorkspace';
import { DashboardRightColumn } from './components/DashboardRightColumn';
import { ScreenViewPanel } from './components/ScreenViewPanel';
import { MobileCompanionView } from './components/MobileCompanionView';
import { CompanionHeader } from './components/CompanionHeader';
import { MemoryDrawer } from './components/MemoryDrawer';
import { MemoryManagerModal } from './components/MemoryManagerModal';
import { WindowsAutomationPanel } from './components/WindowsAutomationPanel';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { DesktopAssistantPanel } from './components/DesktopAssistantPanel';
import { ConfirmationModal } from './components/ConfirmationModal';
import { LiveTranscript } from './components/LiveTranscript';
import { WebBrowserModal } from './components/WebBrowserModal';
import { WindowsAutomationService } from './utils/windowsAutomation';
import type { DashboardSection, ScreenEventObservation } from './types';
import {
  loadAllMemories,
  saveMemory,
  updateMemory as updateMemoryStorage,
  deleteMemory as deleteMemoryStorage,
  clearAllMemories as clearAllMemoriesStorage,
  exportMemoriesJSON,
  importMemoriesJSON,
} from './utils/memoryStorage';
import {
  Mic,
  MicOff,
  Hand,
  Volume2,
  VolumeX,
  Columns,
  Maximize2,
  Sparkles,
  Info,
  BellOff,
  Play,
  AlertTriangle,
  Send,
} from 'lucide-react';

const INITIAL_SETTINGS: CompanionSettings = {
  voice: 'Kore',
  pacing: 'natural',
  languageMode: 'auto',
  speakingSpeed: 1.0,
  speakingVolume: 1.0,
  autoInterrupt: true,
  vadSensitivity: 0.035,
  empathyDepth: 'balanced',
  moodAwareness: true,
  ambientSound: 'none',
  ambientVolume: 0.25,
  proactiveMode: false,
  proactiveIntervalSeconds: 60,
  isQuietMode: false,
};

const INITIAL_EMOTION: CompanionEmotion = {
  mood: 'warmly attuned',
  internalThought: 'Present and listening. Ready whenever you want to talk.',
  vocalInflection: 'gentle, warm smile',
  energyLevel: 0.6,
  timestamp: Date.now(),
};

export default function App() {
  const [settings, setSettings] = useState<CompanionSettings>(INITIAL_SETTINGS);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [sessionMemories, setSessionMemories] = useState<SessionMemoryItem[]>([]);
  const [companionEmotion, setCompanionEmotion] = useState<CompanionEmotion>(INITIAL_EMOTION);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isMyraaSpeaking, setIsMyraaSpeaking] = useState<boolean>(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);
  const [isInterrupted, setIsInterrupted] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [userVolume, setUserVolume] = useState<number>(0);
  const [liveStreamingText, setLiveStreamingText] = useState<string>('');
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [layoutMode, setLayoutMode] = useState<'immersive' | 'split'>('immersive');
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  // Desktop Assistant State
  const [notes, setNotes] = useState<DesktopNote[]>([]);
  const [timers, setTimers] = useState<DesktopTimer[]>([]);
  const [tasks, setTasks] = useState<DesktopTask[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  // Modals & Drawers
  const [isMemoryOpen, setIsMemoryOpen] = useState<boolean>(false);
  const [isMemoryManagerOpen, setIsMemoryManagerOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isDesktopOpen, setIsDesktopOpen] = useState<boolean>(false);
  const [isWindowsAutomationOpen, setIsWindowsAutomationOpen] = useState<boolean>(false);
  const [isScreenViewOpen, setIsScreenViewOpen] = useState<boolean>(false);
  const [isBrowserOpen, setIsBrowserOpen] = useState<boolean>(false);
  const [browserUrl, setBrowserUrl] = useState<string>('https://www.google.com');
  const [currentSection, setCurrentSection] = useState<DashboardSection>('home');
  const [rightColumnTab, setRightColumnTab] = useState<'system' | 'transcript'>('system');

  // Global Screen Share & Continuous Vision Perception State
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [latestObservation, setLatestObservation] = useState<ScreenEventObservation | null>(null);
  const [screenObservations, setScreenObservations] = useState<ScreenEventObservation[]>([]);
  const [screenPreviewImage, setScreenPreviewImage] = useState<string | null>(null);
  const [isAnalyzingScreen, setIsAnalyzingScreen] = useState<boolean>(false);
  const [continuousVisionActive, setContinuousVisionActive] = useState<boolean>(true);
  const [analysisIntervalSec, setAnalysisIntervalSec] = useState<number>(6);

  const handleSelectSection = (section: DashboardSection) => {
    setCurrentSection(section);
    if (section === 'home') {
      setLayoutMode('immersive');
      setRightColumnTab('system');
    } else if (section === 'voice') {
      setLayoutMode('split');
      setRightColumnTab('transcript');
      if (!isMicActive) {
        toggleMicrophone();
      }
    } else if (section === 'screen') {
      setIsScreenViewOpen(true);
    } else if (section === 'computer') {
      setIsWindowsAutomationOpen(true);
    } else if (section === 'memory') {
      setIsMemoryOpen(true);
    } else if (section === 'files') {
      setIsDesktopOpen(true);
    } else if (section === 'settings') {
      setIsSettingsOpen(true);
    }
  };

  // Windows Automation state & service
  const windowsServiceRef = useRef<WindowsAutomationService | null>(null);
  const [windowsConfig, setWindowsConfig] = useState<WindowsAgentConfig>({
    agentUrl: 'http://127.0.0.1:41199',
    authToken: 'myraa-secure-local-token',
    isConnected: false,
    allowedDirectories: ['C:\\Users\\Public\\Documents', 'C:\\MyraaWorkspace'],
    allowedApps: ['notepad.exe', 'calc.exe', 'explorer.exe', 'code.exe', 'chrome.exe'],
  });
  const [windowsHistory, setWindowsHistory] = useState<WindowsAutomationAction[]>([]);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const audioPlayerRef = useRef<GaplessAudioPlayer | null>(null);
  const ambientPlayerRef = useRef<ProceduralAmbientSoundscape | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  // VAD & Activity tracking
  const vadActiveCountRef = useRef<number>(0);
  const isSpeakingRef = useRef<boolean>(false);
  isSpeakingRef.current = isMyraaSpeaking;
  const settingsRef = useRef<CompanionSettings>(settings);
  settingsRef.current = settings;
  const lastUserInteractionTime = useRef<number>(Date.now());
  const lastProactiveTime = useRef<number>(Date.now());

  // Initialize Audio Player & Ambient Synthesizer
  useEffect(() => {
    audioPlayerRef.current = new GaplessAudioPlayer((speaking) => {
      setIsMyraaSpeaking(speaking);
      if (!speaking) {
        setIsThinking(false);
      }
    });

    ambientPlayerRef.current = new ProceduralAmbientSoundscape();

    // Session duration timer
    const timer = setInterval(() => {
      setSessionDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      audioPlayerRef.current?.destroy();
      ambientPlayerRef.current?.stop();
    };
  }, []);

  // Load persistent memories from IndexedDB on startup
  useEffect(() => {
    loadAllMemories()
      .then((items) => {
        if (items && items.length > 0) {
          setSessionMemories(items);
        }
      })
      .catch((err) => console.warn('Memory load notice:', err));
  }, []);

  // Initialize Windows Automation Service
  useEffect(() => {
    const service = new WindowsAutomationService((connected) => {
      setWindowsConfig((prev) => ({ ...prev, isConnected: connected }));
    });
    windowsServiceRef.current = service;
    setWindowsConfig(service.getConfig());
    setWindowsHistory(service.getHistory());

    service.checkConnection().then(() => {
      setWindowsConfig(service.getConfig());
    });
  }, []);

  // Timers countdown tick
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (!t.isRunning || t.remainingSeconds <= 0) return t;
          const nextRemaining = t.remainingSeconds - 1;
          if (nextRemaining === 0) {
            // Beep alert or voice announce if not quiet
            playTimerAlertBeep();
          }
          return { ...t, remainingSeconds: nextRemaining };
        })
      );
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  const playTimerAlertBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      // ignore
    }
  };

  // Update ambient sound when settings change
  useEffect(() => {
    if (ambientPlayerRef.current) {
      if (settings.ambientSound !== 'none') {
        ambientPlayerRef.current.start(settings.ambientSound, settings.ambientVolume);
      } else {
        ambientPlayerRef.current.stop();
      }
    }
  }, [settings.ambientSound, settings.ambientVolume]);

  // Connect to WebSocket Live API
  const connectLiveWebSocket = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsLiveConnected(true);
        const memorySummary = sessionMemories
          .map((m) => `[${m.category}] ${m.key}: ${m.detail}`)
          .join('; ');

        ws.send(
          JSON.stringify({
            type: 'init',
            voice: settingsRef.current.voice,
            companionTone: settingsRef.current.pacing,
            memorySummary,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'audio') {
            if (!settingsRef.current.isQuietMode) {
              setIsThinking(false);
              audioPlayerRef.current?.queuePCM(msg.audio);
            }
          } else if (msg.type === 'interrupted') {
            handleNaturalInterruption(false);
          } else if (msg.type === 'output_text') {
            setLiveStreamingText((prev) => prev + msg.text);
          } else if (msg.type === 'turn_complete') {
            setLiveStreamingText((currentText) => {
              if (currentText.trim()) {
                setTurns((prev) => [
                  ...prev,
                  {
                    id: `turn-${Date.now()}`,
                    role: 'assistant',
                    content: currentText.trim(),
                    timestamp: Date.now(),
                    emotion: companionEmotion.mood,
                  },
                ]);
              }
              return '';
            });
          } else if (msg.type === 'memory_saved') {
            const memory = msg.memory;
            if (memory && memory.key) {
              const now = Date.now();
              const newMem: SessionMemoryItem = {
                id: `mem-${now}-${Math.random().toString(36).substring(2, 7)}`,
                category: memory.category || 'context',
                key: memory.key,
                detail: memory.detail,
                emotionalTone: memory.emotionalTone,
                isConfirmedByUser: memory.isConfirmedByUser ?? true,
                isAssumption: memory.isAssumption ?? false,
                createdAt: now,
                updatedAt: now,
              };
              setSessionMemories((prev) => [
                ...prev.filter((m) => m.key !== memory.key),
                newMem,
              ]);
              saveMemory(newMem).catch(console.warn);
            }
          } else if (msg.type === 'companion_feeling') {
            const feeling = msg.feeling;
            if (feeling) {
              setCompanionEmotion({
                mood: feeling.mood || 'attuned',
                internalThought: feeling.internalThought || '',
                vocalInflection: feeling.vocalInflection || '',
                timestamp: Date.now(),
              });
            }
          } else if (msg.type === 'quiet_mode_triggered') {
            handleSetQuietMode(msg.enabled ?? true);
          } else if (msg.type === 'desktop_tool_action') {
            handleDesktopToolAction(msg.tool, msg.payload);
          } else if (msg.type === 'windows_automation_executed') {
            const newAction: WindowsAutomationAction = {
              id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              toolName: msg.tool,
              params: msg.args || {},
              description: `Executed ${msg.tool}`,
              requiresConfirmation: false,
              status: msg.result?.success ? 'completed' : 'failed',
              result: msg.result,
              taskId: msg.result?.task_id,
              pid: msg.result?.pid,
              error: msg.result?.error,
              timestamp: Date.now(),
            };
            windowsServiceRef.current?.addActionToHistory(newAction);
            setWindowsHistory(windowsServiceRef.current?.getHistory() || []);
            if (msg.result?.success) {
              setWindowsConfig((prev) => ({ ...prev, isConnected: true }));
            }

            // Immediately launch interactive browser or application modal
            const tName = (msg.tool || '').toLowerCase();
            if (tName.includes('website') || tName.includes('web')) {
              const target = msg.args?.url || msg.result?.url || 'https://www.google.com';
              setBrowserUrl(target);
              setIsBrowserOpen(true);
            } else if (tName.includes('application') || tName.includes('app')) {
              const app = (msg.args?.app_name || msg.args?.appName || '').toLowerCase();
              if (app.includes('chrome') || app.includes('edge') || app.includes('browser')) {
                setBrowserUrl('https://www.google.com');
                setIsBrowserOpen(true);
              } else if (app.includes('note')) {
                setIsDesktopOpen(true);
              } else if (app.includes('calc')) {
                setIsDesktopOpen(true);
              } else {
                setIsWindowsAutomationOpen(true);
              }
            } else if (tName.includes('file') || tName.includes('note')) {
              setIsDesktopOpen(true);
            }
          } else if (msg.type === 'action_confirmation_requested') {
            setPendingConfirmation({
              id: `conf-${Date.now()}`,
              title: msg.payload?.actionType || 'Confirm Action',
              description: msg.payload?.actionDescription || 'Are you sure you want to proceed?',
              actionType: msg.payload?.actionType || 'other',
            });
          }
        } catch (e) {
          console.error('Error parsing live WS message:', e);
        }
      };

      ws.onclose = () => {
        setIsLiveConnected(false);
        setTimeout(() => {
          if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            connectLiveWebSocket();
          }
        }, 3000);
      };

      ws.onerror = (err) => {
        console.warn('Live WebSocket error:', err);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('WebSocket connection error:', err);
    }
  }, [companionEmotion.mood, sessionMemories]);

  // Establish WS connection on mount
  useEffect(() => {
    connectLiveWebSocket();
    return () => {
      wsRef.current?.close();
    };
  }, [connectLiveWebSocket]);

  // Handle Natural Interruption
  const handleNaturalInterruption = useCallback((sendSignal = true) => {
    audioPlayerRef.current?.interrupt();
    setIsInterrupted(true);
    setIsMyraaSpeaking(false);

    if (sendSignal && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }

    setTurns((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role === 'assistant' && Date.now() - last.timestamp < 12000) {
        return [
          ...prev.slice(0, -1),
          { ...last, interrupted: true },
        ];
      }
      return prev;
    });

    setTimeout(() => {
      setIsInterrupted(false);
    }, 1400);
  }, []);

  // Speak or emit commentary in Bengali for visual perception events
  const speakScreenCommentary = useCallback((bengaliAdvice: string) => {
    if (!bengaliAdvice || settingsRef.current.isQuietMode) return;
    setTurns((prev) => [
      ...prev,
      {
        id: `turn-obs-${Date.now()}`,
        role: 'assistant',
        content: bengaliAdvice,
        timestamp: Date.now(),
        emotion: 'observant & helpful',
      },
    ]);
  }, []);

  // Stop screen sharing cleanly
  const stopScreenShare = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);
  }, [screenStream]);

  // Capture frame from video or image and analyze via Gemini Vision
  const captureAndAnalyzeFrame = useCallback(
    async (providedStream?: MediaStream | null, customBase64?: string, context = 'Continuous Screen Perception') => {
      if (isAnalyzingScreen) return;
      let base64 = customBase64;

      const activeStream = providedStream || screenStream;
      if (!base64 && activeStream) {
        const videoTrack = activeStream.getVideoTracks()[0];
        if (!videoTrack || videoTrack.readyState !== 'live') {
          return;
        }

        try {
          const video = document.createElement('video');
          video.srcObject = activeStream;
          video.muted = true;
          await video.play().catch(() => {});

          if (video.videoWidth > 0 && video.videoHeight > 0) {
            const canvas = document.createElement('canvas');
            const targetWidth = 1024;
            const targetHeight = Math.round((video.videoHeight / video.videoWidth) * targetWidth);
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
              base64 = dataUrl.split(',')[1];
              setScreenPreviewImage(dataUrl);
            }
          }
        } catch (e) {
          console.warn('Frame capture from video stream warning:', e);
        }
      }

      if (!base64) return;

      try {
        setIsAnalyzingScreen(true);
        setScreenError(null);

        const res = await fetch('/api/analyze-screen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: 'image/jpeg',
            currentContext: context,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.observation) {
            const obs: ScreenEventObservation = data.observation;
            setLatestObservation(obs);
            setScreenObservations((prev) => [obs, ...prev.slice(0, 19)]);

            if (obs.riskLevel === 'critical' || obs.riskLevel === 'warning') {
              setCompanionEmotion({
                mood: obs.riskLevel === 'critical' ? 'protective' : 'attuned',
                internalThought: obs.summary,
                vocalInflection: 'cautious & warm',
                timestamp: Date.now(),
              });
            }

            if (obs.shouldSpeak && obs.adviceInBengali) {
              speakScreenCommentary(obs.adviceInBengali);
            }
          }
        }
      } catch (err: any) {
        console.warn('Screen analysis error:', err);
      } finally {
        setIsAnalyzingScreen(false);
      }
    },
    [isAnalyzingScreen, screenStream, speakScreenCommentary]
  );

  // Start live screen capture using browser getDisplayMedia
  const startScreenShare = useCallback(async () => {
    setScreenError(null);
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setScreenError('ব্রাউজার ডিরেক্ট স্ক্রিন ক্যাপচার সাপোর্ট করছে না। নিচে স্ক্রিনশট পেস্ট করুন।');
        return;
      }

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
      } catch (err1) {
        mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' } as any,
        });
      }

      mediaStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      setScreenStream(mediaStream);
      setIsScreenSharing(true);
      setScreenError(null);

      // Perform initial perception scan after video stream warms up
      setTimeout(() => {
        captureAndAnalyzeFrame(mediaStream, undefined, 'Screen Share Started - Initial Inspection');
      }, 700);
    } catch (err: any) {
      console.warn('Failed to start screen share:', err);
      const msg = err?.message || String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
        setScreenError('স্ক্রিন শেয়ার পারমিশন রিজেক্ট করা হয়েছে অথবা আইফ্রেম পলিসি অনুমতি দেয়নি। নিচে স্ক্রিনশট পেস্ট (Ctrl+V) অথবা আপলোড করুন।');
      } else {
        setScreenError('স্ক্রিন শেয়ার চালু করা যায়নি: ' + msg);
      }
    }
  }, [captureAndAnalyzeFrame, stopScreenShare]);

  // Continuous background vision loop: analyze screen every analysisIntervalSec seconds
  useEffect(() => {
    if (!isScreenSharing || !screenStream || !continuousVisionActive) return;

    const intervalId = setInterval(() => {
      captureAndAnalyzeFrame(screenStream, undefined, 'Real-Time Continuous Perception');
    }, analysisIntervalSec * 1000);

    return () => clearInterval(intervalId);
  }, [isScreenSharing, screenStream, continuousVisionActive, analysisIntervalSec, captureAndAnalyzeFrame]);

  // Handle uploaded screenshot file
  const handleUploadScreenshot = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setScreenPreviewImage(dataUrl);
        const base64 = dataUrl.split(',')[1];
        await captureAndAnalyzeFrame(null, base64, `Uploaded File: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
  }, [captureAndAnalyzeFrame]);

  // Handle paste screenshot (Ctrl+V)
  const handlePasteScreenshot = useCallback((dataUrl: string) => {
    setScreenPreviewImage(dataUrl);
    const base64 = dataUrl.split(',')[1];
    captureAndAnalyzeFrame(null, base64, 'Pasted Clipboard Screenshot');
  }, [captureAndAnalyzeFrame]);

  // Global paste listener for instant screen perception anywhere in the app
  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              if (dataUrl) {
                handlePasteScreenshot(dataUrl);
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [handlePasteScreenshot]);

  // Quick preset test scenarios (VS Code, Chrome, Task Manager)
  const handleSelectScreenPreset = useCallback((preset: 'vscode' | 'chrome' | 'taskmgr') => {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (preset === 'vscode') {
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#252526';
      ctx.fillRect(0, 0, 960, 36);
      ctx.fillStyle = '#cccccc';
      ctx.font = '14px monospace';
      ctx.fillText('app.tsx - Visual Studio Code (Workspace)', 20, 24);
      ctx.fillStyle = '#d4d4d4';
      ctx.font = '15px monospace';
      ctx.fillText('1  import { useEffect } from "react";', 30, 80);
      ctx.fillText('2  export function calculateTotal(items: any[]) {', 30, 110);
      ctx.fillStyle = '#f87171';
      ctx.fillText('3      return items.reduce((acc, i) => acc + i.price); // Missing initialValue: TypeError', 30, 140);
      ctx.fillStyle = '#ef4444';
      ctx.fillText('^^^^ TypeError: Reduce of empty array with no initial value', 120, 175);
    } else if (preset === 'chrome') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 960, 40);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '14px sans-serif';
      ctx.fillText('🔒 https://www.youtube.com - Video & Audio Stream', 40, 26);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('YouTube Music & Video Player Active', 40, 100);
    } else {
      ctx.fillStyle = '#0a0f24';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#141d3d';
      ctx.fillRect(0, 0, 960, 38);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('Windows Task Manager - Performance', 20, 25);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '22px sans-serif';
      ctx.fillText('CPU: 34% Normal · RAM: 8.2 GB / 16.0 GB (51%)', 40, 100);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setScreenPreviewImage(dataUrl);
    const base64 = dataUrl.split(',')[1];
    captureAndAnalyzeFrame(null, base64, `Simulated Preset: ${preset.toUpperCase()}`);
  }, [captureAndAnalyzeFrame]);

  // Keyboard shortcut: Spacebar to cut in / interrupt when speaking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        isSpeakingRef.current &&
        (e.target as HTMLElement).tagName !== 'INPUT' &&
        (e.target as HTMLElement).tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        handleNaturalInterruption(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNaturalInterruption]);

  // Set Quiet Mode helper
  const handleSetQuietMode = useCallback((quiet: boolean) => {
    setSettings((prev) => ({ ...prev, isQuietMode: quiet }));
    if (quiet) {
      audioPlayerRef.current?.interrupt();
      setIsMyraaSpeaking(false);
    }
  }, []);

  // Proactive Conversation Check Loop
  useEffect(() => {
    if (!settings.proactiveMode) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      const idleTimeSeconds = (now - lastUserInteractionTime.current) / 1000;
      const timeSinceLastProactive = (now - lastProactiveTime.current) / 1000;

      // Only check if user is idle beyond proactive threshold, companion is silent, and quiet mode is off
      if (
        settingsRef.current.proactiveMode &&
        !settingsRef.current.isQuietMode &&
        !isSpeakingRef.current &&
        idleTimeSeconds >= settingsRef.current.proactiveIntervalSeconds &&
        timeSinceLastProactive >= 90
      ) {
        lastProactiveTime.current = now;
        try {
          const res = await fetch('/api/proactive-thought', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recentHistory: turns.slice(-4),
              sessionMemories,
              idleSeconds: Math.round(idleTimeSeconds),
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.thought) {
              const proactiveTurn: ConversationTurn = {
                id: `proactive-${Date.now()}`,
                role: 'assistant',
                content: data.thought,
                timestamp: Date.now(),
                emotion: 'gentle check-in',
                backchannel: '✨ Proactive thought',
              };
              setTurns((prev) => [...prev, proactiveTurn]);

              // Speak gently if voice is active and not quiet
              if (!settingsRef.current.isQuietMode) {
                const ttsRes = await fetch('/api/tts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    text: data.thought,
                    voiceName: settingsRef.current.voice,
                    stylePrompt: 'Gentle, soft, thoughtful check-in',
                  }),
                });
                if (ttsRes.ok) {
                  const ttsData = await ttsRes.json();
                  if (ttsData.audioBase64) {
                    const audioBytes = atob(ttsData.audioBase64);
                    const arrayBuf = new ArrayBuffer(audioBytes.length);
                    const view = new Uint8Array(arrayBuf);
                    for (let i = 0; i < audioBytes.length; i++) {
                      view[i] = audioBytes.charCodeAt(i);
                    }
                    audioPlayerRef.current?.queueAudioData(arrayBuf);
                  }
                }
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [turns, sessionMemories, settings.proactiveMode]);

  // Setup Microphone streaming and VAD
  const startMicrophone = async () => {
    try {
      audioPlayerRef.current?.init();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const rms = calculateRMS(inputData);
        setUserVolume(rms);

        // Feedback loop prevention: during Myraa's speech, slightly raise threshold to avoid speaker bleed
        const currentSensitivity = isSpeakingRef.current
          ? settingsRef.current.vadSensitivity * 1.4
          : settingsRef.current.vadSensitivity;

        const isUserTalking = rms > currentSensitivity;
        setIsUserSpeaking(isUserTalking);

        if (isUserTalking) {
          lastUserInteractionTime.current = Date.now();
        }

        // Natural Interruption via VAD
        if (isSpeakingRef.current && settingsRef.current.autoInterrupt) {
          if (isUserTalking) {
            vadActiveCountRef.current += 1;
            if (vadActiveCountRef.current >= 2) {
              handleNaturalInterruption(true);
              vadActiveCountRef.current = 0;
            }
          } else {
            vadActiveCountRef.current = 0;
          }
        } else {
          vadActiveCountRef.current = 0;
        }

        // Stream audio chunk to Live WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const pcmBuffer = floatTo16BitPCM(inputData);
          const base64Audio = arrayBufferToBase64(pcmBuffer);
          wsRef.current.send(
            JSON.stringify({
              type: 'audio',
              audio: base64Audio,
            })
          );
        }
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);
      setIsMicActive(true);

      // Browser Web Speech recognition for local transcript
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              const text = event.results[i][0].transcript.trim();
              if (text) {
                lastUserInteractionTime.current = Date.now();
                handleProcessSpokenInput(text);
              }
            }
          }
        };

        try {
          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      console.info('[Microphone Status]', err?.name || 'Permission notice');
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        String(err?.message || '').toLowerCase().includes('permission denied') ||
        String(err?.message || '').toLowerCase().includes('denied');
      setMicPermissionError(
        isDenied
          ? 'Microphone access is blocked in this window. Click "Type Instead" or grant microphone permission in your browser address bar. You can converse freely by typing!'
          : 'Microphone is unavailable on this device. You can converse freely with Myraa by typing below!'
      );
      setIsMicActive(false);
      setUserVolume(0);
    }
  };

  const stopMicrophone = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      speechRecognitionRef.current = null;
    }
    setIsMicActive(false);
    setIsUserSpeaking(false);
    setUserVolume(0);
  };

  const toggleMicrophone = () => {
    if (isMicActive) {
      stopMicrophone();
    } else {
      startMicrophone();
    }
  };

  // Process spoken input with local intent shortcuts (silence command, desktop actions)
  const handleProcessSpokenInput = (text: string) => {
    const lower = text.toLowerCase();

    // Check silence commands
    const isSilenceCommand =
      /^(be quiet|stop talking|shut up|hush|quiet mode|please be quiet|stop speaking|be silent|pause)/i.test(
        lower
      ) ||
      lower.includes('stop talking for a while') ||
      lower.includes("i'm busy");

    if (isSilenceCommand) {
      handleSetQuietMode(true);
      const userTurn: ConversationTurn = {
        id: `turn-user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      const asstTurn: ConversationTurn = {
        id: `turn-asst-${Date.now()}`,
        role: 'assistant',
        content: 'Understood. Staying completely quiet.',
        timestamp: Date.now(),
        emotion: 'quiet & respectful',
      };
      setTurns((prev) => [...prev, userTurn, asstTurn]);
      return;
    }

    // If quiet mode was on, check if user is resuming
    if (settingsRef.current.isQuietMode) {
      const isResume =
        /^(hey myraa|hello myraa|myraa|you can talk|you can speak|speak now|talk to me|resume|unmute)/i.test(
          lower
        );
      if (isResume) {
        handleSetQuietMode(false);
      }
    }

    // Check desktop note command
    const noteMatch = text.match(/(?:note down|take a note|create note|write down)[:\s]+(.+)/i);
    if (noteMatch && noteMatch[1]) {
      const noteContent = noteMatch[1].trim();
      const newNote: DesktopNote = {
        id: `note-${Date.now()}`,
        title: noteContent.slice(0, 32),
        content: noteContent,
        createdAt: Date.now(),
      };
      setNotes((prev) => [newNote, ...prev]);
      const userTurn: ConversationTurn = {
        id: `turn-user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      const asstTurn: ConversationTurn = {
        id: `turn-asst-${Date.now()}`,
        role: 'assistant',
        content: `Got it. Noted that down for you.`,
        timestamp: Date.now(),
        toolCall: { toolName: 'Desktop Note', details: newNote.title },
      };
      setTurns((prev) => [...prev, userTurn, asstTurn]);
      return;
    }

    // Check timer command: "set a [number] minute timer"
    const timerMatch = text.match(/set (?:a|an) (\d+(?:\.\d+)?)\s*(?:minute|min|second|sec) timer(?: for (.+))?/i);
    if (timerMatch && timerMatch[1]) {
      const val = parseFloat(timerMatch[1]);
      const isSec = text.toLowerCase().includes('second') || text.toLowerCase().includes('sec');
      const durationSeconds = Math.round(isSec ? val : val * 60);
      const label = timerMatch[2]?.trim() || `${val}${isSec ? 's' : 'm'} Timer`;
      const newTimer: DesktopTimer = {
        id: `timer-${Date.now()}`,
        label,
        durationSeconds,
        remainingSeconds: durationSeconds,
        isRunning: true,
        startedAt: Date.now(),
      };
      setTimers((prev) => [...prev, newTimer]);
      const userTurn: ConversationTurn = {
        id: `turn-user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      const asstTurn: ConversationTurn = {
        id: `turn-asst-${Date.now()}`,
        role: 'assistant',
        content: `Timer set for ${val} ${isSec ? 'seconds' : 'minutes'}.`,
        timestamp: Date.now(),
        toolCall: { toolName: 'Desktop Timer', details: label },
      };
      setTurns((prev) => [...prev, userTurn, asstTurn]);
      return;
    }

    // Standard conversation turn
    handleSendMessage(text);
  };

  // Memory extraction helper after user turns
  const triggerMemoryExtraction = async (recentText: string) => {
    try {
      const response = await fetch('/api/extract-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dialogueHistory: [...turns, { role: 'user', content: recentText }],
          currentMemories: sessionMemories,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.newMemories?.length) {
          setSessionMemories((prev) => [
            ...prev,
            ...data.newMemories.map((m: any) => ({
              id: `mem-${Date.now()}-${Math.random()}`,
              category: m.category || 'context',
              key: m.key,
              detail: m.detail,
              emotionalTone: m.emotionalTone,
              timestamp: Date.now(),
            })),
          ]);
        }
        if (data.detectedSilenceCommand) {
          handleSetQuietMode(true);
        }
        if (data.moodInsight?.primaryMood) {
          setCompanionEmotion((prev) => ({
            ...prev,
            mood: data.moodInsight.primaryMood,
            internalThought: data.moodInsight.vibeSummary || prev.internalThought,
            timestamp: Date.now(),
          }));
        }
      }
    } catch (e) {
      console.warn('Memory extraction failed:', e);
    }
  };

  // Handle desktop tool actions arriving from server or tools
  const handleDesktopToolAction = (tool: string, payload: any) => {
    if (tool === 'create_note' && payload?.title) {
      const note: DesktopNote = {
        id: `note-${Date.now()}`,
        title: payload.title,
        content: payload.content || payload.title,
        createdAt: Date.now(),
      };
      setNotes((prev) => [note, ...prev]);
    } else if (tool === 'set_timer' && payload?.durationSeconds) {
      const timer: DesktopTimer = {
        id: `timer-${Date.now()}`,
        label: payload.label || 'Countdown',
        durationSeconds: payload.durationSeconds,
        remainingSeconds: payload.durationSeconds,
        isRunning: true,
        startedAt: Date.now(),
      };
      setTimers((prev) => [...prev, timer]);
    } else if (tool === 'manage_task' && payload?.action === 'add' && payload?.text) {
      const task: DesktopTask = {
        id: `task-${Date.now()}`,
        text: payload.text,
        completed: false,
        createdAt: Date.now(),
      };
      setTasks((prev) => [...prev, task]);
    } else if (tool === 'open_website' || tool === 'open-website') {
      const target = payload?.url || payload?.args?.url || 'https://www.google.com';
      setBrowserUrl(target);
      setIsBrowserOpen(true);
    } else if (tool === 'open_application' || tool === 'open-application') {
      const app = (payload?.app_name || payload?.appName || '').toLowerCase();
      if (app.includes('chrome') || app.includes('edge') || app.includes('browser')) {
        setBrowserUrl('https://www.google.com');
        setIsBrowserOpen(true);
      } else if (app.includes('note')) {
        setIsDesktopOpen(true);
      } else if (app.includes('calc')) {
        setIsDesktopOpen(true);
      } else {
        setIsWindowsAutomationOpen(true);
      }
    }
  };

  // Send message (typed or spoken)
  const handleSendMessage = async (text: string) => {
    lastUserInteractionTime.current = Date.now();

    // If interrupted, kill any ongoing speech
    if (isSpeakingRef.current) {
      handleNaturalInterruption(true);
    }

    const lower = text.toLowerCase().trim();

    // Check silence commands
    const isSilenceCommand =
      /^(be quiet|stop talking|shut up|hush|quiet mode|please be quiet|stop speaking|be silent|pause)/i.test(
        lower
      ) ||
      lower.includes('stop talking for a while') ||
      lower.includes("i'm busy");

    if (isSilenceCommand) {
      handleSetQuietMode(true);
      const userTurn: ConversationTurn = {
        id: `turn-user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      const asstTurn: ConversationTurn = {
        id: `turn-asst-${Date.now()}`,
        role: 'assistant',
        content: 'Understood. Staying completely quiet.',
        timestamp: Date.now(),
        emotion: 'quiet & respectful',
      };
      setTurns((prev) => [...prev, userTurn, asstTurn]);
      return;
    }

    // Check if user is resuming from quiet mode
    if (settingsRef.current.isQuietMode) {
      const isResume =
        /^(hey myraa|hello myraa|myraa|you can talk|you can speak|speak now|talk to me|resume|unmute)/i.test(
          lower
        );
      if (isResume) {
        handleSetQuietMode(false);
      }
    }

    // Direct instant website launch (Bengali, English, Banglish)
    let directWebUrl: string | null = null;
    if (lower.includes('youtube') || lower.includes('ইউটিউব')) {
      directWebUrl = 'https://www.youtube.com';
      const searchMatch = lower.match(/(?:play|search|গান|ভিডিও)\s+(.+?)\s+(?:on|in)?\s*youtube/i) ||
                         lower.match(/youtube\s+(?:e|te|এ|তে)?\s*(.+?)\s*(?:search|khoro|খোঁজ|চালাও)/i);
      if (searchMatch && searchMatch[1]) {
        directWebUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchMatch[1].trim())}`;
      }
    } else if (lower.includes('google') || lower.includes('গুগল')) {
      directWebUrl = 'https://www.google.com';
    } else if (lower.includes('facebook') || lower.includes('ফেসবুক')) {
      directWebUrl = 'https://www.facebook.com';
    } else if (lower.includes('github') || lower.includes('গিটহাব')) {
      directWebUrl = 'https://github.com';
    } else if (lower.includes('wikipedia') || lower.includes('উইকিপিডিয়া')) {
      directWebUrl = 'https://en.wikipedia.org';
    } else {
      const explicitDomain = lower.match(/(?:open|browse|go to|খোলো|ওপেন)\s+([a-z0-9-]+\.(?:com|org|net|io|dev|ai|edu|gov|bd|app)(?:\/[^\s]*)?)/i);
      if (explicitDomain) {
        directWebUrl = `https://${explicitDomain[1]}`;
      }
    }

    if (directWebUrl) {
      setBrowserUrl(directWebUrl);
      setIsBrowserOpen(true);
    }

    if (lower.includes('notepad') || lower.includes('নোটপ্যাড')) {
      setIsDesktopOpen(true);
    } else if (lower.includes('calculator') || lower.includes('ক্যালকুলেটর')) {
      setIsDesktopOpen(true);
    } else if (lower.includes('vscode') || lower.includes('কোড এডিটর') || lower.includes('ভিএস কোড')) {
      setIsWindowsAutomationOpen(true);
    }

    // Check desktop note command
    const noteMatch = text.match(/(?:note down|take a note|create note|write down)[:\s]+(.+)/i);
    if (noteMatch && noteMatch[1]) {
      const noteContent = noteMatch[1].trim();
      const newNote: DesktopNote = {
        id: `note-${Date.now()}`,
        title: noteContent.slice(0, 32),
        content: noteContent,
        createdAt: Date.now(),
      };
      setNotes((prev) => [newNote, ...prev]);
      const userTurn: ConversationTurn = {
        id: `turn-user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      const asstTurn: ConversationTurn = {
        id: `turn-asst-${Date.now()}`,
        role: 'assistant',
        content: `Got it. Noted that down on your desktop scratchpad.`,
        timestamp: Date.now(),
        toolCall: { toolName: 'Desktop Note', details: newNote.title },
      };
      setTurns((prev) => [...prev, userTurn, asstTurn]);
      return;
    }

    // Check timer command
    const timerMatch = text.match(/set (?:a|an) (\d+(?:\.\d+)?)\s*(?:minute|min|second|sec) timer(?: for (.+))?/i);
    if (timerMatch && timerMatch[1]) {
      const val = parseFloat(timerMatch[1]);
      const isSec = text.toLowerCase().includes('second') || text.toLowerCase().includes('sec');
      const durationSeconds = Math.round(isSec ? val : val * 60);
      const label = timerMatch[2]?.trim() || `${val}${isSec ? 's' : 'm'} Timer`;
      const newTimer: DesktopTimer = {
        id: `timer-${Date.now()}`,
        label,
        durationSeconds,
        remainingSeconds: durationSeconds,
        isRunning: true,
        startedAt: Date.now(),
      };
      setTimers((prev) => [...prev, newTimer]);
      const userTurn: ConversationTurn = {
        id: `turn-user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      const asstTurn: ConversationTurn = {
        id: `turn-asst-${Date.now()}`,
        role: 'assistant',
        content: `Timer set for ${val} ${isSec ? 'seconds' : 'minutes'}.`,
        timestamp: Date.now(),
        toolCall: { toolName: 'Desktop Timer', details: label },
      };
      setTurns((prev) => [...prev, userTurn, asstTurn]);
      return;
    }

    const userTurn: ConversationTurn = {
      id: `turn-user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setTurns((prev) => [...prev, userTurn]);
    setIsThinking(true);

    // If WebSocket is open and not in quiet mode, send text to live session
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !settingsRef.current.isQuietMode) {
      wsRef.current.send(JSON.stringify({ type: 'text', text }));
      triggerMemoryExtraction(text);
      return;
    }

    // Fallback: REST chat stream + TTS
    try {
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...turns, userTurn],
          sessionMemory: sessionMemories,
          companionTone: settings.pacing,
          isQuietMode: settingsRef.current.isQuietMode,
        }),
      });

      if (!chatRes.ok || !chatRes.body) {
        throw new Error('Failed to reach chat endpoint');
      }

      const reader = chatRes.body.getReader();
      const decoder = new TextDecoder();
      let fullAssistantText = '';
      let executedAction: WindowsAutomationAction | undefined = undefined;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.tool_action) {
                const toolAct = data.tool_action;
                const newAction: WindowsAutomationAction = {
                  id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  toolName: toolAct.toolName,
                  params: toolAct.args || {},
                  description: `Executed ${toolAct.toolName}`,
                  requiresConfirmation: false,
                  status: toolAct.result?.success ? 'completed' : 'failed',
                  result: toolAct.result,
                  taskId: toolAct.result?.task_id,
                  pid: toolAct.result?.pid,
                  error: toolAct.result?.error,
                  timestamp: Date.now(),
                };
                executedAction = newAction;
                windowsServiceRef.current?.addActionToHistory(newAction);
                setWindowsHistory(windowsServiceRef.current?.getHistory() || []);
                if (toolAct.result?.success) {
                  setWindowsConfig((prev) => ({ ...prev, isConnected: true }));
                }

                // Immediately open the interactive browser or desktop panel for user
                const tName = (toolAct.toolName || '').toLowerCase();
                if (tName.includes('website') || tName.includes('web')) {
                  const target = toolAct.args?.url || toolAct.result?.url || 'https://www.google.com';
                  setBrowserUrl(target);
                  setIsBrowserOpen(true);
                } else if (tName.includes('application') || tName.includes('app')) {
                  const app = (toolAct.args?.app_name || toolAct.args?.appName || '').toLowerCase();
                  if (app.includes('chrome') || app.includes('edge') || app.includes('browser')) {
                    setBrowserUrl('https://www.google.com');
                    setIsBrowserOpen(true);
                  } else if (app.includes('note')) {
                    setIsDesktopOpen(true);
                  } else if (app.includes('calc')) {
                    setIsDesktopOpen(true);
                  } else {
                    setIsWindowsAutomationOpen(true);
                  }
                } else if (tName.includes('file')) {
                  setIsDesktopOpen(true);
                }
              }
              if (data.text) {
                fullAssistantText += data.text;
                setLiveStreamingText(fullAssistantText);
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }

      setIsThinking(false);
      setLiveStreamingText('');

      if (fullAssistantText.trim()) {
        const assistantTurn: ConversationTurn = {
          id: `turn-asst-${Date.now()}`,
          role: 'assistant',
          content: fullAssistantText.trim(),
          timestamp: Date.now(),
          emotion: companionEmotion.mood,
          toolCall: executedAction
            ? {
                toolName: `PC: ${executedAction.toolName}`,
                details: executedAction.error || (executedAction.pid ? `PID: ${executedAction.pid}` : 'Done'),
                status: executedAction.status === 'completed' ? 'success' : 'failed',
              }
            : undefined,
        };
        setTurns((prev) => [...prev, assistantTurn]);

        // Synthesize voice via /api/tts ONLY if not in quiet mode
        if (!settingsRef.current.isQuietMode) {
          const ttsRes = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: fullAssistantText.trim(),
              voiceName: settings.voice,
              stylePrompt: `${companionEmotion.mood}, natural companion speaking warmly`,
            }),
          });

          if (ttsRes.ok) {
            const ttsData = await ttsRes.json();
            if (ttsData.audioBase64) {
              const audioBytes = atob(ttsData.audioBase64);
              const arrayBuf = new ArrayBuffer(audioBytes.length);
              const view = new Uint8Array(arrayBuf);
              for (let i = 0; i < audioBytes.length; i++) {
                view[i] = audioBytes.charCodeAt(i);
              }
              audioPlayerRef.current?.queueAudioData(arrayBuf);
            } else if ('speechSynthesis' in window && !settingsRef.current.isQuietMode) {
              const utterance = new SpeechSynthesisUtterance(fullAssistantText.trim());
              utterance.rate = settings.speakingSpeed || 1.0;
              utterance.volume = settings.speakingVolume ?? 1.0;
              utterance.onstart = () => setIsMyraaSpeaking(true);
              utterance.onend = () => setIsMyraaSpeaking(false);
              window.speechSynthesis.speak(utterance);
            }
          }
        }
      }

      triggerMemoryExtraction(text);
    } catch {
      setIsThinking(false);
      setLiveStreamingText('');
    }
  };

  const handleAddManualMemory = async (
    category: SessionMemoryItem['category'],
    key: string,
    detail: string
  ) => {
    try {
      const saved = await saveMemory({
        category,
        key,
        detail,
        emotionalTone: 'manual',
        isConfirmedByUser: true,
        isAssumption: false,
      });
      setSessionMemories((prev) => [
        ...prev.filter((m) => m.id !== saved.id && m.key.toLowerCase() !== key.toLowerCase()),
        saved,
      ]);
    } catch (e: any) {
      console.error('Failed to save manual memory:', e);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await deleteMemoryStorage(id);
    } catch (e) {
      // ignore
    }
    setSessionMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const handleClearMemories = () => {
    setPendingConfirmation({
      id: `conf-clear-mem-${Date.now()}`,
      title: 'Clear Session Memory',
      description:
        'Are you sure you want to forget all facts and preferences learned during this session? This cannot be undone.',
      actionType: 'clear_memory',
    });
  };

  const handleClearAllAssistantData = () => {
    setPendingConfirmation({
      id: `conf-clear-all-${Date.now()}`,
      title: 'Clear All Desktop Assistant Data',
      description:
        'Are you sure you want to delete all notes, countdown timers, and tasks from your session?',
      actionType: 'clear_notes',
    });
  };

  const handleExecuteConfirmation = async () => {
    if (!pendingConfirmation) return;
    if (pendingConfirmation.actionType === 'clear_memory') {
      try {
        await clearAllMemoriesStorage();
      } catch (e) {
        // ignore
      }
      setSessionMemories([]);
    } else if (pendingConfirmation.actionType === 'clear_notes') {
      setNotes([]);
      setTimers([]);
      setTasks([]);
    } else if (pendingConfirmation.actionType === 'automation_action') {
      const actionId = pendingConfirmation.payload?.actionId;
      if (actionId && windowsServiceRef.current) {
        await windowsServiceRef.current.executeTool(actionId);
        setWindowsHistory(windowsServiceRef.current.getHistory());
      }
    }
    setPendingConfirmation(null);
  };

  // Check if opened from mobile phone (?mode=mobile)
  const isMobileUrlMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'mobile';
  if (isMobileUrlMode) {
    return (
      <MobileCompanionView
        pairCode="MYRAA-8842"
        onExitMobileMode={() => {
          window.location.href = window.location.origin;
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-indigo-500/30 selection:text-white relative overflow-hidden">
      {/* Background ethereal radial gradient */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-[140px] opacity-20 transition-all duration-1000"
        style={{
          background: settings.isQuietMode
            ? 'radial-gradient(circle, #f59e0b 0%, #475569 50%, transparent 80%)'
            : companionEmotion.mood.includes('warm') || companionEmotion.mood.includes('empath')
            ? 'radial-gradient(circle, #f97316 0%, #ec4899 50%, transparent 80%)'
            : 'radial-gradient(circle, #6366f1 0%, #14b8a6 50%, transparent 80%)',
        }}
      />

      {/* Main 3-Column Dashboard Layout (Left Sidebar, Center Hero Workspace, Right Controls & System Panels) */}
      <div className="flex-1 w-full flex flex-col lg:flex-row overflow-hidden relative z-10 h-screen">
        {/* Column 1: Left Sidebar (~18-20%) */}
        <DashboardSidebar
          currentSection={currentSection}
          onSelectSection={handleSelectSection}
          isAgentConnected={windowsConfig.isConnected}
          isLiveConnected={isLiveConnected}
          isMicActive={isMicActive}
          memoryCount={sessionMemories.length}
          desktopItemCount={notes.length + timers.length + tasks.length}
          onQuickTalkClick={toggleMicrophone}
        />

        {/* Column 2: Center Hero Workspace (~54%) */}
        <main className="flex-1 min-w-0 p-2 sm:p-3 lg:p-4 flex flex-col items-center justify-start overflow-y-auto relative z-10">
          <CenterDashboardWorkspace
            isMicActive={isMicActive}
            isMyraaSpeaking={isMyraaSpeaking}
            isUserSpeaking={isUserSpeaking}
            isInterrupted={isInterrupted}
            isThinking={isThinking}
            isLiveConnected={isLiveConnected}
            isQuietMode={settings.isQuietMode}
            companionEmotion={companionEmotion}
            outputAnalyser={audioPlayerRef.current?.getAnalyser()}
            userVolume={userVolume}
            liveStreamingText={liveStreamingText}
            turns={turns}
            onToggleMic={toggleMicrophone}
            onInterrupt={() => {
              if (isMyraaSpeaking) {
                handleNaturalInterruption(true);
              }
            }}
            onSendMessage={handleSendMessage}
            onOpenScreenModal={() => setIsScreenViewOpen(true)}
            onOpenComputerModal={() => setIsWindowsAutomationOpen(true)}
            onOpenMemoryModal={() => setIsMemoryOpen(true)}
            onToggleQuietMode={() => handleSetQuietMode(!settings.isQuietMode)}
            isScreenSharing={isScreenSharing}
            screenStream={screenStream}
            latestObservation={latestObservation}
            isAnalyzingScreen={isAnalyzingScreen}
            screenError={screenError}
            continuousVisionActive={continuousVisionActive}
            onStartScreenShare={startScreenShare}
            onStopScreenShare={stopScreenShare}
            onTriggerQuickScan={() => captureAndAnalyzeFrame(screenStream, undefined, 'Manual Quick Scan')}
            onToggleContinuousVision={() => setContinuousVisionActive(!continuousVisionActive)}
            onUploadScreenshot={handleUploadScreenshot}
            onSelectScreenPreset={handleSelectScreenPreset}
          />
        </main>

        {/* Column 3: Right Column (~28%) - System Status, Quick Actions, Phone, Voice Settings or Live Transcript */}
        <div className="w-full lg:w-[320px] xl:w-[350px] shrink-0 p-2 sm:p-3 lg:p-4 flex flex-col gap-3 overflow-y-auto border-t lg:border-t-0 lg:border-l border-[#1e2a4a]/80 bg-[#080d1e]/50 backdrop-blur-xl">
          {/* Tab Switcher: System & Actions vs Live Transcript */}
          <div className="flex items-center justify-between bg-[#090e21] p-1 rounded-xl border border-[#1e2a4a] text-xs">
            <button
              onClick={() => setRightColumnTab('system')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all ${
                rightColumnTab === 'system'
                  ? 'bg-gradient-to-r from-purple-600/40 to-blue-600/40 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              System & Actions
            </button>
            <button
              onClick={() => setRightColumnTab('transcript')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
                rightColumnTab === 'transcript'
                  ? 'bg-gradient-to-r from-purple-600/40 to-blue-600/40 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Live Transcript</span>
              {turns.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono border border-cyan-500/30">
                  {turns.length}
                </span>
              )}
            </button>
          </div>

          {rightColumnTab === 'transcript' ? (
            <div className="h-[650px] flex flex-col">
              <LiveTranscript
                turns={turns}
                liveStreamingText={liveStreamingText}
                isStreaming={isThinking || isMyraaSpeaking}
                onSendMessage={handleSendMessage}
                onTriggerPrompt={handleSendMessage}
              />
            </div>
          ) : (
            <DashboardRightColumn
              sessionDuration={sessionDuration}
              isAgentConnected={windowsConfig.isConnected}
              proactiveMode={settings.proactiveMode}
              onToggleProactiveMode={(enabled) =>
                setSettings((prev) => ({ ...prev, proactiveMode: enabled }))
              }
              onOpenAppAction={(appName) => {
                const clean = appName.toLowerCase();
                if (clean.includes('chrome') || clean.includes('edge') || clean.includes('browser')) {
                  setBrowserUrl('https://www.google.com');
                  setIsBrowserOpen(true);
                } else if (clean.includes('note')) {
                  setIsDesktopOpen(true);
                } else if (clean.includes('calc')) {
                  setIsDesktopOpen(true);
                } else {
                  setIsWindowsAutomationOpen(true);
                }
                if (windowsServiceRef.current) {
                  const act = windowsServiceRef.current.createAction(
                    'OpenApprovedApplication',
                    { app_name: appName },
                    `Launch ${appName}`
                  );
                  setWindowsHistory(windowsServiceRef.current.getHistory());
                  windowsServiceRef.current.executeTool(act.id);
                }
              }}
              onOpenFileManager={() => setIsDesktopOpen(true)}
              onTakeScreenshot={() => setIsScreenViewOpen(true)}
              onRecordScreen={() => setIsScreenViewOpen(true)}
              onOpenTaskManager={() => setIsWindowsAutomationOpen(true)}
              onOpenBrowser={() => {
                setBrowserUrl('https://www.google.com');
                setIsBrowserOpen(true);
                if (windowsServiceRef.current) {
                  const act = windowsServiceRef.current.createAction(
                    'OpenWebsite',
                    { url: 'https://google.com' },
                    'Open Google'
                  );
                  setWindowsHistory(windowsServiceRef.current.getHistory());
                  windowsServiceRef.current.executeTool(act.id);
                }
              }}
              onFocusMessageInput={() => {
                const el = document.querySelector('input[placeholder*="thought"]') as HTMLInputElement;
                el?.focus();
              }}
              onRequestShutdown={() => {
                setPendingConfirmation({
                  id: `conf-shutdown-${Date.now()}`,
                  title: 'Disconnect Myraa Companion',
                  description: 'Are you sure you want to pause the live session and standby?',
                  actionType: 'clear_memory',
                });
              }}
              languageMode={settings.languageMode || 'bangla'}
              onChangeLanguageMode={(lang) =>
                setSettings((prev) => ({ ...prev, languageMode: lang }))
              }
              voicePersona={settings.voice}
              onChangeVoicePersona={(voice) =>
                setSettings((prev) => ({ ...prev, voice }))
              }
            />
          )}
        </div>
      </div>

      {/* Floating quick starter in immersive mode */}
      {layoutMode === 'immersive' && turns.length === 0 && !isMicActive && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-700/60 shadow-xl backdrop-blur-md">
          <Info className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs text-slate-300">
            Click the microphone above or say &ldquo;Hey Myraa&rdquo; to begin speaking naturally.
          </span>
        </div>
      )}

      {/* Active Session Memory Drawer */}
      <MemoryDrawer
        isOpen={isMemoryOpen}
        onClose={() => setIsMemoryOpen(false)}
        memories={sessionMemories}
        companionEmotion={companionEmotion}
        onAddMemory={handleAddManualMemory}
        onDeleteMemory={handleDeleteMemory}
        onClearMemories={handleClearMemories}
        onOpenManager={() => setIsMemoryManagerOpen(true)}
      />

      {/* Full Persistent Memory Manager Modal */}
      <MemoryManagerModal
        isOpen={isMemoryManagerOpen}
        onClose={() => setIsMemoryManagerOpen(false)}
        memories={sessionMemories}
        onSaveMemory={async (item) => {
          const saved = await saveMemory(item);
          setSessionMemories((prev) => [
            ...prev.filter((m) => m.id !== saved.id && m.key !== saved.key),
            saved,
          ]);
        }}
        onUpdateMemory={async (id, updates) => {
          const updated = await updateMemoryStorage(id, updates);
          setSessionMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
        }}
        onDeleteMemory={async (id) => {
          await deleteMemoryStorage(id);
          setSessionMemories((prev) => prev.filter((m) => m.id !== id));
        }}
        onClearAllMemories={handleClearMemories}
        onExportJSON={async () => {
          const jsonStr = await exportMemoriesJSON();
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `myraa_memories_${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        onImportJSON={async (jsonStr) => {
          await importMemoriesJSON(jsonStr);
          const fresh = await loadAllMemories();
          setSessionMemories(fresh);
        }}
      />

      {/* Windows PC Automation Panel */}
      <WindowsAutomationPanel
        isOpen={isWindowsAutomationOpen}
        onClose={() => setIsWindowsAutomationOpen(false)}
        config={windowsConfig}
        history={windowsHistory}
        onCheckConnection={async () => {
          if (!windowsServiceRef.current) return false;
          const ok = await windowsServiceRef.current.checkConnection();
          setWindowsConfig(windowsServiceRef.current.getConfig());
          return ok;
        }}
        onEmergencyStop={() => {
          windowsServiceRef.current?.emergencyStop();
          if (windowsServiceRef.current) {
            setWindowsHistory(windowsServiceRef.current.getHistory());
          }
        }}
        onResumeAutomation={() => {
          windowsServiceRef.current?.resumeAutomation();
        }}
        onExecuteTool={async (toolName, params, description) => {
          if (!windowsServiceRef.current) return;
          const action = windowsServiceRef.current.createAction(toolName, params, description);
          setWindowsHistory(windowsServiceRef.current.getHistory());
          if (action.requiresConfirmation) {
            setPendingConfirmation({
              id: `conf-win-${action.id}`,
              title: `Authorize Windows Action: ${toolName}`,
              description: `Myraa wants to execute: "${description}". Allow this desktop automation task?`,
              actionType: 'automation_action',
              payload: { actionId: action.id },
            });
            return;
          }
          await windowsServiceRef.current.executeTool(action.id);
          setWindowsHistory(windowsServiceRef.current.getHistory());
        }}
        onCancelAction={(id) => {
          windowsServiceRef.current?.cancelAction(id);
          if (windowsServiceRef.current) {
            setWindowsHistory(windowsServiceRef.current.getHistory());
          }
        }}
        onSaveConfig={(updates) => {
          windowsServiceRef.current?.saveConfig(updates);
          if (windowsServiceRef.current) {
            setWindowsConfig(windowsServiceRef.current.getConfig());
          }
        }}
      />

      {/* Voice Persona & Companion Settings Modal */}
      <VoiceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
      />

      {/* Desktop Assistant Panel */}
      <DesktopAssistantPanel
        isOpen={isDesktopOpen}
        onClose={() => setIsDesktopOpen(false)}
        notes={notes}
        timers={timers}
        tasks={tasks}
        isQuietMode={settings.isQuietMode}
        proactiveMode={settings.proactiveMode}
        onToggleQuietMode={handleSetQuietMode}
        onToggleProactiveMode={(proactive) =>
          setSettings((prev) => ({ ...prev, proactiveMode: proactive }))
        }
        onCreateNote={(title, content) =>
          setNotes((prev) => [{ id: `note-${Date.now()}`, title, content, createdAt: Date.now() }, ...prev])
        }
        onDeleteNote={(id) => setNotes((prev) => prev.filter((n) => n.id !== id))}
        onCreateTimer={(durationSeconds, label) =>
          setTimers((prev) => [
            ...prev,
            {
              id: `timer-${Date.now()}`,
              label,
              durationSeconds,
              remainingSeconds: durationSeconds,
              isRunning: true,
              startedAt: Date.now(),
            },
          ])
        }
        onDeleteTimer={(id) => setTimers((prev) => prev.filter((t) => t.id !== id))}
        onToggleTask={(id) =>
          setTasks((prev) =>
            prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
          )
        }
        onAddTask={(text) =>
          setTasks((prev) => [
            ...prev,
            { id: `task-${Date.now()}`, text, completed: false, createdAt: Date.now() },
          ])
        }
        onDeleteTask={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
        onClearAllData={handleClearAllAssistantData}
      />

      {/* Action Confirmation Modal */}
      <ConfirmationModal
        pendingConfirmation={pendingConfirmation}
        onConfirm={handleExecuteConfirmation}
        onCancel={() => setPendingConfirmation(null)}
      />

      {/* Real-Time Screen Perception & Vision Panel */}
      <ScreenViewPanel
        isOpen={isScreenViewOpen}
        onClose={() => setIsScreenViewOpen(false)}
        globalStream={screenStream}
        isGloballyCapturing={isScreenSharing}
        globalObservations={screenObservations}
        latestObservation={latestObservation}
        onGlobalStartCapture={startScreenShare}
        onGlobalStopCapture={stopScreenShare}
        onGlobalAnalyzeFrame={captureAndAnalyzeFrame}
        continuousVisionActive={continuousVisionActive}
        onToggleContinuousVision={() => setContinuousVisionActive(!continuousVisionActive)}
        onSpeakCommentary={(bengaliAdvice) => {
          handleSendMessage(`[Screen Event]: ${bengaliAdvice}`);
        }}
      />

      {/* Interactive Web Browser Modal */}
      <WebBrowserModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        initialUrl={browserUrl}
      />
    </div>
  );
}

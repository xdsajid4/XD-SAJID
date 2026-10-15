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
import { CompanionAura } from './components/CompanionAura';
import { CompanionHeader } from './components/CompanionHeader';
import { MemoryDrawer } from './components/MemoryDrawer';
import { MemoryManagerModal } from './components/MemoryManagerModal';
import { WindowsAutomationPanel } from './components/WindowsAutomationPanel';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { DesktopAssistantPanel } from './components/DesktopAssistantPanel';
import { ConfirmationModal } from './components/ConfirmationModal';
import { LiveTranscript } from './components/LiveTranscript';
import { WindowsAutomationService } from './utils/windowsAutomation';
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
                    const blob = new Blob([arrayBuf], { type: 'audio/wav' });
                    const url = URL.createObjectURL(blob);
                    const audio = new Audio(url);
                    audio.onplay = () => setIsMyraaSpeaking(true);
                    audio.onended = () => setIsMyraaSpeaking(false);
                    audio.play();
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
              const blob = new Blob([arrayBuf], { type: 'audio/wav' });
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              audio.playbackRate = settings.speakingSpeed || 1.0;
              audio.volume = settings.speakingVolume ?? 1.0;
              audio.onplay = () => setIsMyraaSpeaking(true);
              audio.onended = () => setIsMyraaSpeaking(false);
              audio.play().catch(() => {
                // Autoplay gesture blocked: fallback to window speech synthesis
                if ('speechSynthesis' in window && !settingsRef.current.isQuietMode) {
                  const utterance = new SpeechSynthesisUtterance(fullAssistantText.trim());
                  utterance.rate = settings.speakingSpeed || 1.0;
                  utterance.volume = settings.speakingVolume ?? 1.0;
                  utterance.onstart = () => setIsMyraaSpeaking(true);
                  utterance.onend = () => setIsMyraaSpeaking(false);
                  window.speechSynthesis.speak(utterance);
                }
              });
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

      {/* Header */}
      <CompanionHeader
        voice={settings.voice}
        memoryCount={sessionMemories.length}
        desktopItemCount={notes.length + timers.length + tasks.length}
        isConnected={isLiveConnected}
        isLiveApi={true}
        isQuietMode={settings.isQuietMode}
        isAgentConnected={windowsConfig.isConnected}
        ambientSound={settings.ambientSound}
        sessionDuration={sessionDuration}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenMemory={() => setIsMemoryOpen(true)}
        onOpenDesktopAssistant={() => setIsDesktopOpen(true)}
        onOpenWindowsAutomation={() => setIsWindowsAutomationOpen(true)}
        onToggleAmbient={() => {
          setSettings((prev) => ({
            ...prev,
            ambientSound: prev.ambientSound === 'none' ? 'rain' : 'none',
          }));
        }}
        onToggleQuietMode={() => handleSetQuietMode(!settings.isQuietMode)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6 items-stretch justify-center relative z-10 overflow-hidden">
        {/* Left / Center Living Aura Stage */}
        <section
          className={`flex-1 flex flex-col items-center justify-between transition-all duration-300 ${
            layoutMode === 'immersive' ? 'max-w-2xl mx-auto w-full' : ''
          }`}
        >
          {/* Top Status & View Selector */}
          <div className="w-full flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Persona: <strong className="text-slate-200 font-medium">{settings.voice}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{settings.pacing} Pacing</span>
              {settings.proactiveMode && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-indigo-400">Proactive ON</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setLayoutMode('immersive')}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                  layoutMode === 'immersive'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Full Focus Living View"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Living</span>
              </button>
              <button
                onClick={() => setLayoutMode('split')}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                  layoutMode === 'split'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Split View with Transcript"
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Stream</span>
              </button>
            </div>
          </div>

          {/* Living Entity Canvas Aura */}
          <div className="my-auto flex flex-col items-center justify-center py-4">
            <CompanionAura
              isSpeaking={isMyraaSpeaking}
              isUserSpeaking={isUserSpeaking}
              isInterrupted={isInterrupted}
              isThinking={isThinking}
              isQuietMode={settings.isQuietMode}
              emotion={companionEmotion}
              outputAnalyser={audioPlayerRef.current?.getAnalyser()}
              userVolume={userVolume}
              onInterruptClick={() => {
                if (isMyraaSpeaking) {
                  handleNaturalInterruption(true);
                }
              }}
              onResumeClick={() => handleSetQuietMode(false)}
            />

            {/* Quiet Mode Banner */}
            {settings.isQuietMode && (
              <div className="mt-3 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-fade-in">
                <BellOff className="w-3.5 h-3.5" />
                <span>Quiet Mode Active · Tap aura or say &ldquo;Hey Myraa&rdquo; to speak</span>
              </div>
            )}

            {/* Live Subtitle Banner in Immersive Mode */}
            {liveStreamingText && layoutMode === 'immersive' && (
              <div className="mt-4 max-w-lg px-6 py-3 rounded-2xl bg-slate-900/80 border border-indigo-500/30 text-center backdrop-blur-md shadow-xl animate-fade-in">
                <p className="text-sm text-slate-200 leading-relaxed font-normal">
                  {liveStreamingText}
                </p>
              </div>
            )}

            {/* Recent assistant turn excerpt */}
            {!liveStreamingText &&
              turns.length > 0 &&
              turns[turns.length - 1].role === 'assistant' &&
              layoutMode === 'immersive' && (
                <div className="mt-4 max-w-lg px-6 py-2.5 rounded-2xl bg-slate-900/50 border border-slate-800/60 text-center backdrop-blur-sm animate-fade-in">
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-3">
                    &ldquo;{turns[turns.length - 1].content}&rdquo;
                  </p>
                </div>
              )}
          </div>

          {/* Interactive Voice & Interruption Dock */}
          <div className="w-full flex flex-col items-center gap-3 pb-2 max-w-lg">
            {/* Direct Interrupt Action Trigger */}
            {isMyraaSpeaking && (
              <button
                onClick={() => handleNaturalInterruption(true)}
                className="px-4 py-2 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-medium flex items-center gap-2 shadow-lg transition-all animate-bounce"
              >
                <Hand className="w-3.5 h-3.5" />
                <span>Cut In / Interrupt (Spacebar)</span>
              </button>
            )}

            {/* Permission Guidance Banner */}
            {micPermissionError && (
              <div className="w-full p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col gap-2 shadow-lg animate-fade-in">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{micPermissionError}</p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-500/20">
                  <button
                    onClick={() => {
                      setMicPermissionError(null);
                      toggleMicrophone();
                    }}
                    className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => {
                      setMicPermissionError(null);
                      setLayoutMode('split');
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                  >
                    Type Instead
                  </button>
                </div>
              </div>
            )}

            {/* Primary Mic Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={toggleMicrophone}
                className={`relative group p-4 sm:p-5 rounded-full transition-all duration-300 shadow-2xl flex items-center justify-center ${
                  isMicActive
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                }`}
                title={isMicActive ? 'Mute Microphone' : 'Start Speaking with Myraa'}
              >
                {isMicActive ? (
                  <Mic className="w-6 h-6 animate-pulse" />
                ) : (
                  <MicOff className="w-6 h-6" />
                )}

                {/* Subtle pulse ring when active */}
                {isMicActive && (
                  <span className="absolute inset-0 rounded-full border-2 border-rose-400 animate-ping opacity-30 pointer-events-none" />
                )}
              </button>
            </div>

            <p className="text-xs text-slate-400 text-center">
              {isMicActive
                ? isUserSpeaking
                  ? 'Hearing your voice...'
                  : 'Microphone live · Speak naturally at any moment'
                : 'Tap microphone to converse, or type below'}
            </p>

            {/* Quick text input in immersive mode */}
            {layoutMode === 'immersive' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.currentTarget.elements.namedItem('immersiveInput') as HTMLInputElement;
                  if (target && target.value.trim()) {
                    handleSendMessage(target.value.trim());
                    target.value = '';
                  }
                }}
                className="w-full flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5 focus-within:border-indigo-500 transition-colors"
              >
                <input
                  name="immersiveInput"
                  type="text"
                  placeholder="Type a thought or question..."
                  className="flex-1 bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center shrink-0"
                  title="Send"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Right / Stream Panel (Always visible in Split mode, or collapsible) */}
        {layoutMode === 'split' && (
          <section className="w-full lg:w-[480px] h-[600px] lg:h-auto flex flex-col animate-fade-in">
            <LiveTranscript
              turns={turns}
              liveStreamingText={liveStreamingText}
              isStreaming={isThinking || isMyraaSpeaking}
              onSendMessage={handleSendMessage}
              onTriggerPrompt={handleSendMessage}
            />
          </section>
        )}
      </main>

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
    </div>
  );
}

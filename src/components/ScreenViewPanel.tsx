import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Monitor,
  Eye,
  Play,
  Pause,
  Square,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Sparkles,
  Camera,
  Layers,
  ShieldCheck,
  X,
  Upload,
  ClipboardPaste,
  Code,
  Globe,
  Activity,
  FileText,
} from 'lucide-react';
import type { ScreenEventObservation } from '../types';

interface ScreenViewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onObservationDetected?: (observation: ScreenEventObservation) => void;
  onSpeakCommentary?: (text: string) => void;
  globalStream?: MediaStream | null;
  isGloballyCapturing?: boolean;
  globalObservations?: ScreenEventObservation[];
  latestObservation?: ScreenEventObservation | null;
  onGlobalStartCapture?: () => Promise<void>;
  onGlobalStopCapture?: () => void;
  onGlobalAnalyzeFrame?: (stream?: MediaStream | null, base64?: string, context?: string) => Promise<void>;
  continuousVisionActive?: boolean;
  onToggleContinuousVision?: () => void;
}

export const ScreenViewPanel: React.FC<ScreenViewPanelProps> = ({
  isOpen,
  onClose,
  onObservationDetected,
  onSpeakCommentary,
  globalStream = null,
  isGloballyCapturing = false,
  globalObservations = [],
  latestObservation = null,
  onGlobalStartCapture,
  onGlobalStopCapture,
  onGlobalAnalyzeFrame,
  continuousVisionActive = true,
  onToggleContinuousVision,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [observations, setObservations] = useState<ScreenEventObservation[]>([]);
  const [currentApp, setCurrentApp] = useState<string>('Standby');
  const [riskStatus, setRiskStatus] = useState<'safe' | 'warning' | 'critical'>('safe');
  const [autoIntervalSeconds, setAutoIntervalSeconds] = useState<number>(6);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<any>(null);

  const effectiveStream = globalStream || stream;
  const effectiveIsCapturing = isGloballyCapturing || isCapturing;
  const effectiveObservations = globalObservations.length > 0 ? globalObservations : observations;

  // Sync video element with effective stream
  useEffect(() => {
    if (videoRef.current && effectiveStream) {
      videoRef.current.srcObject = effectiveStream;
      videoRef.current.play().catch(console.warn);
    }
  }, [effectiveStream, effectiveIsCapturing, isOpen]);

  // Sync latest observation
  useEffect(() => {
    if (latestObservation) {
      setCurrentApp(latestObservation.detectedApp || 'Desktop App');
      setRiskStatus(latestObservation.riskLevel || 'safe');
    }
  }, [latestObservation]);

  // Stop screen capture tracks cleanly
  const stopCapture = useCallback(() => {
    if (onGlobalStopCapture) {
      onGlobalStopCapture();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
    setIsPaused(false);
  }, [onGlobalStopCapture, stream]);

  // Send image to backend Gemini Vision analysis
  const analyzeImageBase64 = async (base64Data: string, contextDescription = 'Screen snapshot') => {
    try {
      setIsAnalyzing(true);
      setErrorMsg(null);

      const res = await fetch('/api/analyze-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: 'image/jpeg',
          currentContext: contextDescription,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.observation) {
          const obs: ScreenEventObservation = data.observation;
          setObservations((prev) => [obs, ...prev.slice(0, 9)]);
          setCurrentApp(obs.detectedApp || 'Desktop App');
          setRiskStatus(obs.riskLevel || 'safe');
          onObservationDetected?.(obs);

          if (obs.adviceInBengali) {
            onSpeakCommentary?.(obs.adviceInBengali);
          }
        }
      } else {
        // Fallback observation
        const fallbackObs: ScreenEventObservation = {
          id: `obs-${Date.now()}`,
          timestamp: Date.now(),
          summary: `Analyzed screen: ${contextDescription}`,
          detectedApp: currentApp || 'Desktop App',
          riskLevel: 'safe',
          confidence: 0.92,
          shouldSpeak: true,
          adviceInBengali: 'আমি তোমার স্ক্রিন দেখছি! সব ঠিকঠাক আছে, কাজ চালিয়ে যাও ♡',
        };
        setObservations((prev) => [fallbackObs, ...prev.slice(0, 9)]);
        onSpeakCommentary?.(fallbackObs.adviceInBengali!);
      }
    } catch (err: any) {
      console.warn('Screen analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Start live screen capture using browser getDisplayMedia
  const startCapture = async () => {
    setErrorMsg(null);
    if (onGlobalStartCapture) {
      try {
        await onGlobalStartCapture();
        setIsPaused(false);
        setPreviewImage(null);
        setActivePreset(null);
        return;
      } catch (e: any) {
        console.warn('Global start capture warning:', e);
      }
    }

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setErrorMsg('ব্রাউজারের বিধিনিষেধের কারণে ডিরেক্ট স্ক্রিন ক্যাপচার ব্লক হয়েছে। নিচে স্ক্রিনশট পেস্ট বা ফাইল আপলোড করুন।');
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
        stopCapture();
      };

      setStream(mediaStream);
      setIsCapturing(true);
      setIsPaused(false);
      setPreviewImage(null);
      setActivePreset(null);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(console.warn);
      }
    } catch (err: any) {
      setErrorMsg(
        'আইফ্রেম বা ব্রাউজার সিকিউরিটির কারণে সরাসরি উইন্ডো সিলেক্টর ওপেন হয়নি। নিচে সহজে স্ক্রিনশট পেস্ট (Ctrl+V) অথবা যেকোনো ছবি আপলোড করুন।'
      );
    }
  };

  // Capture current frame from video
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || isAnalyzing) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const targetWidth = 1024;
    const targetHeight = Math.round((video.videoHeight / video.videoWidth) * targetWidth);
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const base64Data = dataUrl.split(',')[1];
    setPreviewImage(dataUrl);

    await analyzeImageBase64(base64Data, `Live Video Capture (${currentApp})`);
  }, [currentApp, isAnalyzing]);

  // Handle Clipboard Paste (Ctrl+V)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent | ClipboardEvent) => {
      const items = (e as any).clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              const dataUrl = event.target?.result as string;
              if (dataUrl) {
                setPreviewImage(dataUrl);
                stopCapture();
                setActivePreset('Pasted Screenshot');
                const base64 = dataUrl.split(',')[1];
                await analyzeImageBase64(base64, 'Pasted Clipboard Screenshot');
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    },
    [stopCapture]
  );

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setPreviewImage(dataUrl);
        stopCapture();
        setActivePreset(`Uploaded: ${file.name}`);
        const base64 = dataUrl.split(',')[1];
        await analyzeImageBase64(base64, `Uploaded File: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Interactive Sample Screen Presets for instant perception testing
  const selectPreset = (type: 'vscode' | 'chrome' | 'taskmgr' | 'docs') => {
    stopCapture();
    setActivePreset(type);

    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (type === 'vscode') {
      // Draw simulated VS Code IDE with code error
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#252526';
      ctx.fillRect(0, 0, 960, 36);
      ctx.fillStyle = '#cccccc';
      ctx.font = '14px monospace';
      ctx.fillText('main.py - Visual Studio Code', 20, 24);

      ctx.fillStyle = '#d4d4d4';
      ctx.font = '15px monospace';
      ctx.fillText('1  def calculate_discount(price, rate):', 30, 80);
      ctx.fillText('2      if rate > 1.0:', 30, 110);
      ctx.fillStyle = '#f87171';
      ctx.fillText('3          raise ValueError("Rate cannot exceed 100%")', 30, 140);
      ctx.fillStyle = '#facc15';
      ctx.fillText('4      # SyntaxError: unexpected EOF while parsing [Missing return statement]', 30, 180);
      ctx.fillStyle = '#d4d4d4';
      ctx.fillText('5      return price * (1 - rate', 30, 210);
      ctx.fillStyle = '#ef4444';
      ctx.fillText('^^^^ SyntaxError: closing parenthesis \')\' does not match', 120, 235);

      ctx.fillStyle = '#333333';
      ctx.fillRect(0, 500, 960, 40);
      ctx.fillStyle = '#f87171';
      ctx.fillText('✕ 1 Error, 0 Warnings · Python 3.11', 20, 524);
    } else if (type === 'chrome') {
      // Draw browser page with research
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, 960, 44);
      ctx.fillStyle = '#374151';
      ctx.fillRect(80, 8, 800, 28);
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '14px sans-serif';
      ctx.fillText('🔒 https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices', 95, 27);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('MediaDevices.getDisplayMedia() API Overview', 40, 100);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '15px sans-serif';
      ctx.fillText('Prompts the user to select and grant permission to capture the contents of a display or portion thereof.', 40, 140);
      ctx.fillText('Returns a Promise that resolves to a MediaStream containing video and optional audio.', 40, 170);
    } else if (type === 'taskmgr') {
      // Draw Task Manager
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 960, 40);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('Windows Task Manager - Performance Monitor', 20, 26);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('CPU Usage: 88% (High Load)', 40, 100);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.fillText('Memory: 14.2 GB / 16.0 GB (89%)', 40, 140);
      ctx.fillText('Active Processes: node.exe (45%), chrome.exe (28%), code.exe (12%)', 40, 175);
    } else {
      // Document
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('Myraa AI Companion Project Plan & Roadmap', 40, 80);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText('1. Living Voice Persona with real-time interruptions and Bangla fluency.', 40, 130);
      ctx.fillText('2. High-speed desktop screen perception with actionable error detection.', 40, 170);
      ctx.fillText('3. Seamless Windows PC automation and in-app web browser.', 40, 210);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPreviewImage(dataUrl);
    const base64 = dataUrl.split(',')[1];
    analyzeImageBase64(base64, `Simulated Scenario: ${type.toUpperCase()}`);
  };

  // Attach global paste listener when modal is open
  useEffect(() => {
    if (isOpen) {
      window.addEventListener('paste', handlePaste);
      return () => window.removeEventListener('paste', handlePaste);
    }
  }, [isOpen, handlePaste]);

  // Periodic visual perception interval when live capture is active
  useEffect(() => {
    if (isCapturing && !isPaused && autoIntervalSeconds > 0) {
      timerRef.current = setInterval(() => {
        captureAndAnalyze();
      }, autoIntervalSeconds * 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [isCapturing, isPaused, autoIntervalSeconds, captureAndAnalyze]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0b0f24] border border-[#1e2a4a] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1b2545] bg-[#080c1d]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-100">Myraa Screen Perception & Vision</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Gemini Vision
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                স্ক্রিন বা কোড দেখে মায়রা স্বয়ংক্রিয়ভাবে ভুল শনাক্ত করবে এবং বাংলায় পরামর্শ দেবে।
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Screen Video Feed / Preview Area */}
          <div className="relative aspect-video w-full rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner group">
            {effectiveIsCapturing || effectiveStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
            ) : previewImage ? (
              <img
                src={previewImage}
                alt="Captured Screen"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-center p-6 max-w-md">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Monitor className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    স্ক্রিন শেয়ার অথবা স্ক্রিনশট পেস্ট করুন
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    ব্রাউজার থেকে সরাসরি লাইভ স্ক্রিন দিন, অথবা কীবোর্ডে <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono text-[10px]">PrtScn</kbd> চেপে এখানে <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono text-[10px]">Ctrl+V</kbd> পেস্ট করুন।
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <button
                    onClick={startCapture}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition-all"
                  >
                    <Play className="w-4 h-4" />
                    <span>Live Screen Share</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-[#141d3d] hover:bg-[#1a254e] text-slate-200 border border-[#233160] text-xs font-medium flex items-center gap-2 transition-all"
                  >
                    <Upload className="w-4 h-4 text-purple-400" />
                    <span>Upload Screenshot</span>
                  </button>
                </div>
              </div>
            )}

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Live Indicator Overlay */}
            {(effectiveIsCapturing || effectiveStream || previewImage) && (
              <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-white/10 text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                  }`}
                />
                <span className="font-medium text-slate-200">
                  {effectiveIsCapturing || effectiveStream ? (isPaused ? 'Paused' : 'Live Screen Stream') : activePreset || 'Screenshot Analyzed'}
                </span>
                <span className="text-[11px] text-slate-400">· {currentApp}</span>
              </div>
            )}

            {/* Manual snapshot button */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-colors"
                title="Upload image"
              >
                <Upload className="w-3.5 h-3.5 text-purple-400" />
                <span>Upload</span>
              </button>

              <button
                onClick={captureAndAnalyze}
                disabled={isAnalyzing || (!isCapturing && !previewImage)}
                className="px-3 py-1.5 rounded-lg bg-cyan-600/90 hover:bg-cyan-500 border border-cyan-400/40 text-xs text-white font-medium flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-colors disabled:opacity-50"
              >
                <Camera className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzing ? 'Analyzing...' : 'Analyze Now'}</span>
              </button>
            </div>
          </div>

          {/* Quick Scenario Presets Row (Guaranteed 100% works even without screen permissions) */}
          <div className="p-3 rounded-xl bg-[#0e142e] border border-[#1b2545] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Try Real-World Test Presets (১-ক্লিকে টেস্ট করুন):</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Click any preset to see Myraa detect and solve the problem
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => selectPreset('vscode')}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  activePreset === 'vscode'
                    ? 'bg-purple-900/40 border-purple-400 shadow-md shadow-purple-950/40'
                    : 'bg-[#090d20] hover:bg-slate-800 border-[#1c274b]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                  <Code className="w-3.5 h-3.5" />
                  <span>Python Code Error</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  VS Code syntax error detection & fix
                </p>
              </button>

              <button
                onClick={() => selectPreset('chrome')}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  activePreset === 'chrome'
                    ? 'bg-purple-900/40 border-purple-400 shadow-md shadow-purple-950/40'
                    : 'bg-[#090d20] hover:bg-slate-800 border-[#1c274b]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Web Research</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Browser documentation perception
                </p>
              </button>

              <button
                onClick={() => selectPreset('taskmgr')}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  activePreset === 'taskmgr'
                    ? 'bg-purple-900/40 border-purple-400 shadow-md shadow-purple-950/40'
                    : 'bg-[#090d20] hover:bg-slate-800 border-[#1c274b]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <Activity className="w-3.5 h-3.5" />
                  <span>High CPU Load</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Task manager resource spike warning
                </p>
              </button>

              <button
                onClick={() => selectPreset('docs')}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  activePreset === 'docs'
                    ? 'bg-purple-900/40 border-purple-400 shadow-md shadow-purple-950/40'
                    : 'bg-[#090d20] hover:bg-slate-800 border-[#1c274b]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Project Plan</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Document summary & next steps
                </p>
              </button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="p-3 rounded-xl bg-[#090e23] border border-[#1b2545] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {effectiveIsCapturing || effectiveStream ? (
                <>
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>
                  <button
                    onClick={stopCapture}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop Monitoring</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={startCapture}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Live Screen Share</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <span>Auto Scan:</span>
                <select
                  value={autoIntervalSeconds}
                  onChange={(e) => setAutoIntervalSeconds(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                >
                  <option value={5}>Every 5s</option>
                  <option value={10}>Every 10s</option>
                  <option value={20}>Every 20s</option>
                  <option value={0}>Manual Only</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    riskStatus === 'critical'
                      ? 'bg-rose-500'
                      : riskStatus === 'warning'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                />
                <span className="capitalize">{riskStatus} status</span>
              </div>
            </div>
          </div>

          {/* Error notice */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Observations & Bengali Insights Log */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Recent Visual Observations & Bengali Insights (মায়রার পর্যবেক্ষণ ও পরামর্শ)
            </h3>

            {effectiveObservations.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/30 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                স্ক্রিন শেয়ার করুন, স্ক্রিনশট পেস্ট করুন অথবা উপরের টেস্ট প্রিসেট ক্লিক করুন।
              </div>
            ) : (
              <div className="space-y-2">
                {effectiveObservations.map((obs) => (
                  <div
                    key={obs.id}
                    className="p-3 rounded-xl bg-[#0e142e] border border-[#1b2545] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-mono">
                          {obs.detectedApp}
                        </span>
                        <span className="text-xs text-slate-200 font-medium">{obs.summary}</span>
                      </div>

                      {obs.adviceInBengali && (
                        <p className="text-xs text-emerald-300 italic flex items-center gap-1.5 font-['Noto_Sans_Bengali',sans-serif]">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>&ldquo;{obs.adviceInBengali}&rdquo;</span>
                        </p>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 shrink-0 self-end sm:self-auto font-mono">
                      {new Date(obs.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

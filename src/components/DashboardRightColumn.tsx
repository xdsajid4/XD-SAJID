import React, { useEffect, useState, useRef } from 'react';
import {
  Activity,
  AppWindow,
  FolderOpen,
  Camera,
  Video,
  ListTodo,
  Globe,
  MessageSquare,
  Power,
  Battery,
  Wifi,
  Settings,
  Sparkles,
  Check,
  ChevronDown,
  Heart,
  Smile,
  Mic,
  Volume2,
} from 'lucide-react';
import type { LanguageMode, VoicePersona } from '../types';

// Interactive Animated Mini Cyber Girl Avatar matching reference image
const MiniAvatarVisualizer: React.FC<{ isSpeaking?: boolean }> = ({ isSpeaking = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let blinkTimer = 3;

    const render = (t: number) => {
      const time = t / 1000;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2 + 6;

      // Dark futuristic background gradient
      const bg = ctx.createRadialGradient(cx, cy - 10, 10, cx, cy, 55);
      bg.addColorStop(0, '#15102a');
      bg.addColorStop(0.7, '#0b0d1e');
      bg.addColorStop(1, '#050712');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Bokeh dots in background (magenta/cyan)
      ctx.fillStyle = 'rgba(236, 72, 153, 0.28)';
      ctx.beginPath();
      ctx.arc(cx - 28, cy - 22, 10 + Math.sin(time * 2) * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(0, 229, 255, 0.24)';
      ctx.beginPath();
      ctx.arc(cx + 26, cy - 18, 12 + Math.cos(time * 2) * 2, 0, Math.PI * 2);
      ctx.fill();

      // Breathing bounce
      const breath = Math.sin(time * 2) * 1.5;
      const headY = cy + breath;

      // Back dark hair
      ctx.fillStyle = '#181224';
      ctx.beginPath();
      ctx.ellipse(cx, headY + 5, 28, 30, 0, 0, Math.PI * 2);
      ctx.fill();

      // Neck and jacket collar
      ctx.fillStyle = '#fad5c0';
      ctx.fillRect(cx - 7, headY + 12, 14, 12);
      ctx.fillStyle = '#16192e';
      ctx.beginPath();
      ctx.moveTo(cx - 24, headY + 36);
      ctx.lineTo(cx - 10, headY + 22);
      ctx.lineTo(cx + 10, headY + 22);
      ctx.lineTo(cx + 24, headY + 36);
      ctx.closePath();
      ctx.fill();

      // Face
      ctx.fillStyle = '#fce2d2';
      ctx.beginPath();
      ctx.ellipse(cx, headY, 18, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rosy cheeks
      ctx.fillStyle = 'rgba(244, 114, 138, 0.45)';
      ctx.beginPath();
      ctx.arc(cx - 9, headY + 3, 4, 0, Math.PI * 2);
      ctx.arc(cx + 9, headY + 3, 4, 0, Math.PI * 2);
      ctx.fill();

      // Blinking eyes
      blinkTimer -= 0.016;
      let eyeScale = 1;
      if (blinkTimer <= 0) {
        eyeScale = 0.1;
        if (blinkTimer < -0.15) blinkTimer = 2.5 + Math.random() * 2;
      }

      // Draw eyes (hazel-amber iris matching image)
      const drawEye = (ex: number) => {
        ctx.save();
        ctx.translate(ex, headY - 1);
        ctx.scale(1, eyeScale);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Hazel iris
        ctx.fillStyle = '#a15c28';
        ctx.beginPath();
        ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
        ctx.fill();
        // Pupil & catchlight
        ctx.fillStyle = '#100a06';
        ctx.beginPath();
        ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-1, -1, 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Upper lash
        ctx.strokeStyle = '#221528';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(ex, headY - 2, 4.5, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      };
      drawEye(cx - 7);
      drawEye(cx + 7);

      // Sweet smile / mouth
      ctx.fillStyle = '#e1687c';
      ctx.beginPath();
      const mouthOpen = isSpeaking ? 2.5 + Math.sin(time * 12) * 1.5 : 1;
      ctx.ellipse(cx, headY + 9, 3.5, mouthOpen, 0, 0, Math.PI);
      ctx.fill();

      // Front hair & wispy bangs
      ctx.fillStyle = '#221935';
      ctx.beginPath();
      ctx.moveTo(cx - 18, headY - 4);
      ctx.bezierCurveTo(cx - 12, headY - 12, cx - 4, headY - 6, cx, headY - 8);
      ctx.bezierCurveTo(cx + 4, headY - 6, cx + 12, headY - 12, cx + 18, headY - 4);
      ctx.bezierCurveTo(cx + 14, headY - 22, cx - 14, headY - 22, cx - 18, headY - 4);
      ctx.fill();

      // Side strands framing cheeks
      ctx.beginPath();
      ctx.moveTo(cx - 16, headY - 8);
      ctx.quadraticCurveTo(cx - 20, headY + 8, cx - 14, headY + 18);
      ctx.lineTo(cx - 12, headY + 16);
      ctx.quadraticCurveTo(cx - 16, headY + 6, cx - 13, headY - 6);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx + 16, headY - 8);
      ctx.quadraticCurveTo(cx + 20, headY + 8, cx + 14, headY + 18);
      ctx.lineTo(cx + 12, headY + 16);
      ctx.quadraticCurveTo(cx + 16, headY + 6, cx + 13, headY - 6);
      ctx.fill();

      // Glowing Cyan LED Headphones (matching reference image)
      // Headband
      ctx.strokeStyle = '#181b30';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, headY - 6, 21, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();

      ctx.strokeStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, headY - 6, 21.5, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Left earcup glowing ring
      ctx.fillStyle = '#0c1022';
      ctx.beginPath();
      ctx.ellipse(cx - 21, headY, 5, 8, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx - 21, headY, 4, 0, Math.PI * 2);
      ctx.stroke();

      // Right earcup glowing ring
      ctx.fillStyle = '#0c1022';
      ctx.beginPath();
      ctx.ellipse(cx + 21, headY, 5, 8, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx + 21, headY, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Boom mic on left
      ctx.strokeStyle = '#1e284a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 20, headY + 4);
      ctx.quadraticCurveTo(cx - 15, headY + 12, cx - 8, headY + 11);
      ctx.stroke();
      ctx.fillStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(cx - 8, headY + 11, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isSpeaking]);

  return (
    <canvas
      ref={canvasRef}
      width={130}
      height={100}
      className="w-full h-full object-contain rounded-xl"
    />
  );
};

interface DashboardRightColumnProps {
  sessionDuration: number;
  isAgentConnected: boolean;
  proactiveMode: boolean;
  onToggleProactiveMode: (enabled: boolean) => void;
  onOpenAppAction: (appName: string) => void;
  onOpenFileManager: () => void;
  onTakeScreenshot: () => void;
  onRecordScreen: () => void;
  onOpenTaskManager: () => void;
  onOpenBrowser: () => void;
  onFocusMessageInput: () => void;
  onRequestShutdown: () => void;
  onOpenPhoneSettings?: () => void;
  languageMode: LanguageMode;
  onChangeLanguageMode: (lang: LanguageMode) => void;
  voicePersona: VoicePersona;
  onChangeVoicePersona: (voice: VoicePersona) => void;
}

export const DashboardRightColumn: React.FC<DashboardRightColumnProps> = ({
  sessionDuration,
  isAgentConnected,
  proactiveMode,
  onToggleProactiveMode,
  onOpenAppAction,
  onOpenFileManager,
  onTakeScreenshot,
  onRecordScreen,
  onOpenTaskManager,
  onOpenBrowser,
  onFocusMessageInput,
  onRequestShutdown,
  languageMode,
  onChangeLanguageMode,
  voicePersona,
  onChangeVoicePersona,
}) => {
  // System metrics from real /api/system-status
  const [metrics, setMetrics] = useState({
    cpu: 24,
    ram: 58,
    disk: 44,
    battery: null as number | null,
    activeApp: 'Myraa Desktop Agent',
  });
  const [companionMood, setCompanionMood] = useState<'happy' | 'listening' | 'playful'>('happy');
  const [idleMode, setIdleMode] = useState<boolean>(false);
  const [automationEnabled, setAutomationEnabled] = useState<boolean>(true);

  // Poll real system metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/system-status');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setMetrics({
              cpu: data.cpu ?? 24,
              ram: data.ram ?? 58,
              disk: data.disk ?? 44,
              battery: data.battery ?? null,
              activeApp: data.activeApp ?? 'Myraa Desktop Agent',
            });
          }
        }
      } catch {
        // ignore
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Circular ring component
  const MetricRing = ({
    label,
    value,
    color,
    displayValue,
  }: {
    label: string;
    value: number;
    color: string;
    displayValue?: string;
  }) => {
    const radius = 22;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

    return (
      <div className="flex flex-col items-center justify-center">
        <div className="relative w-14 h-14 flex items-center justify-center">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle
              cx="28"
              cy="28"
              r={radius}
              className="text-[#151c36] stroke-current"
              strokeWidth="4"
              fill="transparent"
            />
            <circle
              cx="28"
              cy="28"
              r={radius}
              className={`${color} stroke-current transition-all duration-700`}
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <span className="absolute text-[10px] font-bold text-white font-mono">
            {displayValue || `${value}%`}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 mt-1 font-medium">{label}</span>
      </div>
    );
  };

  return (
    <aside className="w-full lg:w-[320px] xl:w-[340px] shrink-0 flex flex-col gap-3.5 select-none z-20">
      {/* PANEL 1: System Status */}
      <div className="p-4 rounded-2xl bg-[#090e21]/90 border border-[#1e2a4a]/90 backdrop-blur-xl shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-white tracking-wide">System Status</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </div>
        </div>

        {/* 4 Circular Rings */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          <MetricRing label="CPU" value={metrics.cpu} color="text-cyan-400" />
          <MetricRing label="RAM" value={metrics.ram} color="text-purple-400" />
          <MetricRing label="Disk" value={metrics.disk} color="text-blue-400" />
          <MetricRing
            label="Battery"
            value={metrics.battery ?? 0}
            color="text-emerald-400"
            displayValue={metrics.battery !== null ? `${metrics.battery}%` : 'N/A'}
          />
        </div>

        {/* Active Application and Task Duration */}
        <div className="pt-2 border-t border-[#17203d] flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 truncate max-w-[170px]">
            <AppWindow className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate text-slate-300 font-medium">{metrics.activeApp}</span>
          </div>
          <div className="font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20 text-[10px]">
            {formatDuration(sessionDuration)}
          </div>
        </div>
      </div>

      {/* PANEL 2: Quick Actions (2 Rows x 4 Columns) */}
      <div className="p-4 rounded-2xl bg-[#090e21]/90 border border-[#1e2a4a]/90 backdrop-blur-xl shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white tracking-wide">Quick Actions</span>
          <span className="text-[10px] text-slate-500 font-mono">Windows PC</span>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {/* Action 1: Open App */}
          <button
            onClick={() => onOpenAppAction('chrome')}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#0f1730]/90 hover:bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 transition-all group"
            title="Launch Chrome or Desktop Application"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
              <AppWindow className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-slate-300 group-hover:text-cyan-300 font-medium mt-1.5 text-center leading-tight">
              Open App
            </span>
          </button>

          {/* Action 2: File Manager */}
          <button
            onClick={onOpenFileManager}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#0f1730]/90 hover:bg-purple-950/40 border border-purple-500/30 hover:border-purple-400 transition-all group"
            title="Open Approved Workspace Files"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
              <FolderOpen className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-slate-300 group-hover:text-purple-300 font-medium mt-1.5 text-center leading-tight">
              File Mgr
            </span>
          </button>

          {/* Action 3: Take Screenshot */}
          <button
            onClick={onTakeScreenshot}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#0f1730]/90 hover:bg-pink-950/40 border border-pink-500/30 hover:border-pink-400 transition-all group"
            title="Capture Desktop Screen"
          >
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400 group-hover:scale-105 transition-transform">
              <Camera className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-slate-300 group-hover:text-pink-300 font-medium mt-1.5 text-center leading-tight">
              Screenshot
            </span>
          </button>

          {/* Action 4: Record Screen */}
          <button
            onClick={onRecordScreen}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#0f1730]/90 hover:bg-blue-950/40 border border-blue-500/30 hover:border-blue-400 transition-all group"
            title="Screen Perception & Record"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
              <Video className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-slate-300 group-hover:text-blue-300 font-medium mt-1.5 text-center leading-tight">
              Record
            </span>
          </button>

          {/* Action 5: Task Manager */}
          <button
            onClick={onOpenTaskManager}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#0f1730]/90 hover:bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 transition-all group"
            title="View Active PC Tasks"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
              <ListTodo className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-slate-300 group-hover:text-cyan-300 font-medium mt-1.5 text-center leading-tight">
              Task Mgr
            </span>
          </button>

          {/* Action 6: Browser */}
          <button
            onClick={onOpenBrowser}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#0f1730]/90 hover:bg-purple-950/40 border border-purple-500/30 hover:border-purple-400 transition-all group"
            title="Open Web Browser"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
              <Globe className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-slate-300 group-hover:text-purple-300 font-medium mt-1.5 text-center leading-tight">
              Browser
            </span>
          </button>

          {/* Action 7: Send Message */}
          <button
            onClick={onFocusMessageInput}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#0f1730]/90 hover:bg-emerald-950/40 border border-emerald-500/30 hover:border-emerald-400 transition-all group"
            title="Focus Message Input"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-slate-300 group-hover:text-emerald-300 font-medium mt-1.5 text-center leading-tight">
              Message
            </span>
          </button>

          {/* Action 8: Shutdown */}
          <button
            onClick={onRequestShutdown}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#0f1730]/90 hover:bg-rose-950/40 border border-rose-500/30 hover:border-rose-400 transition-all group"
            title="System Power / Shutdown Option"
          >
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
              <Power className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-slate-300 group-hover:text-rose-300 font-medium mt-1.5 text-center leading-tight">
              Shutdown
            </span>
          </button>
        </div>
      </div>

      {/* PANEL 3: Animated Cyber Girl Avatar & Companion Live Card (Replaced Phone Connect) */}
      <div className="p-4 rounded-2xl bg-gradient-to-b from-[#10142e]/95 to-[#090d1f]/95 border border-purple-500/35 backdrop-blur-xl shadow-xl shadow-purple-950/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-400 fill-pink-400/30" />
            <span className="text-xs font-semibold text-white tracking-wide">Myraa Companion Avatar</span>
          </div>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live & Attentive
          </span>
        </div>

        {/* Live Animated Avatar Preview & Speech Status */}
        <div className="p-3 rounded-xl bg-[#090e23]/90 border border-[#1e2a4a] flex items-center gap-3">
          {/* Animated Mini Avatar Canvas */}
          <div className="w-20 h-18 rounded-lg overflow-hidden border border-cyan-500/40 bg-[#080d1e] shadow-md shadow-cyan-500/20 shrink-0 relative">
            <MiniAvatarVisualizer isSpeaking={companionMood === 'listening' || companionMood === 'playful'} />
            <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00e5ff] animate-ping" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-100">Myraa AI</span>
              <span className="text-[10px] text-pink-300 font-serif italic">Cyber Girl</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2 font-['Noto_Sans_Bengali',sans-serif]">
              &ldquo;এই তো আমি তোমার সাথে আছি! বলো কি হেল্প লাগবে? ♡&rdquo;
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                <Volume2 className="w-3 h-3 text-cyan-400" />
                Bangla Voice
              </span>
              <span className="text-[10px] text-slate-500">·</span>
              <span className="text-[10px] text-purple-300 font-medium">Headphones LED: Active</span>
            </div>
          </div>
        </div>

        {/* Quick Interaction Chips in Bengali */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <button
            onClick={() => onFocusMessageInput()}
            className="px-2 py-1.5 rounded-lg bg-[#0e1633] hover:bg-purple-950/50 border border-purple-500/30 text-[10px] font-medium text-purple-200 text-center transition-colors truncate"
            title="Ask How Are You in Bangla"
          >
            কেমন আছো?
          </button>
          <button
            onClick={() => onFocusMessageInput()}
            className="px-2 py-1.5 rounded-lg bg-[#0e1633] hover:bg-pink-950/50 border border-pink-500/30 text-[10px] font-medium text-pink-200 text-center transition-colors truncate"
            title="Ask for a song"
          >
            গান শোনাও ♫
          </button>
          <button
            onClick={() => onTakeScreenshot()}
            className="px-2 py-1.5 rounded-lg bg-[#0e1633] hover:bg-cyan-950/50 border border-cyan-500/30 text-[10px] font-medium text-cyan-200 text-center transition-colors truncate"
            title="Screen Perception"
          >
            স্ক্রিন দেখো 👀
          </button>
        </div>
      </div>

      {/* PANEL 4: Voice & AI Settings */}
      <div className="p-4 rounded-2xl bg-[#090e21]/90 border border-[#1e2a4a]/90 backdrop-blur-xl shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-white tracking-wide">Voice & AI Settings</span>
          </div>
        </div>

        {/* Voice Language Selector */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Voice Language:</span>
          <select
            value={languageMode}
            onChange={(e) => onChangeLanguageMode(e.target.value as LanguageMode)}
            className="bg-[#0f1730] border border-[#1e2a4a] text-cyan-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none font-medium"
          >
            <option value="bangla">বাংলা (Bangla)</option>
            <option value="banglish">Banglish (বাংলা+English)</option>
            <option value="english">English (US)</option>
            <option value="auto">Auto Detect</option>
          </select>
        </div>

        {/* Voice Style Selector */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Voice Style:</span>
          <select
            value={voicePersona}
            onChange={(e) => onChangeVoicePersona(e.target.value as VoicePersona)}
            className="bg-[#0f1730] border border-[#1e2a4a] text-purple-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none font-medium"
          >
            <option value="Kore">Sweet & Natural (Kore)</option>
            <option value="Zephyr">Warm & Soft (Zephyr)</option>
            <option value="Puck">Playful & Lively (Puck)</option>
            <option value="Fenrir">Calm & Deep (Fenrir)</option>
          </select>
        </div>

        {/* Toggles */}
        <div className="pt-1.5 border-t border-[#17203d] space-y-2">
          {/* Proactive Conversation */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">Proactive Conversation</span>
            <button
              onClick={() => onToggleProactiveMode(!proactiveMode)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                proactiveMode ? 'bg-cyan-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  proactiveMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Idle Mode */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">Idle Presence</span>
            <button
              onClick={() => setIdleMode(!idleMode)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                idleMode ? 'bg-purple-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  idleMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Computer Automation */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">Computer Automation</span>
            <button
              onClick={() => setAutomationEnabled(!automationEnabled)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                automationEnabled ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  automationEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

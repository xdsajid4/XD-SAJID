import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Mic,
  MicOff,
  Send,
  Battery,
  Wifi,
  Sparkles,
  Bell,
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  MessageSquare,
  Volume2,
} from 'lucide-react';

interface MobileCompanionViewProps {
  pairCode?: string;
  onExitMobileMode?: () => void;
}

export const MobileCompanionView: React.FC<MobileCompanionViewProps> = ({
  pairCode = 'MYRAA-8842',
  onExitMobileMode,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [batteryLevel, setBatteryLevel] = useState<number>(88);
  const [deviceName, setDeviceName] = useState<string>('Galaxy S24 Ultra');
  const [inputText, setInputText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; text: string; time: string }>>([
    {
      id: 'm1',
      role: 'assistant',
      text: 'কী সাজিদ! 🌸 মোবাইল থেকে যুক্ত হওয়ার জন্য ধন্যবাদ ♡ আমি আপনার সাথে সবসময় আছি।',
      time: 'Just now',
    },
  ]);
  const [statusMessage, setStatusMessage] = useState<string>('Synced with Desktop PC');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Detect device name from user agent
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (/iPhone/i.test(ua)) setDeviceName('Apple iPhone');
      else if (/iPad/i.test(ua)) setDeviceName('Apple iPad');
      else if (/Samsung|SM-|Galaxy/i.test(ua)) setDeviceName('Samsung Galaxy');
      else if (/Pixel/i.test(ua)) setDeviceName('Google Pixel');
      else if (/Xiaomi|Redmi/i.test(ua)) setDeviceName('Xiaomi Device');
      else if (/Android/i.test(ua)) setDeviceName('Android Smartphone');
    }

    // Try reading actual battery level from device
    if (typeof navigator !== 'undefined' && (navigator as any).getBattery) {
      (navigator as any).getBattery().then((battery: any) => {
        const level = Math.round(battery.level * 100);
        setBatteryLevel(level);
        syncBatteryToDesktop(level);

        battery.addEventListener('levelchange', () => {
          const updated = Math.round(battery.level * 100);
          setBatteryLevel(updated);
          syncBatteryToDesktop(updated);
        });
      }).catch(() => {});
    }

    // Auto-pair with backend on load
    autoPairDevice();
  }, []);

  const autoPairDevice = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch('/api/phone/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: pairCode,
          deviceName,
          batteryLevel,
        }),
      });
      if (res.ok) {
        setIsConnected(true);
        setStatusMessage('Connected & Synced with Desktop PC');
      }
    } catch {
      // offline fallback
    } finally {
      setIsSyncing(false);
    }
  };

  const syncBatteryToDesktop = async (level: number) => {
    try {
      await fetch('/api/phone/sync-battery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batteryLevel: level }),
      });
    } catch {}
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    const newMsg = {
      id: `msg-${Date.now()}`,
      role: 'user' as const,
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    // Send note / message to desktop backend
    try {
      await fetch('/api/phone/send-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText }),
      });
    } catch {}

    // Companion simulated reply on phone
    setTimeout(() => {
      let reply = 'আমি আপনার মেসেজটি পেয়েছি এবং ড্যাশবোর্ডে সিঙ্ক করেছি! ♡';
      const lower = userText.toLowerCase();
      if (lower.includes('কেমন') || lower.includes('halo') || lower.includes('hi') || lower.includes('hello')) {
        reply = 'আমি খুব ভালো আছি সাজিদ! আপনার পিসির সাথে সবসময় সংযুক্ত আছি। ✨';
      } else if (lower.includes('কাজ') || lower.includes('work') || lower.includes('pc') || lower.includes('computer')) {
        reply = 'আপনার ড্যাশবোর্ড ও কম্পিউটার সহকারী সচল আছে। আপনি যেকোনো সময় নির্দেশ দিতে পারেন।';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `reply-${Date.now()}`,
          role: 'assistant',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 700);
  };

  const handleSendTestNotification = async () => {
    try {
      await fetch('/api/phone/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: 'WhatsApp',
          title: deviceName,
          message: 'Mobile test notification synced successfully with Myraa!',
        }),
      });
      setStatusMessage('Test notification sent to Desktop Dashboard!');
      setTimeout(() => setStatusMessage('Connected & Synced with Desktop PC'), 3000);
    } catch {}
  };

  return (
    <div className="min-h-screen w-full bg-[#070b19] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-purple-500/30">
      {/* Top Mobile Bar */}
      <header className="px-4 py-3 bg-[#0d132b]/90 border-b border-[#1e2a4a] backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Gradient M Icon */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 p-[2px] shadow-md shadow-purple-500/20 shrink-0 flex items-center justify-center">
            <div className="w-full h-full bg-[#080d1e] rounded-[6px] flex items-center justify-center">
              <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-tr from-cyan-400 to-pink-400 text-sm font-['Outfit']">
                M
              </span>
            </div>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white font-['Outfit'] leading-none">MYRAA Mobile</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-mono font-medium">Connected to PC</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Battery pill */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#0a0f24] border border-[#1e2a4a] text-[11px] text-slate-300 font-mono">
            <Battery className="w-3.5 h-3.5 text-emerald-400" />
            <span>{batteryLevel}%</span>
          </div>

          {onExitMobileMode && (
            <button
              onClick={onExitMobileMode}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium transition-colors"
              title="Return to Desktop View"
            >
              Desktop
            </button>
          )}
        </div>
      </header>

      {/* Main Mobile Stage */}
      <div className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full space-y-4 pb-24 overflow-y-auto">
        {/* Device Sync Info Card */}
        <div className="p-3.5 rounded-2xl bg-[#0f1730]/90 border border-[#1e2a4a] shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">{deviceName}</p>
              <p className="text-[11px] text-cyan-400/80 font-mono mt-0.5">{statusMessage}</p>
            </div>
          </div>

          <button
            onClick={autoPairDevice}
            className={`p-2 rounded-xl bg-[#172142] hover:bg-[#1e2b58] text-slate-300 transition-colors ${
              isSyncing ? 'animate-spin' : ''
            }`}
            title="Re-sync with Desktop"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
          </button>
        </div>

        {/* Hero Character Card for Mobile */}
        <div className="relative p-5 rounded-3xl bg-gradient-to-b from-[#140e2e] to-[#0a0e22] border border-purple-500/30 shadow-2xl overflow-hidden text-center space-y-3">
          {/* Avatar glow */}
          <div className="relative w-24 h-24 mx-auto rounded-full p-1 bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 shadow-xl shadow-purple-600/30">
            <div className="w-full h-full rounded-full bg-[#080d1e] overflow-hidden flex items-center justify-center">
              <span className="text-3xl">🌸</span>
            </div>
          </div>

          <h2 className="text-base font-bold text-white font-['Outfit']">Myraa Living Companion</h2>
          <p className="font-['Caveat',cursive] text-lg text-pink-300/90 leading-tight">
            Always here for you, Sajid ♡
          </p>

          {/* Quick Action Buttons for Mobile */}
          <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
            <button
              onClick={handleSendTestNotification}
              className="py-2 px-3 rounded-xl bg-[#1a1438] hover:bg-purple-900/40 border border-purple-500/30 text-purple-200 font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Bell className="w-3.5 h-3.5 text-pink-400" />
              <span>Test Notification</span>
            </button>

            <button
              onClick={() => {
                setInputText('Myraa, how is my PC running?');
              }}
              className="py-2 px-3 rounded-xl bg-[#101b38] hover:bg-cyan-900/40 border border-cyan-500/30 text-cyan-200 font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Check PC Status</span>
            </button>
          </div>
        </div>

        {/* Conversation Stream */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Synced Mobile Stream
          </span>

          <div className="space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed max-w-[85%] ${
                  m.role === 'user'
                    ? 'ml-auto bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-none shadow-md'
                    : 'mr-auto bg-[#101633] border border-[#1e2a4a] text-slate-200 rounded-bl-none shadow-sm'
                }`}
              >
                <p>{m.text}</p>
                <span className="text-[9px] text-white/50 block text-right mt-1 font-mono">
                  {m.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Bottom Bar for Mobile Input */}
      <div className="fixed bottom-0 inset-x-0 p-3 bg-[#080d1e]/95 border-t border-[#1e2a4a] backdrop-blur-2xl z-30">
        <form onSubmit={handleSendMessage} className="max-w-md mx-auto flex items-center gap-2">
          {/* Mic Button */}
          <button
            type="button"
            onClick={() => {
              setIsRecording(!isRecording);
              if (!isRecording) {
                setInputText('Myraa, tell me today’s summary in Bangla');
              }
            }}
            className={`p-3 rounded-full transition-all shrink-0 ${
              isRecording
                ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40'
                : 'bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30'
            }`}
            title="Mobile Voice Input"
          >
            {isRecording ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type message to Myraa... (বাংলা বা English)"
            className="flex-1 bg-[#101736] border border-[#1e2a4a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />

          {/* Send Button */}
          <button
            type="submit"
            className="p-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white shadow-md shadow-purple-600/30 shrink-0"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

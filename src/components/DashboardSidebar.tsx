import React from 'react';
import {
  Home,
  Mic,
  Monitor,
  Cpu,
  Brain,
  FolderOpen,
  Settings,
  Battery,
  Wifi,
  Sparkles,
  Heart,
  Headphones,
} from 'lucide-react';
import type { DashboardSection } from '../types';

interface DashboardSidebarProps {
  currentSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  isAgentConnected: boolean;
  isLiveConnected: boolean;
  isMicActive: boolean;
  memoryCount: number;
  desktopItemCount: number;
  onQuickTalkClick?: () => void;
  onOpenPhoneModal?: () => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  currentSection,
  onSelectSection,
  isAgentConnected,
  isLiveConnected,
  isMicActive,
  memoryCount,
  desktopItemCount,
  onQuickTalkClick,
}) => {
  const navItems: {
    id: DashboardSection;
    label: string;
    icon: React.ElementType;
    badge?: string | number;
    badgeColor?: string;
  }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
    },
    {
      id: 'voice',
      label: 'Live Voice',
      icon: Mic,
      badge: isMicActive ? 'LIVE' : undefined,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    },
    {
      id: 'screen',
      label: 'Screen View',
      icon: Monitor,
      badge: 'Vision',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    },
    {
      id: 'computer',
      label: 'Computer Control',
      icon: Cpu,
      badge: isAgentConnected ? 'ONLINE' : 'PC',
      badgeColor: isAgentConnected
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        : 'bg-slate-800 text-slate-400 border-slate-700',
    },
    {
      id: 'memory',
      label: 'Memory & Routines',
      icon: Brain,
      badge: memoryCount > 0 ? memoryCount : undefined,
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    },
    {
      id: 'files',
      label: 'Files & Apps',
      icon: FolderOpen,
      badge: desktopItemCount > 0 ? desktopItemCount : undefined,
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-full lg:w-[260px] xl:w-[280px] shrink-0 border-r border-[#1e2a4a]/80 bg-[#080d1e]/90 backdrop-blur-2xl flex flex-col justify-between p-4 select-none z-20">
      <div className="space-y-4">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-1 py-1">
          {/* Gradient M Icon */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 p-[2px] shadow-lg shadow-purple-500/25 shrink-0 flex items-center justify-center">
            <div className="w-full h-full bg-[#080d1e] rounded-[10px] flex items-center justify-center">
              <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-tr from-cyan-400 via-purple-400 to-pink-400 text-lg font-['Outfit']">
                M
              </span>
            </div>
          </div>

          <div>
            <h1 className="font-bold text-xl tracking-tight text-white font-['Outfit'] leading-none">
              MYRAA
            </h1>
            <p className="text-[11px] text-cyan-400/80 font-medium tracking-wide mt-1">
              Your AI Companion
            </p>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="space-y-1 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-medium transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600/30 to-blue-600/30 border border-cyan-500/50 text-white shadow-lg shadow-purple-950/40'
                    : 'text-slate-300 hover:text-white hover:bg-[#0f1730]/70 border border-transparent'
                }`}
              >
                {/* Active Indicator Strip */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-cyan-400 shadow-sm shadow-cyan-400" />
                )}

                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive
                        ? 'text-cyan-400'
                        : 'text-blue-400 group-hover:text-cyan-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                      item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Lower Section: Companion Note, Phone Card, Quick Voice, Neon Wave */}
      <div className="space-y-3 pt-3">
        {/* Handwritten Companion Note Card */}
        <div className="p-2.5 rounded-xl bg-[#0f1730]/60 border border-[#1e2a4a]/80 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-pink-400/50 bg-purple-900/40 p-[1px]">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] text-white font-bold">
              M
            </div>
          </div>
          <p className="font-['Caveat',cursive] text-sm text-pink-300/90 leading-tight">
            Always here for you — Myraa ♡
          </p>
        </div>

        {/* Cyber Girl Companion Status Card (Replaced Phone Connect) */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-[#121029] to-[#0a0d20] border border-cyan-500/30 shadow-md shadow-cyan-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-5 h-5 rounded-lg bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                <Headphones className="w-3.5 h-3.5 text-cyan-400" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <span className="text-xs font-semibold text-slate-100">Cyber Companion</span>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-300 mt-2 font-['Noto_Sans_Bengali',sans-serif]">
            <span className="text-pink-300 font-medium">কথা বলতে প্রস্তুত ♡</span>
            <div className="flex items-center gap-0.5">
              <span className="w-1 h-3 rounded-full bg-cyan-400 animate-pulse" />
              <span className="w-1 h-2 rounded-full bg-purple-400 animate-pulse delay-75" />
              <span className="w-1 h-3.5 rounded-full bg-pink-400 animate-pulse delay-150" />
            </div>
          </div>
        </div>

        {/* Quick Voice "Talk to Myraa" Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-b from-[#181133] to-[#0c0f24] border border-purple-500/40 shadow-lg shadow-purple-950/40 text-center space-y-2">
          <button
            onClick={onQuickTalkClick}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:opacity-95 text-white font-semibold text-xs shadow-md shadow-purple-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Talk to Myraa</span>
          </button>
          <p className="text-[11px] text-slate-400">
            Just say <strong className="text-cyan-300 font-medium">&ldquo;Hey Myraa&rdquo;</strong>
          </p>
        </div>

        {/* Decorative Neon Wave Artwork SVG */}
        <div className="w-full h-8 overflow-hidden opacity-70">
          <svg viewBox="0 0 240 32" fill="none" className="w-full h-full">
            <path
              d="M0 16C40 2 80 30 120 16C160 2 200 30 240 16"
              stroke="url(#neonWaveGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M0 20C40 8 80 32 120 20C160 8 200 32 240 20"
              stroke="url(#neonWaveGrad2)"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.6"
            />
            <defs>
              <linearGradient id="neonWaveGrad" x1="0" y1="0" x2="240" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#06b6d4" />
                <stop offset="0.5" stopColor="#a855f7" />
                <stop offset="1" stopColor="#ec4899" />
              </linearGradient>
              <linearGradient id="neonWaveGrad2" x1="0" y1="0" x2="240" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ec4899" />
                <stop offset="0.5" stopColor="#06b6d4" />
                <stop offset="1" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </aside>
  );
};

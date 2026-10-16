import React, { useState } from 'react';
import {
  Globe,
  X,
  ExternalLink,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Search,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface WebBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
}

export const WebBrowserModal: React.FC<WebBrowserModalProps> = ({
  isOpen,
  onClose,
  initialUrl = 'https://www.google.com',
}) => {
  const [urlInput, setUrlInput] = useState<string>(initialUrl);
  const [currentUrl, setCurrentUrl] = useState<string>(initialUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Sync if initialUrl changes
  React.useEffect(() => {
    if (initialUrl) {
      setUrlInput(initialUrl);
      setCurrentUrl(initialUrl);
    }
  }, [initialUrl]);

  if (!isOpen) return null;

  const quickLinks = [
    { name: 'Google', url: 'https://www.google.com/webhp?igu=1' },
    { name: 'YouTube', url: 'https://www.youtube.com' },
    { name: 'Wikipedia', url: 'https://en.m.wikipedia.org' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com' },
    { name: 'ChatGPT', url: 'https://chat.openai.com' },
  ];

  const getEffectiveIframeUrl = (url: string) => {
    let clean = url.trim();
    if (clean === 'https://www.google.com' || clean === 'https://google.com' || clean === 'http://google.com') {
      return 'https://www.google.com/webhp?igu=1';
    }
    // YouTube embeds for specific videos
    if (clean.includes('youtube.com/watch?v=')) {
      const v = clean.split('watch?v=')[1]?.split('&')[0];
      if (v) return `https://www.youtube-nocookie.com/embed/${v}?autoplay=1`;
    }
    if (clean.includes('youtu.be/')) {
      const v = clean.split('youtu.be/')[1]?.split('?')[0];
      if (v) return `https://www.youtube-nocookie.com/embed/${v}?autoplay=1`;
    }
    return clean;
  };

  const handleNavigate = (target: string, openTab = false) => {
    let clean = target.trim();
    if (!clean) return;

    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      if (clean.includes('.') && !clean.includes(' ')) {
        clean = `https://${clean}`;
      } else {
        clean = `https://duckduckgo.com/?q=${encodeURIComponent(clean)}`;
      }
    }

    setUrlInput(clean);
    setCurrentUrl(clean);
    setIsLoading(true);

    if (openTab) {
      window.open(clean, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleNavigate(urlInput);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full flex flex-col bg-[#0b0f24] border border-[#1e2a4a] rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isFullscreen ? 'w-full h-full max-h-screen rounded-none' : 'max-w-5xl h-[88vh]'
        }`}
      >
        {/* Browser Top Navigation Bar */}
        <div className="flex flex-col gap-2 p-3 bg-[#080c1d] border-b border-[#1b2545] select-none">
          {/* Window Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-slate-100">Myraa Web Browser</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    Live Web Engine
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Browse websites, search the web, or open in new tabs directly with Myraa.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* External open link (safe fallback against iframe restriction) */}
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-[#141b3a] hover:bg-purple-900/40 text-purple-200 border border-purple-500/30 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                title="Open in new browser tab"
              >
                <span>Open in Tab</span>
                <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
              </a>

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title={isFullscreen ? 'Restore' : 'Maximize'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                title="Close Browser"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Browser Address & Controls Row */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={() => handleNavigate('https://google.com')}
                className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200 transition-colors"
                title="Home"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsLoading(true);
                  const iframe = document.getElementById('myraa-browser-iframe') as HTMLIFrameElement;
                  if (iframe) iframe.src = currentUrl;
                }}
                className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200 transition-colors"
                title="Reload"
              >
                <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>

            {/* Address Bar */}
            <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0e142e] border border-[#1f2d54] text-xs text-slate-200 focus-within:border-cyan-400 transition-colors">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Enter website URL (e.g. youtube.com) or search keyword..."
                  className="w-full bg-transparent outline-none text-slate-100 placeholder:text-slate-500 font-mono text-xs"
                />
                <button
                  type="submit"
                  className="px-2 py-0.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-medium transition-colors"
                >
                  Go
                </button>
              </div>
            </form>
          </div>

          {/* Quick Bookmarks Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <span className="text-[10px] text-slate-500 uppercase font-mono mr-1 shrink-0">Quick:</span>
            {quickLinks.map((item) => (
              <button
                key={item.name}
                onClick={() => handleNavigate(item.url)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 ${
                  currentUrl.includes(item.name.toLowerCase())
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                    : 'bg-[#0f1636] hover:bg-slate-800 text-slate-300 border border-[#1b2649]'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* Browser Content Area */}
        <div className="flex-1 relative bg-slate-950 overflow-hidden flex flex-col">
          {/* Loading indicator bar */}
          {isLoading && (
            <div className="h-0.5 w-full bg-slate-900 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 animate-pulse w-full" />
            </div>
          )}

          {/* Notification box for security-restricted external sites */}
          <div className="px-3 py-1.5 bg-[#0e142e] border-b border-[#1a2344] flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 truncate">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>
                Viewing: <strong className="text-cyan-300">{currentUrl}</strong>
              </span>
            </div>
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-300 hover:text-pink-200 underline font-medium shrink-0 ml-2 flex items-center gap-1"
            >
              <span>নতুন ব্রাউজার ট্যাবে খুলুন</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* If URL is general YouTube, display video hub + open link button */}
          {currentUrl.includes('youtube.com') && !currentUrl.includes('embed') ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#070b1a] space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-950/50">
                <Globe className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="text-base font-bold text-white">YouTube ভিডিও ও মিউজিক হাব</h4>
                <p className="text-xs text-slate-400">
                  নিরাপত্তা বিধির কারণে ইউটিউবের মূল ওয়েবসাইট সরাসরি নতুন ট্যাবে সবচেয়ে ভালোভাবে চলে। নিচের বাটনে ক্লিক করুন:
                </p>
              </div>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all hover:scale-105"
              >
                <span>ইউটিউব নতুন উইন্ডো বা ট্যাবে চালান</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <iframe
              id="myraa-browser-iframe"
              src={getEffectiveIframeUrl(currentUrl)}
              title="Myraa Embedded Web View"
              onLoad={() => setIsLoading(false)}
              className="w-full flex-1 border-none bg-white"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          )}
        </div>
      </div>
    </div>
  );
};

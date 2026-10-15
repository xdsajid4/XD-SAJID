import React, { useEffect, useRef } from 'react';
import type { ConversationTurn } from '../types';
import { MessageSquare, CornerDownLeft, Volume2, Sparkles, Send, Mic, MicOff, RefreshCw } from 'lucide-react';

interface LiveTranscriptProps {
  turns: ConversationTurn[];
  liveStreamingText: string;
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  onTriggerPrompt: (prompt: string) => void;
}

const CONVERSATION_STARTERS = [
  "Hey Myraa.",
  "You know what happened today?",
  "Note down: Buy groceries and finish presentation by 5pm",
  "Set a 5 minute timer for tea",
  "Stop talking for a while.",
];

export const LiveTranscript: React.FC<LiveTranscriptProps> = ({
  turns,
  liveStreamingText,
  isStreaming,
  onSendMessage,
  onTriggerPrompt,
}) => {
  const [inputText, setInputText] = React.useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, liveStreamingText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
      {/* Transcript Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-200">Conversation Stream</span>
        </div>
        <span className="text-[11px] text-slate-400">
          {turns.length} exchange{turns.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {turns.length === 0 && !liveStreamingText ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <Sparkles className="w-6 h-6 text-indigo-400 mb-2 opacity-60" />
            <p className="text-sm font-medium text-slate-300">Speak or Type to Myraa</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Talk freely. She senses your mood, respects your interruptions, and remembers our session.
            </p>

            <div className="mt-5 w-full max-w-sm space-y-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block text-left">
                Suggested Starters
              </span>
              <div className="flex flex-col gap-1.5">
                {CONVERSATION_STARTERS.map((starter, i) => (
                  <button
                    key={i}
                    onClick={() => onTriggerPrompt(starter)}
                    className="p-2 text-left text-xs text-slate-300 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/50 rounded-xl transition-colors"
                  >
                    &ldquo;{starter}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {turns.map((turn) => {
              const isUser = turn.role === 'user';
              return (
                <div
                  key={turn.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fade-in`}
                >
                  <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400 px-1">
                    <span className="font-medium text-slate-300">{isUser ? 'You' : 'Myraa'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {turn.emotion && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-400/90 italic">{turn.emotion}</span>
                      </>
                    )}
                  </div>

                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? 'bg-indigo-600/25 border border-indigo-500/30 text-indigo-50 rounded-tr-sm'
                        : 'bg-slate-800/70 border border-slate-700/60 text-slate-200 rounded-tl-sm'
                    }`}
                  >
                    {turn.backchannel && (
                      <span className="text-indigo-300 italic font-medium mr-1.5 block mb-1">
                        {turn.backchannel}
                      </span>
                    )}
                    <p className="whitespace-pre-wrap">{turn.content}</p>

                    {turn.toolCall && (
                      <div className="mt-2 py-1 px-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-[11px] text-indigo-300 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        <span className="font-medium">{turn.toolCall.toolName}:</span>
                        <span>{turn.toolCall.details}</span>
                      </div>
                    )}

                    {turn.interrupted && (
                      <div className="mt-2 text-[10px] text-amber-300/80 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        <span>Naturally yielded when you cut in</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Live Streaming Subtitle Bubble */}
            {liveStreamingText && (
              <div className="flex flex-col items-start animate-pulse">
                <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400 px-1">
                  <span className="font-medium text-indigo-300">Myraa (Live Voice)</span>
                </div>
                <div className="max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed bg-slate-800/90 border border-indigo-500/40 text-slate-100 rounded-tl-sm shadow-lg">
                  <p className="whitespace-pre-wrap">{liveStreamingText}</p>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800/80 bg-slate-900/80 flex gap-2">
        <input
          type="text"
          placeholder="Type a thought or question..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors flex items-center justify-center shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

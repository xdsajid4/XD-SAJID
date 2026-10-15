import React, { useEffect, useRef } from 'react';
import type { CompanionEmotion } from '../types';

interface CompanionAuraProps {
  isSpeaking: boolean;
  isUserSpeaking: boolean;
  isInterrupted: boolean;
  isThinking: boolean;
  isQuietMode?: boolean;
  emotion?: CompanionEmotion | null;
  outputAnalyser?: AnalyserNode | null;
  userVolume?: number;
  onInterruptClick?: () => void;
  onResumeClick?: () => void;
}

export const CompanionAura: React.FC<CompanionAuraProps> = ({
  isSpeaking,
  isUserSpeaking,
  isInterrupted,
  isThinking,
  isQuietMode = false,
  emotion,
  outputAnalyser,
  userVolume = 0,
  onInterruptClick,
  onResumeClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;
    const freqData = new Uint8Array(64);

    // Color palettes based on emotion
    const getPalette = () => {
      const mood = (emotion?.mood || '').toLowerCase();
      if (mood.includes('warm') || mood.includes('empath') || mood.includes('comfort')) {
        return {
          inner: 'rgba(251, 146, 60, 0.85)', // orange-400
          mid: 'rgba(244, 63, 94, 0.55)', // rose-500
          outer: 'rgba(168, 85, 247, 0.25)', // purple-500
          glow: 'rgba(251, 191, 36, 0.3)',
        };
      }
      if (mood.includes('play') || mood.includes('joy') || mood.includes('excit')) {
        return {
          inner: 'rgba(250, 204, 21, 0.85)', // yellow-400
          mid: 'rgba(249, 115, 22, 0.55)', // orange-500
          outer: 'rgba(236, 72, 153, 0.25)', // pink-500
          glow: 'rgba(253, 224, 71, 0.3)',
        };
      }
      if (mood.includes('deep') || mood.includes('curious') || mood.includes('reflect')) {
        return {
          inner: 'rgba(56, 189, 248, 0.85)', // sky-400
          mid: 'rgba(129, 140, 248, 0.55)', // indigo-400
          outer: 'rgba(192, 132, 252, 0.25)', // purple-400
          glow: 'rgba(56, 189, 248, 0.3)',
        };
      }
      // Default: living ethereal violet/teal
      return {
        inner: 'rgba(99, 102, 241, 0.85)', // indigo-500
        mid: 'rgba(20, 184, 166, 0.5)', // teal-500
        outer: 'rgba(168, 85, 247, 0.2)', // purple-500
        glow: 'rgba(129, 140, 248, 0.25)',
      };
    };

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Extract frequency data if available
      let audioPower = 0;
      if (outputAnalyser && isSpeaking) {
        outputAnalyser.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 0; i < 32; i++) {
          sum += freqData[i];
        }
        audioPower = (sum / 32) / 255;
      }

      phase += 0.02 + (isSpeaking ? audioPower * 0.05 : 0.005);

      const palette = getPalette();

      // Interruption pulse flash
      if (isInterrupted) {
        ctx.save();
        const flashGrad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, width * 0.45);
        flashGrad.addColorStop(0, 'rgba(254, 215, 170, 0.4)');
        flashGrad.addColorStop(1, 'rgba(254, 215, 170, 0)');
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, width * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Base radius calculation
      const breathing = Math.sin(phase * 1.5) * 6;
      const speechSwell = isSpeaking ? audioPower * 28 : (isUserSpeaking ? Math.min(30, userVolume * 150) : 0);
      const thinkPulse = isThinking ? Math.sin(phase * 4) * 8 : 0;
      const baseRadius = Math.min(centerX, centerY) * 0.42 + breathing + speechSwell + thinkPulse;

      // Outer ambient aura glow
      const outerGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.4,
        centerX,
        centerY,
        baseRadius * 1.8
      );
      outerGrad.addColorStop(0, palette.mid);
      outerGrad.addColorStop(0.5, palette.outer);
      outerGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');

      ctx.save();
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Living organic multi-lobe wave perimeter
      const lobes = 8;
      const points = 120;

      ctx.save();
      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        // FFT harmonics modulation when speaking
        const freqIndex = Math.floor((i / points) * 32);
        const freqWeight = isSpeaking && freqData[freqIndex] ? (freqData[freqIndex] / 255) * 22 : 0;

        // Wave deformation
        const wave1 = Math.sin(angle * lobes + phase * 2) * (isSpeaking ? 14 : 5);
        const wave2 = Math.cos(angle * 4 - phase * 1.5) * (isSpeaking ? 10 : 3);
        const userMicSwell = isUserSpeaking ? Math.sin(angle * 12 + phase * 6) * Math.min(15, userVolume * 80) : 0;

        const r = baseRadius + wave1 + wave2 + freqWeight + userMicSwell;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Fluid mesh gradient fill
      const coreGrad = ctx.createRadialGradient(
        centerX - baseRadius * 0.25,
        centerY - baseRadius * 0.25,
        baseRadius * 0.1,
        centerX,
        centerY,
        baseRadius * 1.2
      );
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      coreGrad.addColorStop(0.3, palette.inner);
      coreGrad.addColorStop(0.7, palette.mid);
      coreGrad.addColorStop(1, palette.outer);

      ctx.fillStyle = coreGrad;
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = isSpeaking ? 35 : 20;
      ctx.fill();
      ctx.restore();

      // Secondary translucent inner crystalline ring
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const innerWave = Math.sin(angle * 5 - phase * 2.5) * (isSpeaking ? 8 : 4);
        const r = (baseRadius * 0.6) + innerWave;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Subtle orbiting particulate nodes
      const particleCount = 5;
      ctx.save();
      for (let p = 0; p < particleCount; p++) {
        const pAngle = phase * 0.6 + (p * (Math.PI * 2 / particleCount));
        const pDist = baseRadius * 1.25 + Math.sin(phase * 2 + p) * 12;
        const px = centerX + Math.cos(pAngle) * pDist;
        const py = centerY + Math.sin(pAngle) * pDist;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isSpeaking, isUserSpeaking, isInterrupted, isThinking, emotion, outputAnalyser, userVolume]);

  const getStatusText = () => {
    if (isQuietMode) return 'Quiet Mode · Silent';
    if (isInterrupted) return 'Listening to you...';
    if (isSpeaking) return 'Speaking naturally';
    if (isThinking) return 'Reflecting...';
    if (isUserSpeaking) return 'Hearing you...';
    return 'Present & Attuned';
  };

  const handleAuraClick = () => {
    if (isQuietMode && onResumeClick) {
      onResumeClick();
    } else if (isSpeaking && onInterruptClick) {
      onInterruptClick();
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center my-2 select-none">
      <div
        className="relative group cursor-pointer"
        onClick={handleAuraClick}
        title={
          isQuietMode
            ? 'Quiet Mode active (Click to resume speaking)'
            : isSpeaking
            ? 'Click to gently interrupt Myraa'
            : 'Myraa is attuned'
        }
      >
        <canvas
          ref={canvasRef}
          width={360}
          height={360}
          className="w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] transition-transform duration-300"
        />

        {/* Center state badge & subtle interrupt affordance */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-slate-950/70 backdrop-blur-md border border-white/10 shadow-lg flex items-center gap-2 transform transition-all duration-300 group-hover:scale-105">
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                isQuietMode
                  ? 'bg-amber-400'
                  : isSpeaking
                  ? 'bg-amber-400 animate-pulse'
                  : isUserSpeaking
                  ? 'bg-emerald-400 animate-ping'
                  : isThinking
                  ? 'bg-sky-400 animate-pulse'
                  : isInterrupted
                  ? 'bg-rose-400'
                  : 'bg-indigo-400'
              }`}
            />
            <span className="text-xs font-medium text-slate-200 tracking-wide">
              {getStatusText()}
            </span>
          </div>

          {isSpeaking && (
            <span className="mt-3 text-[11px] text-slate-400/80 bg-slate-900/60 px-2.5 py-0.5 rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
              Tap anywhere to cut in
            </span>
          )}

          {isQuietMode && (
            <span className="mt-3 text-[11px] text-amber-300/80 bg-slate-900/70 px-2.5 py-0.5 rounded-full border border-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity">
              Tap to resume speech
            </span>
          )}
        </div>
      </div>

      {/* Subtle Companion Emotion / Inner Thought subtitle */}
      {emotion?.internalThought && (
        <div className="mt-2 max-w-sm px-4 text-center animate-fade-in">
          <p className="text-xs italic text-slate-400 tracking-wide">
            &ldquo;{emotion.internalThought}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
};

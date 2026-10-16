import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { AvatarState, CompanionEmotion, VisemeWeights } from '../types';
import { Volume2, VolumeX, Sparkles, AlertCircle, Hand, Mic, MessageSquare } from 'lucide-react';

interface MyraaAvatarProps {
  state: AvatarState;
  isSpeaking: boolean;
  isUserSpeaking: boolean;
  isInterrupted: boolean;
  isThinking: boolean;
  isQuietMode?: boolean;
  isConnected?: boolean;
  emotion?: CompanionEmotion | null;
  outputAnalyser?: AnalyserNode | null;
  userVolume?: number;
  onInterruptClick?: () => void;
  onResumeClick?: () => void;
  className?: string;
}

export const MyraaAvatar: React.FC<MyraaAvatarProps> = ({
  state,
  isSpeaking,
  isUserSpeaking,
  isInterrupted,
  isThinking,
  isQuietMode = false,
  isConnected = true,
  emotion,
  outputAnalyser,
  userVolume = 0,
  onInterruptClick,
  onResumeClick,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Viseme & facial parameter smoothing refs (kept outside React state for 60fps canvas loop)
  const rigRef = useRef({
    headTilt: 0,
    headOffsetY: 0,
    headOffsetX: 0,
    jawOpen: 0,
    mouthWidth: 34,
    mouthRoundness: 0,
    smileAmount: 0.3,
    teethVisible: 0,
    eyeOpenLeft: 1.0,
    eyeOpenRight: 1.0,
    gazeX: 0,
    gazeY: 0,
    browLeftY: 0,
    browRightY: 0,
    browTilt: 0,
    blush: 0.3,
    hairSway: 0,
    blinkTimer: 3.0,
    blinkDuration: 0,
    audioEnergy: 0,
    lastTime: performance.now(),
  });

  // Calculate effective avatar state
  const effectiveState: AvatarState = useMemo(() => {
    if (!isConnected) return 'error';
    if (isInterrupted) return 'interrupted';
    if (isSpeaking) return 'speaking';
    if (isThinking) return 'thinking';
    if (isUserSpeaking) return 'listening';
    const mood = (emotion?.mood || '').toLowerCase();
    if (mood.includes('happy') || mood.includes('play') || mood.includes('joy') || mood.includes('excit')) {
      return 'happy';
    }
    if (mood.includes('concern') || mood.includes('warn') || mood.includes('care') || mood.includes('empath')) {
      return 'concerned';
    }
    return state || 'idle';
  }, [isConnected, isInterrupted, isSpeaking, isThinking, isUserSpeaking, emotion, state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    const freqData = new Uint8Array(64);

    const render = (now: number) => {
      const rig = rigRef.current;
      const dt = Math.min(0.05, (now - rig.lastTime) / 1000);
      rig.lastTime = now;
      const time = now / 1000;

      // 1. Audio Analysis Pipeline: Real-time Output Stream Only
      let rawAudioEnergy = 0;
      let lowBand = 0;
      let midBand = 0;
      let highBand = 0;

      if (outputAnalyser && isSpeaking && !isInterrupted && !isQuietMode) {
        outputAnalyser.getByteFrequencyData(freqData);

        // Sub-band frequency decomposition
        let sumLow = 0;
        let sumMid = 0;
        let sumHigh = 0;

        for (let i = 0; i < 8; i++) sumLow += freqData[i]; // ~0-750Hz (vowels/jaw drop)
        for (let i = 8; i < 24; i++) sumMid += freqData[i]; // ~750-2250Hz (formants)
        for (let i = 24; i < 48; i++) sumHigh += freqData[i]; // ~2250-4500Hz (sibilants/spread)

        lowBand = (sumLow / 8) / 255;
        midBand = (sumMid / 16) / 255;
        highBand = (sumHigh / 24) / 255;

        rawAudioEnergy = (lowBand * 0.5 + midBand * 0.35 + highBand * 0.15);
      }

      // Noise gate: ignore sub-perceptible microphone bleed or room hum
      const audioActive = isSpeaking && rawAudioEnergy > 0.035 && !isInterrupted;
      rig.audioEnergy = rig.audioEnergy * 0.75 + (audioActive ? rawAudioEnergy : 0) * 0.25;

      // 2. Viseme Mapping: compute target mouth shape
      let targetJawOpen = 0;
      let targetMouthWidth = 32;
      let targetRoundness = 0;
      let targetTeeth = 0;
      let targetSmile = 0.28;

      if (audioActive) {
        // High energy low-band -> open vowel 'aa'
        // High mid-band -> rounded vowel 'oh'/'oo'
        // High sibilant high-band -> spread 'ee'
        const vowelAperture = Math.min(1.0, lowBand * 1.8);
        targetJawOpen = vowelAperture * 18; // 0 to 18px mouth drop
        targetTeeth = lowBand > 0.15 ? 0.8 : 0.2;

        if (midBand > lowBand * 0.85) {
          // Rounded 'oh' or 'oo'
          targetRoundness = Math.min(1.0, midBand * 1.6);
          targetMouthWidth = 28 - targetRoundness * 8; // pursed narrower
        } else if (highBand > 0.18) {
          // Spread smile 'ee'
          targetMouthWidth = 36 + highBand * 14;
          targetSmile = 0.55;
        } else {
          // Intermediate consonant or relaxed vowel
          targetMouthWidth = 32 + lowBand * 6;
        }
      } else {
        // Speech ended or paused: mouth closed in sweet resting smile
        targetJawOpen = 0;
        targetMouthWidth = 32;
        targetRoundness = 0;
        targetTeeth = 0;
        targetSmile = effectiveState === 'happy' ? 0.65 : effectiveState === 'concerned' ? 0.05 : 0.28;
      }

      // Smooth mouth interpolation (anti-jitter exponential damping)
      const mouthAttack = audioActive ? 0.45 : 0.25;
      rig.jawOpen += (targetJawOpen - rig.jawOpen) * mouthAttack;
      rig.mouthWidth += (targetMouthWidth - rig.mouthWidth) * 0.28;
      rig.mouthRoundness += (targetRoundness - rig.mouthRoundness) * 0.25;
      rig.teethVisible += (targetTeeth - rig.teethVisible) * 0.3;
      rig.smileAmount += (targetSmile - rig.smileAmount) * 0.15;

      // 3. Eye Blinking & Saccadic Gaze Pipeline
      rig.blinkTimer -= dt;
      if (rig.blinkTimer <= 0) {
        // Start natural blink cycle
        rig.blinkDuration = 0.14; // ~140ms natural blink
        // Next blink in 2.8 to 4.8 seconds, occasional quick double blink
        rig.blinkTimer = Math.random() < 0.2 ? 0.3 : 2.5 + Math.random() * 2.8;
      }

      let blinkProgress = 1.0;
      if (rig.blinkDuration > 0) {
        rig.blinkDuration -= dt;
        const phase = 1.0 - Math.max(0, rig.blinkDuration) / 0.14;
        // Bell curve closing and reopening
        blinkProgress = Math.abs(Math.sin(phase * Math.PI));
        rig.eyeOpenLeft = 1.0 - blinkProgress;
        rig.eyeOpenRight = 1.0 - blinkProgress;
      } else {
        rig.eyeOpenLeft = 1.0;
        rig.eyeOpenRight = 1.0;
      }

      // Micro-gaze shifts (natural human eye darting)
      if (Math.sin(time * 0.45) > 0.98) {
        rig.gazeX = (Math.sin(time * 1.5) * 0.25);
        rig.gazeY = (Math.cos(time * 1.2) * 0.15);
      } else {
        rig.gazeX += (0 - rig.gazeX) * 0.05;
        rig.gazeY += (0 - rig.gazeY) * 0.05;
      }

      // 4. Head Pose & Breathing Dynamics
      const breathCycle = Math.sin(time * 1.6);
      const targetOffsetY = breathCycle * 2.5 + (isSpeaking ? Math.sin(time * 12) * rig.audioEnergy * 4 : 0);
      let targetTilt = 0;
      let targetOffsetX = 0;
      let targetBrowTilt = 0;
      let targetBlush = 0.3;

      if (effectiveState === 'listening') {
        targetTilt = -0.05; // sweet attentive 3-degree head tilt
        targetOffsetX = -3;
        targetBrowTilt = 2; // curious raised brows
        rig.eyeOpenLeft = Math.min(1.15, rig.eyeOpenLeft * 1.08);
        rig.eyeOpenRight = Math.min(1.15, rig.eyeOpenRight * 1.08);
      } else if (effectiveState === 'thinking') {
        targetTilt = 0.06; // thoughtful tilt upward/aside
        targetOffsetX = 4;
        targetBrowTilt = -2; // slightly furrowed
        rig.gazeY = -0.25; // looking gently upward
        rig.gazeX = 0.2;
      } else if (effectiveState === 'speaking') {
        targetTilt = Math.sin(time * 3.5) * 0.025; // rhythmic conversational micro-nodding
        targetOffsetX = Math.sin(time * 2.0) * 1.5;
        targetBlush = 0.45;
      } else if (effectiveState === 'happy') {
        targetTilt = Math.sin(time * 2.5) * 0.04;
        targetBlush = 0.65;
        targetBrowTilt = 3;
      } else if (effectiveState === 'concerned') {
        targetTilt = -0.04;
        targetBrowTilt = -3;
        targetBlush = 0.35;
      } else if (effectiveState === 'error') {
        targetTilt = 0.05;
        targetBrowTilt = -2;
      }

      rig.headOffsetY += (targetOffsetY - rig.headOffsetY) * 0.1;
      rig.headOffsetX += (targetOffsetX - rig.headOffsetX) * 0.08;
      rig.headTilt += (targetTilt - rig.headTilt) * 0.08;
      rig.browTilt += (targetBrowTilt - rig.browTilt) * 0.1;
      rig.blush += (targetBlush - rig.blush) * 0.05;
      rig.hairSway = Math.sin(time * 1.8) * 3 + rig.headTilt * 25;

      // 5. Canvas High-DPI Rendering
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2 + 15;

      // --- LAYER 0: Neon Gaming-Room Background & Atmospheric Backlight ---
      ctx.save();
      // Room background deep gradient
      const roomGrad = ctx.createLinearGradient(0, 0, width, height);
      roomGrad.addColorStop(0, '#060813');
      roomGrad.addColorStop(0.5, '#0b0d1e');
      roomGrad.addColorStop(1, '#050712');
      ctx.fillStyle = roomGrad;
      ctx.fillRect(0, 0, width, height);

      // Background dual monitor ambient glow (gaming room feel)
      // Left monitor glow (pink/violet)
      const leftMon = ctx.createRadialGradient(cx - 160, cy - 60, 20, cx - 160, cy - 60, 140);
      leftMon.addColorStop(0, 'rgba(236, 72, 153, 0.22)');
      leftMon.addColorStop(1, 'rgba(236, 72, 153, 0)');
      ctx.fillStyle = leftMon;
      ctx.fillRect(cx - 240, cy - 140, 160, 160);

      // Right monitor glow (cyan/blue)
      const rightMon = ctx.createRadialGradient(cx + 160, cy - 60, 20, cx + 160, cy - 60, 140);
      rightMon.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
      rightMon.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = rightMon;
      ctx.fillRect(cx + 80, cy - 140, 160, 160);

      // Back wall vertical neon light strips
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(cx - 180, 20);
      ctx.lineTo(cx - 180, height - 40);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(cx + 180, 20);
      ctx.lineTo(cx + 180, height - 40);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Central character aura halo
      const auraPulse = Math.sin(time * 2) * 8 + (isSpeaking ? rig.audioEnergy * 25 : 0);
      const auraGrad = ctx.createRadialGradient(cx, cy - 20, 40, cx, cy - 20, 210 + auraPulse);

      if (effectiveState === 'happy') {
        auraGrad.addColorStop(0, 'rgba(236, 72, 153, 0.45)');
        auraGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.25)');
        auraGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else if (effectiveState === 'concerned') {
        auraGrad.addColorStop(0, 'rgba(251, 146, 60, 0.4)');
        auraGrad.addColorStop(0.6, 'rgba(147, 51, 234, 0.2)');
        auraGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else if (effectiveState === 'listening') {
        auraGrad.addColorStop(0, 'rgba(45, 212, 191, 0.5)');
        auraGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.25)');
        auraGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else if (effectiveState === 'speaking') {
        auraGrad.addColorStop(0, 'rgba(168, 85, 247, 0.55)');
        auraGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.3)');
        auraGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else {
        auraGrad.addColorStop(0, 'rgba(129, 140, 248, 0.35)');
        auraGrad.addColorStop(0.6, 'rgba(99, 102, 241, 0.15)');
        auraGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      }

      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy - 20, 210 + auraPulse, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric floating particles & cyber bokeh orbs matching reference image
      const bokehOrbs = [
        { x: -140, y: -90, r: 24, c: 'rgba(236, 72, 153, 0.28)' },
        { x: 150, y: -70, r: 30, c: 'rgba(168, 85, 247, 0.25)' },
        { x: -120, y: 70, r: 20, c: 'rgba(0, 229, 255, 0.2)' },
        { x: 130, y: 80, r: 26, c: 'rgba(236, 72, 153, 0.22)' },
        { x: -70, y: -130, r: 16, c: 'rgba(168, 85, 247, 0.3)' },
        { x: 80, y: -120, r: 18, c: 'rgba(0, 229, 255, 0.25)' },
      ];
      for (const orb of bokehOrbs) {
        const pulse = Math.sin(time * 1.5 + orb.r) * 4;
        ctx.fillStyle = orb.c;
        ctx.beginPath();
        ctx.arc(cx + orb.x, cy + orb.y, Math.max(4, orb.r + pulse), 0, Math.PI * 2);
        ctx.fill();
      }

      for (let p = 0; p < 8; p++) {
        const pAngle = time * 0.4 + (p * (Math.PI * 2 / 8));
        const pDist = 160 + Math.sin(time * 1.5 + p) * 20;
        const px = cx + Math.cos(pAngle) * pDist;
        const py = (cy - 30) + Math.sin(pAngle) * (pDist * 0.75);
        ctx.fillStyle = p % 2 === 0 ? 'rgba(236, 72, 153, 0.7)' : 'rgba(0, 229, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(px, py, 2.2 + Math.sin(time * 3 + p), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // --- APPLIED CHARACTER TRANSFORM (Head tilt & breathing offset) ---
      ctx.save();
      ctx.translate(cx + rig.headOffsetX, cy + rig.headOffsetY);
      ctx.rotate(rig.headTilt);

      // --- LAYER 1: Hair (Back Flowing Mass) ---
      ctx.save();
      const backHairGrad = ctx.createLinearGradient(-120, -140, 120, 220);
      backHairGrad.addColorStop(0, '#13111c');
      backHairGrad.addColorStop(0.5, '#1e1b2e');
      backHairGrad.addColorStop(1, '#0e0d17');

      ctx.fillStyle = backHairGrad;
      ctx.beginPath();
      // Voluminous flowing dark locks behind shoulders
      ctx.moveTo(-115, -60);
      ctx.bezierCurveTo(-155, -20, -145 + rig.hairSway, 120, -100 + rig.hairSway, 210);
      ctx.bezierCurveTo(-60, 220, 60, 220, 100 + rig.hairSway, 210);
      ctx.bezierCurveTo(145 + rig.hairSway, 120, 155, -20, 115, -60);
      ctx.bezierCurveTo(100, -165, -100, -165, -115, -60);
      ctx.fill();

      // Soft purple/cyan rim reflection on back hair
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();

      // --- LAYER 2: Shoulders, Torso & Futuristic Collar ---
      ctx.save();
      // Shoulders & Chest
      const skinNeckGrad = ctx.createLinearGradient(0, 40, 0, 140);
      skinNeckGrad.addColorStop(0, '#fad5c0');
      skinNeckGrad.addColorStop(1, '#f1bda1');

      ctx.fillStyle = skinNeckGrad;
      ctx.beginPath();
      ctx.moveTo(-35, 45);
      ctx.quadraticCurveTo(-45, 95, -75, 130);
      ctx.lineTo(75, 130);
      ctx.quadraticCurveTo(45, 95, 35, 45);
      ctx.closePath();
      ctx.fill();

      // Clavicle shading
      ctx.strokeStyle = 'rgba(199, 133, 106, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-45, 115);
      ctx.quadraticCurveTo(-15, 124, 0, 116);
      ctx.quadraticCurveTo(15, 124, 45, 115);
      ctx.stroke();

      // High-fashion dark futuristic jacket / top with luminous violet lining
      const suitGrad = ctx.createLinearGradient(0, 120, 0, 240);
      suitGrad.addColorStop(0, '#1c1b29');
      suitGrad.addColorStop(0.7, '#111019');
      suitGrad.addColorStop(1, '#09090f');

      ctx.fillStyle = suitGrad;
      ctx.beginPath();
      ctx.moveTo(-130, 230);
      ctx.bezierCurveTo(-100, 145, -70, 128, -40, 128);
      ctx.lineTo(0, 160);
      ctx.lineTo(40, 128);
      ctx.bezierCurveTo(70, 128, 100, 145, 130, 230);
      ctx.closePath();
      ctx.fill();

      // Luminous cyan-violet collar lapel trim
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-75, 132);
      ctx.lineTo(-38, 130);
      ctx.lineTo(0, 162);
      ctx.lineTo(38, 130);
      ctx.lineTo(75, 132);
      ctx.stroke();

      // Center pendant glowing crystal
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 150, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // --- LAYER 3: Neck Shading & Soft Feminine Face Contour ---
      ctx.save();
      // Soft shadow under chin
      ctx.fillStyle = 'rgba(175, 102, 79, 0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 48, 28, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Face Shape (sweet feminine anime jawline and rounded cheeks)
      const faceGrad = ctx.createRadialGradient(0, -12, 10, 0, 5, 88);
      faceGrad.addColorStop(0, '#fff3eb');
      faceGrad.addColorStop(0.65, '#fde2d4');
      faceGrad.addColorStop(1, '#f7c8b2');

      ctx.fillStyle = faceGrad;
      ctx.beginPath();
      ctx.moveTo(-64, -45);
      // Soft curved anime cheeks down to delicate chin
      ctx.bezierCurveTo(-66, 12, -48, 54, 0, 58); // chin
      ctx.bezierCurveTo(48, 54, 66, 12, 64, -45);
      // High smooth forehead
      ctx.bezierCurveTo(60, -105, -60, -105, -64, -45);
      ctx.closePath();
      ctx.fill();

      // Soft Anime Cheek Blush with cute blush stripes ///
      const blushOpacity = Math.max(0.2, Math.min(0.85, rig.blush));
      const drawBlush = (bx: number) => {
        const blushGrad = ctx.createRadialGradient(bx, 10, 2, bx, 10, 26);
        blushGrad.addColorStop(0, `rgba(244, 63, 94, ${blushOpacity})`);
        blushGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
        ctx.fillStyle = blushGrad;
        ctx.beginPath();
        ctx.arc(bx, 10, 26, 0, Math.PI * 2);
        ctx.fill();

        // Cute diagonal anime blush stripes ///
        ctx.strokeStyle = `rgba(244, 63, 94, ${blushOpacity * 0.75})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(bx - 8, 13);
        ctx.lineTo(bx - 4, 7);
        ctx.moveTo(bx - 3, 13);
        ctx.lineTo(bx + 1, 7);
        ctx.moveTo(bx + 2, 13);
        ctx.lineTo(bx + 6, 7);
        ctx.stroke();
      };
      drawBlush(-36); // Left cheek
      drawBlush(36); // Right cheek

      // Cute small anime nose
      ctx.strokeStyle = 'rgba(190, 118, 90, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.quadraticCurveTo(2, 9, 3, 9);
      ctx.stroke();

      // Soft specular highlight on nose tip
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(0, 6.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // --- LAYER 4: Big, Soulful Anime Doe Eyes ---
      const drawEye = (isRight: boolean) => {
        ctx.save();
        const eyeX = isRight ? 30 : -30;
        const eyeY = -12;
        const eyeOpen = isRight ? rig.eyeOpenRight : rig.eyeOpenLeft;
        const scaleY = Math.max(0.04, eyeOpen);

        ctx.translate(eyeX, eyeY);
        ctx.scale(1, scaleY);

        // 1. Eye Sclera (White) - large anime aperture
        ctx.beginPath();
        ctx.moveTo(-19, 1);
        ctx.bezierCurveTo(-12, -12, 12, -12, 19, 1);
        ctx.bezierCurveTo(12, 11, -12, 11, -19, 1);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Soft upper sclera shadow
        const scleraShadow = ctx.createLinearGradient(0, -12, 0, 0);
        scleraShadow.addColorStop(0, 'rgba(147, 130, 180, 0.35)');
        scleraShadow.addColorStop(1, 'rgba(147, 130, 180, 0)');
        ctx.fillStyle = scleraShadow;
        ctx.fill();

        // 2. Clip Iris inside Sclera
        ctx.save();
        ctx.clip();

        // Large Luminous Iris
        const irisX = rig.gazeX * 5 + (isRight ? -0.8 : 0.8);
        const irisY = rig.gazeY * 3.5 + 0.5;
        const irisR = 12.5;

        // Multi-stop hazel-amber anime iris gradient matching reference image
        const irisGrad = ctx.createRadialGradient(irisX, irisY, 2, irisX, irisY, irisR);
        irisGrad.addColorStop(0, '#1c0f08'); // obsidian core
        irisGrad.addColorStop(0.3, '#3e1d0f'); // midnight espresso
        irisGrad.addColorStop(0.6, '#7a3e1a'); // rich chestnut hazel
        irisGrad.addColorStop(0.85, '#c8782f'); // warm glowing amber
        irisGrad.addColorStop(1, '#ffc078'); // soft golden limbal glow
        ctx.fillStyle = irisGrad;
        ctx.beginPath();
        ctx.arc(irisX, irisY, irisR, 0, Math.PI * 2);
        ctx.fill();

        // Lower crescent glowing cyan/violet bounce light
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(irisX, irisY, irisR - 1.5, Math.PI * 0.2, Math.PI * 0.8);
        ctx.stroke();

        // Pupil (deep dark center)
        ctx.fillStyle = '#090412';
        ctx.beginPath();
        ctx.arc(irisX, irisY, 5.0, 0, Math.PI * 2);
        ctx.fill();

        // Soulful Anime Highlights:
        // Main Brilliant Sparkle (Upper-left)
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(irisX - 4.2, irisY - 4.0, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Secondary Soft Highlight (Lower-right)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.arc(irisX + 4.2, irisY + 3.2, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Tertiary Micro Sparkle
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(irisX - 1.0, irisY + 4.5, 1.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // end sclera clip

        ctx.restore(); // undo scaleY for crisp lash rendering

        // 3. Crisp Stylized Upper & Lower Eyelashes
        ctx.save();
        ctx.translate(eyeX, eyeY);

        const currentLidY = -10 * scaleY;

        // Thick curved anime upper lash line
        ctx.strokeStyle = '#181024';
        ctx.lineWidth = 3.0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-20, 1);
        ctx.quadraticCurveTo(0, currentLidY * 1.3 - 2, 20, 1);
        ctx.stroke();

        // Elegant Winged Cat-Eye Flair
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        if (isRight) {
          ctx.moveTo(19, 1);
          ctx.lineTo(24, -3);
          ctx.moveTo(17, 2);
          ctx.lineTo(22, 1);
        } else {
          ctx.moveTo(-19, 1);
          ctx.lineTo(-24, -3);
          ctx.moveTo(-17, 2);
          ctx.lineTo(-22, 1);
        }
        ctx.stroke();

        // Delicate lower lash line
        ctx.strokeStyle = 'rgba(30, 20, 45, 0.45)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        if (isRight) {
          ctx.moveTo(-6, 10 * scaleY);
          ctx.quadraticCurveTo(8, 11 * scaleY, 16, 3);
        } else {
          ctx.moveTo(6, 10 * scaleY);
          ctx.quadraticCurveTo(-8, 11 * scaleY, -16, 3);
        }
        ctx.stroke();

        // Double-Eyelid Crease Line above eye
        ctx.strokeStyle = 'rgba(165, 95, 80, 0.35)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(-15, -14);
        ctx.quadraticCurveTo(0, -17, 15, -14);
        ctx.stroke();

        ctx.restore();
      };

      drawEye(false); // Left eye
      drawEye(true); // Right eye

      // --- LAYER 5: Expressive Anime Eyebrows (Positioned at y = -33) ---
      const drawEyebrow = (isRight: boolean) => {
        ctx.save();
        const browX = isRight ? 30 : -30;
        const browY = -33 + (isRight ? -rig.browTilt : rig.browTilt);
        ctx.translate(browX, browY);

        ctx.strokeStyle = '#2b1e38';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';

        ctx.beginPath();
        if (isRight) {
          ctx.moveTo(-17, 2);
          ctx.quadraticCurveTo(0, -4, 16, 1);
        } else {
          ctx.moveTo(-16, 1);
          ctx.quadraticCurveTo(0, -4, 17, 2);
        }
        ctx.stroke();
        ctx.restore();
      };

      drawEyebrow(false);
      drawEyebrow(true);

      // --- LAYER 6: Real-Time Audio-Reactive Mouth & Viseme Rig ---
      ctx.save();
      const mouthY = 32;
      ctx.translate(0, mouthY);

      const mw = rig.mouthWidth / 2;
      const jaw = rig.jawOpen;
      const smile = rig.smileAmount;
      const roundness = rig.mouthRoundness;

      // When speaking with audio energy -> drop jaw open
      if (jaw > 1.2) {
        // Inner mouth cavity
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-mw, 0);
        ctx.bezierCurveTo(-mw * 0.4, -2.5, mw * 0.4, -2.5, mw, 0);
        ctx.bezierCurveTo(mw * 0.7 - roundness * 6, jaw, -mw * 0.7 + roundness * 6, jaw, -mw, 0);
        ctx.closePath();

        const cavityGrad = ctx.createLinearGradient(0, 0, 0, jaw);
        cavityGrad.addColorStop(0, '#38101a');
        cavityGrad.addColorStop(1, '#6b1d28');
        ctx.fillStyle = cavityGrad;
        ctx.fill();

        // Upper pearly teeth row
        if (rig.teethVisible > 0.1) {
          ctx.fillStyle = '#fdfefe';
          ctx.beginPath();
          ctx.moveTo(-mw * 0.55, 0);
          ctx.quadraticCurveTo(0, Math.min(jaw * 0.4, 4.5), mw * 0.55, 0);
          ctx.lineTo(-mw * 0.55, 0);
          ctx.fill();
        }

        // Soft tongue hint
        if (jaw > 5) {
          ctx.fillStyle = 'rgba(244, 114, 138, 0.8)';
          ctx.beginPath();
          ctx.ellipse(0, jaw - 2.5, mw * 0.45, Math.min(jaw * 0.4, 4), 0, 0, Math.PI);
          ctx.fill();
        }
        ctx.restore();
      }

      // Upper Lip
      const lipColor = '#e1687c';
      ctx.fillStyle = lipColor;
      ctx.beginPath();
      ctx.moveTo(-mw, 0);
      ctx.bezierCurveTo(-mw * 0.5, -3.2 - smile * 3, -4, -4.2 - smile * 2, 0, -2.2);
      ctx.bezierCurveTo(4, -4.2 - smile * 2, mw * 0.5, -3.2 - smile * 3, mw, 0);
      ctx.bezierCurveTo(mw * 0.4, jaw > 1 ? 0 : 1.2, -mw * 0.4, jaw > 1 ? 0 : 1.2, -mw, 0);
      ctx.closePath();
      ctx.fill();

      // Lower Lip
      ctx.fillStyle = '#dc586d';
      ctx.beginPath();
      ctx.moveTo(-mw * 0.95, jaw > 1 ? jaw * 0.15 : 0);
      const lowerLipDrop = jaw > 1 ? jaw + 5.5 : 5.8 + smile * 2.5;
      ctx.bezierCurveTo(-mw * 0.5, lowerLipDrop, mw * 0.5, lowerLipDrop, mw * 0.95, jaw > 1 ? jaw * 0.15 : 0);
      ctx.bezierCurveTo(mw * 0.4, jaw > 1 ? jaw : 1.0, -mw * 0.4, jaw > 1 ? jaw : 1.0, -mw * 0.95, jaw > 1 ? jaw * 0.15 : 0);
      ctx.closePath();
      ctx.fill();

      // Lower lip glossy highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.ellipse(0, jaw > 1 ? jaw + 2.5 : 3.8, mw * 0.35, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sweet corner smile indentations
      ctx.strokeStyle = 'rgba(145, 55, 65, 0.5)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(-mw - 1, -smile * 2.5);
      ctx.lineTo(-mw + 2, 0);
      ctx.moveTo(mw + 1, -smile * 2.5);
      ctx.lineTo(mw - 2, 0);
      ctx.stroke();
      ctx.restore();

      // --- LAYER 7: Beautiful Anime Bangs & Framing Hair (CLEAR OF EYES!) ---
      ctx.save();
      const hairGrad = ctx.createLinearGradient(-100, -120, 100, 160);
      hairGrad.addColorStop(0, '#181224');
      hairGrad.addColorStop(0.5, '#221935');
      hairGrad.addColorStop(1, '#0e0b16');
      ctx.fillStyle = hairGrad;

      // Side Hair Framing Locks (Cascading down past cheeks without blocking face)
      // Left side lock
      ctx.beginPath();
      ctx.moveTo(-62, -50);
      ctx.bezierCurveTo(-78, -20, -72 + rig.hairSway, 50, -64 + rig.hairSway, 115);
      ctx.bezierCurveTo(-58 + rig.hairSway, 118, -52, 40, -56, -20);
      ctx.closePath();
      ctx.fill();

      // Right side lock
      ctx.beginPath();
      ctx.moveTo(62, -50);
      ctx.bezierCurveTo(78, -20, 72 + rig.hairSway, 50, 64 + rig.hairSway, 115);
      ctx.bezierCurveTo(58 + rig.hairSway, 118, 52, 40, 56, -20);
      ctx.closePath();
      ctx.fill();

      // Beautiful See-Through Anime Forehead Bangs with Center Part
      // Notice: All bang tips stay above y = -43, NEVER touching eyebrows (y = -33) or eyes (y = -12)!
      ctx.beginPath();
      ctx.moveTo(-64, -60);
      // Left forehead strand arching gently
      ctx.bezierCurveTo(-54, -48, -42, -43, -34, -44);
      ctx.bezierCurveTo(-28, -52, -24, -50, -18, -48);
      // Center parted opening showing clear forehead and beautiful gaze
      ctx.lineTo(-14, -54);
      ctx.lineTo(14, -54);
      // Right forehead strand arching gently
      ctx.lineTo(18, -48);
      ctx.bezierCurveTo(24, -50, 28, -52, 34, -44);
      ctx.bezierCurveTo(42, -43, 54, -48, 64, -60);
      // Top hairline arc
      ctx.bezierCurveTo(40, -112, -40, -112, -64, -60);
      ctx.closePath();
      ctx.fill();

      // Subtle translucent wispy hair tips
      ctx.fillStyle = 'rgba(34, 25, 53, 0.45)';
      ctx.beginPath();
      ctx.moveTo(-32, -44);
      ctx.lineTo(-28, -38);
      ctx.lineTo(-24, -44);
      ctx.moveTo(24, -44);
      ctx.lineTo(28, -38);
      ctx.lineTo(32, -44);
      ctx.fill();

      // Luminous Anime Hair Sheen (glossy violet and cyan reflection band)
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-45, -82);
      ctx.quadraticCurveTo(-15, -70, 42, -84);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-36, -76);
      ctx.quadraticCurveTo(0, -64, 32, -78);
      ctx.stroke();

      // Cute animated Ahoge (stray hair curl on top with subtle bounce)
      const ahogeSway = Math.sin(time * 2.5) * 4;
      ctx.strokeStyle = '#221935';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(0, -98);
      ctx.bezierCurveTo(-10, -125, 15 + ahogeSway, -135, 12 + ahogeSway, -118);
      ctx.stroke();
      ctx.restore();

      // --- LAYER 8: Futuristic Gaming Headset ---
      ctx.save();
      // Headband outer structure
      ctx.strokeStyle = '#151221';
      ctx.lineWidth = 13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, -52, 73, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();

      // Headband soft cushion
      ctx.strokeStyle = '#292238';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, -50, 71, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();

      // Glowing Electric Cyan LED Strip on headband
      ctx.strokeStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.arc(0, -53, 75, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Left Earcup (-75, -14) with glowing electric cyan LED ring matching reference image
      ctx.save();
      ctx.translate(-75, -14);
      ctx.fillStyle = '#0c1022';
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 28, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#151b36';
      ctx.beginPath();
      ctx.ellipse(-3, 0, 14, 25, -0.15, 0, Math.PI * 2);
      ctx.fill();
      const leftGlow = 0.65 + rig.audioEnergy * 0.45;
      ctx.strokeStyle = `rgba(0, 229, 255, ${leftGlow})`;
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 14 * leftGlow;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(-3, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
      // Glowing inner cyber core
      ctx.fillStyle = `rgba(0, 229, 255, ${leftGlow * 0.85})`;
      ctx.beginPath();
      ctx.arc(-3, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Right Earcup (75, -14) with matching glowing electric cyan LED ring
      ctx.save();
      ctx.translate(75, -14);
      ctx.fillStyle = '#0c1022';
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 28, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#151b36';
      ctx.beginPath();
      ctx.ellipse(3, 0, 14, 25, 0.15, 0, Math.PI * 2);
      ctx.fill();
      const rightGlow = 0.65 + rig.audioEnergy * 0.45;
      ctx.strokeStyle = `rgba(0, 229, 255, ${rightGlow})`;
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 14 * rightGlow;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(3, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
      // Glowing inner cyber core
      ctx.fillStyle = `rgba(0, 229, 255, ${rightGlow * 0.85})`;
      ctx.beginPath();
      ctx.arc(3, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Headset Boom Mic extending from left earcup toward mouth (exact as in reference image)
      ctx.save();
      ctx.strokeStyle = '#1e284a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-74, 6);
      ctx.quadraticCurveTo(-60, 30, -36, 32);
      ctx.stroke();
      // Glowing cyan mic capsule
      ctx.fillStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(-36, 32, 4.0, 2.8, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.restore(); // End headphones

      ctx.restore(); // Character rotation & transform

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [effectiveState, isSpeaking, isUserSpeaking, isInterrupted, isThinking, isQuietMode, outputAnalyser, emotion]);

  const getStateBadge = () => {
    switch (effectiveState) {
      case 'speaking':
        return {
          label: 'Speaking (কথা বলছে)',
          color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          dot: 'bg-indigo-400 animate-pulse',
        };
      case 'listening':
        return {
          label: 'Attentive Listening (শুনছে)',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          dot: 'bg-emerald-400 animate-ping',
        };
      case 'thinking':
        return {
          label: 'Thinking (ভাবছে...)',
          color: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
          dot: 'bg-sky-400 animate-pulse',
        };
      case 'happy':
        return {
          label: 'Joyful & Attuned (আনন্দিত)',
          color: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
          dot: 'bg-pink-400',
        };
      case 'concerned':
        return {
          label: 'Empathetic & Caring (সতর্ক)',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400',
        };
      case 'interrupted':
        return {
          label: 'Paused / Cut In (থেমেছে)',
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          dot: 'bg-rose-400',
        };
      case 'error':
        return {
          label: 'Connection Standby',
          color: 'bg-red-500/20 text-red-300 border-red-500/40',
          dot: 'bg-red-400',
        };
      default:
        return {
          label: isQuietMode ? 'Quiet Mode (নীরব)' : 'Present & Listening',
          color: 'bg-slate-800/80 text-slate-300 border-slate-700/80',
          dot: isQuietMode ? 'bg-amber-400' : 'bg-indigo-400',
        };
    }
  };

  const badge = getStateBadge();

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* Interactive Avatar Container */}
      <div
        className="relative group cursor-pointer"
        onClick={() => {
          if (isQuietMode && onResumeClick) {
            onResumeClick();
          } else if (isSpeaking && onInterruptClick) {
            onInterruptClick();
          }
        }}
        title={
          isQuietMode
            ? 'Quiet mode active (Click to resume speaking)'
            : isSpeaking
            ? 'Click to gently cut in / interrupt Myraa'
            : 'Myraa is attuned and present'
        }
      >
        {/* Canvas Render Element (High-DPI 480x520) */}
        <canvas
          ref={canvasRef}
          width={480}
          height={520}
          className="w-[280px] h-[305px] sm:w-[350px] sm:h-[380px] md:w-[400px] md:h-[435px] transition-transform duration-300 group-hover:scale-[1.02]"
        />

        {/* State Pill Floating Overlay */}
        <div className="absolute bottom-2 inset-x-0 flex flex-col items-center justify-center pointer-events-none">
          <div
            className={`px-3.5 py-1 rounded-full border backdrop-blur-md shadow-lg flex items-center gap-2 transition-all duration-300 ${badge.color}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dot}`} />
            <span className="text-[11px] sm:text-xs font-medium tracking-wide">
              {badge.label}
            </span>
          </div>

          {/* Quick interactive hint when speaking */}
          {isSpeaking && (
            <span className="mt-1.5 text-[10px] text-slate-400 bg-slate-950/70 px-2 py-0.5 rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
              Tap anywhere or press Spacebar to cut in
            </span>
          )}

          {isQuietMode && (
            <span className="mt-1.5 text-[10px] text-amber-300 bg-slate-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/30 opacity-0 group-hover:opacity-100 transition-opacity">
              Tap to resume voice
            </span>
          )}
        </div>
      </div>

      {/* Companion Inner Thought Subtitle */}
      {emotion?.internalThought && (
        <div className="mt-1 max-w-sm px-4 text-center">
          <p className="text-xs italic text-slate-400 tracking-wide font-normal">
            &ldquo;{emotion.internalThought}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
};

// Web Audio utilities for PCM encoding/decoding, gapless scheduling, VAD, resampling, and procedural ambient sound

export function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return input;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(input.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const origIndex = i * ratio;
    const floorIndex = Math.floor(origIndex);
    const ceilIndex = Math.min(input.length - 1, floorIndex + 1);
    const frac = origIndex - floorIndex;
    result[i] = input[floorIndex] * (1 - frac) + input[ceilIndex] * frac;
  }
  return result;
}

export function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function pcm24kToAudioBuffer(
  ctx: AudioContext,
  pcmData: Uint8Array,
  targetSampleRate = 24000
): AudioBuffer {
  const samples = Math.floor(pcmData.length / 2);
  // Create buffer at target sample rate or context sample rate
  const bufferSampleRate = ctx.sampleRate || targetSampleRate;
  const audioBuffer = ctx.createBuffer(1, samples, targetSampleRate);
  const channelData = audioBuffer.getChannelData(0);
  const dataView = new DataView(
    pcmData.buffer,
    pcmData.byteOffset,
    pcmData.byteLength
  );

  for (let i = 0; i < samples; i++) {
    const int16 = dataView.getInt16(i * 2, true);
    channelData[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
  }

  return audioBuffer;
}

export function calculateRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

export class GaplessAudioPlayer {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private onSpeakingChange?: (isSpeaking: boolean) => void;
  private playbackRate: number = 1.0;

  constructor(onSpeakingChange?: (isSpeaking: boolean) => void) {
    this.onSpeakingChange = onSpeakingChange;
  }

  public init() {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      try {
        this.ctx = new AudioCtx({ sampleRate: 24000 });
      } catch (e) {
        // Fallback for devices that don't support custom sampleRate in constructor
        this.ctx = new AudioCtx();
      }
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);

      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.nextStartTime = this.ctx.currentTime;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.75, Math.min(1.5, rate));
  }

  public setVolume(vol: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime);
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public queuePCM(base64Data: string) {
    this.init();
    if (!this.ctx || !this.gainNode) return;

    try {
      const pcmBytes = base64ToArrayBuffer(base64Data);
      const audioBuffer = pcm24kToAudioBuffer(this.ctx, pcmBytes, 24000);

      const source = this.ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.setValueAtTime(this.playbackRate, this.ctx.currentTime);
      source.connect(this.gainNode);

      const currentTime = this.ctx.currentTime;
      const startTime = Math.max(currentTime + 0.02, this.nextStartTime);
      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration / this.playbackRate;

      this.activeSources.push(source);
      this.onSpeakingChange?.(true);

      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) {
          this.activeSources.splice(idx, 1);
        }
        if (this.activeSources.length === 0) {
          this.onSpeakingChange?.(false);
        }
      };
    } catch (e) {
      console.warn('Error queuing audio chunk:', e);
    }
  }

  public async queueAudioData(arrayBuffer: ArrayBuffer): Promise<void> {
    this.init();
    if (!this.ctx || !this.gainNode) return;

    try {
      // Clone buffer because decodeAudioData detaches the buffer in some browsers
      const cloned = arrayBuffer.slice(0);
      const audioBuffer = await this.ctx.decodeAudioData(cloned);
      const source = this.ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.setValueAtTime(this.playbackRate, this.ctx.currentTime);
      source.connect(this.gainNode);

      const currentTime = this.ctx.currentTime;
      const startTime = Math.max(currentTime + 0.02, this.nextStartTime);
      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration / this.playbackRate;

      this.activeSources.push(source);
      this.onSpeakingChange?.(true);

      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) {
          this.activeSources.splice(idx, 1);
        }
        if (this.activeSources.length === 0) {
          this.onSpeakingChange?.(false);
        }
      };
    } catch (e) {
      console.warn('Error decoding or queuing audio data:', e);
    }
  }

  public interrupt() {
    if (!this.ctx) return;
    try {
      if (this.gainNode) {
        this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.ctx.currentTime);
        this.gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.04);
      }

      setTimeout(() => {
        this.activeSources.forEach((src) => {
          try {
            src.stop();
            src.disconnect();
          } catch (e) {
            // ignore
          }
        });
        this.activeSources = [];
        if (this.ctx && this.gainNode) {
          this.nextStartTime = this.ctx.currentTime;
          this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
          this.gainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
        }
        this.onSpeakingChange?.(false);
      }, 50);
    } catch (e) {
      console.warn('Error during audio interrupt:', e);
    }
  }

  public isPlaying(): boolean {
    return this.activeSources.length > 0;
  }

  public destroy() {
    this.interrupt();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
  }
}

// Procedural Ambient Synthesizer
export class ProceduralAmbientSoundscape {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private noiseNode: AudioNode | null = null;
  private currentType: string = 'none';

  public start(type: string, volume: number = 0.25) {
    this.stop();
    if (type === 'none') return;
    this.currentType = type;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    try {
      this.ctx = new AudioCtx();
    } catch (e) {
      return;
    }
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(volume * 0.4, this.ctx.currentTime);
    this.gainNode.connect(this.ctx.destination);

    if (type === 'rain' || type === 'hearth' || type === 'breeze') {
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      if (type === 'rain') {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.ctx.currentTime);
        whiteNoise.connect(filter);
        filter.connect(this.gainNode);
      } else if (type === 'hearth') {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(320, this.ctx.currentTime);
        filter.Q.setValueAtTime(1.5, this.ctx.currentTime);
        whiteNoise.connect(filter);
        filter.connect(this.gainNode);
      } else {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, this.ctx.currentTime);
        whiteNoise.connect(filter);
        filter.connect(this.gainNode);
      }

      whiteNoise.start();
      this.noiseNode = whiteNoise;
    }
  }

  public setVolume(vol: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, vol * 0.4)), this.ctx.currentTime);
    }
  }

  public stop() {
    if (this.noiseNode) {
      try {
        (this.noiseNode as any).stop?.();
        this.noiseNode.disconnect();
      } catch (e) {
        // ignore
      }
      this.noiseNode = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch (e) {
        // ignore
      }
      this.ctx = null;
    }
    this.currentType = 'none';
  }
}

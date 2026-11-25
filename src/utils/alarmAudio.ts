import { AlarmToneId } from '../types/sleep';

export interface ToneMeta {
  id: AlarmToneId;
  name: string;
  description: string;
}

export const ALARM_TONES: ToneMeta[] = [
  {
    id: 'morning_chimes',
    name: 'Morning Chimes',
    description: 'Warm pentatonic bells that rise gently',
  },
  {
    id: 'dawn_pulse',
    name: 'Dawn Pulse',
    description: 'Soft harmonic chord swells',
  },
  {
    id: 'forest_dew',
    name: 'Forest Dew',
    description: 'Crystalline arpeggio notes',
  },
  {
    id: 'classic_radar',
    name: 'Classic Pulse',
    description: 'Crisp rhythmic tone for deep sleepers',
  },
];

class AlarmAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private loopTimer: number | null = null;
  private previewTimer: number | null = null;
  private isPlaying = false;
  private activeNodes: AudioNode[] = [];

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private scheduleNote(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    peakGain: number
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + Math.min(0.06, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);

    this.activeNodes.push(osc, gain);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Ignore already disconnected nodes
      }
    };
  }

  private playPatternOnce(ctx: AudioContext, dest: AudioNode, tone: AlarmToneId): number {
    const now = ctx.currentTime + 0.03;

    switch (tone) {
      case 'morning_chimes': {
        // C5, E5, G5, A5, C6 warm pentatonic chime
        const notes = [523.25, 659.25, 783.99, 880.0, 1046.5];
        notes.forEach((freq, i) => {
          this.scheduleNote(ctx, dest, freq, now + i * 0.28, 1.1, 'sine', 0.28);
          this.scheduleNote(ctx, dest, freq * 2, now + i * 0.28, 0.5, 'triangle', 0.05);
        });
        return 2800;
      }

      case 'dawn_pulse': {
        // Warm Fmaj7 pad chord swell
        const chord = [349.23, 440.0, 523.25, 659.25];
        chord.forEach((freq) => {
          this.scheduleNote(ctx, dest, freq, now, 2.2, 'sine', 0.16);
        });
        // Second slightly brighter triad
        const chord2 = [392.0, 493.88, 587.33, 783.99];
        chord2.forEach((freq) => {
          this.scheduleNote(ctx, dest, freq, now + 1.4, 2.0, 'sine', 0.14);
        });
        return 3600;
      }

      case 'forest_dew': {
        // High crystalline bell arpeggio
        const notes = [587.33, 880.0, 1174.66, 987.77, 1318.51, 880.0];
        notes.forEach((freq, i) => {
          this.scheduleNote(ctx, dest, freq, now + i * 0.22, 0.9, 'sine', 0.22);
        });
        return 2500;
      }

      case 'classic_radar': {
        // Crisp 4-beep classic digital pulse
        for (let i = 0; i < 4; i++) {
          this.scheduleNote(ctx, dest, 880, now + i * 0.18, 0.11, 'triangle', 0.34);
          this.scheduleNote(ctx, dest, 1320, now + i * 0.18, 0.09, 'sine', 0.14);
        }
        return 1400;
      }
    }
  }

  public startAlarm(tone: AlarmToneId, fadeInSeconds: number = 15): void {
    this.stop();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const master = ctx.createGain();
    const now = ctx.currentTime;
    const startVol = fadeInSeconds > 0 ? 0.06 : 0.85;
    master.gain.setValueAtTime(startVol, now);
    if (fadeInSeconds > 0) {
      master.gain.linearRampToValueAtTime(0.85, now + fadeInSeconds);
    }
    master.connect(ctx.destination);

    this.masterGain = master;
    this.isPlaying = true;

    const loop = () => {
      if (!this.isPlaying || !this.ctx || !this.masterGain) return;
      const intervalMs = this.playPatternOnce(this.ctx, this.masterGain, tone);
      this.loopTimer = window.setTimeout(loop, intervalMs);
    };
    loop();
  }

  public previewTone(tone: AlarmToneId): void {
    this.stop();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.65, ctx.currentTime);
    master.connect(ctx.destination);
    this.masterGain = master;
    this.isPlaying = true;

    const durationMs = this.playPatternOnce(ctx, master, tone);
    this.previewTimer = window.setTimeout(() => {
      this.stop();
    }, durationMs + 400);
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.loopTimer !== null) {
      window.clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.previewTimer !== null) {
      window.clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    this.activeNodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {
        // Ignore
      }
    });
    this.activeNodes = [];
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // Ignore
      }
      this.masterGain = null;
    }
  }
}

export const alarmAudio = new AlarmAudioEngine();

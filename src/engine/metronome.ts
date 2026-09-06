import { clamp } from "../lib/utils";
import { getAudioContext } from "./audio";

export type MetroSound = "classic" | "digital" | "metallic";
export type Subdivision = "none" | "eighth" | "triplet" | "sixteenth";
export type BeatWeight = 0 | 1 | 2; // silent / normal / accent

export interface MetronomeConfig {
  bpm: number;
  volume: number; // 0..1
  sound: MetroSound;
  subdivision: Subdivision;
  weights: BeatWeight[]; // per beat in the bar (length = beats per bar)
}

export const MIN_BPM = 20;
export const MAX_BPM = 400;

export const SUBDIVISIONS: Array<{ id: Subdivision; label: string; n: number }> = [
  { id: "none", label: "Semplice", n: 1 },
  { id: "eighth", label: "Ottavi", n: 2 },
  { id: "triplet", label: "Terzine", n: 3 },
  { id: "sixteenth", label: "Sedicesimi", n: 4 },
];

export function subdivisionsPerBeat(s: Subdivision): number {
  return SUBDIVISIONS.find((x) => x.id === s)?.n ?? 1;
}

export interface TickEvent {
  bar: number;
  beat: number; // 0-based beat index in bar
  sub: number; // subdivision index within the beat
  totalPulses: number; // pulses per bar
  pulseIndex: number; // global pulse index
  weight: BeatWeight;
  nextPulseSeconds: number;
}

export interface PatternInfo {
  beats: number;
  weights: BeatWeight[];
  subdivision: Subdivision;
  pulsesPerBar: number;
}

/**
 * Lookahead scheduler: a ~25 ms timer schedules clicks up to ~100 ms ahead of
 * time using the AudioContext clock, which keeps the click grid sample-accurate.
 */
export class MetronomeEngine {
  readonly kind: string;
  private cfg: MetronomeConfig;
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private nextPulse = 0;
  private stopScheduled = false;
  onTick: ((e: TickEvent) => void) | null = null;
  private _running = false;
  /** set by the UI layer so repeated taps can be debounced */
  startedAt = 0;

  constructor(kind: string, cfg: MetronomeConfig) {
    this.kind = kind;
    this.cfg = { ...cfg };
  }

  get running(): boolean {
    return this._running;
  }

  get bpm(): number {
    return this.cfg.bpm;
  }

  get config(): MetronomeConfig {
    return this.cfg;
  }

  setBpm(bpm: number): void {
    this.cfg.bpm = clamp(Math.round(bpm), MIN_BPM, MAX_BPM);
  }

  update(patch: Partial<MetronomeConfig>): void {
    if (patch.bpm !== undefined) this.setBpm(patch.bpm);
    if (patch.volume !== undefined) this.cfg.volume = clamp(patch.volume, 0, 1);
    if (patch.sound !== undefined) this.cfg.sound = patch.sound;
    if (patch.subdivision !== undefined) this.cfg.subdivision = patch.subdivision;
    if (patch.weights !== undefined && patch.weights.length > 0) {
      this.cfg.weights = patch.weights.map((w) => (w === 0 ? 0 : w === 2 ? 2 : 1));
    }
  }

  get weights(): BeatWeight[] {
    return this.cfg.weights;
  }

  get pulsesPerBar(): number {
    return this.cfg.weights.length * subdivisionsPerBeat(this.cfg.subdivision);
  }

  start(): boolean {
    const c = getAudioContext();
    if (!c) return false;
    this.ctx = c;
    void c.resume();
    if (c.state !== "running" && c.state !== "suspended") return false;
    if (this._running) return true;
    this._running = true;
    this.startedAt = performance.now();
    this.nextPulse = 0;
    // Small delay lets the audio context actually start before the first click.
    this.nextTime = c.currentTime + 0.12;
    this.stopScheduled = false;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
    return true;
  }

  /** Callback invoked when another metronome takes over / external stop. */
  onExternalStop: (() => void) | null = null;

  stop(): void {
    this._running = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Stop because another metronome started; notifies the owning UI. */
  forceStop(): void {
    const was = this._running;
    this.stop();
    if (was) this.onExternalStop?.();
  }

  /** Stop after scheduling the remainder of the current bar (ending feel). */
  stopAtBarEnd(): void {
    if (!this._running) return;
    this.stopScheduled = true;
    if (!this.timer) this._running = false;
  }

  private schedule(): void {
    if (!this._running || !this.ctx) return;
    const c = this.ctx;
    if (this.stopScheduled && this.nextPulse % this.pulsesPerBar === 0) {
      this.stop();
      return;
    }
    const horizon = c.currentTime + 0.12;
    while (this.nextTime < horizon) {
      if (this.stopScheduled && this.nextPulse % this.pulsesPerBar === 0) {
        this.stop();
        return;
      }
      const pulse = this.nextPulse;
      const perBar = this.pulsesPerBar;
      const per = subdivisionsPerBeat(this.cfg.subdivision);
      const beatIdx = Math.floor((pulse % perBar) / per);
      const subIdx = pulse % per;
      const weight: BeatWeight =
        subIdx === 0 ? this.cfg.weights[beatIdx] ?? 1 : 1;
      const bar = Math.floor(pulse / perBar);
      const secsPerPulse = 60 / this.cfg.bpm / per;
      this.playPulse(c, pulse, weight, bar, beatIdx, subIdx);
      this.onTick?.({
        bar,
        beat: beatIdx,
        sub: subIdx,
        totalPulses: perBar,
        pulseIndex: pulse,
        weight,
        nextPulseSeconds: secsPerPulse,
      });
      this.nextPulse++;
      this.nextTime += secsPerPulse;
    }
  }

  private playPulse(
    c: AudioContext,
    pulse: number,
    weight: BeatWeight,
    bar: number,
    beatIdx: number,
    subIdx: number
  ): void {
    if (weight === 0) return; // silent beat
    const when = this.nextTime;
    const isAccent = weight === 2;
    const isDownbeat = subIdx === 0;
    const per = subdivisionsPerBeat(this.cfg.subdivision);
    // Subdivision pulses that are not beat starts get a lighter, non-accent click.
    if (!isDownbeat) {
      this.click(c, when, "sub", this.cfg.volume * 0.55);
      return;
    }
    const accentedDownbeat = isAccent && beatIdx === 0;
    if (accentedDownbeat && per > 1) {
      this.click(c, when, "accent", this.cfg.volume);
    } else if (isAccent) {
      this.click(c, when, "accent", this.cfg.volume * 0.95);
    } else if (isDownbeat && beatIdx === 0) {
      this.click(c, when, "accent", this.cfg.volume * 0.8);
    } else {
      this.click(c, when, "beat", this.cfg.volume * 0.9);
    }
    void pulse;
    void bar;
  }

  /** Synthesize one click for the current sound preset. */
  private click(c: AudioContext, when: number, role: "beat" | "accent" | "sub", gain: number): void {
    const s = this.cfg.sound;
    const t0 = when;
    const master = c.createGain();
    master.gain.value = Math.max(0.001, gain * 0.9);
    master.connect(c.destination);

    const freqBase = role === "accent" ? (s === "digital" ? 1568 : 1900) : s === "digital" ? 1046 : 1400;
    const dur = s === "classic" ? 0.045 : 0.07;

    if (s === "classic" || s === "metallic") {
      // Woodblock / noise click
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, 2.4);
        const osc = Math.sin(2 * Math.PI * freqBase * t * (s === "classic" ? 1 : 0.5));
        const noise = Math.random() * 2 - 1;
        data[i] = (s === "classic" ? 0.65 * osc + 0.35 * noise : 0.3 * osc + 0.7 * noise) * env;
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(master);
      src.start(t0);
      if (role === "accent") {
        // resonance blip for accents
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.value = 2400;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
        o.connect(g).connect(master);
        o.start(t0);
        o.stop(t0 + 0.06);
      }
    } else {
      // Digital blip
      const o = c.createOscillator();
      o.type = "square";
      o.frequency.value = role === "sub" ? 660 : freqBase;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    }
  }
}

/** Only one metronome can sound at a time app-wide. Starting a new engine
 *  force-stops the previous one (its owner is notified via onExternalStop). */
let exclusive: MetronomeEngine | null = null;

export function acquireExclusive(e: MetronomeEngine): void {
  if (exclusive && exclusive !== e && exclusive.running) exclusive.forceStop();
  exclusive = e;
}

export function releaseExclusive(e: MetronomeEngine): void {
  if (exclusive === e) exclusive = null;
}

export function getActiveEngine(): MetronomeEngine | null {
  return exclusive;
}

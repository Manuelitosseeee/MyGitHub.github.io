import { noteFromFreq } from "../lib/music";
import { getAudioContext } from "./audio";
import type { DetectedNote } from "../lib/music";

/** Tuner result pushed to the UI (~30 Hz). */
export interface TunerReading {
  note: DetectedNote | null;
  level: number; // 0..1 signal level
  active: boolean;
}

const MIN_HZ = 38;
const MAX_HZ = 1500;

/**
 * Real microphone tuner for plucked guitar strings.
 *
 * Pipeline:
 *  1. getUserMedia -> AnalyserNode time-domain frames. AGC is left ON (some
 *     browsers otherwise keep the mic so quiet that soft plucks are missed)
 *     while echo cancellation / noise suppression are off.
 *  2. Adaptive noise floor: it drops instantly on quiet frames and creeps up
 *     only while NO note is locked, so both a silent room (very soft plucks
 *     still register) and a noisy one (hum/traffic doesn't trigger) work.
 *  3. Detection: normalized autocorrelation on 2× downsampled data. Every
 *     local maximum above a threshold is a pitch candidate and is refined
 *     with parabolic interpolation for sub-sample (sub-cent) precision.
 *  4. Locking: a pitch must be confirmed by 3 consecutive agreeing frames
 *     before it is shown; while a string rings out the note is held; a
 *     different pitch can only take over after the same confirmation. This
 *     kills the octave-jumping and the "blinks for half a second then
 *     disappears" behaviour.
 */
export class TunerEngine {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private raf = 0;
  private running = false;
  onReading: ((r: TunerReading) => void) | null = null;
  private err: string | null = null;

  private buf = new Float32Array(0);
  private half = new Float32Array(0);
  private corrBuf = new Float32Array(0);
  private lastDetect = 0;

  // Adaptive background level (RMS). Frames above ~3× this are treated as a
  // signal of interest.
  private noiseFloor = 0.004;
  // Pitch (Hz) currently displayed; kept while the string rings out.
  private lockedFreq = 0;
  private holdUntil = 0;
  // Pitch candidate waiting for consecutive confirmations before it may steal
  // the display from the locked pitch.
  private candFreq = 0;
  private candStreak = 0;

  get error(): string | null {
    return this.err;
  }

  get isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    if (this.running) return;
    const ctx = getAudioContext();
    if (!ctx) {
      this.err = "Audio non supportato su questo dispositivo.";
      return;
    }
    this.ctx = ctx;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          // Keep the automatic gain: with AGC disabled many phones send such
          // a quiet signal that plucked strings are never detected.
          autoGainControl: true,
        },
      });
      this.stream = stream;
      this.source = ctx.createMediaStreamSource(stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0;
      this.source.connect(this.analyser);
      if (ctx.state !== "running") await ctx.resume();
      this.err = null;
      this.running = true;
      this.buf = new Float32Array(this.analyser.fftSize);
      this.resetState();
      const loop = () => {
        if (!this.running) return;
        this.pull();
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      this.err =
        name === "NotAllowedError"
          ? "Accesso al microfono negato. Consenti il microfono nelle impostazioni di iOS."
          : name === "NotFoundError"
            ? "Nessun microfono trovato sul dispositivo."
            : "Impossibile avviare il microfono. Verifica i permessi.";
      this.running = false;
    }
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.source?.disconnect();
    this.source = null;
    this.analyser = null;
    this.resetState();
    this.onReading?.({ note: null, level: 0, active: false });
  }

  private resetState(): void {
    this.noiseFloor = 0.004;
    this.lockedFreq = 0;
    this.holdUntil = 0;
    this.candFreq = 0;
    this.candStreak = 0;
    this.lastDetect = 0;
  }

  private emit(note: DetectedNote | null, level: number, active: boolean): void {
    this.onReading?.({ note, level, active });
  }

  private updateNoiseFloor(rms: number): void {
    // Never chase a ringing string: only adapt while nothing is locked.
    if (this.lockedFreq > 0 && performance.now() < this.holdUntil) return;
    if (rms < this.noiseFloor) {
      this.noiseFloor = rms;
    } else {
      this.noiseFloor += (rms - this.noiseFloor) * 0.03;
    }
    if (this.noiseFloor < 0.0015) this.noiseFloor = 0.0015;
    if (this.noiseFloor > 0.05) this.noiseFloor = 0.05;
  }

  private pull(): void {
    if (!this.analyser) return;
    const an = this.analyser;
    const now = performance.now();
    if (now - this.lastDetect < 33) return; // ~30 Hz analysis is plenty
    this.lastDetect = now;

    an.getFloatTimeDomainData(this.buf);
    const data = this.buf;
    const n = data.length;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / n);
    const level = Math.min(1, rms * 16);
    this.updateNoiseFloor(rms);

    // A pluck is "present" only when clearly above the adaptive floor.
    const present = rms >= 0.0025 && rms >= this.noiseFloor * 3.2;

    if (!present) {
      // Silent (or below floor): keep the held note, otherwise go idle.
      this.candFreq = 0;
      this.candStreak = 0;
      if (this.lockedFreq > 0 && now < this.holdUntil) {
        this.emit(noteFromFreq(this.lockedFreq), level, true);
        return;
      }
      this.lockedFreq = 0;
      this.emit(null, level, false);
      return;
    }

    const det = this.detect();
    const freq = det.freq;
    const plausible =
      freq >= MIN_HZ && freq <= MAX_HZ && det.clarity >= 0.45;

    if (!plausible) {
      // Loud but not periodic (talk, scrape, noise): keep the held note if
      // any, otherwise stay idle. Do NOT adapt the floor here (done above).
      this.candFreq = 0;
      this.candStreak = 0;
      if (this.lockedFreq > 0 && now < this.holdUntil) {
        this.emit(noteFromFreq(this.lockedFreq), level, true);
        return;
      }
      this.lockedFreq = 0;
      this.emit(null, level, false);
      return;
    }

    // Same note as the locked one (tolerance ≈ ±50 cent while tuning): keep
    // it and refine the frequency with a log-domain EMA.
    if (
      this.lockedFreq > 0 &&
      Math.abs(Math.log(freq / this.lockedFreq)) < 0.03
    ) {
      this.lockedFreq = Math.exp(
        Math.log(this.lockedFreq) * 0.72 + Math.log(freq) * 0.28
      );
      this.holdUntil = now + 2200;
      this.emit(noteFromFreq(this.lockedFreq), level, true);
      return;
    }

    // A different pitch: requires 3 agreeing frames (~60 ms) to take over.
    if (
      this.candFreq > 0 &&
      Math.abs(Math.log(freq / this.candFreq)) < 0.018
    ) {
      this.candFreq = Math.exp(
        Math.log(this.candFreq) * 0.6 + Math.log(freq) * 0.4
      );
      this.candStreak++;
      if (this.candStreak >= 3) {
        this.lockedFreq = this.candFreq;
        this.holdUntil = now + 2200;
        this.candFreq = 0;
        this.candStreak = 0;
        this.emit(noteFromFreq(this.lockedFreq), level, true);
        return;
      }
    } else {
      this.candFreq = freq;
      this.candStreak = 1;
    }

    // Candidate not yet confirmed: keep whatever is still ringing out.
    if (this.lockedFreq > 0 && now < this.holdUntil) {
      this.emit(noteFromFreq(this.lockedFreq), level, true);
    } else {
      this.lockedFreq = 0;
      this.emit(null, level, false);
    }
  }

  /**
   * Autocorrelation pitch detection. Returns the frequency of the best peak
   * with a clarity measure in 0..1. Uses the locked/candidate pitch as
   * context when available (continuity beats ambiguity), otherwise prefers the
   * strongest short period, which for a plucked string is the fundamental.
   */
  private detect(): { freq: number; clarity: number } {
    const data = this.buf;
    const n = data.length;
    const N = n >> 1;
    if (this.half.length !== N) this.half = new Float32Array(N);
    const a = this.half;
    for (let i = 0; i < N; i++) a[i] = data[i * 2];
    const sr = (this.ctx?.sampleRate ?? 44100) / 2;

    const minLag = Math.max(4, Math.floor(sr / MAX_HZ));
    const maxLag = Math.min(N - 4, Math.ceil(sr / MIN_HZ));
    if (maxLag - minLag < 4) return { freq: 0, clarity: 0 };

    let energy = 0;
    for (let i = 0; i < N; i++) energy += a[i] * a[i];
    if (energy < 1e-6) return { freq: 0, clarity: 0 };

    if (this.corrBuf.length < maxLag + 2) {
      this.corrBuf = new Float32Array(maxLag + 2);
    }
    const corr = this.corrBuf;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let c = 0;
      for (let i = 0; i < N - lag; i++) c += a[i] * a[i + lag];
      corr[lag] = c / energy;
    }

    // Local maxima above a modest threshold = candidate periods.
    let bestVal = 0;
    const peakLags: number[] = [];
    const peakVals: number[] = [];
    for (let lag = minLag; lag < maxLag; lag++) {
      const v = corr[lag];
      if (v >= 0.55 && v >= corr[lag - 1] && v >= corr[lag + 1]) {
        peakLags.push(lag);
        peakVals.push(v);
        if (v > bestVal) bestVal = v;
      }
    }
    if (peakLags.length === 0) {
      // Fallback: flat-ish or weak signal, take the global maximum.
      let best = 0.28;
      let bi = -1;
      for (let lag = minLag; lag <= maxLag; lag++) {
        if (corr[lag] > best) {
          best = corr[lag];
          bi = lag;
        }
      }
      if (bi < 0) return { freq: 0, clarity: 0 };
      return {
        freq: sr / bi,
        clarity: Math.min(1, Math.max(0, (best - 0.3) / 0.6)),
      };
    }

    // Keep only peaks essentially as strong as the best one (within 1.5%).
    const threshold = bestVal - 0.015;
    let chosenLag = -1;
    let chosenVal = -1;

    // 1) Continuity: nearest candidate to the locked / pending pitch.
    const context =
      this.lockedFreq > 0 && performance.now() < this.holdUntil
        ? this.lockedFreq
        : this.candFreq > 0
          ? this.candFreq
          : 0;
    if (context > 0) {
      let bestDiff = 0.1;
      for (let i = 0; i < peakLags.length; i++) {
        const f = sr / peakLags[i];
        const diff = Math.abs(Math.log(f / context));
        if (diff < bestDiff) {
          bestDiff = diff;
          chosenLag = peakLags[i];
          chosenVal = peakVals[i];
        }
      }
    }
    // 2) Otherwise pick the shortest strong period (the fundamental).
    if (chosenLag < 0) {
      for (let i = 0; i < peakLags.length; i++) {
        if (
          peakVals[i] >= threshold &&
          (chosenLag < 0 || peakLags[i] < chosenLag)
        ) {
          chosenLag = peakLags[i];
          chosenVal = peakVals[i];
        }
      }
    }
    if (chosenLag < 0) {
      chosenLag = peakLags[0];
      chosenVal = peakVals[0];
    }

    // Parabolic interpolation around the chosen peak for sub-sample precision.
    const y0 = chosenLag > 0 ? corr[chosenLag - 1] : chosenVal;
    const y2 =
      chosenLag + 1 < corr.length ? corr[chosenLag + 1] : chosenVal;
    const den = y0 - 2 * chosenVal + y2;
    let shift = 0;
    if (Math.abs(den) > 1e-9) shift = (0.5 * (y0 - y2)) / den;
    if (shift > 1 || shift < -1) shift = 0;
    const refinedLag = chosenLag + shift;

    const clarity = Math.min(1, Math.max(0, (chosenVal - 0.35) / 0.55));
    return { freq: sr / refinedLag, clarity };
  }
}

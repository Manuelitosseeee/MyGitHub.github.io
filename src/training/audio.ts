/** Sintesi audio locale per gli strumenti di Allenamento.
 *
 *  Usa il Web Audio API del browser e l'AudioContext condiviso dell'app: nessun
 *  campione esterno, nessun servizio, nessuna chiave API. Il timbro è un
 *  pianoforte/chitarra morbido, pensato per l'orecchio e la lettura. */

import { getAudioContext, ensureRunning } from "../engine/audio";
import { midiToFreq } from "../lib/music";

export interface NoteOptions {
  /** Durata in secondi (decrescendo). */
  duration?: number;
  /** Ritardo prima dell'attacco, in secondi. */
  delay?: number;
  gain?: number;
  /** Timbro: più "chitarra" per gli accordi, più "piano" per le scale. */
  voice?: "piano" | "guitar" | "bell";
}

const MASTER: { node: GainNode | null } = { node: null };

/** Bus di uscita condiviso: un solo punto per volume e limitatore. */
function master(): GainNode | null {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (!MASTER.node) {
    const g = ctx.createGain();
    g.gain.value = 0.9;
    // Un compressore morbido evita clip quando suonano molti accordi insieme.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    g.connect(comp);
    comp.connect(ctx.destination);
    MASTER.node = g;
  }
  return MASTER.node;
}

/** Volume generale degli strumenti di allenamento (0..1). */
let masterVolume = 0.8;

export function setTrainingVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v));
  const node = master();
  if (node && getAudioContext()) {
    node.gain.setTargetAtTime(masterVolume, getAudioContext()!.currentTime, 0.02);
  }
}

export function getTrainingVolume(): number {
  return masterVolume;
}

/** Suona una singola nota. Restituisce la fine (in secondi ctx) dell'evento. */
export function playNote(midi: number, opts: NoteOptions = {}): number {
  const ctx = getAudioContext();
  const out = master();
  if (!ctx || !out) return 0;
  const { duration = 0.9, delay = 0, gain = 0.5, voice = "piano" } = opts;
  const t0 = ctx.currentTime + delay;
  const freq = midiToFreq(midi);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(gain * 0.4, t0 + Math.min(0.2, duration * 0.35));
  env.gain.setTargetAtTime(0.0001, t0 + Math.max(0.1, duration * 0.7), 0.08);

  // Per il pianoforte: filtro più aperto e morbido, senza esagerare col lowpass.
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.5;
  if (voice === "bell") {
    filter.frequency.value = 5200;
  } else if (voice === "guitar") {
    filter.frequency.value = 3400;
  } else {
    // piano: più brillante all'attacco, poi si chiude dolcemente
    filter.frequency.setValueAtTime(4200, t0);
    filter.frequency.exponentialRampToValueAtTime(900, t0 + duration);
  }

  env.connect(filter);
  filter.connect(out);

  // Oscillatore principale: piano usa triangle con più corpi, chitarra usa sawtooth.
  const main = ctx.createOscillator();
  main.type = voice === "guitar" ? "sawtooth" : "triangle";
  main.frequency.value = freq;
  const mainGain = ctx.createGain();
  mainGain.gain.value = voice === "guitar" ? 0.38 : 0.55;
  main.connect(mainGain);
  mainGain.connect(env);

  // Parziali: il pianoforte ha armoniche più ricche nei primi tempi.
  const partials: Array<[number, number, OscillatorType]> =
    voice === "bell"
      ? [
          [2, 0.18, "sine"],
          [3.01, 0.07, "sine"],
        ]
      : voice === "guitar"
        ? [
            [2, 0.14, "sawtooth"],
            [3, 0.05, "sine"],
          ]
        : [
            [2, 0.18, "triangle"],
            [3, 0.10, "sine"],
            [4.01, 0.04, "sine"],
          ];
  for (const [mult, amount, type] of partials) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq * mult;
    const g = ctx.createGain();
    // I parziali più alti decadono prima, come nel pianoforte reale.
    g.gain.setValueAtTime(amount, t0);
    if (mult > 2.5) {
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration * 0.6);
    }
    o.connect(g);
    g.connect(env);
    o.start(t0);
    o.stop(t0 + duration + 0.05);
  }

  main.start(t0);
  main.stop(t0 + duration + 0.05);
  return t0 + duration;
}

/** Suona più note insieme (accordo). */
export function playChord(midis: number[], opts: NoteOptions = {}): number {
  if (midis.length === 0) return 0;
  const spread = opts.voice === "guitar" ? 0.012 : 0.006;
  let end = 0;
  midis.forEach((m, i) => {
    end = Math.max(end, playNote(m, { ...opts, delay: (opts.delay ?? 0) + i * spread }));
  });
  return end;
}

/** Suona un accordo in ordine arpeggiato, nota per nota. */
export function playArpeggio(
  midis: number[],
  step: number,
  opts: NoteOptions = {}
): number {
  let end = 0;
  midis.forEach((m, i) => {
    end = Math.max(
      end,
      playNote(m, { ...opts, delay: (opts.delay ?? 0) + i * step, duration: opts.duration ?? step * 1.4 })
    );
  });
  return end;
}

export interface SequencerHandle {
  stop: () => void;
  /** Numero di note già avviate. */
  readonly started: number;
  readonly total: number;
}

/**
 * Suona una sequenza di note a tempo costante, sincronizzata con
 * l'AudioContext. La sequenza può essere interrotta in qualsiasi momento.
 */
export function playSequence(
  midis: number[],
  secondsPerNote: number,
  opts: NoteOptions & { loop?: boolean; onNote?: (index: number) => void } = {}
): SequencerHandle {
  const ctx = getAudioContext();
  void ctx;
  const noteDur = Math.min(opts.duration ?? 0.55, secondsPerNote * 0.95);
  let stopped = false;
  let started = 0;
  let timer: number | null = null;

  const stepOnce = (base: number, offset = 0) => {
    midis.forEach((m, i) => {
      playNote(m, {
        ...opts,
        delay: base + i * secondsPerNote,
        duration: noteDur,
      });
      started++;
    });
    opts.onNote?.(offset + midis.length - 1);
  };

  const total = midis.length;
  if (total === 0) {
    return { stop: () => undefined, get started() { return 0; }, get total() { return 0; } };
  }

  // Piano temporale: si programmano gli eventi sul clock dell'AudioContext.
  const stepMs = secondsPerNote * 1000;
  const cycleMs = stepMs * total;
  const startAt = performance.now();
  let scheduled = 0;

  const tick = () => {
    if (stopped) return;
    const elapsed = performance.now() - startAt;
    // Programma in anticipo i prossimi 3 cicli sul clock audio.
    while (scheduled < elapsed + 250) {
      const cycleIndex = Math.floor(scheduled / cycleMs);
      const inCycle = (scheduled % cycleMs) / 1000;
      stepOnce(inCycle, cycleIndex * total);
      scheduled += cycleMs;
      if (!opts.loop) break;
    }
    timer = window.setTimeout(tick, 60);
  };
  tick();

  return {
    stop: () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    },
    get started() {
      return started;
    },
    get total() {
      return total;
    },
  };
}

/** Intervallo melodico: due note una dopo l'altra. */
export function playInterval(
  rootMidi: number,
  semitones: number,
  melodic: boolean,
  opts: NoteOptions = {}
): number {
  const second = rootMidi + semitones;
  if (melodic) {
    const gap = opts.duration ?? 0.5;
    playNote(rootMidi, { ...opts, delay: opts.delay ?? 0, duration: gap });
    return playNote(second, {
      ...opts,
      delay: (opts.delay ?? 0) + gap,
      duration: opts.duration ?? 0.9,
    });
  }
  return playChord([rootMidi, second], { ...opts, duration: opts.duration ?? 1.1 });
}

/** Deve essere chiamato da un gesto utente: risveglia l'AudioContext. */
export async function unlockAudio(): Promise<boolean> {
  return ensureRunning();
}

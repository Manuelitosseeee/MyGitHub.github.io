/** Generatore di domande per Allena l'Orecchio.
 *
 *  Tre modalità: intervalli, accordi e progressioni. Le scelte dell'utente
 *  (quali intervalli, quali tipologie di accordo, maggiore o minore) sono
 *  sempre rispettate: il generatore sceglie solo dentro l'insieme ammesso e
 *  aumenta la difficoltà introducendo inversioni e progressioni più lunghe. */

import {
  CHORDS,
  INTERVALS,
  chordName,
  chordNameIT,
  intervalBySemitones,
  noteName,
  type ChordQuality,
} from "./theory";

export type EarKind = "intervalli" | "accordi" | "progressioni";

export interface IntervalQuestion {
  kind: "intervalli";
  /** Nota di partenza. */
  rootMidi: number;
  /** Distanza in semitoni (positiva = ascendente). */
  semitones: number;
  /** Come suonare: una dopo l'altra o insieme. */
  melodic: boolean;
  direction: "su" | "giu";
  /** Risposta corretta (etichetta breve, es. "M3"). */
  expected: string;
  /** Etichetta estesa per il feedback. */
  expectedLong: string;
  /** Alternative offerte, sempre dello stesso tipo. */
  options: string[];
  /** Nota da usare come riferimento tonale (solo progressioni). */
  detail: string;
}

export interface ChordQuestion {
  kind: "accordi";
  /** Note da suonare. */
  notes: number[];
  /** Accordo in posizione fondamentale (1° rivolto). */
  rootPc: number;
  quality: ChordQuality;
  /** inversione: 0 = fondamentale, 1 = prima, 2 = seconda. */
  inversion: number;
  expected: string;
  expectedLong: string;
  options: string[];
  detail: string;
}

export interface ProgressionQuestion {
  kind: "progressioni";
  keyPc: number;
  minor: boolean;
  /** Gradi romani. */
  degrees: string[];
  /** Note di ogni grado (accordo arpeggiato, tonica iniziale per il riferimento). */
  notes: number[][];
  length: number;
  /** Tonica suonata prima della progressione (livelli iniziali). */
  playsTonic: boolean;
  expected: string;
  expectedLong: string;
  options: string[];
  detail: string;
}

export type EarQuestion = IntervalQuestion | ChordQuestion | ProgressionQuestion;

/* ---------------- Utilità ---------------- */

function rngFrom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const pickFrom = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Nota nel campo medio (Do3 = 48) per non uscire dal timbro. */
function midNote(rng: () => number): number {
  return 48 + Math.floor(rng() * 15);
}

/** Genera alternative plausibili, includendo sempre quella corretta. */
function optionsFor(
  rng: () => number,
  correct: string,
  pool: string[],
  size: number
): string[] {
  const wrong = pool.filter((p) => p !== correct);
  const picked = shuffle(rng, wrong).slice(0, Math.max(0, size - 1));
  return shuffle(rng, [correct, ...picked]);
}

/* ---------------- Intervalli ---------------- */

export interface IntervalSettings {
  /** Semitoni ammessi. */
  semitones: number[];
  melodic: boolean;
  direction: "su" | "giu" | "entrambi";
  /** 0 facile, 1 medio, 2 difficile. */
  level: 0 | 1 | 2;
}

export function makeIntervalQuestion(
  s: IntervalSettings,
  seed: number
): IntervalQuestion {
  const rng = rngFrom(seed);
  const semis = s.semitones.length ? s.semitones : [4, 7];
  const semi = pickFrom(rng, semis);
  const interval = intervalBySemitones(semi);
  const dir: "su" | "giu" =
    s.direction === "entrambi" ? (rng() > 0.5 ? "su" : "giu") : s.direction;
  // Al livello difficile la nota bassa è un semitone sopra la nota acuta.
  const rootMidi = dir === "su" ? midNote(rng) : midNote(rng) + semi;
  // Le risposte sono i nomi per esteso: "Quarta giusta", non "P4".
  const pool = INTERVALS.map((i) => i.label);
  return {
    kind: "intervalli",
    rootMidi,
    semitones: semi,
    melodic: s.melodic,
    direction: dir,
    expected: interval.label,
    expectedLong: `${interval.label} · ${noteName(rootMidi % 12)} → ${noteName((rootMidi + semi) % 12)}`,
    options: optionsFor(rng, interval.label, pool, s.level === 0 ? 4 : s.level === 1 ? 5 : 6),
    detail: `${noteName(rootMidi % 12)} → ${noteName((rootMidi + semi) % 12)}`,
  };
}

/* ---------------- Accordi ---------------- */

export interface ChordSettings {
  /** Tipologie ammesse. */
  qualities: ChordQuality[];
  /** 0 = solo fondamentale, 1 = anche prime inversioni, 2 = anche seconde. */
  level: 0 | 1 | 2;
}

export function makeChordQuestion(s: ChordSettings, seed: number): ChordQuestion {
  const rng = rngFrom(seed);
  const pool = s.qualities.length ? s.qualities : (["maj", "min"] as ChordQuality[]);
  const quality = pickFrom(rng, pool);
  const rootPc = Math.floor(rng() * 12);
  const steps = CHORDS[quality].steps;
  const maxInv = s.level === 0 ? 0 : s.level === 1 ? 1 : 2;
  const inversion = Math.floor(rng() * (maxInv + 1));
  // Note: bassa = primo elemento del rivolto, salgono di un grado.
  const notes = steps.map((st, i) => 48 + ((rootPc + st) % 12) + (i + inversion) * 0);
  const reordered = notes.slice(inversion).concat(notes.slice(0, inversion));
  const label = CHORDS[quality].label;
  const inversionLabel =
    inversion === 0 ? "" : inversion === 1 ? " (1° rivolto)" : " (2° rivolto)";
  const allLabels = Object.values(CHORDS).map((c) => c.label);
  return {
    kind: "accordi",
    notes: reordered,
    rootPc,
    quality,
    inversion,
    expected: label,
    expectedLong: `${chordNameIT(rootPc, quality)}${inversionLabel} · ${chordName(rootPc, quality)}`,
    options: optionsFor(rng, label, allLabels, s.level === 0 ? 4 : 5),
    detail: `tonica ${noteName(rootPc)}`,
  };
}

/* ---------------- Progressioni ---------------- */

export interface ProgressionSettings {
  minor: boolean;
  /** 0 = 3 gradi, 1 = 4, 2 = 5 o più. */
  level: 0 | 1 | 2;
  /** Suona la tonica come riferimento prima della progressione. */
  playsTonic: boolean;
}

const MAJ_III: string[][] = [
  ["I", "IV", "V"],
  ["I", "V", "vi"],
  ["I", "vi", "IV", "V"],
  ["I", "iii", "IV", "V"],
  ["vi", "IV", "I", "V"],
  ["I", "V", "vi", "IV"],
  ["ii", "V", "I", "vi"],
];

const MIN_III: string[][] = [
  ["i", "iv", "v"],
  ["i", "VI", "III"],
  ["i", "iv", "VI", "v"],
  ["i", "v", "VI", "IV"],
  ["i", "VI", "III", "VII"],
  ["i", "iv", "v", "i"],
  ["VI", "iv", "i", "v"],
];

/** Gradi romani riconosciuti, per validare le risposte libere. */
export const MAJ_ROMAN = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
export const MIN_ROMAN = ["i", "ii°", "III", "iv", "v", "VI", "VII"];

/** Triadi diatoniche: grado → semitoni dalla tonica, terza e quinta. */
const MAJ_TRIADS: Record<string, [number, number, number]> = {
  I: [0, 4, 7],
  ii: [2, 3, 7],
  iii: [4, 3, 7],
  IV: [5, 4, 7],
  V: [7, 4, 7],
  vi: [9, 3, 7],
  "vii°": [11, 3, 6],
};

const MIN_TRIADS: Record<string, [number, number, number]> = {
  i: [0, 3, 7],
  "ii°": [2, 3, 6],
  III: [3, 4, 7],
  iv: [5, 3, 7],
  v: [7, 3, 7],
  VI: [8, 4, 7],
  VII: [10, 4, 7],
};

/** Semitoni, terza e quinta del grado nella tonalità indicata. */
function triadOf(roman: string, minor: boolean): [number, number, number] {
  const table = minor ? MIN_TRIADS : MAJ_TRIADS;
  return table[roman] ?? [0, minor ? 3 : 4, 7];
}

export function makeProgressionQuestion(
  s: ProgressionSettings,
  seed: number
): ProgressionQuestion {
  const rng = rngFrom(seed);
  const bank = s.minor ? MIN_III : MAJ_III;
  // Al livello difficile si scelgono progressioni più lunghe.
  const eligible = bank.filter((p) => (s.level === 2 ? p.length >= 4 : true));
  const degrees = pickFrom(rng, eligible.length ? eligible : bank).slice();
  const keyPc = Math.floor(rng() * 12);
  const notes = degrees.map((d) => {
    const [semi, third, fifth] = triadOf(d, s.minor);
    const root = 48 + ((keyPc + semi) % 12);
    return [root, root + third, root + fifth];
  });
  const expected = degrees.join(" - ");
  const allOptions = bank.map((p) => p.join(" - "));
  return {
    kind: "progressioni",
    keyPc,
    minor: s.minor,
    degrees,
    notes,
    length: degrees.length,
    playsTonic: s.playsTonic,
    expected,
    expectedLong: `${expected} in ${noteName(keyPc)} ${s.minor ? "minore" : "maggiore"}`,
    options: optionsFor(rng, expected, allOptions, s.level === 0 ? 3 : 4),
    detail: `${noteName(keyPc)} ${s.minor ? "minore" : "maggiore"}`,
  };
}



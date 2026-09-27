/** Teoria musicale condivisa da tutti gli strumenti di Allenamento.
 *  Tutto è calcolato in semitoni: 0 = Do, 9 = La. Nessuna dipendenza esterna. */

/* ---------------- Tonalità ---------------- */

export const PITCH_COUNT = 12;

/** Etichette italiane delle 12 note (C = 0). */
export const NOTE_IT = [
  "Do",
  "Do♯",
  "Re",
  "Re♯",
  "Mi",
  "Fa",
  "Fa♯",
  "Sol",
  "Sol♯",
  "La",
  "La♯",
  "Si",
] as const;

/** Nomi per VexFlow (accidentali sharp,Armatura 0..7). */
export const VEX_KEYS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export const TONIC_NAMES = NOTE_IT;

export function noteName(pc: number): string {
  return NOTE_IT[((pc % 12) + 12) % 12];
}

/** Tonalità leggibile: "Mi♭" non serve: usiamo solo ♯. */
export function keyName(pc: number, minor = false): string {
  return `${noteName(pc)} ${minor ? "minore" : "maggiore"}`;
}

/** Armatura: -6..6 sharps. -3 = 3 flats, +2 = 2 sharps. */
export function keySignature(pc: number, minor = false): number {
  const major: Record<number, number> = {
    0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1,
  };
  const s = major[((pc % 12) + 12) % 12];
  return minor ? s + 3 : s;
}

/** Nome della tonalità maggiore usato da VexFlow per l'armatura.
 *  VexFlow accetta nomi tipo "C", "F#", "Eb", "Bb" (non "C#2"). */
const VEX_MAJOR_KEY = [
  "C", // Do
  "Db", // Do♯ / Re♭
  "D", // Re
  "Eb", // Re♯ / Mi♭
  "E", // Mi
  "F", // Fa
  "F#", // Fa♯
  "G", // Sol
  "Ab", // Sol♯
  "A", // La
  "Bb", // La♯
  "B", // Si
] as const;

/** Tasto VexFlow (`stave.addKeySignature`) per una tonalità. */
export function vexKeyName(pc: number): string {
  return VEX_MAJOR_KEY[((pc % 12) + 12) % 12];
}

/* ---------------- Scale ---------------- */

export type ScaleId =
  | "major"
  | "minorNat"
  | "minorHarm"
  | "minorMel"
  | "pentMaj"
  | "pentMin"
  | "blues"
  | "ionian"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "aeolian"
  | "locrian";

export interface ScaleDef {
  id: ScaleId;
  label: string;
  short: string;
  /** Intervalli in semitoni dalla tonica. */
  steps: number[];
  /** Numero di note per ottava (scala: 7 o 6, alterate: 7). */
  size: number;
  family: "major" | "minor" | "pentatonic" | "blues" | "mode";
}

export const SCALES: ScaleDef[] = [
  { id: "major", label: "Maggiore", short: "Maggiore", steps: [0, 2, 4, 5, 7, 9, 11], size: 7, family: "major" },
  { id: "minorNat", label: "Minore naturale", short: "Min. naturale", steps: [0, 2, 3, 5, 7, 8, 10], size: 7, family: "minor" },
  { id: "minorHarm", label: "Minore armonica", short: "Min. armonica", steps: [0, 2, 3, 5, 7, 8, 11], size: 7, family: "minor" },
  { id: "minorMel", label: "Minore melodica", short: "Min. melodica", steps: [0, 2, 3, 5, 7, 9, 11], size: 7, family: "minor" },
  { id: "pentMaj", label: "Pentatonica maggiore", short: "Pent. maggiore", steps: [0, 2, 4, 7, 9], size: 5, family: "pentatonic" },
  { id: "pentMin", label: "Pentatonica minore", short: "Pent. minore", steps: [0, 3, 5, 7, 10], size: 5, family: "pentatonic" },
  { id: "blues", label: "Blues", short: "Blues", steps: [0, 3, 5, 6, 7, 10], size: 6, family: "blues" },
  { id: "ionian", label: "Modo ionico", short: "Ionico", steps: [0, 2, 4, 5, 7, 9, 11], size: 7, family: "mode" },
  { id: "dorian", label: "Modo dorico", short: "Dorico", steps: [0, 2, 3, 5, 7, 9, 10], size: 7, family: "mode" },
  { id: "phrygian", label: "Modo frigio", short: "Frigio", steps: [0, 1, 3, 5, 7, 8, 10], size: 7, family: "mode" },
  { id: "lydian", label: "Modo lidio", short: "Lidio", steps: [0, 2, 4, 6, 7, 9, 11], size: 7, family: "mode" },
  { id: "mixolydian", label: "Modo mixolidio", short: "Mixolidio", steps: [0, 2, 4, 5, 7, 9, 10], size: 7, family: "mode" },
  { id: "aeolian", label: "Modo eolio", short: "Eolio", steps: [0, 2, 3, 5, 7, 8, 10], size: 7, family: "mode" },
  { id: "locrian", label: "Modo locrio", short: "Locrio", steps: [0, 1, 3, 5, 6, 8, 10], size: 7, family: "mode" },
];

export const SCALE_BY_ID: Record<ScaleId, ScaleDef> = SCALES.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<ScaleId, ScaleDef>
);

/** Nota MIDI della tonica all'ottava richiesta. octave 4 → 60 = Do4. */
export function tonicMidi(pc: number, octave: number): number {
  return (octave + 1) * 12 + ((pc % 12) + 12) % 12;
}

/** Note della scala su un'ottava, dalla tonica inclusa. */
export function scaleOctave(rootMidi: number, steps: number[]): number[] {
  return steps.map((s) => rootMidi + s);
}

/** Due ottave di scala (tonica compresa) a partire dalla tonica. */
export function scaleTwoOctaves(rootMidi: number, steps: number[]): number[] {
  return [...scaleOctave(rootMidi, steps), ...scaleOctave(rootMidi + 12, steps)];
}

/** Il grado (indice nella scala) più vicino a `midi`, a partire da `root`. */
export function nearestDegree(midi: number, root: number, steps: number[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < steps.length; i++) {
    for (const oct of [-24, -12, 0, 12, 24]) {
      const d = Math.abs(midi - (root + steps[i] + oct));
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
  }
  return best;
}

/* ---------------- Accordi ---------------- */

export type ChordQuality =
  | "maj"
  | "min"
  | "dim"
  | "aug"
  | "maj7"
  | "dom7"
  | "min7"
  | "halfdim";

export interface ChordDef {
  id: ChordQuality;
  label: string;
  /** Suffisso latino (vuoto = triade maggiore). */
  suffix: string;
  steps: number[];
  /** Simbolo unicode per la teoria. */
  symbol: string;
}

export const CHORDS: Record<ChordQuality, ChordDef> = {
  maj: { id: "maj", label: "Maggiore", suffix: "", steps: [0, 4, 7], symbol: "" },
  min: { id: "min", label: "Minore", suffix: "m", steps: [0, 3, 7], symbol: "m" },
  dim: { id: "dim", label: "Diminuita", suffix: "dim", steps: [0, 3, 6], symbol: "°" },
  aug: { id: "aug", label: "Aumentata", suffix: "aug", steps: [0, 4, 8], symbol: "+" },
  maj7: { id: "maj7", label: "Settima maggiore", suffix: "maj7", steps: [0, 4, 7, 11], symbol: "maj7" },
  dom7: { id: "dom7", label: "Settima di dominante", suffix: "7", steps: [0, 4, 7, 10], symbol: "7" },
  min7: { id: "min7", label: "Settima minore", suffix: "m7", steps: [0, 3, 7, 10], symbol: "m7" },
  halfdim: { id: "halfdim", label: "Semidiminuita", suffix: "m7b5", steps: [0, 3, 6, 10], symbol: "ø7" },
};

export const CHORD_QUALITIES = Object.values(CHORDS);

export function chordName(rootPc: number, quality: ChordQuality): string {
  return `${noteName(rootPc)}${CHORDS[quality].suffix}`;
}

export function chordNotes(rootPc: number, quality: ChordQuality): number[] {
  return CHORDS[quality].steps.map((s) => (rootPc + s) % 12);
}

/* ---------------- Intervalli ---------------- */

export interface IntervalDef {
  semitones: number;
  label: string;
  short: string;
  /** Nome dell'intervallo maggiore/minore per le risposte. */
  quality: string;
}

export const INTERVALS: IntervalDef[] = [
  { semitones: 1, label: "Seconda minore", short: "b2", quality: "minore" },
  { semitones: 2, label: "Seconda maggiore", short: "M2", quality: "maggiore" },
  { semitones: 3, label: "Terza minore", short: "b3", quality: "minore" },
  { semitones: 4, label: "Terza maggiore", short: "M3", quality: "maggiore" },
  { semitones: 5, label: "Quarta giusta", short: "P4", quality: "giusta" },
  { semitones: 6, label: "Quarta aumentata", short: "A4", quality: "aumentata" },
  { semitones: 7, label: "Quinta giusta", short: "P5", quality: "giusta" },
  { semitones: 8, label: "Sesta minore", short: "b6", quality: "minore" },
  { semitones: 9, label: "Sesta maggiore", short: "M6", quality: "maggiore" },
  { semitones: 10, label: "Settima minore", short: "b7", quality: "minore" },
  { semitones: 11, label: "Settima maggiore", short: "M7", quality: "maggiore" },
];

export function intervalBySemitones(n: number): IntervalDef {
  return (
    INTERVALS.find((i) => i.semitones === n) ?? {
      semitones: n,
      label: "Ottava",
      short: "P8",
      quality: "giusta",
    }
  );
}

/* ---------------- Armonia diatonica ---------------- */

/** Gradi romani della scala maggiore (I, ii, iii, IV, V, vi, vii°). */
export const MAJOR_DEGREES = [
  { numeral: "I", quality: "maj" as ChordQuality },
  { numeral: "ii", quality: "min" as ChordQuality },
  { numeral: "iii", quality: "min" as ChordQuality },
  { numeral: "IV", quality: "maj" as ChordQuality },
  { numeral: "V", quality: "maj" as ChordQuality },
  { numeral: "vi", quality: "min" as ChordQuality },
  { numeral: "vii°", quality: "dim" as ChordQuality },
];

/** Gradi romani della scala minore naturale (i, ii°, III, iv, v, VI, VII). */
export const MINOR_DEGREES = [
  { numeral: "i", quality: "min" as ChordQuality },
  { numeral: "ii°", quality: "dim" as ChordQuality },
  { numeral: "III", quality: "maj" as ChordQuality },
  { numeral: "iv", quality: "min" as ChordQuality },
  { numeral: "v", quality: "min" as ChordQuality },
  { numeral: "VI", quality: "maj" as ChordQuality },
  { numeral: "VII", quality: "maj" as ChordQuality },
];

export function degreesFor(minor: boolean) {
  return minor ? MINOR_DEGREES : MAJOR_DEGREES;
}

/** Gradi con settima (Jazz): IM7, ii7, …, bVII7. */
export const MAJOR_DEGREES7 = [
  { numeral: "IM7", quality: "maj7" as ChordQuality },
  { numeral: "ii7", quality: "min7" as ChordQuality },
  { numeral: "iii7", quality: "min7" as ChordQuality },
  { numeral: "IVM7", quality: "maj7" as ChordQuality },
  { numeral: "V7", quality: "dom7" as ChordQuality },
  { numeral: "vi7", quality: "min7" as ChordQuality },
  { numeral: "viiø7", quality: "halfdim" as ChordQuality },
];

export const MINOR_DEGREES7 = [
  { numeral: "i7m", quality: "min7" as ChordQuality },
  { numeral: "iiø7", quality: "halfdim" as ChordQuality },
  { numeral: "IIIM7", quality: "maj7" as ChordQuality },
  { numeral: "iv7", quality: "min7" as ChordQuality },
  { numeral: "v7", quality: "min7" as ChordQuality },
  { numeral: "VIM7", quality: "maj7" as ChordQuality },
  { numeral: "VII7", quality: "dom7" as ChordQuality },
];

/** Gradi (0-based) con funzione forte, per costruire progressions coerenti. */
export const DOMINANT_DEGREE = 4; // V / v
export const TONIC_DEGREE = 0;
export const SUBMEDIANT_DEGREE = 5; // vi / VI
export const MEDIANT_DEGREE = 2; // iii / III
export const SUPERTONIC_DEGREE = 1; // ii / ii°
export const SUBTONIC_DEGREE = 6; // vii° / VII

/** Generatore di esercizi per Allena Scale.
 *
 *  Ogni variante produce una sequenza di note MIDI che appartengono davvero
 *  alla scala scelta: niente note estranee, niente passaggi fuori ottava.
 *  Le regole sono deterministiche, la variazione casuale è controllata e
 *  riproducibile a partire dal seme. */

import {
  SCALE_BY_ID,
  type ScaleId,
} from "./theory";

export type ExerciseId =
  | "ascendente"
  | "discendente"
  | "terze"
  | "quarte"
  | "arpeggi"
  | "sequenze"
  | "random";

export interface ExerciseDef {
  id: ExerciseId;
  label: string;
  hint: string;
}

export const EXERCISES: ExerciseDef[] = [
  { id: "ascendente", label: "Scala ascendente", hint: "Dal grave all'acuto" },
  { id: "discendente", label: "Scala discendente", hint: "Dall'acuto al grave" },
  { id: "terze", label: "Terze", hint: "Salti di terza dentro la scala" },
  { id: "quarte", label: "Quarte", hint: "Salti di quarta dentro la scala" },
  { id: "arpeggi", label: "Arpeggi", hint: "Accordi diatonici della tonalità" },
  { id: "sequenze", label: "Sequenze", hint: "Pattern melodici di 3, 4 o più note" },
  { id: "random", label: "Random", hint: "Casuale, ma solo note della scala" },
];

export const EXERCISE_LABEL: Record<ExerciseId, string> = EXERCISES.reduce(
  (acc, e) => {
    acc[e.id] = e.label;
    return acc;
  },
  {} as Record<ExerciseId, string>
);

/** Generatore lineare congruenziale: rapido e riproducibile. */
function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export interface DiatonicTriad {
  /** Semitoni dalla tonica: 1ª, 3ª, 5ª. */
  steps: number[];
  /** La terza è minore. */
  minor: boolean;
}

/** Triadi diatoniche: una per ogni grado della scala. */
export function diatonicTriads(steps: number[]): DiatonicTriad[] {
  const size = steps.length;
  return steps.map((_, i) => ({
    steps: [steps[i], steps[(i + 2) % size], steps[(i + 4) % size]],
    minor: (steps[(i + 2) % size] - steps[i] + 12) % 12 === 3,
  }));
}

interface Pool {
  /** Note di una ottava, dalla tonica. */
  octave: number[];
  /** Due ottave, per salire e scendere. */
  twoOctaves: number[];
}

/** Note disponibili: due ottave a partire dalla tonica scelta. */
function buildPool(tonic: number, steps: number[]): Pool {
  const octave = steps.map((s) => tonic + s);
  return {
    octave,
    twoOctaves: [...octave, ...steps.map((s) => tonic + 12 + s)],
  };
}

/**
 * Genera la sequenza di note di un esercizio.
 *
 * @param tonic  MIDI della tonica all'ottava di partenza
 * @param steps  semitoni della scala
 * @param how    quante note per frase (3, 4 o più)
 */
export function generateExercise(
  kind: ExerciseId,
  tonic: number,
  scaleId: ScaleId,
  steps: number[],
  rngSeed: number,
  patternLen = 4
): number[] {
  const rng = makeRng(rngSeed);
  const pool = buildPool(tonic, steps);
  const size = steps.length;
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  switch (kind) {
    case "ascendente":
      return pool.twoOctaves;

    case "discendente":
      return [...pool.twoOctaves].reverse();

    case "terze":
    case "quarte": {
      // Salta di un grado (terza) o di due (quarta) alternando le direzioni.
      const jump = kind === "terze" ? 2 : 3;
      const notes: number[] = [];
      let idx = 0;
      let dir = 1;
      for (let i = 0; i < pool.twoOctaves.length - 1; i++) {
        notes.push(pool.twoOctaves[idx]);
        idx += dir * jump;
        if (idx >= size || idx < 0) {
          // Si rispecchia sul grado interno, evitando di uscire dalla scala.
          idx = idx >= size ? size - 1 - (idx - size) : 1 + (1 - idx);
          dir = -dir as 1 | -1;
        }
      }
      notes.push(pool.twoOctaves[pool.twoOctaves.length - 1]);
      return notes;
    }

    case "arpeggi": {
      // Accordo diatonico su ciascun grado, con ritorno alla tonica ogni due.
      const at = (degree: number, octaveUp = 0) => {
        const wrapped = ((degree % size) + size) % size;
        return tonic + octaveUp * 12 + steps[wrapped];
      };
      const notes: number[] = [];
      for (let g = 0; g < size; g++) {
        notes.push(at(g), at(g + 2), at(g + 4), at(g, 1));
      }
      return notes;
    }

    case "sequenze": {
      // Pattern melodico di N note, ripetuto con piccole variazioni.
      const len = Math.max(3, Math.min(8, patternLen));
      const notes: number[] = [];
      let idx = Math.floor(rng() * size);
      let dir = rng() > 0.5 ? 1 : -1;
      const reps = Math.max(2, Math.round(pool.twoOctaves.length / len));
      for (let r = 0; r < reps; r++) {
        for (let i = 0; i < len; i++) {
          notes.push(pool.octave[idx]);
          const step = pick([1, 1, 2, -1, -1, 3]);
          const next = idx + step;
          if (next < 0 || next >= size) {
            dir = -dir as 1 | -1;
            idx = Math.max(0, Math.min(size - 1, idx + dir * Math.abs(step)));
          } else {
            idx = next;
          }
        }
        // A ogni frase si rientra verso l'inizio, con leggera variazione.
        idx = (idx + (rng() > 0.5 ? 1 : -1) + size) % size;
      }
      return notes;
    }

    case "random":
    default: {
      const notes: number[] = [];
      const count = Math.max(8, pool.twoOctaves.length);
      for (let i = 0; i < count; i++) notes.push(pick(pool.twoOctaves));
      return notes;
    }
  }
}

/** Etichetta leggibile dell'esercizio, con la tonalità. */
export function exerciseTitle(kind: ExerciseId, keyName: string, scaleLabel: string): string {
  return `${EXERCISE_LABEL[kind]} · ${keyName} ${scaleLabel}`;
}

/** Scala di default derivata dalla selezione (per il titolo). */
export function scaleLabelOf(scaleId: ScaleId): string {
  return SCALE_BY_ID[scaleId].short;
}

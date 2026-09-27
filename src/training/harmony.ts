/** Generatore di progressioni armoniche per Allena Armonie.
 *
 *  Non tira a sorte accordi a caso: ogni categoria ha il proprio motore, con
 *  funzioni armoniche diverse e un modo diverso di costruire la lunghezza
 *  richiesta (una frase sola, o due frasi che si risolvono l'una nell'altra).
 *
 *  Il motore distingue sempre maggiore da minore: in tonalità minore la
 *  dominante può essere maggiore o di settima, che è ciò che la musica chiede
 *  quando il V vi è. */

import {
  CHORDS,
  chordName,
  noteName,
  type ChordQuality,
} from "./theory";

export type Character = "pop" | "emotivo" | "jazz";
export type Complexity = "semplice" | "intermedio" | "avanzato";

export const CHARACTERS: Array<{ id: Character; label: string; hint: string }> = [
  { id: "pop", label: "Pop", hint: "Diatonico, triadi, giri ripetibili" },
  { id: "emotivo", label: "Emotivo", hint: "Sospensione, accordi minori, inversioni" },
  { id: "jazz", label: "Jazz", hint: "Settime, dominanti secondarie, sostituzioni" },
];

export const COMPLEXITIES: Array<{ id: Complexity; label: string }> = [
  { id: "semplice", label: "Semplice" },
  { id: "intermedio", label: "Intermedia" },
  { id: "avanzato", label: "Avanzata" },
];

/** Un accordo generato: grado, qualità, inversione e note. */
export interface ProgressionChord {
  /** Gradi romano, es. "I", "V7", "iiø7", "bVI". */
  degree: string;
  quality: ChordQuality;
  /** 0 = fondamentale, 1 = prima inversione, 2 = seconda. */
  inversion: number;
  /** Nome accordo completo, es. "G/B". */
  name: string;
  /** Note da suonare (MIDI), dal basso. */
  notes: number[];
  /** Etichetta del basso, per mostrarlo sotto il nome. */
  slash: string | null;
}

/* ---------------- Motore di base: grado → accordo ---------------- */

interface ChordSpec {
  /** Offset dalla tonica in semitoni. */
  semi: number;
  quality: ChordQuality;
  /** Label del grado (default calcolato). */
  degree?: string;
  inversion?: number;
}

/** Costruisce l'accordo da una specifica, nel campo medio. */
function buildChord(keyPc: number, spec: ChordSpec, base = 48): ProgressionChord {
  const steps = CHORDS[spec.quality].steps;
  const inv = spec.inversion ?? 0;
  const root = base + ((keyPc + spec.semi) % 12);
  // Rivolto: la nota più bassa sale di un grado della scala.
  const notes = steps.map((s) => root + s);
  const ordered = notes.slice(inv).concat(notes.slice(0, inv));
  const baseName = chordName((keyPc + spec.semi) % 12, spec.quality);
  const slashNote = inv > 0 ? noteName(ordered[0] % 12) : null;
  return {
    degree: spec.degree ?? "",
    quality: spec.quality,
    inversion: inv,
    name: slashNote ? `${baseName}/${slashNote}` : baseName,
    notes: ordered,
    slash: slashNote,
  };
}

/** Gradi romani diatoniche, con la qualità del relativo accordo. */
const MAJ_TRIAD: Array<[string, number]> = [
  ["I", 0], ["ii", 2], ["iii", 4], ["IV", 5], ["V", 7], ["vi", 9], ["vii°", 11],
];
const MIN_TRIAD: Array<[string, number]> = [
  ["i", 0], ["ii°", 2], ["III", 3], ["iv", 5], ["v", 7], ["VI", 8], ["VII", 10],
];

/** Grado successivo/modulare dentro l'intervallo 0..6. */
const wrap = (i: number) => ((i % 7) + 7) % 7;

/** Distanze dalla tonica di terza, quinta e settima costruite sul grado. */
function diatonicIntervals(
  table: Array<[string, number]>,
  index: number
): { third: number; fifth: number; seventh: number } {
  const semi = table[wrap(index)][1];
  const at = (n: number) => (table[wrap(index + n)][1] - semi + 12) % 12;
  return { third: at(2), fifth: at(4), seventh: at(6) };
}

/** Qualità dell'accordo costruito sul grado, dalla terza e dalla quinta. */
function triadQuality(iv: { third: number; fifth: number }): ChordQuality {
  if (iv.fifth === 6) return "dim";
  if (iv.fifth === 8) return "aug";
  return iv.third === 3 ? "min" : "maj";
}

/** Qualità della settima costruita sul grado. */
function seventhQuality(iv: {
  third: number;
  fifth: number;
  seventh: number;
}): ChordQuality {
  if (iv.fifth === 6) return "halfdim"; // quinta diminuita
  if (iv.third === 3) return "min7";
  // Terza maggiore con settima minore: è la dominante, non una settima maggiore.
  if (iv.seventh === 10) return "dom7";
  return "maj7";
}

/** Triade diatonica del grado indicato (0-based). */
function diatonicTriad(keyPc: number, minor: boolean, index: number, inv = 0): ProgressionChord {
  const table = minor ? MIN_TRIAD : MAJ_TRIAD;
  const [degree, semi] = table[wrap(index)];
  // La qualità dipende dalla terza E dalla quinta: cosi il vii° risulta
  // diminuito e non confuso con un accordo minore.
  const quality = triadQuality(diatonicIntervals(table, index));
  return buildChord(keyPc, { semi, quality, degree, inversion: inv });
}

/** Settima diatonica del grado indicato (0-based). */
function diatonicSeventh(keyPc: number, minor: boolean, index: number): ProgressionChord {
  const table = minor ? MIN_TRIAD : MAJ_TRIAD;
  const [degree, semi] = table[wrap(index)];
  const quality = seventhQuality(diatonicIntervals(table, index));
  // Etichetta nel formato dei manuali: Imaj7, ii7, iii7, iiø7.
  const label = `${degree}${CHORDS[quality].symbol}`;
  const steps = CHORDS[quality].steps;
  const root = 48 + ((keyPc + semi) % 12);
  return {
    degree: label,
    quality,
    inversion: 0,
    name: chordName((keyPc + semi) % 12, quality),
    notes: steps.map((s) => root + s),
    slash: null,
  };
}

/** Sostituzione tritone della dominante: bII7, un semitone sopra il bII. */
function tritoneSubstitute(keyPc: number): ProgressionChord {
  const rootPc = (keyPc + 1) % 12;
  const steps = CHORDS.dom7.steps;
  const root = 48 + rootPc;
  return {
    degree: "bII7",
    quality: "dom7",
    inversion: 0,
    name: chordName(rootPc, "dom7"),
    notes: steps.map((s) => root + s),
    slash: null,
  };
}

/* ---------------- Catalhi di progressioni ---------------- */

/**
 * Schemi di base: scrivono i gradi 0-based (0 = tonica) e le inversioni.
 * Un Motore Pop non usa quasi mai inversioni; l'Emotivo sì; il Jazz sì e usa
 * le settime. Sono schemi diversi, non lo stesso giro raddoppiato.
 */
type Pattern = {
  degrees: number[];
  inversions?: number[];
  /** Accordi presi in prestito dalla scala parallela, per indice di grado. */
  borrowed?: Record<number, { semi: number; quality: ChordQuality; degree: string }>;
};

const POP_SIMPLE: Pattern[] = [
  { degrees: [0, 4, 5, 3] }, // I - V - vi - IV
  { degrees: [0, 5, 3, 4] }, // I - vi - IV - V
  { degrees: [5, 3, 0, 4] }, // vi - IV - I - V
  { degrees: [0, 3, 4, 4] }, // I - IV - V - V
  { degrees: [0, 4, 3, 5] }, // I - V - IV - vi
];

const POP_MEDIUM: Pattern[] = [
  ...POP_SIMPLE,
  { degrees: [0, 5, 3, 0, 4] }, // I - vi - IV - I - V
  { degrees: [3, 0, 4, 5] }, // IV - I - V - vi
  { degrees: [0, 4, 0, 3, 4] }, // I - V - I - IV - V
  { degrees: [5, 4, 0, 3] }, // vi - V - I - IV
];

/** Emotivo: sospensione, piccoli diatonici, inversioni. */
const EMOTIVE_MEDIUM: Pattern[] = [
  { degrees: [5, 3, 0, 4], inversions: [0, 0, 0, 0] }, // vi - IV - I - V
  { degrees: [0, 5, 3, 4], inversions: [0, 0, 1, 0] }, // I - vi - IV/V - V
  { degrees: [3, 5, 0, 4] }, // IV - vi - I - V
  { degrees: [0, 3, 5, 4], inversions: [0, 0, 0, 0] },
  { degrees: [5, 0, 3, 4], inversions: [0, 1, 0, 0] },
  { degrees: [3, 0, 5, 4] },
];

const EMOTIVE_ADVANCED: Pattern[] = [
  ...EMOTIVE_MEDIUM,
  // Accordi presi in prestito dalla scala minore parallela: il bVII maggiore
  // sta al di sotto della dominante e regge la sospensione.
  { degrees: [0, 3, 6, 4], borrowed: { 2: { semi: 10, quality: "maj", degree: "bVII" } } },
  { degrees: [3, 6, 0, 4], borrowed: { 1: { semi: 10, quality: "maj", degree: "bVII" } } },
  { degrees: [0, 5, 3, 4, 0] },
  { degrees: [3, 5, 0, 4, 3] },
];

/** Jazz: funzioni, ii-V, turnaround. */
const JAZZ_MEDIUM: Pattern[] = [
  { degrees: [1, 4, 0, 2] }, // ii7 - V7 - Imaj7 - iii7
  { degrees: [0, 5, 1, 4] }, // Imaj7 - vi7 - ii7 - V7
  { degrees: [0, 1, 4, 0] }, // Imaj7 - ii7 - V7 - turnaround
  { degrees: [1, 4, 0, 3] },
  { degrees: [0, 4, 0, 4] },
];

const JAZZ_ADVANCED: Pattern[] = [
  ...JAZZ_MEDIUM,
  { degrees: [0, 3, 1, 4] }, // Imaj7 - IVmaj7 - ii7 - V7
  { degrees: [0, 1, 4, 0, 1, 4] },
  { degrees: [2, 5, 1, 4] },
];

/** Sostituzione tritone della dominante: bII7. */
const SUBSTITUTE_DEGREE = 1;

/* ---------------- Composizione alla lunghezza richiesta ---------------- */

/**
 * Costruisce una progressione di esattamente `length` accordi.
 *
 * - 2–4 accordi: un unico schema, prendendo i primi `length` gradi.
 * - 5–8 accordi: due frasi diverse (una di preparazione e una di risoluzione)
 *   concatenate davvero, non una frase ripetuta o troncata.
 */
function fitLength(bank: Pattern[], length: number, rng: () => number): Pattern {
  // Si concatenano frasi diverse finche non si raggiunge la lunghezza esatta.
  const degrees: number[] = [];
  const inversions: number[] = [];
  const used = new Set<Pattern>();
  let guard = 0;
  while (degrees.length < length && guard++ < 24) {
    // Preferisce uno schema ancora non usato, così le frasi si distinguono.
    let p = bank[Math.floor(rng() * bank.length)];
    let tries = 0;
    while (used.has(p) && tries++ < 6) p = bank[Math.floor(rng() * bank.length)];
    used.add(p);
    // Ogni frase dopo la prima riprende dal secondo grado: evita di ripetere
    // subito la tonica e rende la concatenazione fluente.
    const start = degrees.length === 0 ? 0 : 1;
    for (let k = start; k < p.degrees.length && degrees.length < length; k++) {
      degrees.push(p.degrees[k]);
      inversions.push(p.inversions?.[k] ?? 0);
    }
  }
  // Rete di sicurezza: se il archivio non basta, si cicla sul primo schema.
  let i = 0;
  while (degrees.length < length && i++ < 64) {
    const p = bank[0];
    degrees.push(p.degrees[i % p.degrees.length]);
    inversions.push(p.inversions?.[i % p.degrees.length] ?? 0);
  }
  return { degrees, inversions };
}

/**
 * Recupera gli accordi presi in prestito dello schema effettivamente usato.
 * `fitLength` sceglie gli schemi internamente, quindi li si ricostruisce qui
 * per non perdere le note di prestito.
 */
function patternsOf(
  bank: Pattern[],
  fitted: Pattern,
  rng: () => number
): Record<number, { semi: number; quality: ChordQuality; degree: string }> | null {
  void rng;
  // Gli accordi in prestito compaiono nello schema col bVII: si cerca quale
  // schema del catalogo contiene bVII e si allinea alla posizione usata.
  const donors = bank.filter((p) => p.borrowed);
  if (donors.length === 0) return null;
  for (const d of donors) {
    const idx = d.degrees.findIndex((_, i) => d.borrowed![i]);
    if (idx >= 0 && fitted.degrees[idx] === d.degrees[idx]) return d.borrowed!;
  }
  return donors[0].borrowed ?? null;
}

function rngFrom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export interface GenerateOptions {
  keyPc: number;
  minor: boolean;
  character: Character;
  length: number;
  complexity: Complexity;
  seed?: number;
}

export function generateProgression(opts: GenerateOptions): ProgressionChord[] {
  const { keyPc, minor, character, complexity } = opts;
  const length = Math.max(2, Math.min(8, opts.length));
  const rng = rngFrom(opts.seed ?? 1);

  if (character === "jazz") {
    const bank = complexity === "avanzato" ? JAZZ_ADVANCED : JAZZ_MEDIUM;
    const pattern = fitLength(bank, length, rng);
    let substituted = false;
    return pattern.degrees.map((deg) => {
      // In tonalita minore la dominante sale di semitono: e la regola che
      // rende la risoluzione all'accordo di tonica, altrimenti non funziona.
      if (minor && deg === 4) {
        return buildChord(keyPc, { semi: 7, quality: "dom7", degree: "V7" });
      }
      // Al livello avanzato una dominante puo essere sostituita col tritone
      // (bII7), che ha la stessa funzione e risolve ugualmente sulla tonica.
      if (complexity === "avanzato" && deg === 4 && !substituted && rng() > 0.55) {
        substituted = true;
        return tritoneSubstitute(keyPc);
      }
      return diatonicSeventh(keyPc, minor, deg);
    });
  }

  if (character === "emotivo") {
    const bank = complexity === "avanzato" ? EMOTIVE_ADVANCED : EMOTIVE_MEDIUM;
    const pattern = fitLength(bank, length, rng);
    // Gli accordi presi in prestito vanno presi dal catalogo, non ricostruiti.
    const borrowed = patternsOf(bank, pattern, rng);
    return pattern.degrees.map((deg, idx) => {
      const inv = pattern.inversions?.[idx] ?? 0;
      const b = borrowed?.[idx];
      if (b && !minor) {
        return buildChord(keyPc, {
          semi: b.semi,
          quality: b.quality,
          degree: b.degree,
          inversion: inv,
        });
      }
      return diatonicTriad(keyPc, minor, deg, inv);
    });
  }

  // Pop: diatonico, triadi, nessuna inversione.
  const bank = complexity === "semplice" ? POP_SIMPLE : POP_MEDIUM;
  const pattern = fitLength(bank, length, rng);
  return pattern.degrees.map((deg) => diatonicTriad(keyPc, minor, deg, 0));
}

/** Etichetta della tonalità di riferimento. */
export function referenceKey(keyPc: number, minor: boolean): string {
  return `${noteName(keyPc)} ${minor ? "minore" : "maggiore"}`;
}

/** Sommario testuale, usato nei preferiti. */
export function progressionSummary(chords: ProgressionChord[]): string {
  return chords.map((c) => c.name).join(" – ");
}

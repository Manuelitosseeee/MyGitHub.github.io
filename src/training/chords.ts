/** Archivio di diteggiature per chitarra usato da Allena Accordi e Allena Armonie.
 *
 *  Le diteggiature non sono scritte a mano: un motore di ricerca le ricava
 *  dai tre sistemi classici (forma E, forma A, forma D) scegliendo, corda per
 *  corda, il tasto che produce una nota dell'accordo. Ogni posizione è quindi
 *  corretta per costruzione, comprese le tipologie rare (diminuite, aumentate,
 *  semidiminuite), e la ricerca privilegia le soluzioni più suonabili.
 *
 *  `frets` è un array di 6 elementi (dalla 6ª corda alla 1ª):
 *  `null` = corda da non suonare, 0 = corda aperta, n>0 = tasto n. */

import { CHORDS, chordName, noteName, type ChordQuality } from "./theory";

export type Level = "principiante" | "intermedio" | "avanzato";

export const LEVELS: Level[] = ["principiante", "intermedio", "avanzato"];

export const LEVEL_LABEL: Record<Level, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzato: "Avanzato",
};

export interface Barre {
  /** Tasto del barrè. */
  fret: number;
  /** Indice corda più grave (0 = 6ª corda). */
  from: number;
  /** Indice corda più acuta (5 = 1ª corda). */
  to: number;
}

export interface ChordShape {
  id: string;
  /** Nome mostrato, es. "Cmaj7". */
  name: string;
  quality: ChordQuality;
  rootPc: number;
  frets: (number | null)[];
  /** 1 = indice, 2 = medio, 3 = anulare, 4 = mignolo; 0 = non usata. */
  fingers: number[];
  barre: Barre | null;
  /** Tasto più basso effettivamente premuto (0 se c'è una corda aperta). */
  baseFret: number;
  /** Numero di dita usate. */
  fingerCount: number;
  /** true se contiene almeno un barrè. */
  hasBarre: boolean;
  level: Level;
}

/** Accordatura standard, dalla 6ª corda alla 1ª. */
export const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
export const STRING_LABELS = ["6ª", "5ª", "4ª", "3ª", "2ª", "1ª"];
export const FINGER_NAMES = ["", "indice", "medio", "anulare", "mignolo"];

export function stringMidi(stringIndex: number, fret: number): number {
  return OPEN_MIDI[stringIndex] + fret;
}

/* ---------------- Motore di ricerca delle diteggiature ---------------- */

type System = "e" | "a" | "d";

/** Corda sulla cui viene ancorata la tonica. */
const ROOT_STRING: Record<System, number> = { e: 0, a: 1, d: 2 };
/** Corde coperte dalla forma; le più gravi restano mute. */
const SPAN: Record<System, [number, number]> = { e: [0, 5], a: [1, 5], d: [2, 5] };
/** Tasti oltre la radice ammessi. */
const MAX_OFFSET: Record<System, number> = { e: 3, a: 3, d: 4 };
/** Solo le forme E e A sono tenute dal barrè. */
const USES_BARRE: Record<System, boolean> = { e: true, a: true, d: false };

/** Tasto, sulla corda indicata, che produce la tonica. */
function rootFretOn(stringIndex: number, rootPc: number): number {
  for (let f = 0; f <= 11; f++) {
    if ((OPEN_MIDI[stringIndex] + f) % 12 === rootPc) return f;
  }
  return -1;
}

/** Peso di ciascun grado nel punteggio (la terza e la tonica contano di più). */
function toneWeight(step: number): number {
  if (step === 0) return 5; // tonica
  if (step === 3 || step === 4) return 4; // terza
  if (step === 10 || step === 11) return 3; // settima
  if (step === 7) return 2; // quinta
  return 1.5; // 6ª, quinta diminuita, quinta aumentata
}

/** Gradi che devono comparire perché la diteggiatura sia accettata. */
const REQUIRED_STEPS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  aug: [0, 4, 8],
  dim: [0, 3, 6],
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  halfdim: [0, 3, 6, 10],
};

interface SearchState {
  frets: (number | null)[];
  /** Note dell'accordo effettivamente presenti, come maschera di bit. */
  mask: number;
  /** Tasti premuti, dal più basso al più alto. */
  fretted: number[];
  /** Quante corde sono zittite. */
  muted: number;
  cost: number;
}

/**
 * Cerca la diteggiatura migliore per un dato sistema. La ricerca prova tutti
 * i tasti ammessi corda per corda e mantiene la combinazione più "suonabile":
 * copre tutti i gradi dell'accordo, resta compatta e usa quante più corde
 * possibili senza chiedere barre della mano.
 */
function searchSystem(
  rootPc: number,
  quality: ChordQuality,
  system: System
): ChordShape | null {
  const steps = CHORDS[quality].steps;
  const tones = new Set(steps.map((s) => (rootPc + s) % 12));
  const [from, to] = SPAN[system];
  const anchorFret = rootFretOn(ROOT_STRING[system], rootPc);
  if (anchorFret < 0) return null;

  const useBarre = USES_BARRE[system] && anchorFret > 0;
  const barreFret = anchorFret;
  // La forma D è una posizione aperta: parte dal tasso 0.
  const lo = system === "d" ? 0 : anchorFret;
  const hi = system === "d" ? MAX_OFFSET.d : anchorFret + MAX_OFFSET[system];
  // Dita disponibili oltre indice (o oltre il barrè).
  const extraFingers = useBarre ? 3 : 3;

  const requiredMask = REQUIRED_STEPS[quality].reduce(
    (m, step) => m | (1 << steps.indexOf(step)),
    0
  );

  // Opzioni per corda: i tasti che suonano una nota dell'accordo.
  const options: Array<Array<number | null>> = [];
  for (let s = 0; s < 6; s++) {
    if (s < from) {
      options.push([null]);
      continue;
    }
    const list: Array<number | null> = [];
    for (let f = lo; f <= hi; f++) {
      if (tones.has((OPEN_MIDI[s] + f) % 12)) list.push(f);
    }
    options.push(list.length ? list : [null]);
  }

  // Il contenitore evita che TypeScript allarghi `best` a `never` dopo la
  // prima assegnazione dentro la closure.
  const found: { best: SearchState | null } = { best: null };
  const chosen: Array<number | null> = new Array(6).fill(null);

  const evaluate = (mask: number, fretted: number[], muted: number) => {
    if ((mask & requiredMask) !== requiredMask) return;
    if (fretted.length < 3) return;
    const minF = Math.min(...fretted);
    const maxF = Math.max(...fretted);
    const spread = maxF - minF;
    if (spread > 4) return; // oltre è scomodo per la mano
    // Tasti distinti premuti: barrè compreso.
    const distinct = new Set(fretted).size;
    if (distinct > (useBarre ? 4 : 4)) return;
    let cost = 0;
    cost += spread * 1.6; // compattezza
    cost += muted * 3.5; // preferisce usare tutte le corde disponibili
    cost += (distinct - 1) * 0.9; // economia di dita
    cost += minF * 0.8; // le posizioni basse sul manico sono più comode
    if (useBarre) cost -= 3; // tenere il barrè è pratico
    if (mask === (1 << steps.length) - 1) cost -= 5; // diteggiatura completa
    if (minF === 0) cost -= 1.2; // almeno una corda aperta
    const best = found.best;
    if (best && cost >= best.cost) return;
    found.best = { frets: chosen.slice(), mask, fretted, muted, cost };
  };

  const recurse = (
    s: number,
    mask: number,
    fretted: number[],
    muted: number,
    cost: number
  ) => {
    if (s > to) {
      evaluate(mask, fretted, muted);
      return;
    }
    for (const f of options[s]) {
      if (f === null) {
        chosen[s] = null;
        recurse(s + 1, mask, fretted, muted + 1, cost);
        continue;
      }
      const bit = steps.indexOf((OPEN_MIDI[s] + f - rootPc + 120) % 12);
      const onBarre = useBarre && f === barreFret;
      let c = cost;
      if (onBarre) c -= 1.2;
      if (bit >= 0) c -= toneWeight(steps[bit]) * 1.3;
      if (f - barreFret >= 3 && !onBarre) c += 2.5; // mignolo in estensione
      chosen[s] = f;
      fretted.push(f);
      recurse(
        s + 1,
        bit >= 0 ? mask | (1 << bit) : mask,
        fretted,
        muted,
        c
      );
      fretted.pop();
      chosen[s] = null;
    }
  };

  recurse(from, 0, [], 0, 0);
  void extraFingers;
  const best = found.best;
  if (!best) return null;

  const frets: (number | null)[] = best.frets;
  const played = frets.filter((f): f is number => f !== null);

  /* --- Barrè: l'indice attraversa tutte le corde della forma --- */
  let barre: Barre | null = null;
  if (useBarre) {
    const barCount = frets.filter((f) => f === barreFret).length;
    if (barCount >= 2) barre = { fret: barreFret, from, to };
  }

  /* --- Assegnazione delle dita ---
   * Le corde del barrè sono tutte premute dall'indice; le altre dita vengono
   * assegnate dal tasto più basso al più alto, e per uno stesso tasto dalla
   * corda più grave alla più acuta (convenzione dei manuali). */
  const fingers: number[] = new Array(6).fill(0);
  const frettedSorted = [...new Set(played.filter((f) => f > 0))].sort(
    (a, b) => a - b
  );
  let pool = 1;
  if (barre) {
    frets.forEach((f, i) => {
      if (f === barre.fret) fingers[i] = 1;
    });
    pool = 2;
  }
  for (const f of frettedSorted) {
    if (barre && f === barre.fret) continue;
    for (let i = 0; i < 6 && pool <= 4; i++) {
      if (frets[i] === f && fingers[i] === 0) fingers[i] = pool++;
    }
  }

  const open = played.some((f) => f === 0);
  const base = open ? 0 : Math.min(...played);
  const hasBarre = barre !== null;
  const level: Level =
    base === 0 ? "principiante" : base <= 4 ? "intermedio" : "avanzato";

  return {
    id: `${chordName(rootPc, quality)}@${system}`,
    name: chordName(rootPc, quality),
    quality,
    rootPc,
    frets,
    fingers,
    barre,
    baseFret: base,
    fingerCount: fingers.filter((f) => f > 0).length,
    hasBarre,
    level,
  };
}

/* ---------------- Archivi ---------------- */

/** Qualità allenate a ciascun livello. */
const LEVEL_QUALITIES: Record<Level, ChordQuality[]> = {
  principiante: ["maj", "min"],
  intermedio: ["maj", "min", "dom7", "min7", "maj7"],
  avanzato: ["maj", "min", "dom7", "min7", "maj7", "dim", "aug", "halfdim"],
};

/** Oltre questo tasto una forma non viene più proposta al principiante. */
const EASY_FRET_LIMIT = 5;

const cache = new Map<string, ChordShape[]>();

/** Tutte le diteggiature di un accordo, dalla posizione più semplice. */
export function shapesFor(rootPc: number, quality: ChordQuality): ChordShape[] {
  const key = `${rootPc}:${quality}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out: ChordShape[] = [];
  for (const system of ["e", "a", "d"] as System[]) {
    const s = searchSystem(rootPc, quality, system);
    if (s) out.push(s);
  }
  out.sort(
    (a, b) =>
      a.baseFret - b.baseFret ||
      Number(a.hasBarre) - Number(b.hasBarre) ||
      a.id.localeCompare(b.id)
  );
  cache.set(key, out);
  return out;
}

/** La diteggiatura consigliata (la più semplice disponibile). */
export function bestShape(rootPc: number, quality: ChordQuality): ChordShape | null {
  return shapesFor(rootPc, quality)[0] ?? null;
}

export interface ChordEntry {
  rootPc: number;
  quality: ChordQuality;
  name: string;
  shape: ChordShape;
}

export interface ArchiveOptions {
  level: Level;
  qualities: ChordQuality[];
  barreOnly: boolean;
  /** id delle diteggiature da escludere. */
  excluded: string[];
}

/** Archivio su misura: livello, qualità ammesse, solo barrè, esclusioni. */
export function archiveFor(opts: ArchiveOptions): ChordEntry[] {
  const excluded = new Set(opts.excluded);
  const pick = (shape: ChordShape | undefined): boolean => {
    if (!shape) return false;
    if (opts.barreOnly && !shape.hasBarre) return false;
    if (excluded.has(shape.id)) return false;
    if (opts.level === "principiante" && shape.baseFret > EASY_FRET_LIMIT) {
      return false;
    }
    return true;
  };

  const out: ChordEntry[] = [];
  for (let pc = 0; pc < 12; pc++) {
    for (const q of opts.qualities) {
      const shape = shapesFor(pc, q).find(pick);
      if (shape) out.push({ rootPc: pc, quality: q, name: chordName(pc, q), shape });
    }
  }

  // I filtri non devono mai lasciare l'archivio vuoto: si allarga la ricerca.
  if (out.length === 0) {
    for (let pc = 0; pc < 12; pc++) {
      for (const q of opts.qualities) {
        const shape = bestShape(pc, q);
        if (shape) out.push({ rootPc: pc, quality: q, name: chordName(pc, q), shape });
      }
    }
  }
  return out;
}

export const levelQualities = (level: Level): ChordQuality[] => LEVEL_QUALITIES[level];

/* ---------------- Lettura delle corde ---------------- */

/** Note effettivamente suonate da una diteggiatura. */
export function shapeNotes(shape: ChordShape): number[] {
  return shape.frets
    .map((f, i) => (f === null ? null : stringMidi(i, f)))
    .filter((m): m is number => m !== null);
}

/** Verifica armonica: tutte le note appartengono all'accordo. */
export function shapeMatchesChord(shape: ChordShape): boolean {
  const allowed = new Set(CHORDS[shape.quality].steps.map((s) => (shape.rootPc + s) % 12));
  return shapeNotes(shape).every((m) => allowed.has(m % 12));
}

/** Note uniche (senza ottava) dell'accordo, per mostrarle all'utente. */
export function shapePitchClasses(shape: ChordShape): number[] {
  return [...new Set(shapeNotes(shape).map((m) => m % 12))].sort((a, b) => a - b);
}

export function shapeLabel(shape: ChordShape): string {
  return `${shape.name}${shape.hasBarre ? " · barrè" : ""}`;
}

export function describeQuality(q: ChordQuality): string {
  return CHORDS[q].label;
}

export function rootName(pc: number): string {
  return noteName(pc);
}

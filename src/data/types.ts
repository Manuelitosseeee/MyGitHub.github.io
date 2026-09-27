import type { MetroSound, Subdivision, BeatWeight } from "../engine/metronome";

export type Mood = "happy" | "neutral" | "sad";

/** A piece of music the user is studying (title only — no audio files). */
export interface Song {
  id: string;
  title: string;
  createdAt: number;
  /** Target tempo the user wants to reach (BPM). */
  goalBpm: number | null;
  /** Last BPM the song was practiced at. */
  lastBpm: number | null;
}

/** A settled BPM change recorded while the song's metronome was used. */
export interface BpmEvent {
  id: string;
  songId: string;
  at: number;
  bpm: number;
}

/** Accumulated practice seconds for one song on one local calendar day. */
export interface PracticeDay {
  id: string; // `${songId}::${date}`
  songId: string;
  date: string; // YYYY-MM-DD (local)
  seconds: number;
  updatedAt: number;
}

/** An optional, explicit study session tied to a song. */
export interface StudySession {
  id: string;
  songId: string;
  start: number;
  end: number | null;
  startBpm: number | null;
  finalBpm: number | null;
}

export type SheetKind = "image" | "pdf";

/** Sheet music attachment (image or PDF) for a song. Blob is stored separately. */
export interface SheetMeta {
  id: string;
  songId: string;
  name: string;
  kind: SheetKind;
  createdAt: number;
  size: number;
}

/** A recorded string change (a new set of strings mounted on the guitar). */
export interface StringChange {
  id: string;
  changeDate: string; // YYYY-MM-DD
  brand: string;
  notes: string;
  mood: Mood;
  imageId: string | null;
  createdAt: number;
}

export interface MetroPrefs {
  bpm: number;
  volume: number;
  sound: MetroSound;
  subdivision: Subdivision;
  beats: number;
  weights: BeatWeight[];
  autoIncrease: boolean;
  autoIntervalSeconds: number;
  autoBpmStep: number;
  /** The metronome was playing when the page was last reloaded. */
  wasRunning: boolean;
}

export type AppTheme = "system" | "light" | "dark";

/** Accent presets for the whole-app personalization (5 colors). */
export type ThemeAccent = "blue" | "violet" | "green" | "amber" | "rose";

/**
 * Font families. `auto` follows the base font of the active Aspetto Totale
 * design; picking any concrete family overrides it for every design.
 */
export type FontChoice =
  | "auto"
  | "system"
  | "rounded"
  | "serif"
  | "mono"
  | "sans";

export type FontSize = "s" | "m" | "l" | "xl";

/**
 * Whole-app designs ("Aspetto Totale", in Impostazioni). `default` is the
 * current MyGitHub look; the other nine restyle colors, shapes and the base
 * font. Layout, texts and functions never change.
 */
export type AppSkin =
  | "default"
  | "sabbia"
  | "oceano"
  | "vinile"
  | "acciaio"
  | "editoriale"
  | "lavagna"
  | "bosco"
  | "liquido"
  | "liquidglass"
  | "rinascimento";

export interface Appearance {
  /** Classic light/dark/system mode. */
  mode: AppTheme;
  /** Accent color that recolors the whole app. */
  accent: ThemeAccent;
  /** Text size scale. */
  fontSize: FontSize;
  /** Font family: "auto" follows the active skin's base font. */
  font: FontChoice;
  /** Aspetto Totale design ("default" = the current look). */
  skin: AppSkin;
  /** Preserve the pre-redesign look so it can be restored with one tap. */
  previousSkin: AppSkin;
  previousMode: AppTheme;
  /** Migrate existing installs to the new reversible Liquid Glass skin once. */
  skinRevision: number;
}

/** Tipologie di esercizio dell'orecchio. */
export type EarMode = "intervalli" | "accordi" | "progressioni";

/** Una risposta data in Allena l'Orecchio. */
export interface EarAnswer {
  id: string;
  /** Modo di allenamento. */
  mode: EarMode;
  /** Risposta data (etichetta: "M3", "Maggiore", "I-V-vi-IV"). */
  answer: string;
  /** Risposta corretta. */
  expected: string;
  correct: boolean;
  /** Millisecondi impiegati per rispondere. */
  ms: number;
  at: number;
  /** Dettaglio utile al Diario: tonalità o accordo dell'esercizio. */
  detail?: string;
}

/** Progressione armonica salvata tra i preferiti. */
export interface ProgressionFav {
  id: string;
  name: string;
  keyPc: number;
  minor: boolean;
  character: string;
  /** Gradi romani, es. ["I", "V", "vi", "IV"]. */
  degrees: string[];
  /** Accordi, es. ["C", "G", "Am", "F"]. */
  chords: string[];
  bpm: number;
  createdAt: number;
}

export interface Settings {
  appearance: Appearance;
  metro: MetroPrefs;
  tunerUi: "needle" | "line";
  lastTab: string;
  /** Ask for confirmation before deleting, or delete directly. */
  confirmDelete: boolean;
  /** Auto-start/stop a study session when the song metronome is started/stopped. */
  autoSession: boolean;
  reminder: {
    enabled: boolean;
    days: number;
    lastSeen: string | null; // day key when the reminder banner was last acknowledged
  };
}

export interface DBState {
  songs: Song[];
  events: BpmEvent[];
  practices: PracticeDay[];
  sessions: StudySession[];
  sheets: SheetMeta[];
  stringChanges: StringChange[];
  /** Risposte di Allena l'Orecchio (unico strumento con tracker). */
  earAnswers: EarAnswer[];
  /** Progressioni salvate da Allena Armonie. */
  progressionFavs: ProgressionFav[];
  settings: Settings;
}

export type CollectionKey = keyof DBState;

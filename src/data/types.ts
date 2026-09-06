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
}

export type AppTheme = "system" | "light" | "dark";

/** Accent presets for the whole-app personalization (5 colors). */
export type ThemeAccent = "blue" | "violet" | "green" | "amber" | "rose";

/** 3 font families: system (classic), serif (elegant), mono (technical). */
export type FontChoice = "system" | "serif" | "mono";

export type FontSize = "s" | "m" | "l" | "xl";

/** Whole-app visual designs ("Aspetto Totale"). 9 options: the current look
 *  (`default`) plus 8 material themes. They change surfaces, textures, radii,
 *  shadows and backgrounds — never fonts (handled by `FontChoice`). */
export type AppSkin =
  | "default"
  | "ceramica"
  | "vetro"
  | "carta"
  | "metallo"
  | "argilla"
  | "analogico"
  | "editoriale"
  | "liquido";

export interface Appearance {
  /** Classic light/dark/system mode. */
  mode: AppTheme;
  /** Accent color that recolors the whole app. */
  accent: ThemeAccent;
  /** Text size scale. */
  fontSize: FontSize;
  /** Font family. */
  font: FontChoice;
  /** Aspetto Totale design ("default" = current look). */
  skin: AppSkin;
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
  settings: Settings;
}

export type CollectionKey = keyof DBState;

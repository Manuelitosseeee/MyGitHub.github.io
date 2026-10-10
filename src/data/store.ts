import {bestFor,dayKey,plan,type Milestone} from "../study/planner";
import { useReducer, useEffect } from "react";
import { idbGet, idbSet, idbDelete, idbClear } from "../lib/idb";
import { uid } from "../lib/utils";
import { localDayKey } from "../lib/time";
import type {
  DBState,
  Song,
  BpmEvent,
  PracticeDay,
  StudySession,
  SheetMeta,
  SheetKind,
  StringChange,
  EarAnswer,
  EarMode,
  ProgressionFav,
  Settings,
  CollectionKey,
  AppTheme,
  FontChoice,
  AppSkin,
} from "./types";
import { VALID_FONTS, VALID_SKINS } from "./skins";
import { pixel } from "../pixel/state";

export const DEFAULT_SETTINGS: Settings = {
  studyDays: [0,1,2,3,4,5,6],
  studySort: "deadline",
  notifications: {enabled:false,time:"18:00",daily:true,deadlines:true,incomplete:true},
  appearance: {
    mode: "dark",
    accent: "blue",
    fontSize: "m",
    font: "auto",
    skin: "liquidglass",
    previousSkin: "default",
    previousMode: "system",
    skinRevision: 2,
  },
  metro: {
    bpm: 100,
    volume: 0.85,
    sound: "classic",
    subdivision: "none",
    beats: 4,
    weights: [2, 1, 1, 1],
    autoIncrease: false,
    autoIntervalSeconds: 60,
    autoBpmStep: 1,
    wasRunning: false,
  },
  tunerUi: "needle",
  lastTab: "diario",
  confirmDelete: true,
  autoSession: false,
  reminder: { enabled: false, days: 45, lastSeen: null },
};

export function defaultMetroWeights(beats: number): Array<0 | 1 | 2> {
  const w: Array<0 | 1 | 2> = [];
  for (let i = 0; i < beats; i++) w.push(i === 0 ? 2 : 1);
  return w;
}

function emptyState(): DBState {
  return {
    milestones: [], studyResults: [], dailyGoals: [],
    songs: [],
    events: [],
    practices: [],
    sessions: [],
    sheets: [],
    stringChanges: [],
    earAnswers: [],
    progressionFavs: [],
    settings: { ...DEFAULT_SETTINGS, metro: { ...DEFAULT_SETTINGS.metro } },
  };
}

class Store {
  state: DBState = emptyState();
  private listeners = new Set<() => void>();
  private ready = false;
  private writeQueue: Promise<void> = Promise.resolve();

  /** Load everything from IndexedDB (call once before rendering). */
  async init(): Promise<void> {
    if (this.ready) return;
    try {
      const keys: CollectionKey[] = [
        "songs",
        "events",
        "practices",
        "sessions",
        "sheets",
        "stringChanges",
        "earAnswers",
        "progressionFavs",
      ];
      const base = emptyState();
      const storedSettings = await idbGet<Settings>("settings");
      const s = (await Promise.all(keys.map((k) => idbGet<unknown>(k)))) as [
        Song[],
        BpmEvent[],
        PracticeDay[],
        StudySession[],
        SheetMeta[],
        StringChange[],
        EarAnswer[],
        ProgressionFav[],
      ];
      base.milestones = await idbGet("milestones") ?? [];
      base.studyResults = await idbGet("studyResults") ?? [];
      base.dailyGoals = await idbGet("dailyGoals") ?? [];
      base.songs = (s[0] ?? []) as Song[];
      base.events = (s[1] ?? []) as BpmEvent[];
      base.practices = (s[2] ?? []) as PracticeDay[];
      base.sessions = (s[3] ?? []) as StudySession[];
      base.sheets = (s[4] ?? []) as SheetMeta[];
      base.stringChanges = (s[5] ?? []) as StringChange[];
      base.earAnswers = (s[6] ?? []) as EarAnswer[];
      base.progressionFavs = (s[7] ?? []) as ProgressionFav[];
      const stored = storedSettings as Partial<Settings> | undefined;
      base.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
      base.settings.metro = {
        ...DEFAULT_SETTINGS.metro,
        ...(base.settings.metro ?? {}),
      };
      // Migration from older builds: `theme` (system|light|dark) became
      // `appearance.mode`; accent/font/size default to their presets.
      const legacyTheme = (stored as Record<string, unknown> | undefined)?.[
        "theme"
      ] as AppTheme | undefined;
      base.settings.appearance = {
        ...DEFAULT_SETTINGS.appearance,
        ...(base.settings.appearance ?? {}),
      };
      if (legacyTheme && !stored?.appearance) {
        base.settings.appearance.mode = legacyTheme;
      }
      // Sanitize values that may come from older/other builds so an unknown
      // skin or font never leaves the app unstyled.
      const ap = base.settings.appearance;
      if (!(VALID_SKINS as readonly string[]).includes(ap.skin as string)) {
        ap.skin = "default" as AppSkin;
      }
      if (!(VALID_FONTS as readonly string[]).includes(ap.font as string)) {
        ap.font = "auto" as FontChoice;
      }
      const needsSkinMigration = Boolean(stored) && ap.skinRevision !== 2;
      const needsEssentialLock = ap.skin !== "liquidglass";
      // Sanitize metronome prefs: a corrupt or out-of-range volume must never
      // leave the app permanently silent.
      const mp = base.settings.metro;
      if (!Number.isFinite(mp.volume)) mp.volume = DEFAULT_SETTINGS.metro.volume;
      mp.volume = Math.max(0, Math.min(1, mp.volume));
      if (!Number.isFinite(mp.bpm)) mp.bpm = DEFAULT_SETTINGS.metro.bpm;
      if (!Array.isArray(mp.weights) || mp.weights.length === 0) {
        mp.weights = [...DEFAULT_SETTINGS.metro.weights];
      }
      // Audio can never survive a reload: the flag is only a "was playing"
      // hint so the app can offer to resume, and the screen clears it.
      mp.wasRunning = Boolean(mp.wasRunning);
      if (needsSkinMigration) {
        ap.previousSkin = ap.skin;
        ap.previousMode = ap.mode;
        ap.skin = "liquidglass" as AppSkin;
        ap.mode = "dark";
        ap.skinRevision = 2;
      }
      // Essenziale is the only supported design; keep older saved selections
      // on their data-compatible settings while enforcing the current skin.
      ap.skin = "liquidglass" as AppSkin;
      ap.skinRevision = 2;
      this.state = base;
      if (needsSkinMigration || needsEssentialLock) {
        await idbSet("settings", base.settings).catch(() => undefined);
      }
    } catch {
      this.state = emptyState();
    }
    this.ready = true;
    this.emit();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  /** Apply an immutable update to one collection and persist it. */
  private commit<K extends CollectionKey>(key: K, next: DBState[K]): void {
    this.state = { ...this.state, [key]: next };
    this.writeQueue = this.writeQueue.then(() =>
      idbSet(key, next).catch(() => undefined)
    );
    this.emit();
  }

  /* ---------- helpers ---------- */

  songById(id: string): Song | undefined {
    return this.state.songs.find((s) => s.id === id);
  }

  async getBlob(id: string): Promise<Blob | null> {
    const b = await idbGet<Blob>(`blob:${id}`);
    return b ?? null;
  }

  private persistBlob(id: string, blob: Blob): void {
    this.writeQueue = this.writeQueue
      .then(() => idbSet(`blob:${id}`, blob))
      .catch(() => undefined);
  }

  private removeBlob(id: string): void {
    this.writeQueue = this.writeQueue
      .then(() => idbDelete(`blob:${id}`))
      .catch(() => undefined);
  }

  /** Most recent BPM event for a song. */
  private lastEventFor(songId: string): BpmEvent | undefined {
    let last: BpmEvent | undefined;
    for (const e of this.state.events) {
      if (e.songId === songId && (!last || e.at > last.at)) last = e;
    }
    return last;
  }

  /* ---------- Songs ---------- */

  addSong(title: string, goalBpm: number | null = null): Song {
    const song: Song = {
      id: uid("sng"),
      title: title.trim(),
      createdAt: Date.now(),
      goalBpm,
      lastBpm: null,
    };
    this.commit("songs", [song, ...this.state.songs]);
    return song;
  }

  renameSong(id: string, title: string): void {
    const songs = this.state.songs.map((s) =>
      s.id === id ? { ...s, title: title.trim() || s.title } : s
    );
    this.commit("songs", songs);
  }

  setSongGoal(id: string, goalBpm: number | null): void {
    this.commit("dailyGoals",this.state.dailyGoals.filter(g=>g.songId!==id));
    this.commit(
      "songs",
      this.state.songs.map((s) => (s.id === id ? { ...s, goalBpm } : s))
    );
  }

  /** Hard delete a song with all of its history. */
  deleteSong(id: string): void {
    this.commit("milestones",this.state.milestones.filter(m=>m.songId!==id));
    this.commit("studyResults",this.state.studyResults.filter(m=>m.songId!==id));
    this.commit("dailyGoals",this.state.dailyGoals.filter(m=>m.songId!==id));
    const sheets = this.state.sheets.filter((sh) => sh.songId === id);
    sheets.forEach((sh) => this.removeBlob(sh.id));
    this.commit("sheets", this.state.sheets.filter((sh) => sh.songId !== id));
    this.commit("songs", this.state.songs.filter((s) => s.id !== id));
    this.commit("events", this.state.events.filter((e) => e.songId !== id));
    this.commit(
      "practices",
      this.state.practices.filter((p) => p.songId !== id)
    );
    this.commit("sessions", this.state.sessions.filter((x) => x.songId !== id));
  }

  /* ---------- BPM tracking (always on for song-tracked metronome) ---------- */

  private setSongLastBpm(songId: string, bpm: number): void {
    this.commit(
      "songs",
      this.state.songs.map((s) => (s.id === songId ? { ...s, lastBpm: bpm } : s))
    );
  }

  /**
   * Record that the user engaged a song's metronome at `bpm`. Records an event
   * unless the identical BPM was recorded less than 5 minutes ago (so restarting
   * the metronome at the same tempo does not spam the history).
   */
  songMetroEvent(songId: string, bpm: number, at = Date.now()): void {
    const song = this.songById(songId);
    if (!song) return;
    const last = this.lastEventFor(songId);
    const dup =
      !!last && last.bpm === bpm && at - last.at < 5 * 60 * 1000;
    if (!dup) {
      const ev: BpmEvent = { id: uid("evt"), songId, at, bpm };
      this.commit("events", [...this.state.events, ev]);
    }
    this.setSongLastBpm(songId, bpm);
  }

  /** Accumulate practice seconds for a song on a calendar day. */
  addPracticeSeconds(songId: string, seconds: number, at = Date.now()): void {
    if (seconds <= 0) return;
    const date = localDayKey(at);
    const key = `${songId}::${date}`;
    const existing = this.state.practices.find((p) => p.id === key);
    if (existing) {
      this.commit(
        "practices",
        this.state.practices.map((p) =>
          p.id === key
            ? { ...p, seconds: p.seconds + seconds, updatedAt: at }
            : p
        )
      );
    } else {
      const row: PracticeDay = { id: key, songId, date, seconds, updatedAt: at };
      this.commit("practices", [...this.state.practices, row]);
    }
  }

  /* ---------- Study sessions (optional, explicit) ---------- */

  async recordPixelSession(id: string, songId: string, start: number, seconds: number): Promise<void> {
    // Stable session id makes recovery idempotent if the app closes at completion.
    if (this.state.sessions.some((s) => s.id === id) || !this.songById(songId)) return;
    const bpm = this.songById(songId)?.lastBpm ?? null;
    this.addPracticeSeconds(songId, seconds);
    this.commit("sessions", [...this.state.sessions, { id, songId, start, end: Date.now(), activeSeconds: seconds, startBpm: bpm, finalBpm: bpm }]);
    await this.writeQueue;
  }

  startSession(songId: string): StudySession | null {
    const song = this.songById(songId);
    if (!song) return null;
    const existing = this.state.sessions.find(
      (x) => x.songId === songId && x.end === null
    );
    if (existing) return existing;
    const session: StudySession = {
      id: uid("ses"),
      songId,
      start: Date.now(),
      end: null,
      startBpm: song.lastBpm,
      finalBpm: null,
    };
    this.commit("sessions", [...this.state.sessions, session]);
    return session;
  }

  endSession(sessionId: string): void {
    const sessions = this.state.sessions.map((x) => {
      if (x.id !== sessionId || x.end !== null) return x;
      const song = this.songById(x.songId);
      return { ...x, end: Date.now(), finalBpm: song?.lastBpm ?? x.finalBpm };
    });
    this.commit("sessions", sessions);
  }

  deleteSession(sessionId: string): void {
    this.commit(
      "sessions",
      this.state.sessions.filter((x) => x.id !== sessionId)
    );
  }

  /* ---------- Sheet music (images / PDF) ---------- */

  async addSheet(songId: string, file: File): Promise<SheetMeta | null> {
    const song = this.songById(songId);
    if (!song) return null;
    const kind: SheetKind = file.type === "application/pdf" ? "pdf" : "image";
    const meta: SheetMeta = {
      id: uid("sht"),
      songId,
      name: file.name,
      kind,
      createdAt: Date.now(),
      size: file.size,
    };
    this.persistBlob(meta.id, file);
    this.commit("sheets", [meta, ...this.state.sheets]);
    return meta;
  }

  deleteSheet(sheetId: string): void {
    this.removeBlob(sheetId);
    this.commit(
      "sheets",
      this.state.sheets.filter((s) => s.id !== sheetId)
    );
  }

  /* ---------- String changes ---------- */

  async addStringChange(input: {
    changeDate: string;
    brand: string;
    notes?: string;
    mood: StringChange["mood"];
    image?: File | null;
  }): Promise<StringChange> {
    const imageId = input.image ? uid("img") : null;
    if (input.image && imageId) this.persistBlob(imageId, input.image);
    const rec: StringChange = {
      id: uid("str"),
      changeDate: input.changeDate,
      brand: input.brand.trim(),
      notes: (input.notes ?? "").trim(),
      mood: input.mood,
      imageId,
      createdAt: Date.now(),
    };
    this.commit("stringChanges", [rec, ...this.state.stringChanges]);
    return rec;
  }

  /** Update a string change. `patch.image`: undefined keeps it, a File replaces
   *  it, null removes it. */
  async updateStringChange(
    id: string,
    patch: {
      changeDate?: string;
      brand?: string;
      notes?: string;
      mood?: StringChange["mood"];
      image?: File | null;
    }
  ): Promise<void> {
    const existing = this.state.stringChanges.find((c) => c.id === id);
    if (!existing) return;
    let imageId = existing.imageId;
    if (patch.image !== undefined) {
      if (patch.image) {
        const nid = uid("img");
        this.persistBlob(nid, patch.image);
        if (existing.imageId) this.removeBlob(existing.imageId);
        imageId = nid;
      } else if (existing.imageId) {
        this.removeBlob(existing.imageId);
        imageId = null;
      }
    }
    const next: StringChange = {
      ...existing,
      changeDate: patch.changeDate ?? existing.changeDate,
      brand: (patch.brand ?? existing.brand).trim() || existing.brand,
      notes: (patch.notes ?? existing.notes).trim(),
      mood: patch.mood ?? existing.mood,
      imageId,
    };
    this.commit(
      "stringChanges",
      this.state.stringChanges.map((c) => (c.id === id ? next : c))
    );
  }

  deleteStringChange(id: string): void {
    const existing = this.state.stringChanges.find((c) => c.id === id);
    if (existing?.imageId) this.removeBlob(existing.imageId);
    this.commit(
      "stringChanges",
      this.state.stringChanges.filter((c) => c.id !== id)
    );
  }

  /* ---------- Allena l'Orecchio (unico strumento con tracker) ---------- */

  /** Registra una risposta. Il Diario la mostra insieme al resto dell'attivita. */
  addEarAnswer(input: {
    mode: EarMode;
    answer: string;
    expected: string;
    ms: number;
    detail?: string;
  }): EarAnswer {
    const rec: EarAnswer = {
      id: uid("ear"),
      mode: input.mode,
      answer: input.answer,
      expected: input.expected,
      correct: input.answer === input.expected,
      ms: Math.max(0, Math.round(input.ms)),
      at: Date.now(),
      detail: input.detail,
    };
    this.commit("earAnswers", [...this.state.earAnswers, rec]);
    return rec;
  }

  clearEarAnswers(): void {
    this.commit("earAnswers", []);
  }

  /* ---------- Allena Armonie: preferiti ---------- */

  addProgressionFav(input: {
    name: string;
    keyPc: number;
    minor: boolean;
    character: string;
    degrees: string[];
    chords: string[];
    bpm: number;
  }): ProgressionFav {
    const rec: ProgressionFav = {
      id: uid("prg"),
      name: input.name.trim() || "Progressione",
      keyPc: input.keyPc,
      minor: input.minor,
      character: input.character,
      degrees: [...input.degrees],
      chords: [...input.chords],
      bpm: input.bpm,
      createdAt: Date.now(),
    };
    this.commit("progressionFavs", [rec, ...this.state.progressionFavs]);
    return rec;
  }

  deleteProgressionFav(id: string): void {
    this.commit(
      "progressionFavs",
      this.state.progressionFavs.filter((p) => p.id !== id)
    );
  }

  saveMilestone(m: Milestone): void {
    const rest=this.state.milestones.filter(x=>x.id!==m.id && (!m.songId || x.songId!==m.songId));
    this.commit("milestones",[...rest,m]);
    if(m.songId)this.commit("dailyGoals",this.state.dailyGoals.filter(x=>x.songId!==m.songId));
  }
  deleteMilestone(id:string): void {
    const m=this.state.milestones.find(x=>x.id===id);
    this.commit("milestones",this.state.milestones.filter(x=>x.id!==id));
    if(m?.songId)this.commit("dailyGoals",this.state.dailyGoals.filter(x=>x.songId!==m.songId));
  }
  todayGoal(songId:string) {
    const date=dayKey(),existing=this.state.dailyGoals.find(g=>g.songId===songId&&g.date===date);
    if(existing)return existing;
    const m=this.state.milestones.find(x=>x.songId===songId),song=this.songById(songId);
    if(!m||m.tempoGoal===false||!song||song.goalBpm===null)return null;
    const p=plan(m,song.goalBpm,bestFor(songId,this.state.studyResults),this.state.settings.studyDays??[0,1,2,3,4,5,6],date);
    if(!p.scheduled||p.complete||p.completion===null)return null;
    const goal={id:`${songId}::${date}`,songId,date,from:p.from,target:p.target,path:m.path};
    this.commit("dailyGoals",[...this.state.dailyGoals.filter(g=>g.date>=date),goal]);
    return goal;
  }
  recordStudyResult(songId:string,bpm:number,seconds:number,at=Date.now()): void {
    if(seconds<30||!this.songById(songId)||!Number.isFinite(bpm))return;
    const date=dayKey(new Date(at)),id=`${songId}::${date}::${bpm}`;
    if(this.state.studyResults.some(r=>r.id===id))return;
    this.commit("studyResults",[...this.state.studyResults,{id,songId,date,bpm,seconds,at}]);
  }

  /* ---------- Settings ---------- */

  updateSettings(patch: Partial<Settings>): void {
    const next: Settings = {
      ...this.state.settings,
      ...patch,
      appearance: {
        ...this.state.settings.appearance,
        ...(patch.appearance ?? {}),
        skin: "liquidglass",
        skinRevision: 2,
      },
      metro: { ...this.state.settings.metro, ...(patch.metro ?? {}) },
      reminder: { ...this.state.settings.reminder, ...(patch.reminder ?? {}) },
    };
    if(patch.studyDays)this.commit("dailyGoals",[]);
    this.commit("settings", next);
  }

  setTab(tab: string): void {
    if (this.state.settings.lastTab === tab) return;
    this.updateSettings({ lastTab: tab });
  }

  /** Wipe everything (all songs, history, blobs) and reset settings. */
  async resetAll(): Promise<void> {
    const {removePush}=await import("../study/notifications");
    await removePush().catch(()=>undefined);
    pixel.reset();
    this.writeQueue = this.writeQueue.then(() => idbClear().catch(() => undefined));
    this.state = emptyState();
    this.emit();
    await this.writeQueue;
  }
}

/** Singleton store — pure local persistence, no backend. */
export const store = new Store();

/** React hook: re-renders the component on any store change. */
export function useStore(): DBState {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => store.subscribe(tick), []);
  return store.state;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function reminderDue(state: DBState, now = Date.now()): number | null {
  const s = state.settings.reminder;
  if (!s.enabled) return null;
  const latest = [...state.stringChanges].sort((a, b) =>
    b.changeDate.localeCompare(a.changeDate)
  )[0];
  if (!latest) return null;
  const d = new Date(latest.changeDate);
  const changeTs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dueTs = changeTs + s.days * DAY_MS;
  if (now < dueTs) return null;
  // Return how many days the strings have actually been mounted (>= interval),
  // so the banner shows e.g. "sono passati 60 giorni" when the interval is 45.
  return Math.max(s.days, Math.floor((now - changeTs) / DAY_MS));
}

export const reminderTargetDate = (state: DBState): string | null => {
  const s = state.settings.reminder;
  const latest = [...state.stringChanges].sort((a, b) =>
    b.changeDate.localeCompare(a.changeDate)
  )[0];
  if (!latest || !s.enabled) return null;
  const d = new Date(latest.changeDate);
  const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const due = ts + s.days * DAY_MS;
  return localDayKey(due);
};

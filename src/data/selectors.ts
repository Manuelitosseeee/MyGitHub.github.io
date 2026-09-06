import type { DBState, Song, BpmEvent } from "./types";
import { localDayKey } from "../lib/time";

export interface BpmPoint {
  bpm: number;
  at: number;
}

export interface SongDayEntry {
  songId: string;
  title: string;
  date: string;
  seconds: number;
  bpmPath: BpmPoint[];
  goalBpm: number | null;
  lastBpm: number | null;
  bestBpm: number;
}

export interface DayEntry {
  date: string;
  entries: SongDayEntry[];
  totalSeconds: number;
  songCount: number;
}

export function songBestBpm(events: BpmEvent[], songId: string): number | null {
  let best = 0;
  for (const e of events) {
    if (e.songId === songId && e.bpm > best) best = e.bpm;
  }
  return best > 0 ? best : null;
}

/** BPM events of a song within one day, chronological. */
export function bpmPathForDay(
  events: BpmEvent[],
  songId: string,
  date: string
): BpmPoint[] {
  const pts: BpmPoint[] = [];
  for (const e of events) {
    if (e.songId !== songId) continue;
    if (localDayKey(e.at) !== date) continue;
    const last = pts[pts.length - 1];
    if (last && last.bpm === e.bpm && e.at - last.at < 5 * 60 * 1000) continue;
    pts.push({ bpm: e.bpm, at: e.at });
  }
  pts.sort((a, b) => a.at - b.at);
  return pts;
}

export function secondsForDay(
  practices: DBState["practices"],
  songId: string,
  date: string
): number {
  let s = 0;
  for (const p of practices) {
    if (p.songId === songId && p.date === date) s += p.seconds;
  }
  return Math.round(s);
}

/** Every day (newest first) with per-song practice summaries. */
export function buildDays(state: DBState): DayEntry[] {
  const byDate = new Map<string, Map<string, SongDayEntry>>();
  const ensure = (date: string, song: Song) => {
    let songs = byDate.get(date);
    if (!songs) {
      songs = new Map();
      byDate.set(date, songs);
    }
    let entry = songs.get(song.id);
    if (!entry) {
      entry = {
        songId: song.id,
        title: song.title,
        date,
        seconds: 0,
        bpmPath: [],
        goalBpm: song.goalBpm,
        lastBpm: song.lastBpm,
        bestBpm: 0,
      };
      songs.set(song.id, entry);
    }
    return entry;
  };

  for (const e of state.events) {
    const song = state.songs.find((s) => s.id === e.songId);
    if (!song) continue;
    const date = localDayKey(e.at);
    const entry = ensure(date, song);
    entry.bpmPath.push({ bpm: e.bpm, at: e.at });
    if (e.bpm > entry.bestBpm) entry.bestBpm = e.bpm;
  }
  for (const p of state.practices) {
    const song = state.songs.find((s) => s.id === p.songId);
    if (!song) continue;
    const entry = ensure(p.date, song);
    entry.seconds += p.seconds;
  }

  const days: DayEntry[] = [];
  for (const [date, songs] of byDate) {
    const entries = [...songs.values()]
      .map((e) => ({
        ...e,
        seconds: Math.round(e.seconds),
        bpmPath: e.bpmPath
          .slice()
          .sort((a, b) => a.at - b.at)
          .filter((p, i, arr) => i === 0 || p.bpm !== arr[i - 1].bpm || p.at - arr[i - 1].at >= 5 * 60 * 1000),
      }))
      .filter((e) => e.bpmPath.length > 0 || e.seconds > 0)
      .sort((a, b) => {
        const ta = a.bpmPath[0]?.at ?? 0;
        const tb = b.bpmPath[0]?.at ?? 0;
        return tb - ta;
      });
    if (entries.length === 0) continue;
    days.push({
      date,
      entries,
      totalSeconds: entries.reduce((a, e) => a + e.seconds, 0),
      songCount: entries.length,
    });
  }
  days.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return days;
}

export interface ProgressInfo {
  best: number | null;
  last: number | null;
  goal: number | null;
  /** 0..1 progress of best toward goal (null when no goal). */
  pct: number | null;
  remaining: number | null; // bpm left from last practiced to goal
}

export function progressForSong(song: Song, events: BpmEvent[]): ProgressInfo {
  const best = songBestBpm(events, song.id);
  const goal = song.goalBpm;
  const last = song.lastBpm;
  const pct =
    goal && best !== null ? Math.min(1, Math.max(0, best / goal)) : null;
  const remaining = goal !== null && last !== null ? goal - last : null;
  return { best, last, goal, pct, remaining };
}

export function songMinutesPracticed(
  practices: DBState["practices"],
  songId: string
): number {
  let s = 0;
  for (const p of practices) if (p.songId === songId) s += p.seconds;
  return Math.round(s / 60);
}

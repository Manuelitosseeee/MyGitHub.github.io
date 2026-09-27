import type { DBState, EarAnswer, EarMode } from "./types";
import { localDayKey } from "../lib/time";

/** Statistiche per una modalità dell'Allenamento Orecchio. */
export interface EarModeStats {
  mode: EarMode;
  label: string;
  total: number;
  correct: number;
  /** Percentuale 0..100 di risposte corrette. */
  percent: number;
  /** Tempo medio di risposta in secondi. */
  avgSeconds: number;
  /** Errori più frequenti, dal più comune. */
  mistakes: Array<{ label: string; count: number }>;
  /** Progressi sugli ultimi 20 esercizi, dal più recente. */
  recent: boolean[];
}

export const EAR_MODE_LABEL: Record<EarMode, string> = {
  intervalli: "Intervalli",
  accordi: "Accordi",
  progressioni: "Progressioni",
};

const MODES: EarMode[] = ["intervalli", "accordi", "progressioni"];

function statsFor(mode: EarMode, all: EarAnswer[]): EarModeStats {
  const rows = all.filter((a) => a.mode === mode);
  const correct = rows.filter((a) => a.correct).length;
  const totalMs = rows.reduce((s, a) => s + a.ms, 0);
  const counts = new Map<string, number>();
  for (const a of rows) {
    if (a.correct) continue;
    // Si registra l'errore in forma leggibile: "risposta (giusto: X)".
    const key = a.expected;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const mistakes = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  return {
    mode,
    label: EAR_MODE_LABEL[mode],
    total: rows.length,
    correct,
    percent: rows.length ? Math.round((correct / rows.length) * 100) : 0,
    avgSeconds: rows.length ? Math.round(totalMs / rows.length / 100) / 10 : 0,
    mistakes,
    recent: rows
      .slice(-20)
      .map((a) => a.correct)
      .reverse(),
  };
}

export function earStats(state: DBState): EarModeStats[] {
  return MODES.map((m) => statsFor(m, state.earAnswers));
}

/** Riepilogo complessivo, mostrato in cima allo strumento e nel Diario. */
export interface EarSummary {
  total: number;
  correct: number;
  percent: number;
  avgSeconds: number;
  /** Ultimi 7 giorni con almeno una risposta, dal più recente. */
  days: Array<{ date: string; total: number; correct: number }>;
}

export function earSummary(state: DBState): EarSummary {
  const all = state.earAnswers;
  const correct = all.filter((a) => a.correct).length;
  const totalMs = all.reduce((s, a) => s + a.ms, 0);
  const byDay = new Map<string, { total: number; correct: number }>();
  for (const a of all) {
    const d = localDayKey(a.at);
    const row = byDay.get(d) ?? { total: 0, correct: 0 };
    row.total++;
    if (a.correct) row.correct++;
    byDay.set(d, row);
  }
  const days = [...byDay.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 7);
  return {
    total: all.length,
    correct,
    percent: all.length ? Math.round((correct / all.length) * 100) : 0,
    avgSeconds: all.length ? Math.round(totalMs / all.length / 100) / 10 : 0,
    days,
  };
}

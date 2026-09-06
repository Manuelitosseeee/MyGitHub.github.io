/** Local-date helpers. All grouping is by device-local calendar day. */

const DAY_MS = 24 * 60 * 60 * 1000;

export function localDayKey(ts: number): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function todayKey(): string {
  return localDayKey(Date.now());
}

/** Start-of-day timestamp (local) for a day key. */
export function dayStart(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function addDays(dayKey: string, n: number): string {
  return localDayKey(dayStart(dayKey) + n * DAY_MS);
}

/** Number of whole days between a past date and now (positive if past). */
export function daysSince(dayKey: string, now = Date.now()): number {
  const start = dayStart(dayKey);
  if (now < start) return 0;
  return Math.floor((now - start) / DAY_MS);
}

export function formatDateIT(tsOrKey: number | string): string {
  const d =
    typeof tsOrKey === "string" ? new Date(dayStart(tsOrKey)) : new Date(tsOrKey);
  return d.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

export function formatDateShortIT(tsOrKey: number | string): string {
  const d =
    typeof tsOrKey === "string" ? new Date(dayStart(tsOrKey)) : new Date(tsOrKey);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

export function formatTimeIT(ts: number): string {
  return new Date(ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m}′ ${String(r).padStart(2, "0")}″` : `${m}′`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}′`;
}

export function formatDurationClock(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const h = Math.floor(m / 60);
  return h > 0
    ? `${h}:${String(m % 60).padStart(2, "0")}:${String(r).padStart(2, "0")}`
    : `${m}:${String(r).padStart(2, "0")}`;
}

export function isToday(dayKey: string): boolean {
  return dayKey === todayKey();
}

export function relativeDayLabel(dayKey: string): string {
  const today = todayKey();
  if (dayKey === today) return "Oggi";
  if (dayKey === addDays(today, -1)) return "Ieri";
  return formatDateIT(dayKey);
}

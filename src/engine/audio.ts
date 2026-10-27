/** Shared AudioContext manager. Created lazily (must follow a user gesture). */

type Ctor = typeof AudioContext;

function getCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** iOS: media playback must not follow the Ring/Silent switch. Feature
 * detection keeps older browsers working; never request microphone access. */
export function configurePlaybackSession(): void {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch { /* HTML audio retains its normal playback category as fallback. */ }
}

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = getCtor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

export async function ensureRunning(): Promise<boolean> {
  const c = getAudioContext();
  if (!c) return false;
  if (c.state !== "running") {
    try {
      await c.resume();
    } catch {
      return false;
    }
  }
  return c.state === "running";
}

export function suspendContext(): void {
  if (ctx && ctx.state === "running") {
    ctx.suspend().catch(() => undefined);
  }
}

/** Best-effort screen wake lock while the metronome plays. */
export async function requestWakeLock(): Promise<{ release: () => void } | null> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => void }> };
    };
    if (!nav.wakeLock) return null;
    const lock = await nav.wakeLock.request("screen");
    return lock;
  } catch {
    return null;
  }
}

/**
 * App updates.
 *
 * The service worker never swaps itself in: a new version is downloaded in the
 * background and stays "waiting" until the user explicitly applies it, so the
 * app (and a running metronome) is never interrupted mid-session.
 */

let notify: (() => void) | null = null;
let applying = false;

/** Registers listeners and returns the unsubscribe function. */
export function watchForUpdates(onChange: () => void): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return () => undefined;
  }
  notify = onChange;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Only reload when *we* asked for the update; otherwise the new worker
    // took control silently and the current session must continue untouched.
    if (applying) window.location.reload();
  });

  void navigator.serviceWorker
    .getRegistration()
    .then((reg) => {
      onChange();
      // A worker may already be waiting from a previous session.
      if (reg?.waiting) onChange();
    })
    .catch(() => undefined);

  const onVisible = () => {
    if (document.visibilityState === "visible") void checkForUpdate();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onVisible);

  return () => {
    if (notify === onChange) notify = null;
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onVisible);
  };
}

/** True when a downloaded version is ready but not yet applied. */
export function hasPendingUpdate(): boolean {
  return !!navigator.serviceWorker?.controller && !!pending;
}

let pending: ServiceWorker | null = null;

/** Asks the browser to look for a new version (cheap, network permitting). */
export async function checkForUpdate(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    await reg.update();
    if (reg.waiting) {
      pending = reg.waiting;
      notify?.();
    }
  } catch {
    /* offline: nothing to check */
  }
}

/** Applies the waiting version and reloads once it has taken control. */
export function applyUpdate(): void {
  const waiting = pending;
  if (!waiting) {
    void checkForUpdate();
    return;
  }
  applying = true;
  pending = null;
  notify?.();
  waiting.postMessage("SKIP_WAITING");
  // Safety net in case controllerchange is not delivered.
  window.setTimeout(() => {
    if (applying) window.location.reload();
  }, 1500);
}

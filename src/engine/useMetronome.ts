import { useCallback, useEffect, useRef, useState } from "react";
import {
  MetronomeEngine,
  acquireExclusive,
  releaseExclusive,
  type MetronomeConfig,
} from "./metronome";
import { ensureRunning } from "./audio";

export interface BeatFlash {
  beat: number; // beat index within the bar that just sounded
  accent: boolean;
  key: number; // increments each beat (for CSS animation retrigger)
}

/**
 * Owns a lazily-created metronome engine. Starting it takes over the audio
 * exclusive slot app-wide (stops any other running metronome, which notifies
 * its owner through onExternalStop).
 */
export function useMetronome(
  kind: string,
  buildConfig: () => MetronomeConfig
): {
  running: boolean;
  flash: BeatFlash | null;
  start: () => Promise<boolean>;
  stop: () => void;
  engine: MetronomeEngine | null;
} {
  const engineRef = useRef<MetronomeEngine | null>(null);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState<BeatFlash | null>(null);
  const buildRef = useRef(buildConfig);
  buildRef.current = buildConfig;
  const flashKey = useRef(0);
  const wakeRef = useRef<{ release: () => void } | null>(null);

  useEffect(() => {
    return () => {
      const e = engineRef.current;
      if (e) {
        if (e.running) e.stop();
        releaseExclusive(e);
      }
      wakeRef.current?.release();
    };
  }, []);

  const start = useCallback(async () => {
    let engine = engineRef.current;
    if (!engine) {
      engine = new MetronomeEngine(kind, buildRef.current());
      engineRef.current = engine;
      engine.onExternalStop = () => {
        setRunning(false);
        wakeRef.current?.release();
        wakeRef.current = null;
      };
      engine.onTick = (t) => {
        if (t.sub === 0) {
          flashKey.current++;
          setFlash({
            beat: t.beat,
            accent: t.weight === 2 || t.beat === 0,
            key: flashKey.current,
          });
        }
      };
    }
    acquireExclusive(engine);
    const ok = await ensureRunning();
    if (!ok) return false;
    if (!engine.start()) return false;
    setRunning(true);
    if (!wakeRef.current) {
      requestWakeLockSilently(wakeRef);
    }
    return true;
  }, [kind]);

  const stop = useCallback(() => {
    const e = engineRef.current;
    if (e && e.running) e.stop();
    wakeRef.current?.release();
    wakeRef.current = null;
    setRunning(false);
  }, []);

  return { running, flash, start, stop, engine: engineRef.current };
}

async function requestWakeLockSilently(
  ref: { current: { release: () => void } | null }
): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => void }> };
    };
    if (!nav.wakeLock) return;
    const lock = await nav.wakeLock.request("screen");
    ref.current = lock;
  } catch {
    /* not available — fine */
  }
}

/** Live practice-seconds accumulator for a running engine. Calls onSeconds
 *  with whole seconds every ~1s and flushes the remainder on stop/unmount. */
export function useRunClock(
  running: boolean,
  onSeconds: (s: number) => void,
  onStopFlush?: (s: number) => void
): void {
  const cbRef = useRef({ onSeconds, onStopFlush });
  cbRef.current = { onSeconds, onStopFlush };
  const accRef = useRef(0);
  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const t = window.setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      accRef.current += dt;
      const whole = Math.floor(accRef.current);
      if (whole >= 1) {
        accRef.current -= whole;
        cbRef.current.onSeconds(whole);
      }
    }, 1000);
    return () => {
      window.clearInterval(t);
      const dt = (Date.now() - last) / 1000;
      const total = accRef.current + dt;
      accRef.current = 0;
      if (total > 0.3) cbRef.current.onStopFlush?.(Math.round(total * 100) / 100);
    };
  }, [running]);
}

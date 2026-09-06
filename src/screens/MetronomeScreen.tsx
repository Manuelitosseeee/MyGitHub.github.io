import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Plus, Minus, Volume2 } from "lucide-react";
import { useStore, store } from "../data/store";
import { useMetronome } from "../engine/useMetronome";
import type { MetronomeConfig, BeatWeight, MetroSound, Subdivision } from "../engine/metronome";
import { BpmSlider, HoldBtn, SectionTitle, Card, toast } from "../ui/primitives";
import { BeatDots } from "./studio/SongScreen";
import { cx, clamp } from "../lib/utils";

const MIN = 20;
const MAX = 400;

/* Set by the Aspetto Totale skins (skins.css); falls back to the classic
   dark-blue stage when no skin overrides it. */
const STAGE_GRADIENT = "var(--stage-bg)";

const SOUNDS: Array<{ id: MetroSound; label: string }> = [
  { id: "classic", label: "Legno" },
  { id: "digital", label: "Digitale" },
  { id: "metallic", label: "Metallo" },
];

const SUBS: Array<{ id: Subdivision; label: string }> = [
  { id: "none", label: "Semplice" },
  { id: "eighth", label: "Ottavi" },
  { id: "triplet", label: "Terzine" },
  { id: "sixteenth", label: "Sedicesimi" },
];

export default function MetronomeScreen() {
  const st = useStore();
  const p = st.settings.metro;
  const [bpm, setBpmState] = useState(p.bpm);
  const [weights, setWeights] = useState<BeatWeight[]>([...p.weights]);
  const [sub, setSub] = useState<Subdivision>(p.subdivision);
  const [sound, setSound] = useState<MetroSound>(p.sound);
  const [volume, setVolume] = useState(p.volume);
  const met = useMetronome("standard", () => makeCfg(bpm, weights, sub, sound, volume));
  const running = met.running;
  const commitTimer = useDebounceCommit();

  const persist = (patch: Partial<typeof p>) => {
    store.updateSettings({ metro: { ...st.settings.metro, ...patch } });
  };

  const setBpm = (v: number, opts?: { commit?: boolean }) => {
    const nv = clamp(Math.round(v), MIN, MAX);
    setBpmState(nv);
    met.engine?.setBpm(nv);
    if (opts?.commit) {
      commitTimer(() => {
        persist({ bpm: nv });
      });
    }
  };

  const setWeightsSafe = (w: BeatWeight[]) => {
    setWeights(w);
    met.engine?.update({ weights: w });
    persist({ weights: w, beats: w.length });
  };

  const setSubSafe = (s: Subdivision) => {
    setSub(s);
    met.engine?.update({ subdivision: s });
    persist({ subdivision: s });
  };

  const start = async () => {
    const ok = await met.start();
    if (!ok) toast("Avvia l'audio: controlla che il volume non sia muto");
  };

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <div className="screen-title">Metronomo</div>
      <p className="screen-sub">
        Metronomo standard, del tutto indipendente dallo Studio: non registra e
        non modifica nulla nei tuoi brani.
      </p>

      <Card>
        <MetroStage
          bpm={bpm}
          weights={weights}
          running={running}
          flash={met.flash}
          timeSig={`${weights.length}/4`}
        />
        <div style={{ padding: "10px 16px 14px" }}>
          <div className="stepper-wrap">
            <HoldBtn
              className="step-btn"
              onPress={() => setBpm(bpm - 1, { commit: true })}
              disabled={bpm <= MIN}
              label="Rallenta"
            >
              <Minus />
            </HoldBtn>
            <BpmSlider
              value={bpm}
              min={MIN}
              max={MAX}
              onChange={(v) => setBpm(v)}
              onChangeEnd={() => setBpm(bpm, { commit: true })}
            />
            <HoldBtn
              className="step-btn"
              onPress={() => setBpm(bpm + 1, { commit: true })}
              disabled={bpm >= MAX}
              label="Accelera"
            >
              <Plus />
            </HoldBtn>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 10 }}>
            <button
              className={cx("play-fab", running && "is-playing")}
              onClick={() => (running ? met.stop() : void start())}
              aria-label={running ? "Ferma" : "Avvia"}
            >
              {running ? <Square /> : <Play />}
            </button>
          </div>
        </div>
      </Card>

      <SectionTitle>Suddivisione</SectionTitle>
      <Card className="card-pad">
        <div className="chip-row">
          {SUBS.map((s) => (
            <button
              key={s.id}
              className={cx("chip", sub === s.id && "on")}
              onClick={() => setSubSafe(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="tiny text3" style={{ marginTop: 8 }}>
          Le suddivisioni aggiungono colpi leggeri tra un battito e l'altro.
        </p>
      </Card>

      <SectionTitle>Pattern ritmico</SectionTitle>
      <Card className="card-pad">
        <div className="text3 tiny" style={{ marginBottom: 8 }}>
          Battiti per battuta
        </div>
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              className={cx("chip", weights.length === n && "on")}
              onClick={() => setWeightsSafe(resizeWeights(weights, n))}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="text3 tiny" style={{ marginBottom: 8 }}>
          Tocca ogni battito per cambiarlo: <b>—</b> silenzio, <b>•</b> tempo,{" "}
          <b>●</b> accento
        </div>
        <div className="pgrid" style={{ marginBottom: 12 }}>
          {weights.map((w, i) => (
            <button
              key={i}
              className={cx("pcell", `st${w}`)}
              onClick={() => {
                const next: BeatWeight[] = [...weights];
                next[i] = next[i] === 0 ? 1 : next[i] === 1 ? 2 : 0;
                setWeightsSafe(next);
              }}
            >
              {w === 0 ? "—" : w === 1 ? "•" : "●"}
            </button>
          ))}
        </div>
        <div className="text3 tiny" style={{ marginBottom: 6 }}>
          Preset
        </div>
        <div className="chip-row">
          <button className="chip" onClick={() => setWeightsSafe([2, 1, 1, 1])}>
            4/4
          </button>
          <button className="chip" onClick={() => setWeightsSafe([2, 1, 1])}>
            Valzer 3/4
          </button>
          <button className="chip" onClick={() => setWeightsSafe([2, 1])}>
            Marcia 2/4
          </button>
          <button className="chip" onClick={() => setWeightsSafe([2, 1, 1, 1, 1, 1])}>
            6/8
          </button>
          <button className="chip" onClick={() => setWeightsSafe([2, 0, 1, 0])}>
            Sincope
          </button>
        </div>
        <p className="tiny text3" style={{ marginTop: 10 }}>
          I pattern personalizzati si salvano e restano disponibili alla riapertura.
        </p>
      </Card>

      <SectionTitle>Suono</SectionTitle>
      <Card className="card-pad">
        <div className="chip-row" style={{ marginBottom: 10 }}>
          {SOUNDS.map((s) => (
            <button
              key={s.id}
              className={cx("chip", sound === s.id && "on")}
              onClick={() => {
                setSound(s.id);
                met.engine?.update({ sound: s.id });
                persist({ sound: s.id });
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Volume2 size={18} className="text3" />
          <div style={{ flex: 1 }}>
            <BpmSlider
              value={Math.round(volume * 100)}
              min={0}
              max={100}
              onChange={(v) => {
                const vol = v / 100;
                setVolume(vol);
                met.engine?.update({ volume: vol });
              }}
              onChangeEnd={() => {
                met.engine?.update({ volume });
                persist({ volume });
              }}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

function MetroStage({
  bpm,
  weights,
  running,
  flash,
  timeSig,
}: {
  bpm: number;
  weights: BeatWeight[];
  running: boolean;
  flash: { beat: number; key: number; accent: boolean } | null;
  timeSig?: string;
}) {
  return (
    <div
      className="metro-stage"
      style={{ background: STAGE_GRADIENT, margin: 0, borderRadius: 0, boxShadow: "none" }}
    >
      <div className="tiny" style={{ fontWeight: 700, opacity: 0.55, letterSpacing: 1 }}>
        {timeSig ?? `${weights.length}/4`}
      </div>
      <div className="tempo-num">{bpm}</div>
      <div className="tempo-unit">BPM</div>
      <BeatDots flash={flash} beats={weights.length} weights={weights} running={running} />
      <div className="tap-hint">
        {running ? "in esecuzione" : "premi play per avviare"}
      </div>
    </div>
  );
}



function resizeWeights(weights: BeatWeight[], n: number): BeatWeight[] {
  if (n === weights.length) return [...weights];
  const out: BeatWeight[] = [];
  for (let i = 0; i < n; i++) {
    out.push(i < weights.length ? weights[i] : i === 0 ? 2 : 1);
  }
  return out;
}

function makeCfg(
  bpm: number,
  weights: BeatWeight[],
  subdivision: Subdivision,
  sound: MetroSound,
  volume: number
): MetronomeConfig {
  return { bpm, weights, subdivision, sound, volume };
}

function useDebounceCommit(): (fn: () => void) => void {
  const timer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);
  return useCallback((fn: () => void) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      fn();
    }, 700);
  }, []);
}

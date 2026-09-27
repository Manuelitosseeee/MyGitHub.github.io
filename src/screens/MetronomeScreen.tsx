import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  Music2,
  Play,
  Plus,
  Minus,
  Square,
  Volume2,
} from "lucide-react";
import { useStore, store } from "../data/store";
import { useNav } from "../nav";
import { useMetronome } from "../engine/useMetronome";
import type { MetronomeConfig, BeatWeight, MetroSound, Subdivision } from "../engine/metronome";
import { previewClick } from "../engine/metronome";
import { BpmSlider, HoldBtn, SectionTitle, Card, Switch, toast } from "../ui/primitives";
import { BeatDots } from "./studio/SongScreen";
import { cx, clamp } from "../lib/utils";

const MIN = 20;
const MAX = 400;

/* Each Aspetto Totale design restyles the stage via --stage-bg
   (defined per skin in skins.css; the :root fallback is the classic navy). */
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
  const nav = useNav();
  const p = st.settings.metro;
  const isEssential = st.settings.appearance.skin === "liquidglass";
  const [bpm, setBpmState] = useState(p.bpm);
  const [weights, setWeights] = useState<BeatWeight[]>([...p.weights]);
  const [sub, setSub] = useState<Subdivision>(p.subdivision);
  const [sound, setSound] = useState<MetroSound>(p.sound);
  const [volume, setVolume] = useState(p.volume);
  const met = useMetronome("standard", () => makeCfg(bpm, weights, sub, sound, volume));
  const running = met.running;

  const commitTimer = useDebounceCommit();
  const latestBpm = useRef(bpm);
  latestBpm.current = bpm;

  useEffect(() => {
    if (!running || !p.autoIncrease) return;
    const startedAt = Date.now();
    let lastStep = 0;
    const timer = window.setInterval(() => {
      const dueStep = Math.floor((Date.now() - startedAt) / (p.autoIntervalSeconds * 1000));
      if (dueStep <= lastStep) return;
      const increments = dueStep - lastStep;
      lastStep = dueStep;
      const nextBpm = clamp(latestBpm.current + increments * p.autoBpmStep, MIN, MAX);
      if (nextBpm === latestBpm.current) return;
      latestBpm.current = nextBpm;
      setBpmState(nextBpm);
      met.engine?.setBpm(nextBpm);
      store.updateSettings({ metro: { ...store.state.settings.metro, bpm: nextBpm } });
    }, 250);
    return () => window.clearInterval(timer);
  }, [running, p.autoIncrease, p.autoIntervalSeconds, p.autoBpmStep, met.engine]);

  const updateAuto = (patch: Partial<typeof p>) => persist(patch);

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
    if (!ok) {
      toast("Audio bloccato: tocca lo schermo e riprova");
    } else if (volume <= 0.001) {
      toast("Volume a zero: alzalo con lo slider qui sotto");
    } else {
      persist({ wasRunning: true });
    }
  };

  const stop = () => {
    met.stop();
    persist({ wasRunning: false });
  };

  // A reload (or a platform restart) always stops the audio: offer to resume.
  useEffect(() => {
    if (!p.wasRunning) return;
    persist({ wasRunning: false });
    toast("Il metronomo si era fermato: premi Play per riprenderlo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cx("screen", isEssential && "metro-immersive")} style={{ paddingBottom: isEssential ? 24 : 40 }}>
      {isEssential ? (
        <div className="metro-essential-header">
          <button className="metro-round-button" onClick={() => nav.openTab("diario")} aria-label="Torna al diario">
            <ChevronLeft size={23} />
          </button>
          <h1>Metronomo</h1>
          <span className="metro-header-spacer" aria-hidden="true" />
        </div>
      ) : (
        <>
          <div className="screen-title">Metronomo</div>
          <p className="screen-sub">
            Metronomo standard, del tutto indipendente dallo Studio: non registra e
            non modifica nulla nei tuoi brani.
          </p>
        </>
      )}

      {isEssential ? (
        <section className="metro-essential-stage" aria-label="Controlli del metronomo">
          <div className="metro-essential-meter">
            <button
              className="metro-round-button"
              onClick={() => previewClick(sound, volume > 0.001 ? volume : 0.85)}
              aria-label="Ascolta il suono del metronomo"
              title="Ascolta il suono"
            >
              <Music2 size={21} />
            </button>
            <div className="metro-signature" aria-label={`${weights.length} quarti per battuta`}>
              <span>{weights.length}</span><i>/</i><span>4</span><b>♩</b>
            </div>
            <span className="metro-meter-spacer" aria-hidden="true" />
          </div>

          <div className="metro-beat-pills" aria-label={`${weights.length} battiti`}>
            {weights.map((weight, index) => (
              <span
                key={index}
                className={cx(
                  "metro-beat-pill",
                  index === 0 && "downbeat",
                  weight === 0 && "silent",
                  met.flash?.beat === index && running && "flashing"
                )}
                aria-label={`Battito ${index + 1}${weight === 0 ? ", silenzioso" : weight === 2 ? ", accentato" : ""}`}
              />
            ))}
          </div>

          <div className="metro-tempo-display" aria-live="polite">
            <div className="metro-tempo-number">{bpm}</div>
            <div className="metro-tempo-name">{tempoName(bpm)}</div>
          </div>

          <TempoTicks bpm={bpm} />

          <button
            className={cx("metro-glass-play", running && "is-playing")}
            onClick={() => (running ? stop() : void start())}
            aria-label={running ? "Ferma il metronomo" : "Avvia il metronomo"}
          >
            {running ? <Square size={31} fill="currentColor" /> : <Play size={34} fill="currentColor" />}
          </button>

          <div className="metro-essential-adjust">
            <button
              className="metro-round-button"
              onClick={() => setBpm(bpm - 1, { commit: true })}
              disabled={bpm <= MIN}
              aria-label="Rallenta di un BPM"
            >
              <Minus size={20} />
            </button>
            <div className="metro-essential-range">
              <BpmSlider
                value={bpm}
                min={MIN}
                max={MAX}
                onChange={(value) => setBpm(value)}
                onChangeEnd={() => setBpm(bpm, { commit: true })}
              />
            </div>
            <button
              className="metro-round-button"
              onClick={() => setBpm(bpm + 1, { commit: true })}
              disabled={bpm >= MAX}
              aria-label="Accelera di un BPM"
            >
              <Plus size={20} />
            </button>
          </div>
        </section>
      ) : (
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
                onChange={(value) => setBpm(value)}
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
                onClick={() => (running ? stop() : void start())}
                aria-label={running ? "Ferma" : "Avvia"}
              >
                {running ? <Square /> : <Play />}
              </button>
            </div>
          </div>
        </Card>
      )}

      <div className="metro-options">
      <SectionTitle>Incremento automatico</SectionTitle>
      <Card className="card-pad auto-tempo-card">
        <div className="auto-tempo-heading">
          <div>
            <div className="row-title">Accelerazione graduale</div>
            <div className="row-sub">Aumenta il tempo mentre il metronomo è in esecuzione.</div>
          </div>
          <Switch
            on={p.autoIncrease}
            onChange={(enabled) => updateAuto({ autoIncrease: enabled })}
          />
        </div>
        <div className="auto-tempo-fields">
          <label className="auto-tempo-field">
            <span>Ogni</span>
            <AutoTempoNumberField
              value={p.autoIntervalSeconds}
              min={1}
              max={3600}
              label="Intervallo incremento in secondi"
              onCommit={(value) => updateAuto({ autoIntervalSeconds: value })}
            />
            <span>secondi</span>
          </label>
          <label className="auto-tempo-field">
            <span>Aumenta di</span>
            <AutoTempoNumberField
              value={p.autoBpmStep}
              min={1}
              max={100}
              label="Incremento automatico in BPM"
              onCommit={(value) => updateAuto({ autoBpmStep: value })}
            />
            <span>BPM</span>
          </label>
        </div>
        <p className="tiny text3 auto-tempo-note">
          {p.autoIncrease
            ? `Da ${bpm} BPM: +${p.autoBpmStep} ogni ${p.autoIntervalSeconds} secondi, fino a ${MAX} BPM.`
            : "Attiva per allenare il tempo aumentando i BPM a intervalli regolari."}
        </p>
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
                previewClick(s.id, volume > 0.001 ? volume : 0.85);
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
          <span className="tiny text3" style={{ width: 38, textAlign: "right" }}>
            {Math.round(volume * 100)}%
          </span>
        </div>
        {volume <= 0.001 ? (
          <button
            className="btn btn-ghost"
            style={{ marginTop: 10, width: "100%" }}
            onClick={() => {
              setVolume(0.85);
              met.engine?.update({ volume: 0.85 });
              persist({ volume: 0.85 });
              previewClick(sound, 0.85);
            }}
          >
            <Volume2 size={18} /> Volume a zero: ripristinalo
          </button>
        ) : null}
        <p className="tiny text3" style={{ marginTop: 10 }}>
          Tocca un suono per sentirlo. Se non senti nulla, controlla il interruttore
          silenzioso del telefono: su iPhone l'audio esce solo con la campana attiva.
        </p>
      </Card>
      </div>
    </div>
  );
}

function TempoTicks({ bpm }: { bpm: number }) {
  const active = Math.round(((bpm - MIN) / (MAX - MIN)) * 24);
  return (
    <div className="metro-tempo-ticks" aria-hidden="true">
      {Array.from({ length: 25 }, (_, index) => (
        <span key={index} className={cx(index <= active && "lit", index % 4 === 0 && "major")} />
      ))}
    </div>
  );
}

function tempoName(bpm: number): string {
  return bpm < 60 ? "LARGO" : bpm < 76 ? "ADAGIO" : bpm < 108 ? "ANDANTE" : bpm < 120 ? "MODERATO" : bpm < 168 ? "ALLEGRO" : "PRESTO";
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
      <div className="tempo-name">{bpm < 60 ? "LARGO" : bpm < 76 ? "ADAGIO" : bpm < 108 ? "ANDANTE" : bpm < 120 ? "MODERATO" : bpm < 168 ? "ALLEGRO" : "PRESTO"}</div>
      <BeatDots flash={flash} beats={weights.length} weights={weights} running={running} />
      <div className="tap-hint">
        {running ? "in esecuzione" : "premi play per avviare"}
      </div>
    </div>
  );
}



function AutoTempoNumberField({
  value,
  min,
  max,
  label,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      type="number"
      className="field"
      min={min}
      max={max}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        const parsed = Number(text);
        const next = Number.isFinite(parsed) && text !== ""
          ? clamp(Math.round(parsed), min, max)
          : value;
        setText(String(next));
        if (next !== value) onCommit(next);
      }}
      aria-label={label}
    />
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileAudio,
  Pause,
  Play,
  Repeat,
  Upload,
  X,
  Zap,
} from "lucide-react";
import {
  BpmSlider,
  Card,
  SectionTitle,
  Seg,
  Switch,
  toast,
} from "../../ui/primitives";
import { getAudioContext, ensureRunning } from "../../engine/audio";
import { clamp } from "../../lib/utils";
import { formatDurationClock } from "../../lib/time";

/** Limiti di velocità: sotto il 50% l'intonazione peggiora troppo. */
const MIN_SPEED = 50;
const MAX_SPEED = 150;

/** Preset del trainer progressivo. */
const START_SPEEDS = [50, 60, 70, 80];
const END_SPEEDS = [80, 90, 100, 110, 120];
const STEPS = [5, 10];
const REPS = [1, 2, 3, 4];

interface TrainerConfig {
  start: number;
  end: number;
  step: number;
  reps: number;
}

export default function BranoScreen() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const objectUrl = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(100);
  const [volume, setVolume] = useState(0.9);
  const [loop, setLoop] = useState(true);
  const [loopAll, setLoopAll] = useState(false);
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [cfg, setCfg] = useState<TrainerConfig>({ start: 60, end: 100, step: 5, reps: 3 });
  const [trainerOn, setTrainerOn] = useState(false);
  const [trainStep, setTrainStep] = useState(0);
  const [trainRep, setTrainRep] = useState(0);
  const [dragging, setDragging] = useState<null | "a" | "b" | "seek">(null);

  /* ---------------- File e decodifica ---------------- */

  const load = useCallback(async (f: File) => {
    if (!f.type.startsWith("audio/") && !/\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(f.name)) {
      toast("Questo file non sembra un brano audio");
      return;
    }
    await ensureRunning();
    const ctx = getAudioContext();
    setFile(f);
    setName(f.name);
    setTime(0);
    setPlaying(false);
    setTrainerOn(false);
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(f);
    objectUrl.current = url;

    if (ctx) {
      try {
        const buffer = await ctx.decodeAudioData(await f.arrayBuffer());
        setDuration(buffer.duration);
        setPeaks(buildPeaks(buffer, 1400));
        setA(0);
        setB(buffer.duration);
        return;
      } catch {
        // Alcuni formati non si decodificano ma si riproducono: si prosegue.
      }
    }
    // Senza decodifica la durata arriva dagli eventi del tag <audio>.
    setPeaks(null);
  }, []);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    []
  );

  /* ---------------- Elemento audio ---------------- */

  useEffect(() => {
    const el = new Audio();
    el.preload = "metadata";
    audioRef.current = el;
    const onTime = () => setTime(el.currentTime);
    const onMeta = () => {
      if (!peaks && Number.isFinite(el.duration)) {
        setDuration(el.duration);
        setB(el.duration);
      }
    };
    const onEnd = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("ended", onEnd);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("ended", onEnd);
    };
  }, [peaks]);

  /* La velocità non deve cambiare l'intonazione: si attiva la modalità
     pitch-preservation, con i prefissi storici dei vari browser. */
  const applySpeed = useCallback((pct: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = pct / 100;
    const anyEl = el as unknown as Record<string, unknown>;
    if ("preservesPitch" in el) (el as unknown as { preservesPitch: boolean }).preservesPitch = true;
    if ("mozPreservesPitch" in anyEl) anyEl.mozPreservesPitch = true;
    if ("webkitPreservesPitch" in anyEl) anyEl.webkitPreservesPitch = true;
  }, []);

  useEffect(() => {
    applySpeed(speed);
  }, [speed, applySpeed]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  /* ---------------- Loop A–B ---------------- */

  // Durante la riproduzione il segmento scelto viene ripetuto.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const tick = () => {
      if (!el.paused && b > a && el.currentTime >= b - 0.03) {
        if (loopAll && el.currentTime >= duration - 0.05) el.currentTime = 0;
        else if (loop) el.currentTime = a;
        else el.pause();
      }
    };
    const id = window.setInterval(tick, 40);
    return () => window.clearInterval(id);
  }, [a, b, loop, loopAll, duration]);

  const play = useCallback(async () => {
    const el = audioRef.current;
    if (!el || !objectUrl.current) return;
    await ensureRunning();
    el.src = objectUrl.current;
    applySpeed(speed);
    el.volume = volume;
    if (b > a && (el.currentTime < a - 0.05 || el.currentTime >= b - 0.05)) {
      el.currentTime = a;
    }
    try {
      await el.play();
      setPlaying(true);
    } catch {
      toast("Non riesco a riprodurre questo file");
    }
  }, [a, b, speed, volume, applySpeed]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  /* ---------------- Trainer progressivo ---------------- */

  const steps = useMemo(() => {
    const out: number[] = [];
    for (let s = cfg.start; s <= cfg.end + 0.001; s += cfg.step) out.push(Math.round(s));
    return out.length ? out : [cfg.start];
  }, [cfg]);

  /** true finche l'utente lascia girare l'allenamento progressivo. */
  const trainerRun = useRef(false);
  const trainerState = useRef({ step: 0, rep: 0 });

  const stopTrainer = useCallback(() => {
    trainerRun.current = false;
    setTrainerOn(false);
    setTrainStep(0);
    setTrainRep(0);
    pause();
  }, [pause]);

  useEffect(() => stopTrainer, [stopTrainer]);

  const startTrainer = async () => {
    await ensureRunning();
    trainerRun.current = true;
    trainerState.current = { step: 0, rep: 0 };
    setTrainStep(0);
    setTrainRep(0);
    setTrainerOn(true);
    setSpeed(cfg.start);

    const el = audioRef.current;
    if (!el) return;
    while (trainerRun.current) {
      const { step, rep } = trainerState.current;
      if (step >= steps.length) break;
      const pct = steps[step];
      setSpeed(pct);
      applySpeed(pct);
      // Una ripetizione = ascoltare il passaggio A-B a questa velocità.
      el.currentTime = a;
      el.loop = false;
      try {
        await el.play();
      } catch {
        break;
      }
      if (!trainerRun.current) break;
      setPlaying(true);
      const segmentSeconds = (b - a) / (pct / 100);
      await new Promise((r) => window.setTimeout(r, segmentSeconds * 1000 + 80));
      el.pause();
      if (!trainerRun.current) break;
      if (rep + 1 < cfg.reps) {
        trainerState.current = { step, rep: rep + 1 };
        setTrainRep(rep + 1);
      } else if (step + 1 < steps.length) {
        trainerState.current = { step: step + 1, rep: 0 };
        setTrainStep(step + 1);
        setTrainRep(0);
      } else {
        break;
      }
    }
    trainerRun.current = false;
    setTrainerOn(false);
    setPlaying(false);
  };

  /* ---------------- Disegno della forma d'onda ---------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = wrapRef.current;
    if (!canvas || !host) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = host.clientWidth;
      const h = 96;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.floor(h * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const mid = h / 2;
      if (!peaks || duration <= 0) {
        ctx.strokeStyle = "rgba(160,160,160,.45)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, mid);
        ctx.lineTo(w, mid);
        ctx.stroke();
        return;
      }
      const css = getComputedStyle(document.documentElement);
      const stroke = css.getPropertyValue("--text-3").trim() || "#777";
      const lit = css.getPropertyValue("--text").trim() || "#eee";
      const perPx = duration / w;
      for (let x = 0; x < w; x++) {
        const from = Math.floor(x * perPx * peaks.length / duration);
        const to = Math.max(from + 1, Math.floor((x + 1) * perPx * peaks.length / duration));
        let lo = 1;
        let hi = -1;
        for (let i = from; i < to && i < peaks.length; i++) {
          const v = peaks[i];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        const t = x / w;
        const inside = duration > 0 && t * duration >= a && t * duration <= b;
        ctx.strokeStyle = inside ? lit : stroke;
        ctx.globalAlpha = inside ? 0.95 : 0.55;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, mid - hi * (mid - 6));
        ctx.lineTo(x + 0.5, mid - lo * (mid - 6));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Testina di riproduzione.
      const px = (time / duration) * w;
      ctx.strokeStyle = lit;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    };
    draw();
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [peaks, duration, a, b, time]);

  /* ---------------- Trascinamento sulla forma d'onda ---------------- */

  const posToTime = (clientX: number) => {
    const host = wrapRef.current;
    if (!host || duration <= 0) return 0;
    const rect = host.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return ratio * duration;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const t = posToTime(e.clientX);
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ax = (a / duration) * rect.width;
    const bx = (b / duration) * rect.width;
    if (Math.abs(x - ax) < 14) setDragging("a");
    else if (Math.abs(x - bx) < 14) setDragging("b");
    else {
      setDragging("seek");
      const el = audioRef.current;
      if (el) el.currentTime = t;
      setTime(t);
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || duration <= 0) return;
    const t = posToTime(e.clientX);
    if (dragging === "a") setA(Math.min(t, b - 0.2));
    else if (dragging === "b") setB(Math.max(t, a + 0.2));
    else {
      const el = audioRef.current;
      if (el) el.currentTime = t;
      setTime(t);
    }
  };

  const onPointerUp = () => setDragging(null);

  const totalReps = steps.length * cfg.reps;
  const doneReps = Math.min(totalReps, trainStep * cfg.reps + trainRep);

  if (!file) {
    return (
      <div className="train-body">
        <p className="screen-sub" style={{ marginBottom: 18 }}>
          Carica un brano dal tuo dispositivo e rallenta il passaggio che ti
          serve. Il file resta sul tuo telefono: non viene inviato da nessuna
          parte.
        </p>
        <label className="brano-drop">
          <FileAudio size={30} strokeWidth={1.5} className="text3" />
          <p>
            <b>Scegli un file audio</b>
            <br />
            MP3 o WAV, anche M4A, OGG o AAC se il browser li legge.
          </p>
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void load(f);
            }}
          />
        </label>
        <Card className="card-pad" style={{ marginTop: 14 }}>
          <p className="tiny text3">
            Tutto avviene sul dispositivo: il rallentamento mantiene
            l&apos;intonazione e il file non viene elaborato da servizi
            esterni.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="train-body">
      {/* Intestazione del brano */}
      <div className="harmony-keyline" style={{ marginBottom: 10 }}>
        <FileAudio size={15} className="text3" />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
        <button
          className="harmony-act"
          style={{ width: 32, flex: "none" }}
          aria-label="Cambia brano"
          onClick={() => {
            stopTrainer();
            setFile(null);
            setName("");
            setPeaks(null);
            setDuration(0);
            setPlaying(false);
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Forma d'onda con selezione A-B */}
      <div
        className="wave-wrap"
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="wave-canvas" />
        {duration > 0 ? (
          <>
            <div
              className="brano-sel"
              style={{
                left: `${(a / duration) * 100}%`,
                width: `${Math.max(0, ((b - a) / duration) * 100)}%`,
              }}
            >
              <b className="a">A</b>
              <b className="b">B</b>
            </div>
            <div
              className="wave-cursor"
              style={{ left: `${(time / duration) * 100}%` }}
            />
          </>
        ) : null}
      </div>
      <div className="brano-times">
        <span>{formatDurationClock(time)}</span>
        <span>
          A {formatDurationClock(a)} · B {formatDurationClock(b)}
        </span>
        <span>{formatDurationClock(duration)}</span>
      </div>

      {/* Lettore */}
      <div className="brano-bar">
        <button
          className="brano-play"
          onClick={() => (playing ? pause() : void play())}
          aria-label={playing ? "Pausa" : "Riproduci"}
        >
          {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
        </button>
        <div className="train-slider" style={{ flex: 1, marginTop: 0 }}>
          <BpmSlider value={Math.round(speed)} min={MIN_SPEED} max={MAX_SPEED} onChange={setSpeed} />
          <div className="train-slider-val">
            <span className="brano-speed" style={{ minWidth: 0 }}>
              {speed}%
            </span>
            <span className="text3">
              {formatDurationClock((b - a) / (speed / 100))} di passaggio
            </span>
          </div>
        </div>
      </div>

      <Card className="card-pad train-form" style={{ marginTop: 12 }}>
        <label className="train-label">Velocità</label>
        <div className="train-chips">
          {[50, 60, 70, 80, 90, 100, 120, 150].map((p) => (
            <button
              key={p}
              className={`chip${speed === p ? " on" : ""}`}
              onClick={() => setSpeed(p)}
            >
              {p}%
            </button>
          ))}
        </div>
        <p className="tiny text3">
          L&apos;intonazione resta uguale: il brano viene rallentato senza
          cambiare la sua altezza.
        </p>

        <div className="train-switch-row">
          <span className="train-switch-label">
            Ripeti il passaggio A–B
            <em>Riparte da A quando arriva a B</em>
          </span>
          <Switch on={loop} onChange={setLoop} />
        </div>
        <div className="train-switch-row">
          <span className="train-switch-label">
            Ripeti tutto il brano
            <em>Torna dall&apos;inizio</em>
          </span>
          <Switch on={loopAll} onChange={setLoopAll} />
        </div>

        <div className="train-slider">
          <BpmSlider value={Math.round(volume * 100)} min={0} max={100} onChange={(v) => setVolume(v / 100)} />
          <div className="train-slider-val">
            <span>Volume</span>
            <span className="text3">{Math.round(volume * 100)}%</span>
          </div>
        </div>
      </Card>

      {/* Trainer progressivo */}
      <SectionTitle>Allenamento progressivo</SectionTitle>
      <Card className="card-pad train-form">
        <p className="tiny text3">
          Il brano passa da una velocità all&apos;altra, fermandosi un
          numero di volte a ogni livello. Puoi interromperlo quando vuoi.
        </p>
        <label className="train-label">Velocità iniziale</label>
        <Seg
          value={String(cfg.start)}
          onChange={(v) => setCfg({ ...cfg, start: Number(v) })}
          options={START_SPEEDS.map((v) => ({ id: String(v), label: `${v}%` }))}
        />
        <label className="train-label">Velocità finale</label>
        <Seg
          value={String(cfg.end)}
          onChange={(v) => setCfg({ ...cfg, end: Number(v) })}
          options={END_SPEEDS.map((v) => ({ id: String(v), label: `${v}%` }))}
        />
        <label className="train-label">Incremento</label>
        <Seg
          value={String(cfg.step)}
          onChange={(v) => setCfg({ ...cfg, step: Number(v) })}
          options={STEPS.map((v) => ({ id: String(v), label: `+${v}%` }))}
        />
        <label className="train-label">Ripetizioni per velocità</label>
        <Seg
          value={String(cfg.reps)}
          onChange={(v) => setCfg({ ...cfg, reps: Number(v) })}
          options={REPS.map((v) => ({ id: String(v), label: String(v) }))}
        />

        <div className="trainer-track">
          {Array.from({ length: totalReps }, (_, i) => {
            const step = Math.floor(i / cfg.reps);
            const state = i < doneReps ? "done" : i === doneReps && trainerOn ? "now" : "";
            return (
              <span
                key={i}
                className={`trainer-pip${state ? ` ${state}` : ""}`}
                title={state === "now" ? `${steps[step]}%` : undefined}
              />
            );
          })}
        </div>

        <div className="accordi-controls" style={{ marginTop: 12 }}>
          {trainerOn ? (
            <button className="btn btn-danger" onClick={stopTrainer}>
              <X size={16} /> Ferma
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={b - a < 0.4}
              onClick={() => void startTrainer()}
            >
              <Zap size={16} /> Da {cfg.start}% a {cfg.end}%
            </button>
          )}
        </div>

        {trainerOn ? (
          <p className="tiny text3" style={{ marginTop: 10 }}>
            <Repeat size={12} style={{ verticalAlign: "-1px" }} /> {steps[trainStep] ?? cfg.start}% ·
            ripetizione {Math.min(trainRep + 1, cfg.reps)} di {cfg.reps} · {doneReps}/
            {totalReps} completate
          </p>
        ) : null}
      </Card>

      <label className="brano-drop" style={{ marginTop: 14, padding: "18px 16px" }}>
        <Upload size={20} strokeWidth={1.5} className="text3" />
        <p>Sostituisci il brano con un altro file</p>
        <input
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void load(f);
          }}
        />
      </label>
    </div>
  );
}

/** Min/max del campione per ogni colonna del disegno. */
function buildPeaks(buffer: AudioBuffer, buckets: number): Float32Array {
  const data = buffer.getChannelData(0);
  const per = Math.max(1, Math.floor(data.length / buckets));
  const out = new Float32Array(buckets);
  for (let i = 0; i < buckets; i++) {
    let peak = 0;
    const start = i * per;
    for (let j = start; j < start + per && j < data.length; j++) {
      const v = Math.abs(data[j]);
      if (v > peak) peak = v;
    }
    out[i] = peak;
  }
  return out;
}

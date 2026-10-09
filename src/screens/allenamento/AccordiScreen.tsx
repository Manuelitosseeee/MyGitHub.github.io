import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Square,
} from "lucide-react";
import {
  BpmSlider,
  Card,
  SectionTitle,
  Seg,
  Sheet,
  Switch,
  toast,
  CloseX,
} from "../../ui/primitives";
import { ChordDiagram } from "../../training/ChordDiagram";
import {
  LEVELS,
  LEVEL_LABEL,
  archiveFor,
  levelQualities,
  type ChordEntry,
  type Level,
} from "../../training/chords";
import { CHORDS, type ChordQuality } from "../../training/theory";
import { useMetronome } from "../../engine/useMetronome";

type Mode = "libero" | "sfida";

/** Tempo disponibile per ogni cambio, in secondi. */
const CHANGE_SECONDS = [30, 20, 15, 10, 8, 5, 4, 3, 2];
/** Durate dell'esercizio, in minuti. */
const DURATIONS = [1, 2, 3, 5, 10];

export default function AccordiScreen() {
  const [level, setLevel] = useState<Level>("principiante");
  const [mode, setMode] = useState<Mode>("libero");
  const [seconds, setSeconds] = useState(5);
  const [duration, setDuration] = useState(2);
  const [barreOnly, setBarreOnly] = useState(false);
  const [useMetro, setUseMetro] = useState(false);
  const [bpm, setBpm] = useState(80);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [pairMode, setPairMode] = useState(false);
  const [pair, setPair] = useState<[ChordEntry | null, ChordEntry | null]>([null, null]);

  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [current, setCurrent] = useState<ChordEntry | null>(null);
  const [changes, setChanges] = useState(0);
  const [left, setLeft] = useState(0);
  const [diagram, setDiagram] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [finished, setFinished] = useState(false);
  const [progressionMode, setProgressionMode] = useState(false);

  const archive = useMemo(
    () =>
      archiveFor({
        level,
        qualities: levelQualities(level),
        barreOnly,
        excluded,
      }),
    [level, barreOnly, excluded]
  );

  /** Progressione logica: gira tra accordi diatonici coerenti.
   *  Tipo: La min → Mi min → Fa maj → Sol maj → Do maj (putami di girare).
   *  Si basa sui gradi della scala maggiore: vi - ii - IV - V - I. */
  const progressionArchive = useMemo(() => {
    if (archive.length === 0) return [];
    // Raggruppa per root per facilitare la progressione.
    const byRoot = new Map<number, ChordEntry[]>();
    for (const e of archive) {
      const list = byRoot.get(e.rootPc) ?? [];
      list.push(e);
      byRoot.set(e.rootPc, list);
    }
    return byRoot;
  }, [archive]);

  /** Scegli il prossimo accordo in progressione logica.
   *  La progressione segue: vi → ii → IV → V → I (in maggiore)
   *  oppure gradi corrispondenti in minore.
   *  Se non ci sono accordi per quel grado, si prende il più vicino. */
  const pickInProgression = useCallback(
    (currentEntry?: ChordEntry) => {
      if (archive.length === 0) return archive[0] ?? null;
      // Gradi target nella scala maggiore (0 = tonic, 5 = ii, 9 = iii, 5 = IV...)
      // Usiamo la progressione: I - V - vi - IV (molto comune)
      // oppure vi - ii - IV - V - I per più varietà
      const progressionSteps = [9, 2, 5, 7, 0]; // vi, ii, IV, V, I (semintoni dalla tonica)
      
      // Se non c'è un accordo corrente, parte da un grado a caso
      if (!currentEntry) {
        const firstGrade = progressionSteps[0];
        const candidates = archive.filter((e) => e.rootPc === firstGrade);
        if (candidates.length > 0) {
          return candidates[Math.floor(Math.random() * candidates.length)];
        }
        // Se non c'è, cerca l'accordo con root più vicina
        const pool = archive;
        if (pool.length === 0) return null;
        return pool[Math.floor(Math.random() * pool.length)];
      }
      
      // Trova il prossimo grado nella progressione
      const currentIdx = progressionSteps.indexOf(currentEntry.rootPc);
      let nextGrade: number;
      if (currentIdx >= 0) {
        // Continua la progressione
        nextGrade = progressionSteps[(currentIdx + 1) % progressionSteps.length];
      } else {
        // Accordo non nella progressione: salta a un grado a caso
        nextGrade = progressionSteps[Math.floor(Math.random() * progressionSteps.length)];
      }
      
      // Cerca accordi con quella root
      const candidates = archive.filter((e) => e.rootPc === nextGrade);
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
      
      // Se non c'è, cerca accordi con root vicina (entro 2 semitoni)
      const nearby = archive.filter(
        (e) => Math.min(
          Math.abs((e.rootPc - nextGrade + 12) % 12),
          Math.abs((e.rootPc - nextGrade - 12) % 12)
        ) <= 2
      );
      if (nearby.length > 0) {
        return nearby[Math.floor(Math.random() * nearby.length)];
      }
      
      // Fallback: pick casuale
      const pool = archive;
      if (pool.length === 0) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    },
    [archive]
  );

  /** Pick casuale normale (per modalità libera tradizionale). */
  const pick = useCallback(
    (excludeId?: string) => {
      const pool = archive.filter((e) => e.shape.id !== excludeId);
      if (pool.length === 0) return archive[0] ?? null;
      return pool[Math.floor(Math.random() * pool.length)];
    },
    [archive]
  );

  /* ---------------- Allenamento libero: cambio manuale ---------------- */

  const nextFree = useCallback(() => {
    if (pairMode && pair[0] && pair[1]) {
      setCurrent((c) => (c?.shape.id === pair[0]!.shape.id ? pair[1]! : pair[0]!));
      return;
    }
    if (progressionMode) {
      setCurrent((c) => pickInProgression(c ?? undefined));
      return;
    }
    setCurrent((c) => pick(c?.shape.id));
  }, [pair, pairMode, progressionMode, pick, pickInProgression]);

  useEffect(() => {
    if (mode === "libero" && !current) {
      if (progressionMode) {
        setCurrent(pickInProgression());
      } else {
        setCurrent(pick());
      }
    }
  }, [mode, current, progressionMode, pick, pickInProgression]);

  /* ---------------- Sfida a tempo ---------------- */

  const nextChangeAt = useRef(0);
  const endAt = useRef(0);

  useEffect(() => {
    if (mode !== "sfida" || !running || paused) return;
    const id = window.setInterval(() => {
      const now = performance.now();
      if (now >= endAt.current) {
        setRunning(false);
        setPaused(false);
        setFinished(true);
        return;
      }
      setLeft(Math.max(0, Math.ceil((endAt.current - now) / 1000)));
      if (now >= nextChangeAt.current) {
        nextChangeAt.current = now + seconds * 1000;
        setCurrent((c) => pick(c?.shape.id));
        setChanges((n) => n + 1);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [mode, running, paused, seconds, pick]);

  const start = () => {
    const first = pairMode && pair[0] && pair[1] ? pair[0] : pick();
    setCurrent(first);
    setChanges(0);
    setFinished(false);
    if (mode === "sfida") {
      setLeft(duration * 60);
      endAt.current = performance.now() + duration * 60 * 1000;
      nextChangeAt.current = performance.now() + seconds * 1000;
      setRunning(true);
      setPaused(false);
    }
  };

  const stop = () => {
    setRunning(false);
    setPaused(false);
    setFinished(false);
    setLeft(0);
  };

  const togglePause = () => {
    if (mode !== "sfida") return;
    if (paused) {
      // Riallinea gli orologi mantenendo il tempo residuo.
      const remain = left * 1000;
      endAt.current = performance.now() + remain;
      nextChangeAt.current = performance.now() + seconds * 1000;
      setPaused(false);
    } else {
      setPaused(true);
    }
  };

  /* ---------------- Metronomo opzionale ---------------- */

  const metro = useMetronome(
    "allena-accordi",
    useCallback(
      () => ({
        bpm,
        volume: 0.6,
        sound: "digital" as const,
        subdivision: "none" as const,
        weights: [2, 1, 1, 1] as Array<0 | 1 | 2>,
      }),
      [bpm]
    )
  );

  // Il metronomo segue solo l'allenamento, mai la configurazione.
  useEffect(() => {
    if (useMetro && running && !paused) void metro.start();
    else if (metro.running) metro.stop();
  }, [useMetro, running, paused, metro]);

  /* ---------------- Vista ---------------- */

  const active = mode === "sfida" ? running && !paused : true;

  return (
    <div className="train-body">
      <p className="screen-sub" style={{ marginBottom: 18 }}>
        Cambia accordo seguendo il ritmo. Tocca il nome dell'accordo per
        fermarti e vedere la diteggiatura.
      </p>

      <div className="accordi-stage">
        <button
          className="accordi-chord"
          onClick={() => {
            setDiagram(true);
            if (running && !paused) setPaused(true);
          }}
          disabled={!current}
        >
          {current ? current.name : "—"}
        </button>
        <div className="accordi-meta">
          {current
            ? `${LEVEL_LABEL[level]} · ${current.shape.baseFret === 0 ? "a corda aperta" : `tasto ${current.shape.baseFret}`}`
            : "premi Avvia"}
        </div>

        {mode === "sfida" ? (
          <div className="accordi-stats">
            <div className="accordi-stat">
              <div className="v">{changes}</div>
              <div className="k">cambi</div>
            </div>
            <div className="accordi-stat">
              <div className="v">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</div>
              <div className="k">tempo</div>
            </div>
            <div className="accordi-stat">
              <div className="v">{seconds}s</div>
              <div className="k">per accordo</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="accordi-controls">
        {mode === "sfida" ? (
          <>
            {!running ? (
              <button className="btn btn-primary" onClick={start}>
                <Play size={17} /> Avvia sfida
              </button>
            ) : (
              <>
                <button className="btn" onClick={togglePause} disabled={finished}>
                  {paused ? <Play size={17} /> : <Pause size={17} />}
                  {paused ? "Riprendi" : "Pausa"}
                </button>
                <button className="btn" onClick={stop}>
                  <Square size={15} /> Termina
                </button>
              </>
            )}
            {active ? (
              <button className="btn btn-soft" onClick={nextFree}>
                <SkipForward size={16} /> Avanti
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button className="btn btn-primary" onClick={nextFree} disabled={!current}>
              <RotateCcw size={16} /> Cambia accordo
            </button>
          </>
        )}
      </div>

      {finished ? (
        <Card className="card-pad" style={{ marginTop: 14 }}>
          <div className="row-title">Sessione completata</div>
          <p className="tiny text3" style={{ marginTop: 4 }}>
            Hai proposto {changes} cambi in {duration} minuti,{" "}
            {Math.round((changes / (duration * 60)) * 60)} cambi al minuto.
          </p>
        </Card>
      ) : null}

      {/* ---------------- Configurazione ---------------- */}
      <SectionTitle>Configurazione</SectionTitle>
      <Card className="card-pad train-form">
        <label className="train-label">Livello</label>
        <Seg
          value={level}
          onChange={(v) => {
            setLevel(v);
            setCurrent(null);
          }}
          options={LEVELS.map((l) => ({ id: l, label: LEVEL_LABEL[l] }))}
        />

        <label className="train-label">Modalità</label>
        <Seg
          value={mode}
          onChange={(v) => {
            setMode(v);
            stop();
            setCurrent(null);
          }}
          options={[
            { id: "libero", label: "Allenamento libero" },
            { id: "sfida", label: "Sfida a tempo" },
          ]}
        />

        {mode === "sfida" ? (
          <>
            <label className="train-label">Tempo per ogni cambio</label>
            <Seg
              value={String(seconds)}
              onChange={(v) => setSeconds(Number(v))}
              options={CHANGE_SECONDS.map((s) => ({ id: String(s), label: `${s}s` }))}
            />
            <label className="train-label">Durata</label>
            <Seg
              value={String(duration)}
              onChange={(v) => setDuration(Number(v))}
              options={DURATIONS.map((d) => ({ id: String(d), label: `${d} min` }))}
            />
          </>
        ) : null}

        <div className="train-switch-row">
          <span className="train-switch-label">
            Solo accordi con barrè
            <em>Restringe l&apos;archivio alle diteggiature con barrè</em>
          </span>
          <Switch
            on={barreOnly}
            onChange={(v) => {
              setBarreOnly(v);
              setCurrent(null);
            }}
          />
        </div>

        <div className="train-switch-row">
          <span className="train-switch-label">
            Metronomo
            <em>Un click per ogni accordo</em>
          </span>
          <Switch on={useMetro} onChange={setUseMetro} />
        </div>

        <div className="train-switch-row">
          <span className="train-switch-label">
            Progressione logica
            <em>Gira tra accordi coerenti: La min → Mi min → Fa → Sol → Do</em>
          </span>
          <Switch on={progressionMode} onChange={setProgressionMode} />
        </div>

        {useMetro ? (
          <div className="train-slider">
            <BpmSlider value={bpm} min={40} max={200} onChange={setBpm} />
            <div className="train-slider-val">
              {bpm} BPM
              <span className="text3">
                {" "}
                {Math.round((seconds / 60) * bpm * 10) / 10} accordi/min
              </span>
            </div>
          </div>
        ) : null}
      </Card>

      {/* ---------------- Due accordi alternati ---------------- */}
      <SectionTitle>Alterna due accordi</SectionTitle>
      <Card className="card-pad train-form">
        <div className="train-switch-row">
          <span className="train-switch-label">
            {pairMode ? "Attivo: si alternano i due accordi scelti" : "Ripeti due accordi a scelta"}
            <em>Utile per passaggi ripetitivi</em>
          </span>
          <Switch on={pairMode} onChange={setPairMode} />
        </div>
        <div className="train-pair">
          {[0, 1].map((i) => (
            <PairSlot
              key={i}
              label={i === 0 ? "Primo accordo" : "Secondo accordo"}
              entry={pair[i]}
              onPick={() => {
                const next = pick(pair[i]?.shape.id);
                setPair((p) => {
                  const q: [ChordEntry | null, ChordEntry | null] = [...p];
                  q[i] = next;
                  return q;
                });
              }}
              onClear={() =>
                setPair((p) => {
                  const q: [ChordEntry | null, ChordEntry | null] = [...p];
                  q[i] = null;
                  return q;
                })
              }
            />
          ))}
        </div>
        {pairMode ? (
          <button
            className="btn btn-soft"
            style={{ width: "100%" }}
            disabled={!pair[0] || !pair[1]}
            onClick={() => {
              setCurrent(pair[0]);
              setChanges(0);
            }}
          >
            {running ? "Riparti da capo" : "Allenati su questi due"}
          </button>
        ) : null}
      </Card>

      {/* ---------------- Esclusioni ---------------- */}
      <SectionTitle>
        <button className="train-inline-btn" onClick={() => setShowExcluded((v) => !v)}>
          Escludi accordi
          {excluded.length ? ` (${excluded.length})` : ""}
          {showExcluded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </SectionTitle>
      {showExcluded ? (
        <Card className="card-pad">
          {archive.length === 0 ? (
            <p className="tiny text3">Nessun accordo disponibile con questi filtri.</p>
          ) : (
            <div className="train-excluded">
              {archive.map((e) => {
                const off = excluded.includes(e.shape.id);
                return (
                  <button
                    key={e.shape.id}
                    className={`chip${off ? " on" : ""}`}
                    onClick={() =>
                      setExcluded((x) =>
                        off ? x.filter((i) => i !== e.shape.id) : [...x, e.shape.id]
                      )
                    }
                  >
                    {e.name}
                  </button>
                );
              })}
            </div>
          )}
          {excluded.length ? (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => setExcluded([])}
            >
              Ripristina tutto
            </button>
          ) : null}
        </Card>
      ) : null}

      {/* ---------------- Diagramma ---------------- */}
      <Sheet
        open={diagram && !!current}
        onClose={() => setDiagram(false)}
        title={current?.name}
        footer={
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={() => {
              setDiagram(false);
              if (running && paused) setPaused(false);
            }}
          >
            Riprendi l&apos;allenamento
          </button>
        }
      >
        {current ? (
          <>
            <div className="train-diagram">
              <ChordDiagram shape={current.shape} />
            </div>
            <ul className="train-notes">
              <li>
                <b>{LEVEL_LABEL[level]}</b> · {CHORDS[current.quality].label}
              </li>
              <li>
                Corde:{" "}
                {current.shape.frets
                  .map((f, i) => (f === null ? null : `${i + 1}ª ${f === 0 ? "aperta" : `tasto ${f}`}`))
                  .filter(Boolean)
                  .join(", ")}
              </li>
              {current.shape.hasBarre ? (
                <li>
                  Barrè alla {current.shape.barre!.fret}ª posizione, indice sulle{" "}
                  {current.shape.barre!.from + 1}ª–{current.shape.barre!.to + 1}ª corde.
                </li>
              ) : null}
            </ul>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}

function PairSlot({
  label,
  entry,
  onPick,
  onClear,
}: {
  label: string;
  entry: ChordEntry | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="train-pair-slot">
      <div className="train-pair-label">
        {label}
        {entry ? (
          <button className="train-inline-btn" onClick={onClear} aria-label="Togli accordo">
            <Ban size={13} />
          </button>
        ) : null}
      </div>
      <button className="train-pair-btn" onClick={onPick}>
        {entry ? entry.name : "Scegli"}
      </button>
      {entry ? (
        <div className="train-pair-mini">
          <ChordDiagram shape={entry.shape} compact />
        </div>
      ) : null}
    </div>
  );
}

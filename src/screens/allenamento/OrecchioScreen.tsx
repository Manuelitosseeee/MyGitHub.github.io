import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ear, Play, RotateCcw, Trash2, TrendingUp } from "lucide-react";
import {
  Card,
  Confirm,
  SectionTitle,
  Seg,
  Switch,
  toast,
} from "../../ui/primitives";
import { store, useStore } from "../../data/store";
import { earStats, earSummary } from "../../data/earStats";
import { CHORDS, INTERVALS, type ChordQuality } from "../../training/theory";
import {
  makeChordQuestion,
  makeIntervalQuestion,
  makeProgressionQuestion,
  type EarKind,
  type EarQuestion,
} from "../../training/ear";
import { playChord, playInterval, unlockAudio } from "../../training/audio";

/** Intervalli proposti per livello, in semitoni. */
const EASY_INTERVALS = [2, 3, 4, 5, 7, 9, 12];
const MEDIUM_INTERVALS = [...EASY_INTERVALS, 1, 6, 8];
const HARD_INTERVALS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const ALL_QUALITIES: ChordQuality[] = [
  "maj",
  "min",
  "dim",
  "aug",
  "maj7",
  "dom7",
  "min7",
  "halfdim",
];

const LEVEL_LABEL = ["Facile", "Medio", "Difficile"];

export default function OrecchioScreen() {
  const st = useStore();
  const [kind, setKind] = useState<EarKind>("intervalli");
  const [seed, setSeed] = useState(1);
  const [question, setQuestion] = useState<EarQuestion | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  /* Impostazioni: intervalli */
  const [level, setLevel] = useState<0 | 1 | 2>(0);
  const [melodic, setMelodic] = useState(true);
  const [direction, setDirection] = useState<"su" | "giu" | "entrambi">("su");

  /* Impostazioni: accordi */
  const [qualities, setQualities] = useState<ChordQuality[]>(["maj", "min"]);

  /* Impostazioni: progressioni */
  const [minorKey, setMinorKey] = useState(false);
  const [playsTonic, setPlaysTonic] = useState(true);

  const askedAt = useRef(0);
  const stats = useMemo(() => earStats(st), [st]);
  const summary = useMemo(() => earSummary(st), [st]);

  /** Le opzioni ammesse dipendono dal livello scelto. */
  const intervalPool = useMemo(() => {
    const list =
      level === 0 ? EASY_INTERVALS : level === 1 ? MEDIUM_INTERVALS : HARD_INTERVALS;
    return list.filter((s) => INTERVALS.some((i) => i.semitones === s));
  }, [level]);

  const build = useCallback((): EarQuestion => {
    setSeed((s) => s + 1);
    const s = seed + 1;
    if (kind === "intervalli") {
      return makeIntervalQuestion(
        { semitones: intervalPool, melodic, direction, level },
        s * 7919
      );
    }
    if (kind === "accordi") {
      return makeChordQuestion({ qualities, level }, s * 104729);
    }
    return makeProgressionQuestion({ minor: minorKey, level, playsTonic }, s * 15485863);
  }, [kind, intervalPool, melodic, direction, level, qualities, minorKey, playsTonic, seed]);

  const newQuestion = useCallback(() => {
    setQuestion(build());
    setAnswered(null);
  }, [build]);

  /* Suona la domanda appena creata. */
  const play = useCallback(async (q: EarQuestion) => {
    await unlockAudio();
    if (q.kind === "intervalli") {
      playInterval(q.rootMidi, q.semitones, q.melodic, {
        voice: "piano",
        gain: 0.5,
        duration: q.melodic ? 0.45 : 1.2,
      });
    } else if (q.kind === "accordi") {
      playChord(q.notes, { voice: "piano", gain: 0.42, duration: 1.5 });
    } else {
      if (q.playsTonic) playChord(q.notes[0], { voice: "piano", gain: 0.42, duration: 0.8 });
      q.notes.forEach((chord, i) => {
        playChord(chord, { voice: "piano", gain: 0.42, duration: 0.75, delay: (q.playsTonic ? 0.9 : 0) + i * 0.62 });
      });
    }
  }, []);

  const start = useCallback(async () => {
    const q = build();
    setQuestion(q);
    setAnswered(null);
    askedAt.current = performance.now();
    await play(q);
  }, [build, play]);

  const answer = (label: string) => {
    if (!question || answered) return;
    setAnswered(label);
    store.addEarAnswer({
      mode: question.kind,
      answer: label,
      expected: question.expected,
      ms: performance.now() - askedAt.current,
      detail: question.detail,
    });
  };

  // Cambiando modalità o impostazioni si riparte con una domanda nuova.
  useEffect(() => {
    setQuestion(null);
    setAnswered(null);
  }, [kind, level, melodic, direction, qualities, minorKey, playsTonic]);

  const answeredRight = answered !== null && question !== null && answered === question.expected;
  const activeStats = stats.find((s) => s.mode === kind)!;

  return (
    <div className="train-body">
      <p className="screen-sub" style={{ marginBottom: 18 }}>
        Ascolta, riconosci e rispondi. È l&apos;unico strumento che tiene conto
        delle tue risposte: i risultati finiscono anche nel Diario.
      </p>

      <div className="ear-stats">
        <div className="ear-stat">
          <div className="v">{summary.total}</div>
          <div className="k">esercizi</div>
        </div>
        <div className="ear-stat">
          <div className="v">{summary.percent}%</div>
          <div className="k">corretti</div>
        </div>
        <div className="ear-stat">
          <div className="v">{summary.avgSeconds}s</div>
          <div className="k">tempo medio</div>
        </div>
      </div>

      <SectionTitle>Modalità</SectionTitle>
      <Seg
        value={kind}
        onChange={(k) => setKind(k)}
        options={[
          { id: "intervalli", label: "Intervalli" },
          { id: "accordi", label: "Accordi" },
          { id: "progressioni", label: "Progressioni" },
        ]}
      />

      {/* ---------- Impostazioni per modalità ---------- */}
      <Card className="card-pad train-form" style={{ marginTop: 14 }}>
        <label className="train-label">Livello</label>
        <Seg
          value={String(level)}
          onChange={(v) => setLevel(Number(v) as 0 | 1 | 2)}
          options={LEVEL_LABEL.map((l, i) => ({ id: String(i), label: l }))}
        />

        {kind === "intervalli" ? (
          <>
            <label className="train-label">Intervalli da includere</label>
            <div className="train-chips train-chips-stack">
              {INTERVALS.map((i) => {
                const on = intervalPool.includes(i.semitones);
                const forced =
                  (level === 0 && !EASY_INTERVALS.includes(i.semitones)) ||
                  (level === 1 && !MEDIUM_INTERVALS.includes(i.semitones));
                return (
                  <button
                    key={i.semitones}
                    className={`chip${on ? " on" : ""}`}
                    disabled={forced}
                    style={forced ? { opacity: 0.35 } : undefined}
                    onClick={() => {
                      // Il livello governa l'insieme: toccare un intervallo
                      // lo esclude solo se non è imposto dal livello.
                      if (forced) return;
                    }}
                    title={i.label}
                  >
                    {i.label}
                  </button>
                );
              })}
            </div>
            <p className="tiny text3" style={{ marginTop: 2 }}>
              Il livello decide quali intervalli entrano: gli altri restano
              disattivati.
            </p>

            <label className="train-label">Suono</label>
            <Seg
              value={melodic ? "melodica" : "armonica"}
              onChange={(v) => setMelodic(v === "melodica")}
              options={[
                { id: "melodica", label: "Melodica" },
                { id: "armonica", label: "Armonica" },
              ]}
            />

            <label className="train-label">Direzione</label>
            <Seg
              value={direction}
              onChange={setDirection}
              options={[
                { id: "su", label: "Ascendente" },
                { id: "giu", label: "Discendente" },
                { id: "entrambi", label: "Entrambe" },
              ]}
            />
          </>
        ) : null}

        {kind === "accordi" ? (
          <>
            <label className="train-label">Tipologie da riconoscere</label>
            <div className="train-chips">
              {ALL_QUALITIES.map((q) => {
                const on = qualities.includes(q);
                return (
                  <button
                    key={q}
                    className={`chip${on ? " on" : ""}`}
                    onClick={() =>
                      setQualities((qs) => {
                        if (on) {
                          const next = qs.filter((x) => x !== q);
                          // Almeno una tipologia deve restare selezionata.
                          return next.length ? next : qs;
                        }
                        return [...qs, q];
                      })
                    }
                  >
                    {CHORDS[q].label}
                  </button>
                );
              })}
            </div>
            <p className="tiny text3" style={{ marginTop: 2 }}>
              Al livello difficile compaiono anche le inversioni, sempre
              limitatamente alle tipologie scelte.
            </p>
          </>
        ) : null}

        {kind === "progressioni" ? (
          <>
            <label className="train-label">Modalità</label>
            <Seg
              value={minorKey ? "minore" : "maggiore"}
              onChange={(v) => setMinorKey(v === "minore")}
              options={[
                { id: "maggiore", label: "Maggiore" },
                { id: "minore", label: "Minore" },
              ]}
            />
            <div className="train-switch-row">
              <span className="train-switch-label">
                Tonica di riferimento
                <em>Suona la tonica prima della progressione</em>
              </span>
              <Switch on={playsTonic} onChange={setPlaysTonic} />
            </div>
          </>
        ) : null}
      </Card>

      {/* ---------- Sessione ---------- */}
      <SectionTitle>Allenamento</SectionTitle>
      <div className="ear-stage">
        <div className="ear-prompt">
          {question
            ? question.kind === "intervalli"
              ? question.melodic
                ? "Intervallo melodico"
                : "Intervallo armonico"
              : question.kind === "accordi"
                ? "Tipologia di accordo"
                : "Gradi della progressione"
            : "Pronto"}
        </div>
        <div className="ear-question">
          {answered && question ? (
            answered === question.expected ? "Corretto!" : `Era ${question.expectedLong}`
          ) : question ? (
            "Ascolta e scegli"
          ) : (
            "Premi per iniziare"
          )}
        </div>
        <button className="ear-play" onClick={() => void start()} aria-label="Riproduci">
          {question ? <Play size={30} strokeWidth={1.6} /> : <Ear size={30} strokeWidth={1.6} />}
        </button>
        {question ? (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 14 }}
            onClick={() => void play(question)}
          >
            <RotateCcw size={14} /> Riascolta
          </button>
        ) : null}
      </div>

      {question ? (
        <div className="ear-answers">
          {question.options.map((o) => {
            const isRight = o === question.expected;
            const chosen = o === answered;
            const cls = answered
              ? isRight
                ? " ear-answer right"
                : chosen
                  ? " ear-answer wrong"
                  : ""
              : "";
            return (
              <button
                key={o}
                className={`ear-answer${cls}`}
                onClick={() => answer(o)}
                disabled={!!answered}
              >
                {o}
              </button>
            );
          })}
        </div>
      ) : null}

      {answered && question ? (
        <p className="ear-feedback">
          {question.expectedLong}
          {question.kind === "progressioni"
            ? ` · ${question.detail}`
            : question.kind === "accordi"
              ? ` · ${question.detail}`
              : ` · ${question.detail}`}
        </p>
      ) : null}

      <div className="accordi-controls" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => void start()}>
          <Play size={16} /> {answered ? "Prossimo" : "Inizia"}
        </button>
      </div>

      {/* ---------- Risultati ---------- */}
      <SectionTitle>I tuoi risultati</SectionTitle>
      <Card className="card-pad">
        <div className="ear-progress">
          {stats.map((s) => (
            <div key={s.mode} className="ear-row">
              <div className="ear-row-top">
                <span>{s.label}</span>
                <span className="text3">
                  {s.correct}/{s.total}
                </span>
              </div>
              <div className="ear-bar">
                <i style={{ width: `${s.percent}%` }} />
              </div>
            </div>
          ))}
        </div>

        {activeStats.mistakes.length ? (
          <>
            <label className="train-label">Errori più frequenti</label>
            <div className="ear-mistakes">
              {activeStats.mistakes.map((m) => (
                <span key={m.label} className="chip">
                  {m.label} · {m.count}
                </span>
              ))}
            </div>
          </>
        ) : null}

        {activeStats.recent.length ? (
          <>
            <label className="train-label">Ultimi esercizi</label>
            <div className="trainer-track">
              {activeStats.recent.map((ok, i) => (
                <span
                  key={i}
                  className={`trainer-pip${ok ? " done" : ""}`}
                  title={ok ? "Corretto" : "Sbagliato"}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="tiny text3" style={{ marginTop: 12 }}>
            <TrendingUp size={12} style={{ verticalAlign: "-1px" }} /> Nessun
            esercizio ancora: inizia con Intervalli per vedere i tuoi progressi.
          </p>
        )}

        {summary.total > 0 ? (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 16 }}
            onClick={() => setConfirmReset(true)}
          >
            <Trash2 size={14} /> Azzera i risultati
          </button>
        ) : null}
      </Card>

      <Confirm
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Azzerare i risultati?"
        message="Verranno rimossi tutti gli esercizi di Allena l'Orecchio. Le altre sezioni non ne risentono."
        confirmLabel="Azzera"
        onConfirm={() => {
          store.clearEarAnswers();
          setConfirmReset(false);
          toast("Risultati azzerati");
        }}
      />
    </div>
  );
}

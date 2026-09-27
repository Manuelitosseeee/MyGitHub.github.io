import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Play,
  Square,
  Image as ImageIcon,
  FileText,
  Plus,
  Minus,
  Clock,
  Timer,
  Target,
  Trophy,
  PlayCircle,
  StopCircle,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useStore, store } from "../../data/store";
import { useNav } from "../../nav";
import { useMetronome, useRunClock } from "../../engine/useMetronome";
import type {
  MetronomeConfig,
  BeatWeight,
  MetroSound,
  Subdivision,
} from "../../engine/metronome";
import { previewClick } from "../../engine/metronome";
import {
  Sheet,
  Confirm,
  SectionTitle,
  Card,
  BpmSlider,
  HoldBtn,
  Viewer,
  toast,
} from "../../ui/primitives";
import { cx, clamp } from "../../lib/utils";
import {
  formatDateShortIT,
  formatDuration,
  formatDurationClock,
  formatTimeIT,
  localDayKey,
  todayKey,
} from "../../lib/time";
import { progressForSong } from "../../data/selectors";
import type { Song, SheetMeta, StudySession } from "../../data/types";

const METRO_MIN = 20;
const METRO_MAX = 400;

const SUBS: Array<{ id: Subdivision; label: string }> = [
  { id: "none", label: "Semplice" },
  { id: "eighth", label: "Ottavi" },
  { id: "triplet", label: "Terzine" },
  { id: "sixteenth", label: "Sedicesimi" },
];

const SOUNDS: Array<{ id: MetroSound; label: string }> = [
  { id: "classic", label: "Legno" },
  { id: "digital", label: "Digitale" },
  { id: "metallic", label: "Metallo" },
];

function resizeWeights(weights: BeatWeight[], n: number): BeatWeight[] {
  if (n === weights.length) return [...weights];
  const out: BeatWeight[] = [];
  for (let i = 0; i < n; i++) {
    out.push(i < weights.length ? weights[i] : i === 0 ? 2 : 1);
  }
  return out;
}

export default function SongScreen({ songId }: { songId: string }) {
  const st = useStore();
  const nav = useNav();
  const song = st.songs.find((s) => s.id === songId);
  if (!song) {
    return (
      <div className="screen">
        <button className="back-btn" onClick={nav.back}>
          <ChevronLeft size={26} />
        </button>
        <p className="text2" style={{ padding: 20 }}>
          Brano non trovato.
        </p>
      </div>
    );
  }
  return <SongBody key={song.id} song={song} />;
}

function SongBody({ song }: { song: Song }) {
  const st = useStore();
  const nav = useNav();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const requestDelete = () => {
    if (st.settings.confirmDelete) {
      setDeleting(true);
      return;
    }
    store.deleteSong(song.id);
    toast("Brano eliminato");
    nav.back();
  };

  return (
    <div className="screen">
      <div className="navrow">
        <button
          className="back-btn back-btn-lg"
          onClick={nav.back}
          aria-label="Indietro"
        >
          <ChevronLeft size={30} />
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            className="icon-btn"
            onClick={() => setRenaming(true)}
            aria-label="Rinomina brano"
            title="Rinomina"
          >
            <Pencil size={18} />
          </button>
          <button
            className="icon-btn"
            style={{ background: "var(--bad-soft)", color: "var(--bad)" }}
            onClick={requestDelete}
            aria-label="Elimina brano"
            title="Elimina"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="screen-title" style={{ fontSize: 26 }}>
        {song.title}
      </div>
      <p className="screen-sub">
        Metronomo con tracking automatico: ogni cambio di BPM viene salvato nello
        storico del brano.
      </p>

      <GoalCard song={song} />
      <MetronomePanel song={song} />
      <SheetsCard song={song} />
      <SessionsCard song={song} />

      <RenameSheet
        open={renaming}
        initial={song.title}
        onClose={() => setRenaming(false)}
        onSave={(t) => {
          store.renameSong(song.id, t);
          setRenaming(false);
          toast("Brano rinominato");
        }}
      />
      <Confirm
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => {
          store.deleteSong(song.id);
          toast("Brano eliminato");
          nav.back();
        }}
        title="Eliminare il brano?"
        message={`Verranno cancellati anche progressi BPM, sessioni, spartiti e storico di “${song.title}”. L'operazione non è reversibile.`}
      />
    </div>
  );
}

/* ------------------------- Goal & progress ------------------------- */

function GoalCard({ song }: { song: Song }) {
  const st = useStore();
  const [editing, setEditing] = useState(false);
  const prog = progressForSong(song, st.events);
  const best = prog.best ?? song.lastBpm;
  const pct = prog.pct;

  return (
    <>
      <SectionTitle>Obiettivo</SectionTitle>
      <Card className="card-pad">
        {song.goalBpm === null ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: "space-between",
            }}
          >
            <div>
              <div className="row-title">Nessun obiettivo BPM</div>
              <div className="row-sub">
                Imposta la velocità a cui vuoi arrivare per questo brano.
              </div>
            </div>
            <button className="btn btn-soft btn-sm" onClick={() => setEditing(true)}>
              Imposta obiettivo
            </button>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <div className="row-title">
                <Target size={16} style={{ verticalAlign: "-2px" }} /> Obiettivo{" "}
                {song.goalBpm} BPM
              </div>
              <button className="tiny" style={{ color: "var(--acc)", fontWeight: 600 }} onClick={() => setEditing(true)}>
                Modifica
              </button>
            </div>
            <div className="prog" style={{ margin: "8px 0 10px" }}>
              <div
                className="fill"
                style={{ width: `${Math.round((pct ?? 0) * 100)}%` }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                {best !== null ? (
                  <span className="row-sub">
                    {song.goalBpm !== null && best >= song.goalBpm ? (
                      <span style={{ color: "var(--ok)", fontWeight: 700 }}>
                        <Sparkles size={12} style={{ verticalAlign: "-1px" }} />{" "}
                        Obiettivo raggiunto!
                      </span>
                    ) : (
                      <>
                        Raggiunto <b>{best}</b> di {song.goalBpm} BPM — mancano{" "}
                        <b>{Math.max(0, song.goalBpm - best)}</b> BPM
                      </>
                    )}
                  </span>
                ) : (
                  <span className="row-sub">
                    Inizia a suonare: i tuoi BPM compariranno qui.
                  </span>
                )}
              </div>
              {best !== null && song.goalBpm !== null && best < song.goalBpm ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Trophy size={15} style={{ color: "var(--warn)" }} />
                  <span className="small text2">Prossimo: +5</span>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Card>
      <GoalSheet
        open={editing}
        song={song}
        onClose={() => setEditing(false)}
        onSave={(goal) => {
          store.setSongGoal(song.id, goal);
          setEditing(false);
          toast(goal === null ? "Obiettivo rimosso" : `Obiettivo: ${goal} BPM`);
        }}
      />
    </>
  );
}

function GoalSheet({
  open,
  song,
  onClose,
  onSave,
}: {
  open: boolean;
  song: Song;
  onClose: () => void;
  onSave: (goal: number | null) => void;
}) {
  const [goal, setGoal] = useState<number>(song.goalBpm ?? 80);
  const [text, setText] = useState<string>(String(song.goalBpm ?? 80));
  useEffect(() => {
    if (open) {
      const g = song.goalBpm ?? 80;
      setGoal(g);
      setText(String(g));
    }
  }, [open, song.goalBpm]);
  const setGoalBoth = (g: number) => {
    setGoal(g);
    setText(String(g));
  };
  return (
    <Sheet open={open} onClose={onClose} title="Obiettivo BPM">
      <div style={{ padding: "6px 0 0" }}>
        <div className="text3 tiny" style={{ textAlign: "center" }}>
          A quale velocità vuoi arrivare?
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, textAlign: "center", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
          {goal}
          <span style={{ fontSize: 18, color: "var(--text-2)", fontWeight: 600 }}> BPM</span>
        </div>
        <BpmSlider
          value={goal}
          min={40}
          max={240}
          onChange={setGoalBoth}
          onChangeEnd={() => undefined}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 10px" }}>
          <input
            type="number"
            className="field"
            style={{ textAlign: "center", fontWeight: 700 }}
            placeholder="Scrivi un valore…"
            value={text}
            onChange={(e) => {
              const raw = e.target.value;
              setText(raw);
              const v = Number(raw);
              if (raw !== "" && Number.isFinite(v)) {
                setGoal(clamp(Math.round(v), 10, 400));
              }
            }}
            aria-label="Obiettivo BPM personalizzato"
          />
          <span className="text2" style={{ fontWeight: 700, fontSize: 15, flex: "none" }}>
            BPM
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            margin: "4px 0 14px",
            flexWrap: "wrap",
          }}
        >
          {[60, 80, 100, 120, 160, 200].map((v) => {
            const active = goal === v && text === String(v);
            return (
              <button
                key={v}
                className={cx("chip", active && "on")}
                onClick={() => setGoalBoth(v)}
              >
                {v}
              </button>
            );
          })}
        </div>
        <p className="tiny text3" style={{ textAlign: "center", marginBottom: 10 }}>
          Scrivi un numero qualsiasi oppure scegli un preset.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => onSave(null)}>
            Rimuovi
          </button>
          <button className="btn btn-primary" onClick={() => onSave(goal)}>
            Salva obiettivo
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ------------------------- Tracked metronome ------------------------- */

function MetronomePanel({ song }: { song: Song }) {
  const st = useStore();
  const [bpm, setBpmState] = useState<number>(song.lastBpm ?? 60);
  const [sub, setSub] = useState<Subdivision>(st.settings.metro.subdivision);
  const [sound, setSound] = useState<MetroSound>(st.settings.metro.sound);
  const [volume, setVolume] = useState<number>(st.settings.metro.volume);
  const [weights, setWeights] = useState<BeatWeight[]>([2, 1, 1, 1]);
  const met = useMetronome("song", () =>
    makeConfig(bpm, sub, weights, sound, volume)
  );
  const running = met.running;
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const engaged = useRef(false);
  const commitTimer = useRef<number | null>(null);

  const setBpm = (v: number, opts?: { commit?: "now" | "later" }) => {
    const nv = clamp(Math.round(v), METRO_MIN, METRO_MAX);
    setBpmState(nv);
    const engine = met.engine;
    if (engine) engine.setBpm(nv);
    if (!opts?.commit) return;
    if (commitTimer.current !== null) {
      window.clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
    const doCommit = () => {
      engaged.current = true;
      store.songMetroEvent(song.id, nv);
    };
    if (opts.commit === "now") doCommit();
    else
      commitTimer.current = window.setTimeout(() => {
        doCommit();
        commitTimer.current = null;
      }, 700);
  };

  useEffect(() => {
    return () => {
      if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    };
  }, []);

  const setSubSafe = (s: Subdivision) => {
    setSub(s);
    met.engine?.update({ subdivision: s });
  };

  const setSoundSafe = (s: MetroSound) => {
    setSound(s);
    met.engine?.update({ sound: s });
    previewClick(s, volume > 0.001 ? volume : 0.85);
  };

  const setWeightsSafe = (w: BeatWeight[]) => {
    setWeights(w);
    met.engine?.update({ weights: w });
  };

  const autoSession = st.settings.autoSession;
  const activeSession = st.sessions.find(
    (x) => x.songId === song.id && x.end === null
  );
  const autoStarted = useRef(false);

  // Auto-start the study session when the metronome starts (if enabled).
  const start = async () => {
    engaged.current = true;
    store.songMetroEvent(song.id, bpmRef.current);
    if (autoSession && !activeSession) {
      store.startSession(song.id);
      autoStarted.current = true;
      toast("Sessione di studio avviata automaticamente");
    }
    const ok = await met.start();
    if (!ok) toast("Avvia l'audio: controlla che il volume non sia muto");
  };

  const stop = () => {
    met.stop();
  };

  // Auto-end the session when the metronome stops, whether the user pressed
  // stop or another metronome took over the audio.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !met.running) {
      if (autoStarted.current) {
        autoStarted.current = false;
        const s = st.sessions.find(
          (x) => x.songId === song.id && x.end === null
        );
        if (s) {
          store.endSession(s.id);
          toast("Sessione terminata e salvata");
        }
      }
    }
    wasRunning.current = met.running;
  }, [met.running, autoSession, song.id, st.sessions]);

  // Leaving the song screen unmounts this panel and stops the metronome:
  // close an auto-started session too so it does not stay "in corso".
  useEffect(() => {
    return () => {
      if (autoStarted.current) {
        autoStarted.current = false;
        const s = st.sessions.find(
          (x) => x.songId === song.id && x.end === null
        );
        if (s) store.endSession(s.id);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id]);

  const recordSeconds = useCallback(
    (s: number) => store.addPracticeSeconds(song.id, s),
    [song.id]
  );
  useRunClock(running, recordSeconds, recordSeconds);

  return (
    <>
      <SectionTitle>Metronomo del brano</SectionTitle>
      <Card className="metro-study-card">
        <div className="metro-study-stage">
          <div className="metro-study-status">
            <span className="metro-study-status-dot" />
            <span>Tracking attivo</span>
            <span className="metro-study-signature">{weights.length}/4</span>
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
          <div className="metro-study-tempo">
            <div className="metro-study-number">{bpm}</div>
            <div className="metro-study-unit">BPM</div>
            <div className="metro-tempo-name">{tempoName(bpm)}</div>
          </div>
          <SongTempoTicks bpm={bpm} />
          <div className="metro-study-context">
            <span>
              {song.lastBpm !== null && song.lastBpm !== bpm
                ? `Ripresa da ${song.lastBpm} BPM`
                : "Metronomo del brano"}
            </span>
            {running ? (
              <span className="metro-study-running"><Clock size={12} /> pratica in corso</span>
            ) : null}
          </div>
        </div>

        <div className="metro-study-controls">
          <div className="metro-study-adjust">
            <button
              className="metro-round-button"
              onClick={() => setBpm(bpm - 1, { commit: "now" })}
              disabled={bpm <= METRO_MIN}
              aria-label="Rallenta di un BPM"
            >
              <Minus size={19} />
            </button>
            <div className="metro-study-range">
              <BpmSlider
                value={bpm}
                min={METRO_MIN}
                max={METRO_MAX}
                onChange={(v) => setBpm(v)}
                onChangeEnd={() => setBpm(bpmRef.current, { commit: "now" })}
              />
            </div>
            <button
              className="metro-round-button"
              onClick={() => setBpm(bpm + 1, { commit: "now" })}
              disabled={bpm >= METRO_MAX}
              aria-label="Accelera di un BPM"
            >
              <Plus size={19} />
            </button>
          </div>
          <button
            className={cx("metro-glass-play", "metro-study-play", running && "is-playing")}
            onClick={() => (running ? stop() : void start())}
            aria-label={running ? "Ferma il metronomo" : "Avvia il metronomo"}
          >
            {running ? <Square size={25} fill="currentColor" /> : <Play size={27} fill="currentColor" />}
          </button>

          <div className="divider" style={{ margin: "16px 0 12px" }} />

          <div style={{ marginBottom: 16 }}>
            <div className="text3 tiny" style={{ marginBottom: 6 }}>
              Suddivisione
            </div>
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
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="text3 tiny" style={{ marginBottom: 6 }}>
              Battiti per battuta
            </div>
            <div className="chip-row" style={{ marginBottom: 10 }}>
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
            <div className="text3 tiny" style={{ marginBottom: 6 }}>
              Tocca ogni battito per cambiarlo: <b>—</b> silenzio, <b>•</b> tempo,{" "}
              <b>●</b> accento
            </div>
            <div className="pgrid" style={{ marginBottom: 10 }}>
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
              <button
                className="chip"
                onClick={() => setWeightsSafe([2, 1, 1, 1, 1, 1])}
              >
                6/8
              </button>
              <button className="chip" onClick={() => setWeightsSafe([2, 0, 1, 0])}>
                Sincope
              </button>
            </div>
          </div>

          <div>
            <div className="text3 tiny" style={{ marginBottom: 6 }}>
              Suono
            </div>
            <div className="chip-row" style={{ marginBottom: 10 }}>
              {SOUNDS.map((s) => (
                <button
                  key={s.id}
                  className={cx("chip", sound === s.id && "on")}
                  onClick={() => setSoundSafe(s.id)}
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
                  }}
                />
              </div>
              <span className="tiny text3" style={{ width: 38, textAlign: "right" }}>
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="card-pad-sm">
        {activeSession ? (
          <SessionLiveRow
            session={activeSession}
            onEnd={() => {
              store.endSession(activeSession.id);
              toast("Sessione terminata e salvata");
            }}
          />
        ) : (
          <button
            className="btn btn-soft"
            onClick={() => {
              store.startSession(song.id);
              toast("Sessione di studio avviata");
            }}
          >
            <PlayCircle /> Inizia sessione di studio
          </button>
        )}
      </Card>
    </>
  );
}

function SongTempoTicks({ bpm }: { bpm: number }) {
  const active = Math.round(((bpm - METRO_MIN) / (METRO_MAX - METRO_MIN)) * 24);
  return (
    <div className="metro-tempo-ticks metro-study-ticks" aria-hidden="true">
      {Array.from({ length: 25 }, (_, index) => (
        <span key={index} className={cx(index <= active && "lit", index % 4 === 0 && "major")} />
      ))}
    </div>
  );
}

function tempoName(bpm: number): string {
  return bpm < 60 ? "LARGO" : bpm < 76 ? "ADAGIO" : bpm < 108 ? "ANDANTE" : bpm < 120 ? "MODERATO" : bpm < 168 ? "ALLEGRO" : "PRESTO";
}

function makeConfig(
  bpm: number,
  sub: Subdivision,
  weights: BeatWeight[],
  sound: MetroSound,
  volume: number
): MetronomeConfig {
  return { bpm, volume, sound, subdivision: sub, weights };
}

/* ------------------------- Beat dots ------------------------- */

export function BeatDots({
  flash,
  beats,
  weights,
  running,
}: {
  flash: { beat: number; accent: boolean; key: number } | null;
  beats: number;
  weights: BeatWeight[];
  running: boolean;
}) {
  return (
    <div className="beat-dots">
      {Array.from({ length: beats }, (_, i) => {
        const on = running && flash !== null && flash.beat === i;
        const accent = weights[i] === 2;
        return (
          <span key={i} className={cx("beat-dot", on && "on", accent && on && "accent")} />
        );
      })}
    </div>
  );
}

/* ------------------------- Sessions ------------------------- */

function SessionLiveRow({
  session,
  onEnd,
}: {
  session: StudySession;
  onEnd: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const elapsed = Math.round((now - session.start) / 1000);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
      }}
    >
      <span className="icon-badge" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
        <Timer />
      </span>
      <div style={{ flex: 1 }}>
        <div className="row-title" style={{ fontSize: 15 }}>
          Sessione in corso
        </div>
        <div className="row-sub" style={{ fontVariantNumeric: "tabular-nums" }}>
          iniziata alle {formatTimeIT(session.start)} · {formatDurationClock(elapsed)}
        </div>
      </div>
      <button className="btn btn-danger btn-sm" onClick={onEnd}>
        <StopCircle /> Termina
      </button>
    </div>
  );
}

function SessionsCard({ song }: { song: Song }) {
  const st = useStore();
  const sessions = st.sessions
    .filter((x) => x.songId === song.id && x.end !== null)
    .sort((a, b) => b.start - a.start);
  const [toDelete, setToDelete] = useState<StudySession | null>(null);
  const requestDelete = (x: StudySession) => {
    if (st.settings.confirmDelete) {
      setToDelete(x);
      return;
    }
    store.deleteSession(x.id);
    toast("Sessione eliminata");
  };
  return (
    <>
      <SectionTitle>Sessioni di studio</SectionTitle>
      {sessions.length === 0 ? (
        <Card className="card-pad">
          <div className="row-sub">
            Le sessioni di studio registrano data, durata e BPM. Il tracking
            automatico dei BPM funziona comunque anche senza avviare una sessione.
          </div>
        </Card>
      ) : (
        <Card>
          {sessions.map((x, i) => {
            const dur = x.end !== null ? Math.round((x.end - x.start) / 1000) : 0;
            return (
              <div key={x.id} className="row-link" style={{ padding: "12px 16px" }}>
                <span className="icon-badge" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
                  {i === 0 && localDayKey(x.start) === todayKey() ? <Sparkles /> : <Timer />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-title" style={{ fontSize: 15 }}>
                    {formatDateShortIT(x.start)} · {formatTimeIT(x.start)}
                    {dur > 0 ? ` · ${formatDuration(dur)}` : ""}
                  </div>
                  <div className="row-sub" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {x.startBpm !== null ? `da ${x.startBpm}` : "da —"}
                    {x.finalBpm !== null ? ` a ${x.finalBpm}` : ""} BPM
                    {x.finalBpm !== null && x.startBpm !== null && x.finalBpm > x.startBpm
                      ? " ↑"
                      : ""}
                  </div>
                </div>
                <button
                  className="back-btn"
                  style={{ color: "var(--text-3)" }}
                  onClick={() => requestDelete(x)}
                  aria-label="Elimina sessione"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            );
          })}
        </Card>
      )}
      <Confirm
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) store.deleteSession(toDelete.id);
          toast("Sessione eliminata");
        }}
        title="Eliminare la sessione?"
        message="Verrà rimosso solo questo record: lo storico dei BPM del brano resta intatto."
      />
    </>
  );
}

/* ------------------------- Sheets ------------------------- */

function SheetsCard({ song }: { song: Song }) {
  const st = useStore();
  const [view, setView] = useState<SheetMeta | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sheets = st.sheets
    .filter((s) => s.songId === song.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      <SectionTitle>Spartiti</SectionTitle>
      <Card className="card-pad">
        {sheets.length === 0 ? (
          <p className="row-sub" style={{ marginBottom: 12 }}>
            Aggiungi immagini o PDF dello spartito per averli sempre a portata di
            mano durante lo studio.
          </p>
        ) : (
          <div style={{ margin: "-4px 0 10px" }}>
            {sheets.map((s) => (
              <SheetRow key={s.id} sheet={s} onOpen={() => setView(s)} />
            ))}
          </div>
        )}
        <button className="btn btn-soft btn-sm" onClick={() => fileRef.current?.click()}>
          <ImageIcon /> Aggiungi immagine o PDF
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*,application/pdf,.pdf"
          multiple
          onChange={async (e) => {
            const files = e.target.files;
            if (files) {
              for (const f of Array.from(files)) {
                await store.addSheet(song.id, f);
              }
              toast("Spartito aggiunto");
            }
            e.target.value = "";
          }}
        />
      </Card>
      {view ? (
        <Viewer
          open
          onClose={() => setView(null)}
          title={view.name}
          getBlob={() => store.getBlob(view.id)}
        />
      ) : null}
    </>
  );
}

function SheetRow({
  sheet,
  onOpen,
}: {
  sheet: SheetMeta;
  onOpen: () => void;
}) {
  const st = useStore();
  const [confirming, setConfirming] = useState(false);
  const requestDelete = () => {
    if (st.settings.confirmDelete) {
      setConfirming(true);
      return;
    }
    store.deleteSheet(sheet.id);
    toast("Spartito rimosso");
  };
  return (
    <div className="list-item" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
      <button className="row-link" style={{ flex: 1, minWidth: 0, padding: "8px 0" }} onClick={onOpen}>
        <span className="icon-badge" style={{ background: "var(--field)", color: "var(--text-2)" }}>
          {sheet.kind === "pdf" ? <FileText /> : <ImageIcon />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="row-title"
            style={{ fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {sheet.name}
          </div>
          <div className="row-sub">
            {sheet.kind === "pdf" ? "PDF" : "Immagine"} ·{" "}
            {Math.max(1, Math.round(sheet.size / 1024))} KB
          </div>
        </div>
        <ChevronRight className="chev" size={17} />
      </button>
      <button className="back-btn" style={{ color: "var(--bad)" }} onClick={requestDelete}>
        <Trash2 size={16} />
      </button>
      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          store.deleteSheet(sheet.id);
          toast("Spartito rimosso");
        }}
        title="Rimuovere lo spartito?"
        message={`“${sheet.name}” verrà eliminato dal dispositivo.`}
      />
    </div>
  );
}

/* ------------------------- Rename ------------------------- */

function RenameSheet({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (t: string) => void;
}) {
  const [title, setTitle] = useState(initial);
  useEffect(() => {
    if (open) setTitle(initial);
  }, [open, initial]);
  return (
    <Sheet open={open} onClose={onClose} title="Rinomina brano">
      <div style={{ paddingTop: 6 }}>
        <input
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          placeholder="Nome del brano"
        />
        <button
          className="btn btn-primary btn-lg"
          style={{ marginTop: 14 }}
          disabled={!title.trim()}
          onClick={() => onSave(title)}
        >
          Salva
        </button>
      </div>
    </Sheet>
  );
}
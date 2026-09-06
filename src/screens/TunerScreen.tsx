import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Music } from "lucide-react";
import { useStore, store } from "../data/store";
import { useNav } from "../nav";
import { TunerEngine, type TunerReading } from "../engine/tuner";
import { GUITAR_STRINGS, midiLabelIT } from "../lib/music";
import { Seg, SectionTitle, Card, Empty } from "../ui/primitives";
import { cx } from "../lib/utils";

export default function TunerScreen() {
  const st = useStore();
  const nav = useNav();
  const ui = st.settings.tunerUi;
  const tunerRef = useRef<TunerEngine | null>(null);
  const [on, setOn] = useState(false);
  const [reading, setReading] = useState<TunerReading | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const lastPush = useRef(0);

  const getEngine = () => {
    if (!tunerRef.current) {
      const t = new TunerEngine();
      t.onReading = (r) => {
        const now = performance.now();
        if (now - lastPush.current < 45) return;
        lastPush.current = now;
        setReading(r);
      };
      tunerRef.current = t;
    }
    return tunerRef.current;
  };

  const start = async () => {
    const t = getEngine();
    await t.start();
    if (t.error) {
      setErr(t.error);
      setOn(false);
    } else {
      setErr(null);
      setOn(true);
    }
  };

  const stop = () => {
    tunerRef.current?.stop();
    setOn(false);
    setReading(null);
  };

  // keep the mic off when the user leaves the tuner tab
  const prevTab = useRef(nav.tab);
  useEffect(() => {
    if (prevTab.current === "accordatore" && nav.tab !== "accordatore") stop();
    prevTab.current = nav.tab;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.tab]);

  useEffect(() => {
    return () => {
      tunerRef.current?.stop();
    };
  }, []);

  const note = reading?.note ?? null;
  const cents = note?.cents ?? 0;
  const abs = Math.abs(cents);
  const tuned = on && note !== null && abs <= 3;
  const status = !on
    ? { cls: "wait", label: err ?? "Premi il microfono per accordare" }
    : note === null
      ? { cls: "wait", label: "Suona una corda…" }
      : tuned
        ? { cls: "tuned", label: "ACCORDATO" }
        : cents < 0
          ? { cls: "flat", label: `CALANTE ${abs}¢` }
          : { cls: "sharp", label: `CRESCENTE ${abs}¢` };

  return (
    <div className="screen">
      <div className="screen-title">Accordatore</div>
      <p className="screen-sub">
        Accordatura standard della chitarra (Mi–La–Re–Sol–Si–Mi). Rileva nota,
        ottava e la corda corrispondente.
      </p>

      <div style={{ marginBottom: 12 }}>
        <Seg
          options={[
            { id: "needle", label: "Lancetta" },
            { id: "line", label: "Linea" },
          ]}
          value={ui}
          onChange={(v) => store.updateSettings({ tunerUi: v })}
        />
      </div>

      {on ? (
        <Card>
          {ui === "needle" ? (
            <NeedleInterface note={note} on status={status} />
          ) : (
            <LineInterface note={note} on status={status} />
          )}
          <div style={{ padding: "6px 6px 14px" }}>
            <button className="btn btn-danger" onClick={stop}>
              <MicOff /> Ferma il microfono
            </button>
          </div>
        </Card>
      ) : err ? (
        <Card>
          <Empty
            icon={<MicOff />}
            title="Microfono non disponibile"
            body={err}
            action={
              <button className="btn btn-primary" onClick={() => void start()}>
                <Mic /> Riprova
              </button>
            }
          />
        </Card>
      ) : (
        <Card>
          <Empty
            icon={<Mic />}
            title="Avvia il microfono"
            body={
              <>
                Concedi l'accesso al microfono tramite il popup.{" "}
                <button className="link-btn" onClick={() => void start()}>
                  Se il popup non funziona, clicca qui
                </button>
              </>
            }
            action={
              <button className="btn btn-primary" onClick={() => void start()}>
                <Mic /> Usa il microfono
              </button>
            }
          />
        </Card>
      )}

      <SectionTitle>Corde della chitarra</SectionTitle>
      <Card>
        {GUITAR_STRINGS.map((s, i) => {
          const sel = on && note !== null && note.stringIndex === i;
          return (
            <div key={s.midi} className={cx("string-line", sel && "sel")}>
              <span className="string-num">{i + 1}</span>
              <span className="sn">{s.label}</span>
              <span className="shz">{s.freq.toFixed(2).replace(".", ",")} Hz</span>
              {sel ? <Music size={15} style={{ color: "var(--ok)" }} /> : null}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function InfoBlock({
  note,
  on,
}: {
  note: { nameIT: string; octave: number; freq: number; targetFreq: number; cents: number; stringLabel: string | null } | null;
  on: boolean;
}) {
  if (!note || !on) return null;
  return (
    <div
      className="text2 small"
      style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 6 }}
    >
      <span>
        <b>{midiLabelIT(noteToMidi(note))}</b>{" "}
        {note.freq.toFixed(1).replace(".", ",")} Hz
      </span>
      <span>
        {note.cents > 0 ? "+" : ""}
        {note.cents} cent
      </span>
      <span style={{ color: "var(--text)" }}>
        {note.stringLabel ? "✓ " : ""}
        {note.stringLabel ?? "nessuna corda"}
      </span>
    </div>
  );
}

function noteToMidi(n: { nameIT: string; octave: number }): number {
  const names = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
  const idx = names.indexOf(n.nameIT);
  return (n.octave + 1) * 12 + idx;
}

/* ----------------------- Interface 1: needle gauge ----------------------- */

const CX = 150;
const CY = 170;
const ARC_R = 118;

/** Polar point on the dial. θ = 0° at the top; positive θ rotates clockwise
 *  (sharp/high → right), negative counter-clockwise (flat/low → left). */
function ptOnArc(c: number, r: number): [number, number] {
  const a = (c * 1.8 * Math.PI) / 180; // ±50 cents → ±90°
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
}

/** Polyline path approximating an arc segment between two cents values. */
function arcSeg(cFrom: number, cTo: number, r: number, steps = 20): string {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const c = cFrom + ((cTo - cFrom) * i) / steps;
    const [x, y] = ptOnArc(c, r);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

function NeedleInterface({
  note,
  on,
  status,
}: {
  note: TunerReading["note"];
  on: boolean;
  status: { cls: string; label: string };
}) {
  const cents = note?.cents ?? 0;
  const ang = Math.max(-55, Math.min(55, cents * 1.1));
  const tuned = Math.abs(cents) <= 3;
  const color = !on || !note ? "var(--text-3)" : tuned ? "var(--ok)" : cents < 0 ? "var(--warn)" : "var(--bad)";
  return (
    <div style={{ padding: "12px 8px 4px", textAlign: "center" }}>
      {note && on ? (
        <div>
          <div className="note-big">{note.nameIT}</div>
          <div className="note-sub" style={{ marginBottom: 4 }}>
            ottava {note.octave}
            {note.stringLabel ? ` · ${note.stringLabel}` : ""}
          </div>
        </div>
      ) : (
        <div style={{ height: 120 }} />
      )}
      <svg viewBox="0 0 300 196" width="100%" style={{ maxWidth: 330 }} role="img" aria-label="Lancetta accordatura">
        {/* main arc */}
        <path d={arcSeg(-50, 50, ARC_R)} fill="none" stroke="var(--field)" strokeWidth="12" strokeLinecap="round" />
        {/* in-tune green band */}
        <path d={arcSeg(-9, 9, ARC_R)} fill="none" stroke="var(--ok)" strokeOpacity="0.9" strokeWidth="12" strokeLinecap="round" />
        {/* ticks */}
        {[-50, -25, 0, 25, 50].map((c) => {
          const [x1, y1] = ptOnArc(c, ARC_R + 14);
          const [x2, y2] = ptOnArc(c, ARC_R + 26);
          return (
            <line
              key={c}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--text-3)"
              strokeWidth={c === 0 ? 3 : 2}
              strokeLinecap="round"
            />
          );
        })}
        {/* needle (vertical at rest, pivots on the center dot) */}
        <g
          style={{
            transformOrigin: `${CX}px ${CY}px`,
            transform: `rotate(${ang}deg)`,
            transition: "transform 90ms linear",
          }}
        >
          <line x1={CX} y1={CY} x2={CX} y2={CY - ARC_R - 34} stroke={color} strokeWidth="5" strokeLinecap="round" />
        </g>
        <circle cx={CX} cy={CY} r="10" fill={color} />
        <circle cx={CX} cy={CY} r="4" fill={on ? "#fff" : "var(--bg)"} />
      </svg>
      <div
        className="text3 tiny"
        style={{ display: "flex", justifyContent: "space-between", padding: "0 12px", marginTop: -14 }}
      >
        <span>-50</span>
        <span style={{ color: "var(--ok)", fontWeight: 700 }}>0</span>
        <span>+50</span>
      </div>
      <div className="text3 tiny" style={{ margin: "2px 0 8px" }}>
        cent rispetto alla nota
      </div>
      <div className={cx("status-strip", status.cls)} style={{ width: "82%", marginLeft: "auto", marginRight: "auto" }}>
        {status.label}
      </div>
      <InfoBlock note={note} on={on} />
    </div>
  );
}

/* ----------------------- Interface 2: line ----------------------- */

function LineInterface({
  note,
  on,
  status,
}: {
  note: TunerReading["note"];
  on: boolean;
  status: { cls: string; label: string };
}) {
  const cents = note?.cents ?? 0;
  const pos = Math.max(-50, Math.min(50, cents));
  const pct = ((pos + 50) / 100) * 100;
  const tuned = Math.abs(cents) <= 3;
  const color = !on || !note ? "var(--text-3)" : tuned ? "var(--ok)" : cents < 0 ? "var(--warn)" : "var(--bad)";
  return (
    <div style={{ padding: "14px 8px 4px", textAlign: "center" }}>
      {note && on ? (
        <div>
          <div className="note-big">{note.nameIT}</div>
          <div className="note-sub" style={{ marginBottom: 8 }}>
            ottava {note.octave}
            {note.stringLabel ? ` · ${note.stringLabel}` : ""}
          </div>
        </div>
      ) : (
        <div style={{ height: 120 }} />
      )}
      <div style={{ position: "relative", height: 34, margin: "6px 6px 0" }}>
        {/* green zone */}
        <div
          style={{
            position: "absolute",
            left: "46%",
            right: "46%",
            top: 0,
            bottom: 10,
            background: "var(--ok-soft)",
            borderRadius: 4,
          }}
        />
        {/* line */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 12, height: 4, background: "var(--field)", borderRadius: 2 }} />
        {/* marker */}
        <div
          style={{
            position: "absolute",
            left: `calc(${pct}% - 11px)`,
            top: 3,
            transition: "left 90ms linear",
          }}
        >
          <div style={{ width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderBottom: `12px solid ${color}` }} />
          <div style={{ width: 14, height: 14, borderRadius: "50% 50% 50% 4px", background: color, transform: "rotate(-45deg) translate(1px,-1px)", marginTop: -3 }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 8px", color: "var(--text-2)", fontWeight: 600, fontSize: 12.5 }}>
        <span>Calante ↓</span>
        <span style={{ color: "var(--ok)" }}>Accordato</span>
        <span>Crescente ↑</span>
      </div>
      <div className={cx("status-strip", status.cls)} style={{ width: "80%", marginLeft: "auto", marginRight: "auto" }}>
        {status.label}
      </div>
      <InfoBlock note={note} on={on} />
    </div>
  );
}

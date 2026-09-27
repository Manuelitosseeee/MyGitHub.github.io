import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  Mic,
  MicOff,
  Music,
  SlidersHorizontal,
} from "lucide-react";
import { useStore, store } from "../data/store";
import { useNav } from "../nav";
import { TunerEngine, type TunerReading } from "../engine/tuner";
import { GUITAR_STRINGS, midiLabelIT } from "../lib/music";
import { Seg, SectionTitle, Card, Empty, toast } from "../ui/primitives";
import { cx } from "../lib/utils";

export default function TunerScreen() {
  const st = useStore();
  const nav = useNav();
  const ui = st.settings.tunerUi;
  const tunerRef = useRef<TunerEngine | null>(null);
  const [on, setOn] = useState(false);
  const [reading, setReading] = useState<TunerReading | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedString, setSelectedString] = useState(0);
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

  const isEssential = st.settings.appearance.skin === "liquidglass";
  const selected = GUITAR_STRINGS[selectedString] ?? GUITAR_STRINGS[0];
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
    <div className={cx("screen", isEssential && "tuner-immersive")}>
      {isEssential ? (
        <>
          <div className="tuner-essential-header">
            <button className="metro-round-button" onClick={() => nav.openTab("diario")} aria-label="Torna al diario">
              <ChevronLeft size={23} />
            </button>
            <h1>Accordatore</h1>
            <span className="metro-header-spacer" aria-hidden="true" />
          </div>

          <div className="tuner-preset-row">
            <button
              className="tuner-preset-button"
              onClick={() => toast("In arrivo")}
              aria-label="Accordatura selezionata: chitarra standard"
            >
              <span>Chitarra standard</span>
              <ChevronDown size={18} />
            </button>
            <button
              className="tuner-settings-button"
              onClick={() => toast("In arrivo")}
              aria-label="Impostazioni accordatore: in arrivo"
            >
              <SlidersHorizontal size={21} />
            </button>
          </div>

          <section className="tuner-essential-stage" aria-label="Accordatore cromatico">
            <button
              className="tuner-essential-gauge"
              onClick={() => (on ? stop() : void start())}
              aria-label={on ? "Ferma il microfono" : "Tocca per avviare l’accordatore"}
            >
              <svg viewBox="0 0 300 196" className="tuner-essential-dial" role="presentation">
                {Array.from({ length: 25 }, (_, index) => {
                  const centsAtTick = -48 + index * 4;
                  const [x1, y1] = ptOnArc(centsAtTick, ARC_R + 15);
                  const [x2, y2] = ptOnArc(centsAtTick, ARC_R + (index % 4 === 0 ? 31 : 23));
                  return (
                    <line
                      key={centsAtTick}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="currentColor"
                      strokeOpacity={index === 12 ? 0.98 : index % 4 === 0 ? 0.52 : 0.2}
                      strokeWidth={index === 12 ? 3.4 : index % 4 === 0 ? 2.2 : 1.5}
                      strokeLinecap="round"
                    />
                  );
                })}
                {Array.from({ length: 9 }, (_, index) => {
                  const centsAtTick = -40 + index * 10;
                  const [x1, y1] = ptOnArc(centsAtTick, ARC_R - 11);
                  const [x2, y2] = ptOnArc(centsAtTick, ARC_R + 2);
                  return (
                    <line
                      key={`inner-${centsAtTick}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="currentColor"
                      strokeOpacity=".12"
                      strokeWidth="1"
                      strokeLinecap="round"
                    />
                  );
                })}
                <line
                  x1={CX}
                  y1={CY - ARC_R - 25}
                  x2={CX}
                  y2={CY - ARC_R + 39}
                  stroke="currentColor"
                  strokeOpacity={tuned ? 1 : 0.95}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  style={{
                    filter: tuned ? "drop-shadow(0 0 8px rgba(255,255,255,.65))" : "drop-shadow(0 0 4px rgba(255,255,255,.28))",
                    transformOrigin: `${CX}px ${CY}px`,
                    transform: `rotate(${Math.max(-55, Math.min(55, cents * 1.1))}deg)`,
                    transition: "transform 100ms linear",
                  }}
                />
                <text x="29" y="160" className="tuner-gauge-accidental">♭</text>
                <text x="270" y="160" className="tuner-gauge-accidental">♯</text>
              </svg>

              <span className="tuner-note-reading">
                <strong>{note?.name ?? selected.name}</strong>
                <sup>{note?.octave ?? selected.octave}</sup>
              </span>
              <span className="tuner-frequency-reading">
                {(note?.freq ?? selected.freq).toFixed(1)} Hz
              </span>
              <span className="tuner-tap-hint" aria-hidden="true">
                {on ? "tocca per fermare" : "tocca per accordare"}
              </span>
            </button>

            <div className={cx("tuner-perfect-badge", tuned && "is-perfect", on && note && !tuned && "needs-tuning")} aria-live="polite">
              {tuned ? "Perfetto!" : err ?? (on ? (note ? (cents < 0 ? "Troppo bassa" : "Troppo alta") : "Suona una corda…") : "Pronta per accordare")}
            </div>
          </section>

          <div className="tuner-string-picker" role="group" aria-label="Seleziona la corda della chitarra">
            {GUITAR_STRINGS.map((string, index) => (
              <button
                key={string.midi}
                className={cx("tuner-string-chip", selectedString === index && "selected", on && note?.stringIndex === index && "is-heard")}
                onClick={() => setSelectedString(index)}
                aria-pressed={selectedString === index}
                aria-label={`${index + 1}ª corda, ${string.short}, ${string.freq.toFixed(1)} hertz`}
              >
                {string.name}<sub>{string.octave}</sub>
              </button>
            ))}
          </div>

          <div className="tuner-headstock-wrap" aria-hidden="true">
            <GuitarHeadstock activeString={on ? note?.stringIndex ?? null : selectedString} />
          </div>
        </>
      ) : (
        <>
          <div className="screen-title">Accordatore</div>
          <div className="tuning-preset">Chitarra standard <span>Mi · La · Re · Sol · Si · Mi</span></div>
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
              onChange={(value) => store.updateSettings({ tunerUi: value })}
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
            {GUITAR_STRINGS.map((string, index) => {
              const sel = on && note !== null && note.stringIndex === index;
              return (
                <div key={string.midi} className={cx("string-line", sel && "sel")}>
                  <span className="string-num">{index + 1}</span>
                  <span className="sn">{string.label}</span>
                  <span className="shz">{string.freq.toFixed(2).replace(".", ",")} Hz</span>
                  {sel ? <Music size={15} style={{ color: "var(--ok)" }} /> : null}
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}

function GuitarHeadstock({ activeString }: { activeString: number | null }) {
  // Tre chiavi per lato, come nella foto: il pedale esce dal bordo della paletta.
  const tuners = [
    { index: 0, postX: 94, y: 154, buttonX: 58, side: "left" },
    { index: 1, postX: 90, y: 116, buttonX: 58, side: "left" },
    { index: 2, postX: 94, y: 78, buttonX: 58, side: "left" },
    { index: 3, postX: 146, y: 78, buttonX: 182, side: "right" },
    { index: 4, postX: 150, y: 116, buttonX: 182, side: "right" },
    { index: 5, postX: 146, y: 154, buttonX: 182, side: "right" },
  ];
  // Le sei corde, ravvicinate sul ponte (y 204) e appena più aperte in alto.
  const stringStart = [109, 113, 117, 123, 127, 131];

  return (
    <svg className="tuner-headstock" viewBox="0 0 240 300" fill="none" role="presentation">
      <defs>
        <radialGradient id="headstock-wood" cx="48%" cy="18%" r="88%">
          <stop offset="0" stopColor="#292929" />
          <stop offset=".45" stopColor="#151515" />
          <stop offset="1" stopColor="#050505" />
        </radialGradient>
        <linearGradient id="headstock-outline" x1="0" y1="0" x2="240" y2="300" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity=".16" />
          <stop offset=".34" stopColor="white" stopOpacity=".76" />
          <stop offset=".65" stopColor="white" stopOpacity=".38" />
          <stop offset="1" stopColor="white" stopOpacity=".12" />
        </linearGradient>
        <linearGradient id="headstock-bevel" x1="58" y1="26" x2="182" y2="204" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity=".34" />
          <stop offset=".38" stopColor="white" stopOpacity=".02" />
          <stop offset="1" stopColor="white" stopOpacity=".18" />
        </linearGradient>
        <linearGradient id="headstock-metal" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f1f1f1" stopOpacity=".82" />
          <stop offset=".38" stopColor="#696969" />
          <stop offset=".7" stopColor="#d4d4d4" stopOpacity=".72" />
          <stop offset="1" stopColor="#3d3d3d" />
        </linearGradient>
        <filter id="headstock-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="headstock-shadow" x="-30%" y="-20%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
          <feOffset dy="3" result="offset" />
          <feComponentTransfer><feFuncA type="linear" slope=".6" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect
        x="0.5"
        y="0.5"
        width="239"
        height="299"
        rx="26"
        fill="#050505"
        stroke="rgba(255,255,255,.08)"
        strokeWidth="1"
      />

      {/* Onde sonore ai lati, come nella foto. */}
      <g className="tuner-string-waves" stroke="#d8d8d8" strokeLinecap="round" fill="none">
        <path d="M12 130v40" strokeOpacity=".22" />
        <path d="M19 116v68" strokeOpacity=".4" />
        <path d="M26 102v96" strokeOpacity=".66" />
        <path d="M33 122v56" strokeOpacity=".42" />
        <path d="M40 134v32" strokeOpacity=".24" />
        <path d="M228 130v40" strokeOpacity=".22" />
        <path d="M221 116v68" strokeOpacity=".4" />
        <path d="M214 102v96" strokeOpacity=".66" />
        <path d="M207 122v56" strokeOpacity=".42" />
        <path d="M200 134v32" strokeOpacity=".24" />
      </g>

      <path
        d="M120 30c-14 2-25 16-28 38-3 24-3 54 1 80 3 24 8 44 12 56h30c4-12 9-32 12-56 4-26 4-56 1-80-3-22-14-36-28-38Z"
        fill="url(#headstock-wood)"
        stroke="url(#headstock-outline)"
        strokeWidth="1.8"
        filter="url(#headstock-shadow)"
        strokeLinejoin="round"
      />
      <path
        d="M120 38c-11 2-20 13-22 32-3 22-3 51 0 76 3 23 8 40 11 54h22c3-14 8-31 11-54 3-25 3-54 0-76-2-19-11-30-22-32Z"
        stroke="url(#headstock-bevel)"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M100 54c10-7 30-7 40 0" stroke="white" strokeOpacity=".16" strokeWidth="1.1" />

      {/* Manico e tastiera: le corde passano sopra, come nel disegno. */}
      <path
        d="M104 204h32l3 96h-38Z"
        fill="#070707"
        stroke="url(#headstock-outline)"
        strokeOpacity=".55"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M106 224h28M105 240h30M104 258h32M102 278h34"
        stroke="#c9c9c9"
        strokeOpacity=".3"
        strokeWidth=".9"
      />

      {tuners.map(({ index, postX, y, buttonX, side }) => {
        const isActive = activeString === index;
        const startX = stringStart[index];
        const curveControl = side === "left" ? startX - 1 : startX + 1;
        return (
          <path
            key={`string-${index}`}
            d={`M${startX} 300V204C${curveControl} 168 ${postX} 148 ${postX} ${y + 3}V${y}`}
            stroke={isActive ? "#ffffff" : "#dcdcdc"}
            strokeOpacity={isActive ? "1" : ".5"}
            strokeWidth={isActive ? "1.3" : ".85"}
            strokeLinecap="round"
          />
        );
      })}

      {tuners.map(({ index, postX, y, buttonX, side }) => {
        const isActive = activeString === index;
        return (
          <g key={`tuner-${index}`}>
            {/* Asta che collega la chiave al bordo della paletta */}
            <rect
              x={side === "left" ? buttonX + 18 : postX}
              y={y - 2.1}
              width={side === "left" ? postX - buttonX - 18 : buttonX - 18 - postX}
              height="4.2"
              rx="2.1"
              fill="url(#headstock-metal)"
              fillOpacity=".72"
            />
            {/* Pedale della chiave */}
            <rect
              x={buttonX - 18}
              y={y - 11}
              width="36"
              height="22"
              rx="10"
              fill={isActive ? "#ededed" : "#0b0b0b"}
              stroke="url(#headstock-metal)"
              strokeOpacity={isActive ? "1" : ".72"}
              strokeWidth="1.4"
            />
            <rect
              x={buttonX - 11}
              y={y - 6}
              width="22"
              height="12"
              rx="6"
              fill="none"
              stroke="#ffffff"
              strokeOpacity={isActive ? ".5" : ".16"}
              strokeWidth="1"
            />
            <circle
              cx={postX}
              cy={y}
              r="3.4"
              fill={isActive ? "#f6f6f6" : "#191919"}
              stroke="url(#headstock-metal)"
              strokeOpacity=".7"
              strokeWidth="1"
            />
            {isActive ? (
              <circle cx={buttonX} cy={y} r="20" fill="white" opacity=".18" filter="url(#headstock-glow)" />
            ) : null}
          </g>
        );
      })}

      <path d="M104 206h32" stroke="#d8d8d8" strokeOpacity=".72" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
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

import { useState, type ReactNode } from "react";
import {
  Palette,
  Trash2,
  Type,
  TextCursorInput,
  PlayCircle,
  RotateCcw,
  Check,
} from "lucide-react";
import { useStore, store } from "../data/store";
import { SectionTitle, Card, Switch, Confirm, Seg, toast } from "../ui/primitives";
import { cx } from "../lib/utils";
import type {
  Appearance,
  AppSkin,
  FontChoice,
  FontSize,
  ThemeAccent,
} from "../data/types";

const ACCENT_OPTIONS: Array<{
  id: ThemeAccent;
  color: string;
  name: string;
}> = [
  { id: "blue", color: "#0a84ff", name: "Blu" },
  { id: "violet", color: "#bf5af2", name: "Viola" },
  { id: "green", color: "#34c759", name: "Verde" },
  { id: "amber", color: "#ff9f0a", name: "Ambra" },
  { id: "rose", color: "#ff375f", name: "Rosa" },
];

const FONT_OPTIONS: Array<{ id: FontChoice; label: string; desc: string }> = [
  { id: "system", label: "Classico", desc: "SF Pro / System — pulito e nativo" },
  { id: "serif", label: "Elegante", desc: "Caratteri con grazie, da spartito" },
  { id: "mono", label: "Tecnico", desc: "Monospaziato, cifre allineate" },
];

/* Same stacks as index.css: each option is rendered in its OWN font so you
 * can see what you are choosing, regardless of the currently applied one. */
const FONT_STACKS: Record<FontChoice, string> = {
  system:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto,"Helvetica Neue", sans-serif',
  serif:
    '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia,"Times New Roman", serif',
  mono:
    'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Code","Roboto Mono", monospace',
};

const SIZE_OPTIONS: Array<{ id: FontSize; label: string }> = [
  { id: "s", label: "Piccolo" },
  { id: "m", label: "Standard" },
  { id: "l", label: "Grande" },
  { id: "xl", label: "Extra" },
];

/* Aspetto Totale: 9 whole-app designs. Only colors/materials change — the
   font setting (Classico/Elegante/Tecnico) stays independent. */
const SKINS: Array<{
  id: AppSkin;
  name: string;
  desc: string;
  prev: {
    bg: string;
    radius: number;
    card: string;
    cardRadius: number;
    bar: string;
    barRadius: number;
  };
}> = [
  {
    id: "default",
    name: "Default",
    desc: "L'aspetto attuale di MyGitHub",
    prev: { bg: "linear-gradient(180deg,#f2f2f7,#e3e3e9)", radius: 12, card: "#ffffff", cardRadius: 10, bar: "rgba(248,248,250,0.9)", barRadius: 4 },
  },
  {
    id: "ceramica",
    name: "Ceramica smaltata",
    desc: "Smalti lucidi, profondità morbida",
    prev: { bg: "linear-gradient(180deg,#f7f0e5,#e5d9c3)", radius: 14, card: "linear-gradient(180deg,#fffdf8,#f2e8d7)", cardRadius: 12, bar: "#f5ecdc", barRadius: 6 },
  },
  {
    id: "vetro",
    name: "Vetro satinato",
    desc: "Trasparenze e sfocature eleganti",
    prev: { bg: "linear-gradient(160deg,#dbe7fb,#f1dcf2)", radius: 12, card: "rgba(255,255,255,0.6)", cardRadius: 10, bar: "rgba(255,255,255,0.5)", barRadius: 4 },
  },
  {
    id: "carta",
    name: "Carta premium",
    desc: "Texture editoriale e tattile",
    prev: { bg: "#f2eddf", radius: 8, card: "#fdfaf2", cardRadius: 6, bar: "#f5f0e3", barRadius: 3 },
  },
  {
    id: "metallo",
    name: "Metallo spazzolato",
    desc: "Acciaio satinato professionale",
    prev: { bg: "linear-gradient(160deg,#e1e3e9,#bfc2ca)", radius: 8, card: "linear-gradient(160deg,#f2f3f6,#d7dae0)", cardRadius: 6, bar: "linear-gradient(180deg,#e8eaef,#cccfd6)", barRadius: 3 },
  },
  {
    id: "argilla",
    name: "Argilla modellata",
    desc: "Volumi morbidi fatti a mano",
    prev: { bg: "linear-gradient(180deg,#f4e8dc,#ddc9b2)", radius: 16, card: "#f9efe2", cardRadius: 14, bar: "#eeddc8", barRadius: 8 },
  },
  {
    id: "analogico",
    name: "Studio analogico",
    desc: "Mixer e hi-fi vintage",
    prev: { bg: "linear-gradient(180deg,#eae3d0,#c8bfa2)", radius: 8, card: "#f7f2e3", cardRadius: 6, bar: "#e6deca", barRadius: 3 },
  },
  {
    id: "editoriale",
    name: "Minimalismo editoriale",
    desc: "Rivista musicale premium",
    prev: { bg: "#ffffff", radius: 5, card: "#ffffff", cardRadius: 2, bar: "#f2f2ef", barRadius: 1 },
  },
  {
    id: "liquido",
    name: "Liquid tactile",
    desc: "Fluido, gommoso ed elastico",
    prev: { bg: "linear-gradient(160deg,#e2e8fb,#f2dcef)", radius: 18, card: "#ffffff", cardRadius: 16, bar: "rgba(255,255,255,0.85)", barRadius: 9 },
  },
];

export default function SettingsScreen() {
  const st = useStore();
  const ap = st.settings.appearance;
  const [resetting, setResetting] = useState(false);

  const setAppearance = (patch: Partial<Appearance>) => {
    store.updateSettings({
      appearance: { ...st.settings.appearance, ...patch },
    });
  };

  return (
    <div className="screen">
      <div className="screen-title">Impostazioni</div>
      <p className="screen-sub">
        Personalizza l'aspetto e il comportamento di MyGitHub.
      </p>

      <SectionTitle>Aspetto Totale</SectionTitle>
      <Card className="card-pad">
        <p className="row-sub" style={{ marginBottom: 14 }}>
          9 design che cambiano tutto l'aspetto dell'app. I testi, i caratteri e
          le funzioni restano uguali.
        </p>
        <div className="skin-grid">
          {SKINS.map((s) => (
            <button
              key={s.id}
              className={cx("skin-opt", ap.skin === s.id && "on")}
              onClick={() => setAppearance({ skin: s.id })}
              title={s.desc}
              aria-pressed={ap.skin === s.id}
            >
              <span
                className="skin-prev"
                style={{ background: s.prev.bg, borderRadius: s.prev.radius }}
              >
                <span
                  className="skin-prev-card"
                  style={{
                    background: s.prev.card,
                    borderRadius: s.prev.cardRadius,
                  }}
                />
                <span
                  className="skin-prev-bar"
                  style={{ background: s.prev.bar, borderRadius: s.prev.barRadius }}
                />
              </span>
              <span className="skin-name">{s.name}</span>
              {ap.skin === s.id ? (
                <span className="skin-check">
                  <Check />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </Card>

      <SectionTitle>Personalizzazione</SectionTitle>
      <Card className="card-pad">
        <div className="row-title" style={{ fontSize: 15, marginBottom: 4 }}>
          <Palette size={15} style={{ verticalAlign: "-2px" }} /> Colore del tema
        </div>
        <p className="row-sub" style={{ marginBottom: 12 }}>
          Cinque colori che ridipingono tutta l'app, oppure il classico chiaro e
          scuro.
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          {ACCENT_OPTIONS.map((a) => (
            <button
              key={a.id}
              className={cx("dot-color", ap.accent === a.id && "on")}
              style={{ background: a.color }}
              onClick={() => setAppearance({ accent: a.id })}
              aria-label={a.name}
              title={a.name}
            >
              {ap.accent === a.id ? (
                <Check size={16} style={{ color: "#fff" }} />
              ) : null}
            </button>
          ))}
        </div>
        <div className="text3 tiny" style={{ marginBottom: 8 }}>
          Tema classico
        </div>
        <Seg
          options={[
            { id: "light", label: "Chiaro" },
            { id: "dark", label: "Scuro" },
            { id: "system", label: "Auto" },
          ]}
          value={ap.mode}
          onChange={(v) => setAppearance({ mode: v })}
        />
      </Card>

      <SectionTitle>Testo</SectionTitle>
      <Card className="card-pad">
        <div className="row-title" style={{ fontSize: 15, marginBottom: 10 }}>
          <Type size={15} style={{ verticalAlign: "-2px" }} /> Dimensione del testo
        </div>
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {SIZE_OPTIONS.map((s) => (
            <button
              key={s.id}
              className={cx("chip", ap.fontSize === s.id && "on")}
              onClick={() => setAppearance({ fontSize: s.id })}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div
          className="row-title"
          style={{ fontSize: 15, marginBottom: 8 }}
        >
          <TextCursorInput size={15} style={{ verticalAlign: "-2px" }} />{" "}
          Carattere
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              className={cx("row-link", ap.font === f.id && "sel-font")}
              style={{
                borderRadius: 13,
                border: `1.5px solid ${ap.font === f.id ? "var(--acc)" : "var(--sep)"}`,
                padding: "11px 14px",
              }}
              onClick={() => setAppearance({ font: f.id })}
            >
              <span style={{ flex: 1, textAlign: "left", fontFamily: FONT_STACKS[f.id] }}>
                <span className="row-title" style={{ display: "block", fontSize: 16 }}>
                  {f.label}
                </span>
                <span className="row-sub" style={{ display: "block" }}>
                  {f.desc}
                </span>
                <span
                  className="text3"
                  style={{ display: "block", marginTop: 6, fontSize: 15, letterSpacing: f.id === "mono" ? "-0.01em" : undefined }}
                >
                  120 BPM · AaBbCc 0123
                </span>
              </span>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "2px solid var(--sep)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                  background: ap.font === f.id ? "var(--acc)" : "transparent",
                  borderColor: ap.font === f.id ? "var(--acc)" : "var(--sep)",
                }}
              >
                {ap.font === f.id ? <Check size={13} style={{ color: "#fff" }} /> : null}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <SectionTitle>Comportamento</SectionTitle>
      <Card className="card-pad">
        <Row
          icon={<PlayCircle />}
          title="Avvio automatico sessione"
          sub="Quando apri un brano e avvii il metronomo, la sessione di studio parte da sola (e si chiude quando fermi il metronomo)."
          control={
            <Switch
              on={st.settings.autoSession}
              onChange={(v) => store.updateSettings({ autoSession: v })}
            />
          }
        />
        <div className="divider" />
        <Row
          icon={<Trash2 />}
          title="Conferma prima di eliminare"
          sub="Chiedi conferma prima di ogni eliminazione. Disattiva per eliminare subito."
          control={
            <Switch
              on={st.settings.confirmDelete}
              onChange={(v) => store.updateSettings({ confirmDelete: v })}
            />
          }
        />
      </Card>

      <SectionTitle>Dati</SectionTitle>
      <Card className="card-pad">
        <div className="row-title" style={{ fontSize: 15 }}>
          Ripristina tutto
        </div>
        <p className="row-sub" style={{ marginBottom: 12 }}>
          Elimina brani, progressi, sessioni, spartiti, corde e riporta
          MyGitHub alle impostazioni iniziali. L'operazione non è reversibile.
        </p>
        <button className="btn btn-danger" onClick={() => setResetting(true)}>
          <RotateCcw /> Elimina tutti i dati
        </button>
      </Card>

      <Confirm
        open={resetting}
        onClose={() => setResetting(false)}
        onConfirm={() => {
          void store.resetAll();
          toast("Tutti i dati sono stati eliminati");
        }}
        title="Eliminare tutti i dati?"
        message="Verranno cancellati per sempre brani, BPM registrati, sessioni, spartiti e storico delle corde. Sei sicuro?"
        confirmLabel="Elimina tutto"
      />
    </div>
  );
}

function Row({
  icon,
  title,
  sub,
  control,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  control: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span
        className="icon-badge"
        style={{ background: "var(--acc-soft)", color: "var(--acc)" }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-title" style={{ fontSize: 15 }}>
          {title}
        </div>
        <div className="row-sub">{sub}</div>
      </div>
      {control}
    </div>
  );
}
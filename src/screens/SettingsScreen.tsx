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
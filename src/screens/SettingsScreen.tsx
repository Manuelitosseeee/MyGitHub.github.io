import { useState, type ReactNode } from "react";
import { Check, PlayCircle, RotateCcw, Trash2, Type } from "lucide-react";
import { useStore, store } from "../data/store";
import { SectionTitle, Card, Switch, Confirm, toast } from "../ui/primitives";
import { cx } from "../lib/utils";
import { SKINS, type ConcreteFont, type SkinInfo } from "../data/skins";
import type { Appearance, AppTheme, FontChoice, FontSize, ThemeAccent } from "../data/types";

const MODES: Array<{ id: AppTheme; label: string }> = [
  { id: "light", label: "Chiaro" },
  { id: "dark", label: "Scuro" },
  { id: "system", label: "Automatico" },
];

const ACCENTS: Array<{ id: ThemeAccent; label: string; color: string }> = [
  { id: "blue", label: "Blu", color: "#0a84ff" },
  { id: "violet", label: "Viola", color: "#bf5af2" },
  { id: "green", label: "Verde", color: "#34c759" },
  { id: "amber", label: "Ambra", color: "#ff9f0a" },
  { id: "rose", label: "Corallo", color: "#ff375f" },
];

const FONTS: Array<{ id: FontChoice; label: string }> = [
  { id: "auto", label: "Del design" },
  { id: "system", label: "System" },
  { id: "rounded", label: "Arrotondato" },
  { id: "serif", label: "Serif" },
  { id: "mono", label: "Mono" },
  { id: "sans", label: "Sans" },
];

const SIZE_OPTIONS: Array<{ id: FontSize; label: string }> = [
  { id: "s", label: "Piccolo" },
  { id: "m", label: "Standard" },
  { id: "l", label: "Grande" },
  { id: "xl", label: "Extra" },
];

/* Concrete stacks for the font specimen inside each design preview tile. */
const FONT_STACK: Record<ConcreteFont, string> = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  serif: "'Iowan Old Style', Palatino, Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
  rounded: "ui-rounded, 'SF Pro Rounded', -apple-system, sans-serif",
  sans: "'Avenir Next', 'Century Gothic', 'Trebuchet MS', sans-serif",
};

export default function SettingsScreen() {
  const st = useStore();
  const ap = st.settings.appearance;
  const [resetting, setResetting] = useState(false);

  const setAppearance = (patch: Partial<Appearance>) => {
    store.updateSettings({ appearance: { ...st.settings.appearance, ...patch } });
  };

  return (
    <div className="screen">
      <div className="screen-title">Impostazioni</div>
      <p className="screen-sub">Aspetto, colori e preferenze dell'app.</p>

      <SectionTitle>Aspetto Totale</SectionTitle>
      <Card className="card-pad">
        <div className="skin-grid">
          {SKINS.map((skin) => (
            <SkinOption
              key={skin.id}
              skin={skin}
              on={ap.skin === skin.id}
              onSelect={() => setAppearance({ skin: skin.id })}
            />
          ))}
        </div>
        <button
          className="btn btn-ghost"
          style={{ marginTop: 14, width: "100%" }}
          onClick={() => {
            setAppearance({ skin: ap.previousSkin, mode: ap.previousMode });
            toast("Aspetto precedente ripristinato");
          }}
        >
          <RotateCcw size={18} /> Torna all'aspetto precedente
        </button>
      </Card>

      <SectionTitle>Modalità</SectionTitle>
      <Card className="card-pad">
        <div className="seg">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              className={cx("seg-item", ap.mode === mode.id && "active")}
              onClick={() => setAppearance({ mode: mode.id })}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </Card>

      {ap.skin !== "liquidglass" ? <><SectionTitle>Colore</SectionTitle>
      <Card className="card-pad">
        <div className="chip-row">
          {ACCENTS.map((accent) => (
            <button
              key={accent.id}
              className={cx("chip", ap.accent === accent.id && "on")}
              onClick={() => setAppearance({ accent: accent.id })}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: accent.color,
                  display: "inline-block",
                }}
              />
              {accent.label}
            </button>
          ))}
        </div>
      </Card></> : null}

      <SectionTitle>Testo</SectionTitle>
      <Card className="card-pad">
        <div className="row-title" style={{ fontSize: 15, marginBottom: 10 }}>
          <Type size={15} style={{ verticalAlign: "-2px" }} /> Dimensione
        </div>
        <div className="chip-row">
          {SIZE_OPTIONS.map((size) => (
            <button
              key={size.id}
              className={cx("chip", ap.fontSize === size.id && "on")}
              onClick={() => setAppearance({ fontSize: size.id })}
            >
              {size.label}
            </button>
          ))}
        </div>
        <div className="row-title" style={{ fontSize: 15, margin: "16px 0 10px" }}>
          <Type size={15} style={{ verticalAlign: "-2px" }} /> Carattere
        </div>
        <div className="chip-row">
          {FONTS.map((font) => (
            <button
              key={font.id}
              className={cx("chip", ap.font === font.id && "on")}
              onClick={() => setAppearance({ font: font.id })}
            >
              {font.label}
            </button>
          ))}
        </div>
      </Card>

      <SectionTitle>Comportamento</SectionTitle>
      <Card className="card-pad">
        <Row
          icon={<PlayCircle />}
          title="Avvio automatico sessione"
          sub="Avvia e chiude la sessione di studio insieme al metronomo del brano."
          control={
            <Switch
              on={st.settings.autoSession}
              onChange={(value) => store.updateSettings({ autoSession: value })}
            />
          }
        />
        <div className="divider" />
        <Row
          icon={<Trash2 />}
          title="Conferma prima di eliminare"
          sub="Chiedi conferma prima di eliminare un elemento."
          control={
            <Switch
              on={st.settings.confirmDelete}
              onChange={(value) => store.updateSettings({ confirmDelete: value })}
            />
          }
        />
      </Card>

      <SectionTitle>Dati</SectionTitle>
      <Card className="card-pad">
        <div className="row-title" style={{ fontSize: 15 }}>Ripristina tutto</div>
        <p className="row-sub" style={{ marginBottom: 12 }}>
          Elimina brani, progressi, sessioni, spartiti, corde e impostazioni. L'operazione non è reversibile.
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

function SkinOption({
  skin,
  on,
  onSelect,
}: {
  skin: SkinInfo;
  on: boolean;
  onSelect: () => void;
}) {
  const prev = skin.prev;
  return (
    <button className={cx("skin-opt", on && "on")} onClick={onSelect} aria-pressed={on}>
      <div className="skin-tile" style={{ background: prev.bg }}>
        <div
          className="st-panel"
          style={{ background: prev.card, color: prev.text, borderRadius: prev.radius }}
        >
          <span className="st-title" style={{ background: prev.text }} />
          <span className="st-line" />
          <span className="st-line" />
          <span className="st-bar" style={{ background: prev.text }} />
        </div>
        <div
          className="st-font"
          style={{ borderRadius: prev.radius / 2, background: prev.card, color: prev.text, fontFamily: FONT_STACK[skin.baseFont] }}
        >
          <b>Aa</b>
          <i>{skin.name}</i>
        </div>
      </div>
      <span className="skin-name">{skin.name}</span>
      <span className="skin-tag">{skin.tagline}</span>
      {on ? (
        <span className="skin-check">
          <Check />
        </span>
      ) : null}
    </button>
  );
}

function Row({
  icon,
  title,
  sub,
  control,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  control: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span className="icon-badge" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-title" style={{ fontSize: 15 }}>{title}</div>
        <div className="row-sub">{sub}</div>
      </div>
      {control}
    </div>
  );
}

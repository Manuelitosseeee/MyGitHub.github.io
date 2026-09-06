import { useEffect, useRef, useState } from "react";
import {
  Guitar,
  Plus,
  Trash2,
  Pencil,
  Camera,
  Bell,
  BellRing,
  X,
} from "lucide-react";
import { useStore, store } from "../data/store";
import type { StringChange, Mood } from "../data/types";
import {
  Sheet,
  Confirm,
  SectionTitle,
  Card,
  Switch,
  Empty,
  MoodPicker,
  MoodIcon,
  BlobImage,
  toast,
  todayInputValue,
  daysLabel,
  CloseX,
} from "../ui/primitives";
import { formatDateShortIT, daysSince, dayStart } from "../lib/time";
import { reminderDue, reminderTargetDate } from "../data/store";

export default function CordeScreen() {
  const st = useStore();
  const [editing, setEditing] = useState<{ rec: StringChange | null } | null>(null);
  const [delTarget, setDelTarget] = useState<StringChange | null>(null);
  const sorted = [...st.stringChanges].sort((a, b) => {
    if (a.changeDate !== b.changeDate) return a.changeDate < b.changeDate ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
  const current = sorted[0] ?? null;
  const history = sorted.slice(1);
  const overdue = reminderDue(st);
  const requestDelete = (r: StringChange) => {
    if (st.settings.confirmDelete) {
      setDelTarget(r);
      return;
    }
    store.deleteStringChange(r.id);
    toast("Cambio eliminato");
  };

  return (
    <div className="screen">
      <div className="screen-title">Corde</div>
      <p className="screen-sub">
        Registra ogni cambio di corde, guarda da quanti giorni sono montate e
        tieni traccia di come si comportano nel tempo.
      </p>

      {overdue !== null && st.settings.reminder.lastSeen !== todayKey() ? (
        <Card
          className="card-pad-sm"
          style={{ background: "var(--warn-soft)", boxShadow: "none", marginBottom: 12 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BellRing style={{ color: "var(--warn)", flex: "none" }} />
            <div style={{ flex: 1 }}>
              <b className="small">Promemoria cambio corde</b>
              <div className="tiny" style={{ color: "var(--text-2)" }}>
                Sono passati {overdue} giorni dall'ultimo cambio: è ora di
                controllare o cambiare le corde.
              </div>
            </div>
            <button
              className="icon-btn"
              onClick={() =>
                store.updateSettings({
                  reminder: { ...st.settings.reminder, lastSeen: todayKey() },
                })
              }
              aria-label="Chiudi promemoria"
            >
              <X size={16} />
            </button>
          </div>
        </Card>
      ) : null}

      {!current ? (
        <Card>
          <Empty
            icon={<Guitar />}
            title="Nessun cambio registrato"
            body="Quando monti un nuovo set di corde registralo qui: MyGitHub terrà il conto dei giorni e lo storico di tutti i cambi."
            action={
              <button className="btn btn-primary" onClick={() => setEditing({ rec: null })}>
                <Plus /> Registra il primo cambio
              </button>
            }
          />
        </Card>
      ) : (
        <>
          <button className="btn btn-soft" style={{ marginBottom: 14 }} onClick={() => setEditing({ rec: null })}>
            <Plus /> Nuovo cambio corde
          </button>
          <ReminderCard />
          <SectionTitle>Corde attuali</SectionTitle>
          <CurrentCard rec={current} onEdit={() => setEditing({ rec: current })} />
          {history.length > 0 ? (
            <>
              <SectionTitle>Storico cambi</SectionTitle>
              <HistoryList changes={history} onEdit={(r) => setEditing({ rec: r })} onDelete={requestDelete} />
            </>
          ) : null}
        </>
      )}

      {editing ? <ChangeSheet rec={editing.rec} onClose={() => setEditing(null)} /> : null}
      <Confirm
        open={delTarget !== null}
        onClose={() => setDelTarget(null)}
        onConfirm={() => {
          if (delTarget) {
            store.deleteStringChange(delTarget.id);
            toast("Cambio eliminato");
          }
          setDelTarget(null);
        }}
        title="Eliminare questo cambio?"
        message="Verrà rimosso dallo storico. L'operazione non è reversibile."
      />
    </div>
  );
}

function todayKey(): string {
  return todayInputValue();
}

function ReminderCard() {
  const st = useStore();
  const rem = st.settings.reminder;
  const enabled = rem.enabled;
  // Info line that makes the reminder verifiable at a glance: next due date,
  // days left, or how many days late the banner is.
  let hint: string | null = null;
  let late = false;
  if (enabled && st.stringChanges.length > 0) {
    const target = reminderTargetDate(st);
    const due = reminderDue(st);
    if (due !== null) {
      late = true;
      hint = `Promemoria scaduto da ${due} ${due === 1 ? "giorno" : "giorni"} — controlla o cambia le corde.`;
    } else if (target) {
      const left = Math.round(
        (dayStart(target) - dayStart(todayKey())) / 86400000
      );
      hint =
        left <= 0
          ? `Avviso previsto per oggi (${formatDateShortIT(target)})`
          : `Prossimo avviso: ${formatDateShortIT(target)} · tra ${left} ${left === 1 ? "giorno" : "giorni"}`;
    }
  }
  return (
    <>
      <SectionTitle>Promemoria</SectionTitle>
      <Card className="card-pad">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="icon-badge" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
            {enabled ? <BellRing /> : <Bell />}
          </span>
          <div style={{ flex: 1 }}>
            <div className="row-title" style={{ fontSize: 15 }}>
              Promemoria cambio corde
            </div>
            <div className="row-sub">
              {enabled
                ? `Ricordami di controllare le corde ogni ${rem.days} giorni`
                : "Ricevi un avviso quando è ora di cambiare le corde"}
            </div>
          </div>
          <Switch
            on={enabled}
            onChange={(v) =>
              store.updateSettings({
                reminder: { ...rem, enabled: v, lastSeen: v ? null : rem.lastSeen },
              })
            }
          />
        </div>
        {enabled ? (
          <>
            <div style={{ margin: "12px 0 4px" }} className="text3 tiny">
              Intervallo consigliato
            </div>
            <div className="chip-row">
              {[15, 30, 45, 60, 90].map((d) => (
                <button
                  key={d}
                  className={`chip ${rem.days === d ? "on" : ""}`}
                  onClick={() => store.updateSettings({ reminder: { ...rem, days: d } })}
                >
                  {d} giorni
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <DaysInput
                value={rem.days}
                onChange={(d) =>
                  store.updateSettings({ reminder: { ...rem, days: d } })
                }
              />
              <span className="text2" style={{ fontWeight: 700, flex: "none" }}>
                giorni
              </span>
            </div>
            {hint ? (
              <div
                className="tiny"
                style={{
                  marginTop: 12,
                  padding: "8px 11px",
                  borderRadius: 10,
                  fontWeight: 600,
                  background: late ? "var(--warn-soft)" : "var(--field)",
                  color: late ? "var(--warn)" : "var(--text-2)",
                  lineHeight: 1.4,
                }}
              >
                {hint}
              </div>
            ) : null}
          </>
        ) : null}
      </Card>
    </>
  );
}

/* Number field that only commits when a full valid value is typed, so
 * entering e.g. "90" doesn't get clamped mid-typing. */
function DaysInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (d: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  return (
    <input
      type="number"
      className="field"
      min={1}
      max={365}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const v = Number(raw);
        if (raw !== "" && Number.isFinite(v) && v >= 1 && v <= 365) {
          onChange(Math.round(v));
        }
      }}
      aria-label="Intervallo personalizzato in giorni"
    />
  );
}

function CurrentCard({ rec, onEdit }: { rec: StringChange; onEdit: () => void }) {
  const st = useStore();
  const days = daysSince(rec.changeDate);
  const mood = rec.mood;
  const next = (m: Mood): Mood => (m === "happy" ? "neutral" : m === "neutral" ? "sad" : "happy");
  return (
    <Card className="card-pad">
      <div style={{ display: "flex", gap: 14 }}>
        {rec.imageId ? (
          <BlobImage
            className="photo-thumb"
            getBlob={() => store.getBlob(rec.imageId!)}
            alt={rec.brand}
          />
        ) : (
          <span className="photo-thumb" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Guitar size={24} style={{ color: "var(--text-3)" }} />
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row-title">{rec.brand}</div>
          <div className="row-sub">
            montate il {formatDateShortIT(rec.changeDate)}
          </div>
          <div style={{ marginTop: 8 }}>
            {days === 0 ? (
              <span className="chip on" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
                montate oggi
              </span>
            ) : (
              <span className="chip on">
                montate da <b>{days}</b> {days === 1 ? "giorno" : "giorni"}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <button className="icon-btn" onClick={onEdit} aria-label="Modifica">
            <Pencil size={17} />
          </button>
          <button
            className="icon-btn"
            style={{ width: 46, height: 46, color: moodColor(mood) }}
            onClick={() => store.updateStringChange(rec.id, { mood: next(mood) })}
            aria-label="Cambia stato"
            title="Cambia umore"
          >
            <MoodIcon mood={mood} size={26} />
          </button>
        </div>
      </div>
      {rec.notes ? (
        <p className="small text2" style={{ marginTop: 12, lineHeight: 1.5 }}>
          {rec.notes}
        </p>
      ) : null}
    </Card>
  );
}

function HistoryList({
  changes,
  onEdit,
  onDelete,
}: {
  changes: StringChange[];
  onEdit: (r: StringChange) => void;
  onDelete: (r: StringChange) => void;
}) {
  return (
    <Card>
      {changes.map((rec, i) => {
        // duration this set stayed mounted = days to the previous (newer) change
        const prev = changes[i - 1];
        const usedDays =
          prev && prev.changeDate > rec.changeDate
            ? Math.round((dayStart(prev.changeDate) - dayStart(rec.changeDate)) / 86400000)
            : null;
        return (
          <button key={rec.id} className="row-link" onClick={() => onEdit(rec)}>
            {rec.imageId ? (
              <BlobImage className="photo-thumb" getBlob={() => store.getBlob(rec.imageId!)} alt={rec.brand} />
            ) : (
              <span className="photo-thumb" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Guitar size={20} style={{ color: "var(--text-3)" }} />
              </span>
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="row-title" style={{ display: "block", fontSize: 15 }}>
                {rec.brand}
              </span>
              <span className="row-sub" style={{ display: "block" }}>
                {formatDateShortIT(rec.changeDate)}
                {usedDays !== null ? ` · usate ${usedDays} ${usedDays === 1 ? "giorno" : "giorni"}` : ""}
              </span>
            </span>
            <MoodIcon mood={rec.mood} size={20} />
            <button
              className="back-btn"
              style={{ color: "var(--bad)" }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(rec);
              }}
              aria-label="Elimina"
            >
              <Trash2 size={16} />
            </button>
          </button>
        );
      })}
    </Card>
  );
}

function moodColor(m: Mood): string {
  return m === "happy" ? "var(--ok)" : m === "neutral" ? "var(--warn)" : "var(--bad)";
}

/* --------------- Add / edit form --------------- */

function ChangeSheet({ rec, onClose }: { rec: StringChange | null; onClose: () => void }) {
  const [date, setDate] = useState(rec?.changeDate ?? todayInputValue());
  const [brand, setBrand] = useState(rec?.brand ?? "");
  const [notes, setNotes] = useState(rec?.notes ?? "");
  const [mood, setMood] = useState<Mood>(rec?.mood ?? "happy");
  const [newImage, setNewImage] = useState<File | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = rec !== null;

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pick = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setNewImage(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const save = async () => {
    if (!brand.trim()) return;
    if (isEdit && rec) {
      await store.updateStringChange(rec.id, {
        changeDate: date,
        brand,
        notes,
        mood,
        image: newImage,
      });
      toast("Cambio aggiornato");
    } else {
      await store.addStringChange({
        changeDate: date,
        brand,
        notes,
        mood,
        image: newImage ?? null,
      });
      toast("Cambio corde registrato");
    }
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={isEdit ? "Modifica cambio" : "Nuovo cambio corde"}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Annulla
          </button>
          <button className="btn btn-primary" disabled={!brand.trim() || !date} onClick={() => void save()}>
            {isEdit ? "Salva modifiche" : "Registra cambio"}
          </button>
        </>
      }
    >
      <div style={{ paddingTop: 4 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -30, position: "relative", zIndex: 2 }}>
          <CloseX onClose={onClose} />
        </div>
        <label className="field-label">Data del cambio</label>
        <input
          type="date"
          className="field"
          value={date}
          max={todayInputValue()}
          onChange={(e) => setDate(e.target.value)}
        />
        <label className="field-label">Corde montate (nome / marca / tipo)</label>
        <input
          className="field"
          placeholder="es. D'Addario EJ16 Phosphor Bronze"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
        <label className="field-label">Come suonano?</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MoodPicker value={mood} onChange={setMood} />
          <span className="small text2">
            {mood === "happy" ? "Ottime, fresche" : mood === "neutral" ? "Nella media" : "Spente, da cambiare"}
          </span>
        </div>
        <label className="field-label">Foto (facoltativa)</label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {preview ? (
            <img className="photo-thumb" src={preview} alt="Anteprima" />
          ) : isEdit && rec?.imageId ? (
            <BlobImage className="photo-thumb" getBlob={() => store.getBlob(rec.imageId!)} alt={brand || "Foto"} />
          ) : (
            <button
              className="photo-add"
              onClick={() => fileRef.current?.click()}
              aria-label="Aggiungi foto"
            >
              <Camera />
            </button>
          )}
          {preview || (isEdit && rec?.imageId) ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                Cambia
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => pick(null)}>
                Rimuovi
              </button>
            </div>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/*"
            onChange={(e) => {
              pick(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </div>
        <label className="field-label">Note (facoltative)</label>
        <textarea
          className="field"
          placeholder="Suono, intonazione, quando le hai montate…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Sheet>
  );
}



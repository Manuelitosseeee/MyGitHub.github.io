import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ChevronRight, Mic, Music2, Pause, Play, Plus, RotateCcw, Square, Trash2, X } from "lucide-react";
import { store, useStore } from "../data/store";
import type { RecordingMeta } from "../data/types";
import { Confirm, Empty, Sheet, toast } from "../ui/primitives";
import { RecordingCapture } from "../recordings/recorder";
import { AudioPlayer, audioTime } from "../recordings/AudioPlayer";
import "../recordings/recordings.css";

type TakeSong = { songId: string | null; title: string };
const when = (date: number) => new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(date);

export default function RecordingsScreen({ active }: { active: boolean }) {
  const st = useStore();
  const [capture] = useState(() => new RecordingCapture());
  const take = useSyncExternalStore(capture.subscribe, capture.getSnapshot);
  const [choosing, setChoosing] = useState(false);
  const [draft, setDraft] = useState<TakeSong | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const generation = useRef(0);
  const selected = st.recordings.find((recording) => recording.id === selectedId);
  const title = (recording: RecordingMeta | TakeSong) => st.songs.find((song) => song.id === recording.songId)?.title ?? recording.title;

  useEffect(() => {
    if (!active && take.status === "recording") capture.pause();
  }, [active, take.status, capture]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) capture.pause(); };
    document.addEventListener("visibilitychange", hidden);
    const reset = () => { generation.current++; capture.cancel(); setDraft(null); setSelectedId(null); setChoosing(false); setSaving(false); setSaveError(""); setDiscarding(false); };
    window.addEventListener("mygithub:reset-data", reset);
    return () => { generation.current++; capture.cancel(); document.removeEventListener("visibilitychange", hidden); window.removeEventListener("mygithub:reset-data", reset); };
  }, [capture]);
  useEffect(() => {
    if (!draft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft]);

  const cancel = () => { capture.cancel(); setDraft(null); setSaveError(""); setDiscarding(false); };
  const save = async () => {
    if (!draft || !take.blob || saving) return;
    const revision = generation.current;
    setSaving(true); setSaveError("");
    try {
      const result = await store.addRecording({ ...draft, title: title(draft), blob: take.blob, duration: take.seconds });
      if (revision !== generation.current) return;
      capture.cancel(); setDraft(null); setSelectedId(result.id); toast("Registrazione salvata");
      // Best effort only; a denied persistence request never blocks recording.
      void navigator.storage?.persist?.().catch(() => undefined);
    } catch {
      if (revision === generation.current) setSaveError("Salvataggio non riuscito. La prova è ancora qui: libera spazio e riprova, oppure scarica l’audio prima di uscire.");
    } finally { if (revision === generation.current) setSaving(false); }
  };

  return <div className="screen recordings-screen">
    {selected && !draft ? <>
      <button className="btn btn-soft btn-sm recording-back" onClick={() => setSelectedId(null)}><ArrowLeft size={17} /> Tutte le registrazioni</button>
      <div className="screen-title">{title(selected)}</div>
      <p className="screen-sub">{when(selected.createdAt)} · {audioTime(selected.duration)}</p>
      <SavedRecording key={selected.id} recording={selected} title={title(selected)} active={active} onDeleted={() => setSelectedId(null)} />
    </> : <>
      <div className="screen-title">Registrazioni</div>
      <p className="screen-sub">Registra una prova, riascoltala e annota ciò che vuoi migliorare.</p>
      {!draft && <button className="btn btn-primary recording-new" onClick={() => setChoosing(true)}><Plus size={20} /> Nuova registrazione</button>}
      {draft && <section className="card card-pad recording-capture" aria-label="Registrazione in corso">
        <div className="recording-capture-heading"><span className="icon-badge"><Mic size={23} /></span><div><p className="recording-eyebrow">{take.status === "review" ? "LA TUA PROVA" : "NUOVA REGISTRAZIONE"}</p><h2>{title(draft)}</h2></div></div>
        {take.status === "review" && take.blob ? <>
          <p className="row-sub">Riascolta la prova prima di salvarla.</p>
          <AudioPlayer blob={take.blob} duration={take.seconds} active={active} filename={title(draft)} />
          <div className="recording-actions recording-review-actions">
            <button className="btn btn-soft" disabled={saving} onClick={() => { setSaveError(""); void capture.start(); }}><RotateCcw size={18} /> Rifai</button>
            <button className="btn btn-primary" disabled={saving} onClick={() => void save()}>{saving ? "Salvataggio…" : "Salva registrazione"}</button>
          </div>
        </> : <>
          <div className="recording-clock" role="timer" aria-label="Durata della registrazione">{audioTime(take.seconds)}</div>
          <div className="recording-status" role="status"><span className={take.status === "recording" ? "recording-dot is-recording" : "recording-dot"} />{take.status === "requesting" ? "Attendo il permesso del microfono…" : take.status === "recording" ? "Registrazione in corso" : take.status === "paused" ? "In pausa" : take.status === "finishing" ? "Preparo il riascolto…" : "Pronto per registrare"}</div>
          <div className="recording-level" role="meter" aria-label="Livello del microfono" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(take.level * 100)}><i style={{ width: `${take.level * 100}%` }} /></div>
          <div className="recording-actions">
            {take.status === "recording" && <button className="btn btn-soft" onClick={() => capture.pause()}><Pause size={19} /> Metti in pausa</button>}
            {take.status === "paused" && <button className="btn btn-primary" onClick={() => capture.resume()}><Play size={19} /> Riprendi</button>}
            {["recording", "paused"].includes(take.status) && <>
              <button className="btn btn-primary" onClick={() => capture.stop()}><Square size={18} /> Termina</button>
              <button className="btn btn-soft" onClick={() => { capture.cancel(); void capture.start(); }}><RotateCcw size={18} /> Rifai da capo</button>
            </>}
            {take.status === "idle" && <button className="btn btn-primary" onClick={() => void capture.start()}><Mic size={18} /> Avvia registrazione</button>}
          </div>
          <p className="tiny text3 recording-hint">Le pause non vengono registrate. Se cambi sezione o app, la prova va in pausa.</p>
        </>}
        {(take.error || saveError) && <p className="recording-error" role="alert">{saveError || take.error}</p>}
        <button className="btn btn-soft btn-sm recording-cancel" disabled={saving || take.status === "finishing"} onClick={() => take.seconds > 0 || take.blob ? setDiscarding(true) : cancel()}><X size={16} /> Annulla registrazione</button>
      </section>}
      {st.recordings.length === 0 && !draft ? <Empty icon={<Mic />} title="La tua prima prova" body="Scegli un brano dalla libreria o scrivi un titolo, poi premi Registra." /> : st.recordings.length > 0 && <>
        <div className="section-title">LE TUE REGISTRAZIONI · {st.recordings.length}</div>
        <div className="card recording-list">{[...st.recordings].sort((a, b) => b.createdAt - a.createdAt).map((recording) => <button className="row-link" key={recording.id} disabled={!!draft} onClick={() => setSelectedId(recording.id)}>
          <span className="icon-badge"><Mic size={22} /></span><span className="recording-list-copy"><span className="row-title">{title(recording)}</span><span className="row-sub">{when(recording.createdAt)} · {audioTime(recording.duration)}</span>{recording.notes && <span className="recording-note-preview">{recording.notes}</span>}</span><ChevronRight size={18} className="text3" />
        </button>)}</div>
      </>}
      <p className="tiny text3 recording-local">Audio e note sono salvati su questo dispositivo. Puoi scaricare ogni prova dal lettore.</p>
    </>}
    <ChooseSong open={active && choosing} onClose={() => setChoosing(false)} onStart={(song) => { setDraft(song); setSelectedId(null); setChoosing(false); setSaveError(""); void capture.start(); }} />
    <Confirm open={active && discarding} title="Annullare questa prova?" message="L’audio non salvato verrà eliminato. Le registrazioni già salvate rimangono al loro posto." confirmLabel="Annulla registrazione" onConfirm={cancel} onClose={() => setDiscarding(false)} />
  </div>;
}

function ChooseSong({ open, onClose, onStart }: { open: boolean; onClose: () => void; onStart: (song: TakeSong) => void }) {
  const st = useStore();
  const [songId, setSongId] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const selected = st.songs.find((song) => song.id === songId);
  const custom = songId === "custom" || st.songs.length === 0;
  useEffect(() => { if (open) { setSongId(st.songs.length ? "" : "custom"); setCustomTitle(""); } }, [open]);
  return <Sheet open={open} onClose={onClose} title="Che brano stai suonando?">
    <div className="recording-choose">
      {st.songs.length > 0 && <><label className="field-label" htmlFor="recording-song">Scegli dalla libreria</label><select id="recording-song" className="field" value={songId} onChange={(event) => setSongId(event.target.value)}><option value="" disabled>Seleziona un brano</option>{st.songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}<option value="custom">Scrivi un altro brano…</option></select></>}
      {custom && <><label className="field-label" htmlFor="recording-title">Titolo del brano</label><input id="recording-title" className="field" placeholder="Es. Studio in La minore" value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} autoComplete="off" maxLength={240} /></>}
      <button className="btn btn-primary btn-lg" disabled={custom ? !customTitle.trim() : !selected} onClick={() => { if (custom && customTitle.trim()) onStart({ songId: null, title: customTitle.trim() }); else if (selected) onStart({ songId: selected.id, title: selected.title }); }}><Mic size={19} /> Registra</button>
      <button className="btn btn-soft" onClick={onClose}>Annulla</button>
    </div>
  </Sheet>;
}

function SavedRecording({ recording, title, active, onDeleted }: { recording: RecordingMeta; title: string; active: boolean; onDeleted: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notes, setNotes] = useState(recording.notes);
  const [noteStatus, setNoteStatus] = useState<"saved" | "saving" | "error">("saved");
  const noteRevision = useRef(0);
  useEffect(() => {
    let alive = true;
    void store.getBlob(recording.id).then((audio) => { if (alive) { setBlob(audio); if (!audio) setError("L’audio non è disponibile su questo dispositivo."); } }).catch(() => { if (alive) setError("Impossibile caricare l’audio. Riapri la registrazione e riprova."); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [recording.id]);
  const saveNotes = async (value: string) => {
    const revision = ++noteRevision.current;
    setNotes(value); setNoteStatus("saving");
    try { await store.updateRecordingNotes(recording.id, value); if (revision === noteRevision.current) setNoteStatus("saved"); }
    catch { if (revision === noteRevision.current) setNoteStatus("error"); }
  };
  const remove = async () => {
    if (deleteBusy) return;
    setDeleteBusy(true);
    try { await store.deleteRecording(recording.id); onDeleted(); toast("Registrazione eliminata"); }
    catch { setError("Eliminazione non riuscita. Riprova."); setDeleting(false); setDeleteBusy(false); }
  };
  return <>
    <section className="card card-pad">
      {loading && <p role="status" className="row-sub">Carico l’audio…</p>}
      {blob && <AudioPlayer blob={blob} duration={recording.duration} active={active} filename={`${title}-${new Date(recording.createdAt).toISOString().slice(0, 10)}`} />}
      {error && <p className="recording-error" role="alert">{error}</p>}
    </section>
    <section className="card card-pad recording-notes">
      <label className="field-label" htmlFor="performance-notes">Note sull’esecuzione</label>
      <textarea id="performance-notes" className="field" rows={6} placeholder="Es. Migliorare il passaggio alla battuta 10…" value={notes} onChange={(event) => void saveNotes(event.target.value)} />
      <div className="recording-note-status" role="status">{noteStatus === "saving" ? "Salvataggio…" : noteStatus === "error" ? <><span>Note non salvate.</span><button className="btn btn-soft btn-sm" onClick={() => void saveNotes(notes)}>Riprova</button></> : "Note salvate automaticamente"}</div>
    </section>
    <button className="btn btn-soft btn-sm recording-delete" disabled={deleteBusy} onClick={() => setDeleting(true)}><Trash2 size={16} /> Elimina registrazione</button>
    <Confirm open={active && deleting} title="Eliminare la registrazione?" message="L’audio e le note di questa prova verranno eliminati. Il brano rimane nella tua libreria." confirmLabel={deleteBusy ? "Eliminazione…" : "Elimina registrazione"} onConfirm={() => void remove()} onClose={() => { if (!deleteBusy) setDeleting(false); }} />
  </>;
}

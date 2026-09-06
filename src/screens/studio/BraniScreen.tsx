import { useRef, useState } from "react";
import { ListMusic, Plus, Target, Music2, Flag, ChevronRight } from "lucide-react";
import { useStore, store } from "../../data/store";
import { useNav } from "../../nav";
import { Sheet, Empty, toast } from "../../ui/primitives";

export default function BraniScreen() {
  const st = useStore();
  const nav = useNav();
  const [adding, setAdding] = useState(false);
  const songs = st.songs;
  const practiced = new Set(st.events.map((e) => e.songId));

  return (
    <div className="screen">
      <div className="screen-title">Brani</div>
      <p className="screen-sub">
        La tua libreria di studio. Ogni brano ha un metronomo dedicato che
        registra automaticamente i BPM che provi.
      </p>

      <button
        className="btn btn-primary"
        style={{ marginBottom: 14 }}
        onClick={() => setAdding(true)}
      >
        <Plus size={20} /> Nuovo brano
      </button>

      {songs.length === 0 ? (
        <Empty
          icon={<ListMusic />}
          title="Nessun brano ancora"
          body="Aggiungi un brano (solo il nome, senza file audio) e inizia a studiarlo con il metronomo: MyGitHub ricorderà ogni tuo progresso."
          action={
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              Aggiungi il primo brano
            </button>
          }
        />
      ) : (
        <div className="card">
          {songs.map((song) => {
            const last = song.lastBpm;
            return (
              <button
                key={song.id}
                className="row-link"
                onClick={() => nav.openSong(song.id)}
              >
                <span
                  className="icon-badge"
                  style={{ background: "var(--acc-soft)", color: "var(--acc)" }}
                >
                  <Music2 />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="row-title" style={{ display: "block" }}>
                    {song.title}
                  </span>
                  <span className="row-sub" style={{ display: "block" }}>
                    {last !== null
                      ? practiced.has(song.id)
                        ? `Ultimo studio: ${last} BPM`
                        : `Pronto per iniziare da ${last} BPM`
                      : "Nuovo brano — parti dal tuo tempo"}
                  </span>
                </span>
                {song.goalBpm !== null ? (
                  <span className="goal-tag">
                    <Flag size={11} style={{ verticalAlign: "-1px" }} />{" "}
                    {song.goalBpm}
                  </span>
                ) : (
                  <Target size={18} className="text3" />
                )}
                <ChevronRight className="chev" size={18} />
              </button>
            );
          })}
        </div>
      )}

      <AddSongSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(title, goal) => {
          const s = store.addSong(title, goal);
          toast("Brano aggiunto");
          setAdding(false);
          nav.openSong(s.id);
        }}
      />
    </div>
  );
}

function AddSongSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string, goal: number | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState<number | null>(null);
  const [customText, setCustomText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const pickGoal = (v: number | null) => {
    setGoal(v);
    setCustomText(v === null ? "" : String(v));
  };

  return (
    <Sheet open={open} onClose={onClose} title="Nuovo brano">
      <div style={{ paddingTop: 6 }}>
        <label className="field-label" htmlFor="song-title">
          Nome del brano
        </label>
        <input
          ref={inputRef}
          id="song-title"
          className="field"
          placeholder="es. Tarantella di Mertz"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          enterKeyHint="done"
        />
        <label className="field-label">Obiettivo BPM (facoltativo)</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[null, 60, 80, 100, 120, 140].map((v) => {
            const active =
              v === null
                ? goal === null && customText === ""
                : goal === v && customText === String(v);
            return (
            <button
              key={String(v)}
              className={`chip ${active ? "on" : ""}`}
              onClick={() => pickGoal(v)}
            >
              {v === null ? "Nessuno" : `${v}`}
            </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <input
            type="number"
            className="field"
            placeholder="Oppure scrivi un valore…"
            value={customText}
            onChange={(e) => {
              const raw = e.target.value;
              setCustomText(raw);
              const v = Number(raw);
              setGoal(
                raw === ""
                  ? null
                  : Number.isFinite(v) && v >= 20 && v <= 400
                    ? Math.round(v)
                    : null
              );
            }}
            aria-label="Obiettivo BPM personalizzato"
          />
          <span className="text2" style={{ fontWeight: 700, flex: "none" }}>
            BPM
          </span>
        </div>
        <button
          className="btn btn-primary btn-lg"
          style={{ marginTop: 16 }}
          disabled={!title.trim()}
          onClick={() => onAdd(title, goal)}
        >
          Aggiungi brano
        </button>
        <p className="tiny text3" style={{ textAlign: "center", marginTop: 10 }}>
          L'obiettivo si può cambiare in qualsiasi momento.
        </p>
      </div>
    </Sheet>
  );
}

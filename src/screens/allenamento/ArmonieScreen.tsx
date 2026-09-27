import { useCallback, useEffect, useRef, useState } from "react";
import {
  Lock,
  LockOpen,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  Unlock,
} from "lucide-react";
import {
  BpmSlider,
  Card,
  SectionTitle,
  Seg,
  Sheet,
  Switch,
  toast,
} from "../../ui/primitives";
import { ChordDiagram } from "../../training/ChordDiagram";
import { bestShape, shapesFor } from "../../training/chords";
import {
  CHARACTERS,
  COMPLEXITIES,
  generateProgression,
  referenceKey,
  type Character,
  type Complexity,
  type ProgressionChord,
} from "../../training/harmony";
import {
  noteName,
  letterName,
  CHORDS,
  chordNameIT,
  type ChordQuality,
} from "../../training/theory";
import { playChord, unlockAudio } from "../../training/audio";
import { store, useStore } from "../../data/store";

const LENGTHS = [2, 3, 4, 5, 6, 7, 8];
const MANUAL_QUALITIES: ChordQuality[] = [
  "maj",
  "min",
  "dom7",
  "maj7",
  "min7",
  "halfdim",
  "dim",
  "aug",
];

export default function ArmonieScreen() {
  const st = useStore();
  const favs = st.progressionFavs;

  const [keyPc, setKeyPc] = useState(0);
  const [minor, setMinor] = useState(false);
  const [character, setCharacter] = useState<Character>("pop");
  const [length, setLength] = useState(4);
  const [complexity, setComplexity] = useState<Complexity>("semplice");
  const [bpm, setBpm] = useState(84);
  const [loop, setLoop] = useState(true);
  const [seed, setSeed] = useState(3);
  const [chords, setChords] = useState<ProgressionChord[]>([]);
  const [locked, setLocked] = useState<boolean[]>([]);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [editing, setEditing] = useState<number | null>(null);
  const [inspect, setInspect] = useState<number | null>(null);
  const [showNotes, setShowNotes] = useState(true);

  const generate = useCallback(
    (keepLocks: boolean) => {
      setSeed((s) => s + 1);
      const fresh = generateProgression({
        keyPc,
        minor,
        character,
        length,
        complexity,
        seed: seed + 1,
      });
      setChords((prev) => {
        if (!keepLocks || prev.length === 0) return fresh;
        // Gli accordi bloccati restano al loro posto: si rigenera il resto
        // mantenendo lunghezza e posizione, così la coerenza non si rompe.
        return fresh.map((c, i) => (locked[i] ? prev[i] : c));
      });
      setLocked((prev) => {
        const next = prev.slice(0, fresh.length);
        while (next.length < fresh.length) next.push(false);
        return next;
      });
    },
    [keyPc, minor, character, length, complexity, seed, locked]
  );

  // Cambiando i parametri la progressione precedente non vale più.
  useEffect(() => {
    setChords([]);
    setLocked([]);
  }, [keyPc, minor, character, length, complexity]);

  /* ---------------- Riproduzione ---------------- */

  const timers = useRef<number[]>([]);

  const stop = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setPlaying(false);
    setCursor(-1);
  }, []);

  useEffect(() => stop, [stop]);

  const play = useCallback(async () => {
    await unlockAudio();
    stop();
    if (chords.length === 0) return;
    setPlaying(true);
    const beat = 60 / bpm;
    let round = 0;
    const schedule = () => {
      chords.forEach((c, i) => {
        const at = (round * chords.length + i) * beat * 1000;
        const id = window.setTimeout(() => {
          playChord(c.notes, { voice: "guitar", gain: 0.4, duration: beat * 0.95 });
          setCursor(i);
        }, at);
        timers.current.push(id);
      });
      round++;
      const id = window.setTimeout(
        () => (loop ? schedule() : setPlaying(false)),
        chords.length * beat * 1000
      );
      timers.current.push(id);
    };
    schedule();
  }, [chords, bpm, loop, stop]);

  return (
    <div className="train-body">
      <p className="screen-sub" style={{ marginBottom: 18 }}>
        Progressioni costruite con regole armoniche, non a caso: scegli il
        carattere e i gradi si seguono da soli.
      </p>

      <SectionTitle>Configurazione</SectionTitle>
      <Card className="card-pad train-form">
        <label className="train-label">Tonalità</label>
        <div className="train-chips">
          {Array.from({ length: 12 }, (_, i) => (
            <button
              key={i}
              className={`chip${keyPc === i ? " on" : ""}`}
              onClick={() => setKeyPc(i)}
            >
              {noteName(i)}
            </button>
          ))}
        </div>

        <label className="train-label">Modo</label>
        <Seg
          value={minor ? "minore" : "maggiore"}
          onChange={(v) => setMinor(v === "minore")}
          options={[
            { id: "maggiore", label: "Maggiore" },
            { id: "minore", label: "Minore" },
          ]}
        />

        <label className="train-label">Carattere</label>
        <Seg
          value={character}
          onChange={setCharacter}
          options={CHARACTERS.map((c) => ({ id: c.id, label: c.label }))}
        />
        <p className="tiny text3">
          {CHARACTERS.find((c) => c.id === character)?.hint}
        </p>

        <label className="train-label">Numero di accordi</label>
        <Seg
          value={String(length)}
          onChange={(v) => setLength(Number(v))}
          options={LENGTHS.map((n) => ({ id: String(n), label: String(n) }))}
        />

        <label className="train-label">Complessità</label>
        <Seg
          value={complexity}
          onChange={setComplexity}
          options={COMPLEXITIES.map((c) => ({ id: c.id, label: c.label }))}
        />
      </Card>

      <SectionTitle>Progressione</SectionTitle>
      <div className="harmony-keyline">
        <span>
          Tonalità di riferimento: <b>{referenceKey(keyPc, minor)}</b>
        </span>
      </div>

      {chords.length === 0 ? (
        <Card className="card-pad">
          <p className="tiny text3" style={{ marginBottom: 12 }}>
            Genera una progressione per vederla qui, con gradi, diagrammi e
            note da suonare.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={() => generate(false)}
          >
            <Sparkles size={16} /> Genera
          </button>
        </Card>
      ) : (
        <>
          <div className="harmony-strip">
            {chords.map((c, i) => {
              const rootPc = ((c.notes[0] % 12) + 12) % 12;
              const shape = bestShape(rootPc, c.quality);
              const isCursor = i === cursor;
              return (
                <div
                  key={i}
                  className={`harmony-card${locked[i] || isCursor ? " locked" : ""}`}
                >
                  <button
                    className="harmony-card-main"
                    onClick={() => {
                      setCursor(i);
                      setInspect(i);
                    }}
                    aria-label={`Dettagli accordo ${c.name}`}
                  >
                    <div className="harmony-card-name">{c.name}</div>
                    <div className="harmony-card-degree">{c.degree}</div>

                    {shape ? (
                      <div className="harmony-card-diagram">
                        <ChordDiagram shape={shape} compact />
                      </div>
                    ) : null}
                    {shape?.hasBarre ? (
                      <div className="harmony-card-barre">barrè</div>
                    ) : null}
                    {showNotes ? (
                      <div className="harmony-card-notes">
                        {c.notes.map((n) => noteName(n % 12)).join(" · ")}
                      </div>
                    ) : null}
                  </button>
                  <div className="harmony-card-actions">
                    <button
                      className={`harmony-act${locked[i] ? " on" : ""}`}
                      aria-label={locked[i] ? "Sblocca accordo" : "Blocca accordo"}
                      onClick={() =>
                        setLocked((l) => {
                          const n = [...l];
                          n[i] = !n[i];
                          return n;
                        })
                      }
                    >
                      {locked[i] ? <Lock size={13} /> : <Unlock size={13} />}
                    </button>
                    <button
                      className="harmony-act"
                      aria-label="Modifica accordo"
                      onClick={() => setEditing(i)}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="harmony-act"
                      aria-label="Ascolta accordo"
                      onClick={() => {
                        void unlockAudio();
                        playChord(c.notes, { voice: "guitar", gain: 0.42, duration: 1.3 });
                      }}
                    >
                      <Play size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="accordi-controls" style={{ marginTop: 4 }}>
            <button
              className="btn btn-primary"
              onClick={() => (playing ? stop() : void play())}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
              {playing ? "Ferma" : "Ascolta"}
            </button>
            <button className="btn" onClick={() => generate(false)}>
              <RefreshCw size={15} /> Rigenera
            </button>
          </div>

          {locked.some(Boolean) ? (
            <button
              className="btn btn-soft"
              style={{ width: "100%", marginTop: 9 }}
              onClick={() => generate(true)}
            >
              <LockOpen size={15} /> Rigenera tenendo i bloccati
            </button>
          ) : null}
        </>
      )}

      <SectionTitle>Riproduzione</SectionTitle>
      <Card className="card-pad train-form">
        <div className="train-slider">
          <BpmSlider value={bpm} min={50} max={180} onChange={setBpm} />
          <div className="train-slider-val">
            <span>{bpm} BPM</span>
            <span className="text3">{chords.length || length} accordi</span>
          </div>
        </div>
        <div className="train-switch-row">
          <span className="train-switch-label">
            Ripeti in continuo
            <em>Riparte dalla tonica a fine giro</em>
          </span>
          <Switch on={loop} onChange={setLoop} />
        </div>
        <div className="train-switch-row">
          <span className="train-switch-label">
            Mostra le note
            <em>Nomi delle note di ogni accordo</em>
          </span>
          <Switch on={showNotes} onChange={setShowNotes} />
        </div>
      </Card>

      <SectionTitle>Preferiti</SectionTitle>
      {favs.length === 0 ? (
        <Card className="card-pad">
          <p className="tiny text3">
            Salva una progressione per ritrovarla qui: resta anche se poi
            cambi tonalità o carattere.
          </p>
        </Card>
      ) : (
        <Card>
          {favs.map((f) => (
            <div key={f.id} className="fav-row">
              <Star size={16} className="text3" />
              <button
                className="fav-open"
                onClick={() => {
                  setKeyPc(f.keyPc);
                  setMinor(f.minor);
                  setCharacter(f.character as Character);
                  setLength(f.chords.length);
                  setBpm(f.bpm);
                  setChords(
                    generateProgression({
                      keyPc: f.keyPc,
                      minor: f.minor,
                      character: f.character as Character,
                      length: f.chords.length,
                      complexity: "semplice",
                      seed: 1,
                    })
                  );
                }}
              >
                <div className="fav-name">{f.name}</div>
                <div className="fav-sub">
                  {referenceKey(f.keyPc, f.minor)} · {f.degrees.join(" - ")}
                </div>
              </button>
              <button
                className="harmony-act"
                style={{ width: 34, flex: "none" }}
                aria-label="Elimina preferito"
                onClick={() => {
                  store.deleteProgressionFav(f.id);
                  toast("Preferito eliminato");
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </Card>
      )}

      {chords.length > 0 ? (
        <button
          className="btn btn-soft"
          style={{ width: "100%", marginTop: 12 }}
          onClick={() => {
            store.addProgressionFav({
              name: `${referenceKey(keyPc, minor)} ${
                CHARACTERS.find((c) => c.id === character)?.label ?? ""
              }`,
              keyPc,
              minor,
              character,
              degrees: chords.map((c) => c.degree),
              chords: chords.map((c) => c.name),
              bpm,
            });
            toast("Progressione salvata");
          }}
        >
          <Star size={15} /> Salva tra i preferiti
        </button>
      ) : null}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing !== null ? `Modifica ${chords[editing]?.degree ?? ""}` : ""}
      >
        {editing !== null ? (
          <EditChord
            chord={chords[editing]}
            onChange={(quality, rootPc) =>
              setChords((cs) =>
                cs.map((c, i) =>
                  i === editing ? manualChord(rootPc, quality, c.degree) : c
                )
              )
            }
          />
        ) : null}
      </Sheet>

      {/* Dettaglio dell'accordo: tutte le diteggiature disponibili */}
      <Sheet
        open={inspect !== null}
        onClose={() => setInspect(null)}
        title={inspect !== null ? chords[inspect]?.name ?? "" : ""}
      >
        {inspect !== null && chords[inspect] ? (
          <ChordDetail chord={chords[inspect]} />
        ) : null}
      </Sheet>
    </div>
  );
}

/** Costruisce un accordo da una scelta manuale, mantenendo il grado. */
function manualChord(rootPc: number, quality: ChordQuality, degree: string): ProgressionChord {
  const steps = CHORDS[quality].steps;
  const root = 48 + rootPc;
  return {
    degree,
    quality,
    inversion: 0,
    name: `${letterName(rootPc)}${CHORDS[quality].suffix}`,
    notes: steps.map((s) => root + s),
    slash: null,
  };
}

/**
 * Dettaglio di un accordo: nome per esteso, note, gradi e tutte le
 * diteggiature disponibili, barrè compresi. È la risposta al fatto che
 * la scheda mostrava sempre la posizione più facile e i barrè sparivano.
 */
function ChordDetail({ chord }: { chord: ProgressionChord }) {
  const rootPc = ((chord.notes[0] % 12) + 12) % 12;
  const shapes = shapesFor(rootPc, chord.quality);
  const barres = shapes.filter((s) => s.hasBarre);
  const open = shapes.filter((s) => !s.hasBarre);
  const [shapeIdx, setShapeIdx] = useState(0);
  const current = shapes[shapeIdx] ?? shapes[0];

  return (
    <div>
      <p className="tiny text3" style={{ marginBottom: 4 }}>
        {chordNameIT(rootPc, chord.quality)} · grado {chord.degree}
        {chord.slash ? ` · basso ${chord.slash}` : ""}
      </p>
      <p className="tiny text3" style={{ marginBottom: 14 }}>
        Note: {chord.notes.map((n) => noteName(n % 12)).join(" · ")}
      </p>

      {shapes.length === 0 ? (
        <p className="tiny text3">Nessuna diteggiatura disponibile per questo accordo.</p>
      ) : (
        <>
          <div className="train-diagram">
            {current ? <ChordDiagram shape={current} /> : null}
          </div>
          {shapes.length > 1 ? (
            <div className="accordi-controls" style={{ marginTop: 10 }}>
              <button
                className="btn btn-soft"
                onClick={() => setShapeIdx((i) => (i - 1 + shapes.length) % shapes.length)}
              >
                Precedente
              </button>
              <button
                className="btn btn-soft"
                onClick={() => setShapeIdx((i) => (i + 1) % shapes.length)}
              >
                Successiva
              </button>
            </div>
          ) : null}
          <p className="tiny text3" style={{ marginTop: 10, textAlign: "center" }}>
            Diteggiatura {shapeIdx + 1} di {shapes.length}
            {barres.length ? ` · ${barres.length} con barrè` : ""}
          </p>
        </>
      )}

      <button
        className="btn btn-primary"
        style={{ width: "100%", marginTop: 14 }}
        onClick={() => {
          void unlockAudio();
          playChord(chord.notes, { voice: "guitar", gain: 0.42, duration: 1.4 });
        }}
      >
        <Play size={16} /> Ascolta l&apos;accordo
      </button>
    </div>
  );
}

function EditChord({
  chord,
  onChange,
}: {
  chord: ProgressionChord;
  onChange: (quality: ChordQuality, rootPc: number) => void;
}) {
  const [rootPc, setRootPc] = useState(chord.notes[0] % 12);
  const [quality, setQuality] = useState<ChordQuality>(chord.quality);
  return (
    <div>
      <p className="tiny text3" style={{ marginBottom: 14 }}>
        Sostituisci questo accordo con uno della stessa tonalità o con uno
        qualsiasi: la progressione resta valida e suona subito.
      </p>
      <label className="train-label">Tipologia</label>
      <div className="train-chips">
        {MANUAL_QUALITIES.map((q) => (
          <button
            key={q}
            className={`chip${quality === q ? " on" : ""}`}
            onClick={() => {
              setQuality(q);
              onChange(q, rootPc);
            }}
          >
            {CHORDS[q].label}
          </button>
        ))}
      </div>
      <label className="train-label">Tonica</label>
      <div className="train-chips">
        {Array.from({ length: 12 }, (_, i) => (
          <button
            key={i}
            className={`chip${rootPc === i ? " on" : ""}`}
            onClick={() => {
              setRootPc(i);
              onChange(quality, i);
            }}
          >
            {noteName(i)}
          </button>
        ))}
      </div>
    </div>
  );
}

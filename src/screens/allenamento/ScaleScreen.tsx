import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RefreshCw, Shuffle, Volume2 } from "lucide-react";
import {
  BpmSlider,
  Card,
  SectionTitle,
  Seg,
  Switch,
} from "../../ui/primitives";
import { StaffView } from "../../training/StaffView";
import {
  SCALES,
  SCALE_BY_ID,
  keyName,
  keySignature,
  noteName,
  tonicMidi,
  type ScaleId,
} from "../../training/theory";
import {
  EXERCISES,
  generateExercise,
  type ExerciseId,
} from "../../training/exercises";
import {
  playNote,
  playSequence,
  unlockAudio,
  type SequencerHandle,
} from "../../training/audio";
import { useMetronome } from "../../engine/useMetronome";
import { midiLabelIT } from "../../lib/music";

/** Ottave di partenza della tonica (4 = Do4). */
const OCTAVES = [3, 4, 5];

export default function ScaleScreen() {
  const [keyPc, setKeyPc] = useState(0);
  const [scaleId, setScaleId] = useState<ScaleId>("major");
  const [octave, setOctave] = useState(4);
  const [selected, setSelected] = useState<ExerciseId[]>(["ascendente"]);
  const [patternLen, setPatternLen] = useState(4);
  const [bpm, setBpm] = useState(72);
  const [useMetro, setUseMetro] = useState(true);
  const [seed, setSeed] = useState(1);
  const [exercise, setExercise] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [volume, setVolume] = useState(0.8);

  const scale = SCALE_BY_ID[scaleId];
  const tonic = tonicMidi(keyPc, octave);
  const minor = scale.family === "minor" || scale.family === "mode" ? scaleId !== "ionian" && scaleId !== "lydian" && scaleId !== "mixolydian" : false;

  /** Note della scala: due ottave, dalla tonica. */
  const scaleNotes = useMemo(
    () => [...scale.steps.map((s) => tonic + s), ...scale.steps.map((s) => tonic + 12 + s)],
    [scale, tonic]
  );

  /** Esercizio generato: se non ne esiste uno, parte dalla scala. */
  const shown = exercise.length > 0 ? exercise : scaleNotes;

  const regenerate = useCallback(
    (kind?: ExerciseId) => {
      const kinds: ExerciseId[] = kind ? [kind] : selected;
      const notes: number[] = [];
      kinds.forEach((k, i) => {
        notes.push(
          ...generateExercise(k, tonic, scaleId, scale.steps, seed * 7919 + i * 131, patternLen)
        );
      });
      setExercise(notes.length ? notes : scaleNotes);
    },
    [selected, tonic, scaleId, scale.steps, seed, patternLen, scaleNotes]
  );

  // Cambiando scala o tonalità l'esercizio precedente non ha più senso.
  useEffect(() => {
    setExercise([]);
    stopPlayback();
  }, [scaleId, keyPc, octave, patternLen]);

  /* ---------------- Metronomo ---------------- */

  const metro = useMetronome(
    "allena-scale",
    useCallback(
      () => ({
        bpm,
        volume: 0.5,
        sound: "classic" as const,
        subdivision: "none" as const,
        weights: [2, 1, 1, 1] as Array<0 | 1 | 2>,
      }),
      [bpm]
    )
  );

  useEffect(() => () => metro.stop(), [metro]);

  const toggleMetro = async () => {
    if (metro.running) metro.stop();
    else await metro.start();
  };

  /* ---------------- Riproduzione dell'esercizio ---------------- */

  const seq = useRef<SequencerHandle | null>(null);

  const stopPlayback = useCallback(() => {
    seq.current?.stop();
    seq.current = null;
    setPlaying(false);
    setCursor(-1);
  }, []);

  const play = async () => {
    await unlockAudio();
    stopPlayback();
    if (useMetro) await metro.start();
    setPlaying(true);
    const seconds = 60 / bpm;
    seq.current = playSequence(shown, seconds, {
      voice: "piano",
      duration: Math.min(0.5, seconds * 0.9),
      gain: 0.5 * volume,
      loop: true,
      onNote: (i) => setCursor(i),
    });
  };

  const previewNote = async (midi: number) => {
    await unlockAudio();
    playNote(midi, { voice: "piano", gain: 0.45 * volume, duration: 0.7 });
  };

  const onToggle = () => {
    if (playing) {
      stopPlayback();
      if (metro.running) metro.stop();
    } else {
      void play();
    }
  };

  return (
    <div className="train-body">
      <p className="screen-sub" style={{ marginBottom: 18 }}>
        Scegli tonalità e scala, leggi il pentagramma e genera esercizi da
        suonare a ritmo.
      </p>

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

        <label className="train-label">Scala</label>
        <div className="train-chips">
          {SCALES.map((s) => (
            <button
              key={s.id}
              className={`chip${scaleId === s.id ? " on" : ""}`}
              onClick={() => setScaleId(s.id)}
            >
              {s.short}
            </button>
          ))}
        </div>

        <label className="train-label">Ottava di partenza</label>
        <Seg
          value={String(octave)}
          onChange={(v) => setOctave(Number(v))}
          options={OCTAVES.map((o) => ({ id: String(o), label: `${noteName(keyPc)}${o}` }))}
        />
      </Card>

      {/* Pentagramma */}
      <SectionTitle>Pentagramma</SectionTitle>
      <div className="train-staff-card">
        <StaffView notes={shown} keyPc={keyPc} currentIndex={cursor} />
        <div className="train-note-strip">
          {shown.slice(0, 24).map((m, i) => (
            <button
              key={i}
              className={`train-note-chip${i === cursor ? " on" : ""}`}
              onClick={() => previewNote(m)}
            >
              {midiLabelIT(m)}
            </button>
          ))}
        </div>
      </div>

      <div className="harmony-keyline">
        <span>
          {keyName(keyPc, minor)} · {scale.label} · {shown.length} note
        </span>
      </div>

      {/* Esercizi */}
      <SectionTitle>Genera esercizio</SectionTitle>
      <Card className="card-pad train-form">
        <div className="train-chips">
          {EXERCISES.map((e) => {
            const on = selected.includes(e.id);
            return (
              <button
                key={e.id}
                className={`chip${on ? " on" : ""}`}
                onClick={() =>
                  setSelected((s) => (on ? s.filter((x) => x !== e.id) : [...s, e.id]))
                }
              >
                {e.label}
              </button>
            );
          })}
        </div>
        {selected.includes("sequenze") ? (
          <>
            <label className="train-label">Note per frase</label>
            <Seg
              value={String(patternLen)}
              onChange={(v) => setPatternLen(Number(v))}
              options={[3, 4, 5, 6].map((n) => ({ id: String(n), label: `${n}` }))}
            />
          </>
        ) : null}
        <button
          className="btn btn-primary"
          style={{ marginTop: 12 }}
          disabled={selected.length === 0}
          onClick={() => {
            setSeed((s) => s + 1);
            regenerate();
          }}
        >
          <Shuffle size={16} /> Genera esercizio
        </button>
        <button
          className="btn btn-soft"
          style={{ marginTop: 9 }}
          onClick={() => {
            stopPlayback();
            setExercise([]);
          }}
        >
          <RefreshCw size={15} /> Torna alla scala
        </button>
      </Card>

      {/* Metronomo e playback */}
      <SectionTitle>Riproduzione</SectionTitle>
      <Card className="card-pad train-form">
        <div className="train-switch-row">
          <span className="train-switch-label">
            Metronomo
            <em>{metro.running ? "In ascolto" : "Fermo"}</em>
          </span>
          <Switch on={metro.running} onChange={() => void toggleMetro()} />
        </div>

        <div className="train-slider">
          <BpmSlider value={bpm} min={30} max={200} onChange={setBpm} />
          <div className="train-slider-val">
            <span>{bpm} BPM</span>
            <span className="text3">{shown.length} note</span>
          </div>
        </div>

        <div className="train-slider">
          <BpmSlider value={Math.round(volume * 100)} min={0} max={100} onChange={(v) => setVolume(v / 100)} />
          <div className="train-slider-val">
            <span>Volume</span>
            <span className="text3">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        <div className="train-switch-row">
          <span className="train-switch-label">
            Suona col metronomo
            <em>Riproduce l&apos;esercizio a tempo</em>
          </span>
          <Switch on={useMetro} onChange={setUseMetro} />
        </div>

        <div className="accordi-controls" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={onToggle}>
            {playing ? <Pause size={17} /> : <Play size={17} />}
            {playing ? "Ferma" : "Ascolta"}
          </button>
          <button
            className="btn"
            onClick={() => {
              void unlockAudio();
              playNote(tonic, { voice: "piano", gain: 0.45 * volume, duration: 0.8 });
            }}
          >
            <Volume2 size={16} /> Tonica
          </button>
        </div>
      </Card>

      {exercise.length > 0 ? (
        <p className="tiny text3" style={{ marginTop: 12 }}>
          {selected.length > 1
            ? `Esercizio composto da ${selected.length} varianti.`
            : "Esercizio generato. Cambiando scala o tonalità torna alla scala semplice."}{" "}
          {useMetro ? `${Math.round((60 / bpm) * 10) / 10} note al secondo.` : ""}
        </p>
      ) : null}

      <p className="tiny text3" style={{ marginTop: 8 }}>
        Armatura: {keySignature(keyPc, minor) === 0 ? "nessuna alterazione" : `${Math.abs(keySignature(keyPc, minor))} ${keySignature(keyPc, minor) > 0 ? "sharp" : "bemolle"}`}.
      </p>
    </div>
  );
}

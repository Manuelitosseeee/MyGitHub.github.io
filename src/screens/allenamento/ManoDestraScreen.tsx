import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RefreshCw, Shuffle } from "lucide-react";
import {
  BpmSlider,
  Card,
  SectionTitle,
  Seg,
  Switch,
} from "../../ui/primitives";
import { useMetronome } from "../../engine/useMetronome";
import { playNote, playSequence, unlockAudio, type SequencerHandle } from "../../training/audio";
import { midiLabelIT } from "../../lib/music";
import { noteName } from "../../training/theory";

/** Dita della mano destra */
export const FINGER_NAMES = [
  { id: "p", label: "p = pollice", full: "Pollice" },
  { id: "i", label: "i = indice", full: "Indice" },
  { id: "m", label: "m = medio", full: "Medio" },
  { id: "a", label: "a = anulare", full: "Anulare" },
] as const;

export type FingerId = "p" | "i" | "m" | "a";

/** Difficoltà: numero di dita usate e complessità del pattern */
export const DIFFICOLTIES = [
  { id: "facile", label: "Facile", fingerCount: 2, description: "2 dita" },
  { id: "medio", label: "Medio", fingerCount: 3, description: "3 dita" },
  { id: "difficile", label: "Difficile", fingerCount: 4, description: "4 dita" },
] as const;

/** 패턴 Villalobos-style preimpostati */
const BASE_PATTERNS: FingerId[][] = [
  // Tipo p i p i p m i a m a p i p i p (Villa-Lobos style)
  ["p", "i", "p", "i", "p", "m", "i", "a", "m", "a", "p", "i", "p", "i", "p"],
  // Alternanza pollice-indice
  ["p", "i", "p", "i", "p", "i", "p", "i"],
  // Pattern circolare p-i-m-a
  ["p", "i", "m", "a", "p", "i", "m", "a"],
  // Con anulare: p-i-m-a-m-i
  ["p", "i", "m", "a", "m", "i", "p", "i"],
  // Pattern simmetrico
  ["p", "i", "p", "m", "p", "i", "p", "m"],
  // Con ripetizioni
  ["p", "p", "i", "i", "m", "m", "a", "a"],
  // Pattern scalare
  ["p", "i", "m", "i", "p", "i", "m", "i"],
  // Mix: p-a-m-i
  ["p", "a", "m", "i", "p", "a", "m", "i"],
];

/** Genera una sequenza di dita in base alle dita selezionate e alla difficoltà. */
function generateFingerSequence(
  selectedFingers: FingerId[],
  difficulty: typeof DIFFICOLTIES[number]["id"],
  seed: number
): FingerId[] {
  const rng = mulberry32(seed >>> 0 || 1);
  
  const diff = DIFFICOLTIES.find(d => d.id === difficulty)!;
  const available = selectedFingers.length > 0 ? selectedFingers : ["p", "i", "m", "a"];
  const count = diff.fingerCount;
  
  // Se c'è un pattern base che usa le dita selezionate, usalo come base
  const basePattern = BASE_PATTERNS.find(pattern => {
    const patternFingers = new Set(pattern);
    const selectedSet = new Set(available);
    // Usa il pattern se tutte le dita del pattern sono tra quelle selezionate
    // o se il pattern è un sottoinsieme delle dita disponibili
    return [...patternFingers].every(f => selectedSet.has(f));
  }) || BASE_PATTERNS[0];
  
  // Seleziona quali dita usare dai pattern
  const fingersInPattern: FingerId[] = [...new Set(basePattern)].filter(f => available.includes(f));
  
  if (fingersInPattern.length === 0) {
    // available should never be empty, but type guard anyway
    fingersInPattern.push(available[0] as FingerId);
  }
  
  // Seleziona le prime N dita per la difficoltà
  const usedFingers: FingerId[] = fingersInPattern.slice(0, count);
  
  // Genera sequenza ripetendo il pattern base ma filtrando le dita
  const sequence: FingerId[] = [];
  const baseLen = basePattern.length;
  
  // Genera abbastanza note per 2-3 ripetizioni
  const targetLen = baseLen * 3;
  
  for (let i = 0; i < targetLen; i++) {
    const baseFinger = basePattern[i % baseLen];
    // Se la dita base non è tra quelle selezionate, ne usa una a caso
    const finger: FingerId = usedFingers.includes(baseFinger) ? baseFinger : usedFingers[Math.floor(rng() * usedFingers.length)];
    sequence.push(finger);
  }
  
  return sequence;
}

/** Simple seeded RNG */
function mulberry32(a: number) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

/** Mappa dita → note MIDI (diversi registri per diverso pattern) */
const FINGER_TO_MIDI = {
  p: { base: 60, octave: 0 }, // Do4 - pollice
  i: { base: 62, octave: 0 }, // Re4 - indice
  m: { base: 64, octave: 0 }, // Mi4 - medio
  a: { base: 65, octave: 0 }, // Fa4 - anulare
};

/** Registri diversi per ogni tecnica */
const TECHNIQUE_REGISTERS: Record<string, { label: string; midiOffset: number }> = {
  base: { label: "Base (posizione neutrale)", midiOffset: 0 },
  alta: { label: "Alta (ottava su)", midiOffset: 12 },
  bassa: { label: "Bassa (ottava giù)", midiOffset: -12 },
  estesa: { label: "Estesa (logica dita)", midiOffset: 0 },
};

export default function ManoDestraScreen() {
  const [selectedFingers, setSelectedFingers] = useState<FingerId[]>(["p", "i", "m", "a"]);
  const [difficulty, setDifficulty] = useState<typeof DIFFICOLTIES[number]["id"]>("facile");
  const [patternLen, setPatternLen] = useState(8);
  const [bpm, setBpm] = useState(80);
  const [useMetro, setUseMetro] = useState(true);
  const [seed, setSeed] = useState(1);
  const [sequence, setSequence] = useState<FingerId[]>([]);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [volume, setVolume] = useState(0.7);
  const [register, setRegister] = useState<keyof typeof TECHNIQUE_REGISTERS>("base");
  
  const seqRef = useRef<SequencerHandle | null>(null);
  
  // Genera sequenza automaticamente quando cambiano parametri
  const generatedSequence = useMemo(() => {
    if (selectedFingers.length === 0) return [];
    return generateFingerSequence(selectedFingers, difficulty, seed);
  }, [selectedFingers, difficulty, seed]);
  
  const shownSequence = sequence.length > 0 ? sequence : generatedSequence;
  
  const regenerate = useCallback(() => {
    setSeed((s) => s + 1);
    setSequence([]);
  }, []);
  
  // Metronomo
  const metro = useMetronome(
    "mano-destra",
    useCallback(() => ({
      bpm,
      volume: 0.5,
      sound: "classic" as const,
      subdivision: "none" as const,
      weights: [2, 1, 1, 1] as Array<0 | 1 | 2>,
    }), [bpm])
  );
  
  useEffect(() => () => metro.stop(), [metro]);
  
  const toggleMetro = async () => {
    if (metro.running) metro.stop();
    else await metro.start();
  };
  
  // Playback
  const stopPlayback = useCallback(() => {
    seqRef.current?.stop();
    seqRef.current = null;
    setPlaying(false);
    setCursor(-1);
  }, []);
  
  useEffect(() => stopPlayback, [stopPlayback]);
  
  const play = async () => {
    await unlockAudio();
    stopPlayback();
    if (useMetro) await metro.start();
    setPlaying(true);
    
    const seconds = 60 / bpm;
    const noteDuration = Math.min(0.4, seconds * 0.85);
    
    // Converti sequenza di dita in MIDI
    const midiNotes = shownSequence.map((finger, idx) => {
      const fingerInfo = FINGER_TO_MIDI[finger];
      const reg = TECHNIQUE_REGISTERS[register];
      let midi = fingerInfo.base + reg.midiOffset;
      
      // Per registro "estesa", usa pattern diversi per ogni dita
      if (register === "estesa") {
        // Pollice: note più basse, indice medio, etc.
        if (finger === "p") midi = 58 + (idx % 3);
        else if (finger === "i") midi = 62 + (idx % 2);
        else if (finger === "m") midi = 66 - (idx % 2);
        else if (finger === "a") midi = 69 - (idx % 3);
      }
      
      return midi;
    });
    
    seqRef.current = playSequence(midiNotes, seconds, {
      voice: "piano",
      duration: noteDuration,
      gain: 0.5 * volume,
      loop: true,
      onNote: (i) => setCursor(i % shownSequence.length),
    });
  };
  
  const onToggle = () => {
    if (playing) {
      stopPlayback();
      if (metro.running) metro.stop();
    } else {
      void play();
    }
  };
  
  const toggleFinger = (finger: FingerId) => {
    setSelectedFingers(prev => {
      if (prev.includes(finger)) {
        // Non permettere di rimuovere tutte le dita
        if (prev.length === 1) return prev;
        return prev.filter(f => f !== finger);
      }
      return [...prev, finger];
    });
  };

  const fingerToStyle = (finger: FingerId) => {
    switch (finger) {
      case "p": return "#ff6b6b";
      case "i": return "#4ecdc4";
      case "m": return "#45b7d1";
      case "a": return "#96ceb4";
      default: return "#96ceb4";
    }
  };
  
  return (
    <div className="train-body">
      <p className="screen-sub" style={{ marginBottom: 18 }}>
        Allenati con le dita della mano destra: p = pollice, i = indice, 
        m = medio, a = anulare. Genera sequenze come nel Villalobos.
      </p>
      
      {/* Selezione dita */}
      <SectionTitle>Dita da allenare</SectionTitle>
      <Card className="card-pad train-form">
        <label className="train-label">
          Scegli le dita: tutte o solo alcune
        </label>
        <div className="train-chips" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>            {FINGER_NAMES.map((f) => {
            const fid: FingerId = f.id as FingerId;
            const selected = selectedFingers.includes(fid);
            return (
              <button
                key={f.id}
                className={`chip${selected ? " on" : ""}`}
                onClick={() => toggleFinger(fid)}
                style={selected ? { 
                  background: "var(--acc)", 
                  color: "white",
                  borderColor: "var(--acc)"
                } : undefined}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <p className="tiny text3" style={{ marginTop: 8 }}>
          Se ne selezioni alcune, i pattern useranno solo quelle.
        </p>
      </Card>
      
      {/* Difficoltà */}
      <SectionTitle>Difficoltà</SectionTitle>
      <Card className="card-pad train-form">
        <Seg
          value={difficulty}
          onChange={(v) => setDifficulty(v as typeof DIFFICOLTIES[number]["id"])}
          options={DIFFICOLTIES.map(d => ({
            id: d.id,
            label: `${d.label} — ${d.description}`
          }))}
        />
        <p className="tiny text3" style={{ marginTop: 8 }}>
          {difficulty === "facile" && "2 dita: patterns semplici, facilissimi da seguire."}
          {difficulty === "medio" && "3 dita: più varietà, richiede concentrazione."}
          {difficulty === "difficile" && "4 dita: tutti i polpastrelli, massimo allenamento."}
        </p>
      </Card>
      
      {/* Registro tecnica (SOLO questa sezione) */}
      <SectionTitle>Registro tecnica</SectionTitle>
      <Card className="card-pad train-form">
        <label className="train-label">
          Tecnica in corso di esecuzione
        </label>
        <Seg
          value={register}
          onChange={(v) => setRegister(v as keyof typeof TECHNIQUE_REGISTERS)}
          options={Object.entries(TECHNIQUE_REGISTERS).map(([key, val]) => ({
            id: key,
            label: val.label
          }))}
        />
        <div className="train-register-info">
          <span className="train-register-label">Tecnica attiva:</span>
          <span className="train-register-value">
            {TECHNIQUE_REGISTERS[register].label}
          </span>
        </div>
      </Card>
      
      {/* Playback e metronomo */}
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
            <span className="text3">{shownSequence.length} note</span>
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
            <em>Riproduce la sequenza a tempo</em>
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
              // Suona un esempio della prima dita
              const firstFinger = shownSequence[0] || "p";
              const midi = FINGER_TO_MIDI[firstFinger].base + TECHNIQUE_REGISTERS[register].midiOffset;
              playNote(midi, { voice: "piano", gain: 0.45 * volume, duration: 0.8 });
            }}
          >
            <RefreshCw size={15} /> Esempio prima nota
          </button>
        </div>
      </Card>
      
      {/* Sequenza visualizzata */}
      {shownSequence.length > 0 && (
        <>
        <SectionTitle>Sequenza generata</SectionTitle>
        <Card className="card-pad">
          <div className="train-sequence-display">
            {shownSequence.map((finger, idx) => {
              const fingerInfo = FINGER_TO_MIDI[finger];
              const isCurrent = idx === cursor;
              const color = fingerToStyle(finger);
              return (
                <span
                  key={idx}
                  className={`train-finger-chip${isCurrent ? " current" : ""}`}
                  style={{
                    background: `${color}20`,
                    borderColor: color,
                    color: color,
                  }}
                >
                  <span className="train-finger-id">{finger}</span>
                  <span className="train-finger-name">
                    {finger === "p" ? "p" : finger === "i" ? "i" : finger === "m" ? "m" : "a"}
                  </span>
                </span>
              );
            })}
          </div>
          <div className="train-sequence-stats">
            <span>{shownSequence.length} note totali</span>
            <span>
              {new Set(shownSequence).size} dita usate
            </span>
          </div>          </Card>
        </>
      )}
      
      {/* Genera nuovo pattern */}
      <div className="accordi-controls" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => void regenerate()}>
          <Shuffle size={16} /> Genera nuovo pattern
        </button>
      </div>
      
      <p className="tiny text3" style={{ marginTop: 12 }}>
        I pattern sono ispirati alle esercitazioni del Villalobos: 
        sequenze ritmiche con dita alternate per sviluppare indipendenza e precisione.
      </p>
    </div>
  );
}

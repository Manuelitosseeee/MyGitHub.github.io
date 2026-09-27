/** Pentagramma musicale (VexFlow) per scale ed esercizi.
 *
 *  Riceve un elenco di note MIDI e le disegna su un pentagramma con l'armatura
 *  corretta. VexFlow ragiona in lettere diatoniche: la nota MIDI va quindi
 *  convertita nella coppia lettera + alterale (per esempio `c#/4`), non in
 *  una semplice lettera indicizzata col grado cromatico.
 *
 *  Le alterali sono affidate a `Accidental.applyAccidentals`, che le stampa
 *  solo dove l'armatura non le contiene già: evita il doppio cancelletto. */

import { useEffect, useRef } from "react";
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import { vexKeyName } from "./theory";

const PADDING = 10;

/** Lettera diatonica con alterale per ciascun grado cromatico (0 = Do). */
const VEX_LETTER = [
  "c", // Do
  "c#", // Do♯
  "d", // Re
  "d#", // Re♯
  "e", // Mi
  "f", // Fa
  "f#", // Fa♯
  "g", // Sol
  "g#", // Sol♯
  "a", // La
  "a#", // La♯
  "b", // Si
];

/** Nota VexFlow da un MIDI, es. 61 → "c#/4". */
function vexKey(midi: number): string | null {
  if (!Number.isFinite(midi)) return null;
  const m = Math.round(midi);
  const pc = ((m % 12) + 12) % 12;
  const octave = Math.floor(m / 12) - 1;
  return `${VEX_LETTER[pc]}/${octave}`;
}

export function StaffView({
  notes,
  keyPc,
  currentIndex = -1,
  compact = false,
}: {
  notes: number[];
  /** Tonalità (0 = Do) per disegnare l'armatura. */
  keyPc: number;
  /** Indice della nota in esecuzione: viene evidenziata. */
  currentIndex?: number;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = "";
    // Note valide: una sola nota non basterebbe a formare un pentagramma.
    const clean = notes.map((n) => (Number.isFinite(n) ? Math.round(n) : null));
    if (clean.length === 0) return;

    // Questo effetto non deve mai far cadere l'app: se VexFlow solleva un
    // errore si lascia il riquadro vuoto invece dello schermo nero.
    try {
      const width = Math.max(280, host.clientWidth || 320);
      const height = compact ? 92 : 120;
      // Chiave di lettura: sotto il Do4 conviene il basso.
      const usable = clean.filter((m): m is number => m !== null);
      const avg = usable.reduce((a, b) => a + b, 0) / Math.max(1, usable.length);
      const clef = avg < 60 ? "bass" : "treble";

      const renderer = new Renderer(host, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const ctx = renderer.getContext();

      const stave = new Stave(PADDING, PADDING, width - PADDING * 2);
      stave.addClef(clef);
      const keyName = vexKeyName(keyPc);
      if (keyName !== "C") stave.addKeySignature(keyName);
      stave.setContext(ctx).draw();

      const staveNotes: StaveNote[] = [];
      clean.forEach((m, i) => {
        const key = m === null ? null : vexKey(m);
        if (key === null) return;
        const note = new StaveNote({ keys: [key], duration: "q", clef });
        if (currentIndex === i) {
          note.setStyle({ fillStyle: "#f2f2f2", strokeStyle: "#f2f2f2" });
        }
        staveNotes.push(note);
      });
      if (staveNotes.length === 0) return;

      const voice = new Voice({ numBeats: staveNotes.length, beatValue: 4 });
      voice.setStrict(false);
      voice.addTickables(staveNotes);
      // Stampa solo le alterali che l'armatura non copre già.
      Accidental.applyAccidentals([voice], keyName);

      // Le note sono semibrevi: non si legano con travi, che in notazione
      // normale si usano solo per valori piu corti della semiminima.
      new Formatter()
        .joinVoices([voice])
        .format([voice], Math.max(60, width - PADDING * 2 - 40));
      voice.draw(ctx, stave);
    } catch {
      // Pentagramma non disponibile: il resto della schermata resta vivo.
    }
  }, [notes, keyPc, currentIndex, compact]);

  return <div ref={ref} className="staff-host" aria-label="Pentagramma" />;
}

/** Pentagramma musicale (VexFlow) per scale ed esercizi.
 *
 *  Riceve un elenco di note MIDI e le disegna su un pentagramma con l'armatura
 *  corretta, aggiungendo gli alterali necessari. La chiave di lettura è scelta
 *  in base all'estensione delle note, così una scala di Do basso non finisce
 *  con dieci righe di sforzo. */

import { useEffect, useRef } from "react";
import { Accidental, Beam, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import { vexKeyName } from "./theory";

const STAFF_HEIGHT = 120;
const PADDING = 10;

/** Nota VexFlow da un MIDI: lettera + alterale + ottava. */
function vexKey(midi: number): string {
  const names = ["c", "d", "e", "f", "g", "a", "b"];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[midi % 12]}/${octave}`;
}

/** Alterale da mostrare: VexFlow usa i sharp nelle chiavi. */
function accidentalFor(midi: number): Accidental | null {
  const pc = ((midi % 12) + 12) % 12;
  if (pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10) {
    return new Accidental("#");
  }
  return null;
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
    if (!host || notes.length === 0) return;
    host.innerHTML = "";

    // Chiave di lettura: se le note stanno sotto il Do4 conviene il basso.
    const avg = notes.reduce((a, b) => a + b, 0) / notes.length;
    const clef = avg < 60 ? "bass" : "treble";

    const width = Math.max(280, host.clientWidth || 320);
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(width, compact ? 90 : STAFF_HEIGHT);
    const ctx = renderer.getContext();

    const stave = new Stave(PADDING, PADDING, width - PADDING * 2);
    stave.addClef(clef);
    const keyName = vexKeyName(keyPc);
    if (keyName !== "C") stave.addKeySignature(keyName);
    stave.setContext(ctx).draw();

    const staveNotes = notes.map((m) => {
      const note = new StaveNote({
        keys: [vexKey(m)],
        duration: "q",
        clef,
      });
      const acc = accidentalFor(m);
      if (acc) {
        note.addModifier(acc, 0);
      }
      if (currentIndex >= 0) {
        note.setStyle({
          fillStyle: "#f0f0f0",
          strokeStyle: "#f0f0f0",
        });
      }
      return note;
    });

    const voice = new Voice({ numBeats: notes.length, beatValue: 4 });
    voice.setStrict(false);
    voice.addTickables(staveNotes);

    new Formatter()
      .joinVoices([voice])
      .format([voice], width - PADDING * 2 - (clef === "treble" ? 40 : 46));
    voice.draw(ctx, stave);

    // Collega le note in coppie quando sono pari (semicreste), per un aspetto
    // più leggibile delle scale.
    for (let i = 0; i + 1 < staveNotes.length; i += 2) {
      const a = staveNotes[i];
      const b = staveNotes[i + 1];
      if (Math.abs(a.getYs().at(-1)! - b.getYs().at(-1)!) > 1) {
        const beam = new Beam([a, b]);
        beam.setContext(ctx).draw();
      }
    }
  }, [notes, keyPc, currentIndex, compact]);

  return <div ref={ref} className="staff-host" aria-label="Pentagramma" />;
}

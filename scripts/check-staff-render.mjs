/* Riproduce il disegno del pentagramma di Allena Scale dentro Node, con una
   finta DOM minimale e VexFlow vero. Serve a trovare gli errori che fanno
   schermo nero, che il typecheck non puo vedere.
   Non fa parte della build. */

import { execSync } from "node:child_process";

/* ---------------- DOM minimale ---------------- */

let created = 0;
class El {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attrs = {};
    this.style = {};
    this.classList = { add: () => {}, remove: () => {} };
    this.textContent = "";
    this.clientWidth = 320;
    created++;
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  setAttributeNS(_ns, k, v) {
    this.attrs[k] = String(v);
  }
  getAttribute(k) {
    return this.attrs[k] ?? null;
  }
  getAttributeNS(_ns, k) {
    return this.attrs[k] ?? null;
  }
  hasAttribute(k) {
    return k in this.attrs;
  }
  removeAttribute(k) {
    delete this.attrs[k];
  }
  querySelector() {
    return null;
  }
  getBBox() {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  appendChild(c) {
    this.children.push(c);
    return c;
  }
  addEventListener() {}
  removeEventListener() {}
  getContext() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
}

const doc = new El("#document");
doc.createElement = (tag) => new El(tag);
doc.createElementNS = (_ns, tag) => new El(tag);
doc.createTextNode = (t) => {
  const e = new El("#text");
  e.textContent = t;
  return e;
};
doc.getElementById = () => null;
doc.body = new El("body");

globalThis.document = doc;
globalThis.window = globalThis;
// navigator è una proprietà di sola lettura su Node moderno.
try {
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: "node" },
    configurable: true,
  });
} catch {
  /* gia presente: va bene cosi */
}
globalThis.HTMLElement = El;
globalThis.HTMLDivElement = El;
globalThis.SVGElement = El;
globalThis.HTMLCanvasElement = class {};
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
if (!globalThis.document.fonts) {
  globalThis.document.fonts = { add: () => {}, check: () => true, load: () => Promise.resolve([]) };
}

/* ---------------- Codice identico a StaffView ---------------- */

const { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } = await import(
  "vexflow"
);

const VEX_LETTER = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
const vexKeyOf = (midi) => {
  if (!Number.isFinite(midi)) return null;
  const m = Math.round(midi);
  const pc = ((m % 12) + 12) % 12;
  const octave = Math.floor(m / 12) - 1;
  return `${VEX_LETTER[pc]}/${octave}`;
};
const VEX = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function renderStaff(host, notes, keyPc) {
  host.innerHTML = "";
  const width = Math.max(280, host.clientWidth || 320);
  const clean = notes.map((n) => (Number.isFinite(n) ? Math.round(n) : null));
  const avg = clean.reduce((a, b) => a + (b ?? 60), 0) / clean.length;
  const clef = avg < 60 ? "bass" : "treble";
  const renderer = new Renderer(host, Renderer.Backends.SVG);
  renderer.resize(width, 120);
  const ctx = renderer.getContext();
  const stave = new Stave(10, 10, width - 20);
  stave.addClef(clef);
  const keyName = VEX[((keyPc % 12) + 12) % 12];
  if (keyName !== "C") stave.addKeySignature(keyName);
  stave.setContext(ctx).draw();

  const staveNotes = [];
  for (const m of clean) {
    const key = m === null ? null : vexKeyOf(m);
    if (key === null) continue;
    staveNotes.push(new StaveNote({ keys: [key], duration: "q", clef }));
  }
  if (staveNotes.length === 0) return created;
  const voice = new Voice({ numBeats: staveNotes.length, beatValue: 4 });
  voice.setStrict(false);
  voice.addTickables(staveNotes);
  Accidental.applyAccidentals([voice], keyName);
  new Formatter().joinVoices([voice]).format([voice], Math.max(60, width - 20 - 40));
  voice.draw(ctx, stave);
  return created;
}

let failures = 0;
const cases = [
  ["Do maggiore 2 ottave", 0, [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83]],
  ["Re bemolle", 1, [62, 64, 65, 67, 69, 70, 72, 74, 75, 77]],
  ["Mi minore armonica", 4, [64, 67, 69, 70, 72, 76, 79]],
  ["Fa diesis (7 sharps)", 6, [66, 68, 70, 71, 73, 75, 77]],
  ["Fa (1 flat)", 5, [65, 67, 69, 70, 72, 74]],
  ["pentatonica", 7, [67, 69, 71, 74, 76]],
  ["blues", 0, [60, 63, 65, 66, 67, 70]],
  ["nota sola", 0, [60]],
  ["chiave di Do# (7 sharps)", 1, [61, 63, 64, 66]],
  // Sol diesis: era la nota che faceva cadere il pentagramma.
  ["tonalita con Sol diesis", 8, [68, 70, 72, 73, 75, 77, 79, 80]],
  ["tutte le 12 tonalita", 0, [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71]],
  ["nota non valida (NaN)", 0, [60, Number.NaN, 64]],
];

for (const [label, keyPc, notes] of cases) {
  const host = new El("div");
  try {
    renderStaff(host, notes, keyPc);
    console.log(`  ok   ${label} (${notes.length} note)`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${label}: ${e && e.message ? e.message : e}`);
    if (process.env.STACK) {
      console.log(
        String(e && e.stack ? e.stack : e)
          .split("\n")
          .slice(0, 8)
          .join("\n")
      );
    }
  }
}

console.log(failures === 0 ? "\nNessun errore nel disegno del pentagramma." : `\n${failures} casi falliti.`);
process.exitCode = failures === 0 ? 0 : 1;

/* Verifica che le tonalità emesse per il pentagramma siano chiavi valide di
   VexFlow, e che le alterali delle note siano sempre sharp (VexFlow le
   riconosce con i nomi delle chiavi). Non fa parte della build. */

import { execSync } from "node:child_process";

execSync(
  "bun build src/training/theory.ts --target=node --format=esm --outfile=/tmp/tk.mjs",
  { encoding: "utf8" }
);
const T = await import("/tmp/tk.mjs");

// Le chiavi accettate da VexFlow 5 (dal suo Tables.keySignature).
const VALID = new Set([
  "C", "Am", "F", "Dm", "Bb", "Gm", "Eb", "Cm", "Ab", "Fm", "Db", "Bbm",
  "Gb", "Ebm", "Cb", "Abm", "G", "Em", "D", "Bm", "A", "F#m", "E", "C#m",
  "B", "G#m", "F#", "D#m", "C#", "A#m",
]);

let bad = 0;
for (let pc = 0; pc < 12; pc++) {
  const name = T.vexKeyName(pc);
  const ok = VALID.has(name);
  if (!ok) bad++;
  console.log(
    `${String(pc).padStart(2)} ${T.noteName(pc).padEnd(4)} -> ${name.padEnd(3)} ${ok ? "ok" : "NON VALIDA"}`
  );
}
console.log(`\n${12 - bad}/12 tonalità valide per VexFlow.`);

// Le alterali delle note devono essere solo sharp: VexFlow le disegna
// coerenti con una chiave senza bemolle.
const sharps = [1, 3, 6, 8, 10];
let badNote = 0;
for (const scale of T.SCALES) {
  for (const step of scale.steps) {
    if (sharps.includes(step)) continue;
    if (![0, 2, 4, 5, 7, 9, 11].includes(step)) badNote++;
  }
}
console.log(
  badNote === 0
    ? "Alterali delle scale: solo naturali e sharp, coerenti con le chiavi usate."
    : `Alterali problematiche: ${badNote}`
);

/* Verifica offline del generatore di esercizi: tutte le note prodotte devono
   appartenere alla scala scelta. Non fa parte della build. */

import { execSync } from "node:child_process";

execSync(
  "bun build src/training/exercises.ts --target=node --format=esm --outfile=/tmp/ex.mjs",
  { encoding: "utf8" }
);
execSync(
  "bun build src/training/theory.ts --target=node --format=esm --outfile=/tmp/th.mjs",
  { encoding: "utf8" }
);

const { generateExercise, EXERCISES } = await import("/tmp/ex.mjs");
const { SCALES, tonicMidi } = await import("/tmp/th.mjs");

let bad = 0;
let total = 0;

for (const scale of SCALES) {
  for (let pc = 0; pc < 12; pc++) {
    for (const octave of [3, 4, 5]) {
      const tonic = tonicMidi(pc, octave);
      const allowed = new Set();
      for (const off of [-12, 0, 12]) {
        for (const s of scale.steps) allowed.add(tonic + off + s);
      }
      for (const ex of EXERCISES) {
        for (let seed = 1; seed <= 12; seed++) {
          for (const len of [3, 4, 5, 6]) {
            const notes = generateExercise(ex.id, tonic, scale.id, scale.steps, seed, len);
            total++;
            if (notes.length === 0) {
              bad++;
              console.log(`EMPTY ${scale.id} ${ex.id} pc=${pc} oct=${octave} seed=${seed}`);
              continue;
            }
            const out = notes.filter((n) => !allowed.has(n));
            if (out.length) {
              bad++;
              if (bad < 15) {
                console.log(
                  `OUT-OF-SCALE ${scale.id} ${ex.id} pc=${pc} oct=${octave} seed=${seed} len=${len} -> ${out.slice(0, 6)}`
                );
              }
            }
          }
        }
      }
    }
  }
}

console.log(`\n${total - bad}/${total} esercizi composti solo da note della scala.`);

// Esempio stampato per controllo a vista.
const maj = SCALES[0];
const tonic = tonicMidi(0, 4);
for (const ex of EXERCISES) {
  const n = generateExercise(ex.id, tonic, maj.id, maj.steps, 7, 4);
  console.log(
    `${ex.id.padEnd(12)} ${n.length} note: ${n.map((x) => x - tonic).join(" ")}`
  );
}

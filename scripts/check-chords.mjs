/* Verifica offline che tutte le diteggiature generate siano corrette.
   Non fa parte della build: si esegue con `node scripts/check-chords.mjs`. */

const { execSync } = await import("node:child_process");

// Ricompila la teoria in JS puro usando bun per poterla importare qui.
const out = execSync(
  "bun build src/training/chords.ts --target=node --format=esm --outfile=/tmp/chords-check.mjs",
  { encoding: "utf8" }
);
void out;
void execSync(
  "bun build src/training/theory.ts --target=node --format=esm --outfile=/tmp/theory-check.mjs",
  { encoding: "utf8" }
);

const M = await import("/tmp/chords-check.mjs");

const { shapesFor, shapeNotes, shapeMatchesChord, archiveFor, LEVELS } = M;
const { CHORDS, chordName } = await import("/tmp/theory-check.mjs");

let bad = 0;
let total = 0;
const qualities = ["maj", "min", "dim", "aug", "maj7", "dom7", "min7", "halfdim"];

for (const q of qualities) {
  for (let pc = 0; pc < 12; pc++) {
    for (const s of shapesFor(pc, q)) {
      total++;
      const notes = shapeNotes(s);
      const pcs = [...new Set(notes.map((n) => n % 12))].sort((a, b) => a - b);
      const want = CHORDS[q].steps.map((x) => (pc + x) % 12).sort((a, b) => a - b);
      const missing = want.filter((w) => !pcs.includes(w));
      const extra = pcs.filter((p) => !want.includes(p));
      if (!shapeMatchesChord(s) || missing.length) {
        bad++;
        console.log(
          `BAD ${chordName(pc, q)} [${s.id}] frets=${JSON.stringify(s.frets)} ` +
            `pcs=${pcs} want=${want} missing=${missing} extra=${extra}`
        );
      }
    }
  }
}

console.log(`\n${total - bad}/${total} diteggiature corrette.`);

for (const level of LEVELS) {
  const a = archiveFor({ level, qualities: ["maj", "min"], barreOnly: false, excluded: [] });
  const b = archiveFor({ level, qualities: ["maj", "min"], barreOnly: true, excluded: [] });
  const names = a.map((e) => e.name);
  console.log(`level=${level}: ${a.length} accordi, ${b.length} con barrè`);
  if (level === "principiante") console.log("  primi 14:", names.slice(0, 14).join(" "));
  const openShapes = a.filter((e) => e.shape.baseFret === 0).map((e) => e.name);
  console.log(`  a corda aperta: ${[...new Set(openShapes)].join(" ")}`);
}

/* Verifica offline del generatore armonico:
   - la lunghezza richiesta e sempre rispettata esattamente;
   - ogni accordo appartiene alla tonalita, alla sua scala parallela
     (accordi in prestito) o al bII (sostituzione tritone);
   - le tre categorie producono davvero risultati diversi.
   Non fa parte della build. */

import { execSync } from "node:child_process";

execSync(
  "bun build src/training/harmony.ts --target=node --format=esm --outfile=/tmp/h.mjs",
  { encoding: "utf8" }
);
execSync(
  "bun build src/training/theory.ts --target=node --format=esm --outfile=/tmp/th2.mjs",
  { encoding: "utf8" }
);

const H = await import("/tmp/h.mjs");
const T = await import("/tmp/th2.mjs");
const { generateProgression } = H;
const { CHORDS, MAJOR_DEGREES, MINOR_DEGREES } = T;

const CHARS = ["pop", "emotivo", "jazz"];
const COMPLEX = ["semplice", "intermedio", "avanzato"];

let badLen = 0;
let badHarmony = 0;
let total = 0;

for (const character of CHARS) {
  for (const complexity of COMPLEX) {
    for (const minor of [false, true]) {
      for (let keyPc = 0; keyPc < 12; keyPc++) {
        for (let len = 2; len <= 8; len++) {
          for (let seed = 1; seed <= 20; seed++) {
            total++;
            const p = generateProgression({
              keyPc,
              minor,
              character,
              length: len,
              complexity,
              seed,
            });
            if (p.length !== len) {
              badLen++;
              if (badLen < 6) {
                console.log(`LEN ${character}/${complexity} len=${len} -> ${p.length}`);
              }
            }
            // Ogni nota deve venire dalla scala della tonalita scelta oppure
            // dalla scala parallela: gli accordi in prestito (bVII maggiore)
            // appartengono di proposito alla scala opposta.
            const scaleSteps = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
            const parallel = minor ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
            const allowed = new Set(
              [...scaleSteps, ...parallel].map((s) => (keyPc + s) % 12)
            );
            // La sostituzione tritone (bII7) e cromatica per definizione.
            for (const s of CHORDS.dom7.steps) allowed.add((keyPc + 1 + s) % 12);
            for (const c of p) {
              for (const n of c.notes) {
                if (!allowed.has(n % 12)) {
                  badHarmony++;
                  if (badHarmony < 8) {
                    console.log(
                      `HARMONY ${character}/${complexity} ${minor ? "min" : "maj"} key=${keyPc} ` +
                        `accordo ${c.name} (${c.degree}) nota fuori tonalita: ${n % 12}`
                    );
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

console.log(
  `\n${total - badLen}/${total} progressioni con lunghezza esatta, ` +
    `${total - badHarmony}/${total} interamente dentro la tonalita.`
);

// Le tre categorie devono produrre accordi diversi.
for (const character of CHARS) {
  const p = generateProgression({
    keyPc: 0,
    minor: false,
    character,
    length: 4,
    complexity: "semplice",
    seed: 5,
  });
  console.log(
    `${character.padEnd(8)} ${p.map((c) => `${c.degree}(${c.name})`).join(" ")}`
  );
}

console.log("");
console.log("Esempi in Do:");
for (const character of CHARS) {
  for (const minor of [false, true]) {
    for (const len of [2, 4, 6, 8]) {
      const p = generateProgression({
        keyPc: 0,
        minor,
        character,
        length: len,
        complexity: "avanzato",
        seed: 11,
      });
      console.log(
        `  ${character.padEnd(8)} ${minor ? "min" : "maj"} len=${len}: ${p
          .map((c) => `${c.degree}=${c.name}`)
          .join(" ")}`
      );
    }
  }
}

console.log("");
console.log("Do minore, jazz avanzato — la dominante deve salire:");
for (let s = 1; s <= 6; s++) {
  const p = generateProgression({
    keyPc: 0,
    minor: true,
    character: "jazz",
    length: 6,
    complexity: "avanzato",
    seed: s,
  });
  console.log(`  seed ${s}: ${p.map((c) => c.name).join(" ")}`);
}

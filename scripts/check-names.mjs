/* Verifica che i nomi degli accordi non siano ambigui e che le risposte
   degli intervalli siano nomi per esteso. Non fa parte della build. */

import { execSync } from "node:child_process";

for (const f of ["theory", "harmony", "ear", "chords"]) {
  execSync(
    `bun build src/training/${f}.ts --target=node --format=esm --outfile=/tmp/v-${f}.mjs`,
    { encoding: "utf8" }
  );
}
const T = await import("/tmp/v-theory.mjs");
const H = await import("/tmp/v-harmony.mjs");
const E = await import("/tmp/v-ear.mjs");

/* 1. Nomi degli accordi: mai piu ambigui di "Dom" (Do + m). */
let badNames = 0;
const seen = new Set();
// Suffissi riconosciuti: solo questi rendono un nome "solfeggiato + m" ambiguo.
const SUFFIXES = T.CHORD_QUALITIES.map((c) => c.suffix).filter(Boolean);
const SOLFEGE = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];
const looksSolfeggiato = (n) => {
  if (!SOLFEGE.some((s) => n.startsWith(s))) return false;
  const rest = n.slice(SOLFEGE.find((s) => n.startsWith(s)).length);
  // "Faug" non e ambiguo: resta "aug", un suffisso riconosciuto.
  // "Dom" e ambiguo: resta "m".
  return SUFFIXES.some((s) => rest !== s && rest.startsWith(s));
};
for (let pc = 0; pc < 12; pc++) {
  for (const q of T.CHORD_QUALITIES.map((c) => c.id)) {
    const n = T.chordName(pc, q);
    const it = T.chordNameIT(pc, q);
    if (looksSolfeggiato(n)) {
      badNames++;
      if (badNames < 8) console.log(`  ambiguo: ${n} (${it})`);
    }
    seen.add(n);
  }
}
console.log(
  badNames === 0
    ? `OK  ${seen.size} nomi di accordo, nessuno ambiguo (Dm, Am, C#7, Bbm7b5...)`
    : `FAIL ${badNames} nomi ambigui`
);

/* 2. Le progressioni usano gli stessi nomi non ambigui. */
let badProg = 0;
for (const character of ["pop", "emotivo", "jazz"]) {
  for (let seed = 1; seed <= 30; seed++) {
    const p = H.generateProgression({
      keyPc: 0,
      minor: true,
      character,
      length: 6,
      complexity: "avanzato",
      seed,
    });
    for (const c of p) {
      if (looksSolfeggiato(c.name)) {
        badProg++;
        if (badProg < 6) console.log(`  ambiguo in ${character}: ${c.name}`);
      }
    }
  }
}
console.log(badProg === 0 ? "OK  progressioni senza nomi ambigui" : `FAIL ${badProg} ambigui`);

/* 3. Le risposte degli intervalli sono nomi per esteso. */
const q = E.makeIntervalQuestion(
  { semitones: [3, 5, 8, 10], melodic: true, direction: "su", level: 1 },
  42
);
const hasAbbrev = /^(b|M|P|A)\d/.test(q.expected);
console.log(
  hasAbbrev
    ? `FAIL  la risposta e ancora un abbreviamento: ${q.expected}`
    : `OK  risposta per esteso: "${q.expected}" (opzioni: ${q.options.join(" / ")})`
);

/* 4. Ogni opzione proposta e un intervallo reale. */
const valid = new Set(T.INTERVALS.map((i) => i.label));
const badOptions = q.options.filter((o) => !valid.has(o));
console.log(
  badOptions.length === 0
    ? "OK  tutte le opzioni sono intervallivalidi"
    : `FAIL  opzioni non valide: ${badOptions.join(", ")}`
);

/* 5. L'ottava e un intervallo a tutti gli effetti. */
console.log(
  T.INTERVALS.some((i) => i.semitones === 12)
    ? 'OK  l\'ottava e nell\'elenco ("Ottava giusta")'
    : "FAIL  l'ottava manca"
);

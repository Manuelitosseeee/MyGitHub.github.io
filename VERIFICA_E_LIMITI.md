# Verifica eseguita e limiti tecnici

## Verifiche effettivamente completate

- Test API locale in SQLite Node 22: creazione profilo, nickname univoco, rifiuto senza token, invio richieste e duplicati, lista posta, accettazione, invito monouso, invito a se stessi, revoca, autorizzazione della stanza, limiti di sanitizzazione e cambio nickname: **superati**.
- Controllo sintattico/transpilazione dei 10 file JavaScript/TypeScript principali modificati con il compilatore TypeScript globale: **nessun errore di parsing**.
- Verifica CSS *con fixture statica*, headless Chromium, alle larghezze 320, 360, 390, 430, 768, 1280 px: **nessun overflow orizzontale osservato**. Il test riguarda solo la disposizione CSS, **non sostituisce un test React della schermata reale**.
- Asset originale `public/pixel/items/character.png` e sprite/renderer `src/pixel/NewScene.tsx` conservati; nel file degli amici si usa il renderer originale e non un disegno duplicato.

## NON verificato in questa esecuzione

- `npm ci`, `npm run typecheck`, `npm run build`, suite E2E e browser app completi: nell'ambiente di esecuzione i pacchetti NPM non sono disponibili e non è possibile raggiungere il registry (tentativo di installazione offline fallito).
- App reale su iPhone Safari, Android Chrome, iPad e tablet fisici: hardware non accessibile per test.
- Pubblicazione Cloudflare e D1 in produzione: l'account Cloudflare connesso non espone il progetto `myguitarhub`, solo `mscore`.
- Integrazione automatica dei 4 commit GitHub posteriori al backup: serve applicare la patch al ramo aggiornato e verificare conflitti.
- Widget nativo di Home: assente, perché non è tecnicamente una funzione implementabile nel solo sito/PWA.

L'app web aggiornata **non è da considerarsi certificata o pronta per la produzione** finché questi controlli non risultano completati. La sola esecuzione del test API locale non dimostra il funzionamento reale del sito, né l'assenza di bug su ogni dispositivo.

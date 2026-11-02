# MyGuitarHub · Nickname, Amici e Pixel Story condivisa

## Stato reale e compatibilità

Questa modifica è sviluppata a partire dal backup del **25 ottobre 2026**, commit `cdadc298b10a0b7250143c1a4ed70c0346c60168`. Il repository principale aveva già **quattro commit più recenti** quando questa modifica è stata sviluppata. Prima di pubblicare, integra il commit/patch nel ramo aggiornato conservando i cambiamenti a metronomo, Studio, CSS e service worker. **Non sostituire `main` con tutto questo backup.**

**Il sito web non è stato pubblicato:** il progetto `myguitarhub` non era nell'account Cloudflare accessibile tramite la connessione disponibile. Le nuove funzioni non saranno utilizzabili sul sito finché la versione aggiornata e il database non saranno distribuiti.

Le nuove schermate web usano **il renderer originale `src/pixel/NewScene.tsx`** e i file sprite originali, con opzione di sonno e oscuramento. Amici visualizza gli arredi, la mappa selezionata, le luci, lo stato e il tempo di studio comunicati dal dispositivo del proprietario. La scena viene aggiornata con polling ogni 7 secondi mentre la schermata è aperta; la sincronizzazione dal proprietario avviene alla variazione dello stato e con heartbeat (almeno ogni 12 secondi). Lo stato «sta studiando» scade automaticamente sul server se non ci sono aggiornamenti da 45 secondi: ciò evita di indicare una persona come attiva per sempre quando chiude il sito o perde la connessione. La stanza resta quella salvata, con effetti di sonno.

**Widget della schermata Home:** il codice di questo pacchetto riguarda la web app, la sua PWA e il backend. L'installazione PWA da Safari/Chrome **aggiunge l'icona**, non crea un widget nativo. Il widget richiesto che mostra sempre la stanza con il sito chiuso richiede un'app native iOS con WidgetKit e un'app Android con AppWidget/Glance, con disponibilità/refresh controllati dal sistema. **Non sono contenute in questo pacchetto APK o app iOS nativa, né è possibile aggiungere il vero widget direttamente dal sito.** La guida nell'app spiega questa differenza e offre l'installazione PWA solo dove il browser la permette.

## Backend richiesto

1. Nel progetto Cloudflare Pages **che già pubblica `https://myguitarhub.pages.dev`**, crea un database Cloudflare D1 separato, ad es. `myguitarhub-friends` (NON cancellare o riutilizzare il database delle notifiche).
2. Dalla radice del repository aggiornato, dopo aver applicato il patch, esegui:
   ```bash
   npx wrangler d1 execute myguitarhub-friends --remote --file=./migrations/0001_friends.sql
   ```
3. Nelle impostazioni del progetto Pages -> **Bindings** associa il database appena creato alla variabile **`FRIENDS_DB`**, per l'ambiente production (ed eventualmente preview con un database separato).
4. Effettua il deployment del ramo aggiornato. La build Vite è `npm ci && npm run build`, cartella output `dist`, con `functions/api/friends/[[path]].ts` alla radice del repository (non nella cartella `dist`). Le Pages Functions accedono a D1 usando il binding. Verifica che gli URL `/api/friends/profile` (senza token => 401) e `/api/friends/identity` (senza corpo => errore) raggiungano l'API invece di restituire l'HTML della PWA.
5. Per gli aggiornamenti successivi, conserva il nome del binding e i dati D1. Non ruotare o eliminare token/identità dei tuoi utenti. **Non distribuire in produzione le credenziali dei dispositivi.**
6. Verifica sui browser di due dispositivi diversi: crea due profili, manda una richiesta e accetta dalla posta; avvia/pausa lo studio; personalizza arredi/luci; rimuovi l'amico e controlla che l'accesso venga negato.

## Funzionamento e sicurezza

- Nickname globali unici, 3–20 caratteri ASCII (lettere, numeri, `_`). L'identità privata viene generata con 32 byte casuali criptografici, salvata **solo** nel localStorage di chi la crea; sul server ne viene memorizzato solo l'hash SHA-256. Il nickname non vale come credenziale.
- Non c'è ancora un sistema email/password o un trasferimento sicuro account: eliminare i dati del browser fa perdere l'identità di quella installazione. Evita di promettere recupero tramite nickname.
- Inviti con codici criptografici monouso e scadenza di sette giorni, oppure richieste di amicizia dirette da nickname con accetta/rifiuta.
- D1 applica controllo di amicizia su ogni lettura della stanza. Rimuovere un amico ne revoca l'accesso all'API; dati già visualizzati possono rimanere momentaneamente in memoria finché la schermata non si aggiorna.
- Non si inviano brani, PDF, registrazioni, spartiti, metronomo, saldo di plettri, dettagli sensibili, né l'intero IndexedDB dell'utente. Solo mappa, arredi, preferenze luci, stato di studio e totale secondi di studio della settimana.
- La presenza dello studio è alimentata da Pixel Story. Il conteggio settimanale include il Diario e i secondi della sessione Pixel Story in corso; le statistiche sono volontariamente sincronizzate dal dispositivo, non certificate dal server.
- Senza Internet i due dispositivi conservano dati personali locali, ma gli aggiornamenti amici non sono garantiti.
- Il service worker **deve ignorare `/api/`** e non conservare in Cache Storage risposte private. Mantenere questa regola quando si integra con il service worker più recente del repository.

## Test

```bash
npm ci
npm run typecheck
npm run build
npm run test:friends
```

`test:friends` esegue i test API in SQLite locale su Node.js 22+ ed è indipendente dal database Cloudflare. Aggiungere test E2E su browser e controllare la console per le nuove schermate prima di pubblicare. I test originali di registrazioni, Studio e metronomo vanno rieseguiti dopo l'integrazione con `main`.

## File coinvolti

`src/friends/api.ts`, `src/friends/sync.tsx`, `src/friends/FriendsScreen.tsx`, `src/friends/friends.css`, `functions/api/friends/[[path]].ts`, `migrations/0001_friends.sql`, `tests/friends-api.test.mjs`, più piccole modifiche in `src/App.tsx`, `src/nav.tsx`, `src/ui/AppGlyph.tsx`, `src/pixel/NewScene.tsx`, `src/pixel/motion.ts`, `public/sw.js`, `package.json`.

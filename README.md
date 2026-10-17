# MyGitHub — Metronomo e Studio (PWA iOS)

App progressiva (PWA) mobile-first pensata per iPhone: metronomo avanzato,
libreria di brani con tracking automatico del BPM, accordatore per chitarra e
registro dei cambi di corde. Tutti i dati restano **locali sul dispositivo**
(IndexedDB): nessun account, nessun backend.

## Sezioni

1. **Diario** — cosa hai suonato oggi e nello storico: per ogni giorno e brano
   mostra la sequenza dei BPM provati (es. 60 → 61 → 62 → 68 → 70) e i minuti
   di pratica, con grafico settimanale.
2. **Studio (Brani)** — libreria di brani (solo nomi). Ogni brano ha un
   metronomo dedicato con **tracking automatico**: ogni cambio di BPM viene
   salvato, anche senza avviare una sessione di studio. Imposta un obiettivo BPM
   e vedi il progresso, allega spartiti (immagini/PDF), avvia sessioni di
   studio opzionali con data, durata e BPM.
3. **Metronomo** — metronomo standard **completamente indipendente** (non tocca
   i dati dei brani): regolazione precisa, suddivisioni
   (ottavi/terzine/sedicesimi), pattern ritmici personalizzati con accenti e
   silenzi e 3 suoni. Lo stesso set di personalizzazioni è disponibile nel
   metronomo di ogni brano.
4. **Accordatore** — usa il microfono (Web Audio) e rileva realmente frequenza,
   nota e **ottava** (es. Mi4) con deviazione in cent, tenendo la nota
   visualizzata mentre la corda suona. Due interfacce: lancetta e linea.
5. **Corde** — registro dei cambi di corde: data, marca/tipo, foto, note e
   faccina (felice/neutra/triste) modificabile sempre. Storico completo, giorni
   trascorsi dall'ultimo cambio e promemoria configurabile anche con un
   intervallo personalizzato.
6. **Impostazioni** — 5 colori che ridipingono l'app, tema classico
   chiaro/scuro/auto, dimensione del testo, 3 caratteri, conferma prima di
   eliminare (disattivabile), avvio automatico della sessione di studio e
   ripristino completo dei dati.

## Installazione su iPhone

Apri l'app in Safari → Condividi → **Aggiungi a Home** → si apre in modalità
standalone full-screen. Il service worker rende l'app utilizzabile offline.

## Sviluppo

```bash
bun install      # dipendenze
bun run dev      # dev server (0.0.0.0)
bun tsc -b --noEmit   # typecheck
bun run build    # build di produzione in dist/
bun run icons    # rigenera le icone PNG (scripts/gen-icons.mjs, zero dipendenze)
```

## Architettura

- `src/engine/` — logica audio pura (scheduler Web Audio con lookahead,
  sintesi dei click, autocorrelazione per l'accordatore): nessuna dipendenza da
  React, pronta per il porting in Swift.
- `src/data/` — modello dati + store IndexedDB reattivo (tipi che rispecchiano
  un futuro schema CoreData/SwiftData).
- `src/lib/` — utilità (IDB, tempo, teoria musicale).
- `src/screens/` — UI per sezione; `src/ui/` — componenti di design system.

## Registrazioni

La scheda **Registrazioni** permette di scegliere un brano dalla libreria oppure un titolo libero, registrare dal microfono, mettere in pausa/riprendere, rifare immediatamente una prova e annullarla. Un titolo libero identifica la registrazione senza modificare i brani della libreria.

Dopo la registrazione si può riascoltare prima di salvare. Il lettore include play/pausa, stop con ritorno all’inizio, cursore temporale, salti di 10 secondi, intervallo A–B (singolo o ripetuto) e download del file originale. Ogni prova salvata ha note di testo libero, modificabili e salvate automaticamente.

Audio e metadati vengono salvati insieme, in una transazione IndexedDB: se il salvataggio fallisce, la prova rimane disponibile per ritentare o scaricare l’audio. Sono locali al browser/dispositivo, senza upload. I nomi dei brani collegati seguono la libreria; eliminare un brano conserva le sue registrazioni con l’ultimo titolo. Il ripristino completo nelle Impostazioni elimina anche audio e note.

Il microfono si attiva soltanto premendo Registra. La cattura sceglie un formato supportato (AAC/MP4 quando disponibile, oppure Opus/WebM e fallback nativi), senza imporre WebM a Safari. Non viene attivato il monitoraggio sugli altoparlanti. Le pause sono escluse da audio e durata; passare a un’altra sezione o mandare l’app in secondo piano mette in pausa. Una prova non ancora salvata non è garantita dopo chiusura/terminazione dell’app da parte del sistema operativo. La registrazione richiede HTTPS o localhost e un browser con MediaRecorder.

### Verifiche

```sh
npm install
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:recordings:e2e
```

I test unitari coprono durata senza pause, chunk finale, rilascio del microfono, cancellazione durante il permesso, tentativi successivi, rifacimento, persistenza atomica, note multilinea, eliminazione e ripristino anche con un salvataggio in corso. Il test nel browser usa MediaRecorder reale con il dispositivo audio di prova di Chromium; verifica riascolto, seek, A–B, download, reload, errori e layout mobile/desktop. Non sostituisce una prova su un iPhone fisico.

Backup prima della funzione: ramo `backup/pre-recordings-20261017`, commit `1e61f49ce1ed4052bc03f1692334c9145a5040e1`.

# Studio / Pixel Story / audio — 28 ottobre 2026

- Switch in entrambe le schermate Studio (classica e Pixel), stesso `settings.pixelStory` delle Impostazioni. Nessuna migrazione o reset di plettri, acquisti, brani e mappe.
- Il brano aperto rimane montato passando ad altre schede: anche il suo metronomo continua. Il tasto Indietro chiude il brano esplicitamente.
- `StudioLibrary` conserva Pixel montato dopo il primo accesso: il metronomo non viene distrutto passando allo Studio classico o ad altre schede. Le azioni esplicite Pausa/Termina fermano il metronomo come prima; la sessione Pixel conserva la politica di pausa quando si esce.
- `src/pixel/design.css` usa gli stessi token Home: `--bg`, `--card`, `--text`, `--text-2`, `--sep`, `--r-card`, `--r-btn`, `--app-font`. Rimossi i frame a nove sezioni dorati. Solo le icone valuta vengono mostrate in grigio; asset, camera e composizione delle stanze rimangono identici.
- Diario: `<details>` indipendenti per giorno e per percorso BPM del brano, chiusi inizialmente. L'apertura del brano rimane un pulsante separato. Storico sessioni del brano richiudibile. Nessun evento viene eliminato.
- `src/engine/metroLoop.ts`: sintesi dei quattro suoni, pattern completo con accenti/silenzi/suddivisioni e WAV PCM16. Volume incorporato nei campioni perché iOS non espone sempre il volume software di HTMLAudioElement.
- `MetronomeEngine`: un solo elemento audio con un pattern ripetuto di almeno 20 secondi, riprodotto con `loop`; nessun timer JS deve generare i click in background. Il timer da 25 ms serve solo alle animazioni. Aggiornamenti live ricostruiscono il loop mantenendo la fase relativa della battuta. Può esserci una breve transizione audio al cambio di configurazione; non viene promessa commutazione sample-accurate tra due file multimediali.
- `configurePlaybackSession`: `navigator.audioSession.type = playback`, se disponibile. Il metronomo non richiede mai il microfono.
- Una pausa/interruzione del lettore ferma lo stato UI e libera la risorsa; nessun tentativo di aggirare telefonate o pause del sistema. Esclusività tra tutti i metronomi mantenuta, URL Blob revocati allo stop e al cambio di configurazione.
- Service Worker cache v15: aggiornamento scaricato ma attivato solo su richiesta, come prima.

## Verifica

`npm run typecheck`, `npm run build`, `npm test`, `npm run test:metronome`, `npm run test:studio:e2e`.

Test e2e desktop/mobile emulato: switch e dati, 45 cambi BPM conservati nelle tendine, token CSS uguali alla Home, cinque mappe, dimensioni fullscreen, metronomo tra schede e con tutti gli interval JS disabilitati, cambio BPM, popup chiuso, interruzione media, layout 320/390/1440.

## Limite di verifica iPhone

Non è stato utilizzato un iPhone fisico. L'audio multimediale e Audio Session playback sono la strada prevista per non seguire l'interruttore silenzioso ed evitare il throttling dei timer. Nessuna PWA può garantire riproduzione dopo chiusura forzata, sospensione imposta da iOS, telefonate o revoca della sessione audio. Non usare timer o Service Worker come presunto bypass.

Prima di considerare validato sul dispositivo: avviare con tocco, provare suoneria spenta (volume multimediale alzato), cambio app e schermo bloccato per 5 minuti, popup Pixel chiuso, pausa da comandi multimediali, cambio BPM/volume/suono/suddivisioni. Provare sia Safari sia PWA installata.

Riferimenti primari: https://bugs.webkit.org/show_bug.cgi?id=237322 e https://w3c.github.io/audio-session/ .


## Correzione continuità e accelerazione — 28 ottobre 2026

Nei browser con AudioWorklet i click ora sono generati nel thread audio da
`public/metronome-processor.js`, con tre campioni per il timbro selezionato.
Il clock conserva la fase cambiando BPM, senza cambiare sorgente, fare seek o
riavviare Play. Un MediaStreamAudioDestination instrada il risultato allo stesso
elemento audio multimediale. Il vecchio loop PCM resta solo come fallback.
Il clock supporta accenti, suddivisioni, silenzi, volume e modifiche live.

L'accelerazione applica al massimo un incremento per intervallo: dopo un ritardo
non somma tutti gli incrementi saltati. Le modifiche a intervallo/step riavviano
il conto dell'intervallo. I campi accettano una bozza testuale e applicano il
valore su uscita o Invio; Escape annulla, il vuoto ripristina il valore precedente.
Gli indicatori del battito usano transform e uno spazio fisso, evitando reflow.

Verifica aggiuntiva: `node --test tests/metronome-clock.test.cjs` (65 secondi
simulati a 44.1/48 kHz, errore massimo di un campione, centinaia di variazioni),
`node tests/metro-stability.e2e.mjs` (browser mobile emulato: geometria stabile,
accelerazione senza cambio elemento/sorgente, nessun recupero a raffica,
campi 20/2/3600/1, popup Pixel stabile). iPhone fisico non verificato.

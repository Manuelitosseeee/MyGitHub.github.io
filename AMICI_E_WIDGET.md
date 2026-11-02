# Amici e stanza condivisa — 2 novembre 2026

La modifica parte dal commit 918d830c42864e91cb15be546a50daf6cd12c33b, più recente del backup allegato. Conserva le correzioni del metronomo del 28 ottobre, i dati locali, gli oggetti Pixel Story e il sistema di aggiornamento esplicito.

## Implementato

- Altro → Amici, disponibile anche nella navigazione desktop.
- Nickname univoci senza distinzione maiuscole/minuscole, da 3 a 24 caratteri.
- Inviti con token casuale, validi sette giorni. Un nuovo invito revoca il precedente. Il destinatario sceglie il nickname e accetta esplicitamente.
- Richieste per nickname, casella delle richieste, accettazione/rifiuto, annullamento delle richieste inviate.
- Amicizia reciproca e rimozione con conferma, autorizzata per entrambi.
- Lista aggiornata ogni cinque secondi quando visibile, aggiornamento al ritorno online e al ritorno in primo piano.
- Stanza dell'amico con lo stesso componente `NewScene`, gli stessi asset originali, mappa, oggetti, pioggia e interruttori. Nessuna illustrazione sostitutiva. Le pose addormentata e attiva appartengono al renderer condiviso, quindi app e vista dell'amico usano la stessa logica.
- Inattività: filtro grigio/scuro, occhi chiusi, bocca a cerchio e bolla animata. Attività: movimento delle mani originali. Il parametro di attività è la sessione Pixel Story realmente avviata, non la semplice apertura del sito.
- Totale della settimana locale del proprietario, ricavato dai secondi di pratica esistenti e dalla sessione Pixel in corso, evitando di sommare di nuovo le ricevute già registrate. Non vengono inviati titoli, spartiti, registrazioni, note o l'intero salvataggio.
- Credenziale privata casuale del dispositivo, conservata localmente. Il server memorizza soltanto l'hash. Il nickname da solo non autentica. Il codice privato consente il ripristino manuale su un altro dispositivo; chi lo possiede controlla il profilo.
- Endpoint predisposto per futuri widget nativi: token limitato a una coppia amico/osservatore, controllato contro l'amicizia a ogni lettura. Rimozione e nuova amicizia non riattivano i vecchi token.

## Limiti reali: il widget richiesto non è incluso

Un sito/PWA non può aggiungere direttamente un widget animato nativo alla Home di iPhone, iPad e Android. L'installazione web aggiunge un'icona di avvio. L'interfaccia lo dichiara e non mostra un pulsante fittizio per installare un widget. Il pulsante nativo di installazione della PWA compare solo quando il browser emette `beforeinstallprompt`; su Safari vengono mostrate le istruzioni manuali.

Per completare il widget servono app native distribuite e firmate: estensione WidgetKit su iOS/iPadOS e AppWidgetProvider su Android, integrazione delle immagini/stato e un sistema di aggiornamenti. Non sono presenti né binari nativi installabili né un widget funzionante ad app chiusa in questa consegna. Anche un'app nativa non può promettere aggiornamenti istantanei continui o un'animazione perpetua su tutti i sistemi: il sistema operativo gestisce i tempi di aggiornamento.

La vista web della stanza si aggiorna mentre è aperta e online. I dispositivi possono sospendere il sito in background: dopo 90 secondi senza contatto lo stato diventa «non aggiornato», non viene spacciato per studio in corso. L'animazione di riposo in tale stato è accompagnata dall'etichetta di stato sconosciuto. Non si garantisce una trasmissione video sincrona fotogramma per fotogramma; si sincronizzano stato della stanza e arredi, e si usa lo stesso renderer. Il formato della schermata adatta la camera allo spazio disponibile.

I totali sono comunicati dal dispositivo, non una certificazione. Una sessione che attraversa il lunedì può avere un totale provvisorio incompleto fino al salvataggio. Se il proprietario non apre più l'app, i dati settimanali restano quelli dell'ultimo aggiornamento; viene mostrata la data della settimana.

Il profilo Amici è separato dal ripristino dei soli dati musicali. Conservare il codice privato prima di cancellare i dati del browser. Il servizio non dispone di recupero email/password.

## Infrastruttura

Frontend: repository originale `Manuelitosseeee/MyGitHub.github.io`. Backend Amici separato dal Worker notifiche: `https://myguitarhub-social-v1.manuelitosmurf.workers.dev`, database D1 dedicato in UE. La configurazione è in `social-backend/wrangler.jsonc`, lo schema additivo in `social-backend/schema.sql`. Non applicare lo schema al database delle notifiche. Il backend può essere aggiornato separatamente dal frontend.

L'account Cloudflare connesso non è l'account del sito originale indicato nel backup. Il frontend si pubblica attraverso il repository originale e la sua integrazione Git; la nuova API usa l'account connesso. Il Worker notifiche e le sue chiavi VAPID non sono stati modificati.

## Verifiche riproducibili

- `npm run typecheck`
- `npm test`
- `node --test tests/friends.test.mjs`: SQLite reale con adattatore D1; credenziali, collisioni nickname, consenso, richieste duplicate, rifiuto, reciprocità, inviti scaduti/ruotati, estranei, stato obsoleto, dati minimizzati, CORS, limiti payload e revoca token.
- `node --test tests/metronome-clock.test.cjs`
- `node scripts/pixel-checks/economy.mjs`
- `npm run build`

Nessun test in questa sessione equivale a una verifica su iPhone/Android fisici. Il typecheck del vecchio backend notifiche non è stato modificato o dichiarato risolto.

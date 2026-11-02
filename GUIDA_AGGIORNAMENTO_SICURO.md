# MyGuitarHub — procedura di aggiornamento sicuro

## Prima di iniziare

**NON caricare la cartella dello ZIP direttamente sul sito**: è codice sorgente, non la build `dist`. **NON sostituire il ramo `main` di GitHub con questo ZIP**, perché il backup fornito era del 25 ottobre 2026 e su GitHub esistono quattro commit successivi. Le modifiche social sono nel file `MyGuitarHub_Amici_integrazione_git.patch` fornito separatamente. Applicalo sul repository GitHub aggiornato, oppure consegnalo a uno sviluppatore.

Il sito attualmente pubblicato e il database esistente non sono stati alterati in questa lavorazione.

## Se il sito Cloudflare Pages è collegato a GitHub (metodo preferito)

1. Apri sul tuo computer un terminale in una cartella nuova ed esegui:

   ```sh
   git clone https://github.com/Manuelitosseeee/MyGitHub.github.io.git
   cd MyGitHub.github.io
   git switch -c feature/amici-pixel-story
   ```

   Se il repository è privato, esegui l'accesso GitHub quando richiesto.

2. Copia il file `MyGuitarHub_Amici_integrazione_git.patch` in questa cartella ed esegui:

   ```sh
   git apply --3way --index MyGuitarHub_Amici_integrazione_git.patch
   git status
   ```

   **Se vedi `CONFLICT` o `unmerged paths`, non pubblicare né fare commit**. I 4 commit recenti hanno modificato App, service worker e Pixel Story: quei conflitti vanno risolti preservando entrambe le funzionalità.

3. Installa Node.js 22 LTS o una versione compatibile e lancia:

   ```sh
   npm ci
   npm run typecheck
   npm run test:friends
   npm test
   npm run build
   ```

   Esegui inoltre gli altri test E2E disponibili. Devono terminare senza errori prima del deploy.

4. Su **Cloudflare** apri l'account che contiene **il progetto `myguitarhub`** e controlla che il progetto esista. **Non modificare il progetto `mscore`.** Crea un database D1 separato denominato ad es. `myguitarhub-friends`.

5. Dalla cartella del repository autenticati (`npx wrangler login`) e crea/applica lo schema:

   ```sh
   npx wrangler d1 execute myguitarhub-friends --remote --file=./migrations/0001_friends.sql
   ```

6. In Cloudflare Workers & Pages → `myguitarhub` → Settings → Bindings, aggiungi un **D1 database binding** con nome esatto `FRIENDS_DB` collegato al nuovo database. Verifica anche l'ambiente Production. Il binding diventa attivo dopo un nuovo deploy.

7. Prima crea una preview: se il progetto ha Git integration, esegui `git commit -m "Add friends and shared Pixel Story"` e `git push -u origin feature/amici-pixel-story`; apri la preview di Cloudflare della branch. Non unire in `main` prima dei test descritti sotto.

8. Dopo i test su preview, unisci la branch in `main` tramite pull request su GitHub; se il progetto usa build automatica, Cloudflare pubblicherà la versione nuova. Impostazioni di build tipiche: `npm ci && npm run build`, output `dist`, directory radice del repository. Le Pages Functions stanno in `functions/` **alla radice**, non in `dist/`.

## Se il progetto non è collegato a GitHub

Dopo aver integrato i commit recenti e completato la build, puoi usare il terminale con `npx wrangler pages deploy dist --project-name myguitarhub` *dalla radice del repository*, dopo il binding D1. **Non usare il caricamento ZIP/cartella dal browser Cloudflare** per questa versione: il drag-and-drop non compila la cartella `functions` e la funzione Amici rimarrebbe senza backend. Se hai Git integration e vuoi usare deploy manuali via Wrangler, consulta le impostazioni del progetto perché i commit Git successivi potrebbero sovrascrivere il deploy manuale.

## Verifica funzionale obbligatoria

Apri due dispositivi/browser separati (ad esempio iPhone Safari e Android Chrome), registrati con due nickname diversi, invia una richiesta dal primo e verifica che compaia nell'icona posta del secondo. Accetta, verifica che entrambi siano visibili; prova invito monouso via link; cambia stanza e arredi; avvia e metti in pausa una sessione Pixel Story; controlla i totali della settimana; rimuovi l'amicizia e verifica che l'accesso privato sia revocato. Ripeti su iPad/tablet e PC e controlla che l'API non venga servita dalla cache del service worker.

Gli endpoint `/api/friends/profile` senza Authorization devono rispondere **401 JSON**, e `/api/friends/identity` con GET non autenticato deve rispondere **401 JSON**: se restituiscono l'HTML del sito, le Pages Functions non sono state distribuite.

## Widget Home — limitazione importante

Installare la PWA da Safari o Chrome **crea un'icona apribile**, non un widget nativo che esegue animazioni con il sito chiuso. iOS richiede app + WidgetKit, Android richiede app + widget Android; gli aggiornamenti in background sono regolati dai sistemi operativi. Questa versione include la **stanza originale animata nella schermata Amici, non un widget nativo installabile**. Non presentare l'icona PWA come widget animato.

## Note account

L'identità è legata al localStorage del dispositivo. Cancellando i dati del browser, l'accesso al nickname può essere perso. Serve un sistema account recuperabile per supportare login multipiattaforma sullo stesso nickname. Le chiavi private non devono essere inserite nel codice o condivise.

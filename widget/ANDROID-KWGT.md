# MyGuitarHub · widget Android (KWGT)

1. Installa **KWGT Kustom Widget Maker** dal Play Store, aggiungi un widget KWGT alla schermata Home e toccalo per configurarlo.
2. Aggiungi un oggetto **Immagine** e imposta Bitmap → Formula con questo URL, sostituendo `CODICE_WIDGET` con il codice privato di 64 caratteri generato dall'amico:

```
https://myguitarhub-room-widget.manuelitosmurf.workers.dev/image?token=CODICE_WIDGET
```

3. Imposta la modalità di ridimensionamento su **Adatta/Contieni** e scegli un widget medio o grande, mantenendo visibile l'intera stanza in verticale.
4. Concedi a KWGT l'esecuzione in background e configura una frequenza di aggiornamento adatta alla batteria. Il tempo del refresh dipende da Android e dalla configurazione KWGT; non è istantaneo.

La stanza è privata: il codice apre soltanto l'immagine dell'amico ed è revocato quando l'amicizia viene rimossa. Non condividere pubblicamente il codice o l'URL completo. La stanza verrà oscurata quando la sessione non è attiva o non è stata sincronizzata recentemente.

Per problemi con l'aggiornamento: https://docs.kustom.rocks/docs/common_issues/widget_not_udpating/

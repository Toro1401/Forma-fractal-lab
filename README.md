# Forma — Laboratorio di frattali

Un laboratorio visivo in italiano per disegnare una regola, ripeterla e scoprire come cresce. Funziona nel browser, senza account, dipendenze npm o servizi esterni. Include 40 esempi modificabili, cinque generatori e una raccolta unica con backup e cestino.

## Avvio

Su Windows fai doppio clic su **avvia-locale.cmd**, poi apri **http://127.0.0.1:8080**. Sono richiesti Python 3.8 o successivo e un browser recente. Riavvia un server già aperto dopo l’aggiornamento di `serve.py`.

Da terminale: `python serve.py --port 8080`. Se la porta è occupata, scegli per esempio `8081` e usa lo stesso numero nell’indirizzo. Il server ascolta soltanto su `127.0.0.1`; Ctrl+C lo arresta.

Puoi anche aprire direttamente **dist/index.html**, oppure servire `dist/` con un server statico: esplorazione, salvataggi nel browser, backup e importazioni funzionano anche senza l’API Python. I file del progetto sono leggibili in ogni modalità; per aggiornarli serve il server locale. Un’origine o un profilo del browser diverso ha una raccolta locale distinta.

## Il laboratorio

L’editor della regola è subito disponibile. **Scegli un esempio** apre una libreria filtrabile per famiglie, con miniature del risultato e suggerimenti. I 24 esempi precedenti sono conservati; i nuovi includono fiocchi chiusi, raggiere, mandala, alberi guidati, copie autosimili e grammatiche.

La linea del tempo è separata dal disegno: numero di generazioni, passo avanti/indietro, riproduzione, pausa effettiva sul livello corrente, ripresa, velocità e ripetizione. Su mobile il pulsante **Regola e stile** permette di dedicare lo schermo al risultato.

**Vista e confronto dei livelli** offre il riferimento precedente, l’anteprima del successivo, colori e spessore del riferimento, camera adattiva o fissa. La camera fissa conserva posizione e scala durante la crescita; Adatta reinquadra manualmente. Colore e tratto sono in una sezione distinta.

## Cinque metodologie

1. **Linea sostitutiva**: ogni segmento viene sostituito dalla polilinea A → P1 → … → B. A resta in (0, 0), B è modificabile. La figura iniziale può essere un segmento, un poligono chiuso oppure una raggiera. Puoi scegliere lati/bracci, orientamento, settori specchiati e sviluppo interno. La regola A → B resta aperta anche quando il risultato è un contorno chiuso. Il Fiocco di Koch usa una base triangolare, distinta dalla rosetta radiale.
2. **Rami ricorsivi**: ogni segmento conserva il proprio tratto e genera rami con angolo, scala, innesto e specchiatura. Le coppie collegate si modificano insieme. Apertura della chioma, dominanza, variazioni per livello, settori alternati e irregolarità con seme salvato permettono crescite guidate e riproducibili.
3. **Piega e raddoppia**: una copia dell’intero percorso si aggancia al terminale e viene percorsa al contrario. Rotazione, riflessione con asse visibile e trascinabile, oppure una sequenza ripetuta di operazioni. La riflessione a orientamento costante genera soprattutto fregi; il laboratorio segnala le sovrapposizioni complete riconosciute. Sono conservati i preset precedenti, incluso Drago a L.
4. **Copie autosimili · IFS**: disegna una forma aperta o chiusa, eventualmente piena, e disponi da una a otto copie. Trascina gli innesti nella vista delle copie o modifica posizione, scale X/Y, rotazione, inclinazione e specchio. Ogni trasformazione deve essere contrattiva. Gli esempi comprendono triangolo e tappeto di Sierpiński, spirali e felce affine.
5. **Grammatiche · L-system**: modifica assioma, regole, angolo, scala del passo e direzione. `F` e `G` disegnano, `f` avanza senza tracciare; `+` e `-` ruotano; `[` salva lo stato e `]` lo ripristina. Le altre lettere vengono riscritte. Esempi: albero, pianta e curva di Hilbert.

Nei progetti versione 5 tutti gli angoli positivi sono antiorari. Le vecchie rotazioni globali vengono convertite cambiando il segno; i vecchi assi di riflessione conservano il proprio orientamento. La geometria dei progetti 1–4 rimane compatibile.

## Precisione e costruzione

Lunghezze bloccate, gruppi di congruenza e angoli sono disponibili nella costruzione avanzata. Bloccare una misura usa il valore geometrico esatto, anche quando il campo mostra due decimali. Le cifre digitate non vengono arrotondate prima del calcolo. I valori molto piccoli sono mostrati in notazione scientifica quando l’arrotondamento li renderebbe zero.

L’ordine dei punti segue il percorso, anche con X negativa o incroci. Inserire/rimuovere punti libera i vincoli dimensionali, mantenendo i versi sui lati corrispondenti. Annulla/ripeti conserva anche l’identità della creazione da aggiornare. Griglia magnetica, specchiatura e raddrizzamento della regola sono disponibili vicino all’editor.

## Variazioni

**Confronta quattro varianti** genera modifiche vicine alla creazione corrente. Intensità e protezione di forma iniziale, regola di crescita e colori controllano cosa può cambiare. Puoi aprire una variante o osservare una transizione animata. La transizione resta annullabile e si può interrompere. **Sorprendimi** esplora la modalità corrente.

La colorazione può seguire lo spazio, la generazione oppure il ramo/copia. Nei generatori che sostituiscono interamente il livello precedente, tutti i tratti dell’ultimo livello hanno la stessa generazione; il confronto con il riferimento precedente aiuta a leggere la trasformazione.

## Una sola raccolta

**Le mie creazioni** comprende sia i file del progetto sia i salvataggi di questo browser. Puoi aprire, duplicare, rinominare ed eliminare. I nuovi salvataggi usano automaticamente il server locale quando disponibile, altrimenti il browser; il dialogo consente di scegliere esplicitamente.

- I file personali restano in **dist/user-presets.js**, da includere nei backup del repository. Il server conserva al massimo 24 preset su file e li riscrive atomicamente.
- La raccolta complessiva contiene fino a 256 creazioni. Lo spazio disponibile nel browser può imporre un limite inferiore.
- Il cestino conserva le ultime 32 eliminazioni e permette il recupero anche dopo una riapertura. Un preset su file richiede il server locale per essere eliminato.
- Il backup completo include creazioni e cestino. L’importazione valida tutto prima di scrivere, evita copie identiche e conserva entrambi i progetti quando lo stesso identificatore ha contenuti diversi.
- La vecchia raccolta `forma.gallery.v1` viene importata nella raccolta unica senza cancellare la chiave originale. La bozza rimane separata.

Cambiare origine, browser o dispositivo non trasferisce automaticamente i dati locali: usa **Scarica backup completo** oppure il JSON della singola creazione. Cancellare i dati del browser elimina raccolta locale, cestino e bozza; i preset già scritti nei file rimangono disponibili.

## Esportazioni

PNG e SVG usano la geometria completa, senza griglia o riferimenti, con sfondo normale o trasparente. Dimensioni configurabili da 128 a 8192 px per lato; il PNG ha un limite di 32 megapixel. Lo spessore può restare quello dello schermo oppure essere moltiplicato per 1,5 o 2. IFS pieni, colori strutturali, gradienti e rami assottigliati vengono conservati.

Il JSON versione 5 conserva regola, composizione, crescita, grammatica e stile; cronologia e camera restano preferenze della sessione. Sono leggibili i JSON 1–4. Progetti e backup si importano dalla raccolta.

Nei browser che supportano `MediaRecorder` e `Canvas.captureStream`, **Registra la crescita · WebM** salva il disegno animato come appare sul canvas, inclusa l’eventuale griglia. La registrazione termina alla fine della crescita, con il pulsante di arresto oppure dopo 30 secondi. Nessun audio viene acquisito.

## Architettura

`dist/` contiene i sorgenti eseguibili, non un output generato: non cancellarla. Nessun passaggio di build è necessario.

| File | Responsabilità |
| --- | --- |
| `engine.js`, `constraints.js` | Geometria e costruzione originale, compatibilità 1–4 |
| `generators.js` | Schema 5, composizioni, crescita, piegature, IFS e L-system |
| `history.js` | Cronologia di progetto e identità di salvataggio |
| `renderer.js` | Rendering comune a canvas, miniature e SVG |
| `worker.js` | Geometria, riferimenti e rendering delle scene pesanti |
| `library.js` | Persistenza, migrazione, backup e cestino |
| `presets.js` | Ricette e suggerimenti dei 40 esempi |
| `experience.js`, `experience.css` | Esperienza d’uso e controlli contestuali |
| `app.js` | Editor, camera, eventi e coordinamento |
| `serve.py` | Server loopback, validazione e scrittura atomica |

I limiti sono 131.072 segmenti per linee, rami, IFS e L-system; 1.048.576 per le piegature. Si conservano generazioni complete e il costo delle simmetrie è incluso. Le grammatiche hanno anche un limite di espansione di 1.048.576 simboli. Un’importazione ha un limite di 2 MB.

Con HTTP locale, il worker calcola geometria e livelli di confronto. Oltre 65.536 segmenti il rendering usa OffscreenCanvas quando disponibile: la navigazione riutilizza un’immagine e la vista viene affinata in background. I buffer esatti restano disponibili per le esportazioni. L’apertura diretta del file e i browser senza queste API usano un percorso alternativo che può essere meno reattivo nelle scene più dense.

## Verifica

Con Node.js 22 o successivo, senza installare pacchetti:

```sh
node tests/engine.test.cjs
node tests/branches.test.cjs
node tests/global.test.cjs
node tests/experience.test.cjs
node tests/library.test.cjs
node tests/browser.mjs
node tests/features.browser.mjs
python -m unittest discover -s tests -p test_server.py
```

Le suite browser richiedono Python e Chromium. Su Windows usano Chrome nel percorso standard; `CHROME_PATH` e `PYTHON_PATH` permettono percorsi alternativi. Usano le porte di debug 9347 e 9349, profili separati e copie temporanee del progetto: i preset reali non vengono modificati.

La verifica comprende editor, regressioni di precisione e cronologia, tutti i preset, salvataggi dei nuovi generatori, trascinamento di asse e copie, backup/cestino, transizioni, PNG/SVG trasparenti, registrazione WebM e mobile simulato. Le schermate e la misura indicativa delle prestazioni sono in `.qa-browser/`, ignorata da Git. Sono ancora opportune prove su dispositivi touch fisici, lettori di schermo e altri browser prima di dichiararli supportati.

Riferimenti per le famiglie matematiche: [Koch](https://mathworld.wolfram.com/KochSnowflake.html), [IFS](https://paulbourke.net/fractals/ifs/), [Algorithmic Botany](https://algorithmicbotany.org/papers/). Le varianti decorative vengono presentate con nomi descrittivi; non viene attribuita una dimensione frattale ai generatori arbitrari.

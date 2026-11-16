# Forma — Requisiti di prodotto e architettura

Stato consolidato: 13 novembre 2026. Questa specifica descrive il comportamento implementato; lo storico è in CHANGELOG.md.

## Esperienza principale

Aprire un esempio → comprendere la regola → modificarla visivamente → esplorare le generazioni → confrontare varianti → conservare o esportare.

L’editor deve essere visibile nel primo schermo desktop. La libreria degli esempi usa un dialogo filtrabile. Costruzione avanzata, composizione, stile e vista sono separati. La linea del tempo dispone di spazio proprio e non copre il disegno. Su mobile le impostazioni scorrono separatamente e possono essere nascoste.

## Funzioni implementate

| Area | Contratto |
| --- | --- |
| Linea sostitutiva | Regola aperta A → B applicata a segmento, poligono o raggiera; settori specchiati e verso interno |
| Rami | Angolo, scala, innesto, specchio, coppie collegate, macro, variazioni per livello e seme riproducibile |
| Piegature | Copia collegata al terminale; rotazione, riflessione con asse trascinabile e sequenze ripetute |
| IFS | Da 1 a 8 trasformazioni affini contrattive; forma aperta/chiusa, riempimento e disposizione visiva |
| L-system | Assioma e fino a 6 produzioni, tartaruga con stack, angolo, scala del passo e direzione |
| Preset | 40 ricette, ricerca, famiglie, suggerimenti e miniature rappresentative |
| Esplorazione | Precedente/successivo, camera adattiva/fissa, pan, zoom, pinch e schermo intero |
| Animazione | Pausa sul livello corrente, ripresa, velocità, ripetizione e WebM dove supportato |
| Varianti | Quattro alternative, intensità, protezione di categorie e transizione animata |
| Stile | Colore uniforme, gradienti a due/tre colori, generazioni o famiglie, sfondo e assottigliamento |
| Costruzione | Lunghezze, congruenze, angoli, identità dei punti, griglia magnetica, specchio e raddrizzamento |
| Raccolta | Persistenza nel browser o file locali, duplicazione, rinomina, cestino e backup completo |
| Esportazione | PNG e SVG configurabili/trasparenti; JSON versione 5; importazione compatibile 1–4 |

## Modello dei dati

La versione 5 conserva i campi geometrici e cromatici precedenti e aggiunge:

- `composition`: tipo `segment`, `polygon` o `radial`; numero, orientamento, specchio e sviluppo interno.
- `growth`: collegamento delle coppie, apertura, dominanza, variazioni per livello, irregolarità, seme e alternanza radiale.
- `foldSequence`: fino a 12 operazioni `rotate` o `reflect` con angoli antiorari.
- `ifs`: chiusura, riempimento e trasformazioni con posizione, scale, angolo, inclinazione e specchio.
- `lsystem`: assioma, produzioni, angolo, scala e direzione iniziale.
- `structureColor`: `spatial`, `generation` o `family`.

Le versioni 1–4 continuano a essere validate dal motore originario; l’applicazione le converte in 5. La conversione inverte soltanto le vecchie rotazioni globali orarie, conservando gli assi di riflessione. La prima geometria risultante deve coincidere numericamente entro la precisione floating point.

Regola e figura iniziale sono concetti distinti: il contorno poligonale può essere chiuso mentre A e B della regola rimangono distinti. I generatori restituiscono punti o segmenti indipendenti, bounds, conteggio, livello effettivo e metadati per generazione/famiglia. IFS aggiunge il numero di segmenti del singolo contorno per il riempimento. Le piegature espongono i perni progressivi.

## Integrità

Ogni stato della cronologia comprende progetto, creazione associata e preset selezionato. Ripristinare una figura deve ripristinare anche la destinazione di aggiornamento. La bozza conserva separatamente questo contesto.

La visualizzazione arrotondata di una misura non diventa il valore di un vincolo. I valori digitati sono letti prima della formattazione; bloccare un campo non modificato usa la misura esatta. Un errore di costruzione conserva la figura valida precedente.

La validazione JavaScript e quella Python riconoscono lo stesso schema. Non si eseguono contenuti importati. Le parentesi delle grammatiche sono bilanciate; ogni trasformazione IFS è contrattiva rispetto alla norma euclidea.

## Persistenza

`dist/user-presets.js` resta un archivio versione 1 di record identificati, con progetti interni 3, 4 o 5. Il server valida, serializza le operazioni e usa sostituzione atomica. Rimane limitato a 24 record su file.

La raccolta unificata usa `forma.library.v2`, con record del browser e cestino. La vista unisce file e browser, fino a 256 identità. La vecchia raccolta viene migrata senza cancellare la chiave originale. Un backup include tutti i record e fino a 32 eliminazioni. L’importazione è validata integralmente prima della scrittura, scarta contenuti identici e assegna una nuova identità alle collisioni con contenuti diversi.

Il salvataggio automatico preferisce il server quando disponibile e la creazione appartiene ai file; altrimenti usa il browser. È possibile scegliere esplicitamente la destinazione. Un errore non deve sostituire dati già validi. Il recupero di un preset su file può generare un nuovo identificatore, conservando la ricetta.

## Prestazioni e limiti

| Risorsa | Limite |
| --- | --- |
| Segmenti standard | 131.072 |
| Segmenti delle piegature | 1.048.576 |
| Iterazioni | Linee/IFS/L-system 10, piegature 20, rami 32 |
| Punti interni / rami / copie IFS | Da 1 a 8 |
| Settori | Fino a 12, con costo dello specchio incluso |
| Simboli L-system | 1.048.576 |
| Produzioni / passi di piegatura | 6 / 12 |
| Cronologia | 60 stati con identità |
| Raccolta / cestino | 256 / 32 |
| File importati | 2 MB |
| PNG | Da 128 a 8192 px per lato, massimo 32 megapixel |

La geometria viene calcolata nel worker. Le richieste superate vengono accorpate; un’elaborazione lunga può essere interrotta per privilegiare l’ultima modifica. I livelli di confronto vengono calcolati nello stesso worker.

Le scene oltre 65.536 segmenti usano OffscreenCanvas nel worker quando disponibile. Pan e zoom riutilizzano l’ultima immagine, con affinamento asincrono; gli export usano i buffer esatti. Senza worker/OffscreenCanvas è previsto un percorso alternativo. La griglia ha cicli limitati anche con coordinate di grande ordine di grandezza.

Obiettivi sul dispositivo di riferimento: interazioni ordinarie sotto 150 ms; risposta visiva della navigazione sotto 100 ms anche al limite delle piegature, dopo il primo disegno; primo disegno completo indicativamente entro 3 secondi. Sono obiettivi di verifica, non garanzie per ogni dispositivo. `tests/features.browser.mjs` registra ambiente e tre campioni di navigazione in `.qa-browser/performance.json`.

## Verifica e accessibilità

Le suite verificano geometria originale, migrazioni, chiusura dei poligoni, simmetrie, crescita con seme, IFS, tartaruga e limiti. Le prove browser coprono le due regressioni iniziali, i 40 preset, controlli reali, trascinamenti, persistenza, recupero, backup, esportazioni, video e mobile simulato. I test operano su copie temporanee.

I dialoghi hanno un nome accessibile, i controlli hanno etichette e focus visibile e i principali comandi sono disponibili da tastiera. Prima di dichiarare supporto completo sono necessarie prove con lettori di schermo, dispositivi touch fisici e browser diversi da Chromium.

## Distribuzione

L’applicazione rimane autonoma, senza backend remoto, account, analytics o connessioni esterne. Nessuna pubblicazione automatica è configurata. Licenza e supporto multipiattaforma vanno decisi prima di una distribuzione pubblica.

# Changelog

## 2026-11-13 — Laboratorio esteso

- Corrette identità di salvataggio nella cronologia e precisione dei vincoli; i dialoghi hanno nomi accessibili.
- Introdotti progetti versione 5 con conversione compatibile 1–4 e angoli antiorari coerenti.
- Aggiunti poligoni, raggiere e settori specchiati alle linee sostitutive.
- Aggiunti coppie collegate, portamento, crescita per livello, seme e irregolarità ai rami.
- Riviste le piegature: asse dello specchio trascinabile, sequenze e segnalazione delle sovrapposizioni.
- Aggiunti generatori IFS e L-system; la libreria comprende 40 preset filtrabili.
- Riorganizzati editor, timeline, stile e layout mobile; aggiunti livelli di confronto e camera fissa.
- Unificata la raccolta con salvataggi nel browser/file, backup, migrazione e cestino recuperabile.
- Aggiunti confronto di varianti, protezioni, transizioni e registrazione WebM.
- PNG/SVG configurabili e trasparenti, con riempimenti e colori strutturali.
- Rendering delle scene pesanti nel worker con OffscreenCanvas e riutilizzo dell’immagine durante pan/zoom.
- Estese le verifiche geometriche, del server e browser alle nuove funzionalità.

## Non rilasciato

### Ramificazioni e spirali libere

- Aggiunta una modalità generale con segmenti separati e regole ricorsive, oltre alla linea sostitutiva.
- Da uno a otto rami figli con angoli, proporzioni, innesti e riflessioni indipendenti; punte trascinabili e controlli numerici.
- Aggiunti i preset Albero simmetrico e Albero a spirale, entrambi modificabili.
- Fino a 32 iterazioni per i rami, soglia minima di lunghezza e limite di complessità applicato a livelli completi.
- Sfondo personalizzabile, tratto fino a 12 px e assottigliamento dei rami, conservati in PNG e SVG senza linee tra rami separati.
- Progetti versione 4 e salvataggio dei preset ramificati nel sorgente, compatibili in lettura con le versioni 1, 2 e 3.
- Verifiche di topologia, trasformazioni, spirali, riflessioni, soglie, trascinamento, cronologia, persistenza ed esportazioni.

### Caricamento dopo aggiornamenti locali

- Versionati i riferimenti a script e stile per evitare il riuso di file precedenti incompatibili con l'HTML aggiornato.
- Disabilitata la cache per tutte le risposte del server locale, anche in presenza di richieste condizionali con timestamp.
- Verificato il caricamento con uno script precedente già presente nella cache del browser.

### A fisso e B adattabile — 11 novembre 2026

- A bloccato in `(0, 0)`; B selezionabile, trascinabile e modificabile nelle coordinate.
- Costruzione in sequenza da A: B si adatta ad angoli, lunghezze e congruenza; i valori liberi mantengono le misure correnti.
- Rimossi reset e modifica di A; durante il trascinamento i vincoli attivi hanno priorità.
- Traslazione dei progetti precedenti per riportare A all'origine senza alterare la forma.
- Aggiornati requisiti e verifiche per vincoli, cronologia, persistenza e compatibilità.

### B fisso e preset nel progetto

- Ripristinato B fisso nell'editor, mantenendo A mobile e il reset all'origine.
- Spostato Salva creazione nella sezione dei preset, accanto alle forme iniziali e personali.
- Aggiunto `dist/user-presets.js` come archivio versionato, incluso nel progetto e caricato alla riapertura.
- Aggiunto `serve.py`, senza dipendenze, per creare, aggiornare ed eliminare preset con scritture atomiche locali.
- Aggiornato `avvia-locale.cmd`; la vecchia raccolta del browser resta consultabile.
- Verificati riavvio, cancellazione dei dati del browser, modifiche future e conservazione del file in caso di errori.

### Estremi mobili e colore della linea

- A e B trascinabili e modificabili nelle coordinate, con reset di A a `(0, 0)` e cronologia.
- Geometria e vincoli riferiti alla posizione effettiva di A; gli estremi scelti restano ancorati durante l'adattamento degli intermedi.
- Scelta tra colore uniforme e gradiente continuo con due colori personalizzabili.
- Gradiente coerente in Canvas, miniature, PNG e SVG, sostituendo i precedenti blocchi cromatici.
- Progetti JSON versione 3 con posizione di A e impostazioni cromatiche, compatibili in lettura con le versioni 1 e 2.
- Test di trascinamento dei due estremi, reset, colori effettivi nel Canvas, esportazioni e ripristino.

### Editor geometrico — 5 novembre 2026

- Mantenuta la sequenza dei punti anche con coordinate negative, ritorni su X e incroci.
- A e B fissi; adattamento dei punti intermedi ai vincoli tramite ricerca numerica verificata.
- Lunghezze bloccabili, tre gruppi di congruenza, angoli interni e orientamento iniziale.
- Applicazione esplicita dei vincoli con controlli di congruenza, distanza tra estremi e raggiungimento di B.
- Punti rossi, archi verdi e frecce blu per il verso indipendente di ogni lato.
- Inserimento nella sequenza e divisione dei lati; i cambi di topologia liberano i vincoli dimensionali.
- Generatore normalizzato sulla nuova corda AB anche quando è inclinata.
- Progetti JSON versione 2 con B, versi e vincoli, mantenendo la lettura della versione 1.
- Estesi i test del motore e i flussi browser ai nuovi controlli.

### Riordino e documentazione

- Definiti requisiti, criteri di accettazione e roadmap in `prd.md`.
- Consolidate istruzioni di avvio, struttura, salvataggi e limiti nel README.
- Conservati i prototipi originali in `legacy/`.
- Rimossi archivio di pubblicazione, schermate generate e metadati della precedente anteprima ospitata.
- Aggiunte regole Git per gli artefatti locali e i terminatori di riga.

### Laboratorio locale

- Applicazione statica senza autenticazione e risorse esterne.
- Editor interattivo, sei preset, generazione casuale, palette e riflessione alternata.
- Rendering Canvas con calcolo in worker, limite di complessità e controlli di navigazione.
- Animazione della costruzione, cronologia, bozza e raccolta nel browser.
- Esportazioni PNG, SVG e JSON e importazione dei progetti.
- Avvio facoltativo su `127.0.0.1` con `avvia-locale.cmd`.
- Verifiche automatiche del motore e dei flussi browser, con layout mobile simulato.

Non è ancora stata assegnata una versione di rilascio o scelta una licenza di distribuzione.




## Trasformazioni globali, preset e gradiente

La terza metodologia (`free`, identificatore mantenuto per i salvataggi) clona tutta la struttura corrente e ruota o riflette la copia intorno al perno corrente e la percorre al contrario: prima il perno e B, poi il nuovo estremo A-primo, A-secondo e cosi via. Il B originale resta invariato. Il nuovo estremo e P + M(A-P), con P perno corrente, con M matrice di rotazione o riflessione. A ogni passaggio i segmenti raddoppiano: non si ruota intorno ad A e non si sostituiscono singoli lati. Anche la riflessione conserva la traslazione e viene riapplicata a ogni generazione.

`colorMiddle` e un terzo colore opzionale al 50% del gradiente: `null` conserva i due estremi precedenti. Canvas, PNG, SVG, JSON e preset personali conservano il colore centrale. I valori predefiniti mantengono compatibili i progetti precedenti.

Sono disponibili 24 preset, otto per ogni metodologia, separati graficamente dai personali. Le varianti di curve e ramificazioni si ispirano alle raccolte di [Paul Bourke](https://paulbourke.net/fractals/) e a [The Algorithmic Beauty of Plants](https://algorithmicbotany.org/papers/abop/abop.pdf). Felce, Pino, Corallo e i motivi globali sono varianti esplorative dei generatori disponibili, non riproduzioni certificate di ogni sistema descritto nelle fonti.

Verifica aggiuntiva: `node tests/global.test.cjs`. La suite browser apre tutti i 24 preset, verifica i gruppi, le opzioni globali, i campi arrotondati e il gradiente a tre colori dopo salvataggio e in SVG.


## Crescita collegata, percentuali e vista adattiva

Nella terza metodologia il numero di segmenti e quello della spezzata iniziale moltiplicato per `2^N`, entro il limite globale. Ogni copia viene percorsa dal terminale al punto iniziale trasformato, agganciandosi al perno senza spostare B. Il campo `endpoint` della geometria generata identifica il nuovo terminale per le copie successive.

I cursori di tratto, assottigliamento e tratto dello spettro usano percentuali a passi del 5%, con valori di sola lettura. Il 100% del tratto corrisponde a 12 px; il 100% dell'assottigliamento all'esponente 1,5. Il dettaglio usa direttamente iterazioni intere: massimo 10 per le linee, 20 per le copie e 32 per i rami. Le frecce modificano il livello di una unita. I progetti precedenti mantengono i valori fisici dello stile e mostrano il cursore percentuale piu vicino.

Lo spettro della prima metodologia ha colore e spessore indipendenti, resta tratteggiato al 30% di opacita e non viene incluso nelle esportazioni. Preferenze dello spettro e zoom vengono conservati in `forma.view.v1` nel browser. Lo zoom e relativo alla figura adattata: crescita, cambio preset e ridimensionamento conservano la percentuale scelta e ricentrano la figura. Il pulsante Adatta riporta al 100%.

La vista del disegno rimane dentro l'altezza disponibile della finestra. Su schermi stretti le impostazioni sono sotto il disegno, in un pannello che scorre autonomamente. Ogni famiglia di otto preset occupa due righe da quattro colonne.

Il preset Fiocco radiale nella seconda metodologia mantiene AB come braccio di riferimento: `radialCopies` (intero da 1 a 12, predefinito 1) replica i tronchi intorno ad A. Il fiocco usa sei bracci e le stesse regole dei rami per tutti. Non cambia il significato o la posizione di A e B e non e il fiocco chiuso di Koch.


### Perno progressivo e verso della copia

La terza metodologia conserva la forma corrente, trasforma l'intera copia intorno al terminale P e inverte l'ordine dei suoi segmenti. La copia parte cosi dal perno condiviso; la trasformazione del vecchio punto iniziale A diventa il nuovo estremo A-primo e il perno successivo. Il B iniziale non viene modificato. Angoli di rotazione positivi sono orari; per la riflessione l'angolo indica l'asse.

Caso di riferimento: A=(0,0), P1=(1,0), B=(1,1), rotazione 90 gradi. Il primo passaggio produce il percorso (0,0) -> (1,0) -> (1,1) -> (0,1) -> (0,2). Il nuovo A-primo e (0,2); al secondo passaggio il perno e (0,2) e A-secondo diventa (-2,2). Il numero di segmenti raddoppia e il prefisso precedente resta invariato. Questo caso e verificato automaticamente in `tests/global.test.cjs`.


### Preset delle copie e dettaglio esteso

Gli otto preset della terza metodologia sono Drago a L, Reticolo esagonale, Cristallo a 108 gradi, Fisarmonica, Uncini, Triangoli, Vortice e Friso specchiato. Il Drago a L usa esattamente A=(0,0), P1=(1,0), B=(1,1) e una rotazione oraria di 90 gradi, con gradiente verde-giallo-rosso. I preset usano profondita iniziali adatte a mostrare la struttura, restando modificabili.

La terza metodologia accetta fino a 20 duplicazioni richieste e un massimo di 1.048.576 segmenti, conservando solo generazioni complete. La L ha due segmenti iniziali: raggiunge 19 duplicazioni effettive al massimo dettaglio (1.048.576 segmenti), contro le precedenti 10 (2.048 segmenti). Il motore prealloca i buffer tipizzati, evitando grandi array temporanei e una seconda copia integrale. Linee e rami conservano il limite di 131.072 segmenti.

La barra Dettaglio non usa piu percentuali: mostra il numero di iterazioni, e segnala separatamente quello effettivo quando il limite di segmenti interviene. Spessore, assottigliamento e stile dello spettro mantengono i cursori percentuali a passi del 5%. Salvataggio, importazione e server locale supportano le profondita estese.

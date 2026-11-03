# Forma — Laboratorio di frattali

Evoluzione della versione `ftattali.html`: un laboratorio per modificare una regola geometrica e osservare cosa succede quando ogni segmento viene sostituito dalla stessa polilinea.

## Avvio

Apri **`dist/index.html`** in un browser moderno. Non servono installazioni, build o servizi esterni. Per sviluppo o hosting puoi servire `dist/` con un qualsiasi server statico, ad esempio `python -m http.server 8080 --directory dist` dalla cartella del progetto.

## Cosa puoi fare

- Sei preset (Koch, Lévy, Minkowski, zig zag, picco triangolare, onda) e generazione casuale.
- Editor con mouse, touch o penna; da uno a otto punti, coordinate numeriche e annulla/ripeti fino a 60 stati.
- Fino a dieci iterazioni richieste, riflessione dei segmenti alterni, cinque palette e spessore del tratto.
- Pan, zoom ancorato al puntatore, pinch con due dita, griglia, adattamento alla vista e schermo intero dove supportato.
- Animazione della costruzione, una iterazione alla volta.
- Bozza automatica e raccolta di massimo 24 creazioni con miniature nel browser.
- Esportazioni PNG 2400 × 1800, SVG e progetto JSON; importazione JSON dalla raccolta.
- Scorciatoie: `F` adatta, `Spazio` anima quando il focus è sul disegno o sulla pagina, `Ctrl/Cmd+Z` annulla, `Ctrl/Cmd+Shift+Z` ripeti, `?` guida.

## File

- `dist/index.html`: struttura e dialoghi.
- `dist/styles.css`: interfaccia responsive, senza font o risorse esterne.
- `dist/engine.js`: trasformazioni geometriche, limite di complessità e validazione dei progetti; utilizzabile anche in Node.
- `dist/app.js`: editor, rendering Canvas, Web Worker, cronologia, raccolta ed esportazioni.
- `tests/engine.test.cjs`: verifica coordinate, conteggi, limiti, riflessioni e importazioni non valide.
- `tests/browser.mjs`: verifica integrazioni in Chromium via DevTools, senza dipendenze npm.

Il calcolo avviene in un Web Worker creato da un Blob; se il browser non lo consente, viene usato un calcolo differito sul thread principale. La geometria è mantenuta in cache durante pan, zoom e cambi di colore. Il rendering raggruppa le linee in al massimo 96 tratti di colore. Le iterazioni effettive vengono limitate affinché la geometria non superi **131.072 segmenti** e sono mostrate accanto a quelle richieste. La Y positiva punta verso l’alto sia nell’editor sia nel risultato.

La riflessione alternata è una variante della regola; non viene presentata come una costruzione esatta della curva del drago. Non viene mostrata una dimensione di Hausdorff stimata da rapporti medi, perché tale formula non è valida per generatori arbitrari.

## Salvataggi

Bozza e raccolta usano `localStorage`, sono separate per browser e origine e non vengono sincronizzate. Il passaggio da file locale a sito ospitato crea una raccolta distinta: usa i progetti JSON per trasferire le creazioni. Se la memoria del browser è piena o disabilitata, esporta il JSON per conservare il lavoro. L’esportazione grafica include l’intera geometria, senza griglia o controlli; non dipende dal pan o dallo zoom correnti.

## Verifica

Con Node installato:

```sh
node tests/engine.test.cjs
node tests/browser.mjs
```

Il secondo comando richiede Chrome installato. Su Windows cerca il percorso standard; per un altro browser Chromium o sistema imposta `CHROME_PATH` al suo eseguibile. Usa un profilo di prova separato in `.qa-browser/`, acquisisce `desktop.png` e `mobile.png` e chiude il browser di prova al termine. I test eseguiti durante lo sviluppo hanno usato il runtime Node già incluso nell’editor installato e Chrome, senza installare pacchetti.

I prototipi Python e HTML nella cartella superiore restano disponibili come riferimento.

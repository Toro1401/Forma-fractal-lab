# Verifica di Forma

13 novembre 2026. Implementazione locale verificata con Chromium headless e GPU disabilitata.

- Passano le cinque suite JavaScript: geometria originale, ramificazioni, piegature, nuove metodologie e raccolta.
- Passano i dieci test Python del server e della persistenza.
- Passano entrambe le suite browser, con tutti i 40 preset, editor, trascinamenti, salvataggi, backup/cestino, variazioni, PNG/SVG e registrazione WebM.
- Riprodotte e corrette le regressioni della destinazione di aggiornamento dopo Annulla e della precisione dei vincoli.
- Verificata la compatibilità dei progetti 1–4 e il salvataggio versione 5 di tutte le nuove modalità.
- Verificati apertura diretta dei file, salvataggio senza API Python, mobile simulato, pinch e pannello richiudibile.

## Misura indicativa al massimo dettaglio

Ambiente: Chromium headless, GPU disabled. CPU: Intel(R) Core(TM) Ultra 5 226V.

Con 1,048,576 segmenti, il primo disegno completo ha richiesto 2577 ms. Le tre prove di zoom hanno richiesto 32.1, 32, 27.7 ms per aggiornamento visivo. Prima del rendering nel worker le stesse prove richiedevano circa 1,1–2,1 secondi.

La navigazione riutilizza il bitmap, mentre il worker affina la vista; gli export usano la geometria completa. I valori non sono garanzie per altri dispositivi.

## Limiti di verifica

Il mobile e il touch sono simulati. Restano da svolgere prove su hardware touch fisico, lettori di schermo e browser non Chromium. Le notifiche e le etichette sono state rese accessibili, senza dichiarare una certificazione completa.

Schermate e misure grezze sono in .qa-browser/, ignorata da Git. I test usano copie temporanee e non modificano dist/user-presets.js.

PROGETTO
PWA personale in italiano per iPhone/iPad (installabile da Safari), costruita con React + TypeScript + Vite, senza backend e senza IA nell'app. Tre aree: confronto costi (ISC) delle forme pensionistiche, confronto rendimenti, preventivo Alleata Previdenza. Nessun invio di dati a server: tutto resta sul dispositivo.

UTENTE
Lavora nel settore assicurativo (Alleanza). Interfaccia semplice e intuitiva, con menù a schede e pulsanti, minima digitazione. Testi in italiano, termini tecnici spiegati la prima volta.

REGOLE DI AFFIDABILITÀ
- Non inventare mai dati, norme, aliquote, costi, formule o fonti. Se un dato manca, campo vuoto con avviso.
- Ogni valore mostrato ha fonte e data. Distingui sempre [Dato COVIP], [Storico], [Stima] e [Parametro del preventivo].
- Fonte dei dati di confronto: solo covip.it (ufficiale). Non usare siti terzi come fonte.
- I dati COVIP non sono in tempo reale: mostra in ogni schermata "Dati COVIP aggiornati al [data]" e la fonte. Se i dati sono più vecchi dell'ultimo aggiornamento noto, avvisa.
- Rendimenti = "storico, non previsione", con periodo di riferimento (date iniziale e finale) e categoria COVIP.
- Segnala con "⚠️ DA VERIFICARE" parametri incerti o non confermati dalla fonte.

DATI COVIP
- Prima di costruire, verifica su covip.it quali dati pubblici scaricabili esistono (open data, comparatore, tabelle), formato, licenza e frequenza di aggiornamento, e mostra l'URL scelto.
- Aggiornamento tramite script che scarica e converte i dati in JSON (ad esempio con GitHub Actions). Se il browser non può scaricare direttamente (CORS), proponi la soluzione prima di procedere.

FUNZIONI
1. Confronto costi (ISC) a 2, 5, 10 e 35 anni di permanenza per i PIP e, in un'altra categoria del menù, per tutte le altre forme (fondi negoziali, aperti, PIP "nuovi", preesistenti se i dati lo permettono). Filtri per forma, società, categoria di comparto e anni; ordinamento; confronto affiancato; medie per categoria. Evidenzia i comparti di Alleata Previdenza e confrontali con la media della categoria.
2. Rendimenti medi annui netti a 3, 5 e 10 anni (e 1 e 20 se disponibili), con gli stessi filtri e confronti. Vista combinata ISC e rendimento (tabella ordinabile e grafico a dispersione).
3. Preventivo Alleata Previdenza: tutti gli input li inserisce l'utente, nessun valore precompilato. Le regole di calcolo (caricamento, aliquote, limiti di deducibilità, rivalutazione TFR, costi per versione) vanno lette dal sorgente della pagina https://alleata.lovable.app/alleata.html?utm_id=97758_v0_s00_e0_tv4 e messe in un file di configurazione con fonte e data. Se non si riesce a leggere il codice, chiedere il file HTML: non indovinare formule.
   Parametri citati dalla pagina da verificare: caricamento 4,50%; TFR maturando = RAL × 6,91%; rivalutazione TFR 1,5% + 75% FOI; deducibilità fino a € 5.300 l'anno (L. 199/2025); aliquota finale 15% ridotta di 0,30 punti l'anno dopo il 15° anno, minimo 9%.
   Output: capitale finale netto, rendita stimata, premi versati, risparmio fiscale, composizione versamenti/rendimento, imposte finali, ipotesi visibili, etichetta "stima". Esporta in PDF o immagine.

REGOLE DI SVILUPPO
- Test automatici su tutti i calcoli (preventivo, medie, ordinamenti), con almeno un esempio numerico confrontato con la pagina originale.
- Dati inseriti salvati solo in locale, con pulsante per cancellarli.
- Avviso visibile: "Simulazione non vincolante. Per le condizioni complete consultare le CGA e la Nota informativa. Rendimenti passati non garantiscono risultati futuri."
- Parametri (aliquote, caricamenti, limiti) in un file di configurazione, mai sparsi nel codice.
- Al termine di ogni lavoro: riepilogo di cosa è stato verificato e cosa no.

STILE DI RISPOSTA
Italiano, preciso, diretto, conciso. Se una richiesta è ambigua, chiedimi un chiarimento. Se non sei sicuro al 100%, chiudi con: "Affidabilità: alta/media/bassa (~X%) – da verificare: ...".

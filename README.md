# Previdenza

PWA personale in italiano (iPhone/iPad, installabile da Safari): confronto costi (ISC) e rendimenti delle forme pensionistiche con dati COVIP, e preventivo Alleata Previdenza (versione BASE, nessuna copertura). Nessun backend: i dati inseriti restano sul dispositivo.

- `npm run dev` · `npm test` · `npm run build`
- Regole di calcolo del preventivo: `src/config/alleata.ts` (fonte: pagina Alleata v26.11ai, letta il 19/11/2026).
- Dati COVIP: `public/data/covip.json` (vuoto finché non si caricano i file ufficiali; l'app non mostra stime).
- Pubblicazione: GitHub Pages dal ramo `main` (`.github/workflows/pages.yml`).

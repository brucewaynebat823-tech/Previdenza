# Previdenza

PWA personale in italiano (iPhone/iPad, installabile da Safari): confronto costi (ISC) e rendimenti delle forme pensionistiche con dati COVIP, e preventivo Alleata Previdenza (versione BASE, nessuna copertura). Nessun backend: i dati inseriti restano sul dispositivo.

- `npm run dev` · `npm test` · `npm run build`
- Regole di calcolo del preventivo: `src/config/alleata.ts` (fonte: pagina Alleata v26.11ai, letta il 19/11/2026).
- Dati COVIP incorporati: `public/data/covip.json`, generato dai file XLSX di covip.it/open-data con `npm run dati -- PIP:isc:file.xlsx:2025-12-31:verifica PIP:rend:file.xlsx` (vedi `scripts/genera-dati.ts`). L'utente può sostituirli dalla scheda Dati; i suoi file restano sul dispositivo.
- Pubblicazione: GitHub Pages dal ramo `main` (`.github/workflows/pages.yml`).

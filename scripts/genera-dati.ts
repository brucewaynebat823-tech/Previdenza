/**
 * Genera public/data/covip.json (dati COVIP incorporati nell'app) da file XLSX scaricati da covip.it/open-data.
 * Uso:  npm run dati -- PIP:isc:/percorso/isc.xlsx:2025-12-31:verifica  PIP:rend:/percorso/rendimenti.xlsx
 *   per i fondi preesistenti (elenco con link alle schede costi):  PREESISTENTE:schede:/percorso/file.xlsx
 *   formato di ogni argomento:  FORMA:tipo:file[:data[:verifica]]   (FORMA = PIP|FPN|FPA|PREESISTENTE, tipo = isc|rend)
 *   data = data dei dati (YYYY-MM-DD); per i rendimenti, se omessa, si deduce dai periodi scritti nel file;
 *   "verifica" segna la data come indicativa da verificare.
 * Nessun dato è inventato: le colonne sono riconosciute dai titoli del file (stesso codice dell'app).
 */
import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import readExcel from 'read-excel-file/node';
import { analizza, costruisci, type Riga } from '../src/lib/importa';
import { leggiSchede } from '../src/lib/schede';
import type { ElencoPreesistenti, FormaTipo, Slots, TipoFile } from '../src/data/tipi';

const slot: Slots = {};
let preesistenti: ElencoPreesistenti | undefined;
for (const arg of process.argv.slice(2)) {
  const [forma, tipo, file, data, verifica] = arg.split(':') as [FormaTipo, TipoFile | 'schede', string, string?, string?];
  if (tipo === 'schede') {
    // Elenco dei fondi preesistenti con link alle schede dei costi: nessun valore numerico.
    const fondi = leggiSchede((await readExcel(file))[0].data as Riga[]);
    preesistenti = { nomeFile: basename(file).replace(/^[0-9a-f]{8}-/, ''), fondi };
    console.log(`${forma}:schede ← ${basename(file)}: ${fondi.length} fondi`);
    continue;
  }
  const fogli = await readExcel(file);
  const an = fogli.map((f) => ({ f, a: analizza(f.data as Riga[], tipo) }));
  const migliore = an.sort((x, y) => Number(y.a.riconosciuto) - Number(x.a.riconosciuto) || y.a.punteggio - x.a.punteggio)[0];
  if (!migliore.a.riconosciuto) throw new Error(`Colonne non riconosciute in ${file}`);
  const righe = migliore.f.data as Riga[];
  const { comparti } = costruisci(righe, migliore.a.ultimaIntest, migliore.a.ab, tipo, forma);
  const anni = Object.values(migliore.a.periodi).flatMap((p) => p.split('-').map(Number));
  const aggiornatoAl = data || (anni.length ? `${Math.max(...anni)}-12-31` : '');
  if (!aggiornatoAl) throw new Error(`Indica la data dei dati per ${file}`);
  slot[`${forma}:${tipo}`] = {
    comparti,
    meta: {
      forma, tipo, nomeFile: basename(file).replace(/^[0-9a-f]{8}-/, ''), aggiornatoAl, comparti: comparti.length, caricatoIl: new Date().toISOString().slice(0, 10),
      periodi: tipo === 'rend' && Object.keys(migliore.a.periodi).length ? migliore.a.periodi : undefined,
      dataDaVerificare: verifica === 'verifica' ? true : undefined,
    },
  };
  console.log(`${forma}:${tipo} ← ${basename(file)}: ${comparti.length} comparti, dati al ${aggiornatoAl}${verifica === 'verifica' ? ' (da verificare)' : ''}`);
}
writeFileSync('public/data/covip.json', JSON.stringify({ fonte: 'COVIP – open data', urlFonte: 'https://www.covip.it/open-data', slot, ...(preesistenti ? { preesistenti } : {}) }));
console.log('Scritto public/data/covip.json');

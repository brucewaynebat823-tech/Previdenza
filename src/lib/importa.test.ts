import { describe, it, expect } from 'vitest';
import { analizza, numeroCella, categoriaDaTesto, costruisci, unisci, rimuoviSlot, titoliColonne, type Riga } from './importa';

// Tabelle SINTETICHE usate solo per testare la logica (non sono dati COVIP).
const semplice: Riga[] = [
  ['Titolo del foglio'],
  [],
  ['Società', 'Forma pensionistica', 'Comparto', 'Categoria', 'ISC 2 anni', 'ISC 5 anni', 'ISC 10 anni', 'ISC 35 anni'],
  ['Alfa', 'Piano A', 'Linea Garantita', 'Garantito', '1,5', 2.5, 'n.d.', ''],
  ['Beta', 'Piano B', 'Linea Dinamica', 'Azionario', 3, 2, 1.5, '1.250,5'],
  [null, null, null],
];
const duePrimeRighe: Riga[] = [
  ['Società', 'Comparto', 'Categoria', 'Indicatore Sintetico dei Costi', null, null, null],
  [null, null, null, '2 anni', '5 anni', '10 anni', '35 anni'],
  ['Alfa', 'Linea A', 'Bilanciato', 1.1, 0.9, 0.8, 0.6],
  ['Beta', 'Linea B', 'Azionario', 2.1, 1.9, 1.8, 1.6],
];
const lungo: Riga[] = [
  ['Denominazione', 'Comparto', 'Anni di permanenza', 'ISC'],
  ['Alfa', 'Linea A', 2, 1.1],
  ['Alfa', 'Linea A', 5, 0.9],
  ['Alfa', 'Linea A', 10, 0.8],
  ['Beta', 'Linea B', 2, 2.1],
  ['Beta', 'Linea B', 5, 1.9],
];
const senzaTitoliUtili: Riga[] = [
  ['Colonna1', 'Colonna2', 'Colonna3', 'Colonna4'],
  ['Alfa Fondo', 1.5, 1.2, 0.9],
  ['Beta Fondo', 2.5, 2.2, 1.9],
  ['Gamma Fondo', 3.5, 3.2, 2.9],
  ['Delta Fondo', 1.1, 1.0, 0.9],
];

describe('riconoscimento colonne', () => {
  it('tabella semplice con titoli su una riga', () => {
    const a = analizza(semplice, 'isc');
    expect(a.riconosciuto).toBe(true);
    expect(a.ab).toMatchObject({ societa: 0, fondo: 1, comparto: 2, categoria: 3, y2: 4, y5: 5, y10: 6, y35: 7 });
    expect(a.ultimaIntest).toBe(2);
  });
  it('titoli su due righe con cella unita', () => {
    expect(titoliColonne(duePrimeRighe, 0, 1)[4]).toBe('Indicatore Sintetico dei Costi 5 anni');
    const a = analizza(duePrimeRighe, 'isc');
    expect(a.riconosciuto).toBe(true);
    expect(a.ab).toMatchObject({ societa: 0, comparto: 1, y2: 3, y5: 4, y10: 5, y35: 6 });
    expect(costruisci(duePrimeRighe, a.ultimaIntest, a.ab, 'isc', 'PIP').comparti[0].isc).toEqual({ 2: 1.1, 5: 0.9, 10: 0.8, 35: 0.6 });
  });
  it('formato lungo: una riga per comparto e per anni', () => {
    const a = analizza(lungo, 'isc');
    expect(a.riconosciuto).toBe(true);
    const r = costruisci(lungo, a.ultimaIntest, a.ab, 'isc', 'PIP').comparti;
    expect(r).toHaveLength(2);
    expect(r.find((c) => c.comparto === 'Linea A')?.isc).toMatchObject({ 2: 1.1, 5: 0.9, 10: 0.8 });
  });
  it('titoli non utili: abbinamento a posizione ma segnato come incerto', () => {
    const a = analizza(senzaTitoliUtili, 'isc');
    expect(a.incerto).toBe(true);
    expect(a.riconosciuto).toBe(false);
    expect(a.ab).toMatchObject({ comparto: 0, y2: 1, y5: 2, y10: 3 });
  });
  it('titoli con varianti: ISC_2, "2 anni"', () => {
    const t: Riga[] = [['Società', 'Comparto', 'ISC_2', 'ISC_5', 'ISC_10', 'ISC_35'], ['A', 'B', 1, 2, 3, 4], ['C', 'D', 1, 2, 3, 4]];
    expect(analizza(t, 'isc').ab).toMatchObject({ y2: 2, y5: 3, y10: 4, y35: 5 });
  });
  it('rendimenti: "Rendimento medio annuo composto 10 anni"', () => {
    const t: Riga[] = [['Società', 'Comparto', 'Rendimento medio annuo composto 3 anni', 'Rendimento medio annuo composto 10 anni'], ['A', 'B', 1, 2], ['C', 'D', 1, 2]];
    expect(analizza(t, 'rend').ab).toMatchObject({ y3: 2, y10: 3 });
  });
});

describe('import', () => {
  it('numeroCella: solo numeri veri, il resto è dato mancante', () => {
    expect(numeroCella('1,5')).toBe(1.5);
    expect(numeroCella('1.5')).toBe(1.5);
    expect(numeroCella('1,5%')).toBe(1.5);
    expect(numeroCella('-0,3')).toBe(-0.3);
    expect(numeroCella('n.d.')).toBeNull();
    expect(numeroCella('')).toBeNull();
    expect(numeroCella(undefined)).toBeNull();
  });
  it('categoriaDaTesto non indovina i testi sconosciuti', () => {
    expect(categoriaDaTesto('Obbligazionario misto')).toBe('OBB MISTO');
    expect(categoriaDaTesto('Altro')).toBeNull();
  });
  it('costruisce i comparti, con null per i valori mancanti', () => {
    const a = analizza(semplice, 'isc');
    const r = costruisci(semplice, a.ultimaIntest, a.ab, 'isc', 'PIP');
    expect(r.comparti).toHaveLength(2);
    expect(r.comparti[0]).toMatchObject({ societa: 'Alfa', comparto: 'Linea Garantita', categoria: 'GAR', forma: 'PIP', isc: { 2: 1.5, 5: 2.5, 10: null, 35: null } });
  });
  it('valori in frazione: moltiplica per 100 solo se richiesto', () => {
    const t: Riga[] = [['Società', 'Comparto', 'ISC 2 anni'], ['A', 'B', 0.012], ['C', 'D', 0.02]];
    const a = analizza(t, 'isc');
    expect(costruisci(t, a.ultimaIntest, a.ab, 'isc', 'PIP').comparti[0].isc[2]).toBe(0.012);
    expect(costruisci(t, a.ultimaIntest, a.ab, 'isc', 'PIP', { moltiplica100: true }).comparti[0].isc[2]).toBe(1.2);
  });
  it('unisce file ISC e rendimenti sullo stesso comparto', () => {
    const isc = costruisci(semplice, 2, analizza(semplice, 'isc').ab, 'isc', 'PIP').comparti;
    const rt: Riga[] = [['Società', 'Forma pensionistica', 'Comparto', 'Rendimento 3 anni', 'Rendimento 5 anni'], ['Alfa', 'Piano A', 'Linea Garantita', '1,1', '2,2']];
    const rend = costruisci(rt, 0, analizza(rt, 'rend').ab, 'rend', 'PIP').comparti;
    const u = unisci(isc, rend, 'rend');
    expect(u).toHaveLength(2);
    expect(u.find((c) => c.societa === 'Alfa')).toMatchObject({ isc: { 2: 1.5 }, rend: { 3: 1.1, 5: 2.2 }, categoria: 'GAR' });
  });
  it('rimuoviSlot toglie solo il tipo richiesto e solo per la forma indicata', () => {
    const isc = costruisci(semplice, 2, analizza(semplice, 'isc').ab, 'isc', 'PIP').comparti;
    const rt: Riga[] = [['Società', 'Forma pensionistica', 'Comparto', 'Rendimento 3 anni'], ['Alfa', 'Piano A', 'Linea Garantita', '1,1']];
    const u = unisci(isc, costruisci(rt, 0, analizza(rt, 'rend').ab, 'rend', 'PIP').comparti, 'rend');
    const senzaIsc = rimuoviSlot(u, 'PIP', 'isc');
    expect(senzaIsc).toHaveLength(1);
    expect(senzaIsc[0].rend[3]).toBe(1.1);
    expect(senzaIsc[0].isc).toEqual({});
    expect(rimuoviSlot(u, 'FPN', 'isc')).toHaveLength(2);
    expect(rimuoviSlot(rimuoviSlot(u, 'PIP', 'isc'), 'PIP', 'rend')).toHaveLength(0);
  });
});

// Struttura dei file COVIP veri (dati INVENTATI): titoli su 3 righe con periodi, società e piano solo sulla prima riga
// di ogni gruppo, categorie come codici, note in fondo, "&amp;" nei nomi, valori testuali con la virgola nel file dei costi.
const covipRend: Riga[] = [
  [],
  [null, 'ELENCO DEI RENDIMENTI PER SINGOLA LINEA'],
  [null, "SOCIETA'", 'PIP', 'NOTE', 'N. ALBO', 'LINEA', 'RAMO', 'CATEGORIA LINEA', 'NOTE', 'RENDIMENTI MEDI ANNUI (%)', null, null, null, null],
  [null, null, null, null, null, null, null, null, null, 'Ultimo anno', 'Ultimi \r\n3 anni', 'Ultimi \r\n5 anni', 'Ultimi \r\n10 anni', 'Ultimi \r\n20 anni'],
  [null, null, null, null, null, null, null, null, null, 2025, '2023-2025', '2021-2025', '2016-2025', '2006-2025'],
  [null, 'SOCIETA UNO S.P.A.', 'PIANO UNO & CO', null, 1, 'LINEA GAR', 'Ramo I', 'GAR', '(3)', 1.6, 1.5, 1.3, 1.5, null],
  [null, null, null, null, null, 'LINEA BIL', 'Ramo III', 'BIL', null, 4.8, 7.4, 2.4, 2.3, null],
  [null, null, 'PIANO DUE', null, 2, 'LINEA AZN', 'Ramo III', 'AZN', null, 8.9, 10.9, 5.8, 4.6, null],
  [null, null, null, null, null, 'LINEA OBB MISTO', 'Ramo III', 'OBB MISTO', null, 0.7],
  [],
  [null, '(1) Fondo chiuso a nuove adesioni'],
];
const covipIsc: Riga[] = [
  ['N. Albo', 'Società', 'Fondo', 'Comparto', 'Note', 'Categ. comparto', 'ISC a 2 anni', 'ISC a 5 anni', 'ISC a 10 anni', 'ISC a 35 anni'],
  [1, 'SOCIETA UNO ASSICURAZIONI S.P.A.', 'PIANO UNO &amp; CO', 'LINEA GAR', '(1)', 'GAR', '1,94', '1,37', '1,25', '1,21'],
  [1, 'SOCIETA UNO ASSICURAZIONI S.P.A.', 'PIANO UNO &amp; CO', 'LINEA BIL', null, 'BIL', '2,57', '2,00', '1,88', '1,84'],
  [2, 'SOCIETA DUE S.P.A.', 'PIANO DUE', 'LINEA AZN', null, 'AZN', '4,71', '3,03', '2,44', '2,01'],
  [2, 'SOCIETA DUE S.P.A.', 'PIANO DUE', 'LINEA OBB MISTO', null, 'OBB', '3,00', '2,00', '1,50', '1,20'],
];

describe('struttura dei file COVIP', () => {
  it('rendimenti: titoli su 3 righe, periodi, società ripetuta, note ignorate', () => {
    const a = analizza(covipRend, 'rend');
    expect(a.riconosciuto).toBe(true);
    expect(a.ab).toMatchObject({ societa: 1, fondo: 2, comparto: 5, categoria: 7, y1: 9, y3: 10, y5: 11, y10: 12, y20: 13 });
    expect(a.periodi).toEqual({ 1: '2025', 3: '2023-2025', 5: '2021-2025', 10: '2016-2025', 20: '2006-2025' });
    const r = costruisci(covipRend, a.ultimaIntest, a.ab, 'rend', 'PIP');
    expect(r.comparti).toHaveLength(4);
    expect(r.comparti[1]).toMatchObject({ societa: 'SOCIETA UNO S.P.A.', fondo: 'PIANO UNO & CO', comparto: 'LINEA BIL', categoria: 'BIL' });
    expect(r.comparti[2]).toMatchObject({ fondo: 'PIANO DUE', societa: 'SOCIETA UNO S.P.A.' });
    expect(r.comparti[0].rend).toMatchObject({ 1: 1.6, 3: 1.5, 20: null });
  });
  it('costi: codici di categoria, virgole, &amp;; unione con i rendimenti anche se la società è scritta diversamente', () => {
    const a = analizza(covipIsc, 'isc');
    expect(a.riconosciuto).toBe(true);
    expect(a.ab).toMatchObject({ societa: 1, fondo: 2, comparto: 3, categoria: 5, y2: 6, y5: 7, y10: 8, y35: 9 });
    const isc = costruisci(covipIsc, a.ultimaIntest, a.ab, 'isc', 'PIP').comparti;
    expect(isc[0]).toMatchObject({ fondo: 'PIANO UNO & CO', categoria: 'GAR', isc: { 2: 1.94, 35: 1.21 } });
    expect(isc[3].categoria).toBe('OBB');
    const ra = analizza(covipRend, 'rend');
    const u = unisci(isc, costruisci(covipRend, ra.ultimaIntest, ra.ab, 'rend', 'PIP').comparti, 'rend');
    expect(u).toHaveLength(4);
    const obb = u.find((c) => c.comparto === 'LINEA OBB MISTO')!;
    expect(obb.categoria).toBe('OBB MISTO'); // la categoria precisa dei rendimenti non viene sostituita da "OBB"
    expect(obb.isc[2]).toBe(3);
    expect(obb.rend[1]).toBe(0.7);
  });
});


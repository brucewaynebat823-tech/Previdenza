import { describe, it, expect } from 'vitest';
import { rilevaIntestazione, suggerisci, numeroCella, categoriaDaTesto, costruisci, unisci, rimuoviSlot, type Riga } from './importa';

// Tabella SINTETICA usata solo per testare la logica (non sono dati COVIP).
const tab: Riga[] = [
  ['Titolo del foglio'],
  [],
  ['Società', 'Forma pensionistica', 'Comparto', 'Categoria', 'ISC 2 anni', 'ISC 5 anni', 'ISC 10 anni', 'ISC 35 anni'],
  ['Alfa', 'Piano A', 'Linea Garantita', 'Garantito', '1,5', 2.5, 'n.d.', ''],
  ['Beta', 'Piano B', 'Linea Dinamica', 'Azionario', 3, 2, 1.5, '1.250,5'],
  [null, null, null],
];

describe('import', () => {
  it('rileva la riga di intestazione e suggerisce le colonne', () => {
    const h = rilevaIntestazione(tab);
    expect(h).toBe(2);
    expect(suggerisci(tab[h], 'isc')).toEqual({ societa: 0, fondo: 1, comparto: 2, categoria: 3, y2: 4, y5: 5, y10: 6, y35: 7 });
  });
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
    const ab = suggerisci(tab[2], 'isc');
    const r = costruisci(tab, 2, ab, 'isc', 'PIP');
    expect(r.comparti).toHaveLength(2);
    expect(r.comparti[0]).toMatchObject({ societa: 'Alfa', comparto: 'Linea Garantita', categoria: 'GAR', forma: 'PIP', isc: { 2: 1.5, 5: 2.5, 10: null, 35: null } });
  });
  it('unisce file ISC e rendimenti sullo stesso comparto', () => {
    const isc = costruisci(tab, 2, suggerisci(tab[2], 'isc'), 'isc', 'PIP').comparti;
    const rt: Riga[] = [['Società', 'Forma pensionistica', 'Comparto', 'Rendimento 3 anni', 'Rendimento 5 anni'], ['Alfa', 'Piano A', 'Linea Garantita', '1,1', '2,2']];
    const rend = costruisci(rt, 0, suggerisci(rt[0], 'rend'), 'rend', 'PIP').comparti;
    const u = unisci(isc, rend, 'rend');
    expect(u).toHaveLength(2);
    expect(u.find((c) => c.societa === 'Alfa')).toMatchObject({ isc: { 2: 1.5 }, rend: { 3: 1.1, 5: 2.2 }, categoria: 'GAR' });
  });
  it('rimuoviSlot toglie solo il tipo richiesto e solo per la forma indicata', () => {
    const isc = costruisci(tab, 2, suggerisci(tab[2], 'isc'), 'isc', 'PIP').comparti;
    const rt: Riga[] = [['Società', 'Forma pensionistica', 'Comparto', 'Rendimento 3 anni'], ['Alfa', 'Piano A', 'Linea Garantita', '1,1']];
    const u = unisci(isc, costruisci(rt, 0, suggerisci(rt[0], 'rend'), 'rend', 'PIP').comparti, 'rend');
    const senzaIsc = rimuoviSlot(u, 'PIP', 'isc');
    expect(senzaIsc).toHaveLength(1);
    expect(senzaIsc[0].rend[3]).toBe(1.1);
    expect(senzaIsc[0].isc).toEqual({});
    expect(rimuoviSlot(u, 'FPN', 'isc')).toHaveLength(2);
    expect(rimuoviSlot(rimuoviSlot(u, 'PIP', 'isc'), 'PIP', 'rend')).toHaveLength(0);
  });
});

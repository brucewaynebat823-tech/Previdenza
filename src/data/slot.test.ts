import { describe, it, expect } from 'vitest';
import { costruisciDataset } from './slot';
import type { Comparto, FileCaricato } from './tipi';

const c = (comparto: string, isc: Comparto['isc'], rend: Comparto['rend']): Comparto => ({
  id: `pip|piano|${comparto.toLowerCase()}`, forma: 'PIP', societa: 'S', fondo: 'Piano', comparto, categoria: 'BIL', isc, rend,
});
const file = (tipo: 'isc' | 'rend', comparti: Comparto[], origine: 'incorporato' | 'utente'): FileCaricato => ({
  comparti,
  meta: { forma: 'PIP', tipo, nomeFile: 'x.xlsx', aggiornatoAl: '2025-12-31', comparti: comparti.length, caricatoIl: '2026-01-01', origine },
});

describe('costruisciDataset', () => {
  it('unisce costi e rendimenti sullo stesso comparto', () => {
    const d = costruisciDataset({
      'PIP:isc': file('isc', [c('A', { 2: 1.5 }, {})], 'incorporato'),
      'PIP:rend': file('rend', [c('A', {}, { 3: 2.5 })], 'incorporato'),
    });
    expect(d.comparti).toHaveLength(1);
    expect(d.comparti[0]).toMatchObject({ comparto: 'A', isc: { 2: 1.5 }, rend: { 3: 2.5 } });
    expect(Object.keys(d.file).sort()).toEqual(['PIP:isc', 'PIP:rend']);
  });
  it('un file dell’utente sostituisce quello incorporato per la stessa forma e tipo', () => {
    const incorporati = { 'PIP:isc': file('isc', [c('A', { 2: 1.5 }, {})], 'incorporato') };
    const utente = { 'PIP:isc': file('isc', [c('A', { 2: 9.9 }, {})], 'utente') };
    const d = costruisciDataset({ ...incorporati, ...utente });
    expect(d.comparti[0].isc[2]).toBe(9.9);
    expect(d.file['PIP:isc'].origine).toBe('utente');
  });
  it('senza file il dataset è vuoto', () => {
    expect(costruisciDataset({}).comparti).toEqual([]);
  });
});

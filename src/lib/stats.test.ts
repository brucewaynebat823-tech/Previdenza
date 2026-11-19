import { describe, it, expect } from 'vitest';
import { corrisponde, filtra, ordina, media, medieperCategoria, scostoDallaMedia, valore, isAlleata, lineaAlleata } from './stats';
import type { Comparto } from '../data/tipi';

const mk = (id: string, categoria: Comparto['categoria'], isc2: number | null, r5: number | null, extra: Partial<Comparto> = {}): Comparto => ({
  id, forma: 'PIP', societa: 'S' + id, fondo: 'F', comparto: 'C' + id, categoria, isc: { 2: isc2 }, rend: { 5: r5 }, ...extra,
});
const L = [mk('1', 'AZN', 2, 5), mk('2', 'AZN', 4, null), mk('3', 'GAR', 1, 1), mk('4', 'GAR', null, 2)];

describe('stats', () => {
  it('media semplice ignora i valori mancanti', () => {
    expect(media(L.filter((c) => c.categoria === 'AZN'), { tipo: 'isc', anni: 2 })).toEqual({ media: 3, n: 2 });
    expect(media(L.filter((c) => c.categoria === 'GAR'), { tipo: 'isc', anni: 2 })).toEqual({ media: 1, n: 1 });
    expect(media([], { tipo: 'isc', anni: 2 })).toEqual({ media: null, n: 0 });
  });
  it('ordina con i mancanti sempre in fondo, in entrambi i versi', () => {
    const m = { tipo: 'isc', anni: 2 } as const;
    expect(ordina(L, m, 'asc').map((c) => c.id)).toEqual(['3', '1', '2', '4']);
    expect(ordina(L, m, 'desc').map((c) => c.id)).toEqual(['2', '1', '3', '4']);
  });
  it('filtra per categoria, forma, società e testo', () => {
    expect(filtra(L, { categoria: 'GAR' }).map((c) => c.id)).toEqual(['3', '4']);
    expect(filtra(L, { societa: 'S2' }).map((c) => c.id)).toEqual(['2']);
    expect(filtra(L, { forme: ['FPN'] })).toEqual([]);
    expect(filtra(L, { testo: 'c3' }).map((c) => c.id)).toEqual(['3']);
  });
  it('medie per categoria e scostamento dalla media', () => {
    const r = medieperCategoria(L, { tipo: 'isc', anni: 2 });
    expect(r.find((x) => x.categoria === 'AZN')?.media).toBe(3);
    expect(scostoDallaMedia(L[0], L, { tipo: 'isc', anni: 2 })).toBe(-1);
    expect(scostoDallaMedia(L[3], L, { tipo: 'isc', anni: 2 })).toBeNull();
  });
  it('valore restituisce null se mancante', () => {
    expect(valore(L[1], { tipo: 'rend', anni: 5 })).toBeNull();
  });
  it('riconosce le linee Alleata', () => {
    const a = mk('9', 'GAR', 1, 1, { fondo: 'Alleata Previdenza', comparto: 'Garantita' });
    expect(isAlleata(a)).toBe(true);
    expect(lineaAlleata(a)).toBe('g');
    expect(isAlleata(L[0])).toBe(false);
  });
  it('la ricerca per parole non richiede parole contigue né un ordine', () => {
    const c = mk('7', 'AZN', 1, 1, { societa: 'ALLEANZA SPA', fondo: 'ALMEGLIO FONDO PENSIONE APERTO', comparto: 'AZIONARIO' });
    expect(corrisponde(c, 'almeglio azionario')).toBe(true);
    expect(corrisponde(c, 'azionario alleanza')).toBe(true);
    expect(corrisponde(c, 'almeglio bilanciato')).toBe(false);
    expect(corrisponde(c, '  ')).toBe(true);
    const o = mk('8', 'OBB PURO', 1, 1, { comparto: 'OBBLIGAZIONARIO' });
    expect(corrisponde(o, 'azionario')).toBe(false);
    expect(corrisponde(o, 'obbligaz')).toBe(true);
    expect(corrisponde(mk('9', 'GAR', 1, 1, { comparto: "STABILITA'" }), "stabilita'")).toBe(true);
  });
});

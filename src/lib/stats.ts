import type { Comparto, Categoria, FormaTipo } from '../data/tipi';

export type Metrica = { tipo: 'isc'; anni: 2 | 5 | 10 | 35 } | { tipo: 'rend'; anni: 1 | 3 | 5 | 10 | 20 };

export function valore(c: Comparto, m: Metrica): number | null {
  const v = m.tipo === 'isc' ? c.isc[m.anni as 2 | 5 | 10 | 35] : c.rend[m.anni as 1 | 3 | 5 | 10 | 20];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export interface Filtri {
  forme?: FormaTipo[];
  societa?: string;
  categoria?: Categoria | '';
  testo?: string;
}

/** Chi gestisce il comparto: la società, oppure il nome del fondo quando il file non ha la società (es. fondi negoziali). */
export const gestore = (c: Comparto) => c.societa || c.fondo;

/** Ricerca per parole: ogni parola scritta deve comparire, all'inizio di una parola e in qualsiasi ordine, in società, fondo o comparto (così "azionario" non trova "obbligazionario"). */
export function corrisponde(c: Comparto, testo: string): boolean {
  const parole = testo.toLowerCase().replace(/[^\p{L}\p{N}%+]+/gu, ' ').split(' ').filter(Boolean);
  if (!parole.length) return true;
  const pagliaio = ` ${c.societa} ${c.fondo} ${c.comparto}`.toLowerCase().replace(/[^\p{L}\p{N}%+]+/gu, ' ');
  return parole.every((w) => pagliaio.includes(` ${w}`));
}

export function filtra(lista: Comparto[], f: Filtri): Comparto[] {
  const t = f.testo?.trim().toLowerCase();
  return lista.filter(
    (c) =>
      (!f.forme?.length || f.forme.includes(c.forma)) &&
      (!f.societa || gestore(c) === f.societa) &&
      (!f.categoria || c.categoria === f.categoria) &&
      (!t || corrisponde(c, t)),
  );
}

/** Ordina per metrica; i valori mancanti vanno sempre in fondo. */
export function ordina(lista: Comparto[], m: Metrica, verso: 'asc' | 'desc'): Comparto[] {
  const k = verso === 'asc' ? 1 : -1;
  return [...lista].sort((a, b) => {
    const va = valore(a, m);
    const vb = valore(b, m);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * k;
  });
}

/** Media semplice (non ponderata) dei soli valori disponibili; null se non ce n'è nessuno. */
export function media(lista: Comparto[], m: Metrica): { media: number | null; n: number } {
  const v = lista.map((c) => valore(c, m)).filter((x): x is number => x !== null);
  return { media: v.length ? v.reduce((s, x) => s + x, 0) / v.length : null, n: v.length };
}

export function medieperCategoria(lista: Comparto[], m: Metrica) {
  const cat = new Map<string, Comparto[]>();
  for (const c of lista) {
    const k = c.categoria ?? 'N.D.';
    cat.set(k, [...(cat.get(k) ?? []), c]);
  }
  return [...cat.entries()].map(([categoria, l]) => ({ categoria, ...media(l, m) }));
}

/** Differenza tra un comparto e la media della sua categoria (stessa metrica); null se non calcolabile. */
export function scostoDallaMedia(c: Comparto, lista: Comparto[], m: Metrica): number | null {
  const v = valore(c, m);
  if (v === null || !c.categoria) return null;
  const { media: mm } = media(lista.filter((x) => x.categoria === c.categoria), m);
  return mm === null ? null : v - mm;
}

/** Riconoscimento dei comparti Alleata Previdenza per nome. ⚠️ DA VERIFICARE sul dato COVIP reale. */
export const isAlleata = (c: Comparto) => /alleata/i.test(`${c.fondo} ${c.comparto}`);
export const lineaAlleata = (c: Comparto): 'g' | 'b' | 'a' | null =>
  !isAlleata(c) ? null : /garantit/i.test(c.comparto) ? 'g' : /bilanciat/i.test(c.comparto) ? 'b' : /azionari/i.test(c.comparto) ? 'a' : null;

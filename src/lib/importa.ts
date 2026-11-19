import type { Categoria, Comparto, FormaTipo, TipoFile } from '../data/tipi';
export type { TipoFile } from '../data/tipi';

/**
 * Importazione di una tabella COVIP (XLSX/CSV) scelta dall'utente.
 * Nessun valore viene dedotto: ogni colonna è abbinata a un campo (suggerimento automatico + conferma dell'utente);
 * le celle vuote o non numeriche diventano "dato mancante" (null).
 */
export type Cella = string | number | boolean | Date | null | undefined;
export type Riga = Cella[];

export type Campo = 'societa' | 'fondo' | 'comparto' | 'categoria' | 'y1' | 'y2' | 'y3' | 'y5' | 'y10' | 'y20' | 'y35';
export type Abbinamento = Partial<Record<Campo, number>>;

export const CAMPI_ANAGRAFICA: { campo: Campo; nome: string }[] = [
  { campo: 'societa', nome: 'Società' },
  { campo: 'fondo', nome: 'Fondo / piano' },
  { campo: 'comparto', nome: 'Comparto' },
  { campo: 'categoria', nome: 'Categoria' },
];
export const ANNI_PER_TIPO: Record<TipoFile, number[]> = { isc: [2, 5, 10, 35], rend: [1, 3, 5, 10, 20] };

const norm = (v: Cella) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Riga di intestazione = quella con più celle di testo tra le prime 15. */
export function rilevaIntestazione(righe: Riga[]): number {
  let best = 0;
  let bestN = -1;
  righe.slice(0, 15).forEach((r, i) => {
    const n = r.filter((c) => typeof c === 'string' && c.trim() !== '').length;
    if (n > bestN) {
      best = i;
      bestN = n;
    }
  });
  return best;
}

/** Suggerisce l'abbinamento delle colonne dai titoli. È solo un suggerimento: l'utente lo conferma. */
export function suggerisci(intest: Cella[], tipo: TipoFile): Abbinamento {
  const h = intest.map(norm);
  const ab: Abbinamento = {};
  const trova = (re: RegExp) => h.findIndex((t) => re.test(t));
  const setSe = (c: Campo, i: number) => {
    if (i >= 0 && !Object.values(ab).includes(i)) ab[c] = i;
  };
  setSe('societa', trova(/societ|gestore|compagnia|impresa|ente|istituto/));
  setSe('fondo', trova(/\b(fondo|piano|pip|denominazione forma|forma pensionistica)\b/));
  setSe('comparto', trova(/compart|linea|gestione/));
  setSe('categoria', trova(/categoria|tipologia|tipo comparto|tipo di comparto/));
  for (const a of ANNI_PER_TIPO[tipo]) {
    const re = new RegExp(`(^|[^0-9])${a}\\s*(anni|a\\b|y\\b)`);
    const cand = h.map((t, i) => ({ t, i })).filter(({ t, i }) => re.test(t) && !Object.values(ab).includes(i));
    const pref = cand.find(({ t }) => (tipo === 'isc' ? /isc|costi|indicatore/ : /rend/).test(t)) ?? cand[0];
    if (pref) ab[`y${a}` as Campo] = pref.i;
  }
  return ab;
}

/** Numero da cella: accetta 1,23 / 1.23 / "1,23%". Qualsiasi altra cosa (n.d., -, testo) → null. */
export function numeroCella(c: Cella): number | null {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null;
  if (typeof c !== 'string') return null;
  const t = c.replace('%', '').replace(/\s/g, '');
  if (!/^-?\d+([.,]\d+)?$|^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(t)) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}

export function categoriaDaTesto(t: string): Categoria | null {
  const s = t.toLowerCase();
  if (/garant/.test(s)) return 'GAR';
  if (/obbligazionario\s*puro|obb\.?\s*puro|monetari/.test(s)) return 'OBB PURO';
  if (/obbligazionario\s*misto|obb\.?\s*misto/.test(s)) return 'OBB MISTO';
  if (/bilanc/.test(s)) return 'BIL';
  if (/azion/.test(s)) return 'AZN';
  return null;
}

export const chiave = (forma: FormaTipo, c: Pick<Comparto, 'societa' | 'fondo' | 'comparto'>) =>
  [forma, c.societa, c.fondo, c.comparto].map((x) => norm(x)).join('|');

export interface RisultatoImport {
  comparti: Comparto[];
  scartate: number;
}

export function costruisci(righe: Riga[], rigaIntest: number, ab: Abbinamento, tipo: TipoFile, forma: FormaTipo): RisultatoImport {
  const testo = (r: Riga, c?: number) => (c === undefined ? '' : String(r[c] ?? '').trim());
  const out: Comparto[] = [];
  let scartate = 0;
  for (const r of righe.slice(rigaIntest + 1)) {
    const comparto = testo(r, ab.comparto);
    const fondo = testo(r, ab.fondo);
    const societa = testo(r, ab.societa);
    if (!comparto && !fondo) {
      if (r.some((c) => c !== null && c !== undefined && c !== '')) scartate++;
      continue;
    }
    const valori: Record<number, number | null> = {};
    for (const a of ANNI_PER_TIPO[tipo]) {
      const col = ab[`y${a}` as Campo];
      valori[a] = col === undefined ? null : numeroCella(r[col]);
    }
    const base: Comparto = {
      id: '',
      forma,
      societa,
      fondo: fondo || societa,
      comparto: comparto || fondo,
      categoria: categoriaDaTesto(testo(r, ab.categoria)),
      isc: {},
      rend: {},
    };
    for (const a of ANNI_PER_TIPO[tipo]) (tipo === 'isc' ? (base.isc as Record<number, number | null>) : (base.rend as Record<number, number | null>))[a] = valori[a];
    base.id = chiave(forma, base);
    out.push(base);
  }
  return { comparti: out, scartate };
}

/**
 * Unisce i nuovi comparti a quelli già presenti (stessa forma, società, fondo, comparto):
 * i campi del tipo importato vengono sostituiti, gli altri restano.
 */
export function unisci(esistenti: Comparto[], nuovi: Comparto[], tipo: TipoFile): Comparto[] {
  const mappa = new Map(esistenti.map((c) => [c.id, c]));
  for (const n of nuovi) {
    const e = mappa.get(n.id);
    if (!e) mappa.set(n.id, n);
    else
      mappa.set(n.id, {
        ...e,
        categoria: n.categoria ?? e.categoria,
        ...(tipo === 'isc' ? { isc: n.isc } : { rend: n.rend }),
      });
  }
  return [...mappa.values()];
}

/** Toglie da una forma i dati di un tipo (costi o rendimenti); i comparti rimasti senza alcun dato vengono eliminati. */
export function rimuoviSlot(comparti: Comparto[], forma: FormaTipo, tipo: TipoFile): Comparto[] {
  return comparti
    .map((c) => (c.forma !== forma ? c : { ...c, ...(tipo === 'isc' ? { isc: {} } : { rend: {} }) }))
    .filter((c) => c.forma !== forma || Object.keys(c.isc).length > 0 || Object.keys(c.rend).length > 0);
}

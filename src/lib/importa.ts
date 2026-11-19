import type { Categoria, Comparto, FormaTipo, TipoFile } from '../data/tipi';
export type { TipoFile } from '../data/tipi';

/**
 * Importazione di una tabella COVIP (XLSX/CSV) scelta dall'utente.
 * Nessun valore viene dedotto: le colonne sono abbinate ai campi (suggerimento automatico + conferma dell'utente);
 * le celle vuote o non numeriche diventano "dato mancante" (null).
 */
export type Cella = string | number | boolean | Date | null | undefined;
export type Riga = Cella[];

export type Campo = 'societa' | 'fondo' | 'comparto' | 'categoria' | 'variante' | 'anni' | 'valore' | 'y1' | 'y2' | 'y3' | 'y5' | 'y10' | 'y20' | 'y35';
export type Abbinamento = Partial<Record<Campo, number>>;

export const CAMPI_ANAGRAFICA: { campo: Campo; nome: string }[] = [
  { campo: 'societa', nome: 'Società' },
  { campo: 'fondo', nome: 'Fondo / piano' },
  { campo: 'comparto', nome: 'Comparto' },
  { campo: 'categoria', nome: 'Categoria (tipologia)' },
  { campo: 'variante', nome: 'Platea (se presente)' },
];
export const ANNI_PER_TIPO: Record<TipoFile, number[]> = { isc: [2, 5, 10, 35], rend: [1, 3, 5, 10, 20] };

const ENTITA: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>' };
/** Testo di una cella: spazi normalizzati e caratteri HTML decodificati (alcuni file COVIP hanno "&amp;"). */
const testoCella = (v: Cella) => String(v ?? '').replace(/&(amp|quot|#39|apos|lt|gt);/g, (m) => ENTITA[m]).replace(/\s+/g, ' ').trim();
const norm = (v: Cella) => testoCella(v).toLowerCase().replace(/[_./\-–]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Numero da cella: accetta 1,23 / 1.23 / "1,23%". Qualsiasi altra cosa (n.d., -, testo) → null. */
export function numeroCella(c: Cella): number | null {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null;
  if (typeof c !== 'string') return null;
  const t = c.replace('%', '').replace(/\s/g, '');
  if (!/^-?\d+([.,]\d+)?$|^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(t)) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}

/** Riga di intestazione = quella con più celle di testo tra le prime 15 (usata come primo tentativo). */
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

/** Titoli di colonna: una o più righe unite (le celle unite in alto vengono ripetute a destra). */
export function titoliColonne(righe: Riga[], da: number, a: number): string[] {
  const largh = Math.max(0, ...righe.slice(da, a + 1).map((r) => r.length));
  const out: string[] = Array(largh).fill('');
  for (let r = da; r <= a; r++) {
    let ultimo = '';
    for (let j = 0; j < largh; j++) {
      const t = testoCella(righe[r]?.[j]);
      if (t) ultimo = t;
      const eff = r < a ? (t || ultimo) : t; // riempie solo le righe sopra l'ultima
      if (eff) out[j] = out[j] ? `${out[j]} ${eff}` : eff;
    }
  }
  return out;
}

const reAnno = (a: number) => new RegExp(`(?<![0-9/])${a}(?![0-9/])`);
/** Il titolo indica l'orizzonte di `a` anni? ("3 anni", "ISC_3", "Ultimo anno" = 1). */
const indicaAnni = (a: number, t: string) => reAnno(a).test(t) || (a === 1 && /ultimo anno/.test(t));

/** Abbinamento suggerito dai titoli (e, per formati "lunghi", dai dati). */
export function suggerisci(titoli: string[], tipo: TipoFile, dati: Riga[] = []): Abbinamento {
  const h = titoli.map(norm);
  const ab: Abbinamento = {};
  const usata = (i: number) => Object.values(ab).includes(i);
  const trova = (re: RegExp) => h.findIndex((t, i) => re.test(t) && !usata(i));
  const set = (c: Campo, i: number) => {
    if (i >= 0) ab[c] = i;
  };
  set('societa', trova(/societ|gestore|compagnia|impresa|ente|ragione sociale|istituto|banca|\bsgr\b|\bsim\b/));
  {
    const re = /^(?!.*(categ|\bcod\b)).*(compart|linea|profilo|gestione)/;
    const campione = dati.slice(0, 200);
    const cand = h.map((t, i) => ({ t, i })).filter(({ t, i }) => re.test(t) && !usata(i));
    // Se più colonne si chiamano "comparto", vale quella che contiene testo (non codici numerici).
    const testuale = cand.find(({ i }) => {
      const v = campione.map((r) => r[i]).filter((x) => testoCella(x) !== '');
      return v.length >= 3 && v.filter((x) => numeroCella(x) === null).length / v.length >= 0.8;
    });
    set('comparto', (testuale ?? cand[0])?.i ?? -1);
  }
  set('fondo', trova(/\b(fondo|piano|pip)\b|denominazione|forma pensionistica|\bnome\b/));
  set('categoria', trova(/categ|tipologia|tipo comparto|tipo di comparto|classe|politica/));
  set('variante', trova(/platea/));

  const parola = tipo === 'isc' ? /isc|cost|indicatore/ : /rend/;
  const opposta = tipo === 'isc' ? /rend/ : /isc|cost|indicatore/;
  for (const a of ANNI_PER_TIPO[tipo]) {
    const cand = h.map((t, i) => ({ t, i })).filter(({ t, i }) => !usata(i) && indicaAnni(a, t) && !opposta.test(t));
    const pref = cand.find(({ t }) => parola.test(t) && /ann|\ba\b|\by\b/.test(t)) ?? cand.find(({ t }) => /ann|\ba\b|\by\b|^\d+$/.test(t)) ?? cand.find(({ t }) => parola.test(t));
    if (pref) ab[`y${a}` as Campo] = pref.i;
  }

  // Formato "lungo": una riga per comparto e per numero di anni.
  if (!ANNI_PER_TIPO[tipo].some((a) => ab[`y${a}` as Campo] !== undefined) && dati.length) {
    const anniOk = new Set(ANNI_PER_TIPO[tipo]);
    const campione = dati.slice(0, 200);
    const colAnni = h.findIndex((t, i) => {
      if (usata(i) || !/ann|perman|orizz|durat|period/.test(t)) return false;
      const v = campione.map((r) => numeroCella(r[i])).filter((x) => x !== null);
      return v.length >= 3 && v.filter((x) => anniOk.has(x as number)).length / v.length >= 0.8;
    });
    if (colAnni >= 0) {
      ab.anni = colAnni;
      const colVal = h.findIndex((t, i) => i !== colAnni && !usata(i) && parola.test(t) && campione.some((r) => numeroCella(r[i]) !== null));
      if (colVal >= 0) ab.valore = colVal;
    }
  }
  return ab;
}

export interface Analisi {
  /** Righe di intestazione (da…a, indici da 0); i dati iniziano dopo l'ultima. */
  primaIntest: number;
  ultimaIntest: number;
  titoli: string[];
  ab: Abbinamento;
  punteggio: number;
  /** Colonne dei valori e dell'anagrafica riconosciute con sicurezza. */
  riconosciuto: boolean;
  /** Periodo di riferimento letto dai titoli per ogni orizzonte (es. 3 → "2023-2025"). */
  periodi: Record<number, string>;
  /** Abbinamento ricavato a posizione (non dai titoli): va confermato dall'utente. */
  incerto: boolean;
}

function punteggio(ab: Abbinamento, tipo: TipoFile): number {
  const anagr = ab.comparto !== undefined || ab.fondo !== undefined ? 3 : 0;
  const lungo = ab.anni !== undefined && ab.valore !== undefined ? 4 : 0;
  const anni = ANNI_PER_TIPO[tipo].filter((a) => ab[`y${a}` as Campo] !== undefined).length * 2;
  return anagr + (ab.societa !== undefined ? 1 : 0) + (ab.categoria !== undefined ? 1 : 0) + anni + lungo;
}

/** Prova diverse righe di intestazione (anche su due righe) e sceglie l'abbinamento migliore. */
export function analizza(righe: Riga[], tipo: TipoFile): Analisi {
  let best: Analisi | null = null;
  const max = Math.min(15, righe.length - 1);
  for (let h = 0; h <= max; h++) {
    for (const [da, a] of [[h, h], [h - 1, h], [h, h + 1], [h - 2, h]] as const) {
      if (da < 0 || a >= righe.length) continue;
      // Una riga di titoli è fatta soprattutto di testo: scarta le righe di dati.
      const soloTesto = righe.slice(da, a + 1).every((r) => {
        const v = r.filter((c) => testoCella(c) !== '');
        return v.length > 0 && v.filter((c) => numeroCella(c) === null).length / v.length >= 0.6;
      });
      if (!soloTesto) continue;
      const titoli = titoliColonne(righe, da, a);
      const ab = suggerisci(titoli, tipo, righe.slice(a + 1));
      const p = punteggio(ab, tipo);
      if (!best || p > best.punteggio) best = { primaIntest: da, ultimaIntest: a, titoli, ab, punteggio: p, riconosciuto: false, incerto: false, periodi: {} };
    }
  }
  const periodoLike = (riga?: Riga) => (riga ?? []).filter((c) => /^\d{4}\s*[-–]\s*\d{4}$/.test(testoCella(c))).length;
  const r = best ?? { primaIntest: 0, ultimaIntest: 0, titoli: [], ab: {}, punteggio: 0, riconosciuto: false, incerto: false, periodi: {} };
  // Le righe con i periodi (es. 2023-2025) sotto i titoli sono ancora intestazione.
  while (r.ultimaIntest + 1 < righe.length && periodoLike(righe[r.ultimaIntest + 1]) >= 2) r.ultimaIntest++;
  const dati = righe.slice(r.ultimaIntest + 1, r.ultimaIntest + 200);
  // Comparto non trovato dai titoli: prima colonna di testo (da confermare).
  if (r.ab.comparto === undefined && r.ab.fondo === undefined) {
    const usate = Object.values(r.ab);
    const col = r.titoli.findIndex((_, j) => {
      if (usate.includes(j)) return false;
      const v = dati.map((x) => x[j]).filter((x) => testoCella(x) !== '');
      return v.length >= 3 && v.filter((x) => numeroCella(x) === null).length / v.length >= 0.8;
    });
    if (col >= 0) {
      r.ab.comparto = col;
      r.incerto = true;
    }
  }
  // Valori non trovati dai titoli: colonne numeriche a destra, nell'ordine degli anni (da confermare).
  const haValori = ANNI_PER_TIPO[tipo].some((a) => r.ab[`y${a}` as Campo] !== undefined) || (r.ab.anni !== undefined && r.ab.valore !== undefined);
  if (!haValori && dati.length) {
    const usate = Object.values(r.ab);
    const numeriche = r.titoli.map((_, j) => j).filter((j) => {
      if (usate.includes(j)) return false;
      const v = dati.map((x) => x[j]).filter((x) => testoCella(x) !== '');
      return v.length >= 3 && v.filter((x) => numeroCella(x) !== null).length / v.length >= 0.6;
    });
    ANNI_PER_TIPO[tipo].slice(0, numeriche.length).forEach((a, k) => {
      r.ab[`y${a}` as Campo] = numeriche[k];
    });
    if (numeriche.length) r.incerto = true;
  }
  // Periodo di riferimento scritto sotto i titoli dei rendimenti (es. 2025, 2023-2025).
  if (tipo === 'rend') {
    for (const an of ANNI_PER_TIPO.rend) {
      const col = r.ab[`y${an}` as Campo];
      if (col === undefined) continue;
      const compCol = r.ab.comparto ?? r.ab.fondo;
      for (let i = r.primaIntest; i <= Math.min(r.ultimaIntest + 3, righe.length - 1); i++) {
        if (i > r.ultimaIntest && compCol !== undefined && testoCella(righe[i]?.[compCol]) !== '') break; // già nei dati
        const t = testoCella(righe[i]?.[col]).replace(/\s/g, '');
        if (/^\d{4}([-–]\d{4})?$/.test(t)) r.periodi[an] = t.replace('–', '-');
      }
    }
  }
  const valoriOk = ANNI_PER_TIPO[tipo].some((a) => r.ab[`y${a}` as Campo] !== undefined) || (r.ab.anni !== undefined && r.ab.valore !== undefined);
  r.riconosciuto = (r.ab.comparto !== undefined || r.ab.fondo !== undefined) && valoriOk && !r.incerto;
  return r;
}

export function categoriaDaTesto(t: string): Categoria | null {
  const s = t.toLowerCase();
  if (/garant|^gar\b/.test(s)) return 'GAR';
  if (/obbligazionario\s*puro|obb\.?\s*puro|monetari/.test(s)) return 'OBB PURO';
  if (/obbligazionario\s*misto|obb\.?\s*misto/.test(s)) return 'OBB MISTO';
  if (/^obb\b|^obbligazionario$/.test(s)) return 'OBB';
  if (/bilanc|^bil\b/.test(s)) return 'BIL';
  if (/azion|^azn\b/.test(s)) return 'AZN';
  return null;
}

/** Identifica un comparto fra file diversi. Non usa la società: COVIP la scrive in modo diverso nei file dei costi e dei rendimenti. */
export const chiave = (forma: FormaTipo, c: Pick<Comparto, 'fondo' | 'comparto'>) => [forma, c.fondo, c.comparto].map((x) => norm(x)).join('|');

export interface RisultatoImport {
  comparti: Comparto[];
  scartate: number;
}
export interface OpzioniImport {
  /** Se i valori nel file sono frazioni (0,012 = 1,2%): moltiplica per 100. */
  moltiplica100?: boolean;
}

export function costruisci(righe: Riga[], ultimaIntest: number, ab: Abbinamento, tipo: TipoFile, forma: FormaTipo, opz: OpzioniImport = {}): RisultatoImport {
  const testo = (r: Riga, c?: number) => (c === undefined ? '' : testoCella(r[c]));
  const k = opz.moltiplica100 ? 100 : 1;
  const val = (c: Cella) => {
    const n = numeroCella(c);
    return n === null ? null : Math.round(n * k * 1e6) / 1e6;
  };
  const mappa = new Map<string, Comparto>();
  let scartate = 0;
  // Se lo stesso comparto compare più volte con platee diverse (es. lavoratori dipendenti / autonomi), si tengono separati.
  const ripetizioni = new Map<string, number>();
  if (ab.variante !== undefined) {
    let f = '';
    for (const r of righe.slice(ultimaIntest + 1)) {
      if (testo(r, ab.fondo)) f = testo(r, ab.fondo);
      const cmp = testo(r, ab.comparto);
      if (cmp) ripetizioni.set(`${f}|${cmp}`, (ripetizioni.get(`${f}|${cmp}`) ?? 0) + 1);
    }
  }
  // Società e piano scritti solo sulla prima riga di un gruppo (celle unite): si ripetono finché non cambiano.
  let ultimaSocieta = '';
  let ultimoFondo = '';
  for (const r of righe.slice(ultimaIntest + 1)) {
    const comparto0 = testo(r, ab.comparto);
    const fondo0 = testo(r, ab.fondo);
    const societa0 = testo(r, ab.societa);
    if (societa0) ultimaSocieta = societa0;
    if (fondo0) ultimoFondo = fondo0;
    const haDati = comparto0 !== '' || (ab.comparto === undefined && fondo0 !== '');
    if (!haDati) {
      if (r.some((c) => c !== null && c !== undefined && c !== '')) scartate++;
      continue;
    }
    const fondo = fondo0 || ultimoFondo;
    const societa = societa0 || ultimaSocieta;
    const variante = testo(r, ab.variante);
    const separa = variante !== '' && (ripetizioni.get(`${fondo}|${comparto0}`) ?? 0) > 1;
    const nome = comparto0 || fondo;
    const base: Comparto = { id: '', forma, societa, fondo: fondo || societa, comparto: nome, categoria: categoriaDaTesto(testo(r, ab.categoria)), isc: {}, rend: {} };
    const idBase = chiave(forma, base);
    const c0: Comparto = separa ? { ...base, comparto: `${nome} (${variante})`, base: idBase } : base;
    c0.id = separa ? chiave(forma, c0) : idBase;
    const c = mappa.get(c0.id) ?? c0;
    const dest = (tipo === 'isc' ? c.isc : c.rend) as Record<number, number | null>;
    if (ab.anni !== undefined && ab.valore !== undefined) {
      const a = numeroCella(r[ab.anni]);
      if (a !== null && ANNI_PER_TIPO[tipo].includes(a)) dest[a] = val(r[ab.valore]);
    } else {
      for (const a of ANNI_PER_TIPO[tipo]) {
        const col = ab[`y${a}` as Campo];
        dest[a] = col === undefined ? null : val(r[col]);
      }
    }
    if (!c.categoria) c.categoria = c0.categoria;
    mappa.set(c.id, c);
  }
  return { comparti: [...mappa.values()], scartate };
}

/**
 * Unisce i nuovi comparti a quelli già presenti (stessa forma, società, fondo, comparto):
 * i campi del tipo importato vengono sostituiti, gli altri restano.
 */
export function unisci(esistenti: Comparto[], nuovi: Comparto[], tipo: TipoFile): Comparto[] {
  const mappa = new Map(esistenti.map((c) => [c.id, c]));
  const perBase = new Map<string, string[]>();
  const registra = (c: Comparto) => perBase.set(c.base ?? c.id, [...(perBase.get(c.base ?? c.id) ?? []), c.id]);
  esistenti.forEach(registra);
  const fondi = (e: Comparto, n: Comparto): Comparto => {
    // Una categoria generica (OBB) non sostituisce una più precisa (OBB PURO / OBB MISTO).
    const categoria = n.categoria === 'OBB' && e.categoria && e.categoria !== 'OBB' ? e.categoria : n.categoria ?? e.categoria;
    return { ...e, categoria, ...(tipo === 'isc' ? { isc: n.isc } : { rend: n.rend }) };
  };
  for (const n of nuovi) {
    // Un comparto senza platea (es. rendimenti) vale per tutte le sue varianti per platea (es. costi dipendenti / autonomi).
    const bersagli = mappa.has(n.id) ? [n.id] : !n.base ? perBase.get(n.id) ?? [] : [];
    if (bersagli.length) for (const id of bersagli) mappa.set(id, fondi(mappa.get(id)!, n));
    else {
      mappa.set(n.id, n);
      registra(n);
    }
  }
  return [...mappa.values()];
}

/** Toglie da una forma i dati di un tipo (costi o rendimenti); i comparti rimasti senza alcun dato vengono eliminati. */
export function rimuoviSlot(comparti: Comparto[], forma: FormaTipo, tipo: TipoFile): Comparto[] {
  return comparti
    .map((c) => (c.forma !== forma ? c : { ...c, ...(tipo === 'isc' ? { isc: {} } : { rend: {} }) }))
    .filter((c) => c.forma !== forma || Object.keys(c.isc).length > 0 || Object.keys(c.rend).length > 0);
}

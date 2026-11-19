/** Modello neutro dei dati COVIP. Il convertitore dei file ufficiali lo riempirà; finché mancano file reali l'elenco è vuoto. */
export type FormaTipo = 'PIP' | 'FPN' | 'FPA' | 'PREESISTENTE';
export type Categoria = 'GAR' | 'OBB PURO' | 'OBB MISTO' | 'BIL' | 'AZN';
export type Anni = 1 | 2 | 3 | 5 | 10 | 20 | 35;

export interface Comparto {
  id: string;
  forma: FormaTipo;
  societa: string;
  fondo: string;
  comparto: string;
  categoria: Categoria | null;
  /** ISC % per anni di permanenza (2, 5, 10, 35). null = non disponibile. */
  isc: Partial<Record<2 | 5 | 10 | 35, number | null>>;
  /** Rendimento medio annuo netto % (1, 3, 5, 10, 20 anni). null = non disponibile. */
  rend: Partial<Record<1 | 3 | 5 | 10 | 20, number | null>>;
}

export interface DatasetCovip {
  /** Data di riferimento dei dati COVIP (YYYY-MM-DD) o null se nessun dato è stato caricato. */
  aggiornatoAl: string | null;
  /** Periodo di riferimento dei rendimenti. */
  periodoRendimenti: { dal: string; al: string } | null;
  fonte: string;
  urlFonte: string;
  comparti: Comparto[];
}

export const DATASET_VUOTO: DatasetCovip = {
  aggiornatoAl: null,
  periodoRendimenti: null,
  fonte: 'COVIP – open data',
  urlFonte: 'https://www.covip.it/open-data',
  comparti: [],
};

/** Modello neutro dei dati COVIP. L'importazione dei file ufficiali lo riempie; finché non ci sono file l'elenco è vuoto. */
export type FormaTipo = 'PIP' | 'FPN' | 'FPA' | 'PREESISTENTE';
export type Categoria = 'GAR' | 'OBB PURO' | 'OBB MISTO' | 'BIL' | 'AZN';
export type Anni = 1 | 2 | 3 | 5 | 10 | 20 | 35;
export type TipoFile = 'isc' | 'rend';

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

/** Un file COVIP caricato: una forma pensionistica × un tipo (costi o rendimenti). */
export interface FileMeta {
  forma: FormaTipo;
  tipo: TipoFile;
  nomeFile: string;
  /** Data di aggiornamento dei dati COVIP indicata dall'utente (YYYY-MM-DD). */
  aggiornatoAl: string;
  /** Solo per i rendimenti: periodo di riferimento. */
  periodo?: { dal: string; al: string };
  comparti: number;
  caricatoIl: string;
}

export interface DatasetCovip {
  fonte: string;
  urlFonte: string;
  comparti: Comparto[];
  /** Chiave: `${forma}:${tipo}`. */
  file: Record<string, FileMeta>;
}

export const chiaveFile = (forma: FormaTipo, tipo: TipoFile) => `${forma}:${tipo}`;

export const DATASET_VUOTO: DatasetCovip = {
  fonte: 'COVIP – open data',
  urlFonte: 'https://www.covip.it/open-data',
  comparti: [],
  file: {},
};

export const NOME_FORMA: Record<FormaTipo, string> = {
  PIP: 'PIP',
  FPN: 'Fondi negoziali',
  FPA: 'Fondi aperti',
  PREESISTENTE: 'Fondi preesistenti',
};
export const FORME_TUTTE: FormaTipo[] = ['PIP', 'FPN', 'FPA', 'PREESISTENTE'];
export const FORME_ALTRE: FormaTipo[] = ['FPN', 'FPA', 'PREESISTENTE'];

/** Preventivi salvati sul dispositivo (mai inviati a server). */
const CHIAVE = 'previdenza.scenari.v1';

export interface ScenarioSalvato {
  id: string;
  nome: string;
  salvatoIl: string;
  /** Dati inseriti nel preventivo, per ricaricarlo. */
  stato: Record<string, unknown>;
  sintesi: {
    eta: number;
    etaPensione: number;
    anni: number;
    premio: number;
    fondo: string;
    rendimentoPct: number;
    capitaleLordo: number;
    capitaleNetto: number;
    rendita: number;
    premiVersati: number;
    risparmioFiscaleTotale: number;
  };
}

export function leggiScenari(): ScenarioSalvato[] {
  try {
    const s = localStorage.getItem(CHIAVE);
    const v = s ? (JSON.parse(s) as ScenarioSalvato[]) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export function scriviScenari(v: ScenarioSalvato[]): boolean {
  try {
    if (!v.length) localStorage.removeItem(CHIAVE);
    else localStorage.setItem(CHIAVE, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}
export function cancellaScenari() {
  scriviScenari([]);
}

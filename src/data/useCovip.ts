import { useCallback, useEffect, useState } from 'react';
import { DATASET_VUOTO, type DatasetCovip } from './tipi';

const CHIAVE = 'previdenza.covip.v1';

export function leggiSalvati(): DatasetCovip | null {
  try {
    const s = localStorage.getItem(CHIAVE);
    return s ? (JSON.parse(s) as DatasetCovip) : null;
  } catch {
    return null;
  }
}
export function salvaDati(d: DatasetCovip): boolean {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}
export function cancellaDati() {
  try {
    localStorage.removeItem(CHIAVE);
  } catch {
    /* niente */
  }
}

/**
 * Dati COVIP: prima quelli importati dall'utente (salvati sul dispositivo),
 * altrimenti quelli pubblicati con l'app (public/data/covip.json). Nessun invio di dati.
 */
export function useCovip() {
  const [dati, setDati] = useState<DatasetCovip>(() => leggiSalvati() ?? DATASET_VUOTO);
  const [stato, setStato] = useState<'caricamento' | 'ok' | 'errore'>('caricamento');
  const [esito, setEsito] = useState('');

  const ricarica = useCallback(async () => {
    setStato('caricamento');
    const salvati = leggiSalvati();
    if (salvati) {
      setDati(salvati);
      setStato('ok');
      setEsito(`Dati importati: ${salvati.comparti.length} comparti.`);
      return;
    }
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}data/covip.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = (await r.json()) as DatasetCovip;
      setDati(d);
      setStato('ok');
      setEsito(d.comparti.length ? `Caricati ${d.comparti.length} comparti.` : 'Nessun dato COVIP ancora caricato: usa “Aggiorna dati”.');
    } catch {
      setStato('errore');
      setEsito('Impossibile leggere i dati: controlla la connessione.');
    }
  }, []);

  useEffect(() => {
    void ricarica();
  }, [ricarica]);

  const sostituisci = useCallback((d: DatasetCovip) => {
    const ok = salvaDati(d);
    setDati(d);
    setStato('ok');
    setEsito(ok ? `Dati importati: ${d.comparti.length} comparti.` : '⚠️ Dati caricati ma non salvabili su questo dispositivo: andranno persi alla chiusura.');
  }, []);

  const azzera = useCallback(() => {
    cancellaDati();
    setDati(DATASET_VUOTO);
    setEsito('Dati COVIP importati cancellati.');
  }, []);

  return { dati, stato, esito, ricarica, sostituisci, azzera };
}

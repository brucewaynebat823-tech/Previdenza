import { useCallback, useEffect, useState } from 'react';
import { DATASET_VUOTO, type DatasetCovip } from './tipi';

/** Carica i dati COVIP convertiti in JSON (pubblicati insieme all'app). Nessun invio di dati. */
export function useCovip() {
  const [dati, setDati] = useState<DatasetCovip>(DATASET_VUOTO);
  const [stato, setStato] = useState<'caricamento' | 'ok' | 'errore'>('caricamento');
  const [esito, setEsito] = useState<string>('');

  const ricarica = useCallback(async () => {
    setStato('caricamento');
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}data/covip.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = (await r.json()) as DatasetCovip;
      setDati(d);
      setStato('ok');
      setEsito(d.comparti.length ? `Caricati ${d.comparti.length} comparti.` : 'Nessun dato COVIP ancora caricato nell’app.');
    } catch {
      setStato('errore');
      setEsito('Impossibile leggere i dati: controlla la connessione.');
    }
  }, []);

  useEffect(() => {
    void ricarica();
  }, [ricarica]);

  return { dati, stato, esito, ricarica };
}

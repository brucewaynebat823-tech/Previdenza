import { useCallback, useEffect, useMemo, useState } from 'react';
import { chiaveFile, type Comparto, type FileMeta, type FormaTipo, type Slots, type TipoFile } from './tipi';
import { costruisciDataset } from './slot';

const CHIAVE = 'previdenza.covip.v3';

function leggi(): Slots {
  try {
    const s = localStorage.getItem(CHIAVE);
    return s ? (JSON.parse(s) as Slots) : {};
  } catch {
    return {};
  }
}
function scrivi(d: Slots): boolean {
  try {
    if (Object.keys(d).length === 0) localStorage.removeItem(CHIAVE);
    else localStorage.setItem(CHIAVE, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

/**
 * Dati COVIP: quelli incorporati nell'app (public/data/covip.json) più quelli caricati dall'utente,
 * che restano salvati sul dispositivo (nessun invio a server) e sostituiscono i corrispondenti file incorporati.
 */
export function useCovip() {
  const [incorporati, setIncorporati] = useState<Slots>({});
  const [utente, setUtente] = useState<Slots>(leggi);
  const [avviso, setAvviso] = useState('');

  useEffect(() => {
    let attivo = true;
    fetch(`${import.meta.env.BASE_URL}data/covip.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { slot?: Slots } | null) => {
        if (attivo && j?.slot) setIncorporati(j.slot);
      })
      .catch(() => undefined);
    return () => {
      attivo = false;
    };
  }, []);

  const dati = useMemo(() => {
    const tutti: Slots = {};
    for (const [k, f] of Object.entries(incorporati)) tutti[k] = { ...f, meta: { ...f.meta, origine: 'incorporato' } };
    for (const [k, f] of Object.entries(utente)) tutti[k] = { ...f, meta: { ...f.meta, origine: 'utente' } };
    return costruisciDataset(tutti);
  }, [incorporati, utente]);

  const applica = useCallback((u: Slots) => {
    setUtente(u);
    setAvviso(scrivi(u) ? '' : '⚠️ Dati caricati ma non salvabili su questo dispositivo: andranno persi alla chiusura.');
  }, []);

  const importa = useCallback(
    (forma: FormaTipo, tipo: TipoFile, nuovi: Comparto[], meta: Omit<FileMeta, 'forma' | 'tipo' | 'comparti' | 'caricatoIl'>) => {
      applica({
        ...utente,
        [chiaveFile(forma, tipo)]: { comparti: nuovi, meta: { ...meta, forma, tipo, comparti: nuovi.length, caricatoIl: new Date().toISOString().slice(0, 10), origine: 'utente' } },
      });
    },
    [utente, applica],
  );

  const rimuovi = useCallback(
    (forma: FormaTipo, tipo: TipoFile) => {
      const u = { ...utente };
      delete u[chiaveFile(forma, tipo)];
      applica(u);
    },
    [utente, applica],
  );

  const azzera = useCallback(() => applica({}), [applica]);

  return { dati, avviso, importa, rimuovi, azzera, haDatiUtente: Object.keys(utente).length > 0 };
}

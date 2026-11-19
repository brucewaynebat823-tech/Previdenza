import { useCallback, useState } from 'react';
import { DATASET_VUOTO, chiaveFile, type DatasetCovip, type FileMeta, type FormaTipo, type TipoFile } from './tipi';
import { rimuoviSlot, unisci } from '../lib/importa';
import type { Comparto } from './tipi';

const CHIAVE = 'previdenza.covip.v2';

function leggi(): DatasetCovip {
  try {
    const s = localStorage.getItem(CHIAVE);
    if (!s) return DATASET_VUOTO;
    const d = JSON.parse(s) as DatasetCovip;
    return { ...DATASET_VUOTO, ...d, file: d.file ?? {}, comparti: d.comparti ?? [] };
  } catch {
    return DATASET_VUOTO;
  }
}
function scrivi(d: DatasetCovip): boolean {
  try {
    if (d.comparti.length === 0 && Object.keys(d.file).length === 0) localStorage.removeItem(CHIAVE);
    else localStorage.setItem(CHIAVE, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

/**
 * Dati COVIP caricati dall'utente: restano salvati sul dispositivo (nessun invio a server)
 * e sono disponibili a ogni apertura dell'app, senza ricaricare i file.
 */
export function useCovip() {
  const [dati, setDati] = useState<DatasetCovip>(leggi);
  const [avviso, setAvviso] = useState('');

  const applica = useCallback((d: DatasetCovip) => {
    setDati(d);
    setAvviso(scrivi(d) ? '' : '⚠️ Dati caricati ma non salvabili su questo dispositivo: andranno persi alla chiusura.');
  }, []);

  const importa = useCallback(
    (forma: FormaTipo, tipo: TipoFile, nuovi: Comparto[], meta: Omit<FileMeta, 'forma' | 'tipo' | 'comparti' | 'caricatoIl'>) => {
      const base = rimuoviSlot(dati.comparti, forma, tipo);
      applica({
        ...dati,
        comparti: unisci(base, nuovi, tipo),
        file: { ...dati.file, [chiaveFile(forma, tipo)]: { ...meta, forma, tipo, comparti: nuovi.length, caricatoIl: new Date().toISOString().slice(0, 10) } },
      });
    },
    [dati, applica],
  );

  const rimuovi = useCallback(
    (forma: FormaTipo, tipo: TipoFile) => {
      const file = { ...dati.file };
      delete file[chiaveFile(forma, tipo)];
      applica({ ...dati, comparti: rimuoviSlot(dati.comparti, forma, tipo), file });
    },
    [dati, applica],
  );

  const azzera = useCallback(() => applica(DATASET_VUOTO), [applica]);

  return { dati, avviso, importa, rimuovi, azzera };
}

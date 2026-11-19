import { DATASET_VUOTO, type DatasetCovip, type Slots } from './tipi';
import { unisci } from '../lib/importa';

/** Unisce i file caricati (costi e rendimenti di ogni forma) in un unico elenco di comparti. */
export function costruisciDataset(slots: Slots): DatasetCovip {
  const ordine = Object.keys(slots).sort((a, b) => (a.endsWith(':isc') === b.endsWith(':isc') ? a.localeCompare(b) : a.endsWith(':isc') ? -1 : 1));
  let comparti: DatasetCovip['comparti'] = [];
  const file: DatasetCovip['file'] = {};
  for (const k of ordine) {
    const f = slots[k];
    comparti = unisci(comparti, f.comparti, f.meta.tipo);
    file[k] = f.meta;
  }
  return { ...DATASET_VUOTO, comparti, file };
}

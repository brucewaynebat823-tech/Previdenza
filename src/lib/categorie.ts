import type { Categoria } from '../data/tipi';

/** Tipologie di comparto COVIP. Le descrizioni sono spiegazioni generiche, non dati. */
export const CATEGORIE: { id: Categoria | 'ND'; nome: string; colore: string; sfondo: string; spiega: string }[] = [
  { id: 'GAR', nome: 'Garantito', colore: '#0f766e', sfondo: '#e0f5f1', spiega: 'Prevede una garanzia sul capitale o un rendimento minimo. Rischio più basso.' },
  { id: 'OBB PURO', nome: 'Obbligazionario puro', colore: '#1d4ed8', sfondo: '#e3ecff', spiega: 'Investe solo in obbligazioni (titoli di debito).' },
  { id: 'OBB MISTO', nome: 'Obbligazionario misto', colore: '#6d28d9', sfondo: '#efe7ff', spiega: 'Prevalentemente obbligazioni, con una piccola quota di azioni.' },
  { id: 'BIL', nome: 'Bilanciato', colore: '#b45309', sfondo: '#fdf0d9', spiega: 'Mix equilibrato di obbligazioni e azioni.' },
  { id: 'AZN', nome: 'Azionario', colore: '#b91c1c', sfondo: '#fde6e6', spiega: 'Prevalentemente azioni: rischio e potenziale di rendimento più alti.' },
  { id: 'ND', nome: 'Non classificato', colore: '#475569', sfondo: '#eceff4', spiega: 'Categoria non indicata nel file importato.' },
];
export const catInfo = (c: Categoria | null) => CATEGORIE.find((x) => x.id === (c ?? 'ND'))!;

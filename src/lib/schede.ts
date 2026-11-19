import type { SchedaFondo } from '../data/tipi';
import type { Riga } from './importa';

const testo = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const colonna = (intest: Riga, re: RegExp) => intest.findIndex((c) => re.test(testo(c).toLowerCase().replace(/[_\s]/g, '')));

/** Solo link web (http/https): altri schemi vengono scartati. */
export const linkSicuro = (l: string) => (/^https?:\/\/[^\s]+$/i.test(l) ? l : '');

/**
 * Legge l'elenco COVIP dei fondi preesistenti (nome, numero d'iscrizione all'Albo, link alla scheda dei costi).
 * Le colonne sono riconosciute dai titoli; se mancano nome o numero d'Albo il file non è quello atteso.
 */
export function leggiSchede(righe: Riga[]): SchedaFondo[] {
  const intest = righe[0] ?? [];
  const cNome = colonna(intest, /denominazione|nomefondo|^fondo$/);
  const cAlbo = colonna(intest, /albo/);
  const cLink = colonna(intest, /link|scheda/);
  if (cNome < 0 || cAlbo < 0) throw new Error('Colonne non riconosciute: servono nome del fondo e numero d’Albo');
  const out: SchedaFondo[] = [];
  for (const r of righe.slice(1)) {
    const nome = testo(r[cNome]);
    const albo = Number(r[cAlbo]);
    if (!nome || !Number.isFinite(albo)) continue;
    out.push({ albo, nome, link: cLink >= 0 ? linkSicuro(testo(r[cLink])) : '' });
  }
  return out;
}

import type { DatasetCovip } from '../data/tipi';
import { dataIt } from '../lib/formati';

export const AVVISO_LEGALE =
  'Simulazione non vincolante. Per le condizioni complete consultare le CGA e la Nota informativa. Rendimenti passati non garantiscono risultati futuri.';

/** Giorni oltre i quali segnaliamo che potrebbero esistere dati più recenti (soglia indicativa, ⚠️ DA VERIFICARE). */
const GIORNI_DATI_VECCHI = 200;

export function BannerCovip({ dati }: { dati: DatasetCovip }) {
  const d = dataIt(dati.aggiornatoAl);
  const vecchi = dati.aggiornatoAl ? (Date.now() - new Date(dati.aggiornatoAl).getTime()) / 864e5 > GIORNI_DATI_VECCHI : false;
  return (
    <div className="banner">
      <b>{d ? `Dati COVIP aggiornati al ${d}` : 'Dati COVIP non ancora caricati'}</b> · Fonte:{' '}
      <a href={dati.urlFonte} target="_blank" rel="noreferrer">
        {dati.fonte}
      </a>{' '}
      · non in tempo reale.
      {vecchi && <div className="warn">⚠️ I dati potrebbero non essere gli ultimi pubblicati da COVIP: usa “Aggiorna dati”.</div>}
      {!d && <div className="warn">⚠️ Nessun valore è mostrato finché non vengono caricati i file ufficiali COVIP: l’app non usa stime né fonti diverse.</div>}
    </div>
  );
}

export const Avviso = () => <p className="avviso">{AVVISO_LEGALE}</p>;

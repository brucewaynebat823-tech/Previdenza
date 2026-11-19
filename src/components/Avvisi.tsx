import { chiaveFile, NOME_FORMA, type DatasetCovip, type FormaTipo, type TipoFile } from '../data/tipi';
import { dataIt } from '../lib/formati';

export const AVVISO_LEGALE =
  'Simulazione non vincolante. Per le condizioni complete consultare le CGA e la Nota informativa. Rendimenti passati non garantiscono risultati futuri.';

/** Giorni oltre i quali segnaliamo che potrebbero esistere dati più recenti. I file COVIP sono annuali (fine anno): soglia indicativa, ⚠️ DA VERIFICARE. */
const GIORNI_DATI_VECCHI = 400;

/** Stato dei dati COVIP rilevanti per la schermata: data di aggiornamento di ogni file, o invito a caricarlo. */
export function BannerCovip({ dati, forme, tipi, vaiAiDati }: { dati: DatasetCovip; forme: FormaTipo[]; tipi: TipoFile[]; vaiAiDati: () => void }) {
  const righe = forme.flatMap((f) => tipi.map((t) => ({ f, t, m: dati.file[chiaveFile(f, t)] })));
  const caricati = righe.filter((r) => r.m);
  // Per i fondi preesistenti COVIP pubblica solo l'elenco con le schede dei costi (nessun valore numerico).
  const soloElenco = (r: { f: FormaTipo; t: TipoFile }) => r.f === 'PREESISTENTE' && r.t === 'isc' && !!dati.preesistenti;
  const mancanti = righe.filter((r) => !r.m && !soloElenco(r));
  const vecchi = caricati.some((r) => (Date.now() - new Date(r.m!.aggiornatoAl).getTime()) / 864e5 > GIORNI_DATI_VECCHI);
  return (
    <div className="banner">
      <b>Fonte: </b>
      <a href={dati.urlFonte} target="_blank" rel="noreferrer">COVIP – open data</a>
      <span> · non in tempo reale</span>
      {caricati.map((r) => (
        <div key={chiaveFile(r.f, r.t)}>
          {r.t === 'isc' ? 'Costi' : 'Rendimenti'} {NOME_FORMA[r.f]}: <b>Dati COVIP aggiornati al {dataIt(r.m!.aggiornatoAl)}</b>{r.m!.dataDaVerificare ? ' ⚠️ data da verificare' : ''}
        </div>
      ))}
      {righe.some(soloElenco) && <div>Fondi preesistenti: elenco con i link alle schede dei costi (senza valori numerici)</div>}
      {vecchi && <div className="warn">⚠️ Alcuni dati potrebbero non essere gli ultimi pubblicati da COVIP: aggiornali dalla scheda Dati.</div>}
      {mancanti.length > 0 && (
        <div className="warn">
          Da caricare:{' '}
          {forme
            .map((f) => {
              const m = tipi.filter((t) => !dati.file[chiaveFile(f, t)]);
              if (!m.length) return null;
              return m.length === tipi.length ? NOME_FORMA[f] : `${NOME_FORMA[f]} (${m.map((t) => (t === 'isc' ? 'costi' : 'rendimenti')).join(', ')})`;
            })
            .filter(Boolean)
            .join(', ')}
          . <button className="link" onClick={vaiAiDati}>Vai a Dati</button>
        </div>
      )}
    </div>
  );
}

export const Avviso = () => <p className="avviso">{AVVISO_LEGALE}</p>;

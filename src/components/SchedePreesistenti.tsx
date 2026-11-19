import { useMemo, useState } from 'react';
import type { DatasetCovip } from '../data/tipi';

const parole = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(Boolean);

/** Fondi preesistenti: COVIP pubblica l'elenco con il link alla scheda dei costi, non l'ISC come numero. */
export function SchedePreesistenti({ dati }: { dati: DatasetCovip }) {
  const [cerca, setCerca] = useState('');
  const [tutti, setTutti] = useState(false);
  const fondi = dati.preesistenti?.fondi ?? [];
  const trovati = useMemo(() => {
    const p = parole(cerca);
    return [...fondi].sort((a, b) => a.nome.localeCompare(b.nome, 'it')).filter((f) => {
      const h = ' ' + parole(f.nome).join(' ');
      return p.every((w) => h.includes(' ' + w));
    });
  }, [fondi, cerca]);
  if (!fondi.length) return null;
  const mostrati = tutti || cerca.trim() ? trovati : trovati.slice(0, 8);

  return (
    <section className="card">
      <h3>Fondi preesistenti · schede dei costi</h3>
      <p className="nota">
        Per i fondi preesistenti COVIP pubblica l’elenco con il <b>link alla scheda dei costi</b> di ciascun fondo, non l’ISC come numero:
        per questo non compaiono nei confronti con le percentuali. Apri la scheda per vedere i costi del fondo.
        Fonte: {dati.preesistenti?.nomeFile}, COVIP.
      </p>
      <label className="campo">
        <span>Cerca un fondo ({fondi.length} in elenco)</span>
        <input type="search" placeholder="Es. generali, banca, assicurazioni…" value={cerca} onChange={(e) => setCerca(e.target.value)} aria-label="Cerca fondo preesistente" />
      </label>
      <ul className="elenco">
        {mostrati.map((f) => (
          <li key={f.albo}>
            <b>{f.nome}</b>
            <small>N. Albo COVIP {f.albo}</small>
            {f.link ? (
              <a href={f.link} target="_blank" rel="noreferrer noopener">Apri la scheda dei costi ↗</a>
            ) : (
              <small>Link alla scheda non disponibile</small>
            )}
          </li>
        ))}
      </ul>
      {!trovati.length && <p className="nota">Nessun fondo trovato.</p>}
      {!tutti && !cerca.trim() && trovati.length > mostrati.length && (
        <button className="sec" onClick={() => setTutti(true)}>Mostra tutti i {trovati.length} fondi</button>
      )}
    </section>
  );
}

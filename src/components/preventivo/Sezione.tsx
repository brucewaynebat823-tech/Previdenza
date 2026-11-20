import { useState, type ReactNode } from 'react';

/** Sezione con intestazione colorata e un'etichetta a destra, come nella pagina Alleata. Può essere chiusa. */
export function Sezione({ titolo, badge, tono = 'blu', apribile = false, apertaDi = true, children }: { titolo: string; badge?: string; tono?: 'blu' | 'arancio'; apribile?: boolean; apertaDi?: boolean; children: ReactNode }) {
  const [aperta, setAperta] = useState(apertaDi);
  return (
    <section className="sezione">
      {apribile ? (
        <button type="button" className="sezTesta" onClick={() => setAperta(!aperta)} aria-expanded={aperta}>
          <span>{titolo}</span>
          <span className={'pill ' + tono}>{badge}</span>
          <span className="freccia">{aperta ? '▲' : '▼'}</span>
        </button>
      ) : (
        <div className="sezTesta">
          <span>{titolo}</span>
          {badge && <span className={'pill ' + tono}>{badge}</span>}
        </div>
      )}
      {aperta && <div className="sezCorpo">{children}</div>}
    </section>
  );
}

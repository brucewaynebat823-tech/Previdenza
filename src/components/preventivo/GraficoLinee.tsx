export interface SerieGrafico {
  nome: string;
  colore: string;
  punti: number[];
}

const fmt = (v: number, formato: 'euro' | 'indice') => (formato === 'euro' ? '€ ' + Math.round(v).toLocaleString('it-IT', { useGrouping: 'always' } as Intl.NumberFormatOptions) : String(Math.round(v)));

/** Grafico a linee in SVG: ogni serie ha un valore per ciascuna etichetta dell'asse orizzontale. */
export function GraficoLinee({ serie, etichetteX, formato, descrizione }: { serie: SerieGrafico[]; etichetteX: string[]; formato: 'euro' | 'indice'; descrizione: string }) {
  const W = 340;
  const H = 190;
  const ML = formato === 'euro' ? 62 : 38;
  const MR = 8;
  const MT = 10;
  const MB = 24;
  const n = Math.max(2, ...serie.map((s) => s.punti.length));
  const tutti = serie.flatMap((s) => s.punti).filter(Number.isFinite);
  if (!tutti.length) return null;
  const min = Math.min(0, ...tutti) === 0 && formato === 'euro' ? 0 : Math.min(...tutti);
  const max = Math.max(...tutti);
  const pad = (max - min || 1) * 0.06;
  const y0 = formato === 'euro' ? min : min - pad;
  const y1 = max + pad;
  const x = (i: number) => ML + (i / (n - 1)) * (W - ML - MR);
  const y = (v: number) => H - MB - ((v - y0) / (y1 - y0 || 1)) * (H - MB - MT);
  const ticks = [0, 1, 2, 3, 4].map((k) => y0 + ((y1 - y0) * k) / 4);
  const idxX = [0, Math.round((n - 1) / 2), n - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="grafico" role="img" aria-label={descrizione}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke="#e1e7f2" />
            <text x={ML - 4} y={y(t) + 3} fontSize="9" fill="#51607a" textAnchor="end">{fmt(t, formato)}</text>
          </g>
        ))}
        {idxX.map((i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize="9" fill="#51607a" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{etichetteX[i] ?? ''}</text>
        ))}
        {serie.map((s) => (
          <polyline key={s.nome} fill="none" stroke={s.colore} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" points={s.punti.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
        ))}
        {serie.map((s) => {
          const i = s.punti.length - 1;
          return <circle key={s.nome + 'f'} cx={x(i)} cy={y(s.punti[i])} r="3.2" fill={s.colore} />;
        })}
      </svg>
      <div className="leg" style={{ marginTop: 4 }}>
        {serie.map((s) => (
          <div key={s.nome}>
            <span><i className="p" style={{ background: s.colore }} />{s.nome}</span>
            <b>{fmt(s.punti[s.punti.length - 1], formato)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

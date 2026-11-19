import { useMemo, useState } from 'react';
import type { DatasetCovip, FormaTipo } from '../data/tipi';
import { isAlleata, ordina, valore, type Metrica } from '../lib/stats';
import { pct } from '../lib/formati';

export function Combinata({ dati }: { dati: DatasetCovip }) {
  const [anniIsc, setAnniIsc] = useState<2 | 5 | 10 | 35>(10);
  const [anniRend, setAnniRend] = useState<1 | 3 | 5 | 10 | 20>(10);
  const [forma, setForma] = useState<FormaTipo | ''>('');
  const [vista, setVista] = useState<'grafico' | 'tabella'>('grafico');
  const [ordine, setOrdine] = useState<'isc' | 'rend'>('rend');
  const mi: Metrica = { tipo: 'isc', anni: anniIsc };
  const mr: Metrica = { tipo: 'rend', anni: anniRend };

  const punti = useMemo(() => {
    const l = dati.comparti.filter((c) => !forma || c.forma === forma);
    const ok = l.filter((c) => valore(c, mi) !== null && valore(c, mr) !== null);
    return { ok, esclusi: l.length - ok.length };
  }, [dati, forma, anniIsc, anniRend]); // eslint-disable-line react-hooks/exhaustive-deps

  const tab = useMemo(() => ordina(punti.ok, ordine === 'isc' ? mi : mr, ordine === 'isc' ? 'asc' : 'desc'), [punti, ordine, anniIsc, anniRend]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dati.comparti.length)
    return (
      <section className="card">
        <p className="vuoto">Nessun dato disponibile: la vista combinata compare quando i file ufficiali COVIP saranno caricati.</p>
      </section>
    );

  const xs = punti.ok.map((c) => valore(c, mi)!);
  const ys = punti.ok.map((c) => valore(c, mr)!);
  const [x0, x1] = [Math.min(...xs, 0), Math.max(...xs, 0.1)];
  const [y0, y1] = [Math.min(...ys, 0), Math.max(...ys, 0.1)];
  const W = 340, H = 260, M = 36;
  const px = (v: number) => M + ((v - x0) / (x1 - x0 || 1)) * (W - M - 8);
  const py = (v: number) => H - M - ((v - y0) / (y1 - y0 || 1)) * (H - M - 8);

  return (
    <>
      <section className="card">
        <p className="nota">Ogni punto è un comparto: a sinistra costa meno (ISC), in alto rende di più (storico, non previsione).</p>
        <div className="seg">
          {([2, 5, 10, 35] as const).map((a) => (
            <button key={a} className={anniIsc === a ? 'on' : ''} onClick={() => setAnniIsc(a)}>ISC {a}a</button>
          ))}
        </div>
        <div className="seg">
          {([1, 3, 5, 10, 20] as const).map((a) => (
            <button key={a} className={anniRend === a ? 'on' : ''} onClick={() => setAnniRend(a)}>Rend. {a}a</button>
          ))}
        </div>
        <div className="filtri">
          <select value={forma} onChange={(e) => setForma(e.target.value as FormaTipo | '')} aria-label="Forma">
            <option value="">Tutte le forme</option>
            <option value="PIP">PIP</option>
            <option value="FPN">Fondi negoziali</option>
            <option value="FPA">Fondi aperti</option>
            <option value="PREESISTENTE">Preesistenti</option>
          </select>
          <div className="seg">
            <button className={vista === 'grafico' ? 'on' : ''} onClick={() => setVista('grafico')}>Grafico</button>
            <button className={vista === 'tabella' ? 'on' : ''} onClick={() => setVista('tabella')}>Tabella</button>
          </div>
        </div>
        {punti.esclusi > 0 && <p className="warn">⚠️ {punti.esclusi} comparti esclusi perché mancano ISC o rendimento per il periodo scelto (nessuna stima).</p>}
      </section>

      <section className="card">
        {vista === 'grafico' ? (
          <svg viewBox={`0 0 ${W} ${H}`} className="grafico" role="img" aria-label="Grafico a dispersione ISC contro rendimento">
            <line x1={M} y1={H - M} x2={W - 8} y2={H - M} stroke="#9aa5b8" />
            <line x1={M} y1={8} x2={M} y2={H - M} stroke="#9aa5b8" />
            <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#51607a">ISC {anniIsc} anni (%) →</text>
            <text x={10} y={H / 2} fontSize="10" fill="#51607a" transform={`rotate(-90 10 ${H / 2})`} textAnchor="middle">Rendimento netto {anniRend}a (%)</text>
            <text x={M} y={H - M + 12} fontSize="9" fill="#51607a">{x0.toFixed(2)}</text>
            <text x={W - 8} y={H - M + 12} fontSize="9" fill="#51607a" textAnchor="end">{x1.toFixed(2)}</text>
            <text x={M - 4} y={H - M} fontSize="9" fill="#51607a" textAnchor="end">{y0.toFixed(1)}</text>
            <text x={M - 4} y={14} fontSize="9" fill="#51607a" textAnchor="end">{y1.toFixed(1)}</text>
            {punti.ok.map((c) => (
              <circle key={c.id} cx={px(valore(c, mi)!)} cy={py(valore(c, mr)!)} r={isAlleata(c) ? 6 : 3.5} fill={isAlleata(c) ? '#f5a800' : '#0b5fff'} fillOpacity={isAlleata(c) ? 1 : 0.55} stroke={isAlleata(c) ? '#7a5200' : 'none'}>
                <title>{`${c.comparto} (${c.societa}) · ISC ${pct(valore(c, mi))} · rend. ${pct(valore(c, mr))}`}</title>
              </circle>
            ))}
          </svg>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Comparto</th>
                  <th className="n"><button className="link" onClick={() => setOrdine('isc')}>ISC {anniIsc}a {ordine === 'isc' ? '↑' : ''}</button></th>
                  <th className="n"><button className="link" onClick={() => setOrdine('rend')}>Rend. {anniRend}a {ordine === 'rend' ? '↓' : ''}</button></th>
                </tr>
              </thead>
              <tbody>
                {tab.map((c) => (
                  <tr key={c.id} className={isAlleata(c) ? 'alleata' : ''}>
                    <td>{c.comparto}<small>{c.societa} · {c.categoria ?? 'N.D.'}</small></td>
                    <td className="n">{pct(valore(c, mi))}</td>
                    <td className="n">{pct(valore(c, mr))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="nota">Arancione = comparti Alleata Previdenza. Rendimento: storico, non previsione.</p>
      </section>
    </>
  );
}

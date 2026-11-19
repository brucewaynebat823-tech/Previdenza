import { useMemo, useState } from 'react';
import type { DatasetCovip, FormaTipo } from '../data/tipi';
import { isAlleata, ordina, valore, type Metrica } from '../lib/stats';
import { pct } from '../lib/formati';
import { BannerCovip } from './Avvisi';
import { CatBadge } from './Confronto';
import { FORME_TUTTE } from '../data/tipi';
import { CATEGORIE, catInfo } from '../lib/categorie';

export function Combinata({ dati, vaiAiDati }: { dati: DatasetCovip; vaiAiDati: () => void }) {
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

  const banner = <BannerCovip dati={dati} forme={FORME_TUTTE} tipi={['isc', 'rend']} vaiAiDati={vaiAiDati} />;
  if (!dati.comparti.length)
    return (
      <>
        {banner}
        <section className="card vuoto">
          <p><b>Servono entrambi i file: costi e rendimenti.</b></p>
          <button onClick={vaiAiDati}>Carica i dati</button>
        </section>
      </>
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
      {banner}
      <section className="card">
        <p className="nota">Ogni punto è un comparto: a sinistra costa meno (ISC), in alto rende di più (storico, non previsione).</p>
        <div className="filtri">
          <label className="campo">
            <span>Costi (ISC) a</span>
            <select value={anniIsc} onChange={(e) => setAnniIsc(Number(e.target.value) as 2 | 5 | 10 | 35)}>
              {([2, 5, 10, 35] as const).map((a) => <option key={a} value={a}>{a} anni</option>)}
            </select>
          </label>
          <label className="campo">
            <span>Rendimento a</span>
            <select value={anniRend} onChange={(e) => setAnniRend(Number(e.target.value) as 1 | 3 | 5 | 10 | 20)}>
              {([1, 3, 5, 10, 20] as const).map((a) => <option key={a} value={a}>{a} {a === 1 ? 'anno' : 'anni'}</option>)}
            </select>
          </label>
        </div>
        <div className="filtri">
          <select value={forma} onChange={(e) => setForma(e.target.value as FormaTipo | '')} aria-label="Forma">
            <option value="">Tutte le forme</option>
            <option value="PIP">PIP</option>
            <option value="FPN">Fondi negoziali</option>
            <option value="FPA">Fondi aperti</option>
            <option value="PREESISTENTE">Preesistenti</option>
          </select>
          <label className="campo">
            <span>Vista</span>
            <select value={vista} onChange={(e) => setVista(e.target.value as 'grafico' | 'tabella')} aria-label="Vista">
              <option value="grafico">Grafico a dispersione</option>
              <option value="tabella">Tabella ordinabile</option>
            </select>
          </label>
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
              <circle key={c.id} cx={px(valore(c, mi)!)} cy={py(valore(c, mr)!)} r={isAlleata(c) ? 6 : 3.5} fill={catInfo(c.categoria).colore} fillOpacity={isAlleata(c) ? 1 : 0.6} stroke={isAlleata(c) ? '#000' : 'none'} strokeWidth={2}>
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
                    <td>{c.comparto}<small>{c.societa}</small><CatBadge cat={c.categoria} /></td>
                    <td className="n">{pct(valore(c, mi))}</td>
                    <td className="n">{pct(valore(c, mr))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="chips">
          {CATEGORIE.filter((k) => punti.ok.some((c) => (c.categoria ?? 'ND') === k.id)).map((k) => (
            <span key={k.id} className="badge" style={{ color: k.colore, background: k.sfondo, borderColor: k.colore }}>● {k.nome}</span>
          ))}
        </div>
        <p className="nota">Colore = tipologia di fondo. Contorno nero e punto più grande = comparti Alleata Previdenza. Rendimento: storico, non previsione.</p>
      </section>
    </>
  );
}

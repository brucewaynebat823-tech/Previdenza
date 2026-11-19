import { useMemo, useState } from 'react';
import type { DatasetCovip, FormaTipo } from '../data/tipi';
import { ANNI_PER_TIPO, CAMPI_ANAGRAFICA, costruisci, rilevaIntestazione, suggerisci, unisci, type Abbinamento, type Campo, type Riga, type TipoFile } from '../lib/importa';
import { NOME_FORMA } from './Confronto';

interface Foglio {
  sheet: string;
  data: Riga[];
}

/** CSV semplice (delimitatore ; o ,), con virgolette. */
function leggiCsv(testo: string): Riga[] {
  const delim = (testo.split('\n')[0].match(/;/g) ?? []).length >= (testo.split('\n')[0].match(/,/g) ?? []).length ? ';' : ',';
  const righe: Riga[] = [];
  let riga: string[] = [];
  let cella = '';
  let virg = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (virg) {
      if (c === '"' && testo[i + 1] === '"') { cella += '"'; i++; } else if (c === '"') virg = false; else cella += c;
    } else if (c === '"') virg = true;
    else if (c === delim) { riga.push(cella); cella = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && testo[i + 1] === '\n') i++;
      riga.push(cella); cella = '';
      righe.push(riga); riga = [];
    } else cella += c;
  }
  if (cella || riga.length) { riga.push(cella); righe.push(riga); }
  return righe;
}

export function Importa({ dati, onFatto, onChiudi }: { dati: DatasetCovip; onFatto: (d: DatasetCovip) => void; onChiudi: () => void }) {
  const [fogli, setFogli] = useState<Foglio[]>([]);
  const [nomeFile, setNomeFile] = useState('');
  const [errore, setErrore] = useState('');
  const [foglio, setFoglio] = useState(0);
  const [tipo, setTipo] = useState<TipoFile | ''>('');
  const [forma, setForma] = useState<FormaTipo | ''>('');
  const [intest, setIntest] = useState(0);
  const [ab, setAb] = useState<Abbinamento>({});
  const [aggiornatoAl, setAggiornatoAl] = useState(dati.aggiornatoAl ?? '');
  const [dal, setDal] = useState(dati.periodoRendimenti?.dal ?? '');
  const [al, setAl] = useState(dati.periodoRendimenti?.al ?? '');

  const righe = fogli[foglio]?.data ?? [];

  async function scegli(f: File | undefined) {
    if (!f) return;
    setErrore('');
    try {
      let out: Foglio[];
      if (/\.csv$/i.test(f.name)) out = [{ sheet: 'CSV', data: leggiCsv(await f.text()) }];
      else {
        const { default: leggi } = await import('read-excel-file/browser');
        out = (await leggi(f)) as unknown as Foglio[];
      }
      out = out.filter((x) => x.data.length > 1);
      if (!out.length) throw new Error('vuoto');
      setFogli(out);
      setNomeFile(f.name);
      setFoglio(0);
      riparti(out[0].data, tipo);
    } catch {
      setErrore('Non riesco a leggere questo file. Usa un file .xlsx o .csv scaricato da COVIP.');
    }
  }
  function riparti(data: Riga[], t: TipoFile | '') {
    const h = rilevaIntestazione(data);
    setIntest(h);
    setAb(t ? suggerisci(data[h] ?? [], t) : {});
  }

  const colonne = (righe[intest] ?? []).map((c, i) => ({ i, nome: String(c ?? '').trim() || `(colonna ${i + 1})` }));
  const campi: { campo: Campo; nome: string }[] = [
    ...CAMPI_ANAGRAFICA,
    ...(tipo ? ANNI_PER_TIPO[tipo].map((a) => ({ campo: `y${a}` as Campo, nome: tipo === 'isc' ? `ISC a ${a} anni` : `Rendimento a ${a} anni` })) : []),
  ];
  const anteprima = useMemo(() => (tipo && forma ? costruisci(righe, intest, ab, tipo, forma) : null), [righe, intest, ab, tipo, forma]);

  const problemi: string[] = [];
  if (!tipo) problemi.push('Scegli che tipo di file è (ISC o rendimenti).');
  if (!forma) problemi.push('Scegli la forma pensionistica del file.');
  if (ab.comparto === undefined && ab.fondo === undefined) problemi.push('Abbina almeno la colonna “Comparto” o “Fondo / piano”.');
  if (tipo && !ANNI_PER_TIPO[tipo].some((a) => ab[`y${a}` as Campo] !== undefined)) problemi.push('Abbina almeno una colonna di valori.');
  if (!aggiornatoAl) problemi.push('Indica la data di aggiornamento dei dati COVIP (la trovi sulla pagina o nel file).');
  if (tipo === 'rend' && (!dal || !al)) problemi.push('Per i rendimenti indica il periodo di riferimento (dal / al).');
  if (anteprima && anteprima.comparti.length === 0) problemi.push('Nessuna riga valida con questo abbinamento.');

  function conferma() {
    if (!anteprima || !tipo || !forma) return;
    onFatto({
      aggiornatoAl,
      periodoRendimenti: tipo === 'rend' ? { dal, al } : dati.periodoRendimenti,
      fonte: 'COVIP – open data (file importato: ' + nomeFile + ')',
      urlFonte: 'https://www.covip.it/open-data',
      comparti: unisci(dati.comparti, anteprima.comparti, tipo),
    });
    onChiudi();
  }

  return (
    <div className="modale" role="dialog" aria-label="Aggiorna dati COVIP">
      <div className="foglio">
        <div className="testa">
          <h3>Aggiorna dati COVIP</h3>
          <button className="sec" onClick={onChiudi}>Chiudi</button>
        </div>
        <ol className="passi">
          <li>
            Apri la pagina ufficiale e scarica il file (ISC o rendimenti):{' '}
            <a href="https://www.covip.it/open-data" target="_blank" rel="noreferrer">covip.it/open-data</a>
          </li>
          <li>Torna qui e scegli il file scaricato.</li>
        </ol>
        <input type="file" accept=".xlsx,.csv" onChange={(e) => void scegli(e.target.files?.[0])} />
        {errore && <p className="warn">{errore}</p>}

        {fogli.length > 0 && (
          <>
            <h4>Tipo di file</h4>
            <div className="seg">
              <button className={tipo === 'isc' ? 'on' : ''} onClick={() => { setTipo('isc'); setAb(suggerisci(righe[intest] ?? [], 'isc')); }}>Costi (ISC)</button>
              <button className={tipo === 'rend' ? 'on' : ''} onClick={() => { setTipo('rend'); setAb(suggerisci(righe[intest] ?? [], 'rend')); }}>Rendimenti</button>
            </div>
            <h4>Forma pensionistica</h4>
            <div className="seg">
              {(Object.keys(NOME_FORMA) as FormaTipo[]).map((f) => (
                <button key={f} className={forma === f ? 'on' : ''} onClick={() => setForma(f)}>{NOME_FORMA[f]}</button>
              ))}
            </div>
            {fogli.length > 1 && (
              <label className="campo">
                <span>Foglio</span>
                <select value={foglio} onChange={(e) => { const n = Number(e.target.value); setFoglio(n); riparti(fogli[n].data, tipo); }}>
                  {fogli.map((f, i) => <option key={f.sheet} value={i}>{f.sheet}</option>)}
                </select>
              </label>
            )}
            <label className="campo">
              <span>Riga con i titoli delle colonne</span>
              <select value={intest} onChange={(e) => { const n = Number(e.target.value); setIntest(n); if (tipo) setAb(suggerisci(righe[n] ?? [], tipo)); }}>
                {righe.slice(0, 15).map((r, i) => <option key={i} value={i}>Riga {i + 1}: {r.filter(Boolean).slice(0, 3).join(' · ').slice(0, 40)}</option>)}
              </select>
            </label>

            <h4>Abbinamento colonne</h4>
            <p className="nota">Controlla che ogni voce corrisponda alla colonna giusta. Le colonne non abbinate restano “dato mancante”.</p>
            {campi.map(({ campo, nome }) => (
              <label key={campo} className="campo riga-ab">
                <span>{nome}</span>
                <select value={ab[campo] ?? ''} onChange={(e) => setAb({ ...ab, [campo]: e.target.value === '' ? undefined : Number(e.target.value) })}>
                  <option value="">— non presente —</option>
                  {colonne.map((c) => <option key={c.i} value={c.i}>{c.nome}</option>)}
                </select>
              </label>
            ))}

            <h4>Data dei dati</h4>
            <div className="griglia">
              <label className="campo"><span>Dati COVIP aggiornati al</span><input type="date" value={aggiornatoAl} onChange={(e) => setAggiornatoAl(e.target.value)} /></label>
              {tipo === 'rend' && (
                <>
                  <label className="campo"><span>Rendimenti: dal</span><input type="date" value={dal} onChange={(e) => setDal(e.target.value)} /></label>
                  <label className="campo"><span>Rendimenti: al</span><input type="date" value={al} onChange={(e) => setAl(e.target.value)} /></label>
                </>
              )}
            </div>

            {anteprima && anteprima.comparti.length > 0 && (
              <>
                <h4>Anteprima ({anteprima.comparti.length} comparti)</h4>
                <div className="scroll">
                  <table>
                    <tbody>
                      {anteprima.comparti.slice(0, 5).map((c) => (
                        <tr key={c.id}>
                          <td>{c.comparto}<small>{c.societa} · {c.categoria ?? 'categoria N.D.'}</small></td>
                          <td className="n">{(tipo === 'isc' ? [2, 5, 10, 35] : [1, 3, 5, 10, 20]).map((a) => (tipo === 'isc' ? c.isc[a as 2] : c.rend[a as 1]) ?? '—').join(' · ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {problemi.length > 0 && <ul className="errori">{problemi.map((p) => <li key={p}>{p}</li>)}</ul>}
            <button disabled={problemi.length > 0} onClick={conferma}>Importa nell’app</button>
          </>
        )}
      </div>
    </div>
  );
}

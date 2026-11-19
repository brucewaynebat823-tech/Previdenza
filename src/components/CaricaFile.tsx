import { useMemo, useState } from 'react';
import { NOME_FORMA, type FileMeta, type FormaTipo, type TipoFile } from '../data/tipi';
import { ANNI_PER_TIPO, CAMPI_ANAGRAFICA, costruisci, rilevaIntestazione, suggerisci, type Abbinamento, type Campo, type Riga } from '../lib/importa';
import type { Comparto } from '../data/tipi';

interface Foglio {
  sheet: string;
  data: Riga[];
}

/** CSV semplice (delimitatore ; o ,), con virgolette. */
function leggiCsv(testo: string): Riga[] {
  const prima = testo.split('\n')[0];
  const delim = (prima.match(/;/g) ?? []).length >= (prima.match(/,/g) ?? []).length ? ';' : ',';
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

interface Props {
  forma: FormaTipo;
  tipo: TipoFile;
  onImporta: (nuovi: Comparto[], meta: Omit<FileMeta, 'forma' | 'tipo' | 'comparti' | 'caricatoIl'>) => void;
  onChiudi: () => void;
}

/** Caricamento guidato di un file: 1) scegli il file; 2) controlla e conferma. Forma e tipo sono già decisi dal riquadro da cui si parte. */
export function CaricaFile({ forma, tipo, onImporta, onChiudi }: Props) {
  const [fogli, setFogli] = useState<Foglio[]>([]);
  const [nomeFile, setNomeFile] = useState('');
  const [errore, setErrore] = useState('');
  const [foglio, setFoglio] = useState(0);
  const [intest, setIntest] = useState(0);
  const [ab, setAb] = useState<Abbinamento>({});
  const [modifica, setModifica] = useState(false);
  const [aggiornatoAl, setAggiornatoAl] = useState('');
  const [dal, setDal] = useState('');
  const [al, setAl] = useState('');

  const righe = fogli[foglio]?.data ?? [];
  const titolo = `${tipo === 'isc' ? 'Costi (ISC)' : 'Rendimenti'} · ${NOME_FORMA[forma]}`;

  function riparti(data: Riga[]) {
    const h = rilevaIntestazione(data);
    setIntest(h);
    setAb(suggerisci(data[h] ?? [], tipo));
  }

  async function scegli(f: File | undefined) {
    if (!f) return;
    setErrore('');
    try {
      let out: Foglio[];
      if (/\.csv$/i.test(f.name)) out = [{ sheet: 'CSV', data: leggiCsv(await f.text()) }];
      else if (/\.xlsx$/i.test(f.name)) {
        const { default: leggi } = await import('read-excel-file/browser');
        out = (await leggi(f)) as unknown as Foglio[];
      } else throw new Error('formato');
      out = out.filter((x) => x.data.length > 1);
      if (!out.length) throw new Error('vuoto');
      setFogli(out);
      setNomeFile(f.name);
      setFoglio(0);
      riparti(out[0].data);
    } catch {
      setErrore('Non riesco a leggere questo file. Serve un file Excel (.xlsx) o .csv scaricato da COVIP: i PDF non vanno bene.');
    }
  }

  const colonne = (righe[intest] ?? []).map((c, i) => ({ i, nome: String(c ?? '').trim() || `(colonna ${i + 1})` }));
  const nomeCol = (i?: number) => (i === undefined ? undefined : colonne.find((c) => c.i === i)?.nome);
  const anteprima = useMemo(() => (fogli.length ? costruisci(righe, intest, ab, tipo, forma) : null), [fogli, righe, intest, ab, tipo, forma]);
  const anniOk = ANNI_PER_TIPO[tipo].filter((a) => ab[`y${a}` as Campo] !== undefined);
  const riconosciuto = (ab.comparto !== undefined || ab.fondo !== undefined) && anniOk.length > 0;

  const problemi: string[] = [];
  if (fogli.length) {
    if (!riconosciuto) problemi.push('Non ho riconosciuto le colonne: apri “Controlla le colonne” e abbinale.');
    if (!aggiornatoAl) problemi.push('Indica la data di aggiornamento dei dati (la trovi sulla pagina COVIP o nel file).');
    if (tipo === 'rend' && (!dal || !al)) problemi.push('Indica il periodo dei rendimenti (dal / al).');
    if (anteprima && anteprima.comparti.length === 0) problemi.push('Nessuna riga valida con questo abbinamento.');
  }

  function conferma() {
    if (!anteprima) return;
    onImporta(anteprima.comparti, { nomeFile, aggiornatoAl, periodo: tipo === 'rend' ? { dal, al } : undefined });
    onChiudi();
  }

  return (
    <div className="modale" role="dialog" aria-label={`Carica ${titolo}`}>
      <div className="foglio">
        <div className="testa">
          <h3>Carica: {titolo}</h3>
          <button className="sec" onClick={onChiudi}>Annulla</button>
        </div>

        <div className="passo">
          <span className="num">1</span>
          <div>
            <b>Scegli il file</b>
            <p className="nota">Il file Excel (.xlsx) dei {tipo === 'isc' ? 'costi' : 'rendimenti'} di “{NOME_FORMA[forma]}”, scaricato da <a href="https://www.covip.it/open-data" target="_blank" rel="noreferrer">covip.it/open-data</a>.</p>
            <input type="file" accept=".xlsx,.csv" onChange={(e) => void scegli(e.target.files?.[0])} />
            {errore && <p className="warn">{errore}</p>}
          </div>
        </div>

        {fogli.length > 0 && anteprima && (
          <div className="passo">
            <span className="num">2</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <b>Controlla e conferma</b>
              <p className={riconosciuto ? 'ok' : 'warn'}>
                {riconosciuto
                  ? `✓ Colonne riconosciute: ${anteprima.comparti.length} comparti trovati in “${nomeFile}”.`
                  : '⚠️ Non ho riconosciuto le colonne del file.'}
              </p>
              {anteprima.comparti.length > 0 && (
                <div className="scroll">
                  <table>
                    <tbody>
                      {anteprima.comparti.slice(0, 3).map((c) => (
                        <tr key={c.id}>
                          <td>{c.comparto}<small>{c.societa} · {c.categoria ? '' : 'tipologia non indicata'}</small></td>
                          <td className="n">{ANNI_PER_TIPO[tipo].map((a) => `${a}a: ${((tipo === 'isc' ? c.isc[a as 2] : c.rend[a as 1]) ?? '—').toString().replace('.', ',')}`).join(' · ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h4>Data dei dati</h4>
              <div className="griglia">
                <label className="campo"><span>Aggiornati al</span><input type="date" value={aggiornatoAl} onChange={(e) => setAggiornatoAl(e.target.value)} /></label>
                {tipo === 'rend' && (
                  <>
                    <label className="campo"><span>Periodo: dal</span><input type="date" value={dal} onChange={(e) => setDal(e.target.value)} /></label>
                    <label className="campo"><span>Periodo: al</span><input type="date" value={al} onChange={(e) => setAl(e.target.value)} /></label>
                  </>
                )}
              </div>

              <button className="link" onClick={() => setModifica(!modifica)}>{modifica ? 'Nascondi' : 'Controlla le colonne'}</button>
              {modifica && (
                <div>
                  {fogli.length > 1 && (
                    <label className="campo">
                      <span>Foglio</span>
                      <select value={foglio} onChange={(e) => { const n = Number(e.target.value); setFoglio(n); riparti(fogli[n].data); }}>
                        {fogli.map((f, i) => <option key={f.sheet} value={i}>{f.sheet}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="campo">
                    <span>Riga con i titoli</span>
                    <select value={intest} onChange={(e) => { const n = Number(e.target.value); setIntest(n); setAb(suggerisci(righe[n] ?? [], tipo)); }}>
                      {righe.slice(0, 15).map((r, i) => <option key={i} value={i}>Riga {i + 1}: {r.filter(Boolean).slice(0, 3).join(' · ').slice(0, 40)}</option>)}
                    </select>
                  </label>
                  {[...CAMPI_ANAGRAFICA, ...ANNI_PER_TIPO[tipo].map((a) => ({ campo: `y${a}` as Campo, nome: tipo === 'isc' ? `ISC a ${a} anni` : `Rendimento a ${a} anni` }))].map(({ campo, nome }) => (
                    <label key={campo} className="campo riga-ab">
                      <span>{nome}</span>
                      <select value={ab[campo] ?? ''} onChange={(e) => setAb({ ...ab, [campo]: e.target.value === '' ? undefined : Number(e.target.value) })}>
                        <option value="">— non presente —</option>
                        {colonne.map((c) => <option key={c.i} value={c.i}>{c.nome}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              )}
              {!modifica && riconosciuto && (
                <p className="nota">
                  {[nomeCol(ab.societa) && `Società = “${nomeCol(ab.societa)}”`, nomeCol(ab.comparto) && `Comparto = “${nomeCol(ab.comparto)}”`, nomeCol(ab.categoria) && `Tipologia = “${nomeCol(ab.categoria)}”`].filter(Boolean).join(' · ')}
                </p>
              )}

              {problemi.length > 0 && <ul className="errori">{problemi.map((p) => <li key={p}>{p}</li>)}</ul>}
              <button disabled={problemi.length > 0} onClick={conferma}>Salva sul dispositivo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

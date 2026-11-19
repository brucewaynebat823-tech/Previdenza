import { useMemo, useState } from 'react';
import type { Anni, Categoria, Comparto, DatasetCovip, FormaTipo } from '../data/tipi';
import { filtra, isAlleata, medieperCategoria, ordina, scostoDallaMedia, valore, media, type Metrica } from '../lib/stats';
import { pct } from '../lib/formati';

const CATEGORIE: { v: Categoria | ''; l: string }[] = [
  { v: '', l: 'Tutte' },
  { v: 'GAR', l: 'Garantito' },
  { v: 'OBB PURO', l: 'Obbligazionario puro' },
  { v: 'OBB MISTO', l: 'Obbligazionario misto' },
  { v: 'BIL', l: 'Bilanciato' },
  { v: 'AZN', l: 'Azionario' },
];
const ANNI_ISC = [2, 5, 10, 35] as const;
const ANNI_REND = [1, 3, 5, 10, 20] as const;

interface Props {
  dati: DatasetCovip;
  /** Forme mostrate in questa scheda. */
  forme: FormaTipo[];
  modo: 'isc' | 'rend';
}

const SPIEGAZIONE = {
  isc: 'ISC = Indicatore Sintetico dei Costi: quanto i costi riducono ogni anno il rendimento, in punti percentuali, per una permanenza di 2, 5, 10 o 35 anni. Più è basso, meglio è.',
  rend: 'Rendimento medio annuo composto, al netto dei costi e della tassazione, su 1, 3, 5, 10 o 20 anni. È un dato storico, non una previsione.',
};

export function Confronto({ dati, forme, modo }: Props) {
  const lista = useMemo(() => dati.comparti.filter((c) => forme.includes(c.forma)), [dati, forme]);
  const [anni, setAnni] = useState<number>(modo === 'isc' ? 10 : 5);
  const [cat, setCat] = useState<Categoria | ''>('');
  const [forma, setForma] = useState<FormaTipo | ''>('');
  const [societa, setSocieta] = useState('');
  const [testo, setTesto] = useState('');
  const [verso, setVerso] = useState<'asc' | 'desc'>(modo === 'isc' ? 'asc' : 'desc');
  const [scelti, setScelti] = useState<string[]>([]);
  const [cerca, setCerca] = useState('');

  const metrica = { tipo: modo, anni } as Metrica;
  const societaElenco = useMemo(() => [...new Set(lista.map((c) => c.societa))].sort(), [lista]);
  const filtrati = useMemo(
    () => ordina(filtra(lista, { forme: forma ? [forma] : undefined, societa, categoria: cat, testo }), metrica, verso),
    [lista, forma, societa, cat, testo, anni, verso, modo], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const medie = useMemo(() => medieperCategoria(filtra(lista, { forme: forma ? [forma] : undefined, societa }), metrica), [lista, forma, societa, anni, modo]); // eslint-disable-line react-hooks/exhaustive-deps
  const alleata = lista.filter(isAlleata);
  const confronto = lista.filter((c) => scelti.includes(c.id));
  const etichetta = modo === 'isc' ? 'ISC' : 'Rend. netto';
  const anniOpz = modo === 'isc' ? ANNI_ISC : ANNI_REND;
  const periodo = dati.periodoRendimenti;

  const MAX = 4;
  const suggerimenti = useMemo(() => {
    const t = cerca.trim().toLowerCase();
    if (!t) return [];
    return lista.filter((c) => !scelti.includes(c.id) && `${c.societa} ${c.fondo} ${c.comparto}`.toLowerCase().includes(t)).slice(0, 8);
  }, [cerca, lista, scelti]);
  const elencoCompleto = useMemo(() => [...lista].sort((a, b) => `${a.societa} ${a.comparto}`.localeCompare(`${b.societa} ${b.comparto}`, 'it')), [lista]);
  const aggiungi = (id: string) => {
    if (id && !scelti.includes(id) && scelti.length < MAX) setScelti([...scelti, id]);
    setCerca('');
  };
  const toggle = (id: string) => setScelti((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));

  if (!lista.length)
    return (
      <section className="card">
        <p className="vuoto">Nessun dato disponibile per questa scheda. I comparti compariranno quando i file ufficiali COVIP saranno caricati.</p>
        <p className="nota">{SPIEGAZIONE[modo]}</p>
      </section>
    );

  return (
    <>
      <section className="card">
        <p className="nota">{SPIEGAZIONE[modo]}</p>
        {modo === 'rend' && (
          <p className="warn">
            Rendimento storico, non previsione.{' '}
            {periodo ? `Periodo di riferimento: dal ${periodo.dal} al ${periodo.al}.` : '⚠️ Periodo di riferimento non indicato nel dato.'}
          </p>
        )}
        <div className="seg" role="group" aria-label="Anni">
          {anniOpz.map((a) => (
            <button key={a} className={anni === a ? 'on' : ''} onClick={() => setAnni(a)}>
              {a} anni
            </button>
          ))}
        </div>
        <div className="filtri">
          {forme.length > 1 && (
            <select value={forma} onChange={(e) => setForma(e.target.value as FormaTipo | '')} aria-label="Forma pensionistica">
              <option value="">Tutte le forme</option>
              {forme.map((f) => (
                <option key={f} value={f}>
                  {NOME_FORMA[f]}
                </option>
              ))}
            </select>
          )}
          <select value={cat} onChange={(e) => setCat(e.target.value as Categoria | '')} aria-label="Categoria di comparto">
            {CATEGORIE.map((c) => (
              <option key={c.v} value={c.v}>
                {c.v ? c.l : 'Tutte le categorie'}
              </option>
            ))}
          </select>
          <select value={societa} onChange={(e) => setSocieta(e.target.value)} aria-label="Società">
            <option value="">Tutte le società</option>
            {societaElenco.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input placeholder="Cerca per nome" value={testo} onChange={(e) => setTesto(e.target.value)} />
          <button className="sec" onClick={() => setVerso(verso === 'asc' ? 'desc' : 'asc')}>
            Ordine: {verso === 'asc' ? '↑ dal più basso' : '↓ dal più alto'}
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Media per categoria · {anni} anni</h3>
        <p className="nota">[Stima] media semplice dei comparti mostrati (non ponderata per patrimonio), calcolata sui dati COVIP.</p>
        <table>
          <tbody>
            {medie.map((m) => (
              <tr key={m.categoria}>
                <td>{m.categoria}</td>
                <td className="n">{pct(m.media)}</td>
                <td className="n sub">{m.n} comparti</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {alleata.length > 0 && (
        <section className="card alleata">
          <h3>Alleata Previdenza vs media della categoria</h3>
          <table>
            <tbody>
              {alleata.map((c) => {
                const d = scostoDallaMedia(c, lista, metrica);
                const mediaCat = media(lista.filter((x) => x.categoria === c.categoria), metrica).media;
                return (
                  <tr key={c.id}>
                    <td>{c.comparto}</td>
                    <td className="n">{pct(valore(c, metrica))}</td>
                    <td className="n sub">media cat. {pct(mediaCat)}</td>
                    <td className="n">{d === null ? '—' : (d > 0 ? '+' : '') + d.toFixed(2).replace('.', ',') + ' pt'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h3>Scegli i fondi da confrontare</h3>
        <p className="nota">Cerca per nome o scegli dall’elenco (massimo {MAX}). Vale su tutti i comparti disponibili, indipendentemente dai filtri sopra.</p>
        <input type="search" placeholder="Cerca un fondo o una società…" value={cerca} onChange={(e) => setCerca(e.target.value)} aria-label="Cerca fondo da confrontare" disabled={scelti.length >= MAX} />
        {suggerimenti.length > 0 && (
          <ul className="suggerimenti">
            {suggerimenti.map((c) => (
              <li key={c.id}>
                <button className="sec" onClick={() => aggiungi(c.id)}>
                  {c.comparto}
                  <small>{c.societa} · {NOME_FORMA[c.forma]}{c.categoria ? ` · ${c.categoria}` : ''}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {cerca.trim() && suggerimenti.length === 0 && <p className="nota">Nessun comparto trovato.</p>}
        <select value="" onChange={(e) => aggiungi(e.target.value)} aria-label="Scegli un fondo dall’elenco" disabled={scelti.length >= MAX}>
          <option value="">Oppure scegli dall’elenco…</option>
          {elencoCompleto.filter((c) => !scelti.includes(c.id)).map((c) => (
            <option key={c.id} value={c.id}>{c.comparto} — {c.societa}</option>
          ))}
        </select>
        {scelti.length > 0 && (
          <div className="chips">
            {confronto.map((c) => (
              <button key={c.id} className="chip" onClick={() => toggle(c.id)} aria-label={`Togli ${c.comparto}`}>{c.comparto} ✕</button>
            ))}
            <button className="link" onClick={() => setScelti([])}>Svuota</button>
          </div>
        )}
        {scelti.length >= MAX && <p className="nota">Hai raggiunto il massimo di {MAX} fondi: toglierne uno per aggiungerne altri.</p>}
      </section>

      {confronto.length > 0 && (
        <section className="card">
          <h3>Confronto affiancato</h3>
          <div className="affianca" style={{ gridTemplateColumns: `repeat(${confronto.length}, minmax(0,1fr))` }}>
            {confronto.map((c) => (
              <div key={c.id} className={'colonna' + (isAlleata(c) ? ' alleata' : '')}>
                <b>{c.comparto}</b>
                <small>{c.societa}</small>
                {(modo === 'isc' ? ANNI_ISC : ANNI_REND).map((a) => (
                  <div key={a} className="riga">
                    <span>{a}a</span>
                    <span>{pct(valore(c, { tipo: modo, anni: a } as Metrica))}</span>
                  </div>
                ))}
                <button className="sec" onClick={() => toggle(c.id)}>Togli</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h3>
          {filtrati.length} comparti · {etichetta} {anni} anni
        </h3>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Comparto</th>
                <th>Cat.</th>
                <th className="n">{etichetta}</th>
              </tr>
            </thead>
            <tbody>
              {filtrati.map((c: Comparto) => (
                <tr key={c.id} className={isAlleata(c) ? 'alleata' : ''}>
                  <td>
                    <input type="checkbox" checked={scelti.includes(c.id)} onChange={() => toggle(c.id)} aria-label={`Confronta ${c.comparto}`} />
                  </td>
                  <td>
                    {c.comparto}
                    <small>
                      {c.societa} · {NOME_FORMA[c.forma]}
                    </small>
                  </td>
                  <td>{c.categoria ?? 'N.D.'}</td>
                  <td className="n">{valore(c, metrica) === null ? '— (dato mancante)' : pct(valore(c, metrica))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="nota">Spunta i comparti per aggiungerli al confronto (massimo {MAX}).</p>
      </section>
    </>
  );
}

export const NOME_FORMA: Record<FormaTipo, string> = {
  PIP: 'PIP',
  FPN: 'Fondo negoziale',
  FPA: 'Fondo aperto',
  PREESISTENTE: 'Fondo preesistente',
};
export type { Anni };

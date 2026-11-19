import { useMemo, useState } from 'react';
import { NOME_FORMA, chiaveFile, type Categoria, type Comparto, type DatasetCovip, type FormaTipo } from '../data/tipi';
import { filtra, isAlleata, media, ordina, scostoDallaMedia, valore, type Metrica } from '../lib/stats';
import { CATEGORIE, catInfo } from '../lib/categorie';
import { dataIt, pct } from '../lib/formati';
import { BannerCovip } from './Avvisi';

const ANNI_ISC = [2, 5, 10, 35] as const;
const ANNI_REND = [1, 3, 5, 10, 20] as const;
const MAX = 4;

const SPIEGAZIONE = {
  isc: 'ISC = Indicatore Sintetico dei Costi: quanto i costi riducono ogni anno il rendimento, in punti percentuali, per una permanenza di 2, 5, 10 o 35 anni. Più è basso, meglio è.',
  rend: 'Rendimento medio annuo composto, al netto dei costi e della tassazione, su 1, 3, 5, 10 o 20 anni. È un dato storico, non una previsione.',
};

export function CatBadge({ cat }: { cat: Categoria | null }) {
  const c = catInfo(cat);
  return (
    <span className="badge" style={{ color: c.colore, background: c.sfondo, borderColor: c.colore }} title={c.spiega}>
      {c.nome}
    </span>
  );
}

interface Props {
  dati: DatasetCovip;
  forme: FormaTipo[];
  modo: 'isc' | 'rend';
  vaiAiDati: () => void;
}

export function Confronto({ dati, forme, modo, vaiAiDati }: Props) {
  const lista = useMemo(
    () => dati.comparti.filter((c) => forme.includes(c.forma) && Object.keys(modo === 'isc' ? c.isc : c.rend).length > 0),
    [dati, forme, modo],
  );
  const [anni, setAnni] = useState<number>(modo === 'isc' ? 10 : 5);
  const [cat, setCat] = useState<Categoria | 'ND' | ''>('');
  const [forma, setForma] = useState<FormaTipo | ''>('');
  const [societa, setSocieta] = useState('');
  const [testo, setTesto] = useState('');
  const [verso, setVerso] = useState<'asc' | 'desc'>(modo === 'isc' ? 'asc' : 'desc');
  const [raggruppa, setRaggruppa] = useState(true);
  const [legenda, setLegenda] = useState(false);
  const [scelti, setScelti] = useState<string[]>([]);
  const [cerca, setCerca] = useState('');

  const metrica = { tipo: modo, anni } as Metrica;
  const societaElenco = useMemo(() => [...new Set(lista.map((c) => c.societa))].filter(Boolean).sort(), [lista]);
  const base = useMemo(() => filtra(lista, { forme: forma ? [forma] : undefined, societa, testo }), [lista, forma, societa, testo]);
  const filtrati = useMemo(
    () => ordina(cat === '' ? base : base.filter((c) => (c.categoria ?? 'ND') === cat), metrica, verso),
    [base, cat, anni, verso, modo], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const gruppi = useMemo(
    () =>
      CATEGORIE.map((k) => {
        const l = filtrati.filter((c) => (c.categoria ?? 'ND') === k.id);
        return { k, l, m: media(l, metrica) };
      }).filter((g) => g.l.length > 0),
    [filtrati, anni, modo], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const conteggi = useMemo(() => Object.fromEntries(CATEGORIE.map((k) => [k.id, base.filter((c) => (c.categoria ?? 'ND') === k.id).length])), [base]);
  const alleata = lista.filter(isAlleata);
  const confronto = scelti.map((id) => lista.find((c) => c.id === id)).filter((c): c is Comparto => !!c);
  const etichetta = modo === 'isc' ? 'ISC' : 'Rend. netto';
  const anniOpz = modo === 'isc' ? ANNI_ISC : ANNI_REND;
  const periodi = forme.map((f) => ({ f, m: dati.file[chiaveFile(f, 'rend')] })).filter((x) => x.m?.periodi || x.m?.periodo);
  const testoPeriodo = (m: NonNullable<(typeof periodi)[number]['m']>) =>
    m.periodi?.[anni] ? `${m.periodi[anni]} (anni solari)` : m.periodo ? `dal ${dataIt(m.periodo.dal)} al ${dataIt(m.periodo.al)}` : 'non indicato';

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
  const toggle = (id: string) => setScelti((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX ? s : [...s, id]));

  const banner = <BannerCovip dati={dati} forme={forme} tipi={[modo]} vaiAiDati={vaiAiDati} />;

  if (!lista.length)
    return (
      <>
        {banner}
        <section className="card vuoto">
          <p>
            <b>Nessun dato da mostrare.</b>
          </p>
          <p className="nota">Carica il file COVIP dei {modo === 'isc' ? 'costi (ISC)' : 'rendimenti'}: resta salvato sul dispositivo e lo usi quando vuoi.</p>
          <button onClick={vaiAiDati}>Carica i dati</button>
          <p className="nota">{SPIEGAZIONE[modo]}</p>
        </section>
      </>
    );

  const riga = (c: Comparto) => (
    <tr key={c.id} className={isAlleata(c) ? 'alleata' : ''}>
      <td>
        <input type="checkbox" checked={scelti.includes(c.id)} onChange={() => toggle(c.id)} aria-label={`Confronta ${c.comparto}`} />
      </td>
      <td>
        {c.comparto}
        <small>
          {c.societa} · {NOME_FORMA[c.forma]}
        </small>
        {!raggruppa && <CatBadge cat={c.categoria} />}
      </td>
      <td className="n">{valore(c, metrica) === null ? '— dato mancante' : pct(valore(c, metrica))}</td>
    </tr>
  );

  return (
    <>
      {banner}
      <section className="card">
        <p className="nota">{SPIEGAZIONE[modo]}</p>
        {modo === 'rend' && (
          <p className="warn">
            Rendimento storico, non previsione.{' '}
            {periodi.length
              ? `Periodo di riferimento (${anni} ${anni === 1 ? 'anno' : 'anni'}): ` + periodi.map((p) => `${NOME_FORMA[p.f]} ${testoPeriodo(p.m!)}`).join(' · ')
              : '⚠️ Periodo di riferimento non indicato.'}
          </p>
        )}
        <h4>Orizzonte</h4>
        <div className="seg" role="group" aria-label="Anni">
          {anniOpz.map((a) => (
            <button key={a} className={anni === a ? 'on' : ''} onClick={() => setAnni(a)}>
              {a} anni
            </button>
          ))}
        </div>
        <h4>Tipologia di fondo</h4>
        <div className="chips scorri" role="group" aria-label="Tipologia">
          <button className={'chipcat' + (cat === '' ? ' on' : '')} onClick={() => setCat('')}>
            Tutte <small>{base.length}</small>
          </button>
          {CATEGORIE.filter((k) => conteggi[k.id] > 0).map((k) => (
            <button
              key={k.id}
              className={'chipcat' + (cat === k.id ? ' on' : '')}
              style={{ ['--c' as string]: k.colore, ['--s' as string]: k.sfondo }}
              onClick={() => setCat(cat === k.id ? '' : k.id)}
            >
              {k.nome} <small>{conteggi[k.id]}</small>
            </button>
          ))}
        </div>
        <button className="link" onClick={() => setLegenda(!legenda)}>{legenda ? 'Nascondi' : 'Cosa significano le tipologie?'}</button>
        {legenda && (
          <ul className="legenda">
            {CATEGORIE.filter((k) => k.id !== 'ND').map((k) => (
              <li key={k.id}><CatBadge cat={k.id as Categoria} /> {k.spiega}</li>
            ))}
          </ul>
        )}
        <div className="filtri">
          {forme.length > 1 && (
            <select value={forma} onChange={(e) => setForma(e.target.value as FormaTipo | '')} aria-label="Forma pensionistica">
              <option value="">Tutte le forme</option>
              {forme.map((f) => (
                <option key={f} value={f}>{NOME_FORMA[f]}</option>
              ))}
            </select>
          )}
          <select value={societa} onChange={(e) => setSocieta(e.target.value)} aria-label="Società">
            <option value="">Tutte le società</option>
            {societaElenco.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input type="search" placeholder="Cerca per nome" value={testo} onChange={(e) => setTesto(e.target.value)} />
          <button className="sec" onClick={() => setVerso(verso === 'asc' ? 'desc' : 'asc')}>
            {verso === 'asc' ? '↑ Dal più basso' : '↓ Dal più alto'}
          </button>
        </div>
        <label className="check piccolo">
          <input type="checkbox" checked={raggruppa} onChange={(e) => setRaggruppa(e.target.checked)} /> Raggruppa per tipologia
        </label>
      </section>

      {alleata.length > 0 && (
        <section className="card alleata">
          <h3>Alleata Previdenza vs media della tipologia</h3>
          <table>
            <tbody>
              {alleata.map((c) => {
                const d = scostoDallaMedia(c, lista, metrica);
                const mediaCat = media(lista.filter((x) => x.categoria === c.categoria), metrica).media;
                return (
                  <tr key={c.id}>
                    <td>{c.comparto}<CatBadge cat={c.categoria} /></td>
                    <td className="n">{pct(valore(c, metrica))}</td>
                    <td className="n sub">media {pct(mediaCat)}</td>
                    <td className="n">{d === null ? '—' : (d > 0 ? '+' : '') + d.toFixed(2).replace('.', ',') + ' pt'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="nota">[Stima] media semplice dei comparti della stessa tipologia (non ponderata per patrimonio).</p>
        </section>
      )}

      <section className="card">
        <h3>Scegli i fondi da confrontare</h3>
        <p className="nota">Cerca per nome o scegli dall’elenco (massimo {MAX}). Vale su tutti i comparti disponibili, indipendentemente dai filtri.</p>
        <input type="search" placeholder="Cerca un fondo o una società…" value={cerca} onChange={(e) => setCerca(e.target.value)} aria-label="Cerca fondo da confrontare" disabled={scelti.length >= MAX} />
        {suggerimenti.length > 0 && (
          <ul className="suggerimenti">
            {suggerimenti.map((c) => (
              <li key={c.id}>
                <button className="sec" onClick={() => aggiungi(c.id)}>
                  {c.comparto}
                  <small>{c.societa} · {NOME_FORMA[c.forma]} · {catInfo(c.categoria).nome}</small>
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
        {scelti.length >= MAX && <p className="nota">Massimo {MAX} fondi: toglierne uno per aggiungerne altri.</p>}
      </section>

      {confronto.length > 0 && (
        <section className="card">
          <h3>Confronto affiancato</h3>
          <div className="affianca" style={{ gridTemplateColumns: `repeat(${confronto.length}, minmax(0,1fr))` }}>
            {confronto.map((c) => (
              <div key={c.id} className={'colonna' + (isAlleata(c) ? ' alleata' : '')}>
                <b>{c.comparto}</b>
                <small>{c.societa}</small>
                <CatBadge cat={c.categoria} />
                {anniOpz.map((a) => (
                  <div key={a} className="riga">
                    <span>{a}a</span>
                    <span>{pct(valore(c, { tipo: modo, anni: a } as Metrica))}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h3>{filtrati.length} comparti · {etichetta} {anni} anni</h3>
        {filtrati.length === 0 && <p className="nota">Nessun comparto con questi filtri.</p>}
        {raggruppa ? (
          gruppi.map((g) => (
            <div key={g.k.id} className="gruppo" style={{ borderColor: g.k.colore }}>
              <div className="gtesta" style={{ background: g.k.sfondo, color: g.k.colore }}>
                <b>{g.k.nome}</b>
                <span>{g.l.length} comparti · media {pct(g.m.media)}</span>
              </div>
              <table><tbody>{g.l.map(riga)}</tbody></table>
            </div>
          ))
        ) : (
          <table><tbody>{filtrati.map(riga)}</tbody></table>
        )}
        <p className="nota">Spunta i comparti per aggiungerli al confronto (massimo {MAX}).</p>
      </section>
    </>
  );
}

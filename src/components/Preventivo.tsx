import { useEffect, useMemo, useRef, useState } from 'react';
import type { DatasetCovip } from '../data/tipi';
import { ALLEATA, DA_VERIFICARE, FONTE_ALLEATA, PRUDENZA } from '../config/alleata';
import { calcolaPreventivo, lordoDaNetto, validaInput, type InputPreventivo } from '../lib/preventivo';
import { carica, salva, cancella, numero } from '../lib/archivio';
import { lineaAlleata, valore } from '../lib/stats';
import { eur, pct, dataIt } from '../lib/formati';
import { AVVISO_LEGALE } from './Avvisi';

type Fondo = '' | 'g' | 'b' | 'a' | 'mix' | 'eta' | 'libera';
type Periodo = '3' | '5' | '10' | '20';
const PERIODI: Periodo[] = ['3', '5', '10', '20'];
interface Stato {
  eta: string; etaPensione: string; premio: string;
  tipo: '' | 'dip' | 'aut' | 'forf'; netto: string; mensilita: '' | '13' | '14' | '15'; lordoForf: string;
  fondo: Fondo; periodo: '' | Periodo; libera: string; mixG: string; mixB: string; mixA: string;
  annoAdesione: string;
  tfr: boolean; datore: string; datoreUnita: '%' | '€'; dip: string; dipUnita: '%' | '€';
  pre2006: string; dal2007: string; trasf: string;
}
const VUOTO: Stato = {
  eta: '', etaPensione: '', premio: '', tipo: '', netto: '', mensilita: '', lordoForf: '',
  fondo: '', periodo: '', libera: '', mixG: '', mixB: '', mixA: '', annoAdesione: '',
  tfr: false, datore: '', datoreUnita: '%', dip: '', dipUnita: '%', pre2006: '', dal2007: '', trasf: '',
};

export function Preventivo({ dati }: { dati: DatasetCovip }) {
  const [s, setS] = useState<Stato>(() => {
    const salvato: Partial<Stato> & { autonomo?: boolean } = carica<Partial<Stato> & { autonomo?: boolean }>() ?? {};
    // Dati salvati da versioni precedenti: "autonomo" voleva dire forfettario.
    const tipo = salvato.tipo ?? (salvato.autonomo === true ? 'forf' : salvato.autonomo === false && salvato.netto ? 'dip' : '');
    return { ...VUOTO, ...salvato, tipo };
  });
  const autonomo = s.tipo === 'aut' || s.tipo === 'forf';
  const forfettario = s.tipo === 'forf';
  const [vedi, setVedi] = useState(false);
  const esito = useRef<HTMLDivElement>(null);
  const set = <K extends keyof Stato>(k: K, v: Stato[K]) => setS((p) => ({ ...p, [k]: v }));
  useEffect(() => {
    if (JSON.stringify(s) === JSON.stringify(VUOTO)) cancella();
    else salva(s);
  }, [s]);

  const annoCorrente = new Date().getFullYear();
  const tassiDi = (periodo: '' | Periodo) => {
    const r: Partial<Record<'g' | 'b' | 'a', number | null>> = {};
    const p = periodo ? (Number(periodo) as 3 | 5 | 10 | 20) : null;
    for (const k of ['g', 'b', 'a'] as const) {
      const c = dati.comparti.find((x) => lineaAlleata(x) === k);
      r[k] = c && p ? valore(c, { tipo: 'rend', anni: p }) : null;
    }
    return r;
  };
  const tassi = useMemo(() => tassiDi(s.periodo), [dati, s.periodo]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Rendimenti COVIP della scelta (linea, mix o percorso per età) per un periodo; null se manca anche un solo dato necessario. */
  const rateFondo = (fondo: Fondo, periodo: Periodo): Pick<InputPreventivo, 'rendimentoPct' | 'percorsoEta'> | null => {
    const t = tassiDi(periodo);
    if (fondo === 'g' || fondo === 'b' || fondo === 'a') return t[fondo] == null ? null : { rendimentoPct: t[fondo]! };
    if (fondo === 'eta') return t.g == null || t.b == null || t.a == null ? null : { rendimentoPct: 0, percorsoEta: { azionaria: t.a, bilanciata: t.b, garantita: t.g } };
    if (fondo === 'mix') {
      const w = { g: numero(s.mixG) ?? 0, b: numero(s.mixB) ?? 0, a: numero(s.mixA) ?? 0 };
      const somma = w.g + w.b + w.a;
      const necessarie = (['g', 'b', 'a'] as const).filter((k) => somma === 0 || w[k] > 0);
      if (necessarie.some((k) => t[k] == null)) return null;
      return { rendimentoPct: somma === 0 ? 0 : (['g', 'b', 'a'] as const).reduce((tot, k) => tot + (w[k] / 100) * (t[k] ?? 0), 0) };
    }
    return null;
  };
  const etaN = numero(s.eta);
  const pensN = numero(s.etaPensione);
  const orizzonte = etaN !== null && pensN !== null && pensN > etaN ? pensN - etaN : null;
  const disponibile = (p: Periodo) => !!s.fondo && s.fondo !== 'libera' && rateFondo(s.fondo, p) !== null;
  const piuLungo = [...PERIODI].reverse().find(disponibile) ?? null;
  const ristretto = orizzonte !== null && orizzonte > PRUDENZA.orizzonteOltreCuiSoloStoricoLungo;
  const consentito = (p: Periodo) => disponibile(p) && (!ristretto || p === piuLungo);
  const NOME_FONDO: Record<string, string> = { g: 'Alleata Garantita', b: 'Alleata Bilanciata', a: 'Alleata Azionaria', mix: 'Mix personalizzato', eta: 'Percorso per età', libera: 'Ipotesi libera' };

  const { input, errori } = useMemo(() => {
    const err: string[] = [];
    const num = (x: string) => numero(x);
    let rl: number | null = null;
    if (!s.tipo) err.push('Scegli il tipo di reddito: dipendente, autonomo o autonomo forfettario.');
    if (autonomo) rl = num(s.lordoForf);
    else {
      const n = num(s.netto);
      if (n !== null && s.mensilita) rl = lordoDaNetto(n * Number(s.mensilita));
    }
    if (rl === null && s.tipo) err.push(autonomo ? 'Inserisci il reddito lordo annuo.' : 'Inserisci stipendio netto mensile e scegli le mensilità.');

    let rend: Pick<InputPreventivo, 'rendimentoPct' | 'percorsoEta'> | null = null;
    if (!s.fondo) err.push('Scegli il fondo.');
    else if (s.fondo === 'libera') {
      const v = num(s.libera);
      rend = v === null ? null : { rendimentoPct: v };
    } else if (!s.periodo) err.push('Scegli il periodo storico del rendimento.');
    else {
      if (s.fondo === 'mix') {
        const somma = (num(s.mixG) ?? 0) + (num(s.mixB) ?? 0) + (num(s.mixA) ?? 0);
        if (Math.abs(somma - 100) > 0.01) err.push('Mix: le percentuali devono sommare 100%.');
      }
      if (!disponibile(s.periodo)) err.push('Rendimento COVIP non disponibile per questa scelta e questo periodo: scegli un altro periodo o l’ipotesi libera.');
      else if (ristretto && s.periodo !== piuLungo) err.push(`Con ${orizzonte} anni di versamenti usa il periodo storico più lungo disponibile (ultimi ${piuLungo} anni) o l’ipotesi libera.`);
      else rend = rateFondo(s.fondo, s.periodo);
    }
    const rlv = rl ?? 0;
    const conv = (v: string, u: '%' | '€') => (u === '%' ? num(v) ?? 0 : rlv > 0 ? ((num(v) ?? 0) * 12 * 100) / rlv : 0);
    const inp: Partial<InputPreventivo> = {
      eta: num(s.eta) ?? undefined, etaPensione: num(s.etaPensione) ?? undefined, premioAnnuo: num(s.premio) ?? undefined,
      redditoLordo: rl ?? undefined, forfettario, rendimentoPct: rend?.rendimentoPct, percorsoEta: rend?.percorsoEta,
      annoAdesione: num(s.annoAdesione) ?? undefined, annoCorrente,
      tfr: s.tfr && !autonomo ? { contributoDatorePct: conv(s.datore, s.datoreUnita), contributoDipendentePct: conv(s.dip, s.dipUnita), tfrPregresso2006: num(s.pre2006) ?? 0, tfrPregressoDal2007: num(s.dal2007) ?? 0, trasferimento: num(s.trasf) ?? 0 } : undefined,
    };
    const base = validaInput(inp).filter((m) => s.fondo === 'libera' || !m.startsWith('Rendimento annuo'));
    return { input: inp as InputPreventivo, errori: [...base, ...err] };
  }, [s, dati, annoCorrente]); // eslint-disable-line react-hooks/exhaustive-deps

  const pronto = errori.length === 0;
  const r = pronto ? calcolaPreventivo(input) : null;
  const campo = (k: keyof Stato, label: string, ph: string, extra?: React.ReactNode) => (
    <label className="campo">
      <span>{label}</span>
      <input inputMode="decimal" placeholder={ph} value={s[k] as string} onChange={(e) => set(k, e.target.value as never)} />
      {extra}
    </label>
  );
  const unita = (k: 'datoreUnita' | 'dipUnita') => (
    <div className="seg mini">
      {(['%', '€'] as const).map((u) => (
        <button key={u} className={s[k] === u ? 'on' : ''} onClick={() => set(k, u)}>{u === '€' ? '€/mese' : '%'}</button>
      ))}
    </div>
  );

  async function esporta(tipo: 'png' | 'pdf') {
    if (!esito.current) return;
    const html2canvas = (await import('html2canvas')).default;
    const cv = await html2canvas(esito.current, { scale: 2, backgroundColor: '#ffffff' });
    if (tipo === 'png') {
      const a = document.createElement('a');
      a.href = cv.toDataURL('image/png');
      a.download = 'preventivo-stima.png';
      a.click();
    } else {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth() - 40;
      const h = (cv.height * w) / cv.width;
      pdf.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', 20, 20, w, Math.min(h, pdf.internal.pageSize.getHeight() - 40));
      pdf.save('preventivo-stima.pdf');
    }
  }

  const rendimentoUsato = r ? (input.percorsoEta ? r.rendimentoEquivalentePct : input.rendimentoPct) : undefined;
  const conFondo = pronto && r && s.fondo !== 'libera' && s.periodo;
  /** Stesso periodo storico, linee diverse. */
  const scenariLinea = conFondo
    ? (['g', 'b', 'a', 'eta'] as const)
        .map((k) => ({ k, rate: rateFondo(k, s.periodo as Periodo) }))
        .filter((x) => x.rate !== null)
        .map((x) => {
          const q = calcolaPreventivo({ ...input, rendimentoPct: x.rate!.rendimentoPct, percorsoEta: x.rate!.percorsoEta });
          return { k: x.k, capitale: q.capitaleNetto, rendita: q.rendita };
        })
    : [];
  const intervallo = scenariLinea.length > 1 ? { min: Math.min(...scenariLinea.map((x) => x.capitale)), max: Math.max(...scenariLinea.map((x) => x.capitale)) } : null;
  /** Stessa scelta, periodi storici diversi: mostrato solo per orizzonti brevi (oltre il limite i periodi corti non sono ammessi). */
  const sensibilita =
    conFondo && !ristretto
      ? PERIODI.map((p) => ({ p, rate: rateFondo(s.fondo, p) }))
          .filter((x) => x.rate !== null)
          .map((x) => {
            const q = calcolaPreventivo({ ...input, rendimentoPct: x.rate!.rendimentoPct, percorsoEta: x.rate!.percorsoEta });
            return { p: x.p, rend: x.rate!.percorsoEta ? q.rendimentoEquivalentePct : x.rate!.rendimentoPct, capitale: q.capitaleNetto, rendita: q.rendita };
          })
      : [];
  const avvisoPeriodo =
    conFondo && r && r.anni > 2 * Number(s.periodo)
      ? `⚠️ Stai proiettando per ${r.anni} anni un rendimento medio degli ultimi ${s.periodo} anni: il risultato dipende molto dal periodo scelto e i rendimenti passati non garantiscono quelli futuri.`
      : '';
  return (
    <>
      <section className="card">
        <h3>1 · Dati personali</h3>
        <div className="griglia">
          {campo('eta', 'Età attuale', 'anni')}
          {campo('etaPensione', 'Età di pensione', 'anni')}
          {campo('premio', 'Premio annuo (€)', 'importo')}
          {campo('annoAdesione', 'Anno di prima adesione a una forma pensionistica', 'es. anno')}
        </div>
        <div className="seg" role="group" aria-label="Tipo di reddito">
          <button className={s.tipo === 'dip' ? 'on' : ''} onClick={() => set('tipo', 'dip')}>Dipendente</button>
          <button className={s.tipo === 'aut' ? 'on' : ''} onClick={() => set('tipo', 'aut')}>Autonomo</button>
          <button className={s.tipo === 'forf' ? 'on' : ''} onClick={() => set('tipo', 'forf')}>Autonomo forfettario</button>
        </div>
        {forfettario && <p className="nota">Regime forfettario: come nella pagina Alleata, nessun risparmio fiscale e nessuna imposta finale sulle prestazioni. ⚠️ DA VERIFICARE.</p>}
        {s.tipo === 'aut' && <p className="nota">Autonomo in regime ordinario: il risparmio fiscale si calcola sul reddito che indichi, con l’IRPEF e l’addizionale della pagina Alleata (senza TFR).</p>}
        {autonomo ? (
          <div className="griglia">{campo('lordoForf', 'Reddito annuo lordo (€)', 'importo')}</div>
        ) : s.tipo === 'dip' ? (
          <>
            <div className="griglia">{campo('netto', 'Stipendio netto mensile (€)', 'importo')}</div>
            <div className="seg" role="group" aria-label="Mensilità">
              {(['13', '14', '15'] as const).map((m) => (
                <button key={m} className={s.mensilita === m ? 'on' : ''} onClick={() => set('mensilita', m)}>{m} mensilità</button>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="card">
        <h3>2 · Fondo e rendimento</h3>
        <label className="campo">
          <span>Fondo</span>
          <select value={s.fondo} onChange={(e) => set('fondo', e.target.value as Fondo)} aria-label="Fondo">
            <option value="">Scegli…</option>
            <option value="g">Alleata Garantita</option>
            <option value="b">Alleata Bilanciata</option>
            <option value="a">Alleata Azionaria</option>
            <option value="mix">Mix personalizzato</option>
            <option value="eta">Percorso per età (Azionaria → Bilanciata → Garantita)</option>
            <option value="libera">Ipotesi libera di rendimento</option>
          </select>
        </label>
        {s.fondo === 'libera' ? (
          <div className="griglia">{campo('libera', 'Rendimento annuo ipotizzato (%)', 'es. numero')}</div>
        ) : s.fondo ? (
          <>
            <p className="nota">Rendimento storico COVIP della linea Alleata (storico, non previsione): scegli il periodo.</p>
            <label className="campo">
              <span>Periodo storico del rendimento</span>
              <select value={s.periodo} onChange={(e) => set('periodo', e.target.value as Stato['periodo'])} aria-label="Periodo storico">
                <option value="">Scegli…</option>
                {PERIODI.filter((p) => p !== '20' || disponibile(p)).map((p) => (
                  <option key={p} value={p} disabled={!consentito(p)}>
                    Ultimi {p} anni{!disponibile(p) ? ' (dato non disponibile)' : ristretto && p !== piuLungo ? ' (troppo breve per questo orizzonte)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {ristretto && piuLungo && (
              <p className="nota">Con più di {PRUDENZA.orizzonteOltreCuiSoloStoricoLungo} anni di versamenti si può usare solo il periodo storico più lungo disponibile (ultimi {piuLungo} anni): è una scelta di prudenza dell’app, per non estendere a lungo termine la media di pochi anni.</p>
            )}
            {s.fondo === 'eta' && (
              <p className="nota">Percorso per età (come nella pagina Alleata): linea Azionaria fino a {ALLEATA.percorsoEta.sogliaBilanciata - 1} anni, Bilanciata da {ALLEATA.percorsoEta.sogliaBilanciata} a {ALLEATA.percorsoEta.sogliaGarantita - 1}, Garantita da {ALLEATA.percorsoEta.sogliaGarantita}.</p>
            )}
            {s.fondo === 'mix' && (
              <div className="griglia tre">
                {campo('mixG', 'Garantita %', '0-100')}
                {campo('mixB', 'Bilanciata %', '0-100')}
                {campo('mixA', 'Azionaria %', '0-100')}
              </div>
            )}
            <p className="nota">
              [Dato COVIP · Storico] {dati.file['PIP:rend'] ? `PIP, dati al ${dataIt(dati.file['PIP:rend'].aggiornatoAl)}${s.periodo && dati.file['PIP:rend'].periodi?.[Number(s.periodo)] ? `, periodo ${dati.file['PIP:rend'].periodi![Number(s.periodo)]}` : dati.file['PIP:rend'].periodo ? `, periodo ${dataIt(dati.file['PIP:rend'].periodo.dal)}–${dataIt(dati.file['PIP:rend'].periodo.al)}` : ''}: ` : '(file rendimenti PIP non caricato) '}{(['g', 'b', 'a'] as const).map((k) => `${{ g: 'Garantita', b: 'Bilanciata', a: 'Azionaria' }[k]} ${tassi[k] == null ? 'n.d.' : pct(tassi[k] as number)}`).join(' · ')}
            </p>
          </>
        ) : null}
      </section>

      {s.tipo === 'dip' && (
        <section className="card">
          <label className="check"><input type="checkbox" checked={s.tfr} onChange={(e) => set('tfr', e.target.checked)} /> Includi TFR e contributi del datore</label>
          {s.tfr && (
            <>
              <p className="nota">TFR maturando = RAL × {pct(ALLEATA.tfrQuota * 100)} (parametro della pagina Alleata).</p>
              <div className="griglia">
                {campo('datore', 'Contributo datoriale', 'valore', unita('datoreUnita'))}
                {campo('dip', 'Contributo dipendente', 'valore', unita('dipUnita'))}
                {campo('pre2006', 'TFR pregresso fino al 2006 (€)', 'importo')}
                {campo('dal2007', 'TFR pregresso dal 2007 · clausola di salvaguardia (€)', 'importo')}
                {campo('trasf', 'Trasferimento da altro fondo (€)', 'importo')}
              </div>
              <p className="warn">⚠️ DA VERIFICARE: la pagina non contiene regole specifiche per salvaguardia e trasferimento; sono trattati come importi iniziali.</p>
            </>
          )}
        </section>
      )}

      {!pronto ? (
        <section className="card">
          <h3>Per calcolare completa i dati</h3>
          <ul className="errori">{[...new Set(errori)].slice(0, 6).map((e) => <li key={e}>{e}</li>)}</ul>
        </section>
      ) : (
        r && (
          <section className="card" ref={esito}>
            <h3>Risultato · <span className="etichetta">STIMA</span></h3>
            <div className="riepilogo">
              <b>Dati inseriti</b>
              <span>Età {input.eta} → pensione a {input.etaPensione} anni ({r.anni} anni di versamenti)</span>
              <span>Premio annuo {eur(input.premioAnnuo)} · prima adesione nel {input.annoAdesione}</span>
              <span>
                {s.tipo === 'forf' ? 'Autonomo forfettario' : s.tipo === 'aut' ? 'Autonomo' : `Dipendente, netto ${numero(s.netto) ?? 0} €/mese × ${s.mensilita} mensilità`} → reddito lordo {eur(input.redditoLordo)}
              </span>
              <span>
                {NOME_FONDO[s.fondo]}: rendimento {s.fondo === 'eta' ? 'medio equivalente ' : ''}{pct(rendimentoUsato)} l’anno
                {s.fondo !== 'libera' && s.periodo ? ` (media COVIP ultimi ${s.periodo} anni${dati.file['PIP:rend']?.periodi?.[Number(s.periodo)] ? `, ${dati.file['PIP:rend'].periodi![Number(s.periodo)]}` : ''})` : ''}
                {input.percorsoEta ? ` · Azionaria ${pct(input.percorsoEta.azionaria)}, Bilanciata ${pct(input.percorsoEta.bilanciata)}, Garantita ${pct(input.percorsoEta.garantita)}` : ''}
              </span>
              {input.tfr && <span>Con TFR e contributi (datore {pct(input.tfr.contributoDatorePct)}, dipendente {pct(input.tfr.contributoDipendentePct)} della RAL)</span>}
            </div>
            {avvisoPeriodo && <p className="warn">{avvisoPeriodo}</p>}
            <div className="kpi"><span>Capitale finale netto</span><b>{eur(r.capitaleNetto)}</b>{intervallo && <small>tra le linee Alleata (stesso periodo): da {eur(intervallo.min)} a {eur(intervallo.max)}</small>}</div>
            <div className="kpi"><span>Rendita annua stimata ⚠️</span><b>{eur(r.rendita)}</b><small>{eur(r.rendita / 12)} al mese · netto ÷ {ALLEATA.anniRendita}</small></div>
            <div className="kpi"><span>Premi versati ({r.anni} anni)</span><b>{eur(r.premiVersati)}</b></div>
            <div className="kpi"><span>Risparmio fiscale totale</span><b>{eur(r.risparmioFiscaleTotale)}</b><small>{eur(r.risparmioFiscaleAnnuo)} l’anno</small></div>
            <div className="kpi"><span>Imposte finali</span><b>{eur(r.impostaFinale)}</b><small>aliquota {pct(r.aliquotaFinale * 100)}</small></div>
            <div className="barra" aria-label="Composizione">
              <i style={{ flex: Math.max(r.premiNettiDelFisco, 1), background: '#0b5fff' }} />
              <i style={{ flex: Math.max(r.rendimentoStimato, 1), background: '#f5a800' }} />
            </div>
            <p className="nota">
              <span className="pallino" style={{ background: '#0b5fff' }} /> Versamenti al netto del risparmio fiscale {eur(r.premiNettiDelFisco)} ·{' '}
              <span className="pallino" style={{ background: '#f5a800' }} /> Rendimento {eur(r.rendimentoStimato)}
            </p>
            {scenariLinea.length > 1 && (
              <>
                <h4>Confronto tra le linee · stesso periodo storico [Stima]</h4>
                <table>
                  <tbody>
                    {scenariLinea.map((x) => (
                      <tr key={x.k} className={x.k === s.fondo ? 'alleata' : ''}>
                        <td>{NOME_FONDO[x.k]}</td>
                        <td className="n">{eur(x.capitale)}</td>
                        <td className="n sub">{eur(x.rendita)}/anno</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {sensibilita.length > 1 && (
              <>
                <h4>Quanto cambia con il periodo storico [Stima]</h4>
                <table>
                  <tbody>
                    {sensibilita.map((x) => (
                      <tr key={x.p} className={x.p === s.periodo ? 'alleata' : ''}>
                        <td>Ultimi {x.p} anni ({pct(x.rend)}{s.fondo === 'eta' ? ' equiv.' : ''})</td>
                        <td className="n">{eur(x.capitale)}</td>
                        <td className="n sub">{eur(x.rendita)}/anno</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <h4>Ipotesi usate [Parametro del preventivo]</h4>
            <ul className="ipotesi">
              <li>Versione {ALLEATA.versione}, nessuna copertura; caricamento {pct(ALLEATA.caricamento * 100)} sui versamenti.</li>
              <li>
                {input.percorsoEta
                  ? `Percorso per età su ${r.anni} anni: rendimento che cambia con l’età (equivalente a ${pct(rendimentoUsato)} l’anno), con medie COVIP degli ultimi ${s.periodo} anni.`
                  : `Rendimento annuo ${pct(rendimentoUsato)} costante per ${r.anni} anni (${s.fondo === 'libera' ? 'ipotesi libera' : `${NOME_FONDO[s.fondo]}, media COVIP ultimi ${s.periodo} anni`}).`}
              </li>
              <li>Deducibilità fino a {eur(ALLEATA.maxDeducibile)}/anno · aliquota finale 15% con −0,30 pt/anno dopo il 15° anno, minimo 9%.</li>
              <li>Reddito lordo {eur(input.redditoLordo)} {forfettario ? '(forfettario: nessuna imposta finale né risparmio fiscale)' : autonomo ? '(reddito indicato)' : '(ricavato dal netto)'}.</li>
              <li>Fonte regole: pagina Alleata v{FONTE_ALLEATA.versionePagina}, letta il {FONTE_ALLEATA.dataLettura}.</li>
            </ul>
            <p className="avviso">{AVVISO_LEGALE}</p>
          </section>
        )
      )}

      {pronto && (
        <section className="card">
          <div className="filtri">
            <button onClick={() => void esporta('pdf')}>Esporta PDF</button>
            <button onClick={() => void esporta('png')}>Esporta immagine</button>
          </div>
        </section>
      )}

      <section className="card">
        <button className="sec" onClick={() => setVedi(!vedi)}>{vedi ? 'Nascondi' : 'Mostra'} parametri da verificare ⚠️</button>
        {vedi && <ul className="errori">{DA_VERIFICARE.map((d) => <li key={d}>⚠️ DA VERIFICARE · {d}</li>)}</ul>}
        <p className="nota">I dati inseriti restano salvati solo su questo dispositivo.</p>
        <button className="pericolo" onClick={() => { if (confirm('Cancellare tutti i dati inseriti su questo dispositivo?')) { cancella(); setS(VUOTO); } }}>Cancella i miei dati</button>
      </section>
    </>
  );
}

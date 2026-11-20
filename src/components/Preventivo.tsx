import { useEffect, useMemo, useRef, useState } from 'react';
import type { DatasetCovip } from '../data/tipi';
import { ALLEATA, DA_VERIFICARE, PRUDENZA } from '../config/alleata';
import { calcolaPreventivo, lordoDaNetto, validaInput, type InputPreventivo } from '../lib/preventivo';
import { RIFORMA_2026, NOTA_RIFORMA } from '../config/riforma2026';
import { Sezione } from './preventivo/Sezione';
import { Torta } from './preventivo/Torta';
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
  addizionale: string;
}
const VUOTO: Stato = {
  eta: '', etaPensione: '', premio: '', tipo: '', netto: '', mensilita: '', lordoForf: '',
  fondo: '', periodo: '', libera: '', mixG: '', mixB: '', mixA: '', annoAdesione: '',
  tfr: false, datore: '', datoreUnita: '%', dip: '', dipUnita: '%', pre2006: '', dal2007: '', trasf: '', addizionale: '',
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
  const [altre, setAltre] = useState(false);
  const [periodoStorico, setPeriodoStorico] = useState<Periodo>('5');
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
    const addN = num(s.addizionale);
    const addPct = addN !== null && addN >= 0 && addN <= 10 ? addN : undefined;
    if (s.addizionale.trim() !== '' && addPct === undefined) err.push('Addizionale: inserisci una percentuale tra 0 e 10.');
    let rl: number | null = null;
    if (!s.tipo) err.push('Scegli il tipo di reddito: dipendente, autonomo o autonomo forfettario.');
    if (autonomo) rl = num(s.lordoForf);
    else {
      const n = num(s.netto);
      if (n !== null && s.mensilita) rl = lordoDaNetto(n * Number(s.mensilita), addPct === undefined ? undefined : addPct / 100);
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
      annoAdesione: num(s.annoAdesione) ?? undefined, annoCorrente, addizionalePct: addPct,
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
    <select value={s[k]} onChange={(e) => set(k, e.target.value as '%' | '€')} aria-label="Unità del contributo">
      <option value="%">in % della RAL</option>
      <option value="€">in € al mese</option>
    </select>
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
  /** Rendimento adottato: quello della scelta fatta, mostrato appena disponibile. */
  const rendScelto = s.fondo === 'libera' ? (numero(s.libera) === null ? null : { rendimentoPct: numero(s.libera)! }) : s.fondo && s.periodo && consentito(s.periodo) ? rateFondo(s.fondo, s.periodo) : null;
  const periodoTesto = s.periodo ? dati.file['PIP:rend']?.periodi?.[Number(s.periodo)] : undefined;

  /** Storico dei rendimenti COVIP delle tre linee Alleata per il periodo scelto nella sezione. */
  const nStorico = Number(periodoStorico);
  const storico = (['g', 'b', 'a'] as const).map((k) => {
    const c = dati.comparti.find((x) => lineaAlleata(x) === k);
    const v = c ? valore(c, { tipo: 'rend', anni: nStorico as 3 | 5 | 10 | 20 }) : null;
    return { k, nome: NOME_FONDO[k], v, cumulato: v === null ? null : (Math.pow(1 + v / 100, nStorico) - 1) * 100 };
  });
  const periodoStoricoTesto = dati.file['PIP:rend']?.periodi?.[nStorico];

  const addUsata = input?.addizionalePct ?? ALLEATA.irpef.addizionale * 100;
  const dataOggi = new Date().toLocaleDateString('it-IT');
  const quotaTesto = r ? (r.capitale.quotaMassima === null ? 'verifica con il fondo' : `max ${r.capitale.quotaMassima}% in capitale`) : '';
  const costoNegativo = r ? Math.round(r.costoNettoAnnuo) < 0 : false;

  return (
    <>
      <Sezione titolo="Dati cliente" badge="input">
        <div className="dueCol">
          {campo('eta', 'Età attuale', 'anni')}
          {campo('etaPensione', 'Età pensione', 'anni')}
          {campo('premio', 'Premio annuo (€)', 'importo')}
          <label className="campo">
            <span>Tipo di reddito</span>
            <select value={s.tipo} onChange={(e) => set('tipo', e.target.value as Stato['tipo'])} aria-label="Tipo di reddito">
              <option value="">Scegli…</option>
              <option value="dip">Dipendente</option>
              <option value="aut">Autonomo (regime ordinario)</option>
              <option value="forf">Autonomo forfettario</option>
            </select>
          </label>
          {autonomo && campo('lordoForf', 'Reddito annuo lordo (€)', 'importo')}
          {s.tipo === 'dip' && (
            <>
              {campo('netto', 'Stipendio netto mensile (€)', 'importo')}
              <label className="campo">
                <span>Mensilità</span>
                <select value={s.mensilita} onChange={(e) => set('mensilita', e.target.value as Stato['mensilita'])} aria-label="Mensilità">
                  <option value="">Scegli…</option>
                  <option value="13">13 mensilità</option>
                  <option value="14">14 mensilità</option>
                  <option value="15">15 mensilità</option>
                </select>
              </label>
            </>
          )}
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
          {campo('annoAdesione', 'Anno 1° adesione (FP)', 'anno')}
        </div>
        {forfettario && <p className="nota">Regime forfettario: nessun risparmio fiscale e nessuna imposta finale sulle prestazioni. ⚠️ DA VERIFICARE.</p>}
        {s.tipo === 'aut' && <p className="nota">Autonomo in regime ordinario: il risparmio fiscale si calcola sul reddito che indichi, con IRPEF e addizionale (senza TFR).</p>}

        {s.fondo === 'libera' && <div className="dueCol">{campo('libera', 'Rendimento annuo ipotizzato (%)', 'numero')}</div>}
        {s.fondo && s.fondo !== 'libera' && (
          <>
            <label className="campo">
              <span>Periodo storico del rendimento (dato COVIP)</span>
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
              <p className="nota">Con più di {PRUDENZA.orizzonteOltreCuiSoloStoricoLungo} anni di versamenti si può usare solo il periodo storico più lungo disponibile (ultimi {piuLungo} anni): scelta di prudenza dell’app, per non estendere a lungo termine la media di pochi anni.</p>
            )}
            {s.fondo === 'eta' && (
              <p className="nota">Percorso per età: Azionaria fino a {ALLEATA.percorsoEta.sogliaBilanciata - 1} anni, Bilanciata da {ALLEATA.percorsoEta.sogliaBilanciata} a {ALLEATA.percorsoEta.sogliaGarantita - 1}, Garantita da {ALLEATA.percorsoEta.sogliaGarantita}.</p>
            )}
            {s.fondo === 'mix' && (
              <div className="griglia tre">
                {campo('mixG', 'Garantita %', '0-100')}
                {campo('mixB', 'Bilanciata %', '0-100')}
                {campo('mixA', 'Azionaria %', '0-100')}
              </div>
            )}
          </>
        )}

        <div className="riquadro">
          <b>Piano {ALLEATA.versione}</b> · nessuna copertura aggiuntiva · caricamento sui contributi: <b>{pct(ALLEATA.caricamento * 100)}</b>
        </div>
        <div className="riquadro verde">
          {rendScelto ? (
            <>
              <b>Rendimento medio adottato</b>:{' '}
              {rendScelto.percorsoEta
                ? `percorso per età, Azionaria ${pct(rendScelto.percorsoEta.azionaria)} · Bilanciata ${pct(rendScelto.percorsoEta.bilanciata)} · Garantita ${pct(rendScelto.percorsoEta.garantita)}`
                : `${pct(rendScelto.rendimentoPct)} l’anno`}
              {s.fondo !== 'libera' && s.periodo ? ` — netto, [Dato COVIP · Storico] ultimi ${s.periodo} anni${periodoTesto ? ` (${periodoTesto})` : ''}` : ' — ipotesi libera'}
            </>
          ) : (
            <>Rendimento medio adottato: scegli fondo e periodo storico, oppure l’ipotesi libera.</>
          )}
        </div>

        {s.tipo === 'dip' && (
          <>
            <label className="check riquadro" style={{ borderColor: '#e07a10', background: '#fff7ec' }}>
              <input type="checkbox" checked={s.tfr} onChange={(e) => set('tfr', e.target.checked)} /> Includi TFR e contributi del datore
            </label>
            {s.tfr && (
              <>
                <p className="nota">TFR maturando = RAL × {pct(ALLEATA.tfrQuota * 100)}.</p>
                <div className="griglia">
                  {campo('datore', 'Contributo datoriale', 'valore', unita('datoreUnita'))}
                  {campo('dip', 'Contributo dipendente', 'valore', unita('dipUnita'))}
                  {campo('pre2006', 'TFR pregresso fino al 2006 (€)', 'importo')}
                  {campo('dal2007', 'TFR pregresso dal 2007 · salvaguardia (€)', 'importo')}
                  {campo('trasf', 'Trasferimento da altro fondo (€)', 'importo')}
                </div>
                <p className="warn">⚠️ DA VERIFICARE: la pagina non contiene regole specifiche per salvaguardia e trasferimento; sono trattati come importi iniziali.</p>
              </>
            )}
          </>
        )}
        <div className="dueCol">{campo('addizionale', 'Addizionali IRPEF % (facoltativo)', `vuoto = ${pct(ALLEATA.irpef.addizionale * 100)}`)}</div>
      </Sezione>

      <div ref={esito}>
        <Sezione titolo="Risultati a scadenza" badge={r ? `${r.anni} anni` : 'da calcolare'}>
          {!pronto || !r ? (
            <>
              <p className="nota">Completa i dati per vedere il preventivo:</p>
              <ul className="errori">{[...new Set(errori)].slice(0, 6).map((e) => <li key={e}>{e}</li>)}</ul>
            </>
          ) : (
            <>
              <p className="nota"><span className="etichetta">STIMA</span> Valori indicativi, non una previsione.</p>
              {avvisoPeriodo && <p className="warn">{avvisoPeriodo}</p>}
              <div className="tiles">
                <div className="tile arancio">
                  <span>CAPITALE FINALE</span>
                  <b>{eur(r.capitaleLordo)}</b>
                  <em>netto {eur(r.capitaleNetto)}</em>
                  <small>tass. media sul versato {pct(r.aliquotaMediaSuVersatoPct)}</small>
                  <strong className="limite" title={r.capitale.renditaSu70 !== null ? `Rendita stimata sul 70% del montante: ${eur(r.capitale.renditaSu70)} l’anno (coefficiente ${pct(r.capitale.coefficiente! * 100)}, età corretta ${r.capitale.etaCorretta}); metà assegno sociale 2026: ${eur(r.capitale.soglia)}.` : `Età corretta ${r.capitale.etaCorretta}: fuori dalla tabella Alleata (50–89).`}>{quotaTesto}</strong>
                </div>
                <div className="tile verde">
                  <span>RENDITA ANNUA STIMATA ⚠️</span>
                  <b>{eur(r.rendita)}</b>
                  <em>{eur(r.rendita / 12)} / mese riv.</em>
                  <small>lorda {eur(r.capitaleLordo / ALLEATA.anniRendita)} l’anno · netto ÷ {ALLEATA.anniRendita}</small>
                </div>
                <div className="tile arancio">
                  <span>PREMI VERSATI</span>
                  <b>{eur(r.premiVersati)}</b>
                  <em>netti {eur(r.premiNettiDelFisco)}</em>
                </div>
                <div className="tile verde">
                  <span>RISPARMIO FISCALE TOTALE</span>
                  <b>{eur(r.risparmioFiscaleTotale)}</b>
                  <small>imposte finali {eur(r.impostaFinale)} (aliquota {pct(r.aliquotaFinale * 100)})</small>
                </div>
              </div>
              <p className="nota">
                Limite in capitale: {r.capitale.quotaMassima === 100 ? 'la rendita sul 70% del montante è inferiore alla metà dell’assegno sociale, quindi si può avere fino al 100% in capitale' : r.capitale.quotaMassima === 50 ? 'di norma al massimo il 50% in capitale' : 'non calcolabile per questa età'} ⚠️ DA VERIFICARE (regola e coefficienti non controllati sulle CGA).
              </p>

              <div className="vantaggio">
                <div>
                  <span className="t">Vantaggio fiscale ANNUO</span>
                  <small>premio + contributi (max deducibile {eur(ALLEATA.maxDeducibile)}/anno)</small>
                </div>
                <b className="v">{eur(r.risparmioFiscaleAnnuo)}</b>
              </div>

              <h4>Versamenti annui previsti</h4>
              <table className="tabVoci">
                <thead>
                  <tr><th>Voce</th><th className="n">€/anno</th><th className="n">€/mese</th></tr>
                </thead>
                <tbody>
                  {r.versamenti.premio > 0 && <tr><td>Premio volontario<small>versamento diretto a tua scelta</small></td><td className="n">{eur(r.versamenti.premio)}</td><td className="n">{eur(r.versamenti.premio / 12)}</td></tr>}
                  {r.versamenti.dipendente > 0 && <tr><td>Contributo dipendente<small>trattenuta in busta paga × 12</small></td><td className="n">{eur(r.versamenti.dipendente)}</td><td className="n">{eur(r.versamenti.dipendente / 12)}</td></tr>}
                  {r.versamenti.premio > 0 && r.versamenti.dipendente > 0 && <tr className="sub"><td>A carico aderente<small>totale che esce dalle tue tasche</small></td><td className="n">{eur(r.versamenti.aCaricoAderente)}</td><td className="n">{eur(r.versamenti.aCaricoAderente / 12)}</td></tr>}
                  {r.versamenti.tfrMaturando > 0 && <tr><td>TFR maturando<small>quota annua destinata al fondo</small></td><td className="n">{eur(r.versamenti.tfrMaturando)}</td><td className="n">{eur(r.versamenti.tfrMaturando / 12)}</td></tr>}
                  {r.versamenti.datore > 0 && <tr><td>Contributo datoriale<small>a carico azienda – non a tuo carico</small></td><td className="n">{eur(r.versamenti.datore)}</td><td className="n">{eur(r.versamenti.datore / 12)}</td></tr>}
                  <tr className="tot"><td>Versamenti annui (totale)</td><td className="n">{eur(r.versamenti.totale)}</td><td className="n">{eur(r.versamenti.totale / 12)}</td></tr>
                </tbody>
              </table>
              <div className={'costoNetto' + (costoNegativo ? ' neg' : '')}>
                <span>Costo netto annuo per te<small style={{ display: 'block', fontWeight: 400 }}>dopo il risparmio fiscale</small></span>
                <span>{costoNegativo ? '- ' : ''}{eur(Math.abs(r.costoNettoAnnuo))} / anno · {costoNegativo ? '- ' : ''}{eur(Math.abs(r.costoNettoAnnuo) / 12)} / mese</span>
              </div>

              <h4>Scaglioni IRPEF sul reddito {eur(input.redditoLordo)}</h4>
              <table className="tabVoci">
                <thead>
                  <tr><th>Scaglione</th><th className="n">IRPEF</th><th className="n">Addiz.</th><th className="n">Imponibile</th><th className="n">Imposta</th></tr>
                </thead>
                <tbody>
                  {r.scaglioni.map((x) => (
                    <tr key={x.fino}>
                      <td>{x.fino === Infinity ? `Oltre ${eur(x.precedente)}` : `Fino a ${eur(x.fino)}`}</td>
                      <td className="n">{pct(x.aliquotaIrpefPct)}</td>
                      <td className="n">{pct(x.addizionalePct)}</td>
                      <td className="n">{eur(x.imponibile)}</td>
                      <td className="n"><b>{eur(x.imposta)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="nota"><b>Aliquote:</b> media {pct(r.aliquotaMediaIrpefPct)}, marginale {pct(r.aliquotaMarginalePct)}, deduzione {pct(r.deduzionePct)} del premio. Addizionale {pct(addUsata)} {input.addizionalePct === undefined ? '(parametro ⚠️ DA VERIFICARE)' : '(indicata da te)'}.</p>

              {(scenariLinea.length > 1 || sensibilita.length > 1) && (
                <>
                  <button className="sec" onClick={() => setAltre(!altre)}>{altre ? 'Nascondi' : 'Mostra'} altre ipotesi a confronto</button>
                  {altre && (
                    <>
                      {intervallo && <p className="nota">Capitale netto tra le linee Alleata (stesso periodo): da {eur(intervallo.min)} a {eur(intervallo.max)}.</p>}
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
                    </>
                  )}
                </>
              )}
            </>
          )}
        </Sezione>

        {pronto && r && (
          <Sezione titolo="Composizione" badge="grafici">
            <div className="coppia">
              <div className="cardTorta">
                <h5>Tassazione finale del montante</h5>
                <Torta descrizione="Capitale netto e imposte" parti={[{ valore: r.capitaleNetto, colore: '#31b57a' }, { valore: r.impostaFinale, colore: '#e5534b' }]} />
                <div className="leg">
                  <div><span><i className="p" style={{ background: '#31b57a' }} />Netto</span><b>{eur(r.capitaleNetto)}</b></div>
                  <div><span><i className="p" style={{ background: '#e5534b' }} />Imposte</span><b>{eur(r.impostaFinale)}</b></div>
                </div>
                <small><b>Aliquota media sul versato: {pct(r.aliquotaMediaSuVersatoPct)}</b><br />aliquota nominale {pct(r.aliquotaFinale * 100)} · esclusi contributi oltre {eur(ALLEATA.maxDeducibile)}/anno e TFR pregresso fino al 2006</small>
              </div>
              <div className="cardTorta">
                <h5>Capitale finale netto: premi netti vs rendimento</h5>
                <Torta descrizione="Premi netti e rendimento" parti={[{ valore: r.premiNettiDelFisco, colore: '#4f8ef7' }, { valore: r.rendimentoStimato, colore: '#e0a030' }]} />
                <div className="leg">
                  <div><span><i className="p" style={{ background: '#4f8ef7' }} />Premi netti</span><b>{eur(r.premiNettiDelFisco)} ({pct(r.capitaleNetto > 0 ? (r.premiNettiDelFisco / r.capitaleNetto) * 100 : 0, 1)})</b></div>
                  <div><span><i className="p" style={{ background: '#e0a030' }} />Rendimento</span><b>{eur(r.rendimentoStimato)} ({pct(r.capitaleNetto > 0 ? (r.rendimentoStimato / r.capitaleNetto) * 100 : 0, 1)})</b></div>
                </div>
                <small><b>Rendimento annuo composto effettivo: {r.rendimentoEffettivoPct === null ? 'n.d.' : pct(r.rendimentoEffettivoPct)}</b><br />inclusi vantaggi fiscali e al netto di tutti i costi e della tassazione finale sul dedotto</small>
              </div>
            </div>
          </Sezione>
        )}

        {pronto && r && (
          <div className="piede">
            <p>{AVVISO_LEGALE}</p>
            <p>
              Ipotesi usate ({dataOggi}): {NOME_FONDO[s.fondo]}, rendimento annuo {s.fondo === 'eta' ? `medio equivalente ${pct(rendimentoUsato)}` : pct(rendimentoUsato)}
              {s.fondo !== 'libera' && s.periodo ? ` (media COVIP ultimi ${s.periodo} anni${periodoTesto ? `, ${periodoTesto}` : ''})` : ''}; età {input.eta} → {input.etaPensione}; premio {eur(input.premioAnnuo)}; reddito lordo {eur(input.redditoLordo)}
              {s.tipo === 'dip' ? ` (da stipendio netto ${numero(s.netto) ?? 0} € × ${s.mensilita})` : s.tipo === 'forf' ? ' (forfettario: nessuna imposta finale né risparmio fiscale)' : ' (autonomo)'}; adesione {input.annoAdesione}; addizionali {pct(addUsata)};
              {input.tfr ? ` con TFR (datore ${pct(input.tfr.contributoDatorePct)}, dipendente ${pct(input.tfr.contributoDipendentePct)} della RAL);` : ''} deducibilità massima {eur(ALLEATA.maxDeducibile)}/anno; imposta finale sulle prestazioni 15% ridotta di 0,30 punti/anno oltre il 15° (minimo 9%); caricamento {pct(ALLEATA.caricamento * 100)}.
            </p>
          </div>
        )}
      </div>

      {pronto && (
        <div className="filtri">
          <button onClick={() => void esporta('pdf')}>Esporta PDF</button>
          <button className="sec" onClick={() => void esporta('png')}>Esporta immagine</button>
        </div>
      )}

      <Sezione titolo="Storico rendimenti" badge="dati COVIP" apribile apertaDi={false}>
        <label className="campo">
          <span>Periodo</span>
          <select value={periodoStorico} onChange={(e) => setPeriodoStorico(e.target.value as Periodo)} aria-label="Periodo dello storico">
            {PERIODI.map((p) => (
              <option key={p} value={p}>Ultimi {p} anni</option>
            ))}
          </select>
        </label>
        <p className="warn">Rendimento storico, non previsione. [Dato COVIP · Storico] medie annue composte, nette di costi e tassazione dei rendimenti{periodoStoricoTesto ? `, periodo ${periodoStoricoTesto}` : ''}{dati.file['PIP:rend'] ? `, dati al ${dataIt(dati.file['PIP:rend'].aggiornatoAl)}` : ''}.</p>
        <table>
          <thead>
            <tr><th>Comparto</th><th className="n">Medio annuo</th><th className="n">Cumulato {nStorico} anni</th></tr>
          </thead>
          <tbody>
            {storico.map((x) => (
              <tr key={x.k} className={x.k === s.fondo ? 'alleata' : ''}>
                <td>{x.nome}</td>
                <td className="n">{x.v === null ? 'n.d.' : pct(x.v)}</td>
                <td className="n">{x.cumulato === null ? 'n.d.' : pct(x.cumulato)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="nota">Il cumulato è ricavato dalla media annua composta (stima). Dati mancanti sono segnati “n.d.”: nessuna stima.</p>
      </Sezione>

      <Sezione titolo="Opzioni con Riforma 2026" badge="Novità" tono="arancio" apribile apertaDi={false}>
        {RIFORMA_2026.map((g) => (
          <div key={g.gruppo}>
            <div className="gruppoOpz">{g.gruppo}</div>
            <div className="opzioni">
              {g.opzioni.map((o) => (
                <div className="opzione" key={o.titolo}>
                  <b>{o.titolo}</b>
                  <span className="tassa">{o.tassa}</span>
                  <small>{o.descrizione}</small>
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="piede">{NOTA_RIFORMA}</p>
        <p className="warn">⚠️ DA VERIFICARE: schede riassuntive non controllate sulle norme vigenti.</p>
      </Sezione>

      <section className="card">
        <button className="sec" onClick={() => setVedi(!vedi)}>{vedi ? 'Nascondi' : 'Mostra'} parametri da verificare ⚠️</button>
        {vedi && <ul className="errori">{DA_VERIFICARE.map((d) => <li key={d}>⚠️ DA VERIFICARE · {d}</li>)}</ul>}
        <p className="nota">I dati inseriti restano salvati solo su questo dispositivo.</p>
        <button className="pericolo" onClick={() => { if (confirm('Cancellare tutti i dati inseriti su questo dispositivo?')) { cancella(); setS(VUOTO); } }}>Cancella i miei dati</button>
      </section>
    </>
  );
}

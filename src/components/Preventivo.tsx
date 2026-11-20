import { useEffect, useMemo, useRef, useState } from 'react';
import type { DatasetCovip } from '../data/tipi';
import { ALLEATA, DA_VERIFICARE, PRUDENZA } from '../config/alleata';
import { analisiSensibilita, calcolaPreventivo, lordoDaNetto, premioPerRendita, validaInput, valoreInEuroDiOggi, type InputPreventivo } from '../lib/preventivo';
import { cancellaScenari, leggiScenari, scriviScenari, type ScenarioSalvato } from '../lib/scenari';
import { RIFORMA_2026, NOTA_RIFORMA } from '../config/riforma2026';
import { Sezione } from './preventivo/Sezione';
import { Torta } from './preventivo/Torta';
import { GraficoLinee } from './preventivo/GraficoLinee';
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
  addizionale: string; aumentoPremio: string; inflazione: string; obiettivo: string;
}
const VUOTO: Stato = {
  eta: '', etaPensione: '', premio: '', tipo: '', netto: '', mensilita: '', lordoForf: '',
  fondo: '', periodo: '', libera: '', mixG: '', mixB: '', mixA: '', annoAdesione: '',
  tfr: false, datore: '', datoreUnita: '%', dip: '', dipUnita: '%', pre2006: '', dal2007: '', trasf: '', addizionale: '', aumentoPremio: '', inflazione: '', obiettivo: '',
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
  const [avanzate, setAvanzate] = useState(false);
  const [nomeScenario, setNomeScenario] = useState('');
  const [scenari, setScenari] = useState<ScenarioSalvato[]>(leggiScenari);
  const [confrontati, setConfrontati] = useState<string[]>([]);
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
    const aumN = num(s.aumentoPremio);
    const aumPct = aumN !== null && aumN >= 0 && aumN <= 10 ? aumN : undefined;
    if (s.aumentoPremio.trim() !== '' && aumPct === undefined) err.push('Aumento annuo del premio: inserisci una percentuale tra 0 e 10.');
    const inflN = num(s.inflazione);
    if (s.inflazione.trim() !== '' && (inflN === null || inflN < 0 || inflN > 15)) err.push('Inflazione: inserisci una percentuale tra 0 e 15.');
    const obN = num(s.obiettivo);
    if (s.obiettivo.trim() !== '' && (obN === null || obN <= 0)) err.push('Rendita desiderata: inserisci un importo maggiore di zero.');
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
      annoAdesione: num(s.annoAdesione) ?? undefined, annoCorrente, addizionalePct: addPct, aumentoPremioPct: aumPct,
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
    const el = esito.current;
    if (!el) return;
    const html2canvas = (await import('html2canvas')).default;
    const SC = 2;
    const cv = await html2canvas(el, { scale: SC, backgroundColor: '#ffffff', windowWidth: 820 });
    if (tipo === 'png') {
      const a = document.createElement('a');
      a.href = cv.toDataURL('image/png');
      a.download = 'preventivo-stima.png';
      a.click();
      return;
    }
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const larg = pdf.internal.pageSize.getWidth() - 40;
    const alt = pdf.internal.pageSize.getHeight() - 40;
    const scala = larg / cv.width;
    const altPx = Math.floor(alt / scala);
    // Punti dove si può andare a capo senza tagliare un elemento: l'inizio di blocchi e titoli.
    const base = el.getBoundingClientRect().top;
    const stacchi = Array.from(el.querySelectorAll('.sezione, .tiles, .vantaggio, h4, table, .costoNetto, .coppia, .cardTorta, svg.grafico, .riquadro, .piede, p.nota'))
      .map((x) => Math.round((x.getBoundingClientRect().top - base) * SC))
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    let y = 0;
    for (let pag = 0; y < cv.height; pag++) {
      const limite = y + altPx;
      let fine = Math.min(cv.height, limite);
      if (limite < cv.height) {
        const adatti = stacchi.filter((v) => v > y + altPx * 0.4 && v <= limite);
        if (adatti.length) fine = adatti[adatti.length - 1];
      }
      const h = fine - y;
      const parte = document.createElement('canvas');
      parte.width = cv.width;
      parte.height = h;
      parte.getContext('2d')!.drawImage(cv, 0, y, cv.width, h, 0, 0, cv.width, h);
      if (pag > 0) pdf.addPage();
      pdf.addImage(parte.toDataURL('image/jpeg', 0.9), 'JPEG', 20, 20, larg, h * scala);
      y = fine;
    }
    pdf.save('preventivo-stima.pdf');
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
  const coloriLinea = { g: '#31b57a', b: '#4f8ef7', a: '#e08a3c' } as const;
  const grafStorico = storico
    .filter((x) => x.v !== null)
    .map((x) => ({ nome: x.nome, colore: coloriLinea[x.k], punti: Array.from({ length: nStorico + 1 }, (_, i) => 100 * Math.pow(1 + x.v! / 100, i)) }));

  const addUsata = input?.addizionalePct ?? ALLEATA.irpef.addizionale * 100;
  const inflN = numero(s.inflazione);
  const reale = r && inflN !== null && inflN >= 0 ? { capitale: valoreInEuroDiOggi(r.capitaleNetto, inflN, r.anni), rendita: valoreInEuroDiOggi(r.rendita, inflN, r.anni), inflazione: inflN } : null;
  const obiettivoN = numero(s.obiettivo);
  const premioObiettivo = pronto && r && obiettivoN !== null && obiettivoN > 0 ? premioPerRendita(input, obiettivoN) : undefined;
  const sensib = pronto && r ? analisiSensibilita(input) : [];
  const renditaCoeff = r && r.capitale.coefficiente !== null ? r.capitaleLordo * r.capitale.coefficiente : null;

  const salvaScenario = () => {
    if (!r) return;
    const nuovo: ScenarioSalvato = {
      id: Date.now().toString(36),
      nome: nomeScenario.trim() || `Preventivo del ${new Date().toLocaleDateString('it-IT')}`,
      salvatoIl: new Date().toISOString().slice(0, 10),
      stato: { ...s },
      sintesi: { eta: input.eta, etaPensione: input.etaPensione, anni: r.anni, premio: input.premioAnnuo, fondo: NOME_FONDO[s.fondo], rendimentoPct: rendimentoUsato ?? 0, capitaleLordo: r.capitaleLordo, capitaleNetto: r.capitaleNetto, rendita: r.rendita, premiVersati: r.premiVersati, risparmioFiscaleTotale: r.risparmioFiscaleTotale },
    };
    const l = [nuovo, ...scenari];
    setScenari(l);
    scriviScenari(l);
    setNomeScenario('');
  };
  const eliminaScenario = (id: string) => {
    const l = scenari.filter((x) => x.id !== id);
    setScenari(l);
    scriviScenari(l);
    setConfrontati((c) => c.filter((x) => x !== id));
  };
  const caricaScenario = (sc: ScenarioSalvato) => setS({ ...VUOTO, ...(sc.stato as Partial<Stato>) } as Stato);
  const confronto = confrontati.map((id) => scenari.find((x) => x.id === id)).filter((x): x is ScenarioSalvato => !!x);
  const scaricaCsv = () => {
    if (!r) return;
    const n2 = (v: number) => v.toFixed(2).replace('.', ',');
    const righe = [['Anno', 'Età', 'Premio', 'Versamenti cumulati', 'Capitale lordo'], ...r.serie.map((x) => [String(annoCorrente + x.anno), String(input.eta + x.anno), n2(x.premio), n2(x.versamenti), n2(x.capitale)])];
    const blob = new Blob(['\uFEFF' + righe.map((x) => x.join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'preventivo-anno-per-anno.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
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
        <button className="sec" onClick={() => setAvanzate(!avanzate)}>{avanzate ? 'Nascondi' : 'Mostra'} opzioni avanzate (facoltative)</button>
        {avanzate && (
          <>
            <div className="dueCol">
              {campo('addizionale', 'Addizionali IRPEF %', `vuoto = ${pct(ALLEATA.irpef.addizionale * 100)}`)}
              {campo('aumentoPremio', 'Aumento annuo del premio %', 'vuoto = 0')}
              {campo('inflazione', 'Inflazione annua % (euro di oggi)', 'vuoto = non usata')}
              {campo('obiettivo', 'Rendita netta desiderata (€/anno)', 'es. importo')}
            </div>
            <p className="nota">Opzioni facoltative: se lasci vuoto il calcolo resta quello base. L’inflazione e la rendita desiderata sono ipotesi tue, non dati.</p>
          </>
        )}
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

              {renditaCoeff !== null && (
                <p className="nota">
                  <b>Rendita da coefficiente di conversione</b> [Stima]: circa {eur(renditaCoeff)} l’anno lordi (capitale lordo × coefficiente {pct(r.capitale.coefficiente! * 100)} a età corretta {r.capitale.etaCorretta}), prima delle imposte. ⚠️ DA VERIFICARE sulle CGA. Alternativa alla stima semplificata “netto ÷ {ALLEATA.anniRendita}”.
                </p>
              )}
              {reale && (
                <div className="riquadro">
                  <b>In euro di oggi</b> (inflazione {pct(reale.inflazione)} l’anno, ipotesi tua): capitale netto <b>{eur(reale.capitale)}</b> · rendita <b>{eur(reale.rendita)}</b> l’anno.
                </div>
              )}
              {!forfettario && (
                <p className="nota">
                  {r.deducibilita.nonDedottiAnnui > 0
                    ? `⚠️ Dei contributi annui (${eur(r.deducibilita.contributiAnnui)}) la parte oltre ${eur(ALLEATA.maxDeducibile)}, cioè ${eur(r.deducibilita.nonDedottiAnnui)} l’anno, non è deducibile.`
                    : r.deducibilita.residuo > 0
                      ? `Margine di deducibilità: puoi ancora dedurre ${eur(r.deducibilita.residuo)} l’anno; con contributi fino a ${eur(ALLEATA.maxDeducibile)} il risparmio fiscale annuo sarebbe ${eur(r.deducibilita.risparmioSeResiduoUsato)} (ora ${eur(r.risparmioFiscaleAnnuo)}).`
                      : `Sfrutti per intero il limite di deducibilità di ${eur(ALLEATA.maxDeducibile)} l’anno.`}
                </p>
              )}

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
            <h4>Come cresce il capitale · {r.anni} anni [Stima]</h4>
            <GraficoLinee
              descrizione="Versamenti cumulati e capitale lordo anno per anno"
              formato="euro"
              etichetteX={r.serie.map((x) => `+${x.anno}`).map((t, i) => (i === 0 ? 'oggi' : t + ' anni'))}
              serie={[
                { nome: 'Versamenti cumulati', colore: '#4f8ef7', punti: r.serie.map((x) => x.versamenti) },
                { nome: 'Capitale lordo', colore: '#e0a030', punti: r.serie.map((x) => x.capitale) },
              ]}
            />
            <p className="nota">Il capitale cresce soprattutto negli ultimi anni perché il rendimento si calcola su una somma già accumulata. Proiezione al rendimento ipotizzato, non una previsione.</p>
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

      {pronto && r && (
        <Sezione titolo="Analisi avanzate" badge="obiettivo · e se…" apribile apertaDi={false}>
          <h4>Obiettivo di rendita</h4>
          {obiettivoN === null || obiettivoN <= 0 ? (
            <p className="nota">Inserisci la rendita netta annua che vorresti nelle “opzioni avanzate” dei Dati cliente: l’app calcola il premio annuo necessario.</p>
          ) : premioObiettivo === null ? (
            <p className="warn">Una rendita netta stimata di {eur(obiettivoN)} l’anno non è raggiungibile con questi dati nemmeno con premi di € 200.000 l’anno.</p>
          ) : (
            <div className="riquadro verde">
              Per una rendita netta stimata di <b>{eur(obiettivoN)}</b> l’anno servirebbe un premio annuo di circa <b>{eur(premioObiettivo ?? 0)}</b> ({eur((premioObiettivo ?? 0) / 12)} al mese), contro i {eur(input.premioAnnuo)} attuali. [Stima] stessa ipotesi di rendimento e stesse regole; rendita come “netto ÷ {ALLEATA.anniRendita}”.
            </div>
          )}

          <h4>E se… (analisi di sensibilità)</h4>
          <p className="nota">Cosa cambia al variare di una sola ipotesi. Non sono previsioni.</p>
          <table>
            <thead>
              <tr><th>Scenario</th><th className="n">Capitale netto</th><th className="n">Differenza</th></tr>
            </thead>
            <tbody>
              {sensib.map((x) => (
                <tr key={x.etichetta}>
                  <td>{x.etichetta}</td>
                  <td className="n">{eur(x.capitaleNetto)}</td>
                  <td className="n" style={{ color: x.differenza < 0 ? '#b42318' : '#0f8a55' }}>{x.differenza > 0 ? '+' : x.differenza < 0 ? '−' : ''}{eur(Math.abs(x.differenza))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4>Dettaglio anno per anno</h4>
          <div className="scroll" style={{ maxHeight: 280, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>Anno</th><th className="n">Età</th><th className="n">Premio</th><th className="n">Versato</th><th className="n">Capitale lordo</th></tr>
              </thead>
              <tbody>
                {r.serie.map((x) => (
                  <tr key={x.anno}>
                    <td>{x.anno === 0 ? 'oggi' : annoCorrente + x.anno}</td>
                    <td className="n">{input.eta + x.anno}</td>
                    <td className="n">{x.anno === 0 ? '—' : eur(x.premio)}</td>
                    <td className="n">{eur(x.versamenti)}</td>
                    <td className="n">{eur(x.capitale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="sec" onClick={scaricaCsv}>Scarica la tabella (CSV per Excel)</button>
        </Sezione>
      )}

      <Sezione titolo="Preventivi salvati" badge={`${scenari.length}`} apribile apertaDi={false}>
        <p className="nota">Salva i preventivi per ritrovarli e confrontarli. Restano solo su questo dispositivo, compreso il nome che scegli (ad esempio quello del cliente).</p>
        {pronto && r && (
          <div className="dueCol">
            <label className="campo">
              <span>Nome (facoltativo)</span>
              <input placeholder="es. Preventivo 1" value={nomeScenario} onChange={(e) => setNomeScenario(e.target.value)} />
            </label>
            <button onClick={salvaScenario} style={{ alignSelf: 'end' }}>Salva questo preventivo</button>
          </div>
        )}
        {!scenari.length && <p className="nota">Nessun preventivo salvato.</p>}
        <ul className="elenco">
          {scenari.map((x) => (
            <li key={x.id}>
              <b>{x.nome}</b>
              <small>{new Date(x.salvatoIl).toLocaleDateString('it-IT')} · {x.sintesi.fondo} · capitale netto {eur(x.sintesi.capitaleNetto)} · rendita {eur(x.sintesi.rendita)}/anno</small>
              <label className="check piccolo">
                <input type="checkbox" checked={confrontati.includes(x.id)} disabled={!confrontati.includes(x.id) && confrontati.length >= 3} onChange={(e) => setConfrontati((c) => (e.target.checked ? [...c, x.id] : c.filter((y) => y !== x.id)))} /> Confronta
              </label>
              <div className="azioni">
                <button className="sec" onClick={() => caricaScenario(x)}>Carica</button>
                <button className="sec" onClick={() => confirm('Eliminare questo preventivo salvato?') && eliminaScenario(x.id)}>Elimina</button>
              </div>
            </li>
          ))}
        </ul>
        {confronto.length >= 2 && (
          <>
            <h4>Confronto (massimo 3)</h4>
            <div className="scroll">
              <table>
                <thead>
                  <tr><th></th>{confronto.map((x) => <th key={x.id} className="n">{x.nome}</th>)}</tr>
                </thead>
                <tbody>
                  {([
                    ['Fondo', (x: ScenarioSalvato) => x.sintesi.fondo],
                    ['Rendimento annuo', (x: ScenarioSalvato) => pct(x.sintesi.rendimentoPct)],
                    ['Età → pensione', (x: ScenarioSalvato) => `${x.sintesi.eta} → ${x.sintesi.etaPensione}`],
                    ['Premio annuo', (x: ScenarioSalvato) => eur(x.sintesi.premio)],
                    ['Premi versati', (x: ScenarioSalvato) => eur(x.sintesi.premiVersati)],
                    ['Capitale lordo', (x: ScenarioSalvato) => eur(x.sintesi.capitaleLordo)],
                    ['Capitale netto', (x: ScenarioSalvato) => eur(x.sintesi.capitaleNetto)],
                    ['Rendita annua', (x: ScenarioSalvato) => eur(x.sintesi.rendita)],
                    ['Risparmio fiscale', (x: ScenarioSalvato) => eur(x.sintesi.risparmioFiscaleTotale)],
                  ] as const).map(([et, f]) => (
                    <tr key={et}>
                      <td>{et}</td>
                      {confronto.map((x) => <td key={x.id} className="n">{f(x)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Sezione>

      <Sezione titolo="Andamento e storico rendimenti" badge="dati COVIP" apribile apertaDi>
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
        {grafStorico.length > 0 && (
          <>
            <h4>Crescita di 100 € negli ultimi {nStorico} anni [Stima]</h4>
            <GraficoLinee
              descrizione="Crescita di 100 euro a rendimento medio annuo costante per le tre linee"
              formato="indice"
              etichetteX={Array.from({ length: nStorico + 1 }, (_, i) => (i === 0 ? (periodoStoricoTesto?.split('-')[0] ?? 'inizio') : i === nStorico ? (periodoStoricoTesto?.split('-').pop() ?? 'oggi') : ''))}
              serie={grafStorico}
            />
            <p className="warn">Ricostruzione a rendimento medio annuo costante (dato COVIP), non l’andamento reale anno per anno. Rendimento storico, non previsione.</p>
          </>
        )}
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
        <button className="pericolo" onClick={() => { if (confirm('Cancellare tutti i dati inseriti e i preventivi salvati su questo dispositivo?')) { cancella(); cancellaScenari(); setScenari([]); setConfrontati([]); setS(VUOTO); } }}>Cancella i miei dati</button>
      </section>
    </>
  );
}

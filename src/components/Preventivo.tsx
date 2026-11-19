import { useEffect, useMemo, useRef, useState } from 'react';
import type { DatasetCovip } from '../data/tipi';
import { ALLEATA, DA_VERIFICARE, FONTE_ALLEATA } from '../config/alleata';
import { calcolaPreventivo, lordoDaNetto, validaInput, type InputPreventivo } from '../lib/preventivo';
import { carica, salva, cancella, numero } from '../lib/archivio';
import { lineaAlleata, valore } from '../lib/stats';
import { eur, pct } from '../lib/formati';
import { AVVISO_LEGALE } from './Avvisi';

type Fondo = '' | 'g' | 'b' | 'a' | 'mix' | 'libera';
interface Stato {
  eta: string; etaPensione: string; premio: string;
  autonomo: boolean; netto: string; mensilita: '' | '13' | '14' | '15'; lordoForf: string;
  fondo: Fondo; periodo: '' | '3' | '5' | '10'; libera: string; mixG: string; mixB: string; mixA: string;
  annoAdesione: string;
  tfr: boolean; datore: string; datoreUnita: '%' | '€'; dip: string; dipUnita: '%' | '€';
  pre2006: string; dal2007: string; trasf: string;
}
const VUOTO: Stato = {
  eta: '', etaPensione: '', premio: '', autonomo: false, netto: '', mensilita: '', lordoForf: '',
  fondo: '', periodo: '', libera: '', mixG: '', mixB: '', mixA: '', annoAdesione: '',
  tfr: false, datore: '', datoreUnita: '%', dip: '', dipUnita: '%', pre2006: '', dal2007: '', trasf: '',
};

export function Preventivo({ dati }: { dati: DatasetCovip }) {
  const [s, setS] = useState<Stato>(() => ({ ...VUOTO, ...(carica<Stato>() ?? {}) }));
  const [vedi, setVedi] = useState(false);
  const esito = useRef<HTMLDivElement>(null);
  const set = <K extends keyof Stato>(k: K, v: Stato[K]) => setS((p) => ({ ...p, [k]: v }));
  useEffect(() => {
    if (JSON.stringify(s) === JSON.stringify(VUOTO)) cancella();
    else salva(s);
  }, [s]);

  const annoCorrente = new Date().getFullYear();
  const tassi = useMemo(() => {
    const r: Partial<Record<'g' | 'b' | 'a', number | null>> = {};
    const p = s.periodo ? (Number(s.periodo) as 3 | 5 | 10) : null;
    for (const k of ['g', 'b', 'a'] as const) {
      const c = dati.comparti.find((x) => lineaAlleata(x) === k);
      r[k] = c && p ? valore(c, { tipo: 'rend', anni: p }) : null;
    }
    return r;
  }, [dati, s.periodo]);

  const { input, errori } = useMemo(() => {
    const err: string[] = [];
    const num = (x: string) => numero(x);
    let rl: number | null = null;
    if (s.autonomo) rl = num(s.lordoForf);
    else {
      const n = num(s.netto);
      if (n !== null && s.mensilita) rl = lordoDaNetto(n * Number(s.mensilita));
    }
    if (rl === null) err.push(s.autonomo ? 'Inserisci il reddito lordo forfettario.' : 'Inserisci stipendio netto mensile e scegli le mensilità.');

    let rend: number | null = null;
    if (!s.fondo) err.push('Scegli il fondo.');
    else if (s.fondo === 'libera') rend = num(s.libera);
    else {
      if (!s.periodo) err.push('Scegli il periodo storico (3, 5 o 10 anni).');
      else if (s.fondo === 'mix') {
        const w = { g: num(s.mixG) ?? 0, b: num(s.mixB) ?? 0, a: num(s.mixA) ?? 0 };
        if (Math.abs(w.g + w.b + w.a - 100) > 0.01) err.push('Mix: le percentuali devono sommare 100%.');
        else if ((['g', 'b', 'a'] as const).some((k) => w[k] > 0 && tassi[k] == null)) err.push('Mix: manca il rendimento COVIP di una linea scelta (dato non disponibile).');
        else rend = (['g', 'b', 'a'] as const).reduce((t, k) => t + (w[k] / 100) * (tassi[k] ?? 0), 0);
      } else if (tassi[s.fondo] == null) err.push('Rendimento COVIP di questa linea non disponibile: usa “ipotesi libera”.');
      else rend = tassi[s.fondo]!;
    }
    const rlv = rl ?? 0;
    const conv = (v: string, u: '%' | '€') => (u === '%' ? num(v) ?? 0 : rlv > 0 ? ((num(v) ?? 0) * 12 * 100) / rlv : 0);
    const inp: Partial<InputPreventivo> = {
      eta: num(s.eta) ?? undefined, etaPensione: num(s.etaPensione) ?? undefined, premioAnnuo: num(s.premio) ?? undefined,
      redditoLordo: rl ?? undefined, forfettario: s.autonomo, rendimentoPct: rend ?? undefined,
      annoAdesione: num(s.annoAdesione) ?? undefined, annoCorrente,
      tfr: s.tfr && !s.autonomo ? { contributoDatorePct: conv(s.datore, s.datoreUnita), contributoDipendentePct: conv(s.dip, s.dipUnita), tfrPregresso2006: num(s.pre2006) ?? 0, tfrPregressoDal2007: num(s.dal2007) ?? 0, trasferimento: num(s.trasf) ?? 0 } : undefined,
    };
    return { input: inp as InputPreventivo, errori: [...validaInput(inp), ...err] };
  }, [s, tassi, annoCorrente]);

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
      pdf.addImage(cv.toDataURL('image/png'), 'PNG', 20, 20, w, Math.min(h, pdf.internal.pageSize.getHeight() - 40));
      pdf.save('preventivo-stima.pdf');
    }
  }

  const rendimentoUsato = input?.rendimentoPct;
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
          <button className={!s.autonomo ? 'on' : ''} onClick={() => set('autonomo', false)}>Dipendente</button>
          <button className={s.autonomo ? 'on' : ''} onClick={() => set('autonomo', true)}>Autonomo forfettario</button>
        </div>
        {s.autonomo ? (
          <div className="griglia">{campo('lordoForf', 'Reddito lordo annuo (€)', 'importo')}</div>
        ) : (
          <>
            <div className="griglia">{campo('netto', 'Stipendio netto mensile (€)', 'importo')}</div>
            <div className="seg" role="group" aria-label="Mensilità">
              {(['13', '14', '15'] as const).map((m) => (
                <button key={m} className={s.mensilita === m ? 'on' : ''} onClick={() => set('mensilita', m)}>{m} mensilità</button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h3>2 · Fondo e rendimento</h3>
        <div className="seg" role="group" aria-label="Fondo">
          {([['g', 'Garantita'], ['b', 'Bilanciata'], ['a', 'Azionaria'], ['mix', 'Mix'], ['libera', 'Ipotesi libera']] as const).map(([k, l]) => (
            <button key={k} className={s.fondo === k ? 'on' : ''} onClick={() => set('fondo', k)}>{l}</button>
          ))}
        </div>
        {s.fondo === 'libera' ? (
          <div className="griglia">{campo('libera', 'Rendimento annuo ipotizzato (%)', 'es. numero')}</div>
        ) : s.fondo ? (
          <>
            <p className="nota">Rendimento storico COVIP della linea Alleata (storico, non previsione): scegli il periodo.</p>
            <div className="seg">
              {(['3', '5', '10'] as const).map((p) => (
                <button key={p} className={s.periodo === p ? 'on' : ''} onClick={() => set('periodo', p)}>{p} anni</button>
              ))}
            </div>
            {s.fondo === 'mix' && (
              <div className="griglia tre">
                {campo('mixG', 'Garantita %', '0-100')}
                {campo('mixB', 'Bilanciata %', '0-100')}
                {campo('mixA', 'Azionaria %', '0-100')}
              </div>
            )}
            <p className="nota">
              Dati: {(['g', 'b', 'a'] as const).map((k) => `${{ g: 'Garantita', b: 'Bilanciata', a: 'Azionaria' }[k]} ${tassi[k] == null ? 'n.d.' : pct(tassi[k] as number)}`).join(' · ')}
            </p>
          </>
        ) : null}
      </section>

      {!s.autonomo && (
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
            <div className="kpi"><span>Capitale finale netto</span><b>{eur(r.capitaleNetto)}</b></div>
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
            <h4>Ipotesi usate [Parametro del preventivo]</h4>
            <ul className="ipotesi">
              <li>Versione {ALLEATA.versione}, nessuna copertura; caricamento {pct(ALLEATA.caricamento * 100)} sui versamenti.</li>
              <li>Rendimento annuo {pct(rendimentoUsato)} costante per {r.anni} anni ({s.fondo === 'libera' ? 'ipotesi libera' : `storico COVIP ${s.periodo} anni`}).</li>
              <li>Deducibilità fino a {eur(ALLEATA.maxDeducibile)}/anno · aliquota finale 15% con −0,30 pt/anno dopo il 15° anno, minimo 9%.</li>
              <li>Reddito lordo {eur(input.redditoLordo)} {s.autonomo ? '(forfettario: nessuna imposta finale né risparmio fiscale)' : '(ricavato dal netto)'}.</li>
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

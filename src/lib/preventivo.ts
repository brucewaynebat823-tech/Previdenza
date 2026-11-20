import { ALLEATA } from '../config/alleata';

export interface InputPreventivo {
  eta: number;
  etaPensione: number;
  premioAnnuo: number;
  /** Reddito annuo lordo (RAL) o reddito lordo del forfettario. */
  redditoLordo: number;
  forfettario: boolean;
  /** Rendimento annuo ipotizzato, in % (es. 4 = 4%). Non serve se si usa il percorso per età. */
  rendimentoPct: number;
  /** Percorso per età: rendimenti annui (in %) delle tre linee; ogni anno si usa quello della linea prevista per l'età. */
  percorsoEta?: { azionaria: number; bilanciata: number; garantita: number };
  /** Aumento annuo del premio (%), facoltativo: il premio dell'anno d è premio × (1 + aumento)^d. */
  aumentoPremioPct?: number;
  /** Addizionali regionali/comunali (%) da usare al posto di quella di default (opzionale). */
  addizionalePct?: number;
  /** Anno di prima adesione a una forma pensionistica (per l'aliquota finale). */
  annoAdesione: number;
  /** Anno corrente (parametro per rendere il calcolo testabile). */
  annoCorrente: number;
  tfr?: {
    contributoDatorePct: number;
    contributoDipendentePct: number;
    tfrPregresso2006: number;
    tfrPregressoDal2007: number;
    trasferimento: number;
  };
}

export interface RisultatoPreventivo {
  anni: number;
  capitaleLordo: number;
  capitaleNetto: number;
  impostaFinale: number;
  aliquotaFinale: number;
  rendita: number;
  premiVersati: number;
  risparmioFiscaleAnnuo: number;
  risparmioFiscaleTotale: number;
  premiNettiDelFisco: number;
  rendimentoStimato: number;
  versamentoAnnuoTotale: number;
  /** Rendimento annuo costante equivalente (media geometrica degli anni), in %. */
  rendimentoEquivalentePct: number;
  /** Versamenti annui previsti. */
  versamenti: { premio: number; dipendente: number; aCaricoAderente: number; tfrMaturando: number; datore: number; totale: number };
  /** Costo netto annuo a carico dell'aderente (premio + contributo dipendente − risparmio fiscale annuo). */
  costoNettoAnnuo: number;
  /** Imposta finale / totale versato (esclusi contributi oltre il limite e TFR fino al 2006), in %. */
  aliquotaMediaSuVersatoPct: number;
  /** Aliquote IRPEF (con addizionale) sul reddito indicato, in %. */
  aliquotaMediaIrpefPct: number;
  aliquotaMarginalePct: number;
  /** Risparmio fiscale annuo / premio, in %. */
  deduzionePct: number;
  scaglioni: SchedaScaglione[];
  /** Rendimento annuo composto effettivo, inclusi i vantaggi fiscali e al netto di costi e tassazione finale, in %. */
  rendimentoEffettivoPct: number | null;
  capitale: LimiteCapitale;
  /** Evoluzione anno per anno: versamenti cumulati e capitale lordo (anno 0 = oggi). */
  serie: { anno: number; premio: number; versamenti: number; capitale: number }[];
  /** Margine di deducibilità: contributi deducibili del primo anno e importo ancora deducibile fino al limite. */
  deducibilita: { contributiAnnui: number; dedotti: number; residuo: number; nonDedottiAnnui: number; risparmioSeResiduoUsato: number };
}

export interface SchedaScaglione {
  fino: number;
  precedente: number;
  aliquotaIrpefPct: number;
  addizionalePct: number;
  imponibile: number;
  imposta: number;
}

export interface LimiteCapitale {
  /** 50 o 100 (% massima in capitale); null se non calcolabile (età fuori tabella). */
  quotaMassima: 50 | 100 | null;
  annoNascitaStimato: number;
  etaCorretta: number;
  coefficiente: number | null;
  renditaSu70: number | null;
  soglia: number;
}

/** Rendimento (%) del percorso per età all'età indicata. */
export function tassoPercorso(p: NonNullable<InputPreventivo['percorsoEta']>, eta: number): number {
  const { sogliaBilanciata, sogliaGarantita } = ALLEATA.percorsoEta;
  return eta < sogliaBilanciata ? p.azionaria : eta < sogliaGarantita ? p.bilanciata : p.garantita;
}

const addDi = (add?: number) => (add === undefined ? ALLEATA.irpef.addizionale : add);

export function irpef(imponibile: number, addizionale?: number): number {
  return scaglioniIrpef(imponibile, addizionale).reduce((t, r) => t + r.imposta, 0);
}

/** Dettaglio per scaglione, fino a quello che contiene l'imponibile (come la pagina Alleata). */
export function scaglioniIrpef(imponibile: number, addizionale?: number): SchedaScaglione[] {
  const add = addDi(addizionale);
  const righe: SchedaScaglione[] = [];
  let precedente = 0;
  for (const s of ALLEATA.irpef.scaglioni) {
    const parte = Math.max(0, Math.min(imponibile, s.fino) - precedente);
    righe.push({ fino: s.fino, precedente, aliquotaIrpefPct: s.aliquota * 100, addizionalePct: add * 100, imponibile: parte, imposta: parte * (s.aliquota + add) });
    if (imponibile <= s.fino) break;
    precedente = s.fino;
  }
  return righe;
}

/** Aliquota marginale (IRPEF + addizionale) sul reddito indicato, come frazione. */
export function aliquotaMarginale(imponibile: number, addizionale?: number): number {
  const add = addDi(addizionale);
  for (const s of ALLEATA.irpef.scaglioni) if (imponibile <= s.fino) return s.aliquota + add;
  return 0.4553;
}

export const nettoAnnuo = (lordo: number, addizionale?: number) => Math.max(0, lordo - irpef(lordo, addizionale));

/** Ricava il lordo dal netto annuo (bisezione, come la pagina). */
export function lordoDaNetto(nettoAnnuoVal: number, addizionale?: number): number {
  let a = 0;
  let b = 1e6;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    if (nettoAnnuo(m, addizionale) < nettoAnnuoVal) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

export function aliquotaFinale(anniAdesioneAllaFine: number): number {
  const t = ALLEATA.tassazioneFinale;
  return Math.max(t.minima, t.iniziale - t.riduzioneAnnua * Math.max(0, anniAdesioneAllaFine - t.annoInizioRiduzione));
}

export function validaInput(i: Partial<InputPreventivo>): string[] {
  const e: string[] = [];
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (!num(i.eta) || i.eta! < 18 || i.eta! > 80) e.push('Età attuale: inserisci un valore tra 18 e 80.');
  if (!num(i.etaPensione) || i.etaPensione! < 50 || i.etaPensione! > 90) e.push('Età di pensione: inserisci un valore tra 50 e 90.');
  if (num(i.eta) && num(i.etaPensione) && i.etaPensione! <= i.eta!) e.push("L'età di pensione deve essere maggiore dell'età attuale.");
  if (!num(i.premioAnnuo) || i.premioAnnuo! < 0 || i.premioAnnuo! > 200000) e.push('Premio annuo: inserisci un importo tra 0 e 200.000 €.');
  if (!num(i.redditoLordo) || i.redditoLordo! <= 0 || i.redditoLordo! > 1000000) e.push('Reddito lordo: inserisci un importo tra 1 e 1.000.000 €.');
  if (!i.percorsoEta && (!num(i.rendimentoPct) || i.rendimentoPct! < -10 || i.rendimentoPct! > 20)) e.push('Rendimento annuo: inserisci un valore tra -10% e 20%.');
  if (!num(i.annoAdesione) || i.annoAdesione! < 1990 || i.annoAdesione! > 2100) e.push("Anno di adesione: inserisci un anno valido (da 1990).");
  else if (num(i.annoCorrente) && i.annoAdesione! > i.annoCorrente!) e.push("L'anno di prima adesione non può essere successivo all'anno in corso.");
  return e;
}

/** Limite per la prestazione in capitale (regola della pagina Alleata, versione BASE). */
export function limiteCapitale(capitaleLordo: number, eta: number, etaPensione: number, annoCorrente: number): LimiteCapitale {
  const annoNascitaStimato = annoCorrente - Math.round(eta);
  const corr = ALLEATA.correzioneEtaPerNascita.find((x) => annoNascitaStimato <= x.finoAnno)?.correzione ?? ALLEATA.correzioneEtaAltrimenti;
  const etaCorretta = Math.round(etaPensione) + corr;
  const tabella = ALLEATA.coefficientiRenditaBase;
  const coefficiente = Number.isInteger(etaCorretta) && etaCorretta >= 50 && etaCorretta <= 49 + tabella.length ? tabella[etaCorretta - 50] : null;
  const { quotaMontanteInRendita, frazioneAssegnoSociale } = ALLEATA.limiteCapitale;
  const renditaSu70 = coefficiente === null ? null : capitaleLordo * quotaMontanteInRendita * coefficiente;
  const soglia = frazioneAssegnoSociale * ALLEATA.assegnoSociale;
  const calcolabile = renditaSu70 !== null && Number.isFinite(renditaSu70) && capitaleLordo > 0;
  return { quotaMassima: !calcolabile ? null : renditaSu70! < soglia ? 100 : 50, annoNascitaStimato, etaCorretta, coefficiente, renditaSu70, soglia };
}

/**
 * Rendimento annuo composto effettivo (IRR) sugli esborsi netti del vantaggio fiscale: un esborso all'inizio di ogni anno
 * (`esborsi[d]`), più l'importo iniziale, contro il capitale netto finale. Con esborsi costanti coincide con la formula della pagina Alleata. In %.
 */
export function rendimentoEffettivo(esborsi: number[], iniziale: number, capitaleNetto: number): number | null {
  const anni = esborsi.length;
  const tot = esborsi.reduce((a, b) => a + b, 0) + iniziale;
  if (anni <= 0 || tot <= 0 || capitaleNetto <= 0) return null;
  const valore = (t: number) => {
    let v = iniziale * (1 + t) ** anni;
    for (let d = 0; d < anni; d++) v += esborsi[d] * (1 + t) ** (anni - d);
    return v;
  };
  let lo = -0.99;
  let hi = 1;
  while (valore(hi) < capitaleNetto && hi < 10) hi *= 2;
  if (valore(hi) < capitaleNetto || valore(lo) > capitaleNetto) return null;
  for (let k = 0; k < 200; k++) {
    const m = (lo + hi) / 2;
    if (valore(m) < capitaleNetto) lo = m;
    else hi = m;
  }
  return ((lo + hi) / 2) * 100;
}

/** Calcolo del preventivo (versione BASE, senza coperture). Con aumento del premio a zero coincide con la funzione calc() della pagina Alleata. */
export function calcolaPreventivo(inp: InputPreventivo): RisultatoPreventivo {
  const A = ALLEATA;
  const r = (inp.rendimentoPct ?? 0) / 100;
  const anni = Math.max(0, inp.etaPensione - inp.eta);
  const usaTfr = !!inp.tfr && !inp.forfettario;
  const tfr = usaTfr ? inp.tfr! : undefined;
  const aum = (inp.aumentoPremioPct ?? 0) / 100;
  const add = inp.addizionalePct === undefined ? undefined : inp.addizionalePct / 100;

  const tfrMaturando = inp.redditoLordo * A.tfrQuota;
  const datoreAnnuo = tfr ? (inp.redditoLordo * tfr.contributoDatorePct) / 100 : 0;
  const dipendenteAnnuo = tfr ? (inp.redditoLordo * tfr.contributoDipendentePct) / 100 : 0;
  const pre2006 = tfr?.tfrPregresso2006 ?? 0;
  const dal2007 = tfr?.tfrPregressoDal2007 ?? 0;
  const trasf = tfr?.trasferimento ?? 0;
  const iniziale = pre2006 + dal2007 + trasf;
  const flussoTfr = tfr ? tfrMaturando + datoreAnnuo + dipendenteAnnuo : 0;
  const flussoTfrNetto = flussoTfr * (1 - A.caricamento);
  const tt = tfr ? datoreAnnuo + dipendenteAnnuo : 0;
  const premioDi = (d: number) => inp.premioAnnuo * (1 + aum) ** d;
  const risparmioDedotto = (ded: number) => (inp.forfettario ? 0 : irpef(inp.redditoLordo, add) - irpef(Math.max(0, inp.redditoLordo - ded), add));

  let P = 0;
  let C = iniziale;
  let fattore = 1;
  let versati = iniziale;
  let nonDedotto = 0;
  let risparmioTotale = 0;
  let premiTotali = 0;
  const esborsi: number[] = [];
  const serie: RisultatoPreventivo['serie'] = [{ anno: 0, premio: 0, versamenti: iniziale, capitale: iniziale }];
  for (let d = 0; d < anni; d++) {
    const premio = premioDi(d);
    const rd = inp.percorsoEta ? tassoPercorso(inp.percorsoEta, inp.eta + d) / 100 : r;
    fattore *= 1 + rd;
    P = (P + premio * (1 - A.caricamento)) * (1 + rd);
    C = tfr ? (C + flussoTfrNetto) * (1 + rd) : C * (1 + rd);
    const contributi = premio + tt;
    const dedotto = Math.min(contributi, A.maxDeducibile);
    nonDedotto += Math.max(0, contributi - dedotto);
    const risparmio = risparmioDedotto(dedotto);
    risparmioTotale += risparmio;
    premiTotali += premio;
    versati += premio + flussoTfr;
    esborsi.push(premio + flussoTfr - risparmio);
    serie.push({ anno: d + 1, premio, versamenti: versati, capitale: P + C });
  }
  const capitaleLordo = P + C;

  const annoFine = inp.annoCorrente + anni;
  const anniAdesione = Math.max(0, annoFine - inp.annoAdesione);
  const aliquota = inp.forfettario ? 0 : aliquotaFinale(anniAdesione);
  const quotaSeparata = pre2006 * fattore; // TFR fino al 2006: tassazione separata, fuori da questa base
  const impostaFinale = Math.max(0, capitaleLordo - nonDedotto - quotaSeparata) * aliquota;
  const capitaleNetto = capitaleLordo - impostaFinale;

  const contributiPrimoAnno = inp.premioAnnuo + tt;
  const dedottiPrimoAnno = Math.min(contributiPrimoAnno, A.maxDeducibile);
  const risparmioAnnuo = anni > 0 ? risparmioDedotto(dedottiPrimoAnno) : 0;
  const premiVersati = versati;
  const premiNetti = Math.max(0, premiVersati - risparmioTotale);

  const premio = inp.premioAnnuo;
  const aCarico = premio + (tfr ? dipendenteAnnuo : 0);
  const totaleAnnuo = premio + (tfr ? flussoTfr : 0);
  const baseImponibile = Math.max(0, premiVersati - nonDedotto - pre2006);

  return {
    anni,
    capitaleLordo,
    capitaleNetto,
    impostaFinale,
    aliquotaFinale: aliquota,
    rendita: capitaleNetto / A.anniRendita,
    premiVersati,
    risparmioFiscaleAnnuo: risparmioAnnuo,
    risparmioFiscaleTotale: risparmioTotale,
    premiNettiDelFisco: premiNetti,
    rendimentoStimato: Math.max(0, capitaleNetto - premiNetti),
    versamentoAnnuoTotale: totaleAnnuo,
    rendimentoEquivalentePct: anni > 0 ? (Math.pow(fattore, 1 / anni) - 1) * 100 : 0,
    versamenti: { premio, dipendente: tfr ? dipendenteAnnuo : 0, aCaricoAderente: aCarico, tfrMaturando: tfr ? tfrMaturando : 0, datore: tfr ? datoreAnnuo : 0, totale: totaleAnnuo },
    costoNettoAnnuo: aCarico - risparmioAnnuo,
    aliquotaMediaSuVersatoPct: premiVersati > 0 ? (aliquota * 100 * baseImponibile) / premiVersati : 0,
    aliquotaMediaIrpefPct: inp.redditoLordo > 0 ? (irpef(inp.redditoLordo, add) / inp.redditoLordo) * 100 : 0,
    aliquotaMarginalePct: aliquotaMarginale(inp.redditoLordo, add) * 100,
    deduzionePct: premio > 0 ? (risparmioAnnuo / premio) * 100 : 0,
    scaglioni: scaglioniIrpef(inp.redditoLordo, add),
    rendimentoEffettivoPct: rendimentoEffettivo(esborsi, iniziale, capitaleNetto),
    capitale: limiteCapitale(capitaleLordo, inp.eta, inp.etaPensione, inp.annoCorrente),
    serie,
    deducibilita: {
      contributiAnnui: contributiPrimoAnno,
      dedotti: dedottiPrimoAnno,
      residuo: Math.max(0, A.maxDeducibile - contributiPrimoAnno),
      nonDedottiAnnui: Math.max(0, contributiPrimoAnno - A.maxDeducibile),
      risparmioSeResiduoUsato: inp.forfettario ? 0 : risparmioDedotto(A.maxDeducibile),
    },
  };
}

/** Valore in euro di oggi di un importo futuro, data un'inflazione annua ipotizzata (%). */
export function valoreInEuroDiOggi(importo: number, inflazionePct: number, anni: number): number {
  return importo / (1 + inflazionePct / 100) ** anni;
}

/**
 * Premio annuo necessario per ottenere la rendita netta stimata desiderata (bisezione: la rendita cresce con il premio).
 * Restituisce null se non è raggiungibile con premi fino a 200.000 € l'anno.
 */
export function premioPerRendita(inp: InputPreventivo, renditaObiettivo: number): number | null {
  const rendita = (premio: number) => calcolaPreventivo({ ...inp, premioAnnuo: premio }).rendita;
  const MAX = 200000;
  if (renditaObiettivo <= rendita(0)) return 0;
  if (rendita(MAX) < renditaObiettivo) return null;
  let lo = 0;
  let hi = MAX;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (rendita(m) < renditaObiettivo) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

export interface ScenarioSensibilita {
  etichetta: string;
  capitaleNetto: number;
  differenza: number;
  rendita: number;
}

/** Analisi "e se…": rendimento ±1 e ±2 punti, pensione 2 anni prima/dopo, premio ±10%. Non sono previsioni. */
export function analisiSensibilita(inp: InputPreventivo): ScenarioSensibilita[] {
  const base = calcolaPreventivo(inp).capitaleNetto;
  const out: ScenarioSensibilita[] = [];
  const aggiungi = (etichetta: string, v: InputPreventivo) => {
    if (v.etaPensione <= v.eta) return;
    const q = calcolaPreventivo(v);
    out.push({ etichetta, capitaleNetto: q.capitaleNetto, differenza: q.capitaleNetto - base, rendita: q.rendita });
  };
  const conRend = (delta: number): InputPreventivo => ({
    ...inp,
    rendimentoPct: (inp.rendimentoPct ?? 0) + delta,
    percorsoEta: inp.percorsoEta ? { azionaria: inp.percorsoEta.azionaria + delta, bilanciata: inp.percorsoEta.bilanciata + delta, garantita: inp.percorsoEta.garantita + delta } : undefined,
  });
  for (const d of [-2, -1, 1, 2]) aggiungi(`Rendimento ${d > 0 ? '+' : '−'}${Math.abs(d)} ${Math.abs(d) === 1 ? 'punto' : 'punti'}`, conRend(d));
  aggiungi('Pensione 2 anni prima', { ...inp, etaPensione: inp.etaPensione - 2 });
  aggiungi('Pensione 2 anni dopo', { ...inp, etaPensione: inp.etaPensione + 2 });
  aggiungi('Premio −10%', { ...inp, premioAnnuo: inp.premioAnnuo * 0.9 });
  aggiungi('Premio +10%', { ...inp, premioAnnuo: inp.premioAnnuo * 1.1 });
  return out;
}

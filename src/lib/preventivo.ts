import { ALLEATA } from '../config/alleata';

export interface InputPreventivo {
  eta: number;
  etaPensione: number;
  premioAnnuo: number;
  /** Reddito annuo lordo (RAL) o reddito lordo del forfettario. */
  redditoLordo: number;
  forfettario: boolean;
  /** Rendimento annuo ipotizzato, in % (es. 4 = 4%). */
  rendimentoPct: number;
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
}

export function irpef(imponibile: number): number {
  const { scaglioni, addizionale } = ALLEATA.irpef;
  let precedente = 0;
  let totale = 0;
  for (const s of scaglioni) {
    const parte = Math.max(0, Math.min(imponibile, s.fino) - precedente);
    totale += parte * (s.aliquota + addizionale);
    if (imponibile <= s.fino) break;
    precedente = s.fino;
  }
  return totale;
}

export const nettoAnnuo = (lordo: number) => Math.max(0, lordo - irpef(lordo));

/** Ricava il lordo dal netto annuo (bisezione, come la pagina). */
export function lordoDaNetto(nettoAnnuoVal: number): number {
  let a = 0;
  let b = 1e6;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    if (nettoAnnuo(m) < nettoAnnuoVal) a = m;
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
  if (!num(i.rendimentoPct) || i.rendimentoPct! < -10 || i.rendimentoPct! > 20) e.push('Rendimento annuo: inserisci un valore tra -10% e 20%.');
  if (!num(i.annoAdesione) || i.annoAdesione! < 1990 || i.annoAdesione! > 2100) e.push("Anno di adesione: inserisci un anno valido (da 1990).");
  else if (num(i.annoCorrente) && i.annoAdesione! > i.annoCorrente!) e.push("L'anno di prima adesione non può essere successivo all'anno in corso.");
  return e;
}

/** Calcolo del preventivo, trascrizione della funzione calc() della pagina Alleata (BASE, senza coperture). */
export function calcolaPreventivo(inp: InputPreventivo): RisultatoPreventivo {
  const A = ALLEATA;
  const r = inp.rendimentoPct / 100;
  const anni = Math.max(0, inp.etaPensione - inp.eta);
  const usaTfr = !!inp.tfr && !inp.forfettario;
  const tfr = usaTfr ? inp.tfr! : undefined;

  const tfrMaturando = inp.redditoLordo * A.tfrQuota;
  const datoreAnnuo = tfr ? (inp.redditoLordo * tfr.contributoDatorePct) / 100 : 0;
  const dipendenteAnnuo = tfr ? (inp.redditoLordo * tfr.contributoDipendentePct) / 100 : 0;
  const pre2006 = tfr?.tfrPregresso2006 ?? 0;
  const dal2007 = tfr?.tfrPregressoDal2007 ?? 0;
  const trasf = tfr?.trasferimento ?? 0;
  const iniziale = pre2006 + dal2007 + trasf;
  const flussoTfr = tfr ? tfrMaturando + datoreAnnuo + dipendenteAnnuo : 0;

  const premioNetto = inp.premioAnnuo * (1 - A.caricamento);
  const flussoTfrNetto = flussoTfr * (1 - A.caricamento);

  let P = 0;
  let C = iniziale;
  let fattore = 1;
  for (let d = 0; d < anni; d++) {
    fattore *= 1 + r;
    P = (P + premioNetto) * (1 + r);
    C = tfr ? (C + flussoTfrNetto) * (1 + r) : C * (1 + r);
  }
  const capitaleLordo = P + C;

  const contributiDedotti = inp.premioAnnuo + (tfr ? datoreAnnuo + dipendenteAnnuo : 0);
  const dedotto = Math.min(contributiDedotti, A.maxDeducibile);
  const nonDedotto = Math.max(0, contributiDedotti - dedotto) * anni;
  const annoFine = inp.annoCorrente + anni;
  const anniAdesione = Math.max(0, annoFine - inp.annoAdesione);
  const aliquota = inp.forfettario ? 0 : aliquotaFinale(anniAdesione);
  const quotaSeparata = pre2006 * fattore; // TFR fino al 2006: tassazione separata, fuori da questa base
  const impostaFinale = Math.max(0, capitaleLordo - nonDedotto - quotaSeparata) * aliquota;
  const capitaleNetto = capitaleLordo - impostaFinale;

  const risparmioAnnuo = inp.forfettario ? 0 : irpef(inp.redditoLordo) - irpef(Math.max(0, inp.redditoLordo - dedotto));
  const risparmioTotale = risparmioAnnuo * anni;
  const premiVersati = (inp.premioAnnuo + (tfr ? flussoTfr : 0)) * anni + iniziale;
  const premiNetti = Math.max(0, premiVersati - risparmioTotale);

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
    versamentoAnnuoTotale: inp.premioAnnuo + (tfr ? flussoTfr : 0),
  };
}

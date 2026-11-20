import { describe, it, expect } from 'vitest';
import { calcolaPreventivo, irpef, lordoDaNetto, nettoAnnuo, aliquotaFinale, validaInput, type InputPreventivo } from './preventivo';

/**
 * Valori di riferimento: ottenuti il 19/11/2026 eseguendo la pagina originale
 * alleata.lovable.app/alleata.html (v26.11ai) in Chromium, versione BASE, nessuna copertura,
 * fondo "ipotesi libera". La pagina arrotonda all'euro: confrontiamo gli interi.
 */
const base = { annoCorrente: 2026, forfettario: false };
const casi: { nome: string; inp: InputPreventivo; atteso: Record<string, number> }[] = [
  {
    nome: '40→67, premio 3.000, RAL 40.000, 4%',
    inp: { ...base, eta: 40, etaPensione: 67, premioAnnuo: 3000, redditoLordo: 40000, rendimentoPct: 4, annoAdesione: 2026 },
    atteso: { capitaleLordo: 142496, capitaleNetto: 126251, rendita: 6313, premiVersati: 81000, risparmioFiscaleTotale: 28779, risparmioFiscaleAnnuo: 1066 },
  },
  {
    nome: '35→67, premio 6.000 (oltre il limite), RAL 60.000, 3,5%',
    inp: { ...base, eta: 35, etaPensione: 67, premioAnnuo: 6000, redditoLordo: 60000, rendimentoPct: 3.5, annoAdesione: 2026 },
    atteso: { capitaleLordo: 345366, capitaleNetto: 313392, rendita: 15670, premiVersati: 192000, risparmioFiscaleTotale: 77219, risparmioFiscaleAnnuo: 2413 },
  },
  {
    nome: '30→67, premio 8.000, RAL 90.000, 5% (aliquota minima 9%)',
    inp: { ...base, eta: 30, etaPensione: 67, premioAnnuo: 8000, redditoLordo: 90000, rendimentoPct: 5, annoAdesione: 2026 },
    atteso: { capitaleLordo: 828066, capitaleNetto: 762531, rendita: 38127, premiVersati: 296000, risparmioFiscaleTotale: 89284, risparmioFiscaleAnnuo: 2413 },
  },
  {
    nome: 'con TFR, contributi 2%+1%, pregresso 5.000/3.000, trasferimento 2.000',
    inp: {
      ...base, eta: 40, etaPensione: 67, premioAnnuo: 1000, redditoLordo: 40000, rendimentoPct: 4, annoAdesione: 2026,
      tfr: { contributoDatorePct: 2, contributoDipendentePct: 1, tfrPregresso2006: 5000, tfrPregressoDal2007: 3000, trasferimento: 2000 },
    },
    atteso: { capitaleLordo: 264617, capitaleNetto: 236094, rendita: 11805, premiVersati: 144028, risparmioFiscaleTotale: 21105, risparmioFiscaleAnnuo: 782 },
  },
  {
    // Pagina Alleata con "autonomo" spuntato e "forfettario" no: stesso calcolo del dipendente senza TFR.
    nome: 'autonomo (regime ordinario): risparmio fiscale come il dipendente',
    inp: { ...base, forfettario: false, eta: 45, etaPensione: 67, premioAnnuo: 5000, redditoLordo: 30000, rendimentoPct: 3, annoAdesione: 2020 },
    atteso: { capitaleLordo: 152546, capitaleNetto: 135614, rendita: 6781, premiVersati: 110000, risparmioFiscaleTotale: 32483, risparmioFiscaleAnnuo: 1477 },
  },
  {
    nome: 'forfettario, adesione 2020: nessuna imposta né risparmio fiscale',
    inp: { ...base, forfettario: true, eta: 45, etaPensione: 67, premioAnnuo: 5000, redditoLordo: 30000, rendimentoPct: 3, annoAdesione: 2020 },
    atteso: { capitaleLordo: 152546, capitaleNetto: 152546, rendita: 7627, premiVersati: 110000, risparmioFiscaleTotale: 0, risparmioFiscaleAnnuo: 0 },
  },
];

describe('preventivo vs pagina originale Alleata', () => {
  for (const c of casi) {
    it(c.nome, () => {
      const r = calcolaPreventivo(c.inp);
      for (const [k, v] of Object.entries(c.atteso)) {
        expect(Math.round(r[k as keyof typeof r] as number), k).toBe(v);
      }
    });
  }
});

describe('percorso per età vs pagina originale Alleata', () => {
  // Pagina v26.11ai, opzione "investment" (percorso per età) con RATES impostati a mano, versione BASE.
  it('32→67, premio 1.000, RAL 40.000, Az 4,62% / Bil 2,32% / Gar 1,5%', () => {
    const r = calcolaPreventivo({ ...base, eta: 32, etaPensione: 67, premioAnnuo: 1000, redditoLordo: 40000, rendimentoPct: 0, annoAdesione: 2026, percorsoEta: { azionaria: 4.62, bilanciata: 2.32, garantita: 1.5 } });
    expect(Math.round(r.capitaleLordo)).toBe(57918);
    expect(Math.round(r.capitaleNetto)).toBe(52705);
    expect(Math.round(r.rendita)).toBe(2635);
    expect(Math.round(r.risparmioFiscaleTotale)).toBe(12435);
  });
  it('45→67, premio 3.000, RAL 60.000, Az 5,81% / Bil 2,49% / Gar 1,36%', () => {
    const r = calcolaPreventivo({ ...base, eta: 45, etaPensione: 67, premioAnnuo: 3000, redditoLordo: 60000, rendimentoPct: 0, annoAdesione: 2026, percorsoEta: { azionaria: 5.81, bilanciata: 2.49, garantita: 1.36 } });
    expect(Math.round(r.capitaleLordo)).toBe(82525);
    expect(Math.round(r.capitaleNetto)).toBe(71879);
    expect(Math.round(r.rendita)).toBe(3594);
    expect(Math.round(r.risparmioFiscaleTotale)).toBe(30050);
  });
  it('rendimento equivalente: con tasso costante coincide con il tasso', () => {
    const r = calcolaPreventivo({ ...base, eta: 40, etaPensione: 67, premioAnnuo: 1000, redditoLordo: 40000, rendimentoPct: 4, annoAdesione: 2026 });
    expect(r.rendimentoEquivalentePct).toBeCloseTo(4, 6);
  });
  it('il percorso non richiede il rendimento costante', () => {
    expect(validaInput({ eta: 40, etaPensione: 67, premioAnnuo: 1000, redditoLordo: 30000, annoAdesione: 2026, annoCorrente: 2026, percorsoEta: { azionaria: 4, bilanciata: 3, garantita: 2 } })).toEqual([]);
  });
});

describe('voci aggiuntive vs pagina originale Alleata', () => {
  // Valori letti dalla pagina (v26.11ai, BASE, rendimento "custom") eseguita in Chromium il 20/11/2026.
  const casi = [
    { nome: 'dipendente 48→67, premio 5.300, RAL 34.000, 1,68%', inp: { eta: 48, etaPensione: 67, premioAnnuo: 5300, redditoLordo: 34000, rendimentoPct: 1.68, annoAdesione: 2026 }, att: { alMedia: '13.80', netto: 3417, marg: '35.53', irpefMedia: '27.29', ded: '35.53', irr: '4.15', quota: 100, premiNetti: 64921 } },
    { nome: 'con TFR', inp: { eta: 40, etaPensione: 67, premioAnnuo: 1000, redditoLordo: 40000, rendimentoPct: 4, annoAdesione: 2026, tfr: { contributoDatorePct: 2, contributoDipendentePct: 1, tfrPregresso2006: 5000, tfrPregressoDal2007: 3000, trasferimento: 2000 } }, att: { alMedia: '11.00', netto: 618, marg: '35.53', irpefMedia: '28.53', ded: '78.17', irr: '4.06', quota: 50, premiNetti: 122923 } },
    { nome: 'autonomo 45→67, premio 5.000, reddito 30.000, adesione 2020, 3%', inp: { eta: 45, etaPensione: 67, premioAnnuo: 5000, redditoLordo: 30000, rendimentoPct: 3, annoAdesione: 2020 }, att: { alMedia: '11.10', netto: 3524, marg: '35.53', irpefMedia: '26.20', ded: '29.53', irr: '4.61', quota: 50, premiNetti: 77517 } },
    { nome: 'reddito alto 90.000, 30→67, 5%', inp: { eta: 30, etaPensione: 67, premioAnnuo: 8000, redditoLordo: 90000, rendimentoPct: 5, annoAdesione: 2026 }, att: { alMedia: '5.96', netto: 5587, marg: '45.53', irpefMedia: '36.86', ded: '30.16', irr: '6.05', quota: 50, premiNetti: 206716 } },
    { nome: 'vicino alla pensione 60→67: 100% in capitale', inp: { eta: 60, etaPensione: 67, premioAnnuo: 2000, redditoLordo: 30000, rendimentoPct: 1, annoAdesione: 2026 }, att: { alMedia: '15.00', netto: 1289, marg: '35.53', irpefMedia: '26.20', ded: '35.53', irr: '7.16', quota: 100, premiNetti: 9026 } },
    { nome: 'forfettario', inp: { eta: 45, etaPensione: 67, premioAnnuo: 5000, redditoLordo: 30000, rendimentoPct: 3, annoAdesione: 2020, forfettario: true }, att: { alMedia: '0.00', netto: 5000, marg: '35.53', irpefMedia: '26.20', ded: '0.00', irr: '2.75', quota: 50, premiNetti: 110000 } },
  ];
  for (const c of casi) {
    it(c.nome, () => {
      const r = calcolaPreventivo({ ...base, forfettario: false, ...c.inp } as InputPreventivo);
      expect(r.aliquotaMediaSuVersatoPct.toFixed(2)).toBe(c.att.alMedia);
      expect(Math.round(r.costoNettoAnnuo)).toBe(c.att.netto);
      expect(r.aliquotaMarginalePct.toFixed(2)).toBe(c.att.marg);
      expect(r.aliquotaMediaIrpefPct.toFixed(2)).toBe(c.att.irpefMedia);
      expect(r.deduzionePct.toFixed(2)).toBe(c.att.ded);
      expect(r.rendimentoEffettivoPct?.toFixed(2)).toBe(c.att.irr);
      expect(r.capitale.quotaMassima).toBe(c.att.quota);
      expect(Math.round(r.premiNettiDelFisco)).toBe(c.att.premiNetti);
    });
  }
  it('versamenti annui previsti con TFR (come la tabella della pagina)', () => {
    const r = calcolaPreventivo({ ...base, ...casi[1].inp } as InputPreventivo);
    expect(Object.fromEntries(Object.entries(r.versamenti).map(([k, v]) => [k, Math.round(v)]))).toEqual({ premio: 1000, dipendente: 400, aCaricoAderente: 1400, tfrMaturando: 2764, datore: 800, totale: 4964 });
  });
  it('scaglioni IRPEF fino a quello del reddito, con addizionale', () => {
    const r = calcolaPreventivo({ ...base, ...casi[0].inp } as InputPreventivo);
    expect(r.scaglioni.map((x) => [Math.round(x.imponibile), Math.round(x.imposta)])).toEqual([[28000, 7148], [6000, 2132]]);
    expect(calcolaPreventivo({ ...base, ...casi[3].inp } as InputPreventivo).scaglioni).toHaveLength(3);
  });
  it('addizionale personalizzata: cambia imposte e risparmio fiscale', () => {
    const a = calcolaPreventivo({ ...base, ...casi[0].inp } as InputPreventivo);
    const b = calcolaPreventivo({ ...base, ...casi[0].inp, addizionalePct: 0 } as InputPreventivo);
    expect(b.risparmioFiscaleAnnuo).toBeLessThan(a.risparmioFiscaleAnnuo);
    expect(b.aliquotaMarginalePct.toFixed(2)).toBe('33.00');
  });
  it('limite in capitale: età corretta fuori tabella → non calcolabile', () => {
    const r = calcolaPreventivo({ ...base, eta: 30, etaPensione: 51, premioAnnuo: 1000, redditoLordo: 30000, rendimentoPct: 2, annoAdesione: 2026 });
    expect(r.capitale.etaCorretta).toBe(49);
    expect(r.capitale.quotaMassima).toBeNull();
  });
});

describe('regole di base', () => {
  it('aliquota finale: 15% fino al 15° anno, -0,30 pt/anno dopo, minimo 9%', () => {
    expect(aliquotaFinale(10)).toBeCloseTo(0.15);
    expect(aliquotaFinale(15)).toBeCloseTo(0.15);
    expect(aliquotaFinale(27)).toBeCloseTo(0.114);
    expect(aliquotaFinale(60)).toBeCloseTo(0.09);
  });
  it('IRPEF progressiva con addizionale 2,53%', () => {
    expect(irpef(28000)).toBeCloseTo(28000 * 0.2553);
    expect(irpef(50000)).toBeCloseTo(28000 * 0.2553 + 22000 * 0.3553);
  });
  it('lordoDaNetto è l’inverso di nettoAnnuo', () => {
    expect(nettoAnnuo(lordoDaNetto(30000))).toBeCloseTo(30000, 1);
  });
  it('la validazione blocca input incoerenti', () => {
    expect(validaInput({}).length).toBeGreaterThan(0);
    const ok = validaInput({ eta: 40, etaPensione: 67, premioAnnuo: 1000, redditoLordo: 30000, rendimentoPct: 3, annoAdesione: 2026 });
    expect(ok).toEqual([]);
    const base2 = { eta: 40, etaPensione: 67, premioAnnuo: 1000, redditoLordo: 30000, rendimentoPct: 3, annoCorrente: 2026 };
    expect(validaInput({ ...base2, annoAdesione: 2026 })).toEqual([]);
    expect(validaInput({ ...base2, annoAdesione: 2029 })).toContain("L'anno di prima adesione non può essere successivo all'anno in corso.");
    expect(validaInput({ eta: 60, etaPensione: 55, premioAnnuo: 1000, redditoLordo: 30000, rendimentoPct: 3, annoAdesione: 2026 })).toContain("L'età di pensione deve essere maggiore dell'età attuale.");
  });
});

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

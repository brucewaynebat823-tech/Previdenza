import { describe, it, expect } from 'vitest';
import { leggiSchede, linkSicuro } from './schede';

// Struttura del file COVIP dei fondi preesistenti, con dati INVENTATI.
const righe = [
  ['TipologiaFondo', 'DenominazioneFondo', 'NumeroIscrizioneAlboFondo', 'LinkSchedaCostiFondo'],
  ['FPP', 'FONDO PENSIONE UNO', 1001, 'https://esempio.it/costi.pdf'],
  ['FPP', 'FONDO PENSIONE DUE', 1002, 'javascript:alert(1)'],
  ['FPP', 'FONDO PENSIONE TRE', 1003, null],
  ['FPP', '', 1004, 'https://esempio.it/x.pdf'],
];

describe('elenco dei fondi preesistenti', () => {
  it('legge nome, Albo e link; scarta righe senza nome e link non web', () => {
    const f = leggiSchede(righe);
    expect(f).toEqual([
      { albo: 1001, nome: 'FONDO PENSIONE UNO', link: 'https://esempio.it/costi.pdf' },
      { albo: 1002, nome: 'FONDO PENSIONE DUE', link: '' },
      { albo: 1003, nome: 'FONDO PENSIONE TRE', link: '' },
    ]);
  });
  it('un file diverso viene rifiutato', () => {
    expect(() => leggiSchede([['A', 'B'], [1, 2]])).toThrow();
  });
  it('linkSicuro accetta solo http e https', () => {
    expect(linkSicuro('http://a.it/b')).toBe('http://a.it/b');
    expect(linkSicuro('ftp://a.it')).toBe('');
    expect(linkSicuro('javascript:alert(1)')).toBe('');
  });
});

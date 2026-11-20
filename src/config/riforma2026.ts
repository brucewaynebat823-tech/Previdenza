/**
 * Opzioni di anticipo, riscatto ed erogazione con la Riforma 2026, con la tassazione indicata.
 * FONTE: sezione "Opzioni con Riforma 2026" della pagina Alleata (v26.11ai, letta il 20/11/2026), che la presenta
 * come "sintesi divulgativa — D.Lgs. 252/2005 e Legge di Bilancio 2026". Testi ripresi dalla pagina.
 * ⚠️ DA VERIFICARE: non controllati sulle norme; "operatività al recepimento dei fondi secondo COVIP".
 */
export interface OpzioneRiforma {
  titolo: string;
  tassa: string;
  descrizione: string;
}
export const RIFORMA_2026: { gruppo: string; opzioni: OpzioneRiforma[] }[] = [
  {
    gruppo: 'Anticipi e riscatti',
    opzioni: [
      { titolo: '💶 Anticipo 30% dopo 8 anni', tassa: '23%', descrizione: 'Senza causale, libero utilizzo.' },
      { titolo: '🏥 Anticipo 75% spese sanitarie', tassa: '15→9%', descrizione: 'In qualsiasi momento, per sé, coniuge e figli.' },
      { titolo: '🏠 Anticipo 75% prima casa', tassa: '23%', descrizione: 'Acquisto o ristrutturazione, dopo 8 anni.' },
      { titolo: '⚡ Riscatto 100% cessazione attività', tassa: '23%', descrizione: 'Richiesta da effettuare quando inoccupato.' },
      { titolo: '📉 Riscatto 50% inoccupazione 12-48 mesi', tassa: '15→9%', descrizione: 'Quota parziale agevolata.' },
      { titolo: '♿ Riscatto 100% inoccupazione 48+ mesi', tassa: '15→9%', descrizione: 'Massima agevolazione fiscale.' },
    ],
  },
  {
    gruppo: 'Erogazioni flessibili',
    opzioni: [
      { titolo: '📅 RITA', tassa: '15→9%', descrizione: 'Fino a 5 anni prima della pensione (10 se disoccupato >24 mesi).' },
      { titolo: '⏱️ Rendita a durata definita', tassa: '15→9%', descrizione: 'Per un numero di anni prestabilito.' },
      { titolo: '🔔 Prelievi liberamente determinabili', tassa: '15→9%', descrizione: 'A chiamata, nei limiti delle rate maturate.' },
      { titolo: '📆 Erogazione frazionata', tassa: '20→15%', descrizione: 'Piano periodico per almeno 5 anni.' },
    ],
  },
];
export const NOTA_RIFORMA =
  'Sintesi divulgativa — D.Lgs. 252/2005 e Legge di Bilancio 2026. Aliquota 15→9% = riduzione 0,30%/anno oltre il 15° anno di adesione, minimo 9%. Operatività al recepimento dei fondi secondo COVIP.';

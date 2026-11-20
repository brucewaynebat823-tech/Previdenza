/**
 * Regole di calcolo del preventivo Alleata Previdenza.
 * FONTE: sorgente della pagina https://alleata.lovable.app/alleata.html?utm_id=97758_v0_s00_e0_tv4
 *        (versione app "26.11ai", letta il 19/11/2026). Nessun valore è inventato:
 *        ogni voce indica dove è stata trovata nella pagina.
 * Le voci con `verificare: true` NON sono confermate da fonte normativa/contrattuale
 * e vengono mostrate con "⚠️ DA VERIFICARE".
 */
export const FONTE_ALLEATA = {
  url: 'https://alleata.lovable.app/alleata.html?utm_id=97758_v0_s00_e0_tv4',
  versionePagina: '26.11ai',
  dataLettura: '2026-11-19',
} as const;

export const ALLEATA = {
  /** Versione usata: solo BASE, nessuna copertura invalidità (scelta dell'utente). */
  versione: 'BASE',
  /** Caricamento sui versamenti. Pagina: data-val="3" sul pulsante BASE (LTC = 4,5, non usato). */
  caricamento: 0.03,
  /** Quota TFR maturando sulla RAL. Pagina: PARAMS_ANNO.tfrQuota. */
  tfrQuota: 0.0691,
  /** Limite annuo di deducibilità. Pagina: PARAMS_ANNO.maxDed (norma citata: L. 199/2025). */
  maxDeducibile: 5300,
  /** Anno di riferimento dei parametri. Pagina: PARAMS_ANNO.anno. */
  annoParametri: 2026,
  /** Aliquota finale sulle prestazioni: 15% − 0,30 punti per ogni anno oltre il 15°, minimo 9%. */
  tassazioneFinale: { iniziale: 0.15, riduzioneAnnua: 0.003, annoInizioRiduzione: 15, minima: 0.09 },
  /** Scaglioni IRPEF usati dalla pagina (SCAGLIONI) più addizionale unica modificabile. */
  irpef: {
    scaglioni: [
      { fino: 28000, aliquota: 0.23 },
      { fino: 50000, aliquota: 0.33 },
      { fino: Infinity, aliquota: 0.43 },
    ],
    /** Addizionali regionali/comunali: PARAMS_ANNO.add = 2,53 (%) uguale su tutti gli scaglioni. */
    addizionale: 0.0253,
  },
  /**
   * "Percorso per età" della pagina (funzione investmentPlanningRate): linea Azionaria sotto i 50 anni,
   * Bilanciata da 50 a 59, Garantita da 60 in poi. Ogni anno si usa il rendimento della linea corrispondente all'età.
   */
  percorsoEta: { sogliaBilanciata: 50, sogliaGarantita: 60 },
  /** Assegno sociale annuo 2026. Pagina: PARAMS_ANNO.assegnoSociale (€ 7.101,12). */
  assegnoSociale: 7101.12,
  /**
   * Limite per la prestazione in capitale (funzione calc() della pagina): di norma al massimo il 50% in capitale; il 100%
   * se la rendita ricavata dal 70% del montante finale è inferiore alla metà dell'assegno sociale.
   */
  limiteCapitale: { quotaMontanteInRendita: 0.7, frazioneAssegnoSociale: 0.5 },
  /**
   * Coefficienti annui di conversione in rendita, versione BASE, per età corretta da 50 a 89 anni
   * (pagina: ALLEATA_RENDITA_BASE; tariffa per adesioni dal 24/07/2023). ⚠️ DA VERIFICARE sulle CGA.
   */
  coefficientiRenditaBase: [0.0254, 0.026, 0.0267, 0.0274, 0.0281, 0.0289, 0.0298, 0.0306, 0.0316, 0.0325, 0.0336, 0.0347, 0.0359, 0.0371, 0.0384, 0.0399, 0.0414, 0.043, 0.0448, 0.0466, 0.0486, 0.0508, 0.0532, 0.0557, 0.0585, 0.0616, 0.065, 0.0686, 0.0727, 0.0771, 0.0819, 0.0872, 0.0931, 0.0996, 0.1068, 0.1147, 0.1235, 0.1332, 0.1441, 0.1561],
  /** Correzione dell'età per anno di nascita (pagina: alleataAgeCorrection): fino al 1927 +3, 1939 +2, 1948 +1, 1960 0, 1970 −1, dopo −2. */
  correzioneEtaPerNascita: [
    { finoAnno: 1927, correzione: 3 },
    { finoAnno: 1939, correzione: 2 },
    { finoAnno: 1948, correzione: 1 },
    { finoAnno: 1960, correzione: 0 },
    { finoAnno: 1970, correzione: -1 },
  ],
  correzioneEtaAltrimenti: -2,
  /** La pagina stima la rendita come capitale netto ÷ 20 (nessun coefficiente di conversione). */
  anniRendita: 20,
  /** Con regime forfettario la pagina azzera imposta finale e risparmio fiscale. */
  forfettarioImpostaZero: true,
} as const;

/** Note mostrate accanto ai parametri da non considerare confermati. */
export const DA_VERIFICARE: string[] = [
  'Limite in capitale (50% / 100%): coefficienti di conversione in rendita, correzione per anno di nascita e assegno sociale 2026, da verificare sulle CGA.',
  'Autonomo forfettario: nessun risparmio fiscale e nessuna imposta finale; l’autonomo in regime ordinario ha lo stesso calcolo del dipendente, senza TFR. Da verificare sulla norma.',
  'Percorso per età (Azionaria sotto i 50 anni, Bilanciata 50–59, Garantita da 60): regola non verificata su documentazione.',
  'Limite di deducibilità € 5.300 (L. 199/2025): non verificato sulla norma.',
  'Rendita stimata = capitale netto ÷ 20: semplificazione, non è un calcolo attuariale.',
  'Reddito lordo ricavato dal netto con le sole aliquote IRPEF e addizionale, senza contributi INPS né detrazioni.',
  'Scaglioni IRPEF 2026 e addizionale 2,53%: non verificati.',
  'Clausola di salvaguardia e costi del trasferimento: nessuna regola di calcolo disponibile, sono trattati come importi iniziali.',
];

/**
 * Scelte di prudenza dell'APP (non regole della pagina Alleata):
 * oltre questo numero di anni di versamenti, per proiettare i rendimenti si può usare solo il periodo storico
 * COVIP più lungo disponibile, per non estendere a lungo termine medie di pochi anni.
 */
export const PRUDENZA = { orizzonteOltreCuiSoloStoricoLungo: 10 } as const;

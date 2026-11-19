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
  /** La pagina stima la rendita come capitale netto ÷ 20 (nessun coefficiente di conversione). */
  anniRendita: 20,
  /** Con regime forfettario la pagina azzera imposta finale e risparmio fiscale. */
  forfettarioImpostaZero: true,
} as const;

/** Note mostrate accanto ai parametri da non considerare confermati. */
export const DA_VERIFICARE: string[] = [
  'Percorso per età (Azionaria <50 anni, Bilanciata 50–59, Garantita da 60): ricavato dal codice della pagina Alleata, non da documentazione.',
  'Limite di deducibilità € 5.300 (L. 199/2025): citato dalla pagina Alleata, non verificato sulla norma.',
  'Rendita stimata = capitale netto ÷ 20: semplificazione della pagina, non è un calcolo attuariale.',
  'Reddito lordo ricavato dal netto con le sole aliquote IRPEF e addizionale (senza contributi INPS né detrazioni), come fa la pagina.',
  'Scaglioni IRPEF 2026 e addizionale 2,53%: ripresi dalla pagina, non verificati.',
  'Clausola di salvaguardia e costi del trasferimento: la pagina non contiene regole di calcolo.',
];

/**
 * Scelte di prudenza dell'APP (non regole della pagina Alleata):
 * oltre questo numero di anni di versamenti, per proiettare i rendimenti si può usare solo il periodo storico
 * COVIP più lungo disponibile, per non estendere a lungo termine medie di pochi anni.
 */
export const PRUDENZA = { orizzonteOltreCuiSoloStoricoLungo: 10 } as const;

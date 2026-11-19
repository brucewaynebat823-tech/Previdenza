import { useState } from 'react';
import { useCovip } from './data/useCovip';
import { Avviso } from './components/Avvisi';
import { Confronto } from './components/Confronto';
import { Combinata } from './components/Combinata';
import { Preventivo } from './components/Preventivo';
import { Dati } from './components/Dati';
import { SchedePreesistenti } from './components/SchedePreesistenti';
import { FORME_ALTRE, FORME_TUTTE, type FormaTipo } from './data/tipi';

const SCHEDE = [
  { id: 'costi', nome: 'Costi', icona: '💶', titolo: 'Confronto costi (ISC)' },
  { id: 'rend', nome: 'Rendimenti', icona: '📈', titolo: 'Confronto rendimenti' },
  { id: 'comb', nome: 'Costi + Rend.', icona: '⚖️', titolo: 'Costi e rendimenti insieme' },
  { id: 'prev', nome: 'Preventivo', icona: '🧮', titolo: 'Preventivo Alleata Previdenza' },
  { id: 'dati', nome: 'Dati', icona: '📂', titolo: 'Dati COVIP' },
] as const;
type Scheda = (typeof SCHEDE)[number]['id'];

type Gruppo = 'pip' | 'altre' | 'tutte';
const GRUPPI: Record<Gruppo, { nome: string; forme: FormaTipo[] }> = {
  pip: { nome: 'PIP', forme: ['PIP'] },
  altre: { nome: 'Altre forme', forme: FORME_ALTRE },
  tutte: { nome: 'Tutte', forme: FORME_TUTTE },
};

const ETICHETTA_GRUPPO: Record<Gruppo, string> = {
  pip: 'PIP (piani individuali pensionistici)',
  altre: 'Altre forme (fondi negoziali, aperti, preesistenti)',
  tutte: 'Tutte le forme',
};

function Scelta({ valore, opzioni, onCambia }: { valore: Gruppo; opzioni: Gruppo[]; onCambia: (g: Gruppo) => void }) {
  return (
    <label className="campo scelta">
      <span>Forme pensionistiche</span>
      <select value={valore} onChange={(e) => onCambia(e.target.value as Gruppo)} aria-label="Forme pensionistiche">
        {opzioni.map((g) => (
          <option key={g} value={g}>{ETICHETTA_GRUPPO[g]}</option>
        ))}
      </select>
    </label>
  );
}

export function App() {
  const [scheda, setScheda] = useState<Scheda>('costi');
  const [gCosti, setGCosti] = useState<Gruppo>('pip');
  const [gRend, setGRend] = useState<Gruppo>('pip');
  const { dati, avviso, importa, rimuovi, azzera, haDatiUtente } = useCovip();
  const vaiAiDati = () => setScheda('dati');
  const corrente = SCHEDE.find((s) => s.id === scheda)!;

  return (
    <div className="app">
      <header>
        <h1>{corrente.titolo}</h1>
      </header>
      <main>
        {scheda === 'costi' && (
          <>
            <Scelta valore={gCosti} opzioni={['pip', 'altre']} onCambia={setGCosti} />
            <Confronto key={'costi' + gCosti} dati={dati} forme={GRUPPI[gCosti].forme} confrontabili={gCosti === 'altre' ? FORME_TUTTE : undefined} modo="isc" vaiAiDati={vaiAiDati} />
            {gCosti === 'altre' && <SchedePreesistenti dati={dati} />}
          </>
        )}
        {scheda === 'rend' && (
          <>
            <Scelta valore={gRend} opzioni={['pip', 'altre', 'tutte']} onCambia={setGRend} />
            <Confronto key={'rend' + gRend} dati={dati} forme={GRUPPI[gRend].forme} confrontabili={gRend === 'altre' ? FORME_TUTTE : undefined} modo="rend" vaiAiDati={vaiAiDati} />
          </>
        )}
        {scheda === 'comb' && <Combinata dati={dati} vaiAiDati={vaiAiDati} />}
        {scheda === 'prev' && <Preventivo dati={dati} />}
        {scheda === 'dati' && <Dati dati={dati} avviso={avviso} onImporta={importa} onRimuovi={rimuovi} onAzzera={azzera} haDatiUtente={haDatiUtente} />}
        <Avviso />
      </main>
      <nav aria-label="Sezioni">
        {SCHEDE.map((s) => (
          <button key={s.id} className={scheda === s.id ? 'on' : ''} onClick={() => setScheda(s.id)} aria-current={scheda === s.id ? 'page' : undefined}>
            <span className="ico" aria-hidden="true">{s.icona}</span>
            {s.nome}
          </button>
        ))}
      </nav>
    </div>
  );
}

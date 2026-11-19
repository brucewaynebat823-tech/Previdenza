import { useState } from 'react';
import { useCovip } from './data/useCovip';
import { BannerCovip, Avviso } from './components/Avvisi';
import { Confronto } from './components/Confronto';
import { Combinata } from './components/Combinata';
import { Preventivo } from './components/Preventivo';

const SCHEDE = [
  { id: 'pip', nome: 'Costi PIP' },
  { id: 'altre', nome: 'Costi altre forme' },
  { id: 'rend', nome: 'Rendimenti' },
  { id: 'comb', nome: 'ISC + Rend.' },
  { id: 'prev', nome: 'Preventivo' },
] as const;
type Scheda = (typeof SCHEDE)[number]['id'];

export function App() {
  const [scheda, setScheda] = useState<Scheda>('pip');
  const { dati, stato, esito, ricarica } = useCovip();
  return (
    <div className="app">
      <header>
        <h1>Previdenza</h1>
        <button className="aggiorna" onClick={() => void ricarica()} disabled={stato === 'caricamento'}>
          {stato === 'caricamento' ? 'Aggiorno…' : 'Aggiorna dati'}
        </button>
      </header>
      <main>
        <BannerCovip dati={dati} />
        {esito && <p className="nota">{esito}</p>}
        {scheda === 'pip' && <Confronto key="pip" dati={dati} forme={['PIP']} modo="isc" />}
        {scheda === 'altre' && <Confronto key="altre" dati={dati} forme={['FPN', 'FPA', 'PREESISTENTE']} modo="isc" />}
        {scheda === 'rend' && <Confronto key="rend" dati={dati} forme={['PIP', 'FPN', 'FPA', 'PREESISTENTE']} modo="rend" />}
        {scheda === 'comb' && <Combinata dati={dati} />}
        {scheda === 'prev' && <Preventivo dati={dati} />}
        <Avviso />
      </main>
      <nav aria-label="Sezioni">
        {SCHEDE.map((s) => (
          <button key={s.id} className={scheda === s.id ? 'on' : ''} onClick={() => setScheda(s.id)}>
            {s.nome}
          </button>
        ))}
      </nav>
    </div>
  );
}

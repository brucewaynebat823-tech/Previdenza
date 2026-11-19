import { useState } from 'react';
import { useCovip } from './data/useCovip';
import { BannerCovip, Avviso } from './components/Avvisi';
import { Confronto } from './components/Confronto';
import { Combinata } from './components/Combinata';
import { Preventivo } from './components/Preventivo';
import { Importa } from './components/Importa';

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
  const { dati, stato, esito, ricarica, sostituisci, azzera } = useCovip();
  const [importa, setImporta] = useState(false);
  return (
    <div className="app">
      <header>
        <h1>Previdenza</h1>
        <button className="aggiorna" onClick={() => setImporta(true)}>
          Aggiorna dati
        </button>
      </header>
      <main>
        <BannerCovip dati={dati} />
        {esito && (
          <p className="nota">
            {esito}{' '}
            {dati.comparti.length > 0 && (
              <button className="link" onClick={() => confirm('Cancellare i dati COVIP importati su questo dispositivo?') && azzera()}>Cancella dati importati</button>
            )}
            {stato === 'errore' && <button className="link" onClick={() => void ricarica()}>Riprova</button>}
          </p>
        )}
        {scheda === 'pip' && <Confronto key="pip" dati={dati} forme={['PIP']} modo="isc" />}
        {scheda === 'altre' && <Confronto key="altre" dati={dati} forme={['FPN', 'FPA', 'PREESISTENTE']} modo="isc" />}
        {scheda === 'rend' && <Confronto key="rend" dati={dati} forme={['PIP', 'FPN', 'FPA', 'PREESISTENTE']} modo="rend" />}
        {scheda === 'comb' && <Combinata dati={dati} />}
        {scheda === 'prev' && <Preventivo dati={dati} />}
        <Avviso />
        {importa && <Importa dati={dati} onFatto={sostituisci} onChiudi={() => setImporta(false)} />}
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

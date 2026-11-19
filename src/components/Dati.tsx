import { useState } from 'react';
import { FORME_TUTTE, NOME_FORMA, chiaveFile, type Comparto, type DatasetCovip, type FileMeta, type FormaTipo, type TipoFile } from '../data/tipi';
import { dataIt } from '../lib/formati';
import { CaricaFile } from './CaricaFile';

interface Props {
  dati: DatasetCovip;
  avviso: string;
  onImporta: (forma: FormaTipo, tipo: TipoFile, nuovi: Comparto[], meta: Omit<FileMeta, 'forma' | 'tipo' | 'comparti' | 'caricatoIl'>) => void;
  onRimuovi: (forma: FormaTipo, tipo: TipoFile) => void;
  onAzzera: () => void;
}

export function Dati({ dati, avviso, onImporta, onRimuovi, onAzzera }: Props) {
  const [carica, setCarica] = useState<{ forma: FormaTipo; tipo: TipoFile } | null>(null);
  const totali = FORME_TUTTE.length * 2;
  const caricati = Object.keys(dati.file).length;

  const slot = (forma: FormaTipo, tipo: TipoFile) => {
    const m = dati.file[chiaveFile(forma, tipo)];
    return (
      <div className={'slot' + (m ? ' pieno' : '')} key={tipo}>
        <div>
          <b>{tipo === 'isc' ? 'Costi (ISC)' : 'Rendimenti'}</b>
          {m ? (
            <small>
              ✓ {m.comparti} comparti · dati al {dataIt(m.aggiornatoAl)}
              {m.periodo ? ` · periodo ${dataIt(m.periodo.dal)}–${dataIt(m.periodo.al)}` : ''}
            </small>
          ) : (
            <small>Da caricare</small>
          )}
        </div>
        <div className="azioni">
          <button className={m ? 'sec' : ''} onClick={() => setCarica({ forma, tipo })}>{m ? 'Sostituisci' : 'Carica'}</button>
          {m && (
            <button className="sec" aria-label={`Elimina ${tipo === 'isc' ? 'costi' : 'rendimenti'} ${NOME_FORMA[forma]}`} onClick={() => confirm('Eliminare questo file dal dispositivo?') && onRimuovi(forma, tipo)}>🗑</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="card">
        <h3>I tuoi dati COVIP</h3>
        <p className="nota">
          Scarica i file dal sito ufficiale <a href="https://www.covip.it/open-data" target="_blank" rel="noreferrer">covip.it/open-data</a> e caricali qui, uno per riquadro.
          Restano <b>salvati su questo dispositivo</b>: non devi ricaricarli ogni volta, solo quando COVIP pubblica nuovi dati.
        </p>
        <div className="progresso" aria-label={`${caricati} file su ${totali}`}>
          <i style={{ width: `${(caricati / totali) * 100}%` }} />
        </div>
        <p className="nota">{caricati} file caricati su {totali}. Per iniziare bastano i costi e i rendimenti dei PIP.</p>
        {avviso && <p className="warn">{avviso}</p>}
      </section>

      {FORME_TUTTE.map((f) => (
        <section className="card" key={f}>
          <h3>{NOME_FORMA[f]}{f === 'PREESISTENTE' ? ' (se disponibili)' : ''}</h3>
          {slot(f, 'isc')}
          {slot(f, 'rend')}
        </section>
      ))}

      <section className="card">
        <p className="nota">I dati restano solo su questo dispositivo.</p>
        {caricati > 0 && (
          <button className="pericolo" onClick={() => confirm('Cancellare tutti i dati COVIP caricati su questo dispositivo?') && onAzzera()}>Cancella tutti i dati caricati</button>
        )}
      </section>

      {carica && (
        <CaricaFile
          forma={carica.forma}
          tipo={carica.tipo}
          onImporta={(n, meta) => onImporta(carica.forma, carica.tipo, n, meta)}
          onChiudi={() => setCarica(null)}
        />
      )}
    </>
  );
}

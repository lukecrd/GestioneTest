import React, { useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { AssegnazioneTerritorio, IndirizzoTerritorio } from '../types';
import { TIPI_INDIRIZZO, STATI_INDIRIZZO, STATI_PERMANENTI, scadenzaTerritorio } from '../utils/territori';

interface SchedaTerritorioProps {
  cartina: { numero: string; nome: string; sezione: string; url: string };
  nota?: string;
  indirizzi: IndirizzoTerritorio[];
  aperta: AssegnazioneTerritorio | null;
  mesi: number;
  onChiudi: () => void;
}

type Quali = 'tutti' | 'non-visitare' | 'nessuno';
const TUTTE = '*tutte*'; // valore del menu porzioni per 'tutto il territorio'

const dataIt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

// Foglio da consegnare con il territorio: istruzioni e indirizzi, con la scelta di quali stampare.
export const SchedaTerritorio: React.FC<SchedaTerritorioProps> = ({ cartina, nota, indirizzi, aperta, mesi, onChiudi }) => {
  const [quali, setQuali] = useState<Quali>('tutti');
  const [porzione, setPorzione] = useState<string | null>(null); // null = tutte
  const porzioni = [...new Set(indirizzi.map(n => n.porzione || ''))];
  const elenco = (quali === 'nessuno' ? [] : quali === 'non-visitare' ? indirizzi.filter(n => STATI_PERMANENTI.includes(n.stato)) : indirizzi)
    .filter(n => porzione === null || (n.porzione || '') === porzione);
  const pdfAssoluto = new URL(cartina.url, window.location.href).href;

  return (
    <section className="space-y-5 animate-fadeIn">
      <div className="card no-print flex flex-wrap items-end gap-3">
        <button type="button" className="btn-ghost" onClick={onChiudi}>
          <ArrowLeft className="w-4 h-4" /> Torna ai territori
        </button>
        <div>
          <label className="lbl" htmlFor="scheda-quali">Indirizzi da stampare</label>
          <select id="scheda-quali" className="inp mt-1 w-auto" value={quali} onChange={e => setQuali(e.target.value as Quali)}>
            <option value="tutti">Tutti ({indirizzi.length})</option>
            <option value="non-visitare">Solo "Non visitare" e "Non avvicinarsi"</option>
            <option value="nessuno">Nessuno</option>
          </select>
        </div>
        {porzioni.length > 1 && (
          <div>
            <label className="lbl" htmlFor="scheda-porzione">Porzione</label>
            <select id="scheda-porzione" className="inp mt-1 w-auto" value={porzione ?? TUTTE} onChange={e => setPorzione(e.target.value === TUTTE ? null : e.target.value)}>
              <option value={TUTTE}>Tutto il territorio</option>
              {porzioni.map(p => <option key={p} value={p}>{p || 'Senza porzione'}</option>)}
            </select>
          </div>
        )}
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> Stampa
        </button>
      </div>

      <article className="card space-y-4 print:shadow-none print:border-0">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">
            Territorio {cartina.numero} · {cartina.nome}{porzione !== null ? ` · ${porzione ? 'porzione ' + porzione : 'senza porzione'}` : ''}
          </h1>
          <p className="text-slate-600">Sezione {cartina.sezione}</p>
          {aperta && (
            <p className="mt-1">
              Assegnato a <strong>{aperta.proclamatore || '---'}</strong> il {dataIt(aperta.assegnato)}; da riconsegnare entro il{' '}
              <strong>{dataIt(scadenzaTerritorio(aperta.assegnato, mesi))}</strong>.
            </p>
          )}
          <p className="text-sm text-slate-600 mt-1 break-all">Cartina: {pdfAssoluto}</p>
        </header>

        {nota && (
          <div>
            <h2 className="font-semibold text-slate-900">Istruzioni</h2>
            <p className="whitespace-pre-line">{nota}</p>
          </div>
        )}

        {quali !== 'nessuno' && (
          <div>
            <h2 className="font-semibold text-slate-900">
              {quali === 'tutti' ? 'Indirizzi' : 'Da non visitare'} ({elenco.length})
            </h2>
            {elenco.length === 0 ? (
              <p className="text-slate-600">Nessun indirizzo.</p>
            ) : (
              <table className="tbl mt-1">
                <thead>
                  <tr><th>Indirizzo</th><th>Tipo</th><th>Stato</th><th>Nota</th></tr>
                </thead>
                <tbody>
                  {elenco.map((n, i) => (
                    <React.Fragment key={n.id}>
                    {porzioni.length > 1 && porzione === null && (i === 0 || (n.porzione || '') !== (elenco[i - 1].porzione || '')) && (
                      <tr><th colSpan={4} className="text-left">{n.porzione ? 'Porzione ' + n.porzione : 'Senza porzione'}</th></tr>
                    )}
                    <tr>
                      <td className="font-semibold">{n.indirizzo}</td>
                      <td>{TIPI_INDIRIZZO[n.tipo]}</td>
                      <td className={STATI_PERMANENTI.includes(n.stato) ? 'font-bold' : ''}>{STATI_INDIRIZZO[n.stato]}</td>
                      <td>{n.nota ?? ''}</td>
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </article>
    </section>
  );
};

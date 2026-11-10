import React, { useEffect, useState } from 'react';
import { ascoltaLog, AzioneLog, SEZIONI_LOG, VoceLog } from '../lib/log';
import { ProfiloUtente } from '../lib/utenti';

const AZIONI: Record<AzioneLog, string> = { accesso: 'Accesso', modifica: 'Modifica', utenti: 'Gestione utenti' };

const quandoIt = (d: Date | null) =>
  d ? d.toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'in registrazione…';

export const LogView: React.FC<{ utenti: ProfiloUtente[] }> = ({ utenti }) => {
  const [voci, setVoci] = useState<VoceLog[] | null>(null);
  const [errore, setErrore] = useState('');
  const [chi, setChi] = useState('');
  const [azione, setAzione] = useState<'' | AzioneLog>('');
  useEffect(() => ascoltaLog(v => { setVoci(v); setErrore(''); }, err => {
    const codice = (err as { code?: string })?.code;
    setErrore(codice === 'permission-denied'
      ? 'Le regole di Firebase non permettono di leggere il registro: pubblica firestore.rules aggiornato.'
      : 'Registro non disponibile. Riprova più tardi.');
  }), []);

  const nomi = new Map(utenti.map(u => [u.uid, u.nome || u.email]));
  const persone = [...new Map<string, string>((voci ?? []).map(v => [v.uid, nomi.get(v.uid) || v.email])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'));
  const visibili = (voci ?? []).filter(v => (!chi || v.uid === chi) && (!azione || v.azione === azione));

  return (
    <section className="space-y-6 animate-fadeIn">
      <div className="page-heading">
        <div>
          <h1 className="page-title">Registro attività</h1>
          <p className="page-description">
            Chi è entrato nell'app e cosa ha modificato, dalla più recente. Le voci non si possono cambiare né cancellare. Più modifiche di fila diventano una voce sola, con l'elenco di cosa è cambiato.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="lbl" htmlFor="log-chi">Utente</label>
            <select id="log-chi" className="inp mt-1" value={chi} onChange={e => setChi(e.target.value)}>
              <option value="">Tutti</option>
              {persone.map(([uid, nome]) => <option key={uid} value={uid}>{nome}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="log-azione">Azione</label>
            <select id="log-azione" className="inp mt-1" value={azione} onChange={e => setAzione(e.target.value as '' | AzioneLog)}>
              <option value="">Tutte</option>
              {(Object.keys(AZIONI) as AzioneLog[]).map(a => <option key={a} value={a}>{AZIONI[a]}</option>)}
            </select>
          </div>
          {voci && <p className="text-sm text-slate-600 pb-2">{visibili.length} {visibili.length === 1 ? 'voce' : 'voci'}{voci.length >= 500 ? ' (ultime 500)' : ''}</p>}
        </div>

        {errore ? (
          <p className="text-sm text-rose-700 py-4" role="alert">{errore}</p>
        ) : !voci ? (
          <p className="text-sm text-slate-600 py-4">Caricamento…</p>
        ) : visibili.length === 0 ? (
          <p className="text-sm text-slate-600 py-4">{voci.length ? 'Nessuna voce corrisponde ai filtri.' : 'Il registro è vuoto: le voci compaiono dal primo accesso o dalla prima modifica.'}</p>
        ) : (
          <div className="table-wrapper overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Quando</th><th>Utente</th><th>Azione</th><th>Dettaglio</th></tr>
              </thead>
              <tbody>
                {visibili.map(v => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap tabular-nums">{quandoIt(v.quando)}</td>
                    <td className="whitespace-nowrap">
                      <span className="font-semibold">{nomi.get(v.uid) || v.email}</span>
                      {nomi.has(v.uid) && <span className="block text-xs text-slate-500">{v.email}</span>}
                    </td>
                    <td className="whitespace-nowrap">{AZIONI[v.azione] ?? v.azione}</td>
                    <td className="min-w-[320px] text-sm">
                      {v.modifiche.length ? (
                        <>
                          <ul className="space-y-0.5">{v.modifiche.slice(0, 5).map((m, i) => <li key={i}>{m}</li>)}</ul>
                          {v.modifiche.length > 5 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-sky-700">Altre {v.modifiche.length - 5}</summary>
                              <ul className="space-y-0.5 mt-1">{v.modifiche.slice(5).map((m, i) => <li key={i}>{m}</li>)}</ul>
                            </details>
                          )}
                        </>
                      ) : v.dettaglio || v.sezioni.map(s => SEZIONI_LOG[s] ?? s).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

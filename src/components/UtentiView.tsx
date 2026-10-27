import React, { useState } from 'react';
import { Check, Eye, ShieldCheck, Trash2, UserX } from 'lucide-react';
import { ProfiloUtente, Ruolo, cambiaPermessi, cambiaRuolo, eliminaProfilo } from '../lib/utenti';
import { PROGRAMMI, RUOLI, ordinaUtenti } from '../utils/utenti';

interface UtentiViewProps {
  utenti: ProfiloUtente[];
  mioUid: string;
  onShowToast: (msg: string) => void;
}

const dataIt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export const UtentiView: React.FC<UtentiViewProps> = ({ utenti, mioUid, onShowToast }) => {
  const [inCorso, setInCorso] = useState<string | null>(null);
  const ordinati = ordinaUtenti(utenti);
  const inAttesa = ordinati.filter(u => u.ruolo === 'in_attesa');
  const attivi = ordinati.filter(u => u.ruolo !== 'in_attesa');
  const consultazione = attivi.filter(u => u.ruolo === 'viewer');

  // Le regole di Firestore ricontrollano ogni modifica: qui gestiamo solo l'esito.
  const esegui = async (u: ProfiloUtente, azione: () => Promise<void>, ok: string) => {
    setInCorso(u.uid);
    try {
      await azione();
      onShowToast(ok);
    } catch (err) {
      // permission-denied = le regole pubblicate in Firebase rifiutano la modifica.
      const codice = (err as { code?: string })?.code;
      onShowToast(codice === 'permission-denied'
        ? `Modifica rifiutata dalle regole di Firebase per ${u.nome || u.email}: controlla di aver pubblicato firestore.rules aggiornato.`
        : `Modifica non riuscita per ${u.nome || u.email}${codice ? ` (${codice})` : ''}. Riprova.`);
    } finally {
      setInCorso(null);
    }
  };

  const imposta = (u: ProfiloUtente, ruolo: Ruolo) =>
    esegui(u, () => cambiaRuolo(u.uid, ruolo), ruolo === 'in_attesa' ? `Accesso sospeso per ${u.nome || u.email}.` : `${u.nome || u.email}: ${RUOLI[ruolo]}.`);

  // Senza permessi salvati l'utente vede tutto: si parte da lì. '' = programma nascosto.
  const permessiDi = (u: ProfiloUtente) => u.permessi ?? Object.fromEntries(Object.keys(PROGRAMMI).map(k => [k, 'vede' as const]));
  const impostaPermesso = (u: ProfiloUtente, programma: string, valore: '' | 'vede' | 'modifica') => {
    const { [programma]: _vecchio, ...altri } = permessiDi(u);
    esegui(u, () => cambiaPermessi(u.uid, valore ? { ...altri, [programma]: valore } : altri), `Permessi di ${u.nome || u.email} aggiornati.`);
  };

  const elimina = (u: ProfiloUtente) => {
    if (!window.confirm(`Eliminare la richiesta di ${u.nome || u.email}? Se accede di nuovo, comparirà ancora qui in attesa.`)) return;
    esegui(u, () => eliminaProfilo(u.uid), `Richiesta di ${u.nome || u.email} eliminata.`);
  };

  return (
    <section className="space-y-6 animate-fadeIn">
      <div className="page-heading">
        <div>
          <h1 className="page-title">Utenti</h1>
          <p className="page-description">
            Chi può entrare nell'app. Consultazione: vede e stampa i programmi, e modifica solo quelli indicati in "Permessi per programma". Amministratore: modifica tutto e gestisce gli utenti.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="section-heading-row">
          <div>
            <h2 className="section-title">Richieste da approvare</h2>
            <p className="section-description">Account con email confermata che aspettano un ruolo.</p>
          </div>
        </div>
        {inAttesa.length === 0 ? (
          <p className="text-sm text-slate-600 py-4">Nessuna richiesta in attesa.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {inAttesa.map(u => (
              <li key={u.uid} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-semibold text-slate-900">{u.nome || 'Senza nome'}</p>
                  <p className="text-sm text-slate-600">{u.email}, registrato il {dataIt(u.creato)}</p>
                </div>
                <button type="button" className="btn-primary" disabled={inCorso === u.uid} onClick={() => imposta(u, 'viewer')}>
                  <Check className="w-4 h-4" /> Approva in consultazione
                </button>
                <button type="button" className="btn-ghost" disabled={inCorso === u.uid} onClick={() => imposta(u, 'admin')}>
                  <ShieldCheck className="w-4 h-4" /> Approva come amministratore
                </button>
                <button type="button" className="icon-btn" disabled={inCorso === u.uid} onClick={() => elimina(u)} title="Elimina richiesta">
                  <Trash2 className="w-4 h-4" /><span className="sr-only">Elimina la richiesta di {u.nome || u.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="section-heading-row">
          <div>
            <h2 className="section-title">Utenti attivi</h2>
            <p className="section-description">{attivi.length} {attivi.length === 1 ? 'utente' : 'utenti'} con accesso.</p>
          </div>
        </div>
        <div className="table-wrapper overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Ruolo</th>
                <th>Registrato il</th>
                <th><span className="sr-only">Azioni</span></th>
              </tr>
            </thead>
            <tbody>
              {attivi.map(u => {
                const sonoIo = u.uid === mioUid;
                return (
                  <tr key={u.uid}>
                    <td className="font-semibold whitespace-nowrap">{u.nome || '—'}{sonoIo && <span className="ml-2 text-xs font-normal text-slate-500">(tu)</span>}</td>
                    <td className="whitespace-nowrap">{u.email}</td>
                    <td>
                      {sonoIo ? (
                        <span className="inline-flex items-center gap-1.5 text-sm"><ShieldCheck className="w-4 h-4" /> {RUOLI[u.ruolo]}</span>
                      ) : (
                        <select
                          className="inp !min-h-0 !py-1 w-[180px]"
                          value={u.ruolo}
                          disabled={inCorso === u.uid}
                          aria-label={`Ruolo di ${u.nome || u.email}`}
                          onChange={e => imposta(u, e.target.value as Ruolo)}
                        >
                          <option value="viewer">{RUOLI.viewer}</option>
                          <option value="admin">{RUOLI.admin}</option>
                        </select>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{dataIt(u.creato)}</td>
                    <td className="text-right">
                      {!sonoIo && (
                        <button type="button" className="btn-ghost" disabled={inCorso === u.uid} onClick={() => imposta(u, 'in_attesa')} title="Toglie l'accesso: l'utente torna in attesa">
                          <UserX className="w-4 h-4" /> Sospendi
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Non puoi cambiare il tuo ruolo: serve un altro amministratore, così nessuno resta chiuso fuori per sbaglio.
        </p>
      </div>

      <div className="card">
        <div className="section-heading-row">
          <div>
            <h2 className="section-title">Permessi per programma</h2>
            <p className="section-description">
              Per ogni utente in consultazione: Nascosto (non vede il programma), Consulta (lo vede e lo stampa), Modifica (può cambiarlo).
              Gli amministratori modificano sempre tutto.
            </p>
          </div>
        </div>
        {consultazione.length === 0 ? (
          <p className="text-sm text-slate-600 py-4">Nessun utente in consultazione.</p>
        ) : (
          <div className="table-wrapper overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Utente</th>
                  {Object.values(PROGRAMMI).map(nome => <th key={nome} className="whitespace-nowrap">{nome}</th>)}
                </tr>
              </thead>
              <tbody>
                {consultazione.map(u => (
                  <tr key={u.uid}>
                    <td className="font-semibold whitespace-nowrap">{u.nome || u.email}</td>
                    {Object.entries(PROGRAMMI).map(([k, nome]) => (
                      <td key={k}>
                        <select
                          className="inp !min-h-0 !py-1 w-[120px]"
                          value={permessiDi(u)[k] || ''}
                          disabled={inCorso === u.uid}
                          aria-label={`${nome}: permesso di ${u.nome || u.email}`}
                          onChange={e => impostaPermesso(u, k, e.target.value as '' | 'vede' | 'modifica')}
                        >
                          <option value="">Nascosto</option>
                          <option value="vede">Consulta</option>
                          <option value="modifica">Modifica</option>
                        </select>
                      </td>
                    ))}
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

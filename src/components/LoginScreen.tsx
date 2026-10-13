import React, { useState } from 'react';
import { LogIn, UserPlus, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { messaggioErrore, passwordValida } from '../utils/utenti';

type Modo = 'accedi' | 'registrati' | 'recupera';

// Cornice comune alle schermate prima dell'accesso (login, verifica email, attesa approvazione).
export const SchermataAccesso: React.FC<{ sottotitolo: string; children: React.ReactNode }> = ({ sottotitolo, children }) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="app-brand-mark !w-11 !h-11 !shadow-none border border-slate-200">GC</div>
          <div>
            <h1 className="text-xl font-bold text-slate-950">Gestione Congregazione</h1>
            <p className="text-sm text-slate-500">{sottotitolo}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  </div>
);

export const LoginScreen: React.FC = () => {
  const [modo, setModo] = useState<Modo>('accedi');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [conferma, setConferma] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);

  const cambiaModo = (m: Modo) => {
    setModo(m);
    setErrore(null);
    setAvviso(null);
  };

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrore(null);
    setAvviso(null);
    const mail = email.trim();
    if (!mail) return setErrore('Inserisci la tua email.');
    if (modo === 'registrati') {
      if (!nome.trim()) return setErrore('Inserisci nome e cognome: servono all\'amministratore per riconoscerti.');
      if (!passwordValida(password)) return setErrore('La password deve avere almeno 8 caratteri.');
      if (password !== conferma) return setErrore('Le due password non coincidono.');
    }
    setAttesa(true);
    try {
      if (modo === 'accedi') {
        await signInWithEmailAndPassword(auth, mail, password);
      } else if (modo === 'registrati') {
        const cred = await createUserWithEmailAndPassword(auth, mail, password);
        await updateProfile(cred.user, { displayName: nome.trim() });
        await sendEmailVerification(cred.user);
        // AuthGate passa da solo alla schermata di verifica.
      } else {
        await sendPasswordResetEmail(auth, mail);
        setAvviso(`Se ${mail} è registrata, riceverai un'email con il link per scegliere una nuova password.`);
      }
    } catch (err) {
      // Per il recupero non diciamo se l'email esiste: stesso messaggio in ogni caso.
      if (modo === 'recupera' && (err as { code?: string })?.code === 'auth/user-not-found') {
        setAvviso(`Se ${mail} è registrata, riceverai un'email con il link per scegliere una nuova password.`);
      } else {
        setErrore(messaggioErrore(err));
      }
    } finally {
      setAttesa(false);
    }
  };

  const sottotitolo = modo === 'registrati' ? 'Crea il tuo account' : modo === 'recupera' ? 'Recupera la password' : 'Accedi con la tua email';

  return (
    <SchermataAccesso sottotitolo={sottotitolo}>
      {modo !== 'recupera' && (
        <div className="login-tabs mb-5" role="tablist">
          <button type="button" role="tab" aria-selected={modo === 'accedi'} onClick={() => cambiaModo('accedi')} className={modo === 'accedi' ? 'is-active' : ''}>
            <LogIn className="w-4 h-4" /> Accedi
          </button>
          <button type="button" role="tab" aria-selected={modo === 'registrati'} onClick={() => cambiaModo('registrati')} className={modo === 'registrati' ? 'is-active' : ''}>
            <UserPlus className="w-4 h-4" /> Registrati
          </button>
        </div>
      )}

      <form onSubmit={invia} className="space-y-4" noValidate>
        {modo === 'registrati' && (
          <div>
            <label className="form-label" htmlFor="login-nome">Nome e cognome</label>
            <input id="login-nome" className="inp" autoComplete="name" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
        )}
        <div>
          <label className="form-label" htmlFor="login-email">Email</label>
          <input id="login-email" type="email" className="inp" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@esempio.it" autoFocus />
        </div>
        {modo !== 'recupera' && (
          <div>
            <div className="flex items-baseline justify-between">
              <label className="form-label" htmlFor="login-password">Password</label>
              {modo === 'accedi' && (
                <button type="button" className="text-xs font-semibold text-sky-700 hover:underline" onClick={() => cambiaModo('recupera')}>
                  Password dimenticata?
                </button>
              )}
            </div>
            <input
              id="login-password"
              type="password"
              className="inp"
              autoComplete={modo === 'registrati' ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              aria-describedby={modo === 'registrati' ? 'login-password-aiuto' : undefined}
            />
            {modo === 'registrati' && <p id="login-password-aiuto" className="text-xs text-slate-500 mt-1">Almeno 8 caratteri.</p>}
          </div>
        )}
        {modo === 'registrati' && (
          <div>
            <label className="form-label" htmlFor="login-conferma">Ripeti la password</label>
            <input id="login-conferma" type="password" className="inp" autoComplete="new-password" value={conferma} onChange={e => setConferma(e.target.value)} />
          </div>
        )}

        {errore && <div className="form-error" role="alert"><AlertCircle className="w-4 h-4 shrink-0" /> {errore}</div>}
        {avviso && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {avviso}
          </div>
        )}

        <button className="btn-primary w-full py-2.5" disabled={attesa}>
          {modo === 'accedi' && <><LogIn className="w-4 h-4" /> {attesa ? 'Accesso…' : 'Accedi'}</>}
          {modo === 'registrati' && <><UserPlus className="w-4 h-4" /> {attesa ? 'Creazione…' : 'Crea account'}</>}
          {modo === 'recupera' && <><KeyRound className="w-4 h-4" /> {attesa ? 'Invio…' : 'Invia il link'}</>}
        </button>

        {modo === 'registrati' && (
          <p className="text-xs text-slate-500 text-center">
            Riceverai un'email per confermare l'indirizzo. Poi un amministratore approverà il tuo account.
          </p>
        )}
        {modo === 'recupera' && (
          <button type="button" className="w-full text-sm font-semibold text-sky-700 hover:underline" onClick={() => cambiaModo('accedi')}>
            Torna all'accesso
          </button>
        )}
      </form>
    </SchermataAccesso>
  );
};

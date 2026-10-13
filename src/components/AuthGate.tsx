import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, sendEmailVerification, signOut, User } from 'firebase/auth';
import { MailCheck, Hourglass, LogOut, RefreshCw, AlertCircle } from 'lucide-react';
import { auth } from '../firebase';
import { ascoltaProfilo, creaProfilo, ProfiloUtente } from '../lib/utenti';
import { AuthUser } from '../types';
import { LoginScreen, SchermataAccesso } from './LoginScreen';

// Decide cosa mostrare: accesso, verifica email, attesa di approvazione o l'app.
// L'app viene montata solo per profili approvati: è lì che parte la sincronizzazione con Firestore.
export const AuthGate: React.FC<{ children: (utente: AuthUser, esci: () => void) => React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [verificaVersione, setVerificaVersione] = useState(0);
  const [profilo, setProfilo] = useState<ProfiloUtente | null | undefined>(undefined);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, u => {
    // Le vecchie sessioni anonime del PIN non valgono più.
    if (u?.isAnonymous) { signOut(auth); return; }
    setUser(u);
    setProfilo(undefined);
    setErrore(null);
  }), []);

  const verificato = !!user?.emailVerified;

  useEffect(() => {
    if (!user || !verificato) return;
    let creando = false;
    return ascoltaProfilo(
      user.uid,
      p => {
        setProfilo(p);
        if (!p && !creando) {
          creando = true;
          creaProfilo(user, user.displayName || '').catch(() => setErrore('Impossibile creare il profilo. Riprova tra poco.'));
        }
      },
      () => setErrore('Impossibile leggere il tuo profilo. Controlla la connessione e riprova.'),
    );
  }, [user, verificato, verificaVersione]);

  const esci = () => { signOut(auth); };

  if (user === undefined) return <SchermataAccesso sottotitolo="Caricamento…"><p className="text-sm text-slate-600">Verifica dell'accesso in corso…</p></SchermataAccesso>;
  if (!user) return <LoginScreen />;
  if (!verificato) return <VerificaEmail user={user} onVerificata={() => setVerificaVersione(v => v + 1)} onEsci={esci} />;

  if (errore) {
    return (
      <SchermataAccesso sottotitolo={user.email || ''}>
        <div className="form-error" role="alert"><AlertCircle className="w-4 h-4 shrink-0" /> {errore}</div>
        <button type="button" className="btn-ghost w-full mt-4" onClick={esci}><LogOut className="w-4 h-4" /> Esci</button>
      </SchermataAccesso>
    );
  }
  if (!profilo) return <SchermataAccesso sottotitolo={user.email || ''}><p className="text-sm text-slate-600">Preparazione del profilo…</p></SchermataAccesso>;

  if (profilo.ruolo === 'in_attesa') {
    return (
      <SchermataAccesso sottotitolo={profilo.email}>
        <div className="flex items-start gap-3">
          <Hourglass className="w-6 h-6 text-amber-600 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-slate-900">Account in attesa di approvazione</h2>
            <p className="text-sm text-slate-600 mt-1">
              {profilo.nome ? `Ciao ${profilo.nome}, ` : ''}la tua email è confermata. Un amministratore deve approvare l'account: appena lo fa, questa pagina si apre da sola.
            </p>
          </div>
        </div>
        <button type="button" className="btn-ghost w-full mt-6" onClick={esci}><LogOut className="w-4 h-4" /> Esci</button>
      </SchermataAccesso>
    );
  }

  const utente: AuthUser = { uid: user.uid, email: profilo.email, displayName: profilo.nome || profilo.email, role: profilo.ruolo };
  return <React.Fragment key={user.uid}>{children(utente, esci)}</React.Fragment>;
};

const VerificaEmail: React.FC<{ user: User; onVerificata: () => void; onEsci: () => void }> = ({ user, onVerificata, onEsci }) => {
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);

  const controlla = async () => {
    setAttesa(true);
    setMessaggio(null);
    try {
      await user.reload();
      if (!user.emailVerified) {
        setMessaggio('L\'email non risulta ancora confermata. Apri il link che ti abbiamo inviato, poi riprova.');
        return;
      }
      await user.getIdToken(true); // il nuovo token porta "email verificata" alle regole di Firestore
      onVerificata();
    } finally {
      setAttesa(false);
    }
  };

  const reinvia = async () => {
    setMessaggio(null);
    try {
      await sendEmailVerification(user);
      setMessaggio(`Email inviata di nuovo a ${user.email}. Controlla anche la cartella spam.`);
    } catch {
      setMessaggio('Hai già chiesto un invio da poco: aspetta qualche minuto e riprova.');
    }
  };

  return (
    <SchermataAccesso sottotitolo={user.email || ''}>
      <div className="flex items-start gap-3">
        <MailCheck className="w-6 h-6 text-sky-700 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-semibold text-slate-900">Conferma la tua email</h2>
          <p className="text-sm text-slate-600 mt-1">
            Ti abbiamo inviato un link a <strong>{user.email}</strong>. Aprilo per confermare l'indirizzo, poi torna qui.
          </p>
        </div>
      </div>
      {messaggio && <p className="text-sm text-slate-700 mt-4" role="status">{messaggio}</p>}
      <div className="mt-6 space-y-2">
        <button type="button" className="btn-primary w-full py-2.5" onClick={controlla} disabled={attesa}>
          <RefreshCw className="w-4 h-4" /> {attesa ? 'Controllo…' : 'Ho confermato, continua'}
        </button>
        <button type="button" className="btn-ghost w-full" onClick={reinvia}>Invia di nuovo l'email</button>
        <button type="button" className="btn-ghost w-full" onClick={onEsci}><LogOut className="w-4 h-4" /> Esci</button>
      </div>
    </SchermataAccesso>
  );
};

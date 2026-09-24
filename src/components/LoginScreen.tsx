import React, { useState } from 'react';
import { Lock, Key, LogIn, AlertCircle, UserPlus, ShieldCheck } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import { AuthUser } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
  adminPin: string;
  viewerPin: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, adminPin, viewerPin }) => {
  const [mode, setMode] = useState<'pin' | 'email'>('pin');
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputPin.trim();
    setPinError(null);
    if (!trimmed) {
      setPinError('Inserisci il codice PIN.');
      return;
    }
    setLoading(true);
    try {
      let uid = 'pin-session';
      try {
        const cred = await signInAnonymously(auth);
        uid = cred.user.uid;
      } catch {
        // L’accesso PIN può continuare in locale se Auth anonima non è disponibile.
      }

      if (trimmed === adminPin) {
        onLoginSuccess({ uid, displayName: 'Amministratore', role: 'admin', isAnonymousPIN: true });
      } else if (trimmed === viewerPin) {
        onLoginSuccess({ uid, displayName: 'Consultazione', role: 'viewer', isAnonymousPIN: true });
      } else {
        setPinError('Codice PIN non valido.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    if (!email.trim() || !password.trim()) {
      setEmailError('Compila email e password.');
      return;
    }
    setLoading(true);
    try {
      const cred = isRegistering
        ? await createUserWithEmailAndPassword(auth, email.trim(), password)
        : await signInWithEmailAndPassword(auth, email.trim(), password);

      // Finché i ruoli non sono gestiti da claim/server, l'accesso email è prudenzialmente sola lettura.
      onLoginSuccess({
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.email?.split('@')[0] || 'Operatore',
        role: 'viewer',
      });
    } catch (err: any) {
      const code = err?.code;
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') setEmailError('Credenziali non valide.');
      else if (code === 'auth/user-not-found') setEmailError('Account non trovato.');
      else if (code === 'auth/email-already-in-use') setEmailError('Questa email è già registrata.');
      else if (code === 'auth/weak-password') setEmailError('La password deve contenere almeno 6 caratteri.');
      else setEmailError('Impossibile completare l’accesso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-11 h-11 rounded-xl bg-sky-700 text-white flex items-center justify-center font-bold">GC</div>
            <div>
              <h1 className="text-xl font-bold text-slate-950">Gestione Congregazione</h1>
              <p className="text-sm text-slate-500">Accedi alla pianificazione e agli incarichi</p>
            </div>
          </div>

          <div className="login-tabs">
            <button type="button" onClick={() => setMode('pin')} className={mode === 'pin' ? 'is-active' : ''}>
              <Key className="w-4 h-4" /> PIN
            </button>
            <button type="button" onClick={() => setMode('email')} className={mode === 'email' ? 'is-active' : ''}>
              <LogIn className="w-4 h-4" /> Email
            </button>
          </div>

          {mode === 'pin' ? (
            <form onSubmit={handlePinSubmit} className="space-y-4 mt-5">
              <div>
                <label className="form-label">Codice PIN</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    inputMode="numeric"
                    autoFocus
                    value={inputPin}
                    onChange={(e) => { setInputPin(e.target.value.replace(/\D/g, '').slice(0, 10)); setPinError(null); }}
                    className="inp pl-10 text-base tracking-[0.3em]"
                    placeholder="••••"
                  />
                </div>
              </div>
              {pinError && <div className="form-error"><AlertCircle className="w-4 h-4" /> {pinError}</div>}
              <button className="btn-primary w-full py-2.5" disabled={loading}>
                <ShieldCheck className="w-4 h-4" /> {loading ? 'Verifica…' : 'Accedi'}
              </button>
              <p className="text-xs text-slate-500 text-center">Usa il PIN assegnato al tuo livello di accesso.</p>
            </form>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-4 mt-5">
              <div>
                <label className="form-label">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="inp" placeholder="nome@esempio.it" />
              </div>
              <div>
                <label className="form-label">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="inp" placeholder="Password" />
              </div>
              {emailError && <div className="form-error"><AlertCircle className="w-4 h-4" /> {emailError}</div>}
              <button className="btn-primary w-full py-2.5" disabled={loading}>
                {isRegistering ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                {loading ? 'Attendi…' : isRegistering ? 'Crea account' : 'Accedi'}
              </button>
              <button type="button" onClick={() => setIsRegistering((v) => !v)} className="w-full text-sm text-sky-700 hover:text-sky-900 font-medium">
                {isRegistering ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
              </button>
              <p className="text-xs text-slate-500 text-center">Gli account email accedono in sola lettura finché i ruoli non vengono configurati lato server.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCustomToken, sendEmailVerification, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { accessRequest, getAccessProfile } from '../lib/accessClient';
import type { AuthUser } from '../types';
export function LoginScreen({ onLoginSuccess }: { onLoginSuccess: (user: AuthUser) => void }) {
  const [register, setRegister] = useState(false), [identifier, setIdentifier] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const value = identifier.trim();
      if (register) { const credential = await createUserWithEmailAndPassword(auth, value, password); await updateProfile(credential.user, { displayName: name.trim() }); await sendEmailVerification(credential.user); }
      else if (value.includes('@')) await signInWithEmailAndPassword(auth, value, password);
      else { const result = await accessRequest<{ token: string }>('/username-login', 'POST', { username: value, password }); await signInWithCustomToken(auth, result.token); }
      onLoginSuccess(await getAccessProfile());
    } catch (err: any) { setError(err.code === 'auth/email-already-in-use' ? 'Email già registrata. Accedi o recupera la password.' : err.code === 'auth/weak-password' ? 'Usa una password di almeno 8 caratteri.' : err.code?.startsWith('auth/') ? 'Accesso non riuscito. Controlla le credenziali e riprova.' : err.message); } finally { setBusy(false); }
  }
  async function reset() {
    if (!identifier.includes('@')) { setError('Inserisci la tua email per recuperare la password. Per un nome utente, contatta l’amministratore.'); return; }
    setBusy(true); setError(''); try { await sendPasswordResetEmail(auth, identifier.trim()); setMessage('Se l’account esiste, riceverai le istruzioni per reimpostare la password.'); } catch { setError('Invio non riuscito. Riprova più tardi.'); } finally { setBusy(false); }
  }
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="card w-full max-w-md p-6 sm:p-8">
    <div className="flex gap-3 items-center mb-6"><div className="app-brand-mark">GC</div><div><h1 className="text-xl font-bold">Gestione Congregazione</h1><p className="text-sm text-slate-500">{register ? 'Registrazione con email' : 'Accesso personale'}</p></div></div>
    <form onSubmit={submit} className="space-y-4">
      {register && <label className="block text-sm font-medium">Nome e cognome<input required autoComplete="name" className="inp mt-1" value={name} onChange={e => setName(e.target.value)} /></label>}
      <label className="block text-sm font-medium">{register ? 'Email' : 'Email o nome utente'}<input required type={register ? 'email' : 'text'} autoComplete="username" className="inp mt-1" value={identifier} onChange={e => setIdentifier(e.target.value)} /></label>
      <label className="block text-sm font-medium">Password<input required type="password" minLength={register ? 8 : undefined} autoComplete={register ? 'new-password' : 'current-password'} className="inp mt-1" value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      <button disabled={busy} className="btn-primary w-full">{busy ? 'Attendi…' : register ? 'Registrati' : 'Accedi'}</button>
      <button disabled={busy} type="button" className="w-full text-sm text-sky-700" onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Hai già un account? Accedi' : 'Registrati con email'}</button>
      {!register && <button disabled={busy} type="button" className="w-full text-sm text-slate-600" onClick={reset}>Password dimenticata?</button>}
      <p className="text-xs text-slate-500">Le nuove registrazioni devono essere approvate dall’amministratore. I permessi sono assegnati a ogni utente.</p>
    </form>
  </div></div>;
}

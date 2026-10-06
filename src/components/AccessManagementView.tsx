import React, { useEffect, useState } from 'react';
import { Users, UserPlus, RefreshCw, ShieldCheck } from 'lucide-react';
import { ACCESS_SECTIONS, type AccessProfile } from '../accessPolicy';
import { accessRequest } from '../lib/accessClient';

const fresh = (): AccessProfile => ({ uid: '', displayName: '', email: '', username: '', role: 'viewer', status: 'active', permissions: {}, createdAt: '' });
const roles = { admin: 'Amministratore', editor: 'Operatore', viewer: 'Lettore' };
const statuses = { pending: 'In attesa', active: 'Attivo', disabled: 'Disabilitato' };
export function AccessManagementView({ currentUid }: { currentUid: string }) {
  const [users, setUsers] = useState<AccessProfile[]>([]), [draft, setDraft] = useState<AccessProfile | null>(null);
  const [password, setPassword] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  async function reload() { setError(''); try { setUsers((await accessRequest<{ users: AccessProfile[] }>('/users')).users); } catch (e: any) { setError(e.message); } }
  useEffect(() => { void reload(); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!draft) return; setBusy(true); setError(''); setMessage('');
    try {
      if (draft.uid) { await accessRequest('/users/' + draft.uid, 'PATCH', draft); if (password) await accessRequest('/users/' + draft.uid + '/password', 'POST', { password }); }
      else await accessRequest('/users', 'POST', { ...draft, password });
      setDraft(null); setPassword(''); setMessage('Accesso salvato. I nuovi permessi si applicano anche alle sessioni già aperte.'); await reload();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="space-y-5">
    <div className="page-heading flex-wrap"><div><p className="page-eyebrow">Amministrazione</p><h1 className="page-title">Gestione accessi</h1><p className="page-description">Account personali, approvazioni e permessi per ogni funzione.</p></div><div className="flex flex-wrap gap-2"><button className="btn-ghost" onClick={reload} disabled={busy}><RefreshCw className="w-4 h-4" />Aggiorna</button><button className="btn-primary" disabled={busy} onClick={() => { setDraft(fresh()); setPassword(''); setError(''); }}><UserPlus className="w-4 h-4" />Nuovo utente</button></div></div>
    {error && <p role="alert" className="status-banner text-rose-700">{error}</p>}{message && <p role="status" className="status-banner text-emerald-700">{message}</p>}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{(['active', 'pending', 'disabled'] as const).map(status => <button key={status} onClick={() => setFilter(status)} className="metric-card text-left"><div className="metric-value">{users.filter(u => u.status === status).length}</div><div className="metric-label">{statuses[status]}</div></button>)}</div>
    <div className="card"><div className="flex justify-between mb-3"><h2 className="card-title flex items-center gap-2"><Users className="w-4 h-4" />Utenti</h2><select className="inp max-w-40" aria-label="Filtra utenti" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Tutti</option><option value="pending">In attesa</option><option value="active">Attivi</option><option value="disabled">Disabilitati</option></select></div>
      <div className="relative overflow-x-auto"><table className="tbl w-full"><thead><tr><th>Utente</th><th>Accesso</th><th>Livello</th><th>Stato</th><th><span className="sr-only">Azioni</span></th></tr></thead><tbody>{users.filter(u => filter === 'all' || u.status === filter).map(u => <tr key={u.uid}><td><strong>{u.displayName}</strong>{u.uid === currentUid && <span className="ml-2 text-xs text-slate-500">Tu</span>}</td><td><div>{u.email || 'Senza email'}</div>{u.username && <div className="text-xs text-slate-500">@{u.username}</div>}</td><td>{roles[u.role]}</td><td><span className={u.status === 'pending' ? 'text-amber-700' : u.status === 'disabled' ? 'text-slate-500' : 'text-emerald-700'}>{statuses[u.status]}</span></td><td><button className="btn-ghost" disabled={busy} onClick={() => { setDraft({ ...u, status: u.status === 'pending' ? 'active' : u.status, permissions: { ...u.permissions } }); setPassword(''); setError(''); }}>{u.status === 'pending' ? 'Approva e assegna permessi' : 'Gestisci'}</button></td></tr>)}</tbody></table></div>
      {!users.length && <p className="text-sm text-slate-500 py-4">Nessun account disponibile.</p>}
    </div>
    {draft && <form className="card space-y-4" onSubmit={save}>
      <h2 className="card-title flex gap-2 items-center"><ShieldCheck className="w-5 h-5" />{draft.uid ? `Accesso di ${draft.displayName}` : 'Crea un account personale'}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block text-sm font-medium">Nome e cognome<input className="inp mt-1" required value={draft.displayName} onChange={e => setDraft({ ...draft, displayName: e.target.value })} /></label>
        <label className="block text-sm font-medium">Nome utente<input className="inp mt-1" value={draft.username || ''} pattern="[a-zA-Z0-9._-]{3,40}" onChange={e => setDraft({ ...draft, username: e.target.value })} /><span className="text-xs text-slate-500">Da 3 a 40 caratteri. Alternativa all’accesso email.</span></label>
        <label className="block text-sm font-medium">Email<input className="inp mt-1" type="email" disabled={!!draft.uid} value={draft.email || ''} onChange={e => setDraft({ ...draft, email: e.target.value })} /><span className="text-xs text-slate-500">Facoltativa se specifichi un nome utente.</span></label>
        <label className="block text-sm font-medium">{draft.uid ? 'Nuova password (facoltativa)' : 'Password iniziale'}<input aria-label={draft.uid ? "Nuova password" : "Password iniziale"} className="inp mt-1" type="password" autoComplete="new-password" minLength={8} required={!draft.uid} value={password} onChange={e => setPassword(e.target.value)} /><span className="text-xs text-slate-500">Almeno 8 caratteri. Le password non sono visibili nell’elenco.</span></label>
        <label className="block text-sm font-medium">Livello<select aria-label="Livello" className="inp mt-1" disabled={draft.uid === currentUid} value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value as AccessProfile['role'] })}>{Object.entries(roles).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label className="block text-sm font-medium">Stato<select aria-label="Stato" className="inp mt-1" disabled={draft.uid === currentUid} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as AccessProfile['status'] })}>{Object.entries(statuses).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      </div>
      <div><h3 className="font-semibold mb-2">Funzioni disponibili</h3><p className="text-sm text-slate-500 mb-3">{draft.role === 'admin' ? 'L’amministratore gestisce tutte le funzioni e gli accessi.' : 'Consultazione include stampa ed esportazione. Modifica include creazione, generazione e gestione dei programmi.'}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{Object.entries(ACCESS_SECTIONS).map(([key, label]) => <label key={key} className="flex gap-3 items-center justify-between border border-slate-200 rounded-lg p-3 text-sm"><span>{label}</span><select className="inp max-w-44" aria-label={`Permesso ${label}`} disabled={draft.role === 'admin'} value={draft.role === 'admin' ? 'write' : draft.permissions[key as keyof typeof ACCESS_SECTIONS] || 'none'} onChange={e => setDraft({ ...draft, permissions: { ...draft.permissions, [key]: e.target.value } })}><option value="none">Nessun accesso</option><option value="read">Consultazione</option><option value="write" disabled={draft.role === 'viewer'}>Modifica</option></select></label>)}</div>
      </div>
      <div className="flex gap-2 justify-end"><button className="btn-ghost" type="button" disabled={busy} onClick={() => { setDraft(null); setPassword(''); }}>Annulla</button><button className="btn-primary" disabled={busy}>{busy ? 'Salvataggio…' : draft.status === 'pending' ? 'Salva in attesa' : 'Salva accesso'}</button></div>
    </form>}
  </section>;
}

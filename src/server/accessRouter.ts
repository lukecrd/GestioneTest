import { Router, type Request, type Response } from 'express';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import config from '../../firebase-applet-config.json';
import { ACCESS_SECTIONS, STATE_FIELDS, PROGRAM_FIELDS, allowedPatch, visibleData, type AccessProfile } from '../accessPolicy.js';


class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function services() {
  let app = getApps().find(a => a.name === 'access-server');
  if (!app) {
    if (!process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT) throw new HttpError(503, 'Gestione accessi non configurata: completa la configurazione Firebase sul server.');
    const credential = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT);
    app = initializeApp({ credential: cert(credential), projectId: config.projectId }, 'access-server');
  }
  return { auth: getAuth(app), db: getFirestore(app, config.firestoreDatabaseId) };
}
export function createAccessRouter(serviceProvider: typeof services = services) {
const accessRouter = Router();
const services = serviceProvider;
const route = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  try { await fn(req, res); } catch (err: any) {
    const status = err instanceof HttpError ? err.status : err.code?.startsWith('auth/') ? 401 : 500;
    res.status(status).json({ error: err instanceof HttpError ? err.message : status === 401 ? 'Sessione non valida. Accedi nuovamente.' : 'Operazione non riuscita. Riprova.' });
  }
};
async function identity(req: Request) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, 'Accesso richiesto.');
  const s = services();
  const decoded = await s.auth.verifyIdToken(token, true);
  if (decoded.firebase.sign_in_provider === 'anonymous') throw new HttpError(401, 'Accedi con un account personale.');
  return { ...s, decoded };
}
async function profile(req: Request, admin = false) {
  const s = await identity(req);
  const doc = await s.db.collection('accessUsers').doc(s.decoded.uid).get();
  if (!doc.exists) throw new HttpError(403, 'Account in attesa di approvazione.');
  const user = doc.data() as AccessProfile;
  if (user.status !== 'active' || (admin && user.role !== 'admin')) throw new HttpError(403, 'Accesso non autorizzato.');
  return { ...s, user };
}
function username(value: any) {
  const result = String(value || '').trim().toLowerCase();
  if (result && !/^[a-z0-9._-]{3,40}$/.test(result)) throw new HttpError(400, 'Nome utente: usa da 3 a 40 lettere, numeri, punti, trattini o underscore.');
  return result || null;
}
function validate(input: any) {
  if (!['admin', 'editor', 'viewer'].includes(input.role) || !['pending', 'active', 'disabled'].includes(input.status)) throw new HttpError(400, 'Ruolo o stato non valido.');
  const permissions: AccessProfile['permissions'] = {};
  for (const key of Object.keys(ACCESS_SECTIONS)) {
    const level = input.permissions?.[key] || 'none';
    if (!['none', 'read', 'write'].includes(level)) throw new HttpError(400, 'Permesso non valido.');
    permissions[key as keyof typeof ACCESS_SECTIONS] = input.role === 'viewer' && level === 'write' ? 'read' : level;
  }
  const displayName = String(input.displayName || '').trim().slice(0, 100);
  if (!displayName) throw new HttpError(400, 'Inserisci il nome dell’utente.');
  return { displayName, username: username(input.username), role: input.role, status: input.status, permissions };
}
accessRouter.get('/me', route(async (req, res) => {
  const s = await identity(req); const ref = s.db.collection('accessUsers').doc(s.decoded.uid);
  const bootstrap = process.env.ACCESS_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const user = await s.db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    const account = await s.auth.getUser(s.decoded.uid);
    const firstAdmin = !!bootstrap && account.email?.toLowerCase() === bootstrap && account.emailVerified;
    if (existing.exists) {
      const current = existing.data() as AccessProfile & { bootstrapEligible?: boolean };
      if (firstAdmin && current.bootstrapEligible && current.status === 'pending') {
        const promoted = { ...current, role: 'admin' as const, status: 'active' as const, bootstrapEligible: false };
        tx.set(ref, promoted); return promoted;
      }
      if (current.status === 'pending' && account.displayName && current.displayName !== account.displayName) {
        tx.update(ref, { displayName: account.displayName }); return { ...current, displayName: account.displayName };
      }
      return current;
    }
    const result: AccessProfile = { uid: account.uid, email: account.email || null, username: null, displayName: account.displayName || account.email?.split('@')[0] || 'Utente', role: firstAdmin ? 'admin' : 'viewer', status: firstAdmin ? 'active' : 'pending', permissions: {}, createdAt: new Date().toISOString() };
    tx.set(ref, { ...result, bootstrapEligible: !firstAdmin && !!bootstrap && account.email?.toLowerCase() === bootstrap }); return result;
  });
  res.json({ user });
}));
accessRouter.post('/username-login', route(async (req, res) => {
  const key = username(req.body.username); if (!key || typeof req.body.password !== 'string') throw new HttpError(400, 'Inserisci nome utente e password.');
  const s = services(); const mapping = await s.db.collection('accessUsernames').doc(key).get();
  if (!mapping.exists) throw new HttpError(401, 'Credenziali non valide.');
  const account = await s.auth.getUser(mapping.get('uid'));
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password: req.body.password, returnSecureToken: true }) });
  const login = await response.json();
  if (!response.ok || login.localId !== account.uid) throw new HttpError(401, 'Credenziali non valide.');
  res.json({ token: await s.auth.createCustomToken(account.uid) });
}));
accessRouter.get('/users', route(async (req, res) => {
  const s = await profile(req, true); const docs = await s.db.collection('accessUsers').orderBy('createdAt', 'desc').limit(500).get();
  res.json({ users: docs.docs.map(d => d.data()) });
}));
accessRouter.post('/users', route(async (req, res) => {
  const s = await profile(req, true); const fields = validate(req.body);
  if (typeof req.body.password !== 'string' || req.body.password.length < 8) throw new HttpError(400, 'Usa una password di almeno 8 caratteri.');
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email && !fields.username) throw new HttpError(400, 'Inserisci email o nome utente.');
  const account = await s.auth.createUser({ email: email || `${fields.username}@${config.projectId}.invalid`, password: req.body.password, displayName: fields.displayName, disabled: fields.status === 'disabled' });
  const user: AccessProfile = { ...fields, uid: account.uid, email: email || null, createdAt: new Date().toISOString() };
  try { await s.db.runTransaction(async tx => {
    const mapping = fields.username ? s.db.collection('accessUsernames').doc(fields.username) : null;
    if (mapping && (await tx.get(mapping)).exists) throw new HttpError(409, 'Nome utente già utilizzato.');
    tx.set(s.db.collection('accessUsers').doc(account.uid), user); if (mapping) tx.set(mapping, { uid: account.uid });
  }); } catch (error) { await s.auth.deleteUser(account.uid); throw error; }
  res.status(201).json({ user });
}));
accessRouter.patch('/users/:uid', route(async (req, res) => {
  const s = await profile(req, true); const fields = validate(req.body); const uid = String(req.params.uid);
  if (uid === s.user.uid && (fields.role !== 'admin' || fields.status !== 'active')) throw new HttpError(400, 'Non puoi revocare il tuo accesso amministrativo.');
  const ref = s.db.collection('accessUsers').doc(uid);
  await s.db.runTransaction(async tx => {
    const guard = s.db.doc('accessMeta/adminGuard'); await tx.get(guard);
    const existing = await tx.get(ref); if (!existing.exists) throw new HttpError(404, 'Utente non trovato.');
    const old = existing.data() as AccessProfile;
    const admins = await tx.get(s.db.collection('accessUsers').where('role', '==', 'admin'));
    if (old.role === 'admin' && old.status === 'active' && (fields.role !== 'admin' || fields.status !== 'active') && admins.docs.filter(d => d.get('status') === 'active').length <= 1) throw new HttpError(400, 'Deve rimanere almeno un amministratore attivo.');
    const mapping = fields.username ? s.db.collection('accessUsernames').doc(fields.username) : null;
    if (mapping) { const claimed = await tx.get(mapping); if (claimed.exists && claimed.get('uid') !== uid) throw new HttpError(409, 'Nome utente già utilizzato.'); }
    if (old.username && old.username !== fields.username) tx.delete(s.db.collection('accessUsernames').doc(old.username));
    if (mapping) tx.set(mapping, { uid }); tx.update(ref, fields); tx.set(guard, { updatedAt: new Date().toISOString() });
  });
  await s.auth.updateUser(uid, { disabled: fields.status === 'disabled', displayName: fields.displayName });
  if (fields.status !== 'active') await s.auth.revokeRefreshTokens(uid);
  res.json({ success: true });
}));
accessRouter.post('/users/:uid/password', route(async (req, res) => {
  const s = await profile(req, true);
  if (typeof req.body.password !== 'string' || req.body.password.length < 8) throw new HttpError(400, 'Usa una password di almeno 8 caratteri.');
  await s.auth.updateUser(String(req.params.uid), { password: req.body.password });
  await s.auth.revokeRefreshTokens(String(req.params.uid)); res.json({ success: true });
}));
accessRouter.get('/data', route(async (req, res) => {
  const s = await profile(req); const doc = await s.db.doc('congregationData/main').get();
  res.json({ ...visibleData(s.user, doc.data() || {}), user: s.user });
}));
accessRouter.patch('/data', route(async (req, res) => {
  const s = await profile(req); const section = String(req.body.section || '');
  if (!section || (s.user.role !== 'admin' && s.user.permissions[section as keyof typeof ACCESS_SECTIONS] !== 'write') || (s.user.role !== 'admin' && s.user.role !== 'editor')) throw new HttpError(403, 'Non puoi modificare questa funzione.');
  const stateFields = Object.fromEntries(Object.entries(STATE_FIELDS).filter(([, owner]) => owner === section || (s.user.role === 'admin' && section === 'all')));
  const programFields = Object.fromEntries(Object.entries(PROGRAM_FIELDS).filter(([, owner]) => owner === section || (s.user.role === 'admin' && section === 'all')));
  const state = allowedPatch(s.user, req.body.state, stateFields); const activePrograms = allowedPatch(s.user, req.body.activePrograms, programFields);
  if (s.user.role === 'admin' && req.body.state?.programResponsibles) state.programResponsibles = req.body.state.programResponsibles;
  const patch: Record<string, any> = {};
  for (const [key, value] of Object.entries(state)) patch[`state.${key}`] = value;
  for (const [key, value] of Object.entries(activePrograms)) patch[`activePrograms.${key}`] = value;
  if (!Object.keys(patch).length) throw new HttpError(403, 'Nessuna modifica autorizzata.');
  const ref = s.db.doc('congregationData/main');
  await s.db.runTransaction(async tx => { const doc = await tx.get(ref); if (doc.exists) tx.update(ref, { ...patch, updatedAt: new Date().toISOString() }); else tx.set(ref, { state, activePrograms, updatedAt: new Date().toISOString() }); });
  res.json({ success: true });
}));

return accessRouter;
}
export const accessRouter = createAccessRouter();

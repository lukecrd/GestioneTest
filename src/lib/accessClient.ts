import { auth } from '../firebase';
import type { AccessProfile } from '../accessPolicy';
export class AccessError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function accessRequest<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const response = await fetch('/api/access' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: 'no-store' });
  let data: any; try { data = await response.json(); } catch { throw new AccessError('Il server non ha restituito una risposta valida. Verifica la configurazione degli accessi.', response.status); }
  if (!response.ok) throw new AccessError(data.error || 'Operazione non consentita.', response.status);
  return data as T;
}
export async function getAccessProfile(): Promise<AccessProfile> { return (await accessRequest<{ user: AccessProfile }>('/me')).user; }

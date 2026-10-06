export const ACCESS_SECTIONS = {
  anagrafica: 'Persone', mensile: 'Programma mensile', domenica: 'Adunanza domenica',
  vitaEMinistero: 'Vita e ministero', servizioCampo: 'Servizio di campo',
  operaPubblica: 'Opera pubblica', impostazioni: 'Assenze e calendario', statistiche: 'Statistiche',
} as const;
export type AccessSection = keyof typeof ACCESS_SECTIONS;
export type AccessLevel = 'none' | 'read' | 'write';
export type AccessRole = 'admin' | 'editor' | 'viewer';
export interface AccessProfile {
  uid: string; displayName: string; email: string | null; username: string | null;
  role: AccessRole; status: 'pending' | 'active' | 'disabled';
  permissions: Partial<Record<AccessSection, AccessLevel>>; createdAt: string;
}
export function canAccess(user: AccessProfile | null | undefined, section: string, write = false): boolean {
  if (!user || user.status !== 'active') return false;
  if (section === 'hub') return !write || user.role === 'admin';
  if (user.role === 'admin') return true;
  if (section === 'accessi') return false;
  const level = user.permissions[section as AccessSection] || 'none';
  return write ? user.role === 'editor' && level === 'write' : level === 'read' || level === 'write';
}
export const STATE_FIELDS: Record<string, AccessSection> = {
  people: 'anagrafica', unavail: 'impostazioni', special: 'impostazioni', groups: 'impostazioni',
  mensileArchives: 'mensile', operaPubblica: 'operaPubblica', servizioCampo: 'servizioCampo', vitaEMinistero: 'vitaEMinistero',
};
export const PROGRAM_FIELDS: Record<string, AccessSection> = Object.fromEntries([
  ...['menRows', 'menTitle', 'menWarn', 'menMonth', 'menYear'].map(k => [k, 'mensile']),
  ...['domRows', 'domTitle', 'domWarn', 'domMonth', 'domYear'].map(k => [k, 'domenica']),
]) as Record<string, AccessSection>;
export function visibleData(user: AccessProfile, raw: any) {
  const state: Record<string, any> = { people: [], unavail: {}, special: {}, groups: { riassetto: '1', pulizie: 'Massa' } };
  const activePrograms: Record<string, any> = {};
  for (const [key, section] of Object.entries(STATE_FIELDS)) if (canAccess(user, section) && raw.state?.[key] !== undefined) state[key] = raw.state[key];
  const programs = ['mensile', 'domenica', 'vitaEMinistero', 'servizioCampo', 'operaPubblica'];
  if (!canAccess(user, 'anagrafica') && programs.some(s => canAccess(user, s))) {
    state.people = (raw.state?.people || []).map((p: any) => ({ id: p.id, name: p.name, gender: p.gender, roles: p.roles || {}, isActive: p.isActive !== false }));
  }
  if (programs.some(s => canAccess(user, s))) {
    state.unavail = raw.state?.unavail || {};
    state.special = raw.state?.special || {};
    state.groups = raw.state?.groups || state.groups;
  }
  if (canAccess(user, 'statistiche') && !canAccess(user, 'anagrafica')) {
    state.people = (raw.state?.people || []).map((p: any) => ({ id: p.id, name: p.name, gender: p.gender, roles: p.roles || {} }));
    state.mensileArchives = raw.state?.mensileArchives || [];
  }
  if (user.role === 'admin') state.programResponsibles = raw.state?.programResponsibles || {};
  for (const [key, section] of Object.entries(PROGRAM_FIELDS)) if (canAccess(user, section) && raw.activePrograms?.[key] !== undefined) activePrograms[key] = raw.activePrograms[key];
  return { state, activePrograms };
}
export function allowedPatch(user: AccessProfile, value: Record<string, any>, fields: Record<string, AccessSection>) {
  return Object.fromEntries(Object.entries(value || {}).filter(([key]) => Object.hasOwn(fields, key) && canAccess(user, fields[key], true)));
}

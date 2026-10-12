import { domenicaPeriodKey } from './domenicaPrograms';

/** @returns {Record<string, import('../types').MensileMonthProgram>} */
export function normalizeMensilePrograms(raw) {
  const programs = {};
  if (!raw || typeof raw !== 'object') return programs;
  for (const [key, value] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}$/.test(key) || Number(key.slice(5)) < 1 || Number(key.slice(5)) > 12 || !value || typeof value !== 'object') continue;
    const year = Number(key.slice(0, 4)), month = Number(key.slice(5)) - 1;
    const rows = Array.isArray(value.rows) ? value.rows.map(row => ({
      ...row, date: row.date instanceof Date ? new Date(row.date.getTime()) : new Date(row.date),
    })).filter(row => !Number.isNaN(row.date.getTime()) && row.date.getFullYear() === year && row.date.getMonth() === month) : null;
    programs[key] = { rows: rows?.length ? rows : null,
      title: typeof value.title === 'string' ? value.title : '',
      warn: typeof value.warn === 'string' ? value.warn : null, year, month, fromArchive: !!value.fromArchive };
  }
  return programs;
}

export function legacyMensileProgram(active) {
  if (!Array.isArray(active?.menRows) || !active.menRows.length) return null;
  const date = new Date(active.menRows[0].date);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear(), month = date.getMonth();
  return { key: domenicaPeriodKey(year, month), rows: active.menRows, year, month,
    title: active.menTitle || '', warn: active.menWarn || null };
}

/** Recover archived periods; explicit saved entries (including cleared months) win. */
export function mergeMensilePrograms(local, active, archives = []) {
  const result = {};
  [...archives].sort((a, b) => (a.savedAt || '').localeCompare(b.savedAt || '')).forEach(archive => {
    const key = domenicaPeriodKey(archive.year, archive.month);
    if (!key) return;
    result[key] = { rows: (archive.rows || []).map(row => ({ ...row, date: new Date(row.dateStr + 'T12:00:00') })),
      title: archive.title || '', warn: archive.warn || null, year: archive.year, month: archive.month, fromArchive: true };
  });
  Object.assign(result, normalizeMensilePrograms(local), normalizeMensilePrograms(active?.menPrograms));
  const legacy = legacyMensileProgram(active);
  if (legacy && !active?.menPrograms?.[legacy.key] && (!result[legacy.key] || result[legacy.key].fromArchive)) {
    const { key, ...program } = legacy;
    result[key] = program;
  }
  return normalizeMensilePrograms(result);
}

export function serializeMensilePrograms(programs) {
  return Object.fromEntries(Object.entries(normalizeMensilePrograms(programs)).map(([key, program]) => [
    key, { ...program, rows: program.rows?.map(row => ({ ...row, date: row.date.toISOString() })) ?? null },
  ]));
}

export function updateMensilePeriod(programs, year, month, patch) {
  const key = domenicaPeriodKey(year, month);
  const normalized = normalizeMensilePrograms(programs);
  if (!key) return normalized;
  return normalizeMensilePrograms({ ...normalized, [key]: {
    rows: null, title: '', warn: null, ...normalized[key], ...patch, year, month, fromArchive: false,
  } });
}

export function clearMensilePrograms(programs) {
  return Object.fromEntries(Object.entries(normalizeMensilePrograms(programs)).map(([key, program]) => [
    key, { ...program, rows: null, title: '', warn: null },
  ]));
}

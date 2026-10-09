const validKey = key => /^\d{4}-\d{2}$/.test(key) && Number(key.slice(5)) >= 1 && Number(key.slice(5)) <= 12;

export function domenicaPeriodKey(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) return '';
  return String(year).padStart(4, '0') + '-' + String(month + 1).padStart(2, '0');
}

/** Restore Date objects from local JSON and Firestore. Invalid rows are discarded. */
/** @returns {Record<string, import('../types').DomenicaMonthProgram>} */
export function normalizeDomenicaPrograms(raw) {
  const programs = {};
  if (!raw || typeof raw !== 'object') return programs;
  for (const [key, value] of Object.entries(raw)) {
    if (!validKey(key) || !value || typeof value !== 'object') continue;
    const rows = Array.isArray(value.rows) ? value.rows.map(row => ({
      ...row, date: row.date instanceof Date ? new Date(row.date.getTime()) : new Date(row.date),
    })).filter(row => !Number.isNaN(row.date.getTime())) : null;
    programs[key] = {
      rows,
      title: typeof value.title === 'string' ? value.title : '',
      warn: typeof value.warn === 'string' ? value.warn : null,
      year: Number(key.slice(0, 4)),
      month: Number(key.slice(5)) - 1,
    };
  }
  return programs;
}

/** Migrate the surviving legacy programme using its real rows, not a changed selector. */
export function legacyDomenicaProgram(active) {
  if (!Array.isArray(active?.domRows) || active.domRows.length === 0) return null;
  const first = active.domRows.find(row => !row.placeholder) || active.domRows[0];
  const date = first.date instanceof Date ? first.date : new Date(first.date);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = date.getMonth();
  const key = domenicaPeriodKey(year, month);
  return { key, rows: active.domRows, year, month, title: active.domTitle || '', warn: active.domWarn || null };
}

/** Remote snapshots merge by period; a migrated legacy row never replaces a keyed entry. */
export function mergeDomenicaPrograms(local, active) {
  const result = { ...normalizeDomenicaPrograms(local), ...normalizeDomenicaPrograms(active?.domPrograms) };
  const legacy = legacyDomenicaProgram(active);
  if (legacy && !Object.prototype.hasOwnProperty.call(result, legacy.key)) {
    const { key, ...program } = legacy;
    Object.assign(result, normalizeDomenicaPrograms({ [key]: program }));
  }
  return result;
}

/** JSON-safe dates for both local cache and Firestore; null rows are deletion tombstones. */
export function serializeDomenicaPrograms(programs) {
  return Object.fromEntries(Object.entries(normalizeDomenicaPrograms(programs)).map(([key, program]) => [
    key, { ...program, rows: program.rows?.map(row => ({ ...row, date: row.date.toISOString() })) ?? null },
  ]));
}

/** Update one period without modifying any other saved month. */
export function updateDomenicaPeriod(programs, year, month, patch) {
  const key = domenicaPeriodKey(year, month);
  const normalized = normalizeDomenicaPrograms(programs);
  if (!key) return normalized;
  return normalizeDomenicaPrograms({ ...normalized, [key]: {
    rows: null, title: '', warn: null, ...normalized[key], ...patch, year, month,
  } });
}

export function clearDomenicaPrograms(programs) {
  return Object.fromEntries(Object.entries(normalizeDomenicaPrograms(programs)).map(([key, value]) => [
    key, { ...value, rows: null, title: '', warn: null },
  ]));
}

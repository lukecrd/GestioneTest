import { personNameKey } from './peopleRegistry';
import { inferPartTypeIds, isParticipantEligibleForPartTypes } from './ministeroPartTypes';

const validName = name => !!name?.trim() && !['—', '---', '-'].includes(name.trim());

export function dateKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

export function weeklyDates(value) {
  const sunday = dateKey(value);
  if (!sunday) return [];
  const wednesday = new Date(sunday + 'T12:00:00');
  wednesday.setDate(wednesday.getDate() + 3);
  return [sunday, dateKey(wednesday)];
}

/**
 * One identity across the registry and programme-specific IDs.
 * Names also cover older imported rows and unlinked participants.
 * @param {import('../types').StateData} state
 */
/** @param {import('../types').StateData} state
 * @param {import('../types').SchedulingPrograms} programs
 * @param {{ program?: string, dates?: string[] }} excluded */
export function createSchedulingLedger(state, programs = {}, excluded = {}) {
  const people = state.people || [];
  const byId = new Map(people.map(person => [person.id, person]));
  const byName = new Map();
  for (const person of people) {
    const key = personNameKey(person.name);
    const matches = byName.get(key) || [];
    matches.push(person);
    byName.set(key, matches);
  }
  const identity = record => {
    if (!record) return '';
    const person = byId.get(record.personId || record.id);
    if (person) return 'name:' + personNameKey(person.name);
    return validName(record.name) ? 'name:' + personNameKey(record.name) : '';
  };
  const occupied = new Map();
  const reserve = (record, dates) => {
    const key = identity(record);
    if (!key) return;
    for (const date of typeof dates === 'string' ? [dates] : dates) {
      if (!date) continue;
      if (!occupied.has(date)) occupied.set(date, new Set());
      occupied.get(date).add(key);
    }
  };
  const isBusy = (record, dates) => {
    const key = identity(record);
    return (typeof dates === 'string' ? [dates] : dates).some(date => occupied.get(date)?.has(key));
  };
  const isUnavailable = (record, dates) => {
    const person = byId.get(record?.personId || record?.id);
    const matches = person ? [person] : byName.get(personNameKey(record?.name || '')) || [];
    const keys = typeof dates === 'string' ? [dates] : dates;
    return matches.some(p => keys.some(date => state.unavail?.[p.id]?.includes(date)));
  };
  const excludedDates = new Set(excluded.dates || []);
  const add = (program, record, dates) => {
    reserve(record, (typeof dates === 'string' ? [dates] : dates)
      .filter(date => !(excluded.program === program && excludedDates.has(date))));
  };
  const named = name => ({ name });
  const monthly = row => {
    if (row.special || row.placeholder) return;
    const dates = weeklyDates(row.date || row.dateStr);
    const names = [...(row.ingresso || []), row.auditorium, ...(row.microfoni || []), ...(row.audioVideo || [])];
    names.filter(validName).forEach(name => add('mensile', named(name), dates));
  };
  // Most recently saved archive wins; the active programme overrides its dates.
  const monthlyRows = new Map();
  [...(state.mensileArchives || [])].sort((a, b) => (a.savedAt || '').localeCompare(b.savedAt || '')).forEach(archive =>
    (archive.rows || []).forEach(row => monthlyRows.set(row.dateStr, row)));
  (programs.mensileRows || []).forEach(row => monthlyRows.set(dateKey(row.date), row));
  monthlyRows.forEach(monthly);
  (programs.domenicaRows || []).forEach(row => {
    if (row.special || row.placeholder) return;
    [row.presidente, row.lettore, row.oratore].filter(validName).forEach(name =>
      add('domenica', named(name), dateKey(row.date)));
  });
  const vm = state.vitaEMinistero;
  const vmById = new Map((vm?.participants || []).map(p => [p.id, p]));
  (vm?.meetings || []).forEach(meeting => {
    if (meeting.isSpecialEvent) return;
    vitaAssignmentIds(meeting).forEach(id => add('vitaEMinistero', vmById.get(id), meeting.dateStr));
  });
  const field = state.servizioCampo;
  const fieldById = new Map((field?.conductors || []).map(p => [p.id, p]));
  (field?.schedule || []).forEach(meeting => {
    if (meeting.isActive !== false) add('servizioCampo', fieldById.get(meeting.conductorId), meeting.dateStr);
  });
  const publicWork = state.operaPubblica;
  const publicById = new Map((publicWork?.participants || []).map(p => [p.id, p]));
  (publicWork?.schedule || []).forEach(day => {
    if (day.turno1Active !== false) (day.turno1 || []).forEach(id => add('operaPubblica', publicById.get(id), day.dateStr));
    if (day.turno2Active !== false) (day.turno2 || []).forEach(id => add('operaPubblica', publicById.get(id), day.dateStr));
  });
  return { identity, reserve, isBusy, isUnavailable };
}

export function vitaAssignmentIds(meeting) {
  if (meeting.isSpecialEvent) return [];
  return [
    meeting.presidenteId, meeting.preghieraInizialeId, meeting.tesori1SpeakerId,
    meeting.tesoriGemmeSpeakerId, meeting.tesoriLetturaReaderId,
    ...(meeting.ministeroParts || []).flatMap(p => [p.studentId, p.hasAssistant ? p.assistantId : '']),
    ...(meeting.vitaCristianaParts || []).map(p => p.speakerId),
    ...(meeting.studioBiblicoType === 'discorsoSorvegliante' ? [] : [meeting.studioBiblicoConductorId, meeting.studioBiblicoReaderId]),
    meeting.preghieraFinaleId,
  ].filter(Boolean);
}

/** Fill scarce roles first; relocate a previous choice only to fill a blocked role. */
export function assignUniqueSlots(tasks, identity) {
  const assignments = new Map();
  const owners = new Map();
  const ordered = tasks.map((task, index) => ({ ...task, index }))
    .sort((a, b) => a.candidates.length - b.candidates.length || a.index - b.index);
  const byId = new Map(ordered.map(task => [task.id, task]));
  function place(task, seen) {
    // Keep the oldest free candidate before trying to displace another role.
    for (const candidate of task.candidates) {
      const key = identity(candidate);
      if (!key || seen.has(key) || owners.has(key)) continue;
      owners.set(key, task.id);
      assignments.set(task.id, candidate);
      return true;
    }
    for (const candidate of task.candidates) {
      const key = identity(candidate);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const previous = owners.get(key);
      if (previous !== undefined && place(byId.get(previous), seen)) {
        owners.set(key, task.id);
        assignments.set(task.id, candidate);
        return true;
      }
    }
    return false;
  }
  ordered.forEach(task => place(task, new Set()));
  return assignments;
}

/**
 * Regenerate only the selected month. Rotation uses actual earlier VM assignments,
 * ignores future assignments, and updates after each generated meeting.
 * @param {import('../types').StateData} state
 * @param {import('../types').VitaEMinisteroData} data
 * @param {import('../types').SchedulingPrograms} programs
 */
export function generateVitaAssignments(state, data, year, month, programs = {}) {
  const prefix = year + '-' + String(month + 1).padStart(2, '0') + '-';
  const targets = (data.meetings || []).filter(m => m.dateStr?.startsWith(prefix) && !m.isSpecialEvent)
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr) || a.id.localeCompare(b.id));
  const targetIds = new Set(targets.map(m => m.id));
  const ledger = createSchedulingLedger({ ...state, vitaEMinistero: data }, programs, {
    program: 'vitaEMinistero', dates: targets.map(m => m.dateStr),
  });
  const byId = new Map((data.participants || []).map(p => [p.id, p]));
  const history = [];
  (data.meetings || []).filter(m => !targetIds.has(m.id)).forEach(m =>
    vitaAssignmentIds(m).forEach(id => {
      const key = ledger.identity(byId.get(id));
      if (key && m.dateStr) history.push({ key, date: m.dateStr });
    }));
  const generated = new Map();
  const warnings = [];
  for (const original of targets) {
    if (state.special?.[original.dateStr]) {
      warnings.push(original.dateStr + ': data speciale, assegnazioni non rigenerate.');
      continue;
    }
    const m = { ...original,
      ministeroParts: (original.ministeroParts || []).map(p => ({ ...p })),
      vitaCristianaParts: (original.vitaCristianaParts || []).map(p => ({ ...p })),
    };
    const stats = new Map();
    for (const assignment of history) {
      if (assignment.date >= m.dateStr) continue;
      const current = stats.get(assignment.key) || { last: '', count: 0 };
      current.last = current.last > assignment.date ? current.last : assignment.date;
      current.count++;
      stats.set(assignment.key, current);
    }
    const compare = (a, b) => {
      const sa = stats.get(ledger.identity(a)) || { last: '', count: 0 };
      const sb = stats.get(ledger.identity(b)) || { last: '', count: 0 };
      return sa.last.localeCompare(sb.last) || sa.count - sb.count || a.name.localeCompare(b.name, 'it');
    };
    if (!m.tesori1Title) m.tesori1SpeakerId = '';
    const tasks = [];
    const addTask = (id, label, role, set, gender, partTypes) => {
      tasks.push({ id, label, set, candidates: (data.participants || []).filter(p =>
        p.roles?.[role] && (!gender || p.gender === gender) &&
        (!partTypes || isParticipantEligibleForPartTypes(p.roles, partTypes)) &&
        !ledger.isBusy(p, m.dateStr) && !ledger.isUnavailable(p, m.dateStr)).sort(compare) });
    };
    addTask('presidente', 'Presidente', 'presidente', p => { m.presidenteId = p; }, 'M');
    addTask('iniziale', 'Preghiera iniziale', 'preghiera', p => { m.preghieraInizialeId = p; }, 'M');
    if (m.tesori1Title) addTask('tesori', 'Discorso dei Tesori', 'tesoriDiscorso', p => { m.tesori1SpeakerId = p; }, 'M');
    addTask('gemme', 'Gemme spirituali', 'tesoriGemme', p => { m.tesoriGemmeSpeakerId = p; }, 'M');
    addTask('lettura', 'Lettura biblica', 'tesoriLettura', p => {
      if (p !== m.tesoriLetturaReaderId) m.tesoriLetturaSent = false;
      m.tesoriLetturaReaderId = p;
    }, 'M');
    m.ministeroParts.forEach((part, i) => {
      addTask('studente-' + i, 'Parte ' + part.number + ': studente', 'ministeroStudente', p => {
        if (p !== part.studentId) part.isSent = false;
        part.studentId = p;
      }, undefined, part.partTypeIds?.length ? part.partTypeIds : inferPartTypeIds(part.minutes, part.hasAssistant));
      if (part.hasAssistant) addTask('assistente-' + i, 'Parte ' + part.number + ': assistente', 'ministeroAssistente', p => {
        if (p !== part.assistantId) part.isSent = false;
        part.assistantId = p;
      });
    });
    m.vitaCristianaParts.forEach((part, i) =>
      addTask('vita-' + i, 'Parte ' + part.number, 'vitaCristianaParti', p => { part.speakerId = p; }, 'M'));
    if (m.studioBiblicoType !== 'discorsoSorvegliante') {
      addTask('studio', 'Studio biblico: conduttore', 'studioBiblicoConduttore', p => { m.studioBiblicoConductorId = p; }, 'M');
      addTask('studio-lettore', 'Studio biblico: lettore', 'studioBiblicoLettore', p => { m.studioBiblicoReaderId = p; }, 'M');
    }
    addTask('finale', 'Preghiera finale', 'preghiera', p => { m.preghieraFinaleId = p; }, 'M');
    const assigned = assignUniqueSlots(tasks, ledger.identity);
    for (const task of tasks) {
      const person = assigned.get(task.id);
      task.set(person?.id || '');
      if (person) {
        ledger.reserve(person, m.dateStr);
        history.push({ key: ledger.identity(person), date: m.dateStr });
      } else warnings.push(m.dateStr + ': ' + task.label + ' da assegnare (nessun nominativo idoneo libero).');
    }
    generated.set(m.id, m);
  }
  return { meetings: (data.meetings || []).map(m => generated.get(m.id) || m), warnings, generatedCount: generated.size };
}

import type { Person, StateData } from '../types';

export function personNameKey(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('it');
}

export function duplicatePersonNames(people: Person[]): string[] {
  const groups = new Map<string, Person[]>();
  for (const person of people) {
    const key = personNameKey(person.name);
    if (!key) continue;
    const group = groups.get(key) || [];
    group.push(person);
    groups.set(key, group);
  }
  return [...groups.values()].filter(group => group.length > 1).map(group => group[0].name);
}

/** Preserve programme IDs and assignments; master registry owns linked names and gender. */
export function syncRegistryLinks(state: StateData): StateData {
  const legacyParticipants = state.vitaEMinistero?.participants || [];
  const nameCounts = new Map<string, number>();
  for (const person of state.people) {
    const key = personNameKey(person.name);
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }
  const people = state.people.map(person => {
    const legacyMidweek = legacyParticipants.some(participant =>
      participant.roles.presidente && (participant.personId
        ? participant.personId === person.id
        : nameCounts.get(personNameKey(person.name)) === 1 && personNameKey(participant.name) === personNameKey(person.name)));
    const presidentePubblica = typeof person.roles.presidentePubblica === 'boolean' ? person.roles.presidentePubblica : !!person.roles.presidente;
    const presidenteInfrasettimanale = typeof person.roles.presidenteInfrasettimanale === 'boolean' ? person.roles.presidenteInfrasettimanale : legacyMidweek;
    return { ...person, roles: { ...person.roles, presidentePubblica, presidenteInfrasettimanale, presidente: presidentePubblica } };
  });
  const byId = new Map(people.map(person => [person.id, person]));
  const byName = new Map<string, Person[]>();
  for (const person of people) {
    const key = personNameKey(person.name);
    const matches = byName.get(key) || [];
    matches.push(person);
    byName.set(key, matches);
  }
  function linked<T extends { name: string; personId?: string | null; gender?: 'M' | 'F' }>(record: T): T {
    const matches = byName.get(personNameKey(record.name)) || [];
    const person = record.personId ? byId.get(record.personId) : matches.length === 1 ? matches[0] : undefined;
    return person ? { ...record, personId: person.id, name: person.name, gender: person.gender } : record;
  }
  const ministryParticipants = legacyParticipants.map(record => {
    const result = linked(record);
    const person = result.personId ? byId.get(result.personId) : undefined;
    return person ? { ...result, roles: { ...result.roles, presidente: person.roles.presidenteInfrasettimanale } } : result;
  });
  const usedIds = new Set(ministryParticipants.map(participant => participant.id));
  for (const person of people) {
    if (!person.roles.presidenteInfrasettimanale || ministryParticipants.some(participant => participant.personId === person.id)) continue;
    let id = 'vm_person_' + person.id;
    while (usedIds.has(id)) id += '_';
    usedIds.add(id);
    ministryParticipants.push({
      id, personId: person.id, name: person.name, gender: person.gender,
      roles: { presidente: true, preghiera: false, tesoriDiscorso: false, tesoriGemme: false, tesoriLettura: false,
        ministeroStudente: false, ministeroAssistente: false, vitaCristianaParti: false,
        studioBiblicoConduttore: false, studioBiblicoLettore: false },
    });
  }
  return {
    ...state,
    people,
    operaPubblica: state.operaPubblica ? { ...state.operaPubblica, participants: (state.operaPubblica.participants || []).map(linked) } : state.operaPubblica,
    servizioCampo: state.servizioCampo ? { ...state.servizioCampo, conductors: (state.servizioCampo.conductors || []).map(linked) } : state.servizioCampo,
    vitaEMinistero: state.vitaEMinistero ? { ...state.vitaEMinistero, participants: ministryParticipants } : state.vitaEMinistero,
  };
}

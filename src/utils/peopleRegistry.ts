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
  const byId = new Map(state.people.map(person => [person.id, person]));
  const byName = new Map<string, Person[]>();
  for (const person of state.people) {
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
  return {
    ...state,
    operaPubblica: state.operaPubblica ? { ...state.operaPubblica, participants: (state.operaPubblica.participants || []).map(linked) } : state.operaPubblica,
    servizioCampo: state.servizioCampo ? { ...state.servizioCampo, conductors: (state.servizioCampo.conductors || []).map(linked) } : state.servizioCampo,
    vitaEMinistero: state.vitaEMinistero ? { ...state.vitaEMinistero, participants: (state.vitaEMinistero.participants || []).map(linked) } : state.vitaEMinistero,
  };
}

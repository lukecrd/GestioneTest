import React, { useState } from 'react';
import type { Person } from '../types';

export function SundayPresidentsList({ people, isAdmin, onChange, onOpenRegistry }: {
  people: Person[];
  isAdmin: boolean;
  onChange: (personId: string, enabled: boolean) => void;
  onOpenRegistry: () => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const presidents = people.filter(person => person.roles.presidente).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const available = people.filter(person => person.gender === 'M' && !person.roles.presidente).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  return <section className="card no-print space-y-4" aria-label="Presidenti adunanza pubblica della domenica">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="card-title">Presidenti adunanza pubblica — Domenica</h2>
        <p className="text-sm text-slate-500 mt-1">Lista dedicata collegata all’anagrafica generale. Usata nella generazione e nella scelta del presidente.</p>
      </div><span className="text-sm font-semibold">{presidents.length} abilitati</span>
    </div>
    {presidents.length ? <ul className="divide-y divide-slate-100">
      {presidents.map(person => <li key={person.id} className="flex items-center justify-between gap-3 py-2">
        <span>{person.name}</span>{isAdmin && <button type="button" className="btn-ghost text-rose-600" aria-label={`Rimuovi ${person.name} dalla lista presidenti`} onClick={() => onChange(person.id, false)}>Rimuovi dalla lista</button>}
      </li>)}
    </ul> : <p className="text-sm text-slate-500">Nessun presidente abilitato. Aggiungi i nominativi dall’anagrafica.</p>}
    {isAdmin && <div className="flex flex-wrap gap-2">
      <select className="inp flex-1 min-w-0" aria-label="Aggiungi presidente dall’anagrafica" value={available.some(person => person.id === selectedId) ? selectedId : ''} onChange={event => setSelectedId(event.target.value)}>
        <option value="">Seleziona un fratello dall’anagrafica</option>
        {available.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select>
      <button type="button" className="btn-primary" disabled={!available.some(person => person.id === selectedId)} onClick={() => { onChange(selectedId, true); setSelectedId(''); }}>Aggiungi presidente</button>
      <button type="button" className="btn-ghost" onClick={onOpenRegistry}>Apri anagrafica generale</button>
    </div>}
    <p className="text-xs text-slate-500">Rimuovere un nome da questa lista toglie soltanto l’abilitazione: la persona e i programmi già salvati restano disponibili.</p>
  </section>;
}

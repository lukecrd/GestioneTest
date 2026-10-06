import { accessRequest } from './accessClient';
import type { AccessProfile } from '../accessPolicy';

import { StateData, MensileRow, DomenicaRow } from '../types';



// Helper to serialize Date objects in row arrays
function serializeMensileRows(rows: MensileRow[] | null) {
  if (!rows) return null;
  return rows.map(r => ({
    ...r,
    date: r.date instanceof Date ? r.date.toISOString() : r.date,
  }));
}

function deserializeMensileRows(rows: any[] | null): MensileRow[] | null {
  if (!rows) return null;
  return rows.map(r => ({
    ...r,
    date: new Date(r.date),
  }));
}

function serializeDomenicaRows(rows: DomenicaRow[] | null) {
  if (!rows) return null;
  return rows.map(r => {
    const { preghiera: _legacyPrayer, ...programRow } = r as DomenicaRow & { preghiera?: string };
    return {
      ...programRow,
      date: r.date instanceof Date ? r.date.toISOString() : r.date,
    };
  });
}

function deserializeDomenicaRows(rows: any[] | null): DomenicaRow[] | null {
  if (!rows) return null;
  return rows.map(r => ({
    ...r,
    date: new Date(r.date),
  }));
}

export interface ActiveProgramsData {
  menRows: MensileRow[] | null;
  menTitle: string;
  menWarn: string | null;
  menMonth: number;
  menYear: number;
  domRows: DomenicaRow[] | null;
  domTitle: string;
  domWarn: string | null;
  domMonth: number;
  domYear: number;
}


export function subscribeToCongregation(onUpdate: (data: { state?: StateData; activePrograms?: Partial<ActiveProgramsData>; user?: AccessProfile }) => void, onError: (err: any) => void) {
  let stopped = false; let timer: ReturnType<typeof setTimeout>;
  const read = async () => {
    try {
      const raw = await accessRequest('/data');
      if (stopped) return;
      const ap = { ...raw.activePrograms };
      if ('menRows' in ap) ap.menRows = deserializeMensileRows(ap.menRows);
      if ('domRows' in ap) ap.domRows = deserializeDomenicaRows(ap.domRows);
      onUpdate({ state: raw.state, activePrograms: ap, user: raw.user });
    } catch (error) { if (!stopped) onError(error); }
    if (!stopped) timer = setTimeout(read, 10000);
  };
  void read(); return () => { stopped = true; clearTimeout(timer); };
}
export async function pushStateToFirestore(state: StateData, section: string) {
  await accessRequest('/data', 'PATCH', { state: JSON.parse(JSON.stringify(state)), section });
}
export async function pushActiveProgramsToFirestore(programs: ActiveProgramsData, section: string) {
  const activePrograms = { ...programs, menRows: serializeMensileRows(programs.menRows), domRows: serializeDomenicaRows(programs.domRows) };
  await accessRequest('/data', 'PATCH', { activePrograms, section });
}

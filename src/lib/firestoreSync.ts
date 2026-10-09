import { normalizeDomenicaPrograms, serializeDomenicaPrograms } from '../utils/domenicaPrograms';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { StateData, MensileRow, DomenicaRow, DomenicaMonthProgram } from '../types';

const DOC_REF = doc(db, 'congregationData', 'main');

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
  domPrograms?: Record<string, DomenicaMonthProgram>;
}

export function subscribeToCongregation(
  onUpdate: (data: { state?: StateData; activePrograms?: ActiveProgramsData }) => void,
  onError: (err: any) => void
) {
  return onSnapshot(
    DOC_REF,
    (snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.data();
        const result: { state?: StateData; activePrograms?: ActiveProgramsData } = {};

        if (raw.state) {
          result.state = raw.state as StateData;
        }

        if (raw.activePrograms) {
          const ap = raw.activePrograms;
          result.activePrograms = {
            menRows: deserializeMensileRows(ap.menRows),
            menTitle: ap.menTitle || '',
            menWarn: ap.menWarn || null,
            menMonth: typeof ap.menMonth === 'number' ? ap.menMonth : new Date().getMonth(),
            menYear: typeof ap.menYear === 'number' ? ap.menYear : new Date().getFullYear(),
            domPrograms: normalizeDomenicaPrograms(ap.domPrograms),
            domRows: deserializeDomenicaRows(ap.domRows),
            domTitle: ap.domTitle || '',
            domWarn: ap.domWarn || null,
            domMonth: typeof ap.domMonth === 'number' ? ap.domMonth : new Date().getMonth(),
            domYear: typeof ap.domYear === 'number' ? ap.domYear : new Date().getFullYear(),
          };
        }

        onUpdate(result);
      }
    },
    (error) => {
      onError(error);
    }
  );
}

export async function pushStateToFirestore(state: StateData) {
  const cleanState = JSON.parse(JSON.stringify(state));
  await setDoc(
    DOC_REF,
    {
      state: cleanState,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function pushActiveProgramsToFirestore(programs: ActiveProgramsData) {
  const payload = {
    activePrograms: {
      menRows: serializeMensileRows(programs.menRows),
      menTitle: programs.menTitle,
      menWarn: programs.menWarn,
      menMonth: programs.menMonth,
      menYear: programs.menYear,
      // Only touched periods are sent. Omit empty maps: Firestore would erase the map.
      ...(Object.keys(programs.domPrograms || {}).length
        ? { domPrograms: serializeDomenicaPrograms(programs.domPrograms) } : {}),
      domRows: serializeDomenicaRows(programs.domRows),
      domTitle: programs.domTitle,
      domWarn: programs.domWarn,
      domMonth: programs.domMonth,
      domYear: programs.domYear,
    },
    updatedAt: new Date().toISOString(),
  };
  const cleanPayload = JSON.parse(JSON.stringify(payload));
  await setDoc(DOC_REF, cleanPayload, { merge: true });
}

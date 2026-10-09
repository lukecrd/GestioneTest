import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { domenicaPeriodKey, normalizeDomenicaPrograms, legacyDomenicaProgram, mergeDomenicaPrograms, serializeDomenicaPrograms, updateDomenicaPeriod, clearDomenicaPrograms } from '../src/utils/domenicaPrograms.js';

const rows = (date, speaker) => [{ date: new Date(date + 'T12:00:00'), oratore: speaker, presidente: 'Presidente', lettore: 'Lettore', titoloDiscorso: 'Titolo' }];
const save = (programs, year, month, speaker) => updateDomenicaPeriod(programs, year, month, {
  rows: rows(year + '-' + String(month + 1).padStart(2, '0') + '-04', speaker), title: 'Programma ' + year + '-' + month,
});

test('October -> November -> October restores the original programme and manual speaker/title changes', () => {
  let programs = save({}, 2026, 9, 'Oratore ottobre');
  programs = updateDomenicaPeriod(programs, 2026, 9, { rows: [{ ...programs['2026-10'].rows[0], titoloDiscorso: 'Titolo modificato' }] });
  programs = save(programs, 2026, 10, 'Oratore novembre');
  assert.equal(programs[domenicaPeriodKey(2026, 9)].rows[0].oratore, 'Oratore ottobre');
  assert.equal(programs['2026-10'].rows[0].titoloDiscorso, 'Titolo modificato');
  assert.equal(programs['2026-11'].rows[0].oratore, 'Oratore novembre');
  assert.equal(programs['2026-12'], undefined);
});

test('same month in different years remains independent', () => {
  const programs = save(save({}, 2026, 9, '2026'), 2027, 9, '2027');
  assert.equal(programs['2026-10'].rows[0].oratore, '2026');
  assert.equal(programs['2027-10'].rows[0].oratore, '2027');
});

test('JSON cache and cloud round-trip restore real Date objects and all custom fields', () => {
  const programs = save(save({}, 2026, 9, 'Ottobre'), 2026, 10, 'Novembre');
  const restored = normalizeDomenicaPrograms(JSON.parse(JSON.stringify(serializeDomenicaPrograms(programs))));
  assert.ok(restored['2026-10'].rows[0].date instanceof Date);
  assert.equal(restored['2026-10'].rows[0].date.getTime(), programs['2026-10'].rows[0].date.getTime());
  assert.equal(restored['2026-11'].rows[0].oratore, 'Novembre');
});

test('legacy programme migrates by actual row date when the selector previously pointed at a different month', () => {
  const active = { domRows: rows('2026-10-04', 'Originale'), domMonth: 10, domYear: 2026, domTitle: 'Ottobre 2026' };
  const legacy = legacyDomenicaProgram(active);
  assert.equal(legacy.key, '2026-10');
  const restored = mergeDomenicaPrograms({}, active);
  assert.equal(restored['2026-10'].rows[0].oratore, 'Originale');
  assert.equal(restored['2026-11'], undefined);
});

test('remote November snapshots preserve locally saved October; keyed data beats stale legacy data', () => {
  const october = save({}, 2026, 9, 'Ottobre');
  const november = save({}, 2026, 10, 'Novembre');
  const result = mergeDomenicaPrograms(october, { domPrograms: serializeDomenicaPrograms(november), domRows: rows('2026-10-04', 'Vecchio') });
  assert.equal(result['2026-10'].rows[0].oratore, 'Ottobre');
  assert.equal(result['2026-11'].rows[0].oratore, 'Novembre');
});

test('resetting one month leaves others intact and the null tombstone survives cloud serialization', () => {
  const programs = updateDomenicaPeriod(save(save({}, 2026, 9, 'Ottobre'), 2026, 10, 'Novembre'), 2026, 9, { rows: null, warn: null });
  const restored = normalizeDomenicaPrograms(serializeDomenicaPrograms(programs));
  assert.equal(restored['2026-10'].rows, null);
  assert.equal(restored['2026-11'].rows[0].oratore, 'Novembre');
  const merged = mergeDomenicaPrograms({}, { domPrograms: restored, domRows: rows('2026-10-04', 'Vecchio') });
  assert.equal(merged['2026-10'].rows, null);
});

test('full reset emits explicit tombstones for every month, preventing cloud merge resurrection', () => {
  const cleared = clearDomenicaPrograms(save(save({}, 2026, 9, 'Ottobre'), 2026, 10, 'Novembre'));
  assert.equal(cleared['2026-10'].rows, null);
  assert.equal(cleared['2026-11'].rows, null);
  assert.deepEqual(Object.keys(cleared), ['2026-10', '2026-11']);
});

test('invalid cache keys and dates do not crash programme rendering', () => {
  const restored = normalizeDomenicaPrograms({ broken: {}, '2026-13': {}, '2026-10': { rows: [{ date: 'bad-date' }] } });
  assert.deepEqual(Object.keys(restored), ['2026-10']);
  assert.deepEqual(restored['2026-10'].rows, []);
  assert.equal(domenicaPeriodKey(NaN, 9), '');
});

test('actual App sync saves only the edited period plus unsynced legacy months', () => {
  const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('  const syncActivePrograms =');
  const end = source.indexOf('\n  };', start) + '\n  };'.length;
  const compiled = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const october = save({}, 2026, 9, 'Ottobre');
  const domProgramsRef = { current: october };
  const domCloudKeys = { current: new Set() };
  let payload;
  const context = { domenicaPeriodKey, updateDomenicaPeriod, domProgramsRef, domCloudKeys,
    persistDomenicaPrograms: programs => { domProgramsRef.current = normalizeDomenicaPrograms(programs); },
    menRows: null, menTitle: '', menWarn: null, menMonth: 9, menYear: 2026,
    domRows: october['2026-10'].rows, domTitle: 'Ottobre', domWarn: null, domMonth: 9, domYear: 2026,
    pushActiveProgramsToFirestore: data => { payload = data; return Promise.resolve(); },
  };
  const fn = new Function(...Object.keys(context), compiled + '; return syncActivePrograms;')(...Object.values(context));
  fn({ domRows: rows('2026-11-01', 'Novembre'), domMonth: 10, domYear: 2026, domTitle: 'Novembre' });
  assert.deepEqual(Object.keys(payload.domPrograms), ['2026-10', '2026-11']);
  assert.equal(domProgramsRef.current['2026-10'].rows[0].oratore, 'Ottobre');
  assert.equal(domProgramsRef.current['2026-11'].rows[0].oratore, 'Novembre');
  domCloudKeys.current.add('2026-10');
  domCloudKeys.current.add('2026-11');
  fn({ domRows: rows('2026-10-04', 'Ottobre modificato') });
  assert.deepEqual(Object.keys(payload.domPrograms), ['2026-10']);
  assert.equal(domProgramsRef.current['2026-11'].rows[0].oratore, 'Novembre');
});

test('Firestore round-trip includes monthly programmes and unrelated writes omit an empty archive map', async () => {
  const source = readFileSync(new URL('../src/lib/firestoreSync.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let payload;
  const raw = { activePrograms: { domMonth: 9, domYear: 2026 } };
  const api = new Function('doc', 'db', 'onSnapshot', 'setDoc', 'normalizeDomenicaPrograms', 'serializeDomenicaPrograms',
    compiled + ';return {pushActiveProgramsToFirestore,subscribeToCongregation};')(
      () => ({}), {}, (ref, callback) => { callback({ exists: () => true, data: () => raw }); return () => {}; },
      async (ref, data) => { payload = data; }, normalizeDomenicaPrograms, serializeDomenicaPrograms);
  const active = { menRows: null, menTitle: '', menWarn: null, menMonth: 9, menYear: 2026,
    domRows: null, domTitle: '', domWarn: null, domMonth: 9, domYear: 2026, domPrograms: {} };
  await api.pushActiveProgramsToFirestore(active);
  assert.equal(Object.hasOwn(payload.activePrograms, 'domPrograms'), false);
  await api.pushActiveProgramsToFirestore({ ...active, domPrograms: save({}, 2026, 9, 'Salvato') });
  assert.deepEqual(Object.keys(payload.activePrograms.domPrograms), ['2026-10']);
  assert.equal(typeof payload.activePrograms.domPrograms['2026-10'].rows[0].date, 'string');
  raw.activePrograms = payload.activePrograms;
  let restored;
  api.subscribeToCongregation(data => { restored = data.activePrograms.domPrograms; }, error => { throw error; });
  assert.ok(restored['2026-10'].rows[0].date instanceof Date);
  assert.equal(restored['2026-10'].rows[0].oratore, 'Salvato');
});

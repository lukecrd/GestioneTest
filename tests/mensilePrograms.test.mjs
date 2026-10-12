import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { normalizeMensilePrograms, legacyMensileProgram, mergeMensilePrograms, serializeMensilePrograms, updateMensilePeriod, clearMensilePrograms } from '../src/utils/mensilePrograms.js';
import { domenicaPeriodKey, updateDomenicaPeriod } from '../src/utils/domenicaPrograms.js';

const rows = (date, name) => [{ date: new Date(date + 'T12:00:00'), ingresso: [name, 'Altro'], auditorium: 'Prova', microfoni: ['A', 'B'], audioVideo: ['C', 'D'], riassetto: '1', pulizie: 'Massa' }];
const save = (programs, year, month, name) => updateMensilePeriod(programs, year, month, { rows: rows(year + '-' + String(month + 1).padStart(2, '0') + '-04', name), title: 'Titolo' });

test('mensile October -> November -> October keeps manual assignments and groups', () => {
  let programs = save({}, 2026, 9, 'Ottobre');
  programs = updateMensilePeriod(programs, 2026, 9, { rows: [{ ...programs['2026-10'].rows[0], riassetto: '3', pulizie: '4' }] });
  programs = save(programs, 2026, 10, 'Novembre');
  assert.equal(programs['2026-10'].rows[0].ingresso[0], 'Ottobre');
  assert.equal(programs['2026-10'].rows[0].riassetto, '3');
  assert.equal(programs['2026-10'].rows[0].pulizie, '4');
  assert.equal(programs['2026-11'].rows[0].ingresso[0], 'Novembre');
});

test('mensile month maps remain independent across years and JSON reloads', () => {
  const saved = save(save({}, 2026, 9, 'Vecchio'), 2027, 9, 'Nuovo');
  const restored = normalizeMensilePrograms(JSON.parse(JSON.stringify(serializeMensilePrograms(saved))));
  assert.equal(restored['2026-10'].rows[0].ingresso[0], 'Vecchio');
  assert.equal(restored['2027-10'].rows[0].ingresso[0], 'Nuovo');
  assert.ok(restored['2026-10'].rows[0].date instanceof Date);
  assert.equal(restored['2026-11'], undefined);
});

test('mensile recovers archived October while the only active legacy programme is November', () => {
  const archive = { month: 9, year: 2026, title: 'Ottobre', savedAt: '2026-10-08',
    rows: [{ dateStr: '2026-10-04', ingresso: ['Archiviato', 'Prova'], riassetto: '2' }] };
  const result = mergeMensilePrograms({}, { menRows: rows('2026-11-01', 'Attivo'), menTitle: 'Novembre', menYear: 2026, menMonth: 10 }, [archive]);
  assert.equal(result['2026-10'].rows[0].ingresso[0], 'Archiviato');
  assert.equal(result['2026-11'].rows[0].ingresso[0], 'Attivo');
});

test('legacy migration trusts the row date over an already changed selector and an older archive', () => {
  const archive = { month: 9, year: 2026, rows: [{ dateStr: '2026-10-04', ingresso: ['Vecchio', 'Prova'] }] };
  const result = mergeMensilePrograms({}, { menRows: rows('2026-10-04', 'Modificato'), menMonth: 10, menYear: 2026 }, [archive]);
  assert.equal(result['2026-10'].rows[0].ingresso[0], 'Modificato');
  assert.equal(result['2026-11'], undefined);
  assert.equal(legacyMensileProgram({ menRows: rows('2026-10-04', 'Prova') }).month, 9);
});

test('cleared months stay cleared after archive reload and other months remain available', () => {
  const programs = updateMensilePeriod(save(save({}, 2026, 9, 'Ottobre'), 2026, 10, 'Novembre'), 2026, 9, { rows: null });
  const merged = mergeMensilePrograms(programs, {}, [{ month: 9, year: 2026, rows: [{ dateStr: '2026-10-04', ingresso: ['Vecchio', 'Prova'] }] }]);
  assert.equal(merged['2026-10'].rows, null);
  assert.equal(merged['2026-11'].rows[0].ingresso[0], 'Novembre');
  const cleared = clearMensilePrograms(programs);
  assert.equal(cleared['2026-10'].rows, null);
  assert.equal(cleared['2026-11'].rows, null);
});

test('mensile never renders rows from a different month under the selected period', () => {
  const result = normalizeMensilePrograms({ '2026-10': { rows: rows('2026-11-01', 'Wrong') } });
  assert.equal(result['2026-10'].rows, null);
});

test('actual App sync persists one edited month and preserves all other monthly and Sunday programmes', () => {
  const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('  const syncActivePrograms =');
  const end = source.indexOf('\n  };', start) + '\n  };'.length;
  const compiled = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const menProgramsRef = { current: save({}, 2026, 9, 'Ottobre') };
  const domProgramsRef = { current: { '2026-10': { rows: null, title: '', year: 2026, month: 9, warn: null } } };
  const menCloudKeys = { current: new Set() };
  let payload;
  const context = { domenicaPeriodKey, updateDomenicaPeriod, updateMensilePeriod, menProgramsRef, domProgramsRef, menCloudKeys,
    domCloudKeys: { current: new Set(['2026-10']) },
    persistMensilePrograms: programs => { menProgramsRef.current = normalizeMensilePrograms(programs); },
    persistDomenicaPrograms: () => {}, menRows: menProgramsRef.current['2026-10'].rows, menTitle: 'Ottobre', menWarn: null, menMonth: 9, menYear: 2026,
    domRows: null, domTitle: 'Ottobre', domWarn: null, domMonth: 9, domYear: 2026,
    pushActiveProgramsToFirestore: data => { payload = data; return Promise.resolve(); }, setSyncMsg: () => {}, setSyncClass: () => {},
  };
  const fn = new Function(...Object.keys(context), compiled + '; return syncActivePrograms;')(...Object.values(context));
  fn({ menRows: rows('2026-11-01', 'Novembre'), menMonth: 10, menYear: 2026, menTitle: 'Novembre' });
  assert.deepEqual(Object.keys(payload.menPrograms), ['2026-10', '2026-11']);
  assert.equal(menProgramsRef.current['2026-10'].rows[0].ingresso[0], 'Ottobre');
  assert.equal(menProgramsRef.current['2026-11'].rows[0].ingresso[0], 'Novembre');
  assert.deepEqual(payload.domPrograms, {});
  menCloudKeys.current.add('2026-10');
  menCloudKeys.current.add('2026-11');
  fn({ menRows: rows('2026-10-04', 'Ottobre modificato') });
  assert.deepEqual(Object.keys(payload.menPrograms), ['2026-10']);
  assert.equal(menProgramsRef.current['2026-11'].rows[0].ingresso[0], 'Novembre');
});

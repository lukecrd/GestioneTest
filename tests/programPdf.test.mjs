import test from 'node:test';
import assert from 'node:assert/strict';
import { calcolaTagli } from '../src/utils/programPdf.tsx';

test('PDF programmi: una pagina sola non ha tagli', () => {
  assert.deepEqual(calcolaTagli([100, 200], 900, 1000), []);
});

test('PDF programmi: si va a capo alla fine dell\'ultimo blocco che entra', () => {
  // blocchi che finiscono a 400, 900, 1300, 1900: pagina da 1000 → taglio a 900, poi a 1900
  assert.deepEqual(calcolaTagli([400, 900, 1300, 1900], 2500, 1000), [900, 1900]);
});

test('PDF programmi: un blocco più alto di una pagina viene tagliato a pagina piena', () => {
  assert.deepEqual(calcolaTagli([2500], 2500, 1000), [1000, 2000]);
});

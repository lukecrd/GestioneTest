import test from 'node:test';
import assert from 'node:assert/strict';
import { descriviModifiche, campoLeggibile } from '../src/utils/logDiff.js';

const nomi = new Map([['p1', 'Mario Rossi'], ['p2', 'Luca Bianchi']]);

test('territori: assegnazione nuova e rientro, con numero e proclamatore', () => {
  const prima = { assegnazioni: [{ id: 'a', numero: '12', proclamatore: 'Mario Rossi', assegnato: '2026-09-01' }] };
  const dopo = { assegnazioni: [
    { id: 'a', numero: '12', proclamatore: 'Mario Rossi', assegnato: '2026-09-01', rientro: '2026-11-10' },
    { id: 'b', numero: '35A', proclamatore: 'Luca Bianchi', assegnato: '2026-11-10' },
  ] };
  assert.deepEqual(descriviModifiche(prima, dopo, nomi), [
    'assegnazioni: aggiunto 35A · Luca Bianchi',
    'assegnazioni › 12 · Mario Rossi › rientro: — → 10/11/2026',
  ]);
});

test('persone e assenze: nomi al posto degli id, date in italiano', () => {
  assert.deepEqual(descriviModifiche([{ id: 'p1', name: 'Mario Rossi' }], [{ id: 'p1', name: 'Mario Rossi' }, { id: 'p2', name: 'Luca Bianchi' }], nomi),
    ['aggiunto Luca Bianchi']);
  assert.deepEqual(descriviModifiche({ p1: ['2026-11-03'] }, { p1: ['2026-11-03', '2026-11-10'] }, nomi), ['Mario Rossi: aggiunto 10/11/2026']);
  assert.deepEqual(descriviModifiche({ presidenteId: 'p1' }, { presidenteId: 'p2' }, nomi), ['presidente: Mario Rossi → Luca Bianchi']);
});

test('programma mensile: righe riconosciute per data, anche con Date', () => {
  const riga = (d, usciere) => ({ date: new Date(d + 'T12:00:00Z'), auditorium: usciere });
  const prima = { '2026-11': { title: 'Novembre', rows: [riga('2026-11-03', 'Verdi'), riga('2026-11-10', 'Neri')] } };
  const dopo = { '2026-11': { title: 'Novembre', rows: [riga('2026-11-03', 'Gialli'), riga('2026-11-10', 'Neri')] } };
  assert.deepEqual(descriviModifiche(prima, dopo, nomi), ['novembre 2026 › righe › 03/11/2026 › auditorium: Verdi → Gialli']);
});

test('nessuna modifica, limite righe e testo lungo', () => {
  assert.deepEqual(descriviModifiche({ a: 1 }, { a: 1 }), []);
  const molte = descriviModifiche({}, Object.fromEntries(Array.from({ length: 300 }, (_, i) => ['k' + i, i])));
  assert.equal(molte.length, 100);
  assert.equal(molte.at(-1), '…e altre modifiche');
  assert.ok(descriviModifiche({ t: 'a' }, { t: 'x'.repeat(500) })[0].length <= 300);
  assert.equal(campoLeggibile('preghieraInizialeId'), 'preghiera iniziale');
  assert.equal(campoLeggibile('spouseId'), 'coniuge');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDiscorsiEsterni, ordinaUscite, conflittoUscita, giaPresentato, congregazioniUsate, settimaneDelMese, uscitePerGiorno } from '../src/utils/discorsiEsterni.js';

const uscite = [
  { id: 'a', data: '2026-09-06', oratore: 'Mario Rossi', titolo: 'Conoscete bene Dio?', congregazione: 'Grosseto Nord' },
  { id: 'b', data: '2026-11-08', oratore: 'Mario Rossi', titolo: 'Vero aiuto per la famiglia', congregazione: 'Follonica' },
  { id: 'c', data: '2026-10-20', oratore: 'Luca Bianchi', titolo: 'Conoscete bene Dio?', congregazione: 'grosseto nord ' },
  { id: 'd', data: '2026-10-13', oratore: 'Luca Bianchi', titolo: 'Vero aiuto per la famiglia', congregazione: 'Massa Marittima' },
];

test('normalize scarta voci incomplete e schemi doppi', () => {
  const n = normalizeDiscorsiEsterni({
    oratori: [{ nome: 'Mario Rossi', schemi: ['A', 'A', 'B', 3] }, { nome: '  ' }],
    uscite: [...uscite, { id: 'x', data: '2026-01-01', oratore: 'Mario Rossi' }],
  });
  assert.deepEqual(n.oratori.map(o => [o.nome, o.schemi]), [['Mario Rossi', ['A', 'B']]]);
  assert.equal(n.uscite.length, 4);
  assert.deepEqual(normalizeDiscorsiEsterni(undefined), { oratori: [], uscite: [] });
});

test('prossime in ordine di data (oggi compreso), storico dal più recente', () => {
  const { prossime, passate } = ordinaUscite(uscite, '2026-10-13');
  assert.deepEqual(prossime.map(u => u.id), ['d', 'c', 'b']);
  assert.deepEqual(passate.map(u => u.id), ['a']);
});

test('stesso oratore, stessa data: conflitto (ma non con se stessa)', () => {
  assert.equal(conflittoUscita(uscite, { oratore: 'Mario Rossi', data: '2026-11-08' }).id, 'b');
  assert.equal(conflittoUscita(uscite, { id: 'b', oratore: 'Mario Rossi', data: '2026-11-08' }), null);
  assert.equal(conflittoUscita(uscite, { oratore: 'Luca Bianchi', data: '2026-11-08' }), null);
});

test('schema già portato in quella congregazione, senza badare a maiuscole e spazi', () => {
  const g = giaPresentato(uscite, { oratore: 'Luca Bianchi', titolo: 'Conoscete bene Dio?', congregazione: 'Grosseto Nord' });
  assert.equal(g.id, 'c');
  assert.equal(giaPresentato(uscite, { oratore: 'Mario Rossi', titolo: 'Conoscete bene Dio?', congregazione: 'Follonica' }), null);
});

test('elenco congregazioni senza doppioni', () => {
  assert.deepEqual(congregazioniUsate(uscite), ['Follonica', 'Grosseto Nord', 'Massa Marittima']);
});

test('schemi S-99: numeri ufficiali, solo i 7 "non disponibili" mancano', async () => {
  const { SCHEMI_DISCORSI_PUBBLICI: schemi, TITOLI_DISCORSI_PUBBLICI: titoli } = await import('../src/data/titoliDiscorsiPubblici.ts');
  const numeri = schemi.map(s => s.numero);
  const mancanti = Array.from({ length: 194 }, (_, i) => i + 1).filter(n => !numeri.includes(n));
  assert.deepEqual(mancanti, [47, 59, 82, 112, 122, 123, 131]);
  assert.equal(new Set(titoli).size, titoli.length);
  assert.equal(schemi.find(s => s.numero === 48).titolo, 'Rimaniamo leali a Dio quando siamo messi alla prova');
});

test('calendario: settimane da lunedì che coprono tutto il mese', () => {
  const ottobre = settimaneDelMese(2026, 9); // 1 ottobre 2026 è giovedì
  assert.equal(ottobre.length, 5);
  assert.deepEqual(ottobre[0].map(g => g.giorno), [28, 29, 30, 1, 2, 3, 4]);
  assert.equal(ottobre[0][0].nelMese, false);
  assert.equal(ottobre[0][3].data, '2026-10-01');
  assert.equal(ottobre[4][6].data, '2026-11-01');
  assert.equal(settimaneDelMese(2027, 1).length, 4); // febbraio 2027 inizia di lunedì e dura 4 settimane esatte
  assert.equal(settimaneDelMese(2026, 2).length, 6); // marzo 2026: da domenica 1 a martedì 31
});

test('uscite raggruppate per giorno e ordinate per orario, senza orario in fondo', () => {
  const g = uscitePerGiorno([
    { id: '1', data: '2026-10-18', orario: '17:30' },
    { id: '2', data: '2026-10-18' },
    { id: '3', data: '2026-10-18', orario: '09:30' },
    { id: '4', data: '2026-10-25', orario: '10:00' },
  ]);
  assert.deepEqual(g['2026-10-18'].map(u => u.id), ['3', '1', '2']);
  assert.deepEqual(Object.keys(g), ['2026-10-18', '2026-10-25']);
});

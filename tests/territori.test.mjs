import test from 'node:test';
import assert from 'node:assert/strict';
import { scadenzaTerritorio, statoScadenza, giorniTra, alertTerritori, statisticheLavorazione, assegnazioneAperta, ultimoRientro, normalizeTerritori, parseCartina, dettaglioInSezione, cartineDaFile, raggruppaSezioni, annoDiServizio, righeS13, pagineS13, anniS13 } from '../src/utils/territori.js';

test('nome, codice e sezione dal nome del file', () => {
  assert.deepEqual(parseCartina('Territorio_01_Ribolla.pdf'), { numero: '1', nome: 'Ribolla', sezione: 'Ribolla' });
  assert.deepEqual(parseCartina('territorio_35A_Roccastrada.pdf'), { numero: '35A', nome: 'Roccastrada', sezione: 'Roccastrada' });
  assert.deepEqual(parseCartina('territorio_51_Sticciano_Scalo.pdf'), { numero: '51', nome: 'Sticciano Scalo', sezione: 'Sticciano Scalo' });
  assert.deepEqual(parseCartina('territorio_59_Commerciale_Ribolla_1.pdf'), { numero: '59', nome: 'Commerciale Ribolla 1', sezione: 'Commerciale' });
  assert.deepEqual(parseCartina('territorio_83_Pereti_Rurale_2.pdf'), { numero: '83', nome: 'Pereti Rurale 2', sezione: 'Rurale' });
  assert.deepEqual(parseCartina('12.pdf'), { numero: '12', nome: 'Territorio 12', sezione: 'Senza nome' });
  assert.equal(parseCartina('mappa generale.pdf'), null);
  assert.equal(dettaglioInSezione(parseCartina('territorio_12_Ribolla.pdf')), '');
  assert.equal(dettaglioInSezione(parseCartina('territorio_59_Commerciale_Ribolla_1.pdf')), 'Ribolla 1');
  assert.equal(dettaglioInSezione(parseCartina('territorio_83_Pereti_Rurale_2.pdf')), 'Pereti 2');
});

test('archivio dalla cartella: 35A e 35B restano distinti, ordinati per numero', () => {
  const cartine = cartineDaFile({
    '../territori/territorio_36_Roccastrada.pdf': '/a/36.pdf',
    '../territori/territorio_35B_Roccastrada.pdf': '/a/35b.pdf',
    '../territori/territorio_35A_Roccastrada.pdf': '/a/35a.pdf',
    '../territori/territorio_59_Commerciale_Ribolla_1.pdf': '/a/59.pdf',
    '../territori/Territorio_01_Ribolla.pdf': '/a/1.pdf',
  });
  assert.deepEqual(cartine.map(c => c.numero), ['1', '35A', '35B', '36', '59']);
  const sezioni = raggruppaSezioni(cartine);
  assert.deepEqual(sezioni.map(s => [s.nome, s.indice, s.territori.length]), [['Ribolla', 0, 1], ['Roccastrada', 1, 3], ['Commerciale', 2, 1]]);
});

test('la scadenza cade 4 mesi dopo, fermandosi a fine mese', () => {
  assert.equal(scadenzaTerritorio('2026-06-15'), '2026-10-15');
  assert.equal(scadenzaTerritorio('2026-10-31'), '2027-02-28');
  assert.equal(scadenzaTerritorio('2027-10-31'), '2028-02-29');
});

test('livello: regolare, vicino negli ultimi 30 giorni, poi scaduto', () => {
  assert.equal(statoScadenza('2026-06-15', '2026-06-15').frazione, 0);
  assert.equal(statoScadenza('2026-06-15', '2026-08-01').livello, 'regolare');
  const vicino = statoScadenza('2026-06-15', '2026-09-20');
  assert.equal(vicino.livello, 'vicino');
  assert.equal(vicino.giorniRimasti, 25);
  const scaduto = statoScadenza('2026-06-15', '2026-10-20');
  assert.equal(scaduto.livello, 'scaduto');
  assert.equal(scaduto.frazione, 1);
});

test('stato del territorio dalle assegnazioni', () => {
  const list = [
    { id: 'a', numero: '3', proclamatore: 'Rossi', assegnato: '2026-01-10', rientro: '2026-04-02' },
    { id: 'b', numero: '3', proclamatore: 'Bianchi', assegnato: '2026-05-01' },
  ];
  assert.equal(assegnazioneAperta(list, '3').proclamatore, 'Bianchi');
  assert.equal(assegnazioneAperta(list, '4'), null);
  assert.equal(ultimoRientro(list, '3'), '2026-04-02');
});

test('alert: solo scaduti e in scadenza, i più urgenti prima', () => {
  const list = [
    { id: 'a', numero: '1', assegnato: '2026-08-01' },               // regolare
    { id: 'b', numero: '2', assegnato: '2026-05-01' },               // scaduto
    { id: 'c', numero: '3', assegnato: '2026-06-20' },               // vicino
    { id: 'd', numero: '4', assegnato: '2026-01-01', rientro: '2026-03-01' },
  ];
  const alert = alertTerritori(list, '2026-10-01');
  assert.deepEqual(alert.map(a => [a.numero, a.livello]), [['2', 'scaduto'], ['3', 'vicino']]);
});

test('tempo di lavorazione: medie per territorio e quota rientrata entro 4 mesi', () => {
  const s = statisticheLavorazione([
    { id: 'a', numero: '5', assegnato: '2026-01-01', rientro: '2026-03-02' }, // 60 giorni
    { id: 'b', numero: '5', assegnato: '2026-04-01', rientro: '2026-08-19' }, // 140 giorni, oltre
    { id: 'c', numero: '7', assegnato: '2026-02-01', rientro: '2026-02-21' }, // 20 giorni
    { id: 'd', numero: '7', assegnato: '2026-09-01' },                        // in corso: escluso
  ]);
  assert.equal(giorniTra('2026-01-01', '2026-03-02'), 60);
  assert.equal(s.concluse, 3);
  assert.equal(s.mediaGiorni, 73);
  assert.equal(s.percentualeInTempo, 67);
  assert.deepEqual(
    [s.perTerritorio.get('5').mediaGiorni, s.perTerritorio.get('5').maxGiorni, s.perTerritorio.get('5').inTempo],
    [100, 140, 1],
  );
  assert.equal(statisticheLavorazione([]).mediaGiorni, null);
});

test('normalize: codici sempre testuali, scarta dati incompleti', () => {
  const n = normalizeTerritori({ assegnazioni: [{ id: 'a', numero: 2, assegnato: '2026-01-01' }, { id: 'b', numero: 3 }] });
  assert.deepEqual(n.assegnazioni.map(a => a.numero), ['2']);
  assert.deepEqual(normalizeTerritori(undefined), { assegnazioni: [] });
});

test('S-13: anno di servizio da settembre ad agosto', () => {
  assert.equal(annoDiServizio('2026-08-31'), 2026);
  assert.equal(annoDiServizio('2026-09-01'), 2027);
  assert.equal(annoDiServizio('2026-10-13'), 2027);
});

test('S-13: righe compilate da assegnazioni e rientri', () => {
  const territori = [{ numero: '1' }, { numero: '2' }, { numero: '3' }];
  const a = (id, numero, nome, assegnato, rientro) => ({ id, numero, proclamatore: nome, assegnato, ...(rientro ? { rientro } : {}) });
  const assegnazioni = [
    a('p', '1', 'Vecchio', '2026-02-01', '2026-05-10'),   // anno 2026: solo come "restituito l'ultima volta"
    a('q', '1', 'Rossi', '2026-06-15', '2026-09-20'),     // iniziata nel 2026, rientrata nel 2027: entra
    a('r', '1', 'Bianchi', '2026-10-01'),                 // ancora fuori
    ...['2026-09-02', '2026-10-02', '2026-11-02', '2026-12-02', '2027-01-02'].map((d, i) => a('s' + i, '2', 'P' + i, d, d.replace(/-02$/, '-20'))),
  ];
  const righe = righeS13(territori, assegnazioni, 2027);
  assert.deepEqual(righe.map(r => r.numero), ['1', '2', '2', '3']); // il 2 ha 5 assegnazioni: va a capo
  assert.equal(righe[0].ultimoRientro, '2026-05-10');
  assert.deepEqual(righe[0].blocchi, [
    { nome: 'Rossi', assegnato: '2026-06-15', rientro: '2026-09-20' },
    { nome: 'Bianchi', assegnato: '2026-10-01', rientro: null },
  ]);
  assert.equal(righe[1].blocchi.length, 4);
  assert.equal(righe[2].ultimoRientro, null);            // la riga di continuazione non ripete la data
  assert.deepEqual(righe[2].blocchi.map(b => b.nome), ['P4']);
  assert.deepEqual(righe[3].blocchi, []);                // territorio mai assegnato: riga vuota
  assert.deepEqual(righeS13(territori, assegnazioni, 2026)[0].blocchi.map(b => b.nome), ['Vecchio', 'Rossi']);
});

test('S-13: 20 righe per pagina e anni proposti', () => {
  const righe = Array.from({ length: 45 }, (_, i) => ({ numero: String(i + 1), blocchi: [] }));
  assert.deepEqual(pagineS13(righe).map(p => p.length), [20, 20, 5]);
  assert.deepEqual(pagineS13([]), [[]]);
  assert.deepEqual(anniS13([{ assegnato: '2025-03-01', rientro: '2025-10-01' }], '2026-10-13'), [2027, 2026, 2025]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { scadenzaTerritorio, statoScadenza, giorniTra, alertTerritori, statisticheLavorazione, assegnazioneAperta, ultimoRientro, normalizeTerritori, parseCartina, dettaglioInSezione, cartineDaFile, raggruppaSezioni, annoDiServizio, righeS13, pagineS13, anniS13, parseNumeriTerritori, testoSu, copertura, filtraPerEtichette, SENZA_ETICHETTE, CON_ETICHETTE, statisticheMensili, rientratiDiRecente, registraVisita, azzeraStati, unisciCartine, ordinaIndirizzi, statisticaTerritori, erroreRegistrazione, applicaRientri, leggiKml, puntiAnello, importaRegistrazioni, dataExcel, idCartellaDrive, riepilogoTerritori } from '../src/utils/territori.js';

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
  // un rientro non percorso non è una lavorazione
  assert.equal(statisticheLavorazione([{ id: 'x', numero: '5', assegnato: '2026-01-01', rientro: '2026-01-05', nonLavorato: true }]).concluse, 0);
});

test('copertura: lavorati negli ultimi 12 mesi, esclusi i rientri non percorsi', () => {
  const territori = [{ numero: '1' }, { numero: '2' }, { numero: '3' }, { numero: '4' }];
  const c = copertura(territori, [
    { id: 'a', numero: '1', assegnato: '2026-01-01', rientro: '2026-03-01' },                    // dentro
    { id: 'b', numero: '2', assegnato: '2025-01-01', rientro: '2025-10-01' },                    // troppo vecchio
    { id: 'c', numero: '3', assegnato: '2026-05-01', rientro: '2026-05-10', nonLavorato: true }, // non percorso
    { id: 'd', numero: '4', assegnato: '2026-09-01' },                                           // ancora fuori
  ], '2026-11-08');
  assert.deepEqual([c.lavorati, c.nonLavorati.map(t => t.numero), c.percentuale], [1, ['2', '3', '4'], 25]);
});

test('normalize: codici sempre testuali, scarta dati incompleti', () => {
  const n = normalizeTerritori({ assegnazioni: [{ id: 'a', numero: 2, assegnato: '2026-01-01' }, { id: 'b', numero: 3 }] });
  assert.deepEqual(n.assegnazioni.map(a => a.numero), ['2']);
  assert.deepEqual(normalizeTerritori(undefined), { assegnazioni: [], etichette: [], note: {}, indirizzi: [], impostazioni: { mesiScadenza: 4, maxPerProclamatore: 0, mostraDisponibili: 0, etichettaPredefinita: '', azzeraStatiAlRientro: true, cartellaCartine: '' }, aggiunte: [], congregazione: null });
  const e = normalizeTerritori({ etichette: [{ id: 'x', nome: ' Campagna ', colore: 'rosso', territori: [12, '12', '35A'] }, { id: 'y', nome: '' }] }).etichette;
  assert.deepEqual(e, [{ id: 'x', nome: 'Campagna', colore: '#5a6b7a', territori: ['12', '35A'] }]);
});

test('etichette: numeri dal testo e colore del testo leggibile', () => {
  const validi = new Set(['1', '12', '35A']);
  assert.deepEqual(parseNumeriTerritori('012, 35a;1 99  12', validi), { numeri: ['12', '35A', '1'], sconosciuti: ['99'] });
  assert.equal(testoSu('#ffcc00'), '#111');
  assert.equal(testoSu('#1a3d8f'), '#fff');
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

test('impostazioni: valori fuori scala tornano ai predefiniti, scadenza configurabile', () => {
  const i = normalizeTerritori({ etichette: [{ id: 'e', nome: 'X' }], impostazioni: { mesiScadenza: 6, maxPerProclamatore: -1, mostraDisponibili: 10, etichettaPredefinita: 'sparita' } }).impostazioni;
  assert.deepEqual(i, { mesiScadenza: 6, maxPerProclamatore: 0, mostraDisponibili: 10, etichettaPredefinita: '', azzeraStatiAlRientro: true, cartellaCartine: '' });
  assert.equal(scadenzaTerritorio('2026-01-15', 6), '2026-07-15');
  assert.equal(alertTerritori([{ id: 'a', numero: '1', assegnato: '2026-05-01' }], '2026-10-05', 6)[0].livello, 'vicino');
});

test('filtro etichette: qualsiasi, tutte, con e senza', () => {
  assert.equal(filtraPerEtichette(['a'], []), true);
  assert.equal(filtraPerEtichette(['a'], ['a', 'b']), true);
  assert.equal(filtraPerEtichette(['a'], ['a', 'b'], true), false);
  assert.equal(filtraPerEtichette([], [SENZA_ETICHETTE]), true);
  assert.equal(filtraPerEtichette(['a'], [SENZA_ETICHETTE]), false);
  assert.equal(filtraPerEtichette(['a'], [CON_ETICHETTE]), true);
});

test('statistiche mensili e rientri recenti', () => {
  const list = [
    { id: 'a', numero: '1', proclamatore: 'Anna', assegnato: '2026-09-10', rientro: '2026-10-05' },
    { id: 'b', numero: '2', proclamatore: 'anna ', assegnato: '2026-10-01', rientro: '2026-11-02', nonLavorato: true },
    { id: 'c', numero: '3', proclamatore: 'Bruno', assegnato: '2026-11-01' },
  ];
  assert.deepEqual(statisticheMensili(list, '2026-11-08', 3), [
    { mese: '2026-11', completati: 0, partecipanti: 2 },
    { mese: '2026-10', completati: 1, partecipanti: 1 },
    { mese: '2026-09', completati: 0, partecipanti: 1 },
  ]);
  assert.deepEqual(rientratiDiRecente(list, '2026-11-08', 30).map(a => a.id), ['b']);
});

test('indirizzi: vecchi "non visitare" convertiti, visite e azzeramento al rientro', () => {
  const { indirizzi } = normalizeTerritori({
    indirizzi: [{ id: 'a', numero: 5, indirizzo: 'Via Roma 1', tipo: 'boh', stato: 'visitato', visite: [{ data: '2026-10-01', stato: 'visitato' }, { stato: 'x' }] }],
    nonVisitare: [{ id: 'b', numero: '5', indirizzo: 'Via Po 2', data: '2026-09-01' }, { id: 'c', numero: '5', indirizzo: ' ' }],
  });
  assert.deepEqual(indirizzi.map(n => [n.id, n.numero, n.tipo, n.stato, n.visite.length]), [['a', '5', 'residenziale', 'visitato', 1], ['b', '5', 'residenziale', 'non-visitare', 0]]);

  let v = registraVisita(indirizzi[0], 'assente', '2026-11-08', 'Anna');
  v = registraVisita(v, 'rivisitare', '2026-11-08', 'Anna'); // stesso giorno e proclamatore: sostituisce
  assert.deepEqual([v.stato, v.visite.map(x => x.stato)], ['rivisitare', ['rivisitare', 'visitato']]);

  const dopo = azzeraStati([v, indirizzi[1], { ...v, id: 'z', numero: '6' }], '5');
  assert.deepEqual(dopo.map(n => n.stato), ['', 'non-visitare', 'rivisitare']);
  assert.equal(dopo[0].visite.length, 2);
});

test('cartine aggiunte dall app: nuove in ordine, stesso numero sostituisce il PDF del progetto', () => {
  const daFile = [{ numero: '1', nome: 'Ribolla', sezione: 'Ribolla', file: 'a.pdf', url: '/a.pdf' }, { numero: '3', nome: 'Pari', sezione: 'Pari', file: 'c.pdf', url: '/c.pdf' }];
  const link = 'https://drive.google.com/x';
  const tutte = unisciCartine(daFile, [{ numero: '2', nome: 'Commerciale Pari 1', link }, { numero: '3', nome: 'Pari', link }]);
  assert.deepEqual(tutte.map(c => [c.numero, c.sezione, c.url, !!c.aggiunta]), [['1', 'Ribolla', '/a.pdf', false], ['2', 'Commerciale', link, true], ['3', 'Pari', link, true]]);
  const n = normalizeTerritori({ aggiunte: [{ numero: 4, nome: 'X', link }, { numero: '5', nome: 'Y', link: 'javascript:alert(1)' }, { numero: '', nome: 'Z', link }] });
  assert.deepEqual(n.aggiunte.map(a => a.numero), ['4']);
});

test('indirizzi ordinati per porzione, senza porzione in fondo, civici in ordine numerico', () => {
  const n = (indirizzo, porzione) => ({ indirizzo, porzione });
  assert.deepEqual(
    ordinaIndirizzi([n('Via Roma 10', ''), n('Via Po 2', 'B'), n('Via Roma 9', ''), n('Via Po 1', 'A')]).map(x => x.indirizzo),
    ['Via Po 1', 'Via Po 2', 'Via Roma 9', 'Via Roma 10'],
  );
});

test('statistica: riepilogo sul periodo, grafici e righe per territorio', () => {
  const territori = [{ numero: '1' }, { numero: '2' }, { numero: '3' }, { numero: '4' }];
  const a = (id, numero, proclamatore, assegnato, rientro, extra = {}) => ({ id, numero, proclamatore, assegnato, ...(rientro ? { rientro } : {}), ...extra });
  const s = statisticaTerritori(territori, [
    a('a', '1', 'Anna', '2026-07-01', '2026-08-26'),                         // 8 settimane, nel periodo
    a('b', '1', 'Bruno', '2025-01-01', '2025-02-26'),                        // vecchia
    a('c', '2', 'Carla', '2026-04-01'),                                     // fuori da oltre 6 mesi
    a('d', '3', 'Anna', '2026-10-01', '2026-10-10', { nonLavorato: true }),  // non percorso
    a('x', '9', 'Zeno', '2026-10-01'),                                      // territorio non in elenco
  ], '2026-11-08', 6);
  assert.deepEqual([s.totale, s.assegnati, s.completati, s.nonLavorati, s.mediaSettimane, s.partecipanti], [4, 1, 1, 2, 8, 2]);
  assert.deepEqual(s.grafici.inLavorazione.map(g => g.valore), [1, 1, 1]);
  assert.deepEqual(s.grafici.nonLavorati.map(g => g.valore), [2, 2, 2]);
  assert.deepEqual(s.righe[0], { numero: '1', aperta: null, ultimoRientro: '2026-08-26', lavorazioni: 2, mediaSettimane: 8 });
});

test('registrazioni: date coerenti, un solo territorio aperto, nessuna sovrapposizione', () => {
  const lista = [
    { id: 'a', numero: '1', proclamatore: 'Anna', assegnato: '2026-01-10', rientro: '2026-03-01' },
    { id: 'b', numero: '1', proclamatore: '', assegnato: '2026-06-01' },
  ];
  const r = (extra) => ({ id: 'n', numero: '1', proclamatore: 'X', ...extra });
  const oggi = '2026-11-08';
  assert.equal(erroreRegistrazione(r({ assegnato: '' }), lista, oggi), 'Indica la data di assegnazione.');
  assert.match(erroreRegistrazione(r({ assegnato: '2026-04-01', rientro: '2026-03-01' }), lista, oggi), /precedere/);
  assert.match(erroreRegistrazione(r({ assegnato: '2026-04-01' }), lista, oggi), /già assegnato/);
  assert.match(erroreRegistrazione(r({ assegnato: '2026-02-01', rientro: '2026-02-20' }), lista, oggi), /sovrappone/);
  assert.equal(erroreRegistrazione(r({ assegnato: '2026-03-01', rientro: '2026-05-31' }), lista, oggi), null); // stesso giorno del rientro precedente: ok
  assert.equal(erroreRegistrazione({ ...lista[1], rientro: '2026-07-01' }, lista, oggi), null); // modifica di sé stessa
});

test('rientro di più territori insieme: salta quelli assegnati dopo la data e azzera gli stati', () => {
  const dati = normalizeTerritori({
    assegnazioni: [
      { id: 'a', numero: '1', proclamatore: 'Anna', assegnato: '2026-09-01' },
      { id: 'b', numero: '2', proclamatore: 'Bruno', assegnato: '2026-11-05' },
      { id: 'c', numero: '3', proclamatore: 'Carla', assegnato: '2026-01-01', rientro: '2026-02-01' },
    ],
    indirizzi: [{ id: 'x', numero: '1', indirizzo: 'Via Roma 1', stato: 'assente' }, { id: 'y', numero: '1', indirizzo: 'Via Po 2', stato: 'non-visitare' }],
  });
  const r = applicaRientri(dati, ['a', 'b', 'c'], '2026-11-01', true);
  assert.deepEqual(r.rientrati, ['1']);
  assert.deepEqual(r.saltate.map(a => a.id), ['b']);
  assert.deepEqual(r.dati.assegnazioni.map(a => [a.id, a.rientro ?? null, !!a.nonLavorato]), [['a', '2026-11-01', true], ['b', null, false], ['c', '2026-02-01', false]]);
  assert.deepEqual(r.dati.indirizzi.map(n => n.stato), ['', 'non-visitare']);
});

test('KML: confini, linee e punti; coordinate arrotondate e senza doppioni', () => {
  const kml = `<?xml version="1.0"?><kml><Document><name>Congregazione Roccastrada</name>
    <Placemark><name><![CDATA[Confine & dintorni]]></name><MultiGeometry>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>
        11.1234567,43.0000001,0 11.2,43.0,0 11.2,43.0,0 11.2,43.1,0 11.1234567,43.0000001,0
      </coordinates></LinearRing></outerBoundaryIs></Polygon>
    </MultiGeometry></Placemark>
    <Placemark><name>Strada</name><LineString><coordinates>11,43 11.1,43.1</coordinates></LineString></Placemark>
    <Placemark><name>Sala</name><Point><coordinates>11.05,43.05,0</coordinates></Point></Placemark>
  </Document></kml>`;
  const m = leggiKml(kml);
  assert.equal(m.nome, 'Congregazione Roccastrada');
  assert.deepEqual(m.forme.map(f => [f.nome, f.tipo]), [['Confine & dintorni', 'poligono'], ['Strada', 'linea'], ['Sala', 'punto']]);
  assert.equal(m.forme[0].anelli[0], '11.12346,43 11.2,43 11.2,43.1 11.12346,43');
  assert.deepEqual(puntiAnello(m.forme[2].anelli[0]), [[43.05, 11.05]]);
  assert.throws(() => leggiKml('<kml><Document></Document></kml>'), /non contiene/);
});

test('import Excel: formato Hourglass, numeri "01", date seriali, righe scartate e doppioni', () => {
  assert.equal(dataExcel(45889), '2025-08-20');
  assert.equal(dataExcel('2026-03-01'), '2026-03-01');
  assert.equal(dataExcel('3/1/26'), null);
  const validi = new Set(['1', '2']);
  const righe = [
    { territory_number: '01', territory_locality: 'Ribolla', publisher: 'Anna', start: 45889, end: 45972, notes: '', tags: '' },
    { territory_number: '01', territory_locality: 'Ribolla', publisher: '', start: 46038, end: 46102, notes: '', tags: 'Congresso campagna' },
    { territory_number: '01', territory_locality: 'Ribolla', publisher: 'Bruno', start: 46122, end: '', notes: '', tags: '' },
    { territory_number: '99', publisher: 'Zeno', start: 46122, end: '' },
    { territory_number: '02', publisher: 'Carla', start: 'ieri', end: '' },
  ];
  let id = 0;
  const r = importaRegistrazioni(righe, validi, [], 'sostituisci', '2026-11-08', () => 'id' + ++id);
  assert.equal(r.importate, 3);
  assert.deepEqual(r.assegnazioni.map(a => [a.numero, a.proclamatore, a.assegnato, a.rientro ?? null, a.etichetta ?? null]), [
    ['1', 'Anna', '2025-08-20', '2025-11-11', null],
    ['1', '', '2026-01-16', '2026-03-21', 'Congresso campagna'],
    ['1', 'Bruno', '2026-04-10', null, null],
  ]);
  assert.deepEqual(r.scartate.map(x => x.riga), [5, 6]);
  // stesso giorno: rientra da Bruno e riparte con Carla; non è un doppione
  const stessoGiorno = importaRegistrazioni([
    { territory_number: '2', publisher: 'Bruno', start: 46328, end: 46328 },
    { territory_number: '2', publisher: 'Carla', start: 46328, end: '' },
  ], validi, [], 'sostituisci', '2026-11-08');
  assert.deepEqual([stessoGiorno.importate, stessoGiorno.doppioni, stessoGiorno.scartate.length], [2, 0, 0]);
  // aggiungendo di nuovo lo stesso file non si duplica nulla
  const di_nuovo = importaRegistrazioni(righe, validi, r.assegnazioni, 'aggiungi', '2026-11-08');
  assert.deepEqual([di_nuovo.importate, di_nuovo.doppioni], [0, 3]);
});

test('id della cartella Drive dal link', () => {
  const id = '1AbCdEfGhIjKlMnOp_q-RsT';
  assert.equal(idCartellaDrive(`https://drive.google.com/drive/folders/${id}?usp=sharing`), id);
  assert.equal(idCartellaDrive(`https://drive.google.com/drive/u/0/folders/${id}`), id);
  assert.equal(idCartellaDrive(`https://drive.google.com/open?id=${id}`), id);
  assert.equal(idCartellaDrive(` ${id} `), id);
  assert.equal(idCartellaDrive('https://example.com/x y'), '');
  assert.equal(idCartellaDrive(''), '');
  assert.equal(normalizeTerritori({ impostazioni: { cartellaCartine: `https://drive.google.com/drive/folders/${id}` } }).impostazioni.cartellaCartine, id);
  assert.equal(normalizeTerritori({}).impostazioni.cartellaCartine, '');
});

test('riepilogo: disponibili + assegnati = territori, la cartina tolta non conta', () => {
  const ass = [
    { id: 'a', numero: '1', assegnato: '2026-01-01' },                        // scaduto
    { id: 'b', numero: '2', assegnato: '2026-10-01' },                        // regolare
    { id: 'c', numero: '3', assegnato: '2026-01-01', rientro: '2026-02-01' }, // rientrato
    { id: 'd', numero: '99', assegnato: '2026-01-01' },                       // cartina tolta mentre era fuori
  ];
  const r = riepilogoTerritori(ass, new Set(['1', '2', '3', '4']), '2026-11-10', 4);
  assert.deepEqual(r.aperte.map(a => a.id), ['a', 'b']);
  assert.equal(r.disponibili, 2);
  assert.equal(r.disponibili + r.aperte.length, 4);
  assert.equal(r.scaduti, 1);
  assert.equal(r.inScadenza, 0);
});

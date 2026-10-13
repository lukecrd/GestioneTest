import test from 'node:test';
import assert from 'node:assert/strict';
import { ruoloIniziale, ordinaUtenti, contaInAttesa, messaggioErrore, passwordValida } from '../src/utils/utenti.js';

test('solo l\'email del primo amministratore nasce admin, senza badare a maiuscole e spazi', () => {
  assert.equal(ruoloIniziale('Mario.Rossi@Example.it ', 'mario.rossi@example.it'), 'admin');
  assert.equal(ruoloIniziale('altro@example.it', 'mario.rossi@example.it'), 'in_attesa');
  assert.equal(ruoloIniziale('', ''), 'in_attesa'); // email iniziale non impostata: nessuno diventa admin da solo
  assert.equal(ruoloIniziale('chiunque@example.it', ''), 'in_attesa');
});

test('ordine: richieste in attesa, poi amministratori, poi consultazione', () => {
  const lista = ordinaUtenti([
    { email: 'z@x.it', nome: 'Zeno', ruolo: 'viewer' },
    { email: 'b@x.it', nome: 'Bruno', ruolo: 'admin' },
    { email: 'c@x.it', nome: '', ruolo: 'in_attesa' },
    { email: 'a@x.it', nome: 'Anna', ruolo: 'viewer' },
  ]);
  assert.deepEqual(lista.map(u => u.email), ['c@x.it', 'b@x.it', 'a@x.it', 'z@x.it']);
  assert.equal(contaInAttesa(lista), 1);
});

test('messaggi d\'errore leggibili e password di almeno 8 caratteri', () => {
  assert.equal(messaggioErrore({ code: 'auth/invalid-credential' }), 'Email o password non corrette.');
  assert.equal(messaggioErrore({ code: 'sconosciuto' }), 'Operazione non riuscita. Riprova.');
  assert.equal(passwordValida('1234567'), false);
  assert.equal(passwordValida('12345678'), true);
});

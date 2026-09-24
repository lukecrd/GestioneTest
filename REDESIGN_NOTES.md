# Redesign interfaccia — settembre 2026

## Modifiche principali

- Navigazione desktop trasformata in sidebar organizzata per Dashboard, Programmi, Servizio e Gestione.
- Navigazione mobile trasformata in menu laterale compatto.
- Header ridotto a titolo sezione, stato sincronizzazione, import/export e utente.
- Dashboard riscritta con indicatori operativi, stato attività e accessi rapidi.
- Anagrafica impostata con elenco come contenuto principale e pannello laterale per aggiunta/modifica persona.
- Stile generale semplificato: meno gradienti, glow, effetti 3D, monospace e microtesti; più spazio, leggibilità e gerarchia.
- Tabelle rese più leggibili e con prima colonna sticky su schermi piccoli.
- Login semplificato; rimossi i PIN di bypass e la scelta manuale Admin/Viewer per gli account email.
- Campi PIN nelle impostazioni oscurati.
- Firestore limitato a sessioni autenticate.

## Sicurezza: passaggio ancora consigliato

L'interfaccia distingue Admin e Viewer, ma la separazione dei permessi dovrebbe essere portata anche nelle Firestore Security Rules tramite Firebase Custom Claims (o una struttura equivalente lato server). Finché questo non viene fatto, le regole possono distinguere una sessione autenticata da una anonima/non autenticata, ma non imporre in modo robusto Admin vs Viewer lato database.

## Verifica tecnica

Il progetto allegato non conteneva `node_modules`. Il controllo TypeScript è stato eseguito a livello di sorgente; dopo aver escluso gli errori dovuti alle dipendenze non presenti, non risultano errori TypeScript aggiuntivi introdotti dal redesign. Prima del deploy eseguire normalmente:

```bash
npm install
npm run lint
npm run build
```

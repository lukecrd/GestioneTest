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

# Identità visiva "La bacheca" — ottobre 2026

- Palette definita una sola volta in `@theme static` (`src/index.css`): le rampe Tailwind `slate`, `indigo`/`sky`/`blue` e `rose` sono rimappate (grigio carta, petrolio, rosso del programma). Per cambiare colore si toccano solo quelle variabili.
- Sidebar in panno verde (`--color-felt`); la sezione aperta è un foglio appuntato con una puntina.
- Caratteri: Atkinson Hyperlegible Next (interfaccia, pensato per la leggibilità) e Literata (titoli di pagina).
- Rimossi occhielli e etichette in maiuscolo nell'interfaccia; restano solo nei fogli che riproducono i modelli ufficiali (S-89, sezioni Vita e ministero, stampa Opera pubblica).

# Sezione Territori — ottobre 2026

- Dati (`state.territori`: archivio e assegnazioni) nel documento Firestore esistente; PDF delle cartine nella cartella `src/territori/` (il numero nel nome del file è il territorio), inclusi nel build.
- Scadenza fissa a 4 mesi dall'assegnazione, avviso negli ultimi 30 giorni (`src/utils/territori.js`, test in `tests/territori.test.mjs`).
- Per aggiungere o sostituire una cartina: copiare il PDF in `src/territori/` e rifare il deploy.
- Numero (anche con lettera, es. `35A`), nome e sezione vengono dal nome del file (`territorio_59_Commerciale_Ribolla_1.pdf`); regole in `src/territori/LEGGIMI.md`. Sezioni: Commerciale, Rurale e un paese per ciascun residenziale, ognuna con un colore.
- Assegnazione direttamente dalla riga del territorio. Avvisi per scaduti e in scadenza (ultimi 30 giorni): banner nella sezione e nella Dashboard, contatore rosso su "Territori" nella barra laterale.
- Grafici del tempo di lavorazione (Recharts): media per territorio sulle lavorazioni concluse e giorni trascorsi per quelle in corso, con linea a 4 mesi e filtro per sezione.

# Sezione Discorsi esterni — ottobre 2026

- Oratori scelti da Persone (solo fratelli), ciascuno con gli schemi preparati spuntati dall'elenco S-99 (`TITOLI_DISCORSI_PUBBLICI`).
- Uscite con data, oratore, schema (solo tra i suoi) e congregazione. Blocca lo stesso oratore due volte nello stesso giorno; chiede conferma se ripete uno schema nella stessa congregazione. Logica e test in `src/utils/discorsiEsterni.js` e `tests/discorsiEsterni.test.mjs`.
- Numeri ufficiali degli schemi da S-99-I edizione 5/25 (`SCHEMI_DISCORSI_PUBBLICI`); i titoli sono invariati, quindi i dati già salvati restano validi. Per una nuova edizione dell'S-99 va rigenerato `src/data/titoliDiscorsiPubblici.ts`.
- Orario delle uscite (obbligatorio per le nuove, completabile in tabella per le vecchie) e calendario mensile riepilogativo (`CalendarioUscite.tsx`): griglia da lunedì a domenica su schermi larghi, elenco del mese sul telefono.

# Colore per sezione — ottobre 2026

- Ogni sezione ha colore e icona in `src/components/sectionMeta.ts` (unica fonte). Il colore della sezione aperta arriva al CSS come `--accent` su `.app-shell`; da lì: tessere colorate nella barra laterale, icona e filo nella barra in alto, fascia del titolo, pulsanti principali, focus dei campi, riquadri della Dashboard.
- Tutti i colori reggono il testo bianco (contrasto ≥ 5:1). Verde/ambra/rosso restano riservati agli stati e agli avvisi.

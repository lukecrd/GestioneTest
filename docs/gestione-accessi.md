# Gestione degli accessi

La scheda **Gestione accessi** è disponibile agli amministratori. Ogni account ha uno stato (in attesa, attivo, disabilitato), un livello (amministratore, operatore, lettore) e permessi per ciascuna funzione. Un operatore può modificare solo le funzioni con permesso Modifica; un lettore può consultare, stampare ed esportare le funzioni assegnate. Un amministratore gestisce tutte le funzioni e gli account.

## Attivazione su Firebase e Vercel

Preparare queste impostazioni prima di distribuire la versione su main; durante il passaggio i vecchi accessi tramite PIN saranno sostituiti dagli account personali.

1. Nella console Firebase del progetto indicato in `firebase-applet-config.json`, aprire Authentication → Sign-in method e abilitare Email/Password. Aggiungere il dominio del sito Vercel tra i domini autorizzati. Configurare i messaggi di verifica e recupero password.
2. In Firebase → Impostazioni progetto → Account di servizio, generare una chiave privata del Firebase Admin SDK. Inserire **l'intero JSON** come variabile segreta Vercel `FIREBASE_ADMIN_SERVICE_ACCOUNT`, per Production e gli eventuali ambienti Preview usati. Non caricare il file nel repository e non inviarlo in chat.
3. In Vercel impostare `ACCESS_BOOTSTRAP_ADMIN_EMAIL` all'indirizzo scelto per il primo amministratore. Il valore è configurazione privata, non una variabile `VITE_`.
4. Pubblicare le regole di `firestore.rules` nella console Firestore, selezionando il database `firestoreDatabaseId` di `firebase-applet-config.json`. Le regole impediscono l'accesso diretto dal browser; il server usa il Firebase Admin SDK. Le precedenti regole che autorizzavano qualsiasi utente autenticato devono essere sostituite **prima di usare account con permessi limitati**. Il solo merge su GitHub non pubblica le regole Firebase.
5. Unire la pull request e distribuire nuovamente il progetto Vercel con le variabili configurate. La prima autenticazione può creare il profilo: registrarsi con l'indirizzo amministratore, verificare l'email ricevuta e premere Controlla approvazione. Solo l'email verificata corrispondente alla configurazione iniziale diventa amministratore.
6. Dopo il primo accesso amministrativo, rimuovere `ACCESS_BOOTSTRAP_ADMIN_EMAIL` da Vercel e ridistribuire. I profili già approvati continuano a funzionare. Un account disabilitato non viene riabilitato dal bootstrap.

Per lo sviluppo locale, usare `.env.local` con le stesse due variabili. `server.ts` carica questo file solo sul server. Non pubblicare `.env.local` o chiavi private.

## Registrazione e approvazione

Registrati richiede nome, email e password. I nuovi account diventano Lettore / In attesa, senza funzioni assegnate. L'amministratore apre Gestione accessi, seleziona Approva e assegna permessi, sceglie livello e funzioni e salva. Il form propone lo stato Attivo; l'approvazione avviene solo al salvataggio.

Nuovo utente permette di creare account con email oppure solo nome utente e password. I nomi utente sono univoci, senza distinzione maiuscole/minuscole, da 3 a 40 caratteri (lettere, numeri, punto, trattino, underscore). Gli account senza email usano un identificatore tecnico Firebase; per recuperare la password devono rivolgersi all'amministratore. Il form Gestisci permette di assegnare una nuova password, senza vedere quella precedente. Firebase Authentication conserva e verifica le password: non sono salvate nei profili Firestore.

Nessun amministratore può revocare il proprio accesso dalla scheda; deve restare almeno un amministratore attivo. Le modifiche ai permessi sono controllate a ogni richiesta server. L'interfaccia aggiorna dati e permessi ogni 10 secondi; Controlla approvazione aggiorna immediatamente un account in attesa. I salvataggi richiedono connessione e vengono rifiutati se non autorizzati. I programmi già scaricati, stampati o esportati restano presso chi li ha ricevuti.

## Verifiche

`npm run lint`, `npm test` e `npm run build`. I test usano servizi simulati e verificano l'autorizzazione delle API, i profili in attesa, il bootstrap con email verificata e la selezione dei dati per funzione. Prima dell'uso verificare anche con Firebase reale: registrazione, verifica email, approvazione, login con nome utente, recupero password e disabilitazione. Queste verifiche richiedono le credenziali server, non incluse nel repository.

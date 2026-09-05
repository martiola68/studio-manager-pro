# Microsoft 365 - Configurazione Studio Manager Pro

## Obiettivo

Studio Manager Pro utilizza Microsoft 365 per calendario, posta e invii automatici. La configurazione e' separata per ogni studio: ciascuno studio collega il proprio tenant/account Microsoft 365 e mantiene i propri dati e mittenti.

## Connessione Microsoft 365

1. Accedere a **Configurazioni > Microsoft 365** in Studio Manager Pro.
2. Selezionare **Connetti Microsoft 365**.
3. Accedere con l'account Microsoft 365 dello studio autorizzato all'integrazione.
4. Accettare i permessi richiesti da Studio Manager Pro.
5. Verificare che la pagina mostri la connessione Microsoft 365 come attiva.

Tra i permessi utilizzati per la posta sono previsti `Mail.Send` e `Mail.Send.Shared`. Quest'ultimo consente a Studio Manager Pro, insieme alle autorizzazioni Exchange della casella, di inviare gli alert automatici usando un mittente dedicato dello studio.

## Casella per gli alert automatici

Per gli alert automatici delle **Scadenze unificate** e' consigliato predisporre una casella dedicata, ad esempio:

`noreply@nomestudio.it`

La casella deve esistere nel tenant Microsoft 365 dello stesso studio. Non deve essere creata come utente di Studio Manager Pro e quindi non incide sul numero degli utenti SMP attivi.

Il nome visualizzato della casella puo' essere il nome dello studio (ad esempio "Studio Rossi & Associati"); non e' necessario visualizzare la parola noreply al destinatario.

## Autorizzazione Exchange - Invia come (Send As)

L'account Microsoft 365 utilizzato per la connessione SMP deve essere autorizzato a inviare come la casella dedicata.

In **Exchange Admin Center**:

1. Aprire **Destinatari > Cassette postali**.
2. Selezionare la casella dedicata (es. `noreply@nomestudio.it`).
3. Aprire **Delega casella postale**.
4. In **Invia come (Send As)** aggiungere l'account Microsoft collegato a Studio Manager Pro.
5. Salvare.

Per il funzionamento adottato da SMP non e' necessario concedere **Accesso completo (Full Access)** alla casella solo per effettuare il Send As.

Le modifiche ai permessi Exchange possono richiedere alcuni minuti prima di diventare operative.

## Campo "Email alert fiscale" in Dati Studio

Aprire **Configurazioni > Dati Studio** e valorizzare il campo:

**Email alert fiscale**

con l'indirizzo della casella dedicata, per esempio:

`noreply@nomestudio.it`

Il motore centrale delle scadenze legge questo valore direttamente dai dati dello studio. Non esiste quindi un mittente noreply globale: ogni studio utilizza esclusivamente la propria configurazione.

Se **Email alert fiscale** e' vuota, Studio Manager Pro mantiene il comportamento standard e invia tramite il normale account Microsoft connesso, senza forzare un mittente alternativo.

## Riconnessione dopo l'abilitazione del mittente condiviso

Se la connessione Microsoft 365 era stata effettuata prima dell'introduzione del permesso `Mail.Send.Shared`, effettuare una sola volta:

1. **Disconnetti Microsoft 365** da SMP.
2. Selezionare nuovamente **Connetti Microsoft 365**.
3. Accedere con l'account autorizzato al Send As.
4. Accettare i permessi richiesti.
5. Verificare che la connessione risulti attiva.

In questo modo il token delegato viene rilasciato con i permessi aggiornati.

## Come vengono inviate le email automatiche

Per le normali email SMP continua a utilizzare il mittente Microsoft dell'utente connesso.

Per gli alert automatici delle **Scadenze unificate**, se il campo **Email alert fiscale** e' valorizzato, SMP invia tramite Microsoft Graph usando l'account connesso e imposta come mittente la casella indicata nel campo. Exchange verifica il permesso **Send As**.

Le email automatiche riportano inoltre la dicitura:

> **Email generata automaticamente da Studio Manager Pro.**  
> Si prega di non rispondere a questo messaggio.

## Configurazione multi-studio

La procedura deve essere ripetuta autonomamente per ogni studio che utilizza Studio Manager Pro:

- tenant Microsoft 365 dello studio;
- account Microsoft collegato a SMP;
- eventuale casella dedicata `noreply@...` dello studio;
- permesso Exchange **Send As**;
- indirizzo inserito in **Dati Studio > Email alert fiscale**.

La configurazione di uno studio non viene utilizzata dagli altri studi.

## Verifica e problemi comuni

**La mail parte dall'account personale anziche' dalla casella dedicata**  
Controllare che **Email alert fiscale** sia valorizzata nei Dati Studio.

**Errore di autorizzazione Send As**  
Controllare in Exchange Admin Center che l'account Microsoft collegato a SMP sia presente in **Invia come (Send As)** per la casella indicata.

**Il permesso e' stato appena aggiunto ma l'invio non funziona**  
Attendere la propagazione di Exchange e riprovare. Se necessario, disconnettere e riconnettere Microsoft 365 in SMP.

**Lo studio non vuole usare una casella noreply**  
Lasciare vuoto **Email alert fiscale**. Gli invii continuano a utilizzare il normale mittente Microsoft collegato.

---

**Ultima revisione:** Settembre 2026  
**Versione:** 2.0

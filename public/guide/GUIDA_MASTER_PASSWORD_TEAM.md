# 🔐 GUIDA MASTER PASSWORD
## Studio Manager Pro - Gestione Sicura Dati Sensibili

---

## 📌 INDICE

1. [Cos'è la Master Password](#1-cosè-la-master-password)
2. [Configurazione Iniziale](#2-configurazione-iniziale-una-sola-volta)
3. [Uso Quotidiano](#3-uso-quotidiano)
4. [Condivisione Sicura](#4-condivisione-sicura-della-password)
5. [Regole di Sicurezza](#5-regole-di-sicurezza)
6. [Risoluzione Problemi](#6-risoluzione-problemi)
7. [Domande Frequenti](#7-domande-frequenti-faq)
8. [Checklist Operative](#8-checklist-operative)
9. [Supporto e Contatti](#9-supporto-e-contatti)

---

## 1️⃣ COS'È LA MASTER PASSWORD

### 🔑 Definizione Semplice

La **Master Password** è una password unica che protegge TUTTI i dati sensibili dello studio:

✅ **Protegge:**
- Codici Fiscali dei clienti
- Partite IVA
- Password portali (Entratel, Fisconline, INPS, etc.)
- PIN dispositivi
- Dati riservati cassetti fiscali

### 🎯 Analogia Pratica

Immagina un **forziere blindato**:
- 📋 Dentro ci sono TUTTI i dati sensibili dello studio
- 🔐 La Master Password è la **CHIAVE del forziere**
- ✅ Con la chiave → puoi aprire e lavorare normalmente
- ❌ Senza chiave → dati illeggibili per chiunque

⚠️ **IMPORTANTE:** Con la Master Password, i dati sono cifrati nel database. Anche se qualcuno rubasse il database, non potrebbe leggerli senza la password!

---

## 2️⃣ CONFIGURAZIONE INIZIALE (Una Sola Volta)

🚨 **ATTENZIONE:** Questa operazione va fatta **UNA SOLA VOLTA** dall'amministratore. Una volta configurata, tutti gli utenti useranno la stessa password.

### Procedura Step-by-Step

**STEP 1 - Accedi a Studio Manager**
- L'amministratore accede con le proprie credenziali

**STEP 2 - Vai in Impostazioni Studio**
- Menu principale → **Impostazioni** → **Studio**

**STEP 3 - Abilita Protezione Dati Sensibili**
- Nella sezione "Protezione Dati Sensibili"
- Attiva l'interruttore **"Abilita Protezione"**
- Si aprirà un dialog per configurare la password

**STEP 4 - Scegli una Password Forte**

📋 **REQUISITI PASSWORD:**
- ✅ Minimo 8 caratteri
- ✅ Almeno una maiuscola
- ✅ Almeno una minuscola
- ✅ Almeno un numero
- ✅ Almeno un carattere speciale (@, !, #, $, etc.)

**Esempi di Password Forti:**
```
MyStudi0#2026!
Fisc@le!Studio26
C0mmerciali$ta!
Studi0@Cont@bile
```

❌ **NON USARE:**
- Password ovvie: "password123", "studio2026"
- Nomi/cognomi: "MarioRossi", "StudioVerdi"
- Date di nascita: "01011990"
- Sequenze: "12345678", "abcdefgh"

**STEP 5 - Conferma e Salva**
- Inserisci la password due volte per conferma
- Clicca **"Salva Configurazione"**

✅ **FATTO!** Ora tutti i dati sensibili sono protetti e cifrati nel database.

---

## 3️⃣ USO QUOTIDIANO

### 🌅 Inizio Giornata

**STEP 1 - Apri Studio Manager**
- Accedi normalmente con le tue credenziali utente

**STEP 2 - Sblocca i Dati Sensibili**
- Quando accedi a sezioni protette (Clienti, Cassetti Fiscali, Gestione Password), vedrai:
  - 🔒 Pulsante **"Sblocca Dati"** in alto a destra
  - 🔐 Dati sensibili oscurati con "••••••••"
- Clicca sul pulsante "Sblocca Dati"

**STEP 3 - Inserisci Master Password**
- Nel dialog che si apre:
  - Inserisci la Master Password dello studio
  - Clicca **"Sblocca"**

**STEP 4 - Lavora Normalmente**
✅ **TUTTO SBLOCCATO!** Ora puoi vedere e modificare tutti i dati sensibili per tutta la giornata lavorativa. Non dovrai reinserire la password finché non chiudi il browser o dopo 15 minuti di inattività.

### 📊 Cosa Puoi Fare Quando è Sbloccato

**👥 CLIENTI:**
- Visualizzare Codici Fiscali
- Visualizzare Partite IVA
- Modificare dati sensibili
- Copiare dati negli appunti

**📂 CASSETTI FISCALI:**
- Vedere username portali
- Vedere password portali
- Vedere PIN dispositivi
- Modificare credenziali

**🔑 GESTIONE PASSWORD:**
- Visualizzare tutte le password
- Aggiungere nuove credenziali
- Modificare password esistenti
- Eliminare credenziali obsolete

### 🔒 Fine Giornata / Pausa Lunga

**Blocco Manuale (Consigliato)**
- Se ti allontani dal computer o finisci il lavoro:
  - Clicca sul pulsante **"🔒 Blocca Dati"**
  - I dati tornano protetti immediatamente
  - Serve reinserire la password per sbloccare di nuovo

**Blocco Automatico**
⏱️ **AUTO-LOCK:** Se non usi Studio Manager per **15 minuti**, il sistema blocca automaticamente i dati per sicurezza.

---

## 4️⃣ CONDIVISIONE SICURA DELLA PASSWORD

🔐 **REGOLA FONDAMENTALE:** La Master Password deve essere condivisa **SOLO** con il team fidato dello studio. **MAI** con clienti, esterni o fornitori!

### ✅ METODI SICURI (Consigliati)

#### 1️⃣ Password Manager Condiviso
**Soluzione Professionale Raccomandata**

| Servizio | Costo | Caratteristiche |
|----------|-------|-----------------|
| **Bitwarden** | Gratis (2 utenti)<br>€3/mese (team) | Open source, vault condiviso, app mobile |
| **1Password** | €8/mese (5 utenti) | Interfaccia migliore, molto sicuro |
| **LastPass** | €4/utente/mese | Popolare, funzionale |

**Come funziona:**
- Admin crea vault condiviso "Studio Manager"
- Salva Master Password nel vault
- Invita membri team al vault
- Tutti accedono alla password in modo sicuro

#### 2️⃣ Cassaforte Fisica Ufficio
**Soluzione Tradizionale**
- Scrivi password su foglio sigillato
- Metti in cassaforte ufficio
- Comunicare combinazione cassaforte al team
- Ogni membro annota la password privatamente

#### 3️⃣ Documento Cloud Protetto
**Soluzione Ibrida**
- Crea documento PDF protetto da password
- Inserisci Master Password nel PDF
- Carica su Google Drive con accesso limitato al team
- Comunica password del PDF via canale separato

### ❌ METODI DA EVITARE

🚫 **NON CONDIVIDERE MAI VIA:**
- ❌ WhatsApp / Telegram (messaggi in chiaro)
- ❌ Email non cifrate
- ❌ SMS
- ❌ Post-it sulla scrivania
- ❌ File Excel/Word non protetti
- ❌ Chat interne non sicure
- ❌ Note condivise pubbliche

---

## 5️⃣ REGOLE DI SICUREZZA

### ✅ FARE SEMPRE
- Annotare password in luogo sicuro personale
- Bloccare i dati quando ti allontani dal PC
- Chiudere browser a fine giornata
- Cambiare password se qualcuno lascia lo studio
- Verificare che nessuno ti guardi mentre digiti
- Usare password manager personale come backup

### ❌ NON FARE MAI
- ❌ Salvare password nel browser (auto-fill)
- ❌ Scrivere password su post-it visibili
- ❌ Condividere con persone esterne allo studio
- ❌ Inviarla via email/chat non cifrate
- ❌ Lasciare dati sbloccati e andare via
- ❌ Usare password deboli o ovvie
- ❌ Condividere lo schermo con dati sensibili visibili

### 🔄 CAMBIO PASSWORD (Quando Necessario)

⚠️ **CAMBIARE PASSWORD IMMEDIATAMENTE SE:**
- Un collaboratore lascia lo studio
- Sospetto che sia stata compromessa
- Password condivisa accidentalmente con esterni
- Dopo 12 mesi (buona pratica)

**Procedura Cambio Password:**
Solo l'amministratore può cambiare la Master Password:

1. Vai in **Impostazioni** → **Studio**
2. Sezione "Protezione Dati Sensibili"
3. Clicca **"Cambia Password"**
4. Inserisci **vecchia password** (per sicurezza)
5. Inserisci **nuova password** (rispettando i requisiti)
6. Conferma e salva
7. **Importante:** Il sistema ri-cifra automaticamente tutti i dati
8. Comunica nuova password al team via canale sicuro

---

## 6️⃣ RISOLUZIONE PROBLEMI

### 🔴 "Password errata"
**Causa:** Password digitata male  
**Soluzione:**
- ✅ Verifica maiuscole/minuscole
- ✅ Controlla di non avere Caps Lock attivo
- ✅ Riprova copiando dal password manager
- ✅ Chiedi a collega di verificare la password corretta

### 🔴 "Ho dimenticato la password"
**Causa:** Password non annotata  
**Soluzione:**
- ✅ Controlla cassaforte ufficio
- ✅ Controlla password manager condiviso
- ✅ Chiedi ad altri membri del team
- ⚠️ **ULTIMA RISORSA:** Admin deve resettare e riconfigurare (TUTTI i dati dovranno essere ri-cifrati)

🚨 **ATTENZIONE:** Se nessuno ricorda la password e non è annotata da nessuna parte, i dati cifrati sono **IRRECUPERABILI**. È così per design (massima sicurezza).

### 🔴 "Dati sbloccati ma ancora oscurati"
**Causa:** Cache browser o sessione scaduta  
**Soluzione:**
- ✅ Ricarica la pagina (F5 o Ctrl+R)
- ✅ Blocca e sblocca di nuovo
- ✅ Se persiste, chiudi e riapri browser
- ✅ Svuota cache browser

### 🔴 "Si blocca automaticamente troppo spesso"
**Causa:** Timeout 15 minuti di inattività  
**Soluzione:**
- ✅ Normale comportamento di sicurezza
- ✅ Muovi il mouse ogni tanto per mantenerlo attivo
- ✅ Sblocca manualmente quando riprendi a lavorare
- ⚠️ NON è configurabile (per sicurezza)

### 🔴 "Non vedo il pulsante Sblocca"
**Causa:** Protezione non abilitata o errore caricamento  
**Soluzione:**
- ✅ Verifica che admin abbia abilitato protezione in Impostazioni Studio
- ✅ Ricarica la pagina
- ✅ Verifica connessione internet
- ✅ Controlla console browser per errori (F12)

---

## 7️⃣ DOMANDE FREQUENTI (FAQ)

**❓ Devo inserire la password ogni volta che apro una pagina?**  
**Risposta:** NO! Solo 1 volta per sessione (inizio giornata) o dopo auto-lock (15 min inattività).

**❓ Posso usare lo stesso browser di un collega?**  
**Risposta:** Sì, ma ogni utente deve fare login con le proprie credenziali e sbloccare individualmente.

**❓ Cosa succede se perdiamo la password?**  
**Risposta:** I dati cifrati sono IRRECUPERABILI. Per questo è fondamentale annotarla in luoghi sicuri multipli.

**❓ Posso lavorare da casa/remoto?**  
**Risposta:** Sì! Puoi accedere da qualsiasi luogo. Devi solo avere la Master Password con te.

**❓ La password è salvata da qualche parte nel sistema?**  
**Risposta:** NO! La password NON è mai salvata. Sistema usa solo un "sale" matematico. Questo garantisce massima sicurezza.

**❓ Qualcuno può recuperare la mia password?**  
**Risposta:** NO! Nemmeno gli sviluppatori possono. È così per design (sicurezza totale).

**❓ Quanto tempo serve per decifrarla senza password?**  
**Risposta:** Con computer moderno: ~10^77 anni (più vecchio dell'universo!). Praticamente impossibile.

**❓ Cosa proteggere esattamente?**  
**Risposta:** Codici Fiscali, Partite IVA, password portali, PIN, username Entratel/Fisconline, credenziali INPS/INAIL, dati cassetti fiscali.

**❓ Posso disabilitare la protezione?**  
**Risposta:** Sì, ma NON consigliato. Admin può disabilitare in Impostazioni Studio, ma i dati torneranno in chiaro (meno sicuri).

**❓ Quanto è sicuro il sistema?**  
**Risposta:** Usa AES-256-GCM (standard militare/bancario) con 100.000 iterazioni PBKDF2. Stessa sicurezza di banche e governi.

---

## 8️⃣ CHECKLIST OPERATIVE

### 📋 Checklist Setup Iniziale (Admin)
- [ ] Configurare Master Password in Impostazioni Studio
- [ ] Verificare che password rispetti requisiti
- [ ] Annotare password in cassaforte fisica
- [ ] Salvare password in password manager condiviso
- [ ] Comunicare password al team via canale sicuro
- [ ] Verificare che ogni membro possa sbloccare
- [ ] Testare funzionalità su Clienti/Cassetti/Password
- [ ] Stampare questa guida e distribuirla al team

### 📋 Checklist Nuovo Membro Team
- [ ] Ricevere Master Password via canale sicuro
- [ ] Annotare password in password manager personale
- [ ] Testare accesso e sblocco su Studio Manager
- [ ] Leggere questa guida completamente
- [ ] Comprendere regole sicurezza
- [ ] Non condividere password con esterni

### 📋 Checklist Inizio Giornata
- [ ] Accedere a Studio Manager
- [ ] Cliccare "Sblocca Dati"
- [ ] Inserire Master Password
- [ ] Verificare che dati siano visibili
- [ ] Lavorare normalmente

### 📋 Checklist Fine Giornata
- [ ] Completare lavoro aperto
- [ ] Cliccare "Blocca Dati" manualmente
- [ ] Verificare che dati siano oscurati
- [ ] Chiudere browser
- [ ] Spegnere PC o bloccare schermo

### 📋 Checklist Membro Lascia Studio
- [ ] Admin cambia Master Password immediatamente
- [ ] Sistema ri-cifra automaticamente tutti i dati
- [ ] Comunicare nuova password al team rimasto
- [ ] Verificare che vecchia password non funzioni più
- [ ] Aggiornare password in cassaforte/password manager

---

## 9️⃣ SUPPORTO E CONTATTI

### 📞 Hai Bisogno di Aiuto?

Per qualsiasi problema tecnico o dubbio sulla Master Password:

- **📧 Email Supporto:** supporto@studiomanagerpro.it
- **💬 Chat Live:** Disponibile in basso a destra nell'app
- **📖 Documentazione:** www.studiomanagerpro.it/docs
- **🎥 Video Tutorial:** www.studiomanagerpro.it/tutorial

---

**Studio Manager Pro** - Gestione Professionale Studi Commercialisti  
Documento versione 1.0 - Febbraio 2026  
© 2026 Studio Manager Pro. Tutti i diritti riservati.
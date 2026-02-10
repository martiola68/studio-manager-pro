# 📘 Microsoft 365 Setup Guide - Studio Manager Pro

Guida completa per configurare l'integrazione Microsoft 365 con autenticazione **app-only (client_credentials)**.

---

## 🎯 Panoramica

Studio Manager Pro usa l'autenticazione **app-only** (client credentials flow) per accedere a Microsoft 365 Graph API. Questo significa:

- ✅ Nessun popup di login utente
- ✅ Accesso a livello organizzazione (non per singolo utente)
- ✅ Ogni studio può avere il proprio tenant Microsoft 365
- ✅ Configurazione sicura con encryption AES-256-GCM

---

## 📋 Prerequisiti

1. **Azure AD/Entra ID** - Account amministratore del tenant
2. **Microsoft 365 Subscription** - Business o Enterprise
3. **Permessi Admin** - Per concedere admin consent
4. **PowerShell** - Per configurare Application Access Policy (opzionale)

---

## 🚀 Step 1: Registrare Applicazione Azure AD

### 1.1 Accedi ad Azure Portal

Vai su: [https://portal.azure.com](https://portal.azure.com)

Naviga a: **Azure Active Directory** → **App registrations** → **New registration**

### 1.2 Configura l'Applicazione

**Nome:** `Studio Manager Pro - [Nome Studio]`

**Supported account types:** 
- Seleziona: **"Accounts in this organizational directory only (Single tenant)"**

**Redirect URI:**
- Lascia vuoto (non serve per app-only auth)

Clicca **Register**

### 1.3 Annota i Valori Importanti

Dopo la registrazione, annota:

- **Application (client) ID** - UUID dell'applicazione
- **Directory (tenant) ID** - UUID del tenant

Esempio:
```
Application (client) ID: 12345678-1234-1234-1234-123456789abc
Directory (tenant) ID:   87654321-4321-4321-4321-cba987654321
```

---

## 🔐 Step 2: Creare Client Secret

### 2.1 Vai a Certificates & secrets

Nella tua applicazione registrata:
1. Clicca **Certificates & secrets**
2. Clicca **New client secret**

### 2.2 Configura il Secret

**Description:** `Studio Manager Pro Secret`

**Expires:** Seleziona durata (consigliato: 24 months)

Clicca **Add**

### 2.3 Copia il Secret (IMPORTANTE!)

⚠️ **ATTENZIONE**: Il secret viene mostrato **una sola volta**!

Copia il **Value** (non l'ID) e salvalo in modo sicuro.

Esempio:
```
Client Secret: AbC123~dEf456.gHi789-jKl012_mNo345
```

---

## 🔑 Step 3: Configurare Permessi API

### 3.1 Vai a API permissions

1. Clicca **API permissions**
2. Clicca **Add a permission**
3. Seleziona **Microsoft Graph**
4. Seleziona **Application permissions** (NON Delegated)

### 3.2 Aggiungi i Permessi Necessari

Cerca e aggiungi i seguenti permessi:

#### **Calendario & Meeting** (Obbligatori)
- `Calendars.ReadWrite` - Gestione eventi calendario
- `OnlineMeetings.ReadWrite.All` - Creazione meeting Teams

#### **Email** (Opzionali)
- `Mail.Send` - Invio email da organizer
- `Mail.ReadWrite` - Lettura email

#### **Teams** (Opzionali)
- `Group.ReadWrite.All` - Gestione Teams
- `Channel.ReadBasic.All` - Lettura canali Teams
- `ChannelMessage.Send` - Invio messaggi in canali

#### **Organization** (Per test connessione)
- `Organization.Read.All` - Lettura info organizzazione

### 3.3 Concedi Admin Consent

⚠️ **IMPORTANTE**: Clicca **Grant admin consent for [Nome Tenant]**

Conferma con le credenziali admin.

Lo stato deve cambiare in **"Granted for [Nome Tenant]"** (verde).

---

## 📧 Step 4: Configurare Application Access Policy

Per limitare l'accesso dell'app a specifiche caselle email (organizer), configura una **Application Access Policy**.

### 4.1 Installa Exchange Online PowerShell

```powershell
Install-Module -Name ExchangeOnlineManagement
```

### 4.2 Connettiti a Exchange Online

```powershell
Connect-ExchangeOnline -UserPrincipalName admin@tuostudio.onmicrosoft.com
```

### 4.3 Crea un Mail-Enabled Security Group

```powershell
New-DistributionGroup -Name "Studio Manager Organizers" `
  -Type Security `
  -MemberJoinRestriction Closed
```

### 4.4 Aggiungi l'Email Organizer al Gruppo

```powershell
Add-DistributionGroupMember -Identity "Studio Manager Organizers" `
  -Member "agenda@tuostudio.com"
```

### 4.5 Crea Application Access Policy

```powershell
New-ApplicationAccessPolicy -AppId "12345678-1234-1234-1234-123456789abc" `
  -PolicyScopeGroupId "Studio Manager Organizers" `
  -AccessRight RestrictAccess `
  -Description "Restrict Studio Manager Pro to organizer mailbox only"
```

Sostituisci `12345678-1234-1234-1234-123456789abc` con il tuo **Application (client) ID**.

### 4.6 Verifica la Policy

```powershell
Get-ApplicationAccessPolicy | Format-List
```

Dovresti vedere la policy appena creata.

### 4.7 Test della Policy (Opzionale)

```powershell
Test-ApplicationAccessPolicy -Identity "agenda@tuostudio.com" `
  -AppId "12345678-1234-1234-1234-123456789abc"
```

Risultato atteso: `AccessCheckResult : Granted`

---

## 🔧 Step 5: Configurare Studio Manager Pro

### 5.1 Genera Chiave di Encryption

Sul tuo computer, esegui:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Output esempio:
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### 5.2 Aggiungi Chiave in Vercel

1. Vai su **Vercel Dashboard** → Tuo Progetto → **Settings** → **Environment Variables**
2. Clicca **Add Environment Variable**
3. Nome: `ENCRYPTION_KEY`
4. Valore: La chiave generata (64 caratteri hex)
5. Seleziona tutti gli environment (Production, Preview, Development)
6. Clicca **Save**

### 5.3 Rimuovi Vecchie Variabili (Se Presenti)

Elimina queste variabili se esistono:
- `AZURE_CLIENT_SECRET`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`

Non sono più necessarie.

### 5.4 Redeploy l'Applicazione

Dopo aver aggiunto `ENCRYPTION_KEY`, fai un redeploy per applicare le modifiche.

---

## 🎨 Step 6: Configurare il Tuo Studio

### 6.1 Accedi a Studio Manager Pro

Vai su: **Impostazioni** → **Microsoft 365**

### 6.2 Inserisci le Credenziali

Compila il form con i valori ottenuti:

- **Client ID**: `12345678-1234-1234-1234-123456789abc`
- **Client Secret**: `AbC123~dEf456.gHi789-jKl012_mNo345`
- **Tenant ID**: `87654321-4321-4321-4321-cba987654321`
- **Organizer Email** (opzionale): `agenda@tuostudio.com`

### 6.3 Salva e Testa

Clicca **Salva Configurazione**

Il sistema testerà automaticamente la connessione.

Se tutto è OK, vedrai:
```
✅ Connessione riuscita!
Organizzazione: [Nome Tuo Studio]
```

---

## ✅ Verifica Finale

### Test 1: Token Acquisition
```bash
# Nell'app, vai in Impostazioni → Microsoft 365
# Clicca "Testa Connessione"
# Risultato atteso: ✅ Connessione riuscita
```

### Test 2: Graph API Call
```bash
# Crea un evento in Agenda
# Verifica che l'evento appaia in Outlook Calendar dell'organizer
```

### Test 3: Teams Meeting
```bash
# Crea un evento con "Riunione Teams"
# Verifica che il link Teams sia generato correttamente
```

---

## 🔒 Sicurezza

### Cosa viene Cifrato?
- ✅ **Client Secret** - AES-256-GCM con IV random
- ✅ **Chiave encryption** - Solo in Vercel env vars

### Cosa NON viene Salvato?
- ❌ **Token** - Ottenuti al volo e cachati in memoria
- ❌ **Password utenti** - Non servono (app-only auth)

### Best Practices
1. Ruota il Client Secret ogni 6-12 mesi
2. Usa email organizer dedicata (non personale)
3. Monitora i log di accesso in Azure AD
4. Rivoca immediatamente i secret compromessi

---

## 🆘 Troubleshooting

### Errore: "Failed to obtain access token"

**Possibili Cause:**
- Client ID/Secret/Tenant ID errati
- Secret scaduto
- Admin consent non concesso

**Soluzione:**
1. Verifica i valori in Azure Portal
2. Rigenera un nuovo Client Secret
3. Riconferma admin consent

---

### Errore: "Graph API call failed - permissions denied"

**Possibili Cause:**
- Permessi API non concessi
- Admin consent non fatto
- Application Access Policy troppo restrittiva

**Soluzione:**
1. Verifica permessi in Azure Portal
2. Clicca "Grant admin consent"
3. Verifica Application Access Policy con PowerShell

---

### Errore: "Encryption key not found"

**Causa:**
- `ENCRYPTION_KEY` non configurata in Vercel

**Soluzione:**
1. Genera chiave: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Aggiungi in Vercel Environment Variables
3. Redeploy applicazione

---

### Errore: "Invalid encryption key length"

**Causa:**
- Chiave encryption non è 64 caratteri hex (32 bytes)

**Soluzione:**
1. Verifica lunghezza chiave in Vercel
2. Rigenera chiave corretta se necessario
3. Redeploy applicazione

---

## 📚 Risorse Utili

- [Microsoft Graph API Documentation](https://learn.microsoft.com/en-us/graph/api/overview)
- [Application Access Policy Guide](https://learn.microsoft.com/en-us/graph/auth-limit-mailbox-access)
- [Azure AD App Registration](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

---

## 💡 FAQ

### Q: Posso usare un account Microsoft 365 personale?
**A:** No, serve un tenant organizzativo (Business/Enterprise).

### Q: Devo configurare redirect URI?
**A:** No, l'app-only auth non richiede redirect URI.

### Q: Quanto durano i token?
**A:** Circa 1 ora. Vengono automaticamente rinnovati dal sistema.

### Q: Posso avere più organizer per studio?
**A:** Sì, aggiungi tutti gli organizer all'Application Access Policy group.

### Q: Come cambio il Client Secret scaduto?
**A:** Genera un nuovo secret in Azure Portal, poi aggiornalo in Studio Manager Pro (Impostazioni → Microsoft 365).

---

## 📞 Supporto

Per assistenza:
- Email: support@studiomanagerpro.com
- Documentazione: [docs.studiomanagerpro.com](https://docs.studiomanagerpro.com)

---

**Ultima revisione:** Febbraio 2026  
**Versione:** 1.0.0
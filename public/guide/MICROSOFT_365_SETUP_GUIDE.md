# 🚀 Guida Configurazione Microsoft 365 per Studio Manager Pro

Segui questa guida passo-passo per ottenere le credenziali necessarie per l'integrazione.

## 📋 Prerequisiti
- Accesso a **Microsoft Azure Portal** (https://portal.azure.com)
- Account amministratore (es: `info@revisionicommerciali.it`)

---

## 1️⃣ Registrazione Applicazione
1. Vai su **Azure Active Directory** (o "Microsoft Entra ID").
2. Nel menu a sinistra, clicca su **App registrations** (Registrazioni app).
3. Clicca su **New registration** (Nuova registrazione) in alto.
4. Compila i campi:
   - **Name**: `Studio Manager Pro`
   - **Supported account types**: Seleziona "Accounts in this organizational directory only" (Account solo in questa directory organizzativa).
   - **Redirect URI** (Web): Inserisci:
     `https://studio-manager-pro.vercel.app/api/auth/microsoft/callback`
5. Clicca su **Register**.

---

## 2️⃣ Configurazione Permessi API
1. Nel menu a sinistra dell'app appena creata, vai su **API permissions**.
2. Clicca su **Add a permission** → **Microsoft Graph** → **Delegated permissions**.
3. Cerca e seleziona i seguenti permessi:
   - `Calendars.ReadWrite` (Gestione calendario)
   - `Mail.Send` (Invio email)
   - `Mail.Read` (Lettura email)
   - `OnlineMeetings.ReadWrite` (Gestione Teams)
   - `User.Read` (Profilo utente)
   - `offline_access` (Accesso continuo senza login frequenti)
4. Clicca su **Add permissions**.
5. **IMPORTANTE**: Clicca sul pulsante **Grant admin consent for [Nome Organizzazione]** (Concedi consenso amministratore) accanto a "Add a permission". Conferma con "Yes".
   > ✅ Lo stato dei permessi deve diventare verde "Granted".

---

## 3️⃣ Creazione Client Secret (Password)
1. Vai su **Certificates & secrets** nel menu a sinistra.
2. Tab **Client secrets** → Clicca **New client secret**.
3. Description: `Studio Manager Key`
4. Expires: Seleziona `24 months` (o quello che preferisci).
5. Clicca **Add**.
6. ⚠️ **COPIA SUBITO IL VALORE** (colonna "Value", NON "Secret ID"). Non potrai più vederlo dopo aver lasciato la pagina!
   - Questo è il tuo `MICROSOFT_CLIENT_SECRET`.

---

## 4️⃣ Recupero ID (Client & Tenant)
1. Torna su **Overview** (Panoramica) nel menu a sinistra.
2. Copia i seguenti valori:
   - **Application (client) ID**: Questo è il tuo `MICROSOFT_CLIENT_ID`.
   - **Directory (tenant) ID**: Questo è il tuo `MICROSOFT_TENANT_ID`.

---

## 📝 Riepilogo Valori da Inserire in .env.local

Ora dovresti avere questi 4 valori. Inseriscili nel file `.env.local` (tramite l'icona impostazioni in alto a destra su Softgen):

```env
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_REDIRECT_URI=https://studio-manager-pro.vercel.app/api/auth/microsoft/callback
```

---

## 🔍 Troubleshooting
- **Errore "Redirect URI mismatch"**: Verifica che l'URL inserito in Azure sia ESATTAMENTE identico a quello nel file .env (incluso https e slash finali se presenti).
- **Errore "Need admin approval"**: Hai dimenticato il passaggio "Grant admin consent" nel punto 2.5.
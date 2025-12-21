# 📱 GUIDA INSTALLAZIONE STUDIO MANAGER PRO

## 🖥️ **INSTALLAZIONE SU DESKTOP (Windows/Mac/Linux)**

### **Metodo 1: Installazione PWA (CONSIGLIATO)**

#### **Chrome/Edge (Windows/Mac/Linux):**
1. Apri Studio Manager Pro nel browser
2. Guarda in alto a destra nella barra degli indirizzi
3. Vedrai un'icona 💻 **"Installa"** o **"+"**
4. Click sull'icona → Click **"Installa"**
5. ✅ L'app verrà installata come programma standalone
6. 🎉 Troverai l'icona su Desktop e nel menu Start/Applicazioni

#### **Safari (Mac):**
Safari non supporta l'installazione PWA, usa Chrome o crea un collegamento:
1. Apri Studio Manager Pro in Safari
2. Click su **"File"** → **"Aggiungi al Dock"**
3. ✅ Icona aggiunta al Dock

---

### **Metodo 2: Collegamento Desktop Manuale**

#### **Windows:**
1. Apri Studio Manager Pro in Chrome/Edge
2. Click sui **3 puntini** in alto a destra (⋮)
3. **"Altri strumenti"** → **"Crea collegamento..."**
4. ✅ Spunta **"Apri come finestra"**
5. Click **"Crea"**
6. ✅ Collegamento creato sul Desktop

**OPPURE - Manuale completo:**
1. Click destro sul Desktop → **Nuovo** → **Collegamento**
2. Inserisci URL: `https://tuo-dominio.vercel.app`
3. Nome: `Studio Manager Pro`
4. Click **"Fine"**
5. Click destro sul collegamento → **"Proprietà"**
6. Tab **"Collegamento"** → Click **"Cambia icona"**
7. Scegli l'icona scaricata (vedi sotto per scaricare)

#### **Mac:**
1. Apri Studio Manager Pro in Chrome
2. Click sui **3 puntini** in alto a destra
3. **"Salva e condividi"** → **"Crea collegamento..."**
4. ✅ Spunta **"Apri come finestra"**
5. Click **"Crea"**
6. ✅ App aggiunta alla cartella Applicazioni

#### **Linux:**
1. Crea file `studio-manager.desktop` sulla scrivania:

```desktop
[Desktop Entry]
Version=1.0
Type=Application
Name=Studio Manager Pro
Comment=Sistema Gestionale Integrato
Exec=google-chrome --app=https://tuo-dominio.vercel.app
Icon=/percorso/icona-studio-manager.png
Terminal=false
Categories=Office;Finance;
```

2. Rendi eseguibile: `chmod +x studio-manager.desktop`
3. ✅ Doppio click per avviare

---

## 📱 **INSTALLAZIONE SU SMARTPHONE**

### **Android (Chrome):**

#### **Metodo Automatico:**
1. Apri Studio Manager Pro in **Chrome**
2. Comparirà banner: **"Aggiungi Studio Manager Pro alla schermata Home"**
3. Click **"Aggiungi"**
4. ✅ Icona aggiunta alla Home

#### **Metodo Manuale:**
1. Apri Studio Manager Pro in Chrome
2. Click sui **3 puntini** in alto a destra (⋮)
3. **"Aggiungi alla schermata Home"** o **"Installa app"**
4. Click **"Aggiungi"** / **"Installa"**
5. ✅ Icona aggiunta alla Home come app nativa
6. 🎉 Funziona OFFLINE e ricevi notifiche push!

---

### **iPhone/iPad (Safari):**

1. Apri Studio Manager Pro in **Safari** (NON Chrome!)
2. Click sull'icona **"Condividi"** 📤 (in basso al centro)
3. Scorri e trova **"Aggiungi a Home"** 
4. (Opzionale) Modifica il nome: `Studio Manager Pro`
5. Click **"Aggiungi"** in alto a destra
6. ✅ Icona aggiunta alla Home

**Note per iOS:**
- ❌ Chrome/Firefox su iOS NON supportano installazione PWA
- ✅ Usa SOLO Safari per installare
- ✅ L'app funziona come nativa ma senza notifiche push (limitazione iOS)

---

## 🎨 **DOWNLOAD ICONE PERSONALIZZATE**

### **Icone disponibili:**
- 📥 `icon-192.png` (192x192px) - Icona standard
- 📥 `icon-512.png` (512x512px) - Icona alta risoluzione
- 📥 `favicon.ico` - Favicon browser

### **Dove trovarle:**
Le icone sono già nella cartella `/public/` del progetto.

**Per scaricarle:**
1. Vai su: `https://tuo-dominio.vercel.app/icon-512.png`
2. Click destro → **"Salva immagine con nome"**
3. Usa per i collegamenti desktop

---

## 🔧 **CARATTERISTICHE PWA ATTIVE:**

✅ **Installabile** come app nativa (desktop + mobile)
✅ **Funziona OFFLINE** (cache intelligente)
✅ **Icona personalizzata** sulla home/desktop
✅ **Schermo intero** (senza barra browser)
✅ **Shortcuts rapidi** (Dashboard, Clienti, Agenda)
✅ **Aggiornamenti automatici**
✅ **Notifiche push** (solo Android - in sviluppo)

---

## 🚀 **RISOLUZIONE PROBLEMI:**

### **"Non vedo il pulsante Installa"**
- Assicurati di usare Chrome/Edge (Windows/Mac/Linux/Android)
- Safari (Mac) → usa "Aggiungi al Dock"
- Safari (iOS) → usa "Aggiungi a Home"
- Firefox → usa "Crea collegamento"

### **"L'app non si apre"**
- Verifica connessione internet (prima apertura richiede connessione)
- Cancella cache browser
- Reinstalla l'app

### **"Icona non appare"**
- Ricarica la pagina (Ctrl+F5 / Cmd+Shift+R)
- Cancella cache e riprova
- Verifica che il file manifest.json sia accessibile

### **"Voglio disinstallare"**
- **Desktop:** Click destro sull'icona → Disinstalla
- **Android:** Tieni premuto sull'icona → Disinstalla
- **iOS:** Tieni premuto sull'icona → Rimuovi dalla Home

---

## 📞 **SUPPORTO:**

Per problemi o domande:
- 📧 Email: supporto@studiomanagerpro.it
- 💬 Chat: Disponibile nell'app (in sviluppo)
- 📱 WhatsApp: +39 XXX XXX XXXX

---

## ✅ **CHECKLIST INSTALLAZIONE:**

- [ ] Aperto Studio Manager Pro nel browser corretto
- [ ] Verificato URL corretto del deployment
- [ ] Installato come PWA o creato collegamento
- [ ] Icona visibile su Desktop/Home
- [ ] App si apre correttamente
- [ ] Login funzionante
- [ ] Salvato URL per accessi futuri

---

**🎉 INSTALLAZIONE COMPLETATA!**

Studio Manager Pro è ora pronto all'uso come applicazione nativa! 🚀

---

## 📝 **NOTE TECNICHE:**

- **Tecnologia:** Progressive Web App (PWA)
- **Browser supportati:** Chrome, Edge, Safari, Firefox
- **Sistemi operativi:** Windows, macOS, Linux, Android, iOS
- **Requisiti:** Connessione internet (prima apertura), browser moderno
- **Aggiornamenti:** Automatici, nessuna reinstallazione richiesta
- **Sicurezza:** HTTPS obbligatorio, dati criptati
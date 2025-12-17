// Database locale con localStorage per STUDIO MANAGER PRO

import { 
  Utente, 
  RuoloOperatore, 
  Prestazione, 
  Studio, 
  Contatto, 
  Cliente,
  ScadenzaIva,
  ScadenzaCCGG,
  ScadenzaCU,
  ScadenzaFiscali,
  ScadenzaBilanci,
  Scadenza770,
  ScadenzaLipe,
  ScadenzaEstero,
  ScadenzaProforma,
  Appuntamento,
  Newsletter
} from "@/types";

const STORAGE_KEYS = {
  UTENTI: "smp_utenti",
  RUOLI: "smp_ruoli",
  PRESTAZIONI: "smp_prestazioni",
  STUDIO: "smp_studio",
  CONTATTI: "smp_contatti",
  CLIENTI: "smp_clienti",
  SCAD_IVA: "smp_scad_iva",
  SCAD_CCGG: "smp_scad_ccgg",
  SCAD_CU: "smp_scad_cu",
  SCAD_FISCALI: "smp_scad_fiscali",
  SCAD_BILANCI: "smp_scad_bilanci",
  SCAD_770: "smp_scad_770",
  SCAD_LIPE: "smp_scad_lipe",
  SCAD_ESTERO: "smp_scad_estero",
  SCAD_PROFORMA: "smp_scad_proforma",
  APPUNTAMENTI: "smp_appuntamenti",
  NEWSLETTER: "smp_newsletter",
  CURRENT_USER: "smp_current_user"
};

// Utility functions
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateCodiceCliente(): string {
  const clienti = getClienti();
  const numero = clienti.length + 1;
  return `CLI${numero.toString().padStart(5, "0")}`;
}

// Generic CRUD operations
function getFromStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function saveToStorage<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

// Initialize default data
export function initializeDatabase(): void {
  if (typeof window === "undefined") return;

  // Prestazioni predefinite
  const prestazioni = getPrestazioni();
  if (prestazioni.length === 0) {
    const defaultPrestazioni: Prestazione[] = [
      { ID: generateId(), Descrizione: "Assistenza totale" },
      { ID: generateId(), Descrizione: "Consulenza fiscale e tributaria" },
      { ID: generateId(), Descrizione: "Bilanci e dichiarazioni" },
      { ID: generateId(), Descrizione: "Consulenza del lavoro" }
    ];
    savePrestazioni(defaultPrestazioni);
  }

  // Utente admin predefinito
  const utenti = getUtenti();
  if (utenti.length === 0) {
    const adminUser: Utente = {
      id: generateId(),
      Nome: "Admin",
      Cognome: "Sistema",
      Email: "admin@studio.it",
      Password: "admin123",
      TipoUtente: "Admin",
      attivo: true
    };
    saveUtenti([adminUser]);
  }

  // Studio predefinito
  const studio = getStudio();
  if (!studio) {
    const defaultStudio: Studio = {
      id: generateId(),
      RagioneSociale: "Studio Manager Pro",
      DenominazioneBreve: "SMP",
      PartitaIVA: "",
      CodiceFiscale: "",
      Indirizzo: "",
      CAP: "",
      Città: "",
      Provincia: "",
      Telefono: "",
      Email: "",
      PEC: "",
      SitoWeb: "",
      Note: "",
      attivo: true
    };
    saveStudio(defaultStudio);
  }
}

// Utenti
export function getUtenti(): Utente[] {
  return getFromStorage<Utente>(STORAGE_KEYS.UTENTI);
}

export function saveUtenti(utenti: Utente[]): void {
  saveToStorage(STORAGE_KEYS.UTENTI, utenti);
}

export function getCurrentUser(): Utente | null {
  if (typeof window === "undefined") return null;
  const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (!userId) return null;
  const utenti = getUtenti();
  return utenti.find(u => u.id === userId) || null;
}

export function setCurrentUser(userId: string | null): void {
  if (typeof window === "undefined") return;
  if (userId) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, userId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
}

export function login(email: string, password: string): Utente | null {
  const utenti = getUtenti();
  const user = utenti.find(u => u.Email === email && u.Password === password && u.attivo);
  if (user) {
    setCurrentUser(user.id);
    return user;
  }
  return null;
}

export function logout(): void {
  setCurrentUser(null);
}

// Ruoli
export function getRuoli(): RuoloOperatore[] {
  return getFromStorage<RuoloOperatore>(STORAGE_KEYS.RUOLI);
}

export function saveRuoli(ruoli: RuoloOperatore[]): void {
  saveToStorage(STORAGE_KEYS.RUOLI, ruoli);
}

// Prestazioni
export function getPrestazioni(): Prestazione[] {
  return getFromStorage<Prestazione>(STORAGE_KEYS.PRESTAZIONI);
}

export function savePrestazioni(prestazioni: Prestazione[]): void {
  saveToStorage(STORAGE_KEYS.PRESTAZIONI, prestazioni);
}

// Studio
export function getStudio(): Studio | null {
  const studios = getFromStorage<Studio>(STORAGE_KEYS.STUDIO);
  return studios.find(s => s.attivo) || null;
}

export function saveStudio(studio: Studio): void {
  const studios = getFromStorage<Studio>(STORAGE_KEYS.STUDIO);
  const filtered = studios.filter(s => s.id !== studio.id);
  saveToStorage(STORAGE_KEYS.STUDIO, [...filtered, studio]);
}

// Contatti
export function getContatti(): Contatto[] {
  return getFromStorage<Contatto>(STORAGE_KEYS.CONTATTI);
}

export function saveContatti(contatti: Contatto[]): void {
  saveToStorage(STORAGE_KEYS.CONTATTI, contatti);
}

// Clienti
export function getClienti(): Cliente[] {
  return getFromStorage<Cliente>(STORAGE_KEYS.CLIENTI);
}

export function saveClienti(clienti: Cliente[]): void {
  saveToStorage(STORAGE_KEYS.CLIENTI, clienti);
}

// Scadenze
export function getScadenze<T>(tipo: string): T[] {
  return getFromStorage<T>(tipo);
}

export function saveScadenze<T>(tipo: string, scadenze: T[]): void {
  saveToStorage(tipo, scadenze);
}

export const SCADENZE_KEYS = {
  IVA: STORAGE_KEYS.SCAD_IVA,
  CCGG: STORAGE_KEYS.SCAD_CCGG,
  CU: STORAGE_KEYS.SCAD_CU,
  FISCALI: STORAGE_KEYS.SCAD_FISCALI,
  BILANCI: STORAGE_KEYS.SCAD_BILANCI,
  "770": STORAGE_KEYS.SCAD_770,
  LIPE: STORAGE_KEYS.SCAD_LIPE,
  ESTERO: STORAGE_KEYS.SCAD_ESTERO,
  PROFORMA: STORAGE_KEYS.SCAD_PROFORMA
};

// Appuntamenti
export function getAppuntamenti(): Appuntamento[] {
  return getFromStorage<Appuntamento>(STORAGE_KEYS.APPUNTAMENTI);
}

export function saveAppuntamenti(appuntamenti: Appuntamento[]): void {
  saveToStorage(STORAGE_KEYS.APPUNTAMENTI, appuntamenti);
}

// Newsletter
export function getNewsletter(): Newsletter[] {
  return getFromStorage<Newsletter>(STORAGE_KEYS.NEWSLETTER);
}

export function saveNewsletter(newsletter: Newsletter[]): void {
  saveToStorage(STORAGE_KEYS.NEWSLETTER, newsletter);
}
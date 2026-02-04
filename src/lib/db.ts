import { 
  Studio, 
  Utente, 
  Cliente, 
  Contatto, 
  Scadenza, 
  EventoAgenda, 
  Comunicazione,
  TipoScadenza,
  StatoScadenza,
  TipoEvento,
  StatoComunicazione
} from "@/types";

// Safe localStorage access
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail if localStorage is not available
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail if localStorage is not available
    }
  }
};

// Initialize database with default data
export function initializeDatabase() {
  if (typeof window === "undefined") return;

  const studioData = safeLocalStorage.getItem("smp_studio");
  if (!studioData) {
    const defaultStudio: Studio = {
      ID_Studio: "studio-001",
      RagioneSociale: "ProWork Studio M",
      DenominazioneBreve: "PWSM",
      PartitaIVA: "12345678901",
      CodiceFiscale: "12345678901",
      Indirizzo: "Via Roma 1",
      CAP: "00100",
      Citta: "Roma",
      Provincia: "RM",
      Telefono: "06 1234567",
      Email: "info@proworkstudiom.it",
      PEC: "pec@proworkstudiom.it",
      Logo: null,
      DataCreazione: new Date().toISOString(),
      DataUltimaModifica: new Date().toISOString()
    };
    safeLocalStorage.setItem("smp_studio", JSON.stringify(defaultStudio));
  }

  const utentiData = safeLocalStorage.getItem("smp_utenti");
  if (!utentiData) {
    const defaultUtenti: Utente[] = [
      {
        ID_Utente: "user-001",
        Username: "admin",
        Password: "admin123",
        Nome: "Amministratore",
        Cognome: "Sistema",
        Email: "admin@studiomanagerpro.it",
        TipoUtente: "Admin",
        Attivo: true,
        DataCreazione: new Date().toISOString(),
        DataUltimaModifica: new Date().toISOString()
      }
    ];
    safeLocalStorage.setItem("smp_utenti", JSON.stringify(defaultUtenti));
  }

  const clientiData = safeLocalStorage.getItem("smp_clienti");
  if (!clientiData) {
    safeLocalStorage.setItem("smp_clienti", JSON.stringify([]));
  }

  const contattiData = safeLocalStorage.getItem("smp_contatti");
  if (!contattiData) {
    safeLocalStorage.setItem("smp_contatti", JSON.stringify([]));
  }

  const scadenzeData = safeLocalStorage.getItem("smp_scadenze");
  if (!scadenzeData) {
    safeLocalStorage.setItem("smp_scadenze", JSON.stringify([]));
  }

  const eventiData = safeLocalStorage.getItem("smp_eventi");
  if (!eventiData) {
    safeLocalStorage.setItem("smp_eventi", JSON.stringify([]));
  }

  const comunicazioniData = safeLocalStorage.getItem("smp_comunicazioni");
  if (!comunicazioniData) {
    safeLocalStorage.setItem("smp_comunicazioni", JSON.stringify([]));
  }
}

// Studio functions
export function getStudio(): Studio | null {
  const data = safeLocalStorage.getItem("smp_studio");
  return data ? JSON.parse(data) : null;
}

export function updateStudio(studio: Partial<Studio>): void {
  const currentStudio = getStudio();
  if (!currentStudio) return;

  const updatedStudio = {
    ...currentStudio,
    ...studio,
    DataUltimaModifica: new Date().toISOString()
  };

  safeLocalStorage.setItem("smp_studio", JSON.stringify(updatedStudio));
  
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("studio-updated"));
  }
}

// User functions
export function getUtenti(): Utente[] {
  const data = safeLocalStorage.getItem("smp_utenti");
  return data ? JSON.parse(data) : [];
}

export function getUtenteById(id: string): Utente | null {
  const utenti = getUtenti();
  return utenti.find(u => u.ID_Utente === id) || null;
}

export function createUtente(utente: Omit<Utente, "ID_Utente" | "DataCreazione" | "DataUltimaModifica">): Utente {
  const utenti = getUtenti();
  const newUtente: Utente = {
    ...utente,
    ID_Utente: `user-${Date.now()}`,
    DataCreazione: new Date().toISOString(),
    DataUltimaModifica: new Date().toISOString()
  };
  utenti.push(newUtente);
  safeLocalStorage.setItem("smp_utenti", JSON.stringify(utenti));
  return newUtente;
}

export function updateUtente(id: string, updates: Partial<Utente>): Utente | null {
  const utenti = getUtenti();
  const index = utenti.findIndex(u => u.ID_Utente === id);
  if (index === -1) return null;

  utenti[index] = {
    ...utenti[index],
    ...updates,
    DataUltimaModifica: new Date().toISOString()
  };
  safeLocalStorage.setItem("smp_utenti", JSON.stringify(utenti));
  return utenti[index];
}

export function deleteUtente(id: string): boolean {
  const utenti = getUtenti();
  const filtered = utenti.filter(u => u.ID_Utente !== id);
  if (filtered.length === utenti.length) return false;
  safeLocalStorage.setItem("smp_utenti", JSON.stringify(filtered));
  return true;
}

export function getCurrentUser(): Utente | null {
  const data = safeLocalStorage.getItem("smp_current_user");
  return data ? JSON.parse(data) : null;
}

export function setCurrentUser(user: Utente | null): void {
  if (user) {
    safeLocalStorage.setItem("smp_current_user", JSON.stringify(user));
  } else {
    safeLocalStorage.removeItem("smp_current_user");
  }
}

export function login(username: string, password: string): Utente | null {
  const utenti = getUtenti();
  const user = utenti.find(u => u.Username === username && u.Password === password && u.Attivo);
  if (user) {
    setCurrentUser(user);
  }
  return user || null;
}

export function logout(): void {
  setCurrentUser(null);
}

// Cliente functions
export function getClienti(): Cliente[] {
  const data = safeLocalStorage.getItem("smp_clienti");
  return data ? JSON.parse(data) : [];
}

export function getClienteById(id: string): Cliente | null {
  const clienti = getClienti();
  return clienti.find(c => c.ID_Cliente === id) || null;
}

export function createCliente(cliente: Omit<Cliente, "ID_Cliente" | "DataCreazione" | "DataUltimaModifica">): Cliente {
  const clienti = getClienti();
  const newCliente: Cliente = {
    ...cliente,
    ID_Cliente: `cliente-${Date.now()}`,
    DataCreazione: new Date().toISOString(),
    DataUltimaModifica: new Date().toISOString()
  };
  clienti.push(newCliente);
  safeLocalStorage.setItem("smp_clienti", JSON.stringify(clienti));
  return newCliente;
}

export function updateCliente(id: string, updates: Partial<Cliente>): Cliente | null {
  const clienti = getClienti();
  const index = clienti.findIndex(c => c.ID_Cliente === id);
  if (index === -1) return null;

  clienti[index] = {
    ...clienti[index],
    ...updates,
    DataUltimaModifica: new Date().toISOString()
  };
  safeLocalStorage.setItem("smp_clienti", JSON.stringify(clienti));
  return clienti[index];
}

export function deleteCliente(id: string): boolean {
  const clienti = getClienti();
  const filtered = clienti.filter(c => c.ID_Cliente !== id);
  if (filtered.length === clienti.length) return false;
  safeLocalStorage.setItem("smp_clienti", JSON.stringify(filtered));
  return true;
}

// Contatto functions
export function getContatti(): Contatto[] {
  const data = safeLocalStorage.getItem("smp_contatti");
  return data ? JSON.parse(data) : [];
}

export function getContattoById(id: string): Contatto | null {
  const contatti = getContatti();
  return contatti.find(c => c.ID_Contatto === id) || null;
}

export function getContattiByCliente(clienteId: string): Contatto[] {
  const contatti = getContatti();
  return contatti.filter(c => c.ID_Cliente === clienteId);
}

export function createContatto(contatto: Omit<Contatto, "ID_Contatto" | "DataCreazione" | "DataUltimaModifica">): Contatto {
  const contatti = getContatti();
  const newContatto: Contatto = {
    ...contatto,
    ID_Contatto: `contatto-${Date.now()}`,
    DataCreazione: new Date().toISOString(),
    DataUltimaModifica: new Date().toISOString()
  };
  contatti.push(newContatto);
  safeLocalStorage.setItem("smp_contatti", JSON.stringify(contatti));
  return newContatto;
}

export function updateContatto(id: string, updates: Partial<Contatto>): Contatto | null {
  const contatti = getContatti();
  const index = contatti.findIndex(c => c.ID_Contatto === id);
  if (index === -1) return null;

  contatti[index] = {
    ...contatti[index],
    ...updates,
    DataUltimaModifica: new Date().toISOString()
  };
  safeLocalStorage.setItem("smp_contatti", JSON.stringify(contatti));
  return contatti[index];
}

export function deleteContatto(id: string): boolean {
  const contatti = getContatti();
  const filtered = contatti.filter(c => c.ID_Contatto !== id);
  if (filtered.length === contatti.length) return false;
  safeLocalStorage.setItem("smp_contatti", JSON.stringify(filtered));
  return true;
}

// Scadenza functions
export function getScadenze(): Scadenza[] {
  const data = safeLocalStorage.getItem("smp_scadenze");
  return data ? JSON.parse(data) : [];
}

export function getScadenzaById(id: string): Scadenza | null {
  const scadenze = getScadenze();
  return scadenze.find(s => s.ID_Scadenza === id) || null;
}

export function getScadenzeByCliente(clienteId: string): Scadenza[] {
  const scadenze = getScadenze();
  return scadenze.filter(s => s.ID_Cliente === clienteId);
}

export function getScadenzeByTipo(tipo: TipoScadenza): Scadenza[] {
  const scadenze = getScadenze();
  return scadenze.filter(s => s.TipoScadenza === tipo);
}

export function createScadenza(scadenza: Omit<Scadenza, "ID_Scadenza" | "DataCreazione" | "DataUltimaModifica">): Scadenza {
  const scadenze = getScadenze();
  const newScadenza: Scadenza = {
    ...scadenza,
    ID_Scadenza: `scadenza-${Date.now()}`,
    DataCreazione: new Date().toISOString(),
    DataUltimaModifica: new Date().toISOString()
  };
  scadenze.push(newScadenza);
  safeLocalStorage.setItem("smp_scadenze", JSON.stringify(scadenze));
  return newScadenza;
}

export function updateScadenza(id: string, updates: Partial<Scadenza>): Scadenza | null {
  const scadenze = getScadenze();
  const index = scadenze.findIndex(s => s.ID_Scadenza === id);
  if (index === -1) return null;

  scadenze[index] = {
    ...scadenze[index],
    ...updates,
    DataUltimaModifica: new Date().toISOString()
  };
  safeLocalStorage.setItem("smp_scadenze", JSON.stringify(scadenze));
  return scadenze[index];
}

export function deleteScadenza(id: string): boolean {
  const scadenze = getScadenze();
  const filtered = scadenze.filter(s => s.ID_Scadenza !== id);
  if (filtered.length === scadenze.length) return false;
  safeLocalStorage.setItem("smp_scadenze", JSON.stringify(filtered));
  return true;
}

// Evento Agenda functions
export function getEventi(): EventoAgenda[] {
  const data = safeLocalStorage.getItem("smp_eventi");
  return data ? JSON.parse(data) : [];
}

export function getEventoById(id: string): EventoAgenda | null {
  const eventi = getEventi();
  return eventi.find(e => e.ID_Evento === id) || null;
}

export function getEventiByUtente(utenteId: string): EventoAgenda[] {
  const eventi = getEventi();
  return eventi.filter(e => e.ID_Utente === utenteId);
}

export function createEvento(evento: Omit<EventoAgenda, "ID_Evento" | "DataCreazione" | "DataUltimaModifica">): EventoAgenda {
  const eventi = getEventi();
  const newEvento: EventoAgenda = {
    ...evento,
    ID_Evento: `evento-${Date.now()}`,
    DataCreazione: new Date().toISOString(),
    DataUltimaModifica: new Date().toISOString()
  };
  eventi.push(newEvento);
  safeLocalStorage.setItem("smp_eventi", JSON.stringify(eventi));
  return newEvento;
}

export function updateEvento(id: string, updates: Partial<EventoAgenda>): EventoAgenda | null {
  const eventi = getEventi();
  const index = eventi.findIndex(e => e.ID_Evento === id);
  if (index === -1) return null;

  eventi[index] = {
    ...eventi[index],
    ...updates,
    DataUltimaModifica: new Date().toISOString()
  };
  safeLocalStorage.setItem("smp_eventi", JSON.stringify(eventi));
  return eventi[index];
}

export function deleteEvento(id: string): boolean {
  const eventi = getEventi();
  const filtered = eventi.filter(e => e.ID_Evento !== id);
  if (filtered.length === eventi.length) return false;
  safeLocalStorage.setItem("smp_eventi", JSON.stringify(filtered));
  return true;
}

// Comunicazione functions
export function getComunicazioni(): Comunicazione[] {
  const data = safeLocalStorage.getItem("smp_comunicazioni");
  return data ? JSON.parse(data) : [];
}

export function getComunicazioneById(id: string): Comunicazione | null {
  const comunicazioni = getComunicazioni();
  return comunicazioni.find(c => c.ID_Comunicazione === id) || null;
}

export function getComunicazioniByCliente(clienteId: string): Comunicazione[] {
  const comunicazioni = getComunicazioni();
  return comunicazioni.filter(c => c.ID_Cliente === clienteId);
}

export function createComunicazione(comunicazione: Omit<Comunicazione, "ID_Comunicazione" | "DataCreazione" | "DataUltimaModifica">): Comunicazione {
  const comunicazioni = getComunicazioni();
  const newComunicazione: Comunicazione = {
    ...comunicazione,
    ID_Comunicazione: `comunicazione-${Date.now()}`,
    DataCreazione: new Date().toISOString(),
    DataUltimaModifica: new Date().toISOString()
  };
  comunicazioni.push(newComunicazione);
  safeLocalStorage.setItem("smp_comunicazioni", JSON.stringify(comunicazioni));
  return newComunicazione;
}

export function updateComunicazione(id: string, updates: Partial<Comunicazione>): Comunicazione | null {
  const comunicazioni = getComunicazioni();
  const index = comunicazioni.findIndex(c => c.ID_Comunicazione === id);
  if (index === -1) return null;

  comunicazioni[index] = {
    ...comunicazioni[index],
    ...updates,
    DataUltimaModifica: new Date().toISOString()
  };
  safeLocalStorage.setItem("smp_comunicazioni", JSON.stringify(comunicazioni));
  return comunicazioni[index];
}

export function deleteComunicazione(id: string): boolean {
  const comunicazioni = getComunicazioni();
  const filtered = comunicazioni.filter(c => c.ID_Comunicazione !== id);
  if (filtered.length === comunicazioni.length) return false;
  safeLocalStorage.setItem("smp_comunicazioni", JSON.stringify(filtered));
  return true;
}
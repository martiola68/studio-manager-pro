// Tipi e interfacce per STUDIO MANAGER PRO

export type TipoUtente = "Admin" | "User";
export type TipoCliente = "Interno" | "Esterno";

// Costanti per le scadenze
export const SCADENZE_KEYS = {
  IVA: "IVA",
  CCGG: "CCGG",
  CU: "CU",
  FISCALI: "Fiscali",
  BILANCI: "Bilanci",
  "770": "770",
  LIPE: "LIPE",
  ESTEROMETRO: "Esterometro",
  PROFORMA: "Proforma"
} as const;

export interface Studio {
  ID_Studio: string;
  RagioneSociale: string;
  DenominazioneBreve: string;
  PartitaIVA: string;
  CodiceFiscale: string;
  Indirizzo: string;
  CAP: string;
  Citta: string;
  Provincia: string;
  Telefono: string;
  Email: string;
  PEC: string;
  SitoWeb?: string;
  Logo: string | null;
  Note?: string;
  DataCreazione: string;
  DataUltimaModifica: string;
}

export interface Utente {
  ID_Utente: string;
  Username: string;
  Password?: string;
  Nome: string;
  Cognome: string;
  Email: string;
  TipoUtente: TipoUtente;
  RuoloOperatore?: string;
  Attivo: boolean;
  DataCreazione: string;
  DataUltimaModifica: string;
}

export interface Cliente {
  ID_Cliente: string;
  RagioneSociale: string;
  PartitaIVA: string;
  CodiceFiscale: string;
  Indirizzo: string;
  CAP: string;
  Citta: string;
  Provincia: string;
  Email: string;
  PEC?: string;
  Telefono?: string;
  Note?: string;
  Attivo: boolean;
  TipoCliente?: TipoCliente;
  // Flag per servizi attivi
  Flag_Iva?: boolean;
  Flag_CU?: boolean;
  Flag_Bilancio?: boolean;
  Flag_Fiscali?: boolean;
  Flag_Lipe?: boolean;
  Flag_770?: boolean;
  Flag_Esterometro?: boolean;
  Flag_ccgg?: boolean;
  Flag_Proforma?: boolean;
  DataCreazione: string;
  DataUltimaModifica: string;
}

export interface Contatto {
  ID_Contatto: string;
  ID_Cliente: string;
  Nome: string;
  Cognome: string;
  Email: string;
  Telefono?: string;
  Cellulare?: string;
  Ruolo?: string;
  Note?: string;
  DataCreazione: string;
  DataUltimaModifica: string;
}

export type TipoScadenza = typeof SCADENZE_KEYS[keyof typeof SCADENZE_KEYS];
export type StatoScadenza = "InAttesa" | "InLavorazione" | "Completata" | "Annullata";

export interface Scadenza {
  ID_Scadenza: string;
  ID_Cliente: string;
  TipoScadenza: TipoScadenza;
  StatoScadenza: StatoScadenza;
  DataScadenza: string;
  Descrizione?: string;
  ConfermaRiga: boolean;
  Note?: string;
  // Campi specifici opzionali
  Importo?: number;
  DataInvio?: string;
  DataDeposito?: string;
  DataApprovazione?: string;
  Periodo?: string; // Es. "Gennaio", "Trim1"
  DataCreazione: string;
  DataUltimaModifica: string;
}

export type TipoEvento = "Appuntamento" | "Riunione" | "Scadenza" | "Altro";

export interface EventoAgenda {
  ID_Evento: string;
  ID_Utente: string;
  ID_Cliente?: string;
  Titolo: string;
  Descrizione?: string;
  DataInizio: string;
  DataFine: string;
  TuttoGiorno: boolean;
  Colore?: string;
  Luogo?: string;
  InSede?: boolean;
  Sala?: string;
  TipoEvento: TipoEvento;
  DataCreazione: string;
  DataUltimaModifica: string;
}

export type StatoComunicazione = "Bozza" | "Inviata" | "Letta" | "Archiviata";

export interface Comunicazione {
  ID_Comunicazione: string;
  ID_Cliente: string;
  Oggetto: string;
  Messaggio: string;
  DataInvio?: string;
  Stato: StatoComunicazione;
  Letto: boolean;
  DataCreazione: string;
  DataUltimaModifica: string;
}
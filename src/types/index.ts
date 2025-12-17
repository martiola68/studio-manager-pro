// Tipi e interfacce per STUDIO MANAGER PRO

export type TipoUtente = "Admin" | "User";
export type TipoCliente = "Interno" | "Esterno";

export interface Utente {
  id: string;
  Nome: string;
  Cognome: string;
  Email: string;
  Password: string;
  TipoUtente: TipoUtente;
  RuoloOperatore?: string;
  attivo: boolean;
}

export interface RuoloOperatore {
  ID: string;
  Ruolo: string;
}

export interface Prestazione {
  ID: string;
  Descrizione: string;
}

export interface Studio {
  id: string;
  RagioneSociale: string;
  DenominazioneBreve: string;
  PartitaIVA: string;
  CodiceFiscale: string;
  Indirizzo: string;
  CAP: string;
  Città: string;
  Provincia: string;
  Telefono: string;
  Email: string;
  PEC: string;
  SitoWeb: string;
  Logo?: string;
  Note: string;
  attivo: boolean;
}

export interface Contatto {
  id: string;
  Nome: string;
  Cognome: string;
  Email: string;
  Cell: string;
  Tel: string;
  Note: string;
  CassettoFiscale: boolean;
  Utente: string;
  Password: string;
  Pin: string;
  Password_iniziale: string;
}

export interface Cliente {
  id: string;
  cod_cliente: string;
  Ragione_Sociale: string;
  codice_fiscale: string;
  partita_iva: string;
  indirizzo: string;
  cap: string;
  città: string;
  provincia: string;
  email: string;
  note: string;
  attivo: boolean;
  UtenteOperatore?: string;
  UtenteProfessionista?: string;
  Contatto1?: string;
  Contatto2?: string;
  Scadenza_Antiric?: string;
  TipoPrestazioneId?: string;
  TipoCliente: TipoCliente;
  data_creazione: string;
  Flag_Iva: boolean;
  Flag_CU: boolean;
  Flag_Bilancio: boolean;
  Flag_Fiscali: boolean;
  Flag_Lipe: boolean;
  Flag_770: boolean;
  Flag_Esterometro: boolean;
  Flag_ccgg: boolean;
  Flag_Proforma: boolean;
  Flag_mail_attivo: boolean;
  Flag_mail_scadenze: boolean;
  Flag_mail_newsletter: boolean;
}

export interface ScadenzaBase {
  id: string;
  Nominativo: string;
  UtenteOperatore?: string;
  UtenteProfessionista?: string;
  confermaRiga?: boolean;
}

export interface ScadenzaIva extends ScadenzaBase {
  Gennaio: string;
  Febbraio: string;
  Marzo: string;
  Aprile: string;
  Maggio: string;
  Giugno: string;
  Luglio: string;
  Agosto: string;
  Settembre: string;
  Ottobre: string;
  Novembre: string;
  Dicembre: string;
}

export interface ScadenzaCCGG extends ScadenzaBase {
  DataInizio: string;
  DataFine: string;
  DataDeposito: string;
}

export interface ScadenzaCU extends ScadenzaBase {
  DataInvio: string;
}

export interface ScadenzaFiscali extends ScadenzaBase {
  ModelloUnico: string;
  Irap: string;
  Iva: string;
  Mod770: string;
  RicevutaR: boolean;
}

export interface ScadenzaBilanci extends ScadenzaBase {
  DataApprovazione: string;
  DataDeposito: string;
}

export interface Scadenza770 extends ScadenzaBase {
  DataInvio: string;
}

export interface ScadenzaLipe extends ScadenzaBase {
  Gennaio: boolean;
  Febbraio: boolean;
  Marzo: boolean;
  Aprile: boolean;
  Maggio: boolean;
  Giugno: boolean;
  Luglio: boolean;
  Agosto: boolean;
  Settembre: boolean;
  Ottobre: boolean;
  Novembre: boolean;
  Dicembre: boolean;
}

export interface ScadenzaEstero extends ScadenzaBase {
  Trim1: boolean;
  Trim2: boolean;
  Trim3: boolean;
  Trim4: boolean;
}

export interface ScadenzaProforma extends ScadenzaBase {
  Gennaio: boolean;
  Febbraio: boolean;
  Marzo: boolean;
  Aprile: boolean;
  Maggio: boolean;
  Giugno: boolean;
  Luglio: boolean;
  Agosto: boolean;
  Settembre: boolean;
  Ottobre: boolean;
  Novembre: boolean;
  Dicembre: boolean;
}

export interface Appuntamento {
  id: string;
  titolo: string;
  descrizione: string;
  dataInizio: string;
  dataFine: string;
  utenteId: string;
  clienteId?: string;
  inSede: boolean;
  sala?: string;
  colore: string;
}

export interface Newsletter {
  id: string;
  oggetto: string;
  corpo: string;
  dataInvio: string;
  destinatari: string[];
  allegati?: string[];
}
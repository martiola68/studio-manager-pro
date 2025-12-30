 
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      event_confirmations: {
        Row: {
          confirmed: boolean | null
          confirmed_at: string | null
          created_at: string | null
          evento_id: string
          id: string
          token: string
          user_email: string
          user_name: string | null
        }
        Insert: {
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          evento_id: string
          id?: string
          token: string
          user_email: string
          user_name?: string | null
        }
        Update: {
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          evento_id?: string
          id?: string
          token?: string
          user_email?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_confirmations_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "tbagenda"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders: {
        Row: {
          evento_id: string
          id: string
          sent_at: string | null
          sent_to: string
        }
        Insert: {
          evento_id: string
          id?: string
          sent_at?: string | null
          sent_to: string
        }
        Update: {
          evento_id?: string
          id?: string
          sent_at?: string | null
          sent_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "tbagenda"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tbagenda: {
        Row: {
          cliente_id: string | null
          colore: string | null
          created_at: string | null
          data_fine: string
          data_inizio: string
          descrizione: string | null
          id: string
          in_sede: boolean | null
          luogo: string | null
          partecipanti: Json | null
          sala: string | null
          titolo: string
          tutto_giorno: boolean | null
          updated_at: string | null
          utente_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          colore?: string | null
          created_at?: string | null
          data_fine: string
          data_inizio: string
          descrizione?: string | null
          id?: string
          in_sede?: boolean | null
          luogo?: string | null
          partecipanti?: Json | null
          sala?: string | null
          titolo: string
          tutto_giorno?: boolean | null
          updated_at?: string | null
          utente_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          colore?: string | null
          created_at?: string | null
          data_fine?: string
          data_inizio?: string
          descrizione?: string | null
          id?: string
          in_sede?: boolean | null
          luogo?: string | null
          partecipanti?: Json | null
          sala?: string | null
          titolo?: string
          tutto_giorno?: boolean | null
          updated_at?: string | null
          utente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbagenda_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "tbclienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbagenda_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbclienti: {
        Row: {
          attivo: boolean | null
          cap: string
          citta: string
          cod_cliente: string
          codice_fiscale: string
          contatto1_id: string | null
          contatto2_id: string | null
          created_at: string | null
          data_creazione: string | null
          data_ultima_verifica_antiric: string | null
          data_ultima_verifica_b: string | null
          email: string
          flag_770: boolean | null
          flag_bilancio: boolean | null
          flag_ccgg: boolean | null
          flag_cu: boolean | null
          flag_esterometro: boolean | null
          flag_fiscali: boolean | null
          flag_imu: boolean | null
          flag_iva: boolean | null
          flag_lipe: boolean | null
          flag_mail_attivo: boolean | null
          flag_mail_newsletter: boolean | null
          flag_mail_scadenze: boolean | null
          flag_proforma: boolean | null
          id: string
          indirizzo: string
          note: string | null
          partita_iva: string
          provincia: string
          ragione_sociale: string
          scadenza_antiric: string | null
          scadenza_antiric_b: string | null
          tipo_cliente: string | null
          tipo_prestazione_a: string | null
          tipo_prestazione_b: string | null
          tipo_prestazione_id: string | null
          tipo_redditi: string | null
          updated_at: string | null
          utente_operatore_id: string | null
          utente_professionista_id: string | null
        }
        Insert: {
          attivo?: boolean | null
          cap: string
          citta: string
          cod_cliente: string
          codice_fiscale: string
          contatto1_id?: string | null
          contatto2_id?: string | null
          created_at?: string | null
          data_creazione?: string | null
          data_ultima_verifica_antiric?: string | null
          data_ultima_verifica_b?: string | null
          email: string
          flag_770?: boolean | null
          flag_bilancio?: boolean | null
          flag_ccgg?: boolean | null
          flag_cu?: boolean | null
          flag_esterometro?: boolean | null
          flag_fiscali?: boolean | null
          flag_imu?: boolean | null
          flag_iva?: boolean | null
          flag_lipe?: boolean | null
          flag_mail_attivo?: boolean | null
          flag_mail_newsletter?: boolean | null
          flag_mail_scadenze?: boolean | null
          flag_proforma?: boolean | null
          id?: string
          indirizzo: string
          note?: string | null
          partita_iva: string
          provincia: string
          ragione_sociale: string
          scadenza_antiric?: string | null
          scadenza_antiric_b?: string | null
          tipo_cliente?: string | null
          tipo_prestazione_a?: string | null
          tipo_prestazione_b?: string | null
          tipo_prestazione_id?: string | null
          tipo_redditi?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Update: {
          attivo?: boolean | null
          cap?: string
          citta?: string
          cod_cliente?: string
          codice_fiscale?: string
          contatto1_id?: string | null
          contatto2_id?: string | null
          created_at?: string | null
          data_creazione?: string | null
          data_ultima_verifica_antiric?: string | null
          data_ultima_verifica_b?: string | null
          email?: string
          flag_770?: boolean | null
          flag_bilancio?: boolean | null
          flag_ccgg?: boolean | null
          flag_cu?: boolean | null
          flag_esterometro?: boolean | null
          flag_fiscali?: boolean | null
          flag_imu?: boolean | null
          flag_iva?: boolean | null
          flag_lipe?: boolean | null
          flag_mail_attivo?: boolean | null
          flag_mail_newsletter?: boolean | null
          flag_mail_scadenze?: boolean | null
          flag_proforma?: boolean | null
          id?: string
          indirizzo?: string
          note?: string | null
          partita_iva?: string
          provincia?: string
          ragione_sociale?: string
          scadenza_antiric?: string | null
          scadenza_antiric_b?: string | null
          tipo_cliente?: string | null
          tipo_prestazione_a?: string | null
          tipo_prestazione_b?: string | null
          tipo_prestazione_id?: string | null
          tipo_redditi?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbclienti_contatto1_id_fkey"
            columns: ["contatto1_id"]
            isOneToOne: false
            referencedRelation: "tbcontatti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbclienti_contatto2_id_fkey"
            columns: ["contatto2_id"]
            isOneToOne: false
            referencedRelation: "tbcontatti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbclienti_tipo_prestazione_id_fkey"
            columns: ["tipo_prestazione_id"]
            isOneToOne: false
            referencedRelation: "tbprestazioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbclienti_utente_operatore_id_fkey"
            columns: ["utente_operatore_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbclienti_utente_professionista_id_fkey"
            columns: ["utente_professionista_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbcomunicazioni: {
        Row: {
          allegati: Json | null
          created_at: string | null
          data_invio: string | null
          destinatari_count: number | null
          id: string
          messaggio: string
          oggetto: string
          stato: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          allegati?: Json | null
          created_at?: string | null
          data_invio?: string | null
          destinatari_count?: number | null
          id?: string
          messaggio: string
          oggetto: string
          stato?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          allegati?: Json | null
          created_at?: string | null
          data_invio?: string | null
          destinatari_count?: number | null
          id?: string
          messaggio?: string
          oggetto?: string
          stato?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tbcontatti: {
        Row: {
          cassetto_fiscale: boolean | null
          cell: string | null
          cognome: string
          created_at: string | null
          email: string | null
          id: string
          nome: string
          note: string | null
          password: string | null
          password_iniziale: string | null
          pin: string | null
          tel: string | null
          updated_at: string | null
          utente: string | null
        }
        Insert: {
          cassetto_fiscale?: boolean | null
          cell?: string | null
          cognome: string
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          note?: string | null
          password?: string | null
          password_iniziale?: string | null
          pin?: string | null
          tel?: string | null
          updated_at?: string | null
          utente?: string | null
        }
        Update: {
          cassetto_fiscale?: boolean | null
          cell?: string | null
          cognome?: string
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          note?: string | null
          password?: string | null
          password_iniziale?: string | null
          pin?: string | null
          tel?: string | null
          updated_at?: string | null
          utente?: string | null
        }
        Relationships: []
      }
      tbconversazioni: {
        Row: {
          created_at: string | null
          creato_da: string | null
          id: string
          studio_id: string
          tipo: string
          titolo: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          creato_da?: string | null
          id?: string
          studio_id: string
          tipo?: string
          titolo?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          creato_da?: string | null
          id?: string
          studio_id?: string
          tipo?: string
          titolo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbconversazioni_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbconversazioni_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "tbstudio"
            referencedColumns: ["id"]
          },
        ]
      }
      tbconversazioni_utenti: {
        Row: {
          conversazione_id: string
          created_at: string | null
          ultimo_letto_at: string | null
          utente_id: string
        }
        Insert: {
          conversazione_id: string
          created_at?: string | null
          ultimo_letto_at?: string | null
          utente_id: string
        }
        Update: {
          conversazione_id?: string
          created_at?: string | null
          ultimo_letto_at?: string | null
          utente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbconversazioni_utenti_conversazione_id_fkey"
            columns: ["conversazione_id"]
            isOneToOne: false
            referencedRelation: "tbconversazioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbconversazioni_utenti_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbmessaggi: {
        Row: {
          cliente_id: string | null
          conversazione_id: string
          created_at: string | null
          evento_id: string | null
          id: string
          mittente_id: string
          testo: string
        }
        Insert: {
          cliente_id?: string | null
          conversazione_id: string
          created_at?: string | null
          evento_id?: string | null
          id?: string
          mittente_id: string
          testo: string
        }
        Update: {
          cliente_id?: string | null
          conversazione_id?: string
          created_at?: string | null
          evento_id?: string | null
          id?: string
          mittente_id?: string
          testo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbmessaggi_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "tbclienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbmessaggi_conversazione_id_fkey"
            columns: ["conversazione_id"]
            isOneToOne: false
            referencedRelation: "tbconversazioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbmessaggi_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "tbagenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbmessaggi_mittente_id_fkey"
            columns: ["mittente_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbmessaggi_allegati: {
        Row: {
          created_at: string | null
          dimensione: number
          id: string
          messaggio_id: string
          nome_file: string
          storage_path: string
          tipo_file: string
          url: string | null
        }
        Insert: {
          created_at?: string | null
          dimensione: number
          id?: string
          messaggio_id: string
          nome_file: string
          storage_path: string
          tipo_file: string
          url?: string | null
        }
        Update: {
          created_at?: string | null
          dimensione?: number
          id?: string
          messaggio_id?: string
          nome_file?: string
          storage_path?: string
          tipo_file?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbmessaggi_allegati_messaggio_id_fkey"
            columns: ["messaggio_id"]
            isOneToOne: false
            referencedRelation: "tbmessaggi"
            referencedColumns: ["id"]
          },
        ]
      }
      tbprestazioni: {
        Row: {
          created_at: string | null
          descrizione: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descrizione: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descrizione?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tbroperatore: {
        Row: {
          created_at: string | null
          id: string
          ruolo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ruolo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ruolo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tbscad770: {
        Row: {
          conferma_riga: boolean | null
          created_at: string | null
          data_invio: string | null
          id: string
          mod_compilato: boolean | null
          mod_definitivo: boolean | null
          mod_inviato: boolean | null
          modelli_770: string | null
          nominativo: string
          note: string | null
          ricevuta: boolean | null
          tipo_invio: string | null
          tipo_scadenza_id: string | null
          updated_at: string | null
          utente_operatore_id: string | null
          utente_professionista_id: string | null
        }
        Insert: {
          conferma_riga?: boolean | null
          created_at?: string | null
          data_invio?: string | null
          id: string
          mod_compilato?: boolean | null
          mod_definitivo?: boolean | null
          mod_inviato?: boolean | null
          modelli_770?: string | null
          nominativo: string
          note?: string | null
          ricevuta?: boolean | null
          tipo_invio?: string | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Update: {
          conferma_riga?: boolean | null
          created_at?: string | null
          data_invio?: string | null
          id?: string
          mod_compilato?: boolean | null
          mod_definitivo?: boolean | null
          mod_inviato?: boolean | null
          modelli_770?: string | null
          nominativo?: string
          note?: string | null
          ricevuta?: boolean | null
          tipo_invio?: string | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbscad770_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "tbclienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscad770_tipo_scadenza_id_fkey"
            columns: ["tipo_scadenza_id"]
            isOneToOne: false
            referencedRelation: "tbtipi_scadenze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscad770_utente_operatore_id_fkey"
            columns: ["utente_operatore_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscad770_utente_professionista_id_fkey"
            columns: ["utente_professionista_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbscadantiric: {
        Row: {
          created_at: string | null
          data_scadenza: string | null
          data_ultima_verifica: string | null
          data_ultima_verifica_b: string | null
          id: string
          nominativo: string
          note: string | null
          scadenza_antiric_b: string | null
          tipo_prestazione_a: string | null
          tipo_prestazione_b: string | null
          tipo_scadenza_id: string | null
          updated_at: string | null
          utente_operatore_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_scadenza?: string | null
          data_ultima_verifica?: string | null
          data_ultima_verifica_b?: string | null
          id: string
          nominativo: string
          note?: string | null
          scadenza_antiric_b?: string | null
          tipo_prestazione_a?: string | null
          tipo_prestazione_b?: string | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_scadenza?: string | null
          data_ultima_verifica?: string | null
          data_ultima_verifica_b?: string | null
          id?: string
          nominativo?: string
          note?: string | null
          scadenza_antiric_b?: string | null
          tipo_prestazione_a?: string | null
          tipo_prestazione_b?: string | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbscadantiric_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "tbclienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadantiric_tipo_scadenza_id_fkey"
            columns: ["tipo_scadenza_id"]
            isOneToOne: false
            referencedRelation: "tbtipi_scadenze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadantiric_utente_operatore_id_fkey"
            columns: ["utente_operatore_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbscadbilanci: {
        Row: {
          bil_approvato: boolean | null
          bilancio_def: boolean | null
          conferma_riga: boolean | null
          created_at: string | null
          data_approvazione: string | null
          data_invio: string | null
          data_scad_pres: string | null
          id: string
          invio_bil: boolean | null
          nominativo: string
          note: string | null
          relazione_gest: boolean | null
          relazione_revisore: boolean | null
          relazione_sindaci: boolean | null
          ricevuta: boolean | null
          tipo_scadenza_id: string | null
          updated_at: string | null
          utente_operatore_id: string | null
          utente_professionista_id: string | null
          verbale_app: boolean | null
        }
        Insert: {
          bil_approvato?: boolean | null
          bilancio_def?: boolean | null
          conferma_riga?: boolean | null
          created_at?: string | null
          data_approvazione?: string | null
          data_invio?: string | null
          data_scad_pres?: string | null
          id: string
          invio_bil?: boolean | null
          nominativo: string
          note?: string | null
          relazione_gest?: boolean | null
          relazione_revisore?: boolean | null
          relazione_sindaci?: boolean | null
          ricevuta?: boolean | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
          verbale_app?: boolean | null
        }
        Update: {
          bil_approvato?: boolean | null
          bilancio_def?: boolean | null
          conferma_riga?: boolean | null
          created_at?: string | null
          data_approvazione?: string | null
          data_invio?: string | null
          data_scad_pres?: string | null
          id?: string
          invio_bil?: boolean | null
          nominativo?: string
          note?: string | null
          relazione_gest?: boolean | null
          relazione_revisore?: boolean | null
          relazione_sindaci?: boolean | null
          ricevuta?: boolean | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
          verbale_app?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tbscadbilanci_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "tbclienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadbilanci_tipo_scadenza_id_fkey"
            columns: ["tipo_scadenza_id"]
            isOneToOne: false
            referencedRelation: "tbtipi_scadenze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadbilanci_utente_operatore_id_fkey"
            columns: ["utente_operatore_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadbilanci_utente_professionista_id_fkey"
            columns: ["utente_professionista_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbscadccgg: {
        Row: {
          conferma_riga: boolean | null
          created_at: string | null
          data_comunicato: string | null
          f24_comunicato: boolean | null
          f24_generato: boolean | null
          id: string
          importo_calcolato: boolean | null
          nominativo: string
          note: string | null
          tipo_scadenza_id: string | null
          updated_at: string | null
          utente_operatore_id: string | null
          utente_professionista_id: string | null
        }
        Insert: {
          conferma_riga?: boolean | null
          created_at?: string | null
          data_comunicato?: string | null
          f24_comunicato?: boolean | null
          f24_generato?: boolean | null
          id: string
          importo_calcolato?: boolean | null
          nominativo: string
          note?: string | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Update: {
          conferma_riga?: boolean | null
          created_at?: string | null
          data_comunicato?: string | null
          f24_comunicato?: boolean | null
          f24_generato?: boolean | null
          id?: string
          importo_calcolato?: boolean | null
          nominativo?: string
          note?: string | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbscadccgg_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "tbclienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadccgg_tipo_scadenza_id_fkey"
            columns: ["tipo_scadenza_id"]
            isOneToOne: false
            referencedRelation: "tbtipi_scadenze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadccgg_utente_operatore_id_fkey"
            columns: ["utente_operatore_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadccgg_utente_professionista_id_fkey"
            columns: ["utente_professionista_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbscadcu: {
        Row: {
          conferma_riga: boolean | null
          created_at: string | null
          cu_autonomi: boolean | null
          data_invio: string | null
          generate: boolean | null
          id: string
          inserite: boolean | null
          inviate: boolean | null
          nominativo: string
          note: string | null
          num_cu: string | null
          tipo_scadenza_id: string | null
          updated_at: string | null
          utente_operatore_id: string | null
          utente_professionista_id: string | null
        }
        Insert: {
          conferma_riga?: boolean | null
          created_at?: string | null
          cu_autonomi?: boolean | null
          data_invio?: string | null
          generate?: boolean | null
          id: string
          inserite?: boolean | null
          inviate?: boolean | null
          nominativo: string
          note?: string | null
          num_cu?: string | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Update: {
          conferma_riga?: boolean | null
          created_at?: string | null
          cu_autonomi?: boolean | null
          data_invio?: string | null
          generate?: boolean | null
          id?: string
          inserite?: boolean | null
          inviate?: boolean | null
          nominativo?: string
          note?: string | null
          num_cu?: string | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbscadcu_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "tbclienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadcu_tipo_scadenza_id_fkey"
            columns: ["tipo_scadenza_id"]
            isOneToOne: false
            referencedRelation: "tbtipi_scadenze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadcu_utente_operatore_id_fkey"
            columns: ["utente_operatore_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadcu_utente_professionista_id_fkey"
            columns: ["utente_professionista_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbscadestero: {
        Row: {
          ago_invio: boolean | null
          ago_previsto: boolean | null
          apr_invio: boolean | null
          apr_previsto: boolean | null
          created_at: string | null
          dic_invio: boolean | null
          dic_previsto: boolean | null
          feb_invio: boolean | null
          feb_previsto: boolean | null
          gen_invio: boolean | null
          gen_previsto: boolean | null
          giu_invio: boolean | null
          giu_previsto: boolean | null
          id: string
          lug_invio: boolean | null
          lug_previsto: boolean | null
          mag_invio: boolean | null
          mag_previsto: boolean | null
          mar_invio: boolean | null
          mar_previsto: boolean | null
          nmese1: number | null
          nmese10: number | null
          nmese11: number | null
          nmese12: number | null
          nmese2: number | null
          nmese3: number | null
          nmese4: number | null
          nmese5: number | null
          nmese6: number | null
          nmese7: number | null
          nmese8: number | null
          nmese9: number | null
          nominativo: string
          nov_invio: boolean | null
          nov_previsto: boolean | null
          ott_invio: boolean | null
          ott_previsto: boolean | null
          set_invio: boolean | null
          set_previsto: boolean | null
          tipo_scadenza_id: string | null
          tot_doc: number | null
          updated_at: string | null
          utente_operatore_id: string | null
          utente_professionista_id: string | null
        }
        Insert: {
          ago_invio?: boolean | null
          ago_previsto?: boolean | null
          apr_invio?: boolean | null
          apr_previsto?: boolean | null
          created_at?: string | null
          dic_invio?: boolean | null
          dic_previsto?: boolean | null
          feb_invio?: boolean | null
          feb_previsto?: boolean | null
          gen_invio?: boolean | null
          gen_previsto?: boolean | null
          giu_invio?: boolean | null
          giu_previsto?: boolean | null
          id: string
          lug_invio?: boolean | null
          lug_previsto?: boolean | null
          mag_invio?: boolean | null
          mag_previsto?: boolean | null
          mar_invio?: boolean | null
          mar_previsto?: boolean | null
          nmese1?: number | null
          nmese10?: number | null
          nmese11?: number | null
          nmese12?: number | null
          nmese2?: number | null
          nmese3?: number | null
          nmese4?: number | null
          nmese5?: number | null
          nmese6?: number | null
          nmese7?: number | null
          nmese8?: number | null
          nmese9?: number | null
          nominativo: string
          nov_invio?: boolean | null
          nov_previsto?: boolean | null
          ott_invio?: boolean | null
          ott_previsto?: boolean | null
          set_invio?: boolean | null
          set_previsto?: boolean | null
          tipo_scadenza_id?: string | null
          tot_doc?: number | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Update: {
          ago_invio?: boolean | null
          ago_previsto?: boolean | null
          apr_invio?: boolean | null
          apr_previsto?: boolean | null
          created_at?: string | null
          dic_invio?: boolean | null
          dic_previsto?: boolean | null
          feb_invio?: boolean | null
          feb_previsto?: boolean | null
          gen_invio?: boolean | null
          gen_previsto?: boolean | null
          giu_invio?: boolean | null
          giu_previsto?: boolean | null
          id?: string
          lug_invio?: boolean | null
          lug_previsto?: boolean | null
          mag_invio?: boolean | null
          mag_previsto?: boolean | null
          mar_invio?: boolean | null
          mar_previsto?: boolean | null
          nmese1?: number | null
          nmese10?: number | null
          nmese11?: number | null
          nmese12?: number | null
          nmese2?: number | null
          nmese3?: number | null
          nmese4?: number | null
          nmese5?: number | null
          nmese6?: number | null
          nmese7?: number | null
          nmese8?: number | null
          nmese9?: number | null
          nominativo?: string
          nov_invio?: boolean | null
          nov_previsto?: boolean | null
          ott_invio?: boolean | null
          ott_previsto?: boolean | null
          set_invio?: boolean | null
          set_previsto?: boolean | null
          tipo_scadenza_id?: string | null
          tot_doc?: number | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbscadestero_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "tbclienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadestero_tipo_scadenza_id_fkey"
            columns: ["tipo_scadenza_id"]
            isOneToOne: false
            referencedRelation: "tbtipi_scadenze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadestero_utente_operatore_id_fkey"
            columns: ["utente_operatore_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadestero_utente_professionista_id_fkey"
            columns: ["utente_professionista_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbscadfiscali: {
        Row: {
          acc2: boolean | null
          con_irap: boolean | null
          conferma_invii: boolean | null
          conferma_riga: boolean | null
          created_at: string | null
          data_com1: string | null
          data_com2: string | null
          data_i_invio: string | null
          data_r_invio: string | null
          id: string
          mod_i_compilato: boolean | null
          mod_i_definitivo: boolean | null
          mod_i_inviato: boolean | null
          mod_r_compilato: boolean | null
          mod_r_definitivo: boolean | null
          mod_r_inviato: boolean | null
          nominativo: string
          note: string | null
          ricevuta_r: boolean | null
          saldo_acc_cciaa: boolean | null
          tipo_redditi: string | null
          tipo_scadenza_id: string | null
          updated_at: string | null
          utente_operatore_id: string | null
          utente_professionista_id: string | null
        }
        Insert: {
          acc2?: boolean | null
          con_irap?: boolean | null
          conferma_invii?: boolean | null
          conferma_riga?: boolean | null
          created_at?: string | null
          data_com1?: string | null
          data_com2?: string | null
          data_i_invio?: string | null
          data_r_invio?: string | null
          id: string
          mod_i_compilato?: boolean | null
          mod_i_definitivo?: boolean | null
          mod_i_inviato?: boolean | null
          mod_r_compilato?: boolean | null
          mod_r_definitivo?: boolean | null
          mod_r_inviato?: boolean | null
          nominativo: string
          note?: string | null
          ricevuta_r?: boolean | null
          saldo_acc_cciaa?: boolean | null
          tipo_redditi?: string | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Update: {
          acc2?: boolean | null
          con_irap?: boolean | null
          conferma_invii?: boolean | null
          conferma_riga?: boolean | null
          created_at?: string | null
          data_com1?: string | null
          data_com2?: string | null
          data_i_invio?: string | null
          data_r_invio?: string | null
          id?: string
          mod_i_compilato?: boolean | null
          mod_i_definitivo?: boolean | null
          mod_i_inviato?: boolean | null
          mod_r_compilato?: boolean | null
          mod_r_definitivo?: boolean | null
          mod_r_inviato?: boolean | null
          nominativo?: string
          note?: string | null
          ricevuta_r?: boolean | null
          saldo_acc_cciaa?: boolean | null
          tipo_redditi?: string | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbscadfiscali_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "tbclienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadfiscali_tipo_scadenza_id_fkey"
            columns: ["tipo_scadenza_id"]
            isOneToOne: false
            referencedRelation: "tbtipi_scadenze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadfiscali_utente_operatore_id_fkey"
            columns: ["utente_operatore_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadfiscali_utente_professionista_id_fkey"
            columns: ["utente_professionista_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbscadimu: {
        Row: {
          acconto_comunicato: boolean | null
          acconto_data: string | null
          acconto_dovuto: boolean | null
          acconto_imu: boolean | null
          conferma_riga: boolean | null
          confermariga: boolean | null
          created_at: string | null
          dichiarazione_data_pres: string | null
          dichiarazione_imu: string | null
          dichiarazione_presentazione: boolean | null
          dichiarazione_scadenza: string | null
          id: string
          nominativo: string
          note: string | null
          saldo_comunicato: boolean | null
          saldo_data: string | null
          saldo_dovuto: boolean | null
          saldo_imu: boolean | null
          studio_id: string
          updated_at: string | null
          utente_operatore_id: string | null
          utente_professionista_id: string | null
        }
        Insert: {
          acconto_comunicato?: boolean | null
          acconto_data?: string | null
          acconto_dovuto?: boolean | null
          acconto_imu?: boolean | null
          conferma_riga?: boolean | null
          confermariga?: boolean | null
          created_at?: string | null
          dichiarazione_data_pres?: string | null
          dichiarazione_imu?: string | null
          dichiarazione_presentazione?: boolean | null
          dichiarazione_scadenza?: string | null
          id?: string
          nominativo: string
          note?: string | null
          saldo_comunicato?: boolean | null
          saldo_data?: string | null
          saldo_dovuto?: boolean | null
          saldo_imu?: boolean | null
          studio_id: string
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Update: {
          acconto_comunicato?: boolean | null
          acconto_data?: string | null
          acconto_dovuto?: boolean | null
          acconto_imu?: boolean | null
          conferma_riga?: boolean | null
          confermariga?: boolean | null
          created_at?: string | null
          dichiarazione_data_pres?: string | null
          dichiarazione_imu?: string | null
          dichiarazione_presentazione?: boolean | null
          dichiarazione_scadenza?: string | null
          id?: string
          nominativo?: string
          note?: string | null
          saldo_comunicato?: boolean | null
          saldo_data?: string | null
          saldo_dovuto?: boolean | null
          saldo_imu?: boolean | null
          studio_id?: string
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbscadimu_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "tbstudio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadimu_utente_operatore_id_fkey"
            columns: ["utente_operatore_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadimu_utente_professionista_id_fkey"
            columns: ["utente_professionista_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbscadiva: {
        Row: {
          conferma_riga: boolean | null
          created_at: string | null
          data_invio: string | null
          id: string
          mod_definitivo: boolean | null
          mod_inviato: boolean | null
          mod_predisposto: boolean | null
          nominativo: string
          note: string | null
          ricevuta: boolean | null
          tipo_scadenza_id: string | null
          updated_at: string | null
          utente_operatore_id: string | null
          utente_professionista_id: string | null
        }
        Insert: {
          conferma_riga?: boolean | null
          created_at?: string | null
          data_invio?: string | null
          id: string
          mod_definitivo?: boolean | null
          mod_inviato?: boolean | null
          mod_predisposto?: boolean | null
          nominativo: string
          note?: string | null
          ricevuta?: boolean | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Update: {
          conferma_riga?: boolean | null
          created_at?: string | null
          data_invio?: string | null
          id?: string
          mod_definitivo?: boolean | null
          mod_inviato?: boolean | null
          mod_predisposto?: boolean | null
          nominativo?: string
          note?: string | null
          ricevuta?: boolean | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbscadiva_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "tbclienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadiva_tipo_scadenza_id_fkey"
            columns: ["tipo_scadenza_id"]
            isOneToOne: false
            referencedRelation: "tbtipi_scadenze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadiva_utente_operatore_id_fkey"
            columns: ["utente_operatore_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadiva_utente_professionista_id_fkey"
            columns: ["utente_professionista_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbscadlipe: {
        Row: {
          acconto: string | null
          acconto_com: boolean | null
          ago: boolean | null
          apr: boolean | null
          created_at: string | null
          dic: boolean | null
          feb: boolean | null
          gen: boolean | null
          giu: boolean | null
          id: string
          lipe1t: boolean | null
          lipe1t_invio: string | null
          lipe2t: boolean | null
          lipe2t_invio: string | null
          lipe3t: boolean | null
          lipe3t_invio: string | null
          lipe4t: boolean | null
          lipe4t_invio: string | null
          lug: boolean | null
          mag: boolean | null
          mar: boolean | null
          nominativo: string
          nov: boolean | null
          ott: boolean | null
          set: boolean | null
          tipo_liq: string | null
          tipo_scadenza_id: string | null
          updated_at: string | null
          utente_operatore_id: string | null
          utente_professionista_id: string | null
        }
        Insert: {
          acconto?: string | null
          acconto_com?: boolean | null
          ago?: boolean | null
          apr?: boolean | null
          created_at?: string | null
          dic?: boolean | null
          feb?: boolean | null
          gen?: boolean | null
          giu?: boolean | null
          id: string
          lipe1t?: boolean | null
          lipe1t_invio?: string | null
          lipe2t?: boolean | null
          lipe2t_invio?: string | null
          lipe3t?: boolean | null
          lipe3t_invio?: string | null
          lipe4t?: boolean | null
          lipe4t_invio?: string | null
          lug?: boolean | null
          mag?: boolean | null
          mar?: boolean | null
          nominativo: string
          nov?: boolean | null
          ott?: boolean | null
          set?: boolean | null
          tipo_liq?: string | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Update: {
          acconto?: string | null
          acconto_com?: boolean | null
          ago?: boolean | null
          apr?: boolean | null
          created_at?: string | null
          dic?: boolean | null
          feb?: boolean | null
          gen?: boolean | null
          giu?: boolean | null
          id?: string
          lipe1t?: boolean | null
          lipe1t_invio?: string | null
          lipe2t?: boolean | null
          lipe2t_invio?: string | null
          lipe3t?: boolean | null
          lipe3t_invio?: string | null
          lipe4t?: boolean | null
          lipe4t_invio?: string | null
          lug?: boolean | null
          mag?: boolean | null
          mar?: boolean | null
          nominativo?: string
          nov?: boolean | null
          ott?: boolean | null
          set?: boolean | null
          tipo_liq?: string | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbscadlipe_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "tbclienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadlipe_tipo_scadenza_id_fkey"
            columns: ["tipo_scadenza_id"]
            isOneToOne: false
            referencedRelation: "tbtipi_scadenze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadlipe_utente_operatore_id_fkey"
            columns: ["utente_operatore_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadlipe_utente_professionista_id_fkey"
            columns: ["utente_professionista_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbscadproforma: {
        Row: {
          agosto: boolean | null
          aprile: boolean | null
          created_at: string | null
          dicembre: boolean | null
          febbraio: boolean | null
          gennaio: boolean | null
          giugno: boolean | null
          id: string
          luglio: boolean | null
          maggio: boolean | null
          marzo: boolean | null
          nominativo: string
          novembre: boolean | null
          ottobre: boolean | null
          settembre: boolean | null
          tipo_scadenza_id: string | null
          updated_at: string | null
          utente_operatore_id: string | null
          utente_professionista_id: string | null
        }
        Insert: {
          agosto?: boolean | null
          aprile?: boolean | null
          created_at?: string | null
          dicembre?: boolean | null
          febbraio?: boolean | null
          gennaio?: boolean | null
          giugno?: boolean | null
          id: string
          luglio?: boolean | null
          maggio?: boolean | null
          marzo?: boolean | null
          nominativo: string
          novembre?: boolean | null
          ottobre?: boolean | null
          settembre?: boolean | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Update: {
          agosto?: boolean | null
          aprile?: boolean | null
          created_at?: string | null
          dicembre?: boolean | null
          febbraio?: boolean | null
          gennaio?: boolean | null
          giugno?: boolean | null
          id?: string
          luglio?: boolean | null
          maggio?: boolean | null
          marzo?: boolean | null
          nominativo?: string
          novembre?: boolean | null
          ottobre?: boolean | null
          settembre?: boolean | null
          tipo_scadenza_id?: string | null
          updated_at?: string | null
          utente_operatore_id?: string | null
          utente_professionista_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbscadproforma_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "tbclienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadproforma_tipo_scadenza_id_fkey"
            columns: ["tipo_scadenza_id"]
            isOneToOne: false
            referencedRelation: "tbtipi_scadenze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadproforma_utente_operatore_id_fkey"
            columns: ["utente_operatore_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbscadproforma_utente_professionista_id_fkey"
            columns: ["utente_professionista_id"]
            isOneToOne: false
            referencedRelation: "tbutenti"
            referencedColumns: ["id"]
          },
        ]
      }
      tbstudio: {
        Row: {
          attivo: boolean | null
          cap: string
          citta: string
          codice_fiscale: string
          created_at: string | null
          denominazione_breve: string
          email: string
          id: string
          indirizzo: string
          logo_url: string | null
          note: string | null
          partita_iva: string
          pec: string
          provincia: string
          ragione_sociale: string
          sito_web: string | null
          telefono: string
          updated_at: string | null
        }
        Insert: {
          attivo?: boolean | null
          cap: string
          citta: string
          codice_fiscale: string
          created_at?: string | null
          denominazione_breve: string
          email: string
          id?: string
          indirizzo: string
          logo_url?: string | null
          note?: string | null
          partita_iva: string
          pec: string
          provincia: string
          ragione_sociale: string
          sito_web?: string | null
          telefono: string
          updated_at?: string | null
        }
        Update: {
          attivo?: boolean | null
          cap?: string
          citta?: string
          codice_fiscale?: string
          created_at?: string | null
          denominazione_breve?: string
          email?: string
          id?: string
          indirizzo?: string
          logo_url?: string | null
          note?: string | null
          partita_iva?: string
          pec?: string
          provincia?: string
          ragione_sociale?: string
          sito_web?: string | null
          telefono?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tbtipi_scadenze: {
        Row: {
          attivo: boolean | null
          created_at: string | null
          data_scadenza: string
          descrizione: string | null
          giorni_preavviso_1: number | null
          giorni_preavviso_2: number | null
          id: string
          nome: string
          ricorrente: boolean | null
          studio_id: string | null
          tipo_scadenza: string
          updated_at: string | null
        }
        Insert: {
          attivo?: boolean | null
          created_at?: string | null
          data_scadenza: string
          descrizione?: string | null
          giorni_preavviso_1?: number | null
          giorni_preavviso_2?: number | null
          id?: string
          nome: string
          ricorrente?: boolean | null
          studio_id?: string | null
          tipo_scadenza: string
          updated_at?: string | null
        }
        Update: {
          attivo?: boolean | null
          created_at?: string | null
          data_scadenza?: string
          descrizione?: string | null
          giorni_preavviso_1?: number | null
          giorni_preavviso_2?: number | null
          id?: string
          nome?: string
          ricorrente?: boolean | null
          studio_id?: string | null
          tipo_scadenza?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbtipi_scadenze_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "tbstudio"
            referencedColumns: ["id"]
          },
        ]
      }
      tbutenti: {
        Row: {
          attivo: boolean | null
          cognome: string
          created_at: string | null
          email: string
          id: string
          nome: string
          ruolo_operatore_id: string | null
          tipo_utente: string
          updated_at: string | null
        }
        Insert: {
          attivo?: boolean | null
          cognome: string
          created_at?: string | null
          email: string
          id?: string
          nome: string
          ruolo_operatore_id?: string | null
          tipo_utente: string
          updated_at?: string | null
        }
        Update: {
          attivo?: boolean | null
          cognome?: string
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
          ruolo_operatore_id?: string | null
          tipo_utente?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbutenti_ruolo_operatore_id_fkey"
            columns: ["ruolo_operatore_id"]
            isOneToOne: false
            referencedRelation: "tbroperatore"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_chat_participant: {
        Args: { _conversazione_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

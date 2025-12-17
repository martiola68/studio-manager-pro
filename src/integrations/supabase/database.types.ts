 
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
      clienti: {
        Row: {
          attivo: boolean | null
          cap: string
          citta: string
          codice_fiscale: string
          created_at: string | null
          email: string
          flag_770: boolean | null
          flag_bilancio: boolean | null
          flag_ccgg: boolean | null
          flag_cu: boolean | null
          flag_esterometro: boolean | null
          flag_fiscali: boolean | null
          flag_iva: boolean | null
          flag_lipe: boolean | null
          flag_proforma: boolean | null
          id: string
          indirizzo: string
          note: string | null
          partita_iva: string
          pec: string | null
          provincia: string
          ragione_sociale: string
          telefono: string | null
          tipo_cliente: string | null
          updated_at: string | null
        }
        Insert: {
          attivo?: boolean | null
          cap: string
          citta: string
          codice_fiscale: string
          created_at?: string | null
          email: string
          flag_770?: boolean | null
          flag_bilancio?: boolean | null
          flag_ccgg?: boolean | null
          flag_cu?: boolean | null
          flag_esterometro?: boolean | null
          flag_fiscali?: boolean | null
          flag_iva?: boolean | null
          flag_lipe?: boolean | null
          flag_proforma?: boolean | null
          id?: string
          indirizzo: string
          note?: string | null
          partita_iva: string
          pec?: string | null
          provincia: string
          ragione_sociale: string
          telefono?: string | null
          tipo_cliente?: string | null
          updated_at?: string | null
        }
        Update: {
          attivo?: boolean | null
          cap?: string
          citta?: string
          codice_fiscale?: string
          created_at?: string | null
          email?: string
          flag_770?: boolean | null
          flag_bilancio?: boolean | null
          flag_ccgg?: boolean | null
          flag_cu?: boolean | null
          flag_esterometro?: boolean | null
          flag_fiscali?: boolean | null
          flag_iva?: boolean | null
          flag_lipe?: boolean | null
          flag_proforma?: boolean | null
          id?: string
          indirizzo?: string
          note?: string | null
          partita_iva?: string
          pec?: string | null
          provincia?: string
          ragione_sociale?: string
          telefono?: string | null
          tipo_cliente?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      comunicazioni: {
        Row: {
          created_at: string | null
          data_invio: string | null
          id: string
          id_cliente: string
          letto: boolean | null
          messaggio: string
          oggetto: string
          stato: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_invio?: string | null
          id?: string
          id_cliente: string
          letto?: boolean | null
          messaggio: string
          oggetto: string
          stato: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_invio?: string | null
          id?: string
          id_cliente?: string
          letto?: boolean | null
          messaggio?: string
          oggetto?: string
          stato?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comunicazioni_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      contatti: {
        Row: {
          cellulare: string | null
          cognome: string
          created_at: string | null
          email: string
          id: string
          id_cliente: string
          nome: string
          note: string | null
          ruolo: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          cellulare?: string | null
          cognome: string
          created_at?: string | null
          email: string
          id?: string
          id_cliente: string
          nome: string
          note?: string | null
          ruolo?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          cellulare?: string | null
          cognome?: string
          created_at?: string | null
          email?: string
          id?: string
          id_cliente?: string
          nome?: string
          note?: string | null
          ruolo?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contatti_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      eventi_agenda: {
        Row: {
          colore: string | null
          created_at: string | null
          data_fine: string
          data_inizio: string
          descrizione: string | null
          id: string
          id_cliente: string | null
          id_utente: string
          in_sede: boolean | null
          luogo: string | null
          sala: string | null
          tipo_evento: string
          titolo: string
          tutto_giorno: boolean | null
          updated_at: string | null
        }
        Insert: {
          colore?: string | null
          created_at?: string | null
          data_fine: string
          data_inizio: string
          descrizione?: string | null
          id?: string
          id_cliente?: string | null
          id_utente: string
          in_sede?: boolean | null
          luogo?: string | null
          sala?: string | null
          tipo_evento: string
          titolo: string
          tutto_giorno?: boolean | null
          updated_at?: string | null
        }
        Update: {
          colore?: string | null
          created_at?: string | null
          data_fine?: string
          data_inizio?: string
          descrizione?: string | null
          id?: string
          id_cliente?: string | null
          id_utente?: string
          in_sede?: boolean | null
          luogo?: string | null
          sala?: string | null
          tipo_evento?: string
          titolo?: string
          tutto_giorno?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventi_agenda_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventi_agenda_id_utente_fkey"
            columns: ["id_utente"]
            isOneToOne: false
            referencedRelation: "utenti"
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
      scadenze: {
        Row: {
          conferma_riga: boolean | null
          created_at: string | null
          data_approvazione: string | null
          data_deposito: string | null
          data_invio: string | null
          data_scadenza: string
          descrizione: string | null
          id: string
          id_cliente: string
          importo: number | null
          note: string | null
          periodo: string | null
          stato_scadenza: string
          tipo_scadenza: string
          updated_at: string | null
        }
        Insert: {
          conferma_riga?: boolean | null
          created_at?: string | null
          data_approvazione?: string | null
          data_deposito?: string | null
          data_invio?: string | null
          data_scadenza: string
          descrizione?: string | null
          id?: string
          id_cliente: string
          importo?: number | null
          note?: string | null
          periodo?: string | null
          stato_scadenza: string
          tipo_scadenza: string
          updated_at?: string | null
        }
        Update: {
          conferma_riga?: boolean | null
          created_at?: string | null
          data_approvazione?: string | null
          data_deposito?: string | null
          data_invio?: string | null
          data_scadenza?: string
          descrizione?: string | null
          id?: string
          id_cliente?: string
          importo?: number | null
          note?: string | null
          periodo?: string | null
          stato_scadenza?: string
          tipo_scadenza?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scadenze_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
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
      utenti: {
        Row: {
          attivo: boolean | null
          cognome: string
          created_at: string | null
          email: string
          id: string
          nome: string
          ruolo_operatore: string | null
          tipo_utente: string
          updated_at: string | null
          user_id: string | null
          username: string
        }
        Insert: {
          attivo?: boolean | null
          cognome: string
          created_at?: string | null
          email: string
          id?: string
          nome: string
          ruolo_operatore?: string | null
          tipo_utente: string
          updated_at?: string | null
          user_id?: string | null
          username: string
        }
        Update: {
          attivo?: boolean | null
          cognome?: string
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
          ruolo_operatore?: string | null
          tipo_utente?: string
          updated_at?: string | null
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

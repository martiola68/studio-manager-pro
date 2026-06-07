import { supabase } from "@/lib/supabase/client";
import { Database } from "@/integrations/supabase/types";

export type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];
export type ContattoInsert = Database["public"]["Tables"]["tbcontatti"]["Insert"];
export type ContattoUpdate = Database["public"]["Tables"]["tbcontatti"]["Update"];

export type ContattoCliente = {
  id: string;
  studio_id: string | null;
  contatto_id: string;
  cliente_id: string;
  ruolo: string | null;
  principale: boolean | null;
  riceve_comunicazioni: boolean | null;
  riceve_scadenze: boolean | null;
  referente_fiscale: boolean | null;
  referente_payroll: boolean | null;
  referente_consulenza: boolean | null;
  referente_amministrativo: boolean | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
  cliente?: {
    id: string;
    ragione_sociale: string | null;
    codice_fiscale?: string | null;
    partita_iva?: string | null;
  } | null;
};

export type ContattoConClienti = Contatto & {
  clienti_collegati?: ContattoCliente[];
};

export type CollegamentoClienteInput = {
  studio_id?: string | null;
  contatto_id: string;
  cliente_id: string;
  ruolo?: string | null;
  principale?: boolean;
  riceve_comunicazioni?: boolean;
  riceve_scadenze?: boolean;
  referente_fiscale?: boolean;
  referente_payroll?: boolean;
  referente_consulenza?: boolean;
  referente_amministrativo?: boolean;
  note?: string | null;
};

export const contattoService = {
  async getContatti(studioId?: string | null): Promise<Contatto[]> {
    let query = supabase
      .from("tbcontatti")
      .select("*")
      .order("cognome", { ascending: true });

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getContattiConClienti(
    studioId?: string | null
  ): Promise<ContattoConClienti[]> {
    let query = supabase
      .from("tbcontatti")
      .select(
        `
        *,
        clienti_collegati:tbcontatti_clienti(
          id,
          studio_id,
          contatto_id,
          cliente_id,
          ruolo,
          principale,
          riceve_comunicazioni,
          riceve_scadenze,
          referente_fiscale,
          referente_payroll,
          referente_consulenza,
          referente_amministrativo,
          note,
          created_at,
          updated_at,
          cliente:tbclienti(
            id,
            ragione_sociale,
            codice_fiscale,
            partita_iva
          )
        )
      `
      )
      .order("cognome", { ascending: true });

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as ContattoConClienti[];
  },

  async getContattoById(id: string): Promise<Contatto> {
    const { data, error } = await supabase
      .from("tbcontatti")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async getContattoConClientiById(id: string): Promise<ContattoConClienti> {
    const { data, error } = await supabase
      .from("tbcontatti")
      .select(
        `
        *,
        clienti_collegati:tbcontatti_clienti(
          id,
          studio_id,
          contatto_id,
          cliente_id,
          ruolo,
          principale,
          riceve_comunicazioni,
          riceve_scadenze,
          referente_fiscale,
          referente_payroll,
          referente_consulenza,
          referente_amministrativo,
          note,
          created_at,
          updated_at,
          cliente:tbclienti(
            id,
            ragione_sociale,
            codice_fiscale,
            partita_iva
          )
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as ContattoConClienti;
  },

  async createContatto(contatto: ContattoInsert): Promise<Contatto> {
    const validContatto: any = { ...contatto };

    if (validContatto.nome === undefined || validContatto.nome === null) {
      validContatto.nome = "";
    }

    const { data, error } = await supabase
      .from("tbcontatti")
      .insert(validContatto)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateContatto(
    id: string,
    updates: ContattoUpdate
  ): Promise<Contatto> {
    const validUpdates: any = { ...updates };

    const { data, error } = await supabase
      .from("tbcontatti")
      .update(validUpdates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async deleteContatto(id: string): Promise<void> {
    const { error } = await supabase
      .from("tbcontatti")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async disattivaContatto(id: string): Promise<Contatto> {
    const { data, error } = await supabase
      .from("tbcontatti")
      .update({ attivo: false } as any)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async riattivaContatto(id: string): Promise<Contatto> {
    const { data, error } = await supabase
      .from("tbcontatti")
      .update({ attivo: true } as any)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async getClientiCollegati(contattoId: string): Promise<ContattoCliente[]> {
    const { data, error } = await supabase
      .from("tbcontatti_clienti")
      .select(
        `
        *,
        cliente:tbclienti(
          id,
          ragione_sociale,
          codice_fiscale,
          partita_iva
        )
      `
      )
      .eq("contatto_id", contattoId)
      .order("principale", { ascending: false });

    if (error) throw error;
    return (data || []) as ContattoCliente[];
  },

  async getContattiByCliente(
    clienteId: string,
    options?: {
      soloComunicazioni?: boolean;
      soloScadenze?: boolean;
      soloReferentiFiscali?: boolean;
      soloReferentiAmministrativi?: boolean;
    }
  ): Promise<ContattoConClienti[]> {
    let relQuery = supabase
      .from("tbcontatti_clienti")
      .select(
        `
        *,
        contatto:tbcontatti(*)
      `
      )
      .eq("cliente_id", clienteId);

    if (options?.soloComunicazioni) {
      relQuery = relQuery.eq("riceve_comunicazioni", true);
    }

    if (options?.soloScadenze) {
      relQuery = relQuery.eq("riceve_scadenze", true);
    }

    if (options?.soloReferentiFiscali) {
      relQuery = relQuery.eq("referente_fiscale", true);
    }

    if (options?.soloReferentiAmministrativi) {
      relQuery = relQuery.eq("referente_amministrativo", true);
    }

    const { data, error } = await relQuery.order("principale", {
      ascending: false,
    });

    if (error) throw error;

    return (data || [])
      .map((row: any) => ({
        ...(row.contatto || {}),
        clienti_collegati: [row],
      }))
      .filter((c: any) => c?.id) as ContattoConClienti[];
  },

  async getDestinatariScadenzeCliente(
    clienteId: string
  ): Promise<ContattoConClienti[]> {
    const { data, error } = await supabase
      .from("tbcontatti_clienti")
      .select(
        `
        *,
        contatto:tbcontatti(*)
      `
      )
      .eq("cliente_id", clienteId)
      .eq("riceve_scadenze", true)
      .or("referente_fiscale.eq.true,referente_amministrativo.eq.true")
      .order("referente_fiscale", { ascending: false })
      .order("referente_amministrativo", { ascending: false })
      .order("principale", { ascending: false });

    if (error) throw error;

    return (data || [])
      .map((row: any) => ({
        ...(row.contatto || {}),
        clienti_collegati: [row],
      }))
      .filter((c: any) => c?.id) as ContattoConClienti[];
  },

  async collegaCliente(input: CollegamentoClienteInput): Promise<ContattoCliente> {
    const payload = {
      studio_id: input.studio_id || null,
      contatto_id: input.contatto_id,
      cliente_id: input.cliente_id,
      ruolo: input.ruolo || null,
      principale: input.principale ?? false,
      riceve_comunicazioni: input.riceve_comunicazioni ?? true,
      riceve_scadenze: input.riceve_scadenze ?? true,
      referente_fiscale: input.referente_fiscale ?? false,
      referente_payroll: input.referente_payroll ?? false,
      referente_consulenza: input.referente_consulenza ?? false,
      referente_amministrativo: input.referente_amministrativo ?? false,
      note: input.note || null,
    };

    const { data, error } = await supabase
      .from("tbcontatti_clienti")
      .insert(payload)
      .select(
        `
        *,
        cliente:tbclienti(
          id,
          ragione_sociale,
          codice_fiscale,
          partita_iva
        )
      `
      )
      .single();

    if (error) throw error;
    return data as ContattoCliente;
  },

  async aggiornaCollegamentoCliente(
    id: string,
    updates: Partial<CollegamentoClienteInput>
  ): Promise<ContattoCliente> {
    const payload: any = { ...updates };

    delete payload.id;
    delete payload.contatto_id;

    const { data, error } = await supabase
      .from("tbcontatti_clienti")
      .update(payload)
      .eq("id", id)
      .select(
        `
        *,
        cliente:tbclienti(
          id,
          ragione_sociale,
          codice_fiscale,
          partita_iva
        )
      `
      )
      .single();

    if (error) throw error;
    return data as ContattoCliente;
  },

  async eliminaCollegamentoCliente(id: string): Promise<void> {
    const { error } = await supabase
      .from("tbcontatti_clienti")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async searchContatti(
    queryText: string,
    studioId?: string | null
  ): Promise<Contatto[]> {
    const query = `%${queryText.trim()}%`;

    let request = supabase
      .from("tbcontatti")
      .select("*")
      .or(
        [
          `nome.ilike.${query}`,
          `cognome.ilike.${query}`,
          `ragione_sociale.ilike.${query}`,
          `email.ilike.${query}`,
          `email_secondaria.ilike.${query}`,
          `pec.ilike.${query}`,
          `cell.ilike.${query}`,
          `tel.ilike.${query}`,
        ].join(",")
      )
      .order("cognome", { ascending: true });

    if (studioId) {
      request = request.eq("studio_id", studioId);
    }

    const { data, error } = await request;

    if (error) throw error;
    return data || [];
  },
};

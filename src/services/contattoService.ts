import { supabase } from "@/lib/supabase/client";
import { Database } from "@/integrations/supabase/types";

const db = supabase as any;

export type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];
export type ContattoInsert = Database["public"]["Tables"]["tbcontatti"]["Insert"];
export type ContattoUpdate = Database["public"]["Tables"]["tbcontatti"]["Update"];

export type ClienteMinimo = {
  id: string;
  ragione_sociale: string | null;
  codice_fiscale?: string | null;
  partita_iva?: string | null;
};

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
  cliente?: ClienteMinimo | null;
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

const caricaClientiById = async (
  clienteIds: string[]
): Promise<Record<string, ClienteMinimo>> => {
  const ids = Array.from(new Set(clienteIds.filter(Boolean)));

  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("tbclienti")
    .select("id, ragione_sociale, codice_fiscale, partita_iva")
    .in("id", ids);

  if (error) throw error;

  return Object.fromEntries(
    (data || []).map((cliente: any) => [cliente.id, cliente])
  );
};

const caricaContattiById = async (
  contattoIds: string[]
): Promise<Record<string, Contatto>> => {
  const ids = Array.from(new Set(contattoIds.filter(Boolean)));

  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("tbcontatti")
    .select("*")
    .in("id", ids);

  if (error) throw error;

  return Object.fromEntries(
    (data || []).map((contatto: any) => [contatto.id, contatto])
  );
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
    let contattiQuery = supabase
      .from("tbcontatti")
      .select("*")
      .order("cognome", { ascending: true });

    if (studioId) {
      contattiQuery = contattiQuery.eq("studio_id", studioId);
    }

    const { data: contatti, error: contattiError } = await contattiQuery;

    if (contattiError) throw contattiError;

    let relazioniQuery = db.from("tbcontatti_clienti").select("*");

    if (studioId) {
      relazioniQuery = relazioniQuery.eq("studio_id", studioId);
    }

    const { data: relazioni, error: relazioniError } = await relazioniQuery;

    if (relazioniError) throw relazioniError;

    const clientiById = await caricaClientiById(
      (relazioni || []).map((r: any) => r.cliente_id)
    );

    const relazioniByContatto: Record<string, ContattoCliente[]> = {};

    (relazioni || []).forEach((relazione: any) => {
      const item: ContattoCliente = {
        ...relazione,
        cliente: clientiById[relazione.cliente_id] || null,
      };

      if (!relazioniByContatto[relazione.contatto_id]) {
        relazioniByContatto[relazione.contatto_id] = [];
      }

      relazioniByContatto[relazione.contatto_id].push(item);
    });

    return (contatti || []).map((contatto: any) => ({
      ...contatto,
      clienti_collegati: relazioniByContatto[contatto.id] || [],
    }));
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
    const contatto = await this.getContattoById(id);
    const clienti_collegati = await this.getClientiCollegati(id);

    return {
      ...contatto,
      clienti_collegati,
    };
  },

  async createContatto(contatto: ContattoInsert): Promise<Contatto> {
    const validContatto: any = { ...contatto };

    if (validContatto.nome === undefined || validContatto.nome === null) {
      validContatto.nome = "";
    }

    const { data, error } = await supabase
      .from("tbcontatti")
      .insert(validContatto)
      .select("*")
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
    const { error } = await supabase.from("tbcontatti").delete().eq("id", id);

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
    const { data: relazioni, error } = await db
      .from("tbcontatti_clienti")
      .select("*")
      .eq("contatto_id", contattoId)
      .order("principale", { ascending: false });

    if (error) throw error;

    const clientiById = await caricaClientiById(
      (relazioni || []).map((r: any) => r.cliente_id)
    );

    return (relazioni || []).map((relazione: any) => ({
      ...relazione,
      cliente: clientiById[relazione.cliente_id] || null,
    }));
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
    let query = db
      .from("tbcontatti_clienti")
      .select("*")
      .eq("cliente_id", clienteId);

    if (options?.soloComunicazioni) {
      query = query.eq("riceve_comunicazioni", true);
    }

    if (options?.soloScadenze) {
      query = query.eq("riceve_scadenze", true);
    }

    if (options?.soloReferentiFiscali) {
      query = query.eq("referente_fiscale", true);
    }

    if (options?.soloReferentiAmministrativi) {
      query = query.eq("referente_amministrativo", true);
    }

    const { data: relazioni, error } = await query.order("principale", {
      ascending: false,
    });

    if (error) throw error;

    const contattiById = await caricaContattiById(
      (relazioni || []).map((r: any) => r.contatto_id)
    );

    const clientiById = await caricaClientiById(
      (relazioni || []).map((r: any) => r.cliente_id)
    );

    return (relazioni || [])
      .map((relazione: any) => {
        const contatto = contattiById[relazione.contatto_id];

        if (!contatto) return null;

        return {
          ...contatto,
          clienti_collegati: [
            {
              ...relazione,
              cliente: clientiById[relazione.cliente_id] || null,
            },
          ],
        };
      })
      .filter(Boolean) as ContattoConClienti[];
  },

  async getDestinatariScadenzeCliente(
    clienteId: string
  ): Promise<ContattoConClienti[]> {
    const { data: relazioni, error } = await db
      .from("tbcontatti_clienti")
      .select("*")
      .eq("cliente_id", clienteId)
      .eq("riceve_scadenze", true)
      .or("referente_fiscale.eq.true,referente_amministrativo.eq.true")
      .order("referente_fiscale", { ascending: false })
      .order("referente_amministrativo", { ascending: false })
      .order("principale", { ascending: false });

    if (error) throw error;

    const contattiById = await caricaContattiById(
      (relazioni || []).map((r: any) => r.contatto_id)
    );

    const clientiById = await caricaClientiById(
      (relazioni || []).map((r: any) => r.cliente_id)
    );

    return (relazioni || [])
      .map((relazione: any) => {
        const contatto = contattiById[relazione.contatto_id];

        if (!contatto) return null;

        return {
          ...contatto,
          clienti_collegati: [
            {
              ...relazione,
              cliente: clientiById[relazione.cliente_id] || null,
            },
          ],
        };
      })
      .filter(Boolean) as ContattoConClienti[];
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
      };

    const { data, error } = await db
      .from("tbcontatti_clienti")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    const clientiById = await caricaClientiById([data.cliente_id]);

    return {
      ...data,
      cliente: clientiById[data.cliente_id] || null,
    };
  },

  async aggiornaCollegamentoCliente(
    id: string,
    updates: Partial<CollegamentoClienteInput>
  ): Promise<ContattoCliente> {
    const payload: any = { ...updates };

    delete payload.id;
    delete payload.contatto_id;

    const { data, error } = await db
      .from("tbcontatti_clienti")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    const clientiById = await caricaClientiById([data.cliente_id]);

    return {
      ...data,
      cliente: clientiById[data.cliente_id] || null,
    };
  },

  async eliminaCollegamentoCliente(id: string): Promise<void> {
    const { error } = await db
      .from("tbcontatti_clienti")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async searchContatti(
    queryText: string,
    studioId?: string | null
  ): Promise<Contatto[]> {
    const q = queryText.trim();

    if (!q) return this.getContatti(studioId);

    const query = `%${q}%`;

    let request = supabase
      .from("tbcontatti")
      .select("*")
      .or(
        [
          `nome.ilike.${query}`,
          `cognome.ilike.${query}`,
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

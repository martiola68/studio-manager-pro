import { supabase } from "@/lib/supabase/client";
import { isEncrypted } from "@/lib/encryption";
import {
  decryptCredenzialiAccesso,
  encryptCredenzialiAccesso,
  getStoredEncryptionKey,
  isEncryptionEnabled,
} from "@/services/encryptionService";
import type { Database } from "@/integrations/supabase/types";

type CredenzialeAccesso = Database["public"]["Tables"]["tbcredenziali_accesso"]["Row"];
type CredenzialeAccessoInsert = Database["public"]["Tables"]["tbcredenziali_accesso"]["Insert"];
type CredenzialeAccessoUpdate = Database["public"]["Tables"]["tbcredenziali_accesso"]["Update"];

async function hydrateSensitiveFields(
  rows: CredenzialeAccesso[]
): Promise<CredenzialeAccesso[]> {
  if (!getStoredEncryptionKey()) return rows;

  return Promise.all(
    rows.map(async (row) => {
      try {
        const decrypted = await decryptCredenzialiAccesso({
          login_pw: row.login_pw,
          login_pin: row.login_pin,
        });
        return { ...row, ...decrypted } as CredenzialeAccesso;
      } catch {
        // Mantiene il valore originale se la chiave disponibile non appartiene
        // allo stesso set di dati: nessuna modifica distruttiva in lettura.
        return row;
      }
    })
  );
}

async function protectSensitiveFields<T extends CredenzialeAccessoInsert | CredenzialeAccessoUpdate>(
  credenziale: T,
  studioId?: string | null
): Promise<T> {
  if (!studioId || !getStoredEncryptionKey()) return credenziale;

  const enabled = await isEncryptionEnabled(studioId);
  if (!enabled) return credenziale;

  const protectedValues: {
    login_pw?: string | null;
    login_pin?: string | null;
  } = {};

  if ("login_pw" in credenziale) {
    const value = credenziale.login_pw;
    if (value && !isEncrypted(value)) {
      protectedValues.login_pw = (
        await encryptCredenzialiAccesso({ login_pw: value })
      ).login_pw;
    } else {
      protectedValues.login_pw = value ?? null;
    }
  }

  if ("login_pin" in credenziale) {
    const value = credenziale.login_pin;
    if (value && !isEncrypted(value)) {
      protectedValues.login_pin = (
        await encryptCredenzialiAccesso({ login_pin: value })
      ).login_pin;
    } else {
      protectedValues.login_pin = value ?? null;
    }
  }

  return {
    ...credenziale,
    ...protectedValues,
  } as T;
}

export const credenzialiAccessoService = {
  async getAll(studioId?: string | null): Promise<CredenzialeAccesso[]> {
    let query = supabase
      .from("tbcredenziali_accesso")
      .select("*")
      .order("portale", { ascending: true });

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return hydrateSensitiveFields(data || []);
  },

  async getById(id: string): Promise<CredenzialeAccesso | null> {
    const { data, error } = await supabase
      .from("tbcredenziali_accesso")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) return null;

    const [hydrated] = await hydrateSensitiveFields([data]);
    return hydrated || null;
  },

  async create(credenziale: CredenzialeAccessoInsert): Promise<CredenzialeAccesso> {
    const dataToSave = await protectSensitiveFields(
      credenziale,
      credenziale.studio_id
    );

    const { data, error } = await supabase
      .from("tbcredenziali_accesso")
      .insert(dataToSave)
      .select()
      .single();

    if (error) throw error;

    const [hydrated] = await hydrateSensitiveFields([data]);
    return hydrated || data;
  },

  async update(id: string, credenziale: CredenzialeAccessoUpdate): Promise<CredenzialeAccesso> {
    const { data: existing, error: existingError } = await supabase
      .from("tbcredenziali_accesso")
      .select("studio_id")
      .eq("id", id)
      .single();

    if (existingError) throw existingError;

    const dataToSave = await protectSensitiveFields(
      credenziale,
      existing?.studio_id || null
    );

    const { data, error } = await supabase
      .from("tbcredenziali_accesso")
      .update({ ...dataToSave, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    const [hydrated] = await hydrateSensitiveFields([data]);
    return hydrated || data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("tbcredenziali_accesso")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async search(studioId: string, searchTerm: string): Promise<CredenzialeAccesso[]> {
    if (!studioId) return [];

    const { data, error } = await supabase
      .from("tbcredenziali_accesso")
      .select("*")
      .eq("studio_id", studioId)
      .or(`portale.ilike.%${searchTerm}%,indirizzo_url.ilike.%${searchTerm}%,login_utente.ilike.%${searchTerm}%`)
      .order("portale", { ascending: true });

    if (error) throw error;
    return hydrateSensitiveFields(data || []);
  },
};
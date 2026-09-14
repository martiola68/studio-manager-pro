import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeCF(value: unknown): string {
  return text(value).replace(/\s+/g, "").toUpperCase();
}

function normalizeDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function displayName(row: any): string {
  const ragione = text(row?.ragione_sociale);
  if (ragione) return ragione;
  return [text(row?.cognome), text(row?.nome)].filter(Boolean).join(" ");
}

function mapPersona(row: any) {
  return {
    soggetto_cliente_id: text(row?.id),
    nome_cognome: displayName(row),
    codice_fiscale: normalizeCF(row?.codice_fiscale),
    luogo_nascita: text(row?.luogo_nascita),
    data_nascita: normalizeDate(row?.data_nascita) || "",
    indirizzo_residenza: text(row?.indirizzo),
    citta_residenza: text(row?.citta),
    cap_residenza: text(row?.cap),
    nazionalita: text(row?.nazionalita),
  };
}

function mapTitolare(row: any) {
  return {
    id: text(row?.id),
    soggetto_cliente_id: text(row?.soggetto_cliente_id),
    source_mode: text(row?.soggetto_cliente_id) ? "import" : "manual",
    nome_cognome: text(row?.nome_cognome),
    codice_fiscale: normalizeCF(row?.codice_fiscale),
    luogo_nascita: text(row?.luogo_nascita),
    data_nascita: normalizeDate(row?.data_nascita) || "",
    indirizzo_residenza: text(row?.indirizzo_residenza),
    citta_residenza: text(row?.citta_residenza),
    cap_residenza: text(row?.cap_residenza),
    nazionalita: text(row?.nazionalita),
    error_codice_fiscale: "",
    import_status: "",
    import_message: "",
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRole) {
      return res.status(500).json({ ok: false, error: "Configurazione Supabase server mancante" });
    }

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const token = text(req.query.token || body.token);
    const av4Id = text(req.query.av4_id || body.av4_id);
    const sezione = text(req.query.sezione || body.sezione);

    if (!token || !av4Id) {
      return res.status(400).json({ ok: false, error: "Token o AV4 mancante" });
    }

    if (sezione && !["domanda7", "domanda8", "domanda9"].includes(sezione)) {
      return res.status(400).json({ ok: false, error: "Sezione titolari non valida" });
    }

    const { data: av4, error: av4Error } = await supabase
      .from("tbAV4")
      .select("id,studio_id,cliente_id,public_token,public_enabled,compilato_da_cliente")
      .eq("id", av4Id)
      .eq("public_token", token)
      .maybeSingle();

    if (av4Error) {
      return res.status(500).json({ ok: false, error: av4Error.message });
    }

    if (!av4) {
      return res.status(404).json({ ok: false, error: "Link AV4 non valido" });
    }

    if (!av4.public_enabled && !av4.compilato_da_cliente) {
      return res.status(403).json({ ok: false, error: "Link AV4 non più attivo" });
    }

    const studioId = text(av4.studio_id);
    const clienteId = text(av4.cliente_id);

    async function findPersonaByCF(codiceFiscale: string) {
      const cf = normalizeCF(codiceFiscale);
      if (!cf) return null;

      // Prima fonte: organi sociali della società collegata all'AV4.
      // È la fonte corretta per amministratori/rappresentanti già censiti in SMP.
      if (clienteId) {
        let organiQuery = supabase
          .from("tbclienti_organi")
          .select("soggetto_cliente_id")
          .eq("cliente_id", clienteId)
          .not("soggetto_cliente_id", "is", null);

        if (studioId) organiQuery = organiQuery.eq("studio_id", studioId);

        const { data: organi, error: organiError } = await organiQuery;
        if (organiError) {
          console.error("AV4 pubblico - errore ricerca organi:", organiError);
        } else {
          const ids = Array.from(
            new Set((organi || []).map((r: any) => text(r?.soggetto_cliente_id)).filter(Boolean))
          );

          if (ids.length) {
            let linkedQuery = supabase
              .from("tbclienti")
              .select("id,ragione_sociale,cognome,nome,codice_fiscale,luogo_nascita,data_nascita,indirizzo,citta,cap,nazionalita,studio_id")
              .in("id", ids);

            if (studioId) linkedQuery = linkedQuery.eq("studio_id", studioId);

            const { data: linked, error: linkedError } = await linkedQuery;
            if (linkedError) {
              console.error("AV4 pubblico - errore soggetti collegati:", linkedError);
            } else {
              const found = (linked || []).find((row: any) => normalizeCF(row?.codice_fiscale) === cf);
              if (found) return found;
            }
          }
        }
      }

      // Fallback: anagrafica SMP dello stesso studio, senza imporre cliente=false.
      // In questo modo vengono trovati anche soggetti già presenti con classificazioni diverse.
      let directQuery = supabase
        .from("tbclienti")
        .select("id,ragione_sociale,cognome,nome,codice_fiscale,luogo_nascita,data_nascita,indirizzo,citta,cap,nazionalita,studio_id")
        .ilike("codice_fiscale", cf)
        .limit(10);

      if (studioId) directQuery = directQuery.eq("studio_id", studioId);

      const { data: direct, error: directError } = await directQuery;
      if (directError) throw directError;

      return (direct || []).find((row: any) => normalizeCF(row?.codice_fiscale) === cf) || null;
    }

    if (req.method === "GET") {
      const action = text(req.query.action || "load");

      if (action === "lookup") {
        const cf = normalizeCF(req.query.codice_fiscale);
        if (!cf) {
          return res.status(400).json({ ok: false, error: "Codice fiscale mancante" });
        }

        const persona = await findPersonaByCF(cf);
        if (!persona) {
          return res.status(200).json({ ok: true, found: false, data: null });
        }

        return res.status(200).json({ ok: true, found: true, data: mapPersona(persona) });
      }

      if (!sezione) {
        return res.status(400).json({ ok: false, error: "Sezione mancante" });
      }

      const { data, error } = await supabase
        .from("tbAV4_titolari")
        .select("*")
        .eq("av4_id", av4.id)
        .eq("sezione", sezione)
        .order("nome_cognome", { ascending: true });

      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, rows: (data || []).map(mapTitolare) });
    }

    if (req.method === "DELETE") {
      if (!sezione) {
        return res.status(400).json({ ok: false, error: "Sezione mancante" });
      }
      const id = text(req.query.id || body.id);
      if (!id) return res.status(400).json({ ok: false, error: "Titolare mancante" });

      const { error } = await supabase
        .from("tbAV4_titolari")
        .delete()
        .eq("id", id)
        .eq("av4_id", av4.id)
        .eq("sezione", sezione);

      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "POST") {
      if (!sezione) {
        return res.status(400).json({ ok: false, error: "Sezione mancante" });
      }

      const inputRows = Array.isArray(body.rows) ? body.rows : [];
      if (!inputRows.length) {
        return res.status(400).json({ ok: false, error: "Inserisci almeno un titolare effettivo" });
      }

      const records: any[] = [];

      for (const raw of inputRows) {
        const cf = normalizeCF(raw?.codice_fiscale);
        if (!cf) {
          return res.status(400).json({ ok: false, error: "Codice fiscale obbligatorio" });
        }

        let persona: any = null;
        const suppliedId = text(raw?.soggetto_cliente_id);

        if (suppliedId) {
          let byId = supabase
            .from("tbclienti")
            .select("id,studio_id,codice_fiscale")
            .eq("id", suppliedId);
          if (studioId) byId = byId.eq("studio_id", studioId);
          const { data } = await byId.maybeSingle();
          if (data && normalizeCF(data.codice_fiscale) === cf) persona = data;
        }

        if (!persona) persona = await findPersonaByCF(cf);

        let soggettoId = text(persona?.id);
        if (!soggettoId) {
          const payload = {
            studio_id: studioId || null,
            ragione_sociale: text(raw?.nome_cognome),
            codice_fiscale: cf,
            tipo_cliente: "Persona fisica",
            tipologia_cliente: "Altro",
            cliente: false,
            professionista_incaricato: false,
            soggetto_isa: false,
            luogo_nascita: text(raw?.luogo_nascita) || null,
            data_nascita: normalizeDate(raw?.data_nascita),
            indirizzo: text(raw?.indirizzo_residenza) || null,
            citta: text(raw?.citta_residenza) || null,
            cap: text(raw?.cap_residenza) || null,
            nazionalita: text(raw?.nazionalita) || null,
            attivo: true,
          };

          const { data: inserted, error: insertError } = await supabase
            .from("tbclienti")
            .insert([payload])
            .select("id")
            .single();

          if (insertError) {
            return res.status(500).json({ ok: false, error: insertError.message });
          }
          soggettoId = text(inserted?.id);
        }

        records.push({
          av4_id: av4.id,
          studio_id: studioId || null,
          cliente_id: clienteId || null,
          sezione,
          soggetto_cliente_id: soggettoId || null,
          nome_cognome: text(raw?.nome_cognome),
          codice_fiscale: cf,
          luogo_nascita: text(raw?.luogo_nascita),
          data_nascita: normalizeDate(raw?.data_nascita),
          indirizzo_residenza: text(raw?.indirizzo_residenza),
          citta_residenza: text(raw?.citta_residenza),
          cap_residenza: text(raw?.cap_residenza),
          nazionalita: text(raw?.nazionalita),
        });
      }

      const { error: deleteError } = await supabase
        .from("tbAV4_titolari")
        .delete()
        .eq("av4_id", av4.id)
        .eq("sezione", sezione);

      if (deleteError) return res.status(500).json({ ok: false, error: deleteError.message });

      const { data: saved, error: insertError } = await supabase
        .from("tbAV4_titolari")
        .insert(records)
        .select("*");

      if (insertError) return res.status(500).json({ ok: false, error: insertError.message });

      return res.status(200).json({ ok: true, rows: (saved || []).map(mapTitolare) });
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  } catch (error: any) {
    console.error("API public AV4 titolari error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore interno server",
    });
  }
}

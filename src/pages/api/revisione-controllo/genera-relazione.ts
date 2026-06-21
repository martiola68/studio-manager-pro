import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatDateIT(value?: string | null) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("it-IT");
}

function tipoLabel(tipo?: string | null) {
  const map: Record<string, string> = {
    REVISIONE_LEGALE: "Revisione legale",
    SOCIETA_REVISIONE: "Società di revisione",
    SINDACO_UNICO: "Sindaco unico",
    COLLEGIO_SINDACALE: "Collegio sindacale",
    ORGANO_UNICO_DOPPIA_FUNZIONE: "Organo unico doppia funzione",
    SINDACO_COLLEGIO_PIU_REVISORE: "Sindaco/Collegio + Revisore",
  };

  return tipo ? map[tipo] || tipo : "";
}

function replaceAllVars(testo: string, vars: Record<string, string>) {
  let output = testo;

  Object.entries(vars).forEach(([key, value]) => {
    output = output.replaceAll(`[${key}]`, value || "");
  });

  return output;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Metodo non consentito",
      });
    }

    const { controllo_id, modello_id, generata_da } = req.body;

    if (!controllo_id) {
      return res.status(400).json({
        success: false,
        error: "controllo_id obbligatorio",
      });
    }

    if (!modello_id) {
      return res.status(400).json({
        success: false,
        error: "modello_id obbligatorio",
      });
    }

    const { data: controllo, error: controlloError } = await supabaseAdmin
      .from("vw_revisione_controlli")
      .select("*")
      .eq("id", controllo_id)
      .single();

    if (controlloError) throw controlloError;

    const { data: modello, error: modelloError } = await supabaseAdmin
      .from("tbrevisione_modelli")
      .select("*")
      .eq("id", modello_id)
      .single();

    if (modelloError) throw modelloError;

    const { data: cliente } = await supabaseAdmin
      .from("tbclienti")
      .select("ragione_sociale, codice_fiscale, partita_iva, indirizzo, cap, citta, provincia")
      .eq("id", controllo.cliente_id)
      .single();

    const { data: soggetti } = await supabaseAdmin
  .from("tbrevisione_soggetti")
  .select("*")
  .eq("incarico_id", controllo.incarico_id)
  .eq("attivo", true);

   const { data: checklist } = await supabaseAdmin
  .from("tbrevisione_checklist")
  .select("*")
  .eq("controllo_id", controllo_id)
  .order("ordine", { ascending: true });

    const revisori = (soggetti || [])
      .filter((s: any) => s.ruolo === "REVISORE" || s.ruolo === "SOCIETA_REVISIONE")
      .map((s: any) => s.nome)
      .join(", ");

    const sindacoUnico = (soggetti || [])
      .filter((s: any) => s.ruolo === "SINDACO_UNICO")
      .map((s: any) => s.nome)
      .join(", ");

    const presidenteCollegio = (soggetti || [])
      .filter((s: any) => s.ruolo === "PRESIDENTE_COLLEGIO")
      .map((s: any) => s.nome)
      .join(", ");

    const sindaciEffettivi = (soggetti || [])
      .filter((s: any) => s.ruolo === "SINDACO_EFFETTIVO")
      .map((s: any) => s.nome)
      .join(", ");

    const sindaciSupplenti = (soggetti || [])
      .filter((s: any) => s.ruolo === "SINDACO_SUPPLENTE")
      .map((s: any) => s.nome)
      .join(", ");

   const checklistRiepilogo = (checklist || [])
  .map(
    (c: any) =>
      `• ${c.domanda}: ${c.risposta || "NON COMPILATO"}`
  )
  .join("\n");

const checklistCriticita = (checklist || [])
  .filter((c: any) => c.risposta === "NO")
  .map((c: any) => `• ${c.domanda}`)
  .join("\n");

const checklistNote = (checklist || [])
  .filter((c: any) => c.note)
  .map(
    (c: any) =>
      `• ${c.domanda}: ${c.note}`
  )
  .join("\n");

    const vars: Record<string, string> = {
      CLIENTE: cliente?.ragione_sociale || controllo.ragione_sociale || "",
      CODICE_FISCALE: cliente?.codice_fiscale || "",
      PARTITA_IVA: cliente?.partita_iva || "",
      SEDE: sede,
      TIPO_INCARICO: tipoLabel(controllo.tipo_incarico),
      TRIMESTRE: `${controllo.trimestre}`,
      ANNO: `${controllo.anno}`,
      DATA_SCADENZA: formatDateIT(controllo.data_scadenza),
      DATA_CONTROLLO: formatDateIT(controllo.data_controllo),
      ESITO_CONTROLLO: controllo.esito || "",
      NOTE_CONTROLLO: controllo.note || "",
    REVISORE: revisori,
SINDACO_UNICO: sindacoUnico,
PRESIDENTE_COLLEGIO: presidenteCollegio,
SINDACI_EFFETTIVI: sindaciEffettivi,
SINDACI_SUPPLENTI: sindaciSupplenti,

CHECKLIST_RIEPILOGO: checklistRiepilogo,
CHECKLIST_CRITICITA: checklistCriticita,
CHECKLIST_NOTE: checklistNote,
};

    const testoGenerato = replaceAllVars(modello.testo, vars);

    const { data: relazione, error: relazioneError } = await supabaseAdmin
      .from("tbrevisione_relazioni")
      .insert({
        controllo_id,
        modello_id,
        titolo: modello.titolo,
        testo_generato: testoGenerato,
        generata_da: generata_da || null,
        generata_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (relazioneError) throw relazioneError;

    return res.status(200).json({
      success: true,
      data: relazione,
      testo_generato: testoGenerato,
      variabili: vars,
    });
  } catch (error: any) {
    console.error("Errore genera relazione revisione:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore generazione relazione",
    });
  }
}

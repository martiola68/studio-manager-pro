import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";
import { emailService } from "@/services/emailService";

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const parseForm = async (
  req: NextApiRequest
): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
  });

  return await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
};

const getField = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
};

const replaceVars = (text: string, vars: Record<string, string>) => {
  let output = text || "";

  Object.entries(vars).forEach(([key, value]) => {
    output = output.replaceAll(`[${key}]`, value || "");
  });

  return output;
};

const getTemplateCode = (modulo: string, tipo: string) => {
  if (modulo === "imu" && tipo === "acconto") return "IMU_ACCONTO";
  if (modulo === "imu" && tipo === "saldo") return "IMU_SALDO";

  if (modulo === "fiscali" && tipo === "f24") return "FISCALE_F24";
  if (modulo === "fiscali" && tipo === "iva") return "FISCALE_IVA";
  if (modulo === "fiscali" && tipo === "ritenute") return "FISCALE_RITENUTE";
  if (modulo === "fiscali" && tipo === "imposte") return "FISCALE_IMPOSTE";

  return null;
};

const getUploadedFile = (file: formidable.File | formidable.File[] | undefined) => {
  if (Array.isArray(file)) return file[0];
  return file;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Metodo non consentito",
      });
    }

    const { fields, files } = await parseForm(req);

    const payload = {
      modulo: getField(fields.modulo as any),
      scadenza_id: getField(fields.scadenza_id as any),
      tipo: getField(fields.tipo as any),
      email: getField(fields.email as any),
    };

    const f24 = getUploadedFile(files.f24 as any);

    if (!payload.modulo || !payload.scadenza_id || !payload.tipo || !payload.email) {
      return res.status(400).json({
        success: false,
        error: "Payload incompleto",
      });
    }

    if (!f24) {
      return res.status(400).json({
        success: false,
        error: "Allegato F24 mancante",
      });
    }

    const templateCode = getTemplateCode(payload.modulo, payload.tipo);

    if (!templateCode) {
      return res.status(400).json({
        success: false,
        error: "Template non configurato",
      });
    }

    const { data: template, error: templateError } = await supabaseAdmin
      .from("tbemail_template")
      .select("*")
      .eq("codice", templateCode)
      .eq("attivo", true)
      .maybeSingle();

    if (templateError) throw templateError;

    if (!template) {
      return res.status(404).json({
        success: false,
        error: `Template ${templateCode} non trovato`,
      });
    }

    let scadenza: any = null;

    if (payload.modulo === "imu") {
      const { data, error } = await supabaseAdmin
        .from("tbscadimu")
        .select("*")
        .eq("id", payload.scadenza_id)
        .maybeSingle();

      if (error) throw error;
      scadenza = data;
    }

    if (payload.modulo === "fiscali") {
      const { data, error } = await supabaseAdmin
        .from("tbscadfiscali")
        .select("*")
        .eq("id", payload.scadenza_id)
        .maybeSingle();

      if (error) throw error;
      scadenza = data;
    }

    if (!scadenza) {
      return res.status(404).json({
        success: false,
        error: "Scadenza non trovata",
      });
    }

    let cliente: any = null;

    if (scadenza.cliente_id) {
      const { data, error } = await supabaseAdmin
        .from("tbclienti")
        .select("*")
        .eq("id", scadenza.cliente_id)
        .maybeSingle();

      if (error) throw error;
      cliente = data;
    }

    const clienteNome =
      cliente?.ragione_sociale ||
      scadenza.nominativo ||
      "Cliente";

    const vars = {
      CLIENTE: clienteNome,
      ANNO: String(scadenza.anno_riferimento || new Date().getFullYear()),
      DATA_SCADENZA:
        scadenza.data_scadenza ||
        scadenza.data_scadenza_versamento ||
        "",
      TIPO_IMU: payload.tipo === "acconto" ? "Acconto" : "Saldo",
    };

    const oggetto = replaceVars(template.oggetto, vars);
    const messaggio = replaceVars(template.corpo, vars);

    const fileBuffer = fs.readFileSync(f24.filepath);

    const allegati = [
      {
        nome: f24.originalFilename || "F24_IMU.pdf",
        tipo: f24.mimetype || "application/pdf",
        contenuto: fileBuffer.toString("base64"),
      },
    ];

    const emailResult = await emailService.sendComunicazioneEmail({
      tipo: "scadenze",
      destinatarioId: scadenza.cliente_id || "",
      destinatarioEmail: payload.email,
      oggetto,
      messaggio,
      allegati,
    });

    if (!emailResult?.success) {
      return res.status(500).json({
        success: false,
        error: emailResult?.error || "Errore invio email",
      });
    }

    if (payload.modulo === "imu") {
      const updatePayload =
        payload.tipo === "acconto"
          ? {
              conferma_acconto_imu: true,
              acconto_comunicato: true,
              data_com_acconto: new Date().toISOString().slice(0, 10),
            }
          : {
              conferma_saldo_imu: true,
              saldo_comunicato: true,
              data_com_saldo: new Date().toISOString().slice(0, 10),
            };

      const { error } = await supabaseAdmin
        .from("tbscadimu")
        .update(updatePayload)
        .eq("id", payload.scadenza_id);

      if (error) throw error;
    }

    return res.status(200).json({
      success: true,
      oggetto,
      messaggio,
    });
  } catch (error: any) {
    console.error("Errore invio comunicazione scadenza:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Errore interno",
    });
  }
}

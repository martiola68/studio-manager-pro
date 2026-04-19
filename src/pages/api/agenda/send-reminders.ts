import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type AgendaRow = {
  id: string;
  gruppo_evento: string | null;
  titolo: string | null;
  descrizione: string | null;
  data_inizio: string;
  data_fine: string;
  ora_inizio: string | null;
  ora_fine: string | null;
  tutto_giorno: boolean | null;
  cliente_id: string | null;
  utente_id: string | null;
  in_sede: boolean | null;
  sala: string | null;
  luogo: string | null;
  partecipanti: unknown;
  email_partecipanti_esterni: unknown;
  riunione_teams: boolean | null;
  link_teams: string | null;
  reminder_sent_at: string | null;
};

const toArrayOfStrings = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const getRomeDateParts = () => {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
    dateKey: `${map.year}-${map.month}-${map.day}`,
  };
};

const getRomeDateKeyFromIso = (isoDate: string): string | null => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(isoDate));

    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    return null;
  }
};

const formatDateIt = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString("it-IT");
  } catch {
    return dateStr;
  }
};

const formatTimeIt = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "00:00";
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const romeNow = getRomeDateParts();

    // Esegue solo alle 07:00 ora italiana
    if (romeNow.hour !== "07") {
      return res.status(200).json({
        success: true,
        skipped: true,
        processedGroups: 0,
        updatedRows: 0,
        message: `Invio saltato: ora italiana corrente ${romeNow.hour}:${romeNow.minute}`,
      });
    }

    const todayStart = `${romeNow.dateKey}T00:00:00.000Z`;
    const todayEnd = `${romeNow.dateKey}T23:59:59.999Z`;

    const { data: rows, error } = await supabase
      .from("tbagenda")
      .select("*")
      .gte("data_inizio", todayStart)
      .lte("data_inizio", todayEnd)
      .is("reminder_sent_at", null)
      .order("data_inizio", { ascending: true });

    if (error) {
      console.error("Errore lettura eventi promemoria:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    const agendaRows = ((rows || []) as AgendaRow[]).filter((row) => {
      const rowDateKey = getRomeDateKeyFromIso(row.data_inizio);
      return rowDateKey === romeNow.dateKey;
    });

    if (agendaRows.length === 0) {
      return res.status(200).json({
        success: true,
        processedGroups: 0,
        updatedRows: 0,
        message: "Nessun promemoria da inviare",
      });
    }

    const grouped = new Map<string, AgendaRow[]>();

    for (const row of agendaRows) {
      const key = String(row.gruppo_evento || row.id);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(row);
    }

    const { emailService } = await import("@/services/emailService");

    let processedGroups = 0;
    let updatedRows = 0;
    const errors: string[] = [];

    for (const [groupKey, groupRows] of grouped.entries()) {
      try {
        const masterRow =
          groupRows.find((r) =>
            toArrayOfStrings(r.partecipanti).includes(String(r.utente_id || ""))
          ) || groupRows[0];

        if (!masterRow?.utente_id) {
          errors.push(`Gruppo ${groupKey}: utente_id mancante`);
          continue;
        }

        const { data: responsabile, error: responsabileError } = await supabase
          .from("tbutenti")
          .select("id, nome, cognome, email, microsoft_connection_id")
          .eq("id", masterRow.utente_id)
          .single();

        if (responsabileError || !responsabile?.email) {
          errors.push(
            `Gruppo ${groupKey}: responsabile non trovato o senza email`
          );
          continue;
        }

        const participantIds = [
          ...new Set(
            [
              ...toArrayOfStrings(masterRow.partecipanti),
              ...groupRows.map((r) => String(r.utente_id || "")),
            ].filter(Boolean)
          ),
        ];

        let partecipantiEmails: string[] = [];
        let partecipantiNomi: string[] = [];

        if (participantIds.length > 0) {
          const { data: partecipanti, error: partecipantiError } = await supabase
            .from("tbutenti")
            .select("nome, cognome, email")
            .in("id", participantIds);

          if (!partecipantiError && partecipanti) {
            partecipantiEmails = [
              ...new Set(
                partecipanti
                  .filter((p) => Boolean(p.email))
                  .map((p) => String(p.email))
              ),
            ];

            partecipantiNomi = [
              ...new Set(
                partecipanti.map(
                  (p) =>
                    `${p.nome || ""} ${p.cognome || ""}`.trim() ||
                    p.email ||
                    "Utente"
                )
              ),
            ];
          }
        }

        let clienteEmail: string | undefined;
        let clienteNome: string | undefined;

        if (masterRow.cliente_id) {
          const { data: cliente } = await supabase
            .from("tbclienti")
            .select("ragione_sociale, email")
            .eq("id", masterRow.cliente_id)
            .single();

          if (cliente?.email) {
            clienteEmail = String(cliente.email);
            clienteNome = cliente.ragione_sociale || "Cliente";
          }
        }

        const result = await emailService.sendEventNotification({
          action: "reminder",
          eventoId: masterRow.id,
          eventoTitolo: masterRow.titolo || "Evento senza titolo",
          eventoData: formatDateIt(masterRow.data_inizio),
          eventoOraInizio: masterRow.ora_inizio
            ? masterRow.ora_inizio.substring(0, 5)
            : formatTimeIt(masterRow.data_inizio),
          eventoOraFine: masterRow.ora_fine
            ? masterRow.ora_fine.substring(0, 5)
            : formatTimeIt(masterRow.data_fine),
          eventoLuogo: masterRow.in_sede
            ? masterRow.sala || undefined
            : masterRow.luogo || undefined,
          eventoDescrizione: masterRow.descrizione || undefined,
          eventoInSede: Boolean(masterRow.in_sede),
          responsabileEmail: responsabile.email,
          responsabileNome:
            `${responsabile.nome || ""} ${responsabile.cognome || ""}`.trim() ||
            responsabile.email,
          partecipantiEmails,
          partecipantiNomi,
          clienteEmail,
          clienteNome,
          riunione_teams: masterRow.riunione_teams || false,
          link_teams: masterRow.link_teams || undefined,
          senderUserId: String(responsabile.id),
          microsoftConnectionId: responsabile.microsoft_connection_id
            ? String(responsabile.microsoft_connection_id)
            : undefined,
        });

        if (!result.success) {
          errors.push(`Gruppo ${groupKey}: invio reminder fallito`);
          continue;
        }

        const idsToUpdate = groupRows.map((r) => r.id);

        const { error: updateError } = await supabase
          .from("tbagenda")
          .update({ reminder_sent_at: new Date().toISOString() })
          .in("id", idsToUpdate);

        if (updateError) {
          errors.push(`Gruppo ${groupKey}: reminder inviato ma update fallito`);
          continue;
        }

        processedGroups += 1;
        updatedRows += idsToUpdate.length;
      } catch (groupError: any) {
        console.error("Errore gruppo reminder:", groupKey, groupError);
        errors.push(
          `Gruppo ${groupKey}: ${groupError?.message || "errore sconosciuto"}`
        );
      }
    }

    return res.status(200).json({
      success: true,
      processedGroups,
      updatedRows,
      errors,
    });
  } catch (error: any) {
    console.error("Errore route send-reminders:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno",
    });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ClienteAnagrafica = {
  id: string;
  ragione_sociale: string | null;
  tipo_cliente: string | null;
  cliente: boolean | null;
  codice_fiscale: string | null;
};

type PartecipazioneRow = {
  id: string;
  cliente_id: string;
  soggetto_cliente_id: string;
  percentuale_partecipazione: number | string | null;
  tipo_soggetto: string | null;
  ruolo: string | null;
  attivo: boolean | null;
};

function classificaPartecipazione(quota: number) {
  if (quota > 50) return "controllata";
  if (quota > 20) return "collegata";
  return "altra_partecipazione";
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    /*
     * Ogni record con ruolo = socio rappresenta:
     *
     * soggetto_cliente_id = partecipante
     * cliente_id = società partecipata
     */
    const { data: partecipazioniData, error: partecipazioniError } =
      await supabase
        .from("tbclienti_organi")
        .select(`
          id,
          cliente_id,
          soggetto_cliente_id,
          percentuale_partecipazione,
          tipo_soggetto,
          ruolo,
          attivo
        `)
        .eq("ruolo", "socio")
        .eq("attivo", true)
        .not("soggetto_cliente_id", "is", null)
        .not("cliente_id", "is", null);

    if (partecipazioniError) {
      return NextResponse.json(
        { error: partecipazioniError.message },
        { status: 500 }
      );
    }

    const partecipazioni =
      (partecipazioniData || []) as PartecipazioneRow[];

    const idsCoinvolti = Array.from(
      new Set(
        partecipazioni.flatMap((row) => [
          row.cliente_id,
          row.soggetto_cliente_id,
        ])
      )
    );

    if (idsCoinvolti.length === 0) {
      return NextResponse.json({
        partecipazioni: [],
        riepilogo: {
          totale_partecipazioni: 0,
          controllate: 0,
          collegate: 0,
          altre_partecipazioni: 0,
        },
      });
    }

    const { data: clientiData, error: clientiError } = await supabase
      .from("tbclienti")
      .select(`
        id,
        ragione_sociale,
        tipo_cliente,
        cliente,
        codice_fiscale
      `)
      .in("id", idsCoinvolti);

    if (clientiError) {
      return NextResponse.json(
        { error: clientiError.message },
        { status: 500 }
      );
    }

    const clienti = (clientiData || []) as ClienteAnagrafica[];

    const clientiMap = new Map(
      clienti.map((cliente) => [cliente.id, cliente])
    );

    const relazioni = partecipazioni.map((row) => {
      const partecipante = clientiMap.get(row.soggetto_cliente_id);
      const partecipata = clientiMap.get(row.cliente_id);

      const quota = Number(row.percentuale_partecipazione || 0);

      const partecipantePersonaFisica =
        String(partecipante?.tipo_cliente || "")
          .toLowerCase()
          .includes("persona fisica");

      return {
        id: row.id,

        partecipante_id: row.soggetto_cliente_id,
        partecipante_nome:
          partecipante?.ragione_sociale || "Nominativo non trovato",
        partecipante_tipo:
          partecipantePersonaFisica
            ? "persona_fisica"
            : "societa",

        partecipata_id: row.cliente_id,
        partecipata_nome:
          partecipata?.ragione_sociale || "Società non trovata",

        quota_diretta: quota,

        classificazione:
          partecipantePersonaFisica
            ? "partecipazione_persona_fisica"
            : classificaPartecipazione(quota),

        controllo_diretto:
          !partecipantePersonaFisica && quota > 50,

        collegamento_diretto:
          !partecipantePersonaFisica &&
          quota > 20 &&
          quota <= 50,

        candidato_titolare_effettivo_diretto:
          partecipantePersonaFisica && quota > 25,
      };
    });

    return NextResponse.json({
      partecipazioni: relazioni,

      riepilogo: {
        totale_partecipazioni: relazioni.length,

        controllate: relazioni.filter(
          (row) => row.classificazione === "controllata"
        ).length,

        collegate: relazioni.filter(
          (row) => row.classificazione === "collegata"
        ).length,

        altre_partecipazioni: relazioni.filter(
          (row) =>
            row.classificazione === "altra_partecipazione"
        ).length,

        partecipazioni_persone_fisiche: relazioni.filter(
          (row) =>
            row.partecipante_tipo === "persona_fisica"
        ).length,

        titolari_effettivi_diretti: relazioni.filter(
          (row) =>
            row.candidato_titolare_effettivo_diretto
        ).length,
      },
    });
  } catch (error: any) {
    console.error("Errore gruppi societari:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Errore durante la ricostruzione dei gruppi societari",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  PartecipazioneDiretta,
  costruisciGruppiSocietari,
  calcolaTitolariEffettivi,
} from "@/lib/gruppiSocietari";

import type {
  PartecipazioneTemporale,
} from "@/lib/titolariEffettiviTemporali";

import {
  costruisciVistaGruppiSocietari,
} from "@/lib/gruppiSocietariView";

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

  percentuale_partecipazione:
    number | string | null;

  tipo_soggetto: string | null;
  ruolo: string | null;
  attivo: boolean | null;

  data_nomina: string | null;
  data_scadenza: string | null;
};

type OrganoResidualRow = {
  id: string;
  cliente_id: string;
  soggetto_cliente_id: string;

  ruolo: string | null;
  carica: string | null;
  principale: boolean | null;
  attivo: boolean | null;

  data_nomina: string | null;
  data_scadenza: string | null;
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
  attivo,
  data_nomina,
  data_scadenza
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

    const ruoliResiduali = [
  "amministratore",
  "amministratore_unico",
  "amministratore_delegato",
  "presidente_cda",
  "liquidatore",
  "rappresentante_legale",
];

const { data: organiResidualData, error: organiResidualError } =
  await supabase
    .from("tbclienti_organi")
   .select(`
  id,
  cliente_id,
  soggetto_cliente_id,
  ruolo,
  carica,
  principale,
  attivo,
  data_nomina,
  data_scadenza
`)
    .eq("attivo", true)
    .in("ruolo", ruoliResiduali)
    .not("soggetto_cliente_id", "is", null)
    .not("cliente_id", "is", null);

if (organiResidualError) {
  return NextResponse.json(
    { error: organiResidualError.message },
    { status: 500 }
  );
}

const organiResidual =
  (organiResidualData || []) as OrganoResidualRow[];

    const idsCoinvolti = Array.from(
      new Set(
        partecipazioni.flatMap((row) => [
          row.cliente_id,
          row.soggetto_cliente_id,
        ])
      )
    );

  
    const { data: clientiData, error: clientiError } = await supabase
  .from("tbclienti")
  .select(`
    id,
    ragione_sociale,
    tipo_cliente,
    cliente,
    codice_fiscale
  `);

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
  partecipantePersonaFisica &&
  quota > 25,

valido_dal:
  row.data_nomina || null,

valido_al:
  row.data_scadenza || null,
      };
    });

  const partecipazioniNormalizzate =
  relazioni as PartecipazioneTemporale[];

const gruppi = costruisciGruppiSocietari(
  partecipazioniNormalizzate
);

const titolariEffettiviProprieta =
  calcolaTitolariEffettivi(
    partecipazioniNormalizzate
  );

/*
 * Società per le quali esistono partecipazioni registrate.
 */
const societaIdsDaAnalizzare = Array.from(
  new Set(
    partecipazioni.map((row) =>
      String(row.cliente_id)
    )
  )
);

/*
 * Titolari effettivi residuali.
 *
 * Vengono utilizzati soltanto quando per la società
 * non esiste alcuna persona fisica con quota
 * complessiva superiore al 25%.
 */
const titolariEffettiviResidualMap = new Map<
  string,
  any
>();

societaIdsDaAnalizzare.forEach((societaId) => {
  const esisteTitolarePerProprieta =
    titolariEffettiviProprieta.some(
      (titolare) =>
        String(titolare.societa_id) ===
          String(societaId) &&
        titolare.candidato_titolare_effettivo ===
          true
    );

  if (esisteTitolarePerProprieta) {
    return;
  }

  const organiDellaSocieta = organiResidual
    .filter(
      (organo) =>
        String(organo.cliente_id) ===
        String(societaId)
    )
    .sort((a, b) => {
      if (a.principale === b.principale) {
        return 0;
      }

      return a.principale ? -1 : 1;
    });

  organiDellaSocieta.forEach((organo) => {
    const soggetto = clientiMap.get(
      organo.soggetto_cliente_id
    );

    if (!soggetto) {
      return;
    }

    const tipoCliente = String(
      soggetto.tipo_cliente || ""
    ).toLowerCase();

    const personaFisica =
      tipoCliente.includes("persona fisica");

    if (!personaFisica) {
      return;
    }

    const chiave =
      `${societaId}:${organo.soggetto_cliente_id}`;

    /*
     * Evita che la stessa persona venga inserita due
     * volte quando ricopre più cariche nella società.
     */
    if (titolariEffettiviResidualMap.has(chiave)) {
      return;
    }

    const societa = clientiMap.get(societaId);

    titolariEffettiviResidualMap.set(chiave, {
      persona_id: organo.soggetto_cliente_id,

      persona_nome:
        soggetto.ragione_sociale ||
        "Nominativo non trovato",

      societa_id: societaId,

      societa_nome:
        societa?.ragione_sociale ||
        "Società non trovata",

      quota_diretta: 0,
      quota_indiretta: 0,
      quota_complessiva: 0,

      candidato_titolare_effettivo: true,

      criterio_titolarita: "residuale",

      tipo_titolarita: "residuale",

      ruolo: organo.ruolo,

      carica:
        organo.carica ||
        organo.ruolo ||
        "Amministratore",

      principale:
        organo.principale === true,

      percorsi: [],
    });
  });
});

const titolariEffettiviResidual =
  Array.from(
    titolariEffettiviResidualMap.values()
  );

const titolariEffettivi = [
  ...titolariEffettiviProprieta,
  ...titolariEffettiviResidual,
];

/*
 * La vista ordinaria viene costruita con il calcolo
 * percentuale già esistente, senza modificarne
 * la logica.
 */
const gruppiDettaglioBase =
  costruisciVistaGruppiSocietari(
    partecipazioniNormalizzate,
    gruppi,
    titolariEffettiviProprieta
  );

/*
 * Successivamente integriamo i residuali soltanto
 * nelle società prive di titolari per proprietà.
 */
const gruppiDettaglio = gruppiDettaglioBase.map(
  (gruppo: any) => ({
    ...gruppo,

    societa: (gruppo.societa || []).map(
      (societa: any) => {
        const residualiSocieta =
          titolariEffettiviResidual.filter(
            (titolare: any) =>
              String(titolare.societa_id) ===
              String(societa.id)
          );

        return {
          ...societa,

          titolari_effettivi:
            societa.titolari_effettivi?.length > 0
              ? societa.titolari_effettivi
              : residualiSocieta,

          societa_collegate:
            (
              societa.societa_collegate || []
            ).map((collegata: any) => {
              const residualiCollegata =
                titolariEffettiviResidual.filter(
                  (titolare: any) =>
                    String(
                      titolare.societa_id
                    ) ===
                    String(
                      collegata.societa_id
                    )
                );

              return {
                ...collegata,

                titolari_effettivi:
                  collegata
                    .titolari_effettivi
                    ?.length > 0
                    ? collegata
                        .titolari_effettivi
                    : residualiCollegata,
              };
            }),
        };
      }
    ),
  })
);
    
const societaNeiGruppiIds = new Set<string>();

gruppiDettaglio.forEach((gruppo: any) => {
  if (gruppo.capogruppo?.id) {
    societaNeiGruppiIds.add(
      String(gruppo.capogruppo.id)
    );
  }

  (gruppo.societa || []).forEach((societa: any) => {
    if (societa.id) {
      societaNeiGruppiIds.add(
        String(societa.id)
      );
    }

    if (societa.societa_id) {
      societaNeiGruppiIds.add(
        String(societa.societa_id)
      );
    }
  });
});

const societaPartecipateDaGruppiIds =
  new Set<string>();

relazioni.forEach((relazione) => {
  const partecipanteId = String(
    relazione.partecipante_id
  );

  const partecipataId = String(
    relazione.partecipata_id
  );

  if (
    relazione.partecipante_tipo === "societa" &&
    societaNeiGruppiIds.has(partecipanteId)
  ) {
    societaPartecipateDaGruppiIds.add(
      partecipataId
    );
  }
});

const societaConPartecipazioniIds = new Set(
  partecipazioni.map((row) =>
    String(row.cliente_id)
  )
);
const societaSingole = clienti
  .filter((cliente) => {
    const tipoCliente = String(
      cliente.tipo_cliente || ""
    ).toLowerCase();

    const isPersonaFisica =
      tipoCliente.includes("persona fisica");

    const clienteId = String(cliente.id);

    return (
      cliente.cliente === true &&
      !isPersonaFisica &&

      // Deve avere soci registrati
      societaConPartecipazioniIds.has(clienteId) &&

      // Non deve appartenere direttamente a un gruppo
      !societaNeiGruppiIds.has(clienteId) &&

      // Non deve essere partecipata da una società del gruppo
      !societaPartecipateDaGruppiIds.has(clienteId)
    );
  })
  .map((societa) => {
    const sociDiretti = relazioni.filter(
      (relazione) =>
        String(relazione.partecipata_id) ===
        String(societa.id)
    );

   const titolariSocieta = titolariEffettivi.filter(
  (titolare: any) =>
    (
      String(titolare.societa_id) ===
        String(societa.id) ||
      String(titolare.partecipata_id) ===
        String(societa.id)
    ) &&
    titolare.candidato_titolare_effettivo === true
);

    return {
      id: societa.id,
      ragione_sociale:
        societa.ragione_sociale || "Società senza denominazione",
      codice_fiscale: societa.codice_fiscale || null,

      soci_diretti: sociDiretti,

      titolari_effettivi: titolariSocieta,

      numero_soci_diretti: sociDiretti.length,

     numero_titolari_effettivi:
  titolariSocieta.length,
    };
  })
  .sort((a, b) =>
    a.ragione_sociale.localeCompare(
      b.ragione_sociale,
      "it"
    )
  );
return NextResponse.json({
  partecipazioni: relazioni,

  gruppi,

  gruppi_dettaglio: gruppiDettaglio,

  societa_singole: societaSingole,

  titolari_effettivi: titolariEffettivi,
  
  candidati_titolari_effettivi:
    titolariEffettivi.filter(
      (titolare) =>
        titolare.candidato_titolare_effettivo
    ),

  riepilogo: {
    totale_partecipazioni: relazioni.length,

    controllate: relazioni.filter(
      (row) =>
        row.classificazione === "controllata"
    ).length,

    collegate: relazioni.filter(
      (row) =>
        row.classificazione === "collegata"
    ).length,

    altre_partecipazioni: relazioni.filter(
      (row) =>
        row.classificazione ===
        "altra_partecipazione"
    ).length,

    partecipazioni_persone_fisiche:
      relazioni.filter(
        (row) =>
          row.partecipante_tipo ===
          "persona_fisica"
      ).length,

   gruppi_individuati: gruppi.length,

societa_singole: societaSingole.length,

candidati_titolari_effettivi:
  titolariEffettivi.filter(
    (titolare) =>
      titolare.candidato_titolare_effettivo
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

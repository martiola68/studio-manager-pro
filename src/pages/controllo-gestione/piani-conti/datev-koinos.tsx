import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { getSupabaseClient } from "../../lib/supabaseClient";

type MasterRow = {
  id: string;
  studio_id: string;
  software_contabile: string;
  nome: string;
  descrizione: string | null;
  predefinito: boolean;
  attivo: boolean;
  modello_import_id: string | null;
  numero_conti: number;
  numero_societa: number;
};

type ContoImportato = {
  codice_conto: string;
  descrizione_conto: string;
};

type ImportResult = {
  success: boolean;

  template: {
    id: string;
    nome: string;
    software_contabile: string;
  };

  riepilogo: {
    righe_file: number;
    conti_validi: number;
    gia_presenti: number;
    nuovi: number;
    descrizioni_aggiornate: number;
    non_presenti_nel_file: number;
  };

  nuovi: ContoImportato[];

  gia_presenti: Array<{
    codice_conto: string;
    descrizione_conto: string;
    classificato: boolean;
    escluso: boolean;
  }>;

  descrizioni_cambiate: Array<{
    codice_conto: string;
    descrizione_precedente: string | null;
    descrizione_nuova: string;
  }>;

  non_presenti_nel_file: ContoImportato[];
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeHeader(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[._-]/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeCodice(value: unknown) {
  if (value == null) return "";

  return String(value)
    .trim()
    .replace(/\s+/g, "");
}

function trovaIndiceCodice(headers: string[]) {
  const candidati = [
    "codice conto",
    "codice",
    "conto",
    "cod conto",
    "codice sottoconto",
    "codice sottoconto contabile",
  ];

  for (const candidato of candidati) {
    const index = headers.findIndex(
      (header) => header === candidato
    );

    if (index >= 0) {
      return index;
    }
  }

  return headers.findIndex(
    (header) =>
      header.includes("codice") &&
      (
        header.includes("conto") ||
        header === "codice"
      )
  );
}

function trovaIndiceDescrizione(headers: string[]) {
  const candidati = [
    "descrizione conto",
    "descrizione",
    "denominazione",
    "descrizione sottoconto",
    "nome conto",
  ];

  for (const candidato of candidati) {
    const index = headers.findIndex(
      (header) => header === candidato
    );

    if (index >= 0) {
      return index;
    }
  }

  return headers.findIndex(
    (header) =>
      header.includes("descrizione") ||
      header.includes("denominazione")
  );
}

function estraiContiDaMatrice(
  rows: unknown[][]
): ContoImportato[] {
  if (!rows.length) {
    return [];
  }

  let headerRowIndex = -1;
  let codiceIndex = -1;
  let descrizioneIndex = -1;

  /*
   * Alcuni gestionali mettono titoli e informazioni
   * nelle prime righe, quindi cerchiamo le intestazioni
   * nelle prime 30 righe.
   */
  const limite = Math.min(
    rows.length,
    30
  );

  for (let i = 0; i < limite; i++) {
    const headers = (rows[i] || []).map(
      normalizeHeader
    );

    const cIndex =
      trovaIndiceCodice(headers);

    const dIndex =
      trovaIndiceDescrizione(headers);

    if (
      cIndex >= 0 &&
      dIndex >= 0 &&
      cIndex !== dIndex
    ) {
      headerRowIndex = i;
      codiceIndex = cIndex;
      descrizioneIndex = dIndex;
      break;
    }
  }

  if (
    headerRowIndex < 0 ||
    codiceIndex < 0 ||
    descrizioneIndex < 0
  ) {
    throw new Error(
      "Non riesco a individuare automaticamente le colonne Codice conto e Descrizione conto."
    );
  }

  const map = new Map<
    string,
    ContoImportato
  >();

  for (
    let i = headerRowIndex + 1;
    i < rows.length;
    i++
  ) {
    const row = rows[i] || [];

    const codice =
      normalizeCodice(
        row[codiceIndex]
      );

    const descrizione =
      normalizeText(
        row[descrizioneIndex]
      );

    if (
      !codice ||
      !descrizione
    ) {
      continue;
    }

    /*
     * Evitiamo eventuali intestazioni ripetute
     * all'interno del file.
     */
    if (
      normalizeHeader(codice) ===
        "codice conto" ||
      normalizeHeader(descrizione) ===
        "descrizione conto"
    ) {
      continue;
    }

    map.set(codice, {
      codice_conto: codice,
      descrizione_conto: descrizione,
    });
  }

  return Array.from(
    map.values()
  );
}

async function leggiCsv(
  file: File
): Promise<ContoImportato[]> {
  const buffer =
    await file.arrayBuffer();

  /*
   * DATEV può esportare Windows-1252.
   */
  const text =
    new TextDecoder(
      "windows-1252"
    ).decode(buffer);

  return new Promise(
    (resolve, reject) => {
      Papa.parse<string[]>(
        text,
        {
          skipEmptyLines: true,

          complete: (result) => {
            try {
              const rows =
                result.data as unknown[][];

              const conti =
                estraiContiDaMatrice(
                  rows
                );

              resolve(conti);
            } catch (error) {
              reject(error);
            }
          },

         error: (error: Error) => {
            reject(error);
              },
        }
      );
    }
  );
}

async function leggiExcel(
  file: File
): Promise<ContoImportato[]> {
  const buffer =
    await file.arrayBuffer();

  const workbook =
    new ExcelJS.Workbook();

  await workbook.xlsx.load(
    buffer
  );

  const worksheet =
    workbook.worksheets[0];

  if (!worksheet) {
    throw new Error(
      "Il file Excel non contiene fogli."
    );
  }

  const rows: unknown[][] = [];

  worksheet.eachRow(
    {
      includeEmpty: true,
    },
    (row) => {
      /*
       * ExcelJS usa array 1-based.
       * row.values[0] normalmente è vuoto.
       */
      const values =
        Array.isArray(row.values)
          ? row.values.slice(1)
          : [];

      rows.push(
        values.map(
          (value) => {
            /*
             * Celle ExcelJS particolari possono essere oggetti.
             * Cerchiamo di ottenere il testo effettivo.
             */
            if (
              value &&
              typeof value === "object"
            ) {
              const anyValue =
                value as any;

              if (
                typeof anyValue.text ===
                "string"
              ) {
                return anyValue.text;
              }

              if (
                anyValue.result !==
                undefined
              ) {
                return anyValue.result;
              }

              if (
                Array.isArray(
                  anyValue.richText
                )
              ) {
                return anyValue.richText
                  .map(
                    (part: any) =>
                      part?.text || ""
                  )
                  .join("");
              }
            }

            return value ?? "";
          }
        )
      );
    }
  );

  return estraiContiDaMatrice(
    rows
  );
}

async function leggiPianoConti(
  file: File
): Promise<ContoImportato[]> {
  const nome =
    file.name.toLowerCase();

  if (
    nome.endsWith(".csv")
  ) {
    return leggiCsv(file);
  }

  if (
    nome.endsWith(".xlsx")
  ) {
    return leggiExcel(file);
  }

  if (
    nome.endsWith(".xls")
  ) {
    throw new Error(
      "Il formato XLS non è supportato. Esporta il piano dei conti in CSV oppure XLSX."
    );
  }

  throw new Error(
    "Formato non supportato. Utilizza CSV oppure XLSX."
  );
}

function softwareLabel(
  value: string
) {
  switch (value) {
    case "datev_koinos":
      return "DATEV KOINOS";

    case "zucchetti":
      return "Zucchetti";

    case "buffetti":
      return "Buffetti";

    case "teamsystem":
      return "TeamSystem";

    default:
      return value;
  }
}

export default function MasterPianoContiPage() {
  const router = useRouter();

  const [
    studioId,
    setStudioId,
  ] = useState("");

  const [
    masters,
    setMasters,
  ] = useState<MasterRow[]>([]);

  const [
    masterId,
    setMasterId,
  ] = useState("");

  const [
    file,
    setFile,
  ] = useState<File | null>(
    null
  );

  const [
    contiAnteprima,
    setContiAnteprima,
  ] = useState<
    ContoImportato[]
  >([]);

  const [
    risultato,
    setRisultato,
  ] = useState<
    ImportResult | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    loadingMasters,
    setLoadingMasters,
  ] = useState(false);

  const [
    errore,
    setErrore,
  ] = useState("");

  const [
    messaggio,
    setMessaggio,
  ] = useState("");

  useEffect(() => {
    void inizializza();
  }, []);

  async function inizializza() {
    try {
      setErrore("");

      const supabase =
        getSupabaseClient();

      const {
        data: { user },
        error: authError,
      } =
        await supabase.auth.getUser();

      if (
        authError ||
        !user
      ) {
        setErrore(
          "Utente non autenticato."
        );
        return;
      }

      const {
        data: utente,
        error: utenteError,
      } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", user.id)
        .single();

      if (
        utenteError ||
        !utente?.studio_id
      ) {
        setErrore(
          "Impossibile determinare lo studio dell'utente."
        );
        return;
      }

      const sid =
        utente.studio_id;

      setStudioId(sid);

      await caricaMasters(
        sid
      );
    } catch (error: any) {
      console.error(
        "Errore inizializzazione master:",
        error
      );

      setErrore(
        error?.message ||
          "Errore inizializzazione pagina"
      );
    }
  }

  async function caricaMasters(
    sid = studioId
  ) {
    if (!sid) {
      return;
    }

    try {
      setLoadingMasters(
        true
      );

      const response =
        await fetch(
          `/api/controllo-gestione/master-piano-conti?studio_id=${encodeURIComponent(
            sid
          )}`
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Errore caricamento master"
        );
      }

      const elenco =
        (json.data ||
          []) as MasterRow[];

      setMasters(elenco);

      setMasterId(
        (current) => {
          if (
            current &&
            elenco.some(
              (row) =>
                row.id ===
                current
            )
          ) {
            return current;
          }

          const predefinito =
            elenco.find(
              (row) =>
                row.predefinito &&
                row.attivo
            );

          return (
            predefinito?.id ||
            elenco.find(
              (row) =>
                row.attivo
            )?.id ||
            ""
          );
        }
      );
    } catch (error: any) {
      console.error(
        "Errore caricamento master:",
        error
      );

      setErrore(
        error?.message ||
          "Errore caricamento master"
      );
    } finally {
      setLoadingMasters(
        false
      );
    }
  }

  async function handleLeggiFile() {
    try {
      setErrore("");
      setMessaggio("");
      setRisultato(null);

      if (!file) {
        setErrore(
          "Seleziona prima un file."
        );
        return;
      }

      const conti =
        await leggiPianoConti(
          file
        );

      if (
        !conti.length
      ) {
        setErrore(
          "Nessun conto valido individuato nel file."
        );
        return;
      }

      setContiAnteprima(
        conti
      );

      setMessaggio(
        `${conti.length} conti individuati nel file.`
      );
    } catch (error: any) {
      console.error(
        "Errore lettura piano dei conti:",
        error
      );

      setContiAnteprima(
        []
      );

      setErrore(
        error?.message ||
          "Errore lettura file"
      );
    }
  }

  async function handleImport() {
    try {
      setErrore("");
      setMessaggio("");

      if (!studioId) {
        setErrore(
          "Studio non disponibile."
        );
        return;
      }

      if (!masterId) {
        setErrore(
          "Seleziona un master."
        );
        return;
      }

      if (
        contiAnteprima.length ===
        0
      ) {
        setErrore(
          "Leggi prima il piano dei conti."
        );
        return;
      }

      setLoading(true);

      const response =
        await fetch(
          "/api/controllo-gestione/import-piano-conti",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              studio_id:
                studioId,

              template_id:
                masterId,

              conti:
                contiAnteprima,
            }),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Errore importazione piano dei conti"
        );
      }

      setRisultato(
        json
      );

      setMessaggio(
        `Piano dei conti elaborato. Nuovi conti: ${
          json.riepilogo
            ?.nuovi || 0
        }.`
      );

      await caricaMasters(
        studioId
      );
    } catch (error: any) {
      console.error(
        "Errore import piano dei conti:",
        error
      );

      setErrore(
        error?.message ||
          "Errore importazione piano dei conti"
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  const masterSelezionato =
    useMemo(
      () =>
        masters.find(
          (master) =>
            master.id ===
            masterId
        ) || null,
      [
        masters,
        masterId,
      ]
    );

  return (
    <main
      style={{
        maxWidth: 1450,
        margin: "0 auto",
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Master piani dei conti
          </h1>

          <div
            style={{
              marginTop: 6,
              color:
                "#64748b",
            }}
          >
            Configurazione dei piani dei conti per il controllo di gestione
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/controllo-gestione"
            )
          }
          style={
            secondaryButtonStyle
          }
        >
          Torna al controllo di gestione
        </button>
      </div>

      {errore && (
        <div
          style={
            errorStyle
          }
        >
          {errore}
        </div>
      )}

      {messaggio && (
        <div
          style={
            successStyle
          }
        >
          {messaggio}
        </div>
      )}

      <section
        style={
          cardStyle
        }
      >
        <h2
          style={
            sectionTitleStyle
          }
        >
          1. Master
        </h2>

        <div
          style={
            grid2Style
          }
        >
          <div>
            <label
              style={
                labelStyle
              }
            >
              Master piano dei conti
            </label>

            <select
              value={
                masterId
              }
              disabled={
                loadingMasters
              }
              onChange={(e) => {
                setMasterId(
                  e.target
                    .value
                );

                setFile(
                  null
                );

                setContiAnteprima(
                  []
                );

                setRisultato(
                  null
                );

                setMessaggio(
                  ""
                );

                setErrore(
                  ""
                );
              }}
              style={
                inputStyle
              }
            >
              <option
                value=""
              >
                Seleziona master
              </option>

              {masters.map(
                (master) => (
                  <option
                    key={
                      master.id
                    }
                    value={
                      master.id
                    }
                  >
                    {softwareLabel(
                      master.software_contabile
                    )}
                    {" - "}
                    {
                      master.nome
                    }
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              style={
                labelStyle
              }
            >
              Software contabile
            </label>

            <input
              disabled
              value={
                masterSelezionato
                  ? softwareLabel(
                      masterSelezionato
                        .software_contabile
                    )
                  : ""
              }
              style={{
                ...inputStyle,
                background:
                  "#f8fafc",
              }}
            />
          </div>
        </div>

        {masterSelezionato && (
          <div
            style={{
              ...grid3Style,
              marginTop: 18,
            }}
          >
            <Stat
              label="Conti nel master"
              value={
                masterSelezionato
                  .numero_conti
              }
            />

            <Stat
              label="Società collegate"
              value={
                masterSelezionato
                  .numero_societa
              }
            />

            <StatText
              label="Stato"
              value={
                masterSelezionato
                  .attivo
                  ? masterSelezionato
                      .predefinito
                    ? "Attivo · Predefinito"
                    : "Attivo"
                  : "Non attivo"
              }
            />
          </div>
        )}
      </section>

      <section
        style={
          cardStyle
        }
      >
        <h2
          style={
            sectionTitleStyle
          }
        >
          2. Import piano dei conti
        </h2>

        <div
          style={{
            color:
              "#64748b",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          Importa il piano dei conti in formato CSV oppure XLSX. Le classificazioni già presenti nel master non vengono cancellate.
        </div>

        <div
          style={{
            display:
              "flex",
            alignItems:
              "end",
            gap: 12,
            flexWrap:
              "wrap",
          }}
        >
          <div
            style={{
              flex:
                "1 1 500px",
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              File piano dei conti
            </label>

            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setFile(
                  e.target
                    .files?.[0] ||
                    null
                );

                setContiAnteprima(
                  []
                );

                setRisultato(
                  null
                );

                setErrore(
                  ""
                );

                setMessaggio(
                  ""
                );
              }}
              style={
                inputStyle
              }
            />
          </div>

          <button
            type="button"
            disabled={
              !file ||
              !masterId
            }
            onClick={
              handleLeggiFile
            }
            style={{
              ...secondaryButtonStyle,
              opacity:
                !file ||
                !masterId
                  ? 0.5
                  : 1,
            }}
          >
            Leggi file
          </button>

          <button
            type="button"
            disabled={
              loading ||
              !masterId ||
              contiAnteprima.length ===
                0
            }
            onClick={
              handleImport
            }
            style={{
              ...primaryButtonStyle,
              opacity:
                loading ||
                !masterId ||
                contiAnteprima.length ===
                  0
                  ? 0.5
                  : 1,
            }}
          >
            {loading
              ? "Importazione..."
              : "Importa nel master"}
          </button>
        </div>
      </section>

      {contiAnteprima.length >
        0 && (
        <section
          style={
            cardStyle
          }
        >
          <h2
            style={
              sectionTitleStyle
            }
          >
            3. Anteprima
          </h2>

          <div
            style={{
              marginBottom:
                14,
              color:
                "#475569",
            }}
          >
            Conti individuati:{" "}
            <strong>
              {
                contiAnteprima
                  .length
              }
            </strong>
          </div>

          <div
            style={{
              maxHeight:
                420,
              overflow:
                "auto",
              border:
                "1px solid #e2e8f0",
              borderRadius:
                8,
            }}
          >
            <table
              style={
                tableStyle
              }
            >
              <thead>
                <tr>
                  <th
                    style={
                      thStyle
                    }
                  >
                    Codice
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    Descrizione
                  </th>
                </tr>
              </thead>

              <tbody>
                {contiAnteprima
                  .slice(
                    0,
                    500
                  )
                  .map(
                    (
                      conto,
                      index
                    ) => (
                      <tr
                        key={`${conto.codice_conto}-${index}`}
                      >
                        <td
                          style={
                            tdStyle
                          }
                        >
                          <strong>
                            {
                              conto.codice_conto
                            }
                          </strong>
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            conto.descrizione_conto
                          }
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>

          {contiAnteprima.length >
            500 && (
            <div
              style={{
                marginTop:
                  10,
                fontSize:
                  12,
                color:
                  "#64748b",
              }}
            >
              Anteprima limitata alle prime 500 righe.
            </div>
          )}
        </section>
      )}

      {risultato && (
        <section
          style={
            cardStyle
          }
        >
          <h2
            style={
              sectionTitleStyle
            }
          >
            4. Esito aggiornamento master
          </h2>

          <div
            style={
              grid3Style
            }
          >
            <Stat
              label="Conti validi"
              value={
                risultato
                  .riepilogo
                  .conti_validi
              }
            />

            <Stat
              label="Già presenti"
              value={
                risultato
                  .riepilogo
                  .gia_presenti
              }
            />

            <Stat
              label="Nuovi"
              value={
                risultato
                  .riepilogo
                  .nuovi
              }
            />

            <Stat
              label="Descrizioni aggiornate"
              value={
                risultato
                  .riepilogo
                  .descrizioni_aggiornate
              }
            />

            <Stat
              label="Assenti dal file"
              value={
                risultato
                  .riepilogo
                  .non_presenti_nel_file
              }
            />
          </div>

          {risultato.nuovi
            .length > 0 && (
            <div
              style={{
                marginTop:
                  20,
              }}
            >
              <h3
                style={{
                  fontSize:
                    16,
                }}
              >
                Nuovi conti da classificare
              </h3>

              <div
                style={{
                  overflowX:
                    "auto",
                }}
              >
                <table
                  style={
                    tableStyle
                  }
                >
                  <thead>
                    <tr>
                      <th
                        style={
                          thStyle
                        }
                      >
                        Codice
                      </th>

                      <th
                        style={
                          thStyle
                        }
                      >
                        Descrizione
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {risultato.nuovi.map(
                      (
                        conto
                      ) => (
                        <tr
                          key={
                            conto.codice_conto
                          }
                        >
                          <td
                            style={
                              tdStyle
                            }
                          >
                            <strong>
                              {
                                conto.codice_conto
                              }
                            </strong>
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {
                              conto.descrizione_conto
                            }
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={
        subCardStyle
      }
    >
      <div
        style={
          smallLabelStyle
        }
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 25,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatText({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={
        subCardStyle
      }
    >
      <div
        style={
          smallLabelStyle
        }
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 7,
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties =
  {
    background:
      "#ffffff",
    border:
      "1px solid #e2e8f0",
    borderRadius:
      12,
    padding:
      20,
    marginBottom:
      20,
  };

const subCardStyle: React.CSSProperties =
  {
    border:
      "1px solid #e2e8f0",
    borderRadius:
      10,
    padding:
      16,
    background:
      "#ffffff",
  };

const sectionTitleStyle: React.CSSProperties =
  {
    marginTop:
      0,
    marginBottom:
      18,
    fontSize:
      18,
  };

const labelStyle: React.CSSProperties =
  {
    display:
      "block",
    marginBottom:
      6,
    fontSize:
      13,
    fontWeight:
      600,
    color:
      "#334155",
  };

const smallLabelStyle: React.CSSProperties =
  {
    fontSize:
      12,
    color:
      "#64748b",
    textTransform:
      "uppercase",
    letterSpacing:
      "0.04em",
  };

const inputStyle: React.CSSProperties =
  {
    width:
      "100%",
    boxSizing:
      "border-box",
    padding:
      "10px 12px",
    border:
      "1px solid #cbd5e1",
    borderRadius:
      8,
    background:
      "#ffffff",
  };

const grid2Style: React.CSSProperties =
  {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(280px, 1fr))",
    gap:
      16,
  };

const grid3Style: React.CSSProperties =
  {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(200px, 1fr))",
    gap:
      14,
  };

const primaryButtonStyle: React.CSSProperties =
  {
    border:
      0,
    borderRadius:
      8,
    padding:
      "11px 18px",
    background:
      "#0f172a",
    color:
      "#ffffff",
    fontWeight:
      600,
    cursor:
      "pointer",
  };

const secondaryButtonStyle: React.CSSProperties =
  {
    border:
      "1px solid #cbd5e1",
    borderRadius:
      8,
    padding:
      "10px 14px",
    background:
      "#ffffff",
    cursor:
      "pointer",
  };

const errorStyle: React.CSSProperties =
  {
    marginBottom:
      16,
    padding:
      12,
    borderRadius:
      8,
    background:
      "#fef2f2",
    border:
      "1px solid #fecaca",
    color:
      "#991b1b",
  };

const successStyle: React.CSSProperties =
  {
    marginBottom:
      16,
    padding:
      12,
    borderRadius:
      8,
    background:
      "#f0fdf4",
    border:
      "1px solid #bbf7d0",
    color:
      "#166534",
  };

const tableStyle: React.CSSProperties =
  {
    width:
      "100%",
    borderCollapse:
      "collapse",
    fontSize:
      13,
  };

const thStyle: React.CSSProperties =
  {
    padding:
      "10px 8px",
    textAlign:
      "left",
    borderBottom:
      "2px solid #e2e8f0",
    color:
      "#475569",
    whiteSpace:
      "nowrap",
    background:
      "#f8fafc",
    position:
      "sticky",
    top:
      0,
  };

const tdStyle: React.CSSProperties =
  {
    padding:
      "9px 8px",
    borderBottom:
      "1px solid #e2e8f0",
    verticalAlign:
      "middle",
  };

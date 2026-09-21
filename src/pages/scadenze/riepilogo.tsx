import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const studioId = "f9d3ca10-6134-4061-a2b4-0be74e8c7654";

const getColor = (stato: string) => {
  if (!stato) return "bg-gray-100 text-gray-600";
  if (
    ["INVIATO", "COMUNICATO", "DICHIARAZIONE PRESENTATA", "COMPLETO"].includes(
      stato
    )
  )
    return "bg-green-100 text-green-700";
  if (stato === "DA FARE") return "bg-red-100 text-red-700";
  return "bg-yellow-100 text-yellow-700";
};

type RigaRiepilogo = {
  cliente_id: string;
  nominativo: string;
  utente_operatore_id?: string | null;
  stato_generale?: string | null;
  stato_iva?: string | null;
  stato_fiscali?: string | null;
  stato_bilanci?: string | null;
  stato_770?: string | null;
  stato_ccgg?: string | null;
  stato_cu?: string | null;
  stato_imu?: string | null;
  confermata_iva?: boolean | null;
  confermata_fiscali?: boolean | null;
  confermata_bilanci?: boolean | null;
  confermata_770?: boolean | null;
  confermata_ccgg?: boolean | null;
  confermata_cu?: boolean | null;
  confermata_imu?: boolean | null;
};

type UtenteOption = { id: string; nome: string };
type FieldType = "boolean" | "date" | "number" | "text" | "textarea" | "select";

type FieldConfig = {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
};

type ModuloConfig = {
  key: string;
  label: string;
  table: string;
  route: string;
  fields: FieldConfig[];
};

type DettaglioRecord = {
  key: string;
  modulo: string;
  moduloLabel: string;
  table: string;
  route: string;
  id: string;
  anno: number | string | null;
  original: Record<string, any>;
  draft: Record<string, any>;
};

const siNoNp = [
  { value: "SI", label: "SI" },
  { value: "NO", label: "NO" },
  { value: "NP", label: "NP" },
];

const MODULI: ModuloConfig[] = [
  {
    key: "iva",
    label: "IVA",
    table: "tbscadiva",
    route: "/scadenze/iva",
    fields: [
      { key: "conferma_riga", label: "Conferma riga", type: "boolean" },
      { key: "mod_predisposto", label: "Modello predisposto", type: "boolean" },
      { key: "mod_definitivo", label: "Modello definitivo", type: "boolean" },
      { key: "asseverazione", label: "Asseverazione", type: "boolean" },
      { key: "mod_inviato", label: "Modello inviato", type: "boolean" },
      { key: "data_invio", label: "Data invio", type: "date" },
      { key: "ricevuta", label: "Ricevuta", type: "boolean" },
      { key: "importo_credito", label: "Importo credito", type: "number" },
      { key: "note", label: "Note", type: "textarea" },
    ],
  },
  {
    key: "fiscali",
    label: "Fiscali",
    table: "tbscadfiscali",
    route: "/scadenze/fiscali",
    fields: [
      { key: "conferma_riga", label: "Conferma riga", type: "boolean" },
      { key: "saldo_acc_cciaa", label: "Saldo / acconto / CCIAA", type: "boolean" },
      {
        key: "saldi_primo_acconti_cciaa_dovuti",
        label: "Saldo / primo acconto dovuti",
        type: "boolean",
      },
      {
        key: "conferma_ires_saldo_acconto",
        label: "Conferma saldo / primo acconto",
        type: "boolean",
      },
      { key: "data_com1", label: "Data comunicazione saldo", type: "date" },
      { key: "acc2", label: "Secondo acconto", type: "boolean" },
      {
        key: "secondo_acconti_dovuti",
        label: "Secondo acconto dovuto",
        type: "boolean",
      },
      {
        key: "conferma_ires_secondo_acconto",
        label: "Conferma secondo acconto",
        type: "boolean",
      },
      { key: "data_com2", label: "Data comunicazione 2° acconto", type: "date" },
      { key: "mod_r_compilato", label: "Redditi compilato", type: "boolean" },
      { key: "mod_r_definitivo", label: "Redditi definitivo", type: "boolean" },
      { key: "mod_r_inviato", label: "Redditi inviato", type: "boolean" },
      { key: "data_r_invio", label: "Data invio Redditi", type: "date" },
      { key: "ricevuta_r", label: "Ricevuta Redditi", type: "boolean" },
      {
        key: "conferma_invio_dichiarazione",
        label: "Conferma invio dichiarazione",
        type: "boolean",
      },
      { key: "con_irap", label: "IRAP prevista", type: "boolean" },
      { key: "mod_i_compilato", label: "IRAP compilata", type: "boolean" },
      { key: "mod_i_definitivo", label: "IRAP definitiva", type: "boolean" },
      { key: "mod_i_inviato", label: "IRAP inviata", type: "boolean" },
      { key: "data_i_invio", label: "Data invio IRAP", type: "date" },
      { key: "conferma_invii", label: "Conferma invii", type: "boolean" },
      { key: "note", label: "Note", type: "textarea" },
    ],
  },
  {
    key: "bilanci",
    label: "Bilanci",
    table: "tbscadbilanci",
    route: "/scadenze/bilanci",
    fields: [
      { key: "conferma_riga", label: "Conferma riga", type: "boolean" },
      { key: "bilancio_def", label: "Bilancio definitivo", type: "boolean" },
      { key: "verbale_app", label: "Verbale approvazione", type: "boolean" },
      { key: "bil_approvato", label: "Bilancio approvato", type: "boolean" },
      { key: "data_approvazione", label: "Data approvazione", type: "date" },
      {
        key: "tipo_bilancio",
        label: "Tipo bilancio",
        type: "select",
        options: [
          { value: "micro", label: "Micro" },
          { value: "abbreviato", label: "Abbreviato" },
          { value: "ordinario", label: "Ordinario" },
        ],
      },
      {
        key: "relazione_gest",
        label: "Relazione gestione",
        type: "select",
        options: siNoNp,
      },
      {
        key: "relazione_sindaci",
        label: "Relazione sindaci",
        type: "select",
        options: siNoNp,
      },
      {
        key: "relazione_revisore",
        label: "Relazione revisore",
        type: "select",
        options: siNoNp,
      },
      { key: "data_scad_pres", label: "Scadenza presentazione", type: "date" },
      { key: "invio_bil", label: "Bilancio inviato", type: "boolean" },
      { key: "data_invio", label: "Data invio", type: "date" },
      { key: "ricevuta", label: "Ricevuta", type: "boolean" },
      { key: "note", label: "Note", type: "textarea" },
    ],
  },
  {
    key: "770",
    label: "770",
    table: "tbscad770",
    route: "/scadenze/modello-770",
    fields: [
      { key: "conferma_riga", label: "Conferma riga", type: "boolean" },
      { key: "modelli_770", label: "Modelli 770", type: "text" },
      { key: "tipo_invio", label: "Tipo invio", type: "text" },
      { key: "mod_compilato", label: "Modello compilato", type: "boolean" },
      { key: "mod_definitivo", label: "Modello definitivo", type: "boolean" },
      { key: "mod_inviato", label: "Modello inviato", type: "boolean" },
      { key: "data_invio", label: "Data invio", type: "date" },
      { key: "ricevuta", label: "Ricevuta", type: "boolean" },
      { key: "note", label: "Note", type: "textarea" },
    ],
  },
  {
    key: "ccgg",
    label: "CCGG",
    table: "tbscadccgg",
    route: "/scadenze/ccgg",
    fields: [
      { key: "conferma_riga", label: "Conferma riga", type: "boolean" },
      { key: "importo_calcolato", label: "Importo calcolato", type: "boolean" },
      { key: "f24_generato", label: "F24 generato", type: "boolean" },
      { key: "f24_comunicato", label: "F24 comunicato", type: "boolean" },
      { key: "data_comunicato", label: "Data comunicazione", type: "date" },
      { key: "note", label: "Note", type: "textarea" },
    ],
  },
  {
    key: "cu",
    label: "CU",
    table: "tbscadcu",
    route: "/scadenze/cu",
    fields: [
      { key: "conferma_riga", label: "Conferma riga", type: "boolean" },
      { key: "cu_autonomi", label: "CU autonomi", type: "boolean" },
      { key: "num_cu", label: "Numero CU", type: "number" },
      { key: "inserite", label: "CU inserite", type: "boolean" },
      { key: "generate", label: "CU generate", type: "boolean" },
      { key: "inviate", label: "CU inviate", type: "boolean" },
      { key: "data_invio", label: "Data invio", type: "date" },
      { key: "note", label: "Note", type: "textarea" },
    ],
  },
  {
    key: "imu",
    label: "IMU",
    table: "tbscadimu",
    route: "/scadenze/imu",
    fields: [
      { key: "conferma_riga", label: "Conferma riga", type: "boolean" },
      { key: "soggetto_imu", label: "Soggetto IMU", type: "boolean" },
      { key: "acconto_dovuto", label: "Acconto dovuto", type: "boolean" },
      {
        key: "acconto_comunicato",
        label: "Acconto comunicato",
        type: "boolean",
      },
      { key: "conferma_acconto_imu", label: "Conferma acconto", type: "boolean" },
      { key: "data_com_acconto", label: "Data comunicazione acconto", type: "date" },
      { key: "acconto_data", label: "Data acconto", type: "date" },
      { key: "saldo_dovuto", label: "Saldo dovuto", type: "boolean" },
      { key: "saldo_comunicato", label: "Saldo comunicato", type: "boolean" },
      { key: "conferma_saldo_imu", label: "Conferma saldo", type: "boolean" },
      { key: "data_com_saldo", label: "Data comunicazione saldo", type: "date" },
      { key: "saldo_data", label: "Data saldo", type: "date" },
      { key: "dichiarazione_imu", label: "Dichiarazione IMU", type: "text" },
      {
        key: "data_scad_dichiarazione",
        label: "Scadenza dichiarazione",
        type: "date",
      },
      {
        key: "dichiarazione_scadenza",
        label: "Scadenza dichiarazione",
        type: "date",
      },
      {
        key: "dichiarazione_presentazione",
        label: "Dichiarazione presentata",
        type: "boolean",
      },
      {
        key: "conferma_dichiarazione_imu",
        label: "Conferma dichiarazione",
        type: "boolean",
      },
      {
        key: "dichiarazione_data_pres",
        label: "Data presentazione dichiarazione",
        type: "date",
      },
      { key: "note", label: "Note", type: "textarea" },
    ],
  },
];

const getProgress = (r: RigaRiepilogo) => {
  const items = [
    { stato: r.stato_iva, confermata: r.confermata_iva },
    { stato: r.stato_fiscali, confermata: r.confermata_fiscali },
    { stato: r.stato_bilanci, confermata: r.confermata_bilanci },
    { stato: r.stato_770, confermata: r.confermata_770 },
    { stato: r.stato_ccgg, confermata: r.confermata_ccgg },
    { stato: r.stato_cu, confermata: r.confermata_cu },
    { stato: r.stato_imu, confermata: r.confermata_imu },
  ].filter(
    (item) =>
      item.stato !== null &&
      item.stato !== undefined &&
      String(item.stato).trim() !== ""
  );
  if (items.length === 0) return 0;
  return Math.round(
    (items.filter((item) => item.confermata === true).length / items.length) *
      100
  );
};

const getProgressColor = (percent: number) => {
  if (percent === 100) return "bg-green-100 text-green-700";
  if (percent >= 50) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
};

const sameValue = (a: any, b: any) => {
  const left = a === undefined ? null : a;
  const right = b === undefined ? null : b;
  return JSON.stringify(left) === JSON.stringify(right);
};

const formatAnno = (record: Record<string, any>) =>
  record.anno_riferimento ?? record.anno ?? null;

export default function ScadenzarioRiepilogo() {
  const [rows, setRows] = useState<RigaRiepilogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statoFilter, setStatoFilter] = useState("TUTTI");
  const [operatore, setOperatore] = useState("TUTTI");
  const [utentiMap, setUtentiMap] = useState<Record<string, string>>({});
  const [utentiNomeMap, setUtentiNomeMap] = useState<Record<string, string>>({});

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRecords, setDetailRecords] = useState<DettaglioRecord[]>([]);
  const [detailError, setDetailError] = useState("");
  const [detailClienteId, setDetailClienteId] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data, error } = await (supabase as any)
        .from("vw_scadenzario_riepilogativo_societa")
        .select("*")
        .eq("studio_id", studioId)
        .order("nominativo", { ascending: true });

      if (error) {
        console.error("Errore caricamento riepilogo:", error);
        setRows([]);
        return;
      }

      const loadedRows: RigaRiepilogo[] = data || [];
      setRows(loadedRows);

      const operatoreIds = [
        ...new Set(
          loadedRows
            .map((r) => r.utente_operatore_id)
            .filter((v): v is string => !!v)
        ),
      ];

      if (operatoreIds.length > 0) {
        const { data: utentiData, error: utentiError } = await (supabase as any)
          .from("tbutenti")
          .select("id, nome, cognome")
          .in("id", operatoreIds);

        if (utentiError) {
          console.error("Errore caricamento utenti:", utentiError);
        } else {
          const map: Record<string, string> = {};
          const nomeMap: Record<string, string> = {};

          (utentiData || []).forEach((u: any) => {
            const displayName = [u.cognome, u.nome]
              .filter(Boolean)
              .join(" ")
              .trim();
            map[u.id] = displayName || u.nome || u.cognome || u.id;
            nomeMap[u.id] =
              [u.nome, u.cognome].filter(Boolean).join(" ").trim() ||
              displayName ||
              u.id;
          });

          setUtentiMap(map);
          setUtentiNomeMap(nomeMap);
        }
      } else {
        setUtentiMap({});
        setUtentiNomeMap({});
      }
    } catch (err) {
      console.error("Errore caricamento riepilogo:", err);
      setRows([]);
      setUtentiMap({});
      setUtentiNomeMap({});
    } finally {
      setLoading(false);
    }
  }

  const operatori = useMemo<UtenteOption[]>(() => {
    const ids = [
      ...new Set(
        rows
          .map((r) => r.utente_operatore_id)
          .filter((v): v is string => !!v)
      ),
    ];

    return ids
      .map((id) => ({
        id,
        nome: utentiNomeMap[id] || utentiMap[id] || id,
      }))
      .sort((a, b) =>
        a.nome.localeCompare(b.nome, "it", { sensitivity: "base" })
      );
  }, [rows, utentiMap, utentiNomeMap]);

  const filteredRows = useMemo(() => {
    const getStatoGenerale = (r: RigaRiepilogo) => {
      const stati = [
        r.stato_iva,
        r.stato_fiscali,
        r.stato_bilanci,
        r.stato_770,
        r.stato_ccgg,
        r.stato_cu,
        r.stato_imu,
      ]
        .filter(Boolean)
        .map((s) => String(s).toUpperCase());

      if (stati.length === 0) return "";
      if (stati.includes("DA FARE")) return "DA FARE";

      const statiVerdi = [
        "INVIATO",
        "COMUNICATO",
        "DICHIARAZIONE PRESENTATA",
        "COMPLETO",
        "DEFINITIVO",
        "APPROVATO",
        "GENERATO",
        "CALCOLATO",
        "INSERITO",
        "AUTONOMI",
      ];

      return stati.every((s) => statiVerdi.includes(s))
        ? "COMPLETO"
        : "IN CORSO";
    };

    return rows.filter((r) => {
      const statoGenerale = getStatoGenerale(r);
      return (
        (r.nominativo || "")
          .toLowerCase()
          .includes(search.trim().toLowerCase()) &&
        (statoFilter === "TUTTI" ||
          statoGenerale.toUpperCase() === statoFilter) &&
        (operatore === "TUTTI" || r.utente_operatore_id === operatore)
      );
    });
  }, [rows, search, statoFilter, operatore]);

  const singleRow = filteredRows.length === 1 ? filteredRows[0] : null;

  useEffect(() => {
    if (!singleRow) {
      setDetailClienteId(null);
      setDetailRecords([]);
      setDetailError("");
      setSaveMessage("");
      return;
    }

    if (detailClienteId === singleRow.cliente_id) return;

    void loadCompanyDetails(singleRow);
  }, [singleRow?.cliente_id]);

  async function queryModuleRecords(
    modulo: ModuloConfig,
    clienteId: string,
    nominativo: string
  ) {
    const supabase = getSupabaseClient();

    const attempts = [
      () =>
        (supabase as any)
          .from(modulo.table)
          .select("*")
          .eq("cliente_id", clienteId),
      () => (supabase as any).from(modulo.table).select("*").eq("id", clienteId),
      () =>
        (supabase as any)
          .from(modulo.table)
          .select("*")
          .ilike("nominativo", nominativo),
    ];

    let lastError: any = null;

    for (const attempt of attempts) {
      const { data, error } = await attempt();

      if (!error && Array.isArray(data) && data.length > 0) {
        const unique = new Map<string, any>();
        data.forEach((row: any, index: number) => {
          unique.set(String(row.id || index), row);
        });

        return [...unique.values()].sort((a, b) => {
          const annoA = Number(formatAnno(a) || 0);
          const annoB = Number(formatAnno(b) || 0);
          return annoB - annoA;
        });
      }

      if (error) lastError = error;
    }

    if (
      lastError &&
      !String(lastError.message || "").toLowerCase().includes("column")
    ) {
      console.warn(
        `Errore caricamento ${modulo.label} per ${nominativo}:`,
        lastError
      );
    }

    return [];
  }

  async function loadCompanyDetails(riga: RigaRiepilogo) {
    try {
      setDetailLoading(true);
      setDetailError("");
      setSaveMessage("");
      setDetailClienteId(riga.cliente_id);

      const resultSets = await Promise.all(
        MODULI.map(async (modulo) => ({
          modulo,
          rows: await queryModuleRecords(
            modulo,
            riga.cliente_id,
            riga.nominativo
          ),
        }))
      );

      const records: DettaglioRecord[] = [];

      resultSets.forEach(({ modulo, rows: moduleRows }) => {
        moduleRows.forEach((row: Record<string, any>, index: number) => {
          records.push({
            key: `${modulo.table}:${String(row.id || index)}`,
            modulo: modulo.key,
            moduloLabel: modulo.label,
            table: modulo.table,
            route: modulo.route,
            id: String(row.id),
            anno: formatAnno(row),
            original: { ...row },
            draft: { ...row },
          });
        });
      });

      setDetailRecords(records);
    } catch (error: any) {
      console.error("Errore caricamento dettaglio scadenzari:", error);
      setDetailRecords([]);
      setDetailError(
        error?.message || "Impossibile caricare i record degli scadenzari."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function updateDraft(recordKey: string, field: string, value: any) {
    setSaveMessage("");
    setDetailRecords((prev) =>
      prev.map((record) =>
        record.key === recordKey
          ? {
              ...record,
              draft: {
                ...record.draft,
                [field]: value,
              },
            }
          : record
      )
    );
  }

  function changesFor(record: DettaglioRecord) {
    const modulo = MODULI.find((item) => item.key === record.modulo);
    if (!modulo) return {};

    const changes: Record<string, any> = {};

    modulo.fields.forEach((field) => {
      if (!(field.key in record.draft)) return;

      const before = record.original[field.key];
      const after = record.draft[field.key];

      if (!sameValue(before, after)) {
        changes[field.key] = after === "" ? null : after;
      }
    });

    return changes;
  }

  const dirtyRecords = detailRecords.filter(
    (record) => Object.keys(changesFor(record)).length > 0
  );

  async function saveAllDetails() {
    if (!singleRow || dirtyRecords.length === 0) return;

    try {
      setSavingDetails(true);
      setDetailError("");
      setSaveMessage("");

      const supabase = getSupabaseClient();

      for (const record of dirtyRecords) {
        const changes = changesFor(record);
        const { error } = await (supabase as any)
          .from(record.table)
          .update(changes)
          .eq("id", record.id);

        if (error) {
          throw new Error(
            `${record.moduloLabel}: ${error.message || "errore salvataggio"}`
          );
        }
      }

      setSaveMessage(
        `Salvate ${dirtyRecords.length} modifiche scadenzario per ${singleRow.nominativo}.`
      );

      await loadData();
      await loadCompanyDetails(singleRow);
    } catch (error: any) {
      console.error("Errore salvataggio cumulativo:", error);
      setDetailError(
        error?.message || "Errore durante il salvataggio cumulativo."
      );
    } finally {
      setSavingDetails(false);
    }
  }

  function renderField(record: DettaglioRecord, field: FieldConfig) {
    if (!(field.key in record.draft)) return null;

    const value = record.draft[field.key];
    const baseClass =
      "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-sky-500";

    if (field.type === "boolean") {
      return (
        <select
          value={
            value === true ? "true" : value === false ? "false" : ""
          }
          onChange={(e) =>
            updateDraft(
              record.key,
              field.key,
              e.target.value === ""
                ? null
                : e.target.value === "true"
            )
          }
          className={baseClass}
        >
          <option value="">-</option>
          <option value="true">SI</option>
          <option value="false">NO</option>
        </select>
      );
    }

    if (field.type === "select") {
      return (
        <select
          value={value ?? ""}
          onChange={(e) =>
            updateDraft(record.key, field.key, e.target.value || null)
          }
          className={baseClass}
        >
          <option value="">-</option>
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          value={value ?? ""}
          onChange={(e) =>
            updateDraft(record.key, field.key, e.target.value)
          }
          className="min-h-[72px] w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-sky-500"
        />
      );
    }

    return (
      <input
        type={
          field.type === "date"
            ? "date"
            : field.type === "number"
            ? "number"
            : "text"
        }
        value={
          field.type === "date" && value
            ? String(value).slice(0, 10)
            : value ?? ""
        }
        onChange={(e) => {
          let nextValue: any = e.target.value;

          if (field.type === "number") {
            nextValue =
              e.target.value === "" ? null : Number(e.target.value);
          }

          updateDraft(record.key, field.key, nextValue);
        }}
        className={baseClass}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 bg-slate-100 py-3">
      <div className="shrink-0 rounded-lg border border-sky-200 bg-slate-50 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Scadenzario Riepilogativo
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Totale risultati: {filteredRows.length}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold text-slate-700">
                Cerca nominativo
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Scrivi il nominativo..."
                className="h-9 min-w-[240px] rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold text-slate-700">
                Stato generale
              </label>
              <select
                value={statoFilter}
                onChange={(e) => setStatoFilter(e.target.value)}
                className="h-9 min-w-[180px] rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500"
              >
                <option value="TUTTI">Tutti</option>
                <option value="COMPLETO">Completo</option>
                <option value="IN CORSO">In corso</option>
                <option value="DA FARE">Da fare</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold text-slate-700">
                Filtra Operatore
              </label>
              <select
                value={operatore}
                onChange={(e) => setOperatore(e.target.value)}
                className="h-9 min-w-[220px] rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500"
              >
                <option value="TUTTI">Tutti</option>
                {operatori.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-sky-200 bg-white text-sm text-slate-500">
          Caricamento...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-sky-200 bg-white text-sm text-slate-500">
          Nessun risultato trovato.
        </div>
      ) : (
        <>
          <div
            className={`${
              singleRow
                ? "max-h-[220px] shrink-0"
                : "min-h-0 flex-1"
            } overflow-auto rounded-lg border border-sky-200 bg-white shadow-sm`}
          >
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col style={{ width: "28%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "8%" }} />
                {Array.from({ length: 7 }).map((_, i) => (
                  <col key={i} style={{ width: "7%" }} />
                ))}
              </colgroup>

              <thead className="sticky top-0 z-30 bg-slate-600 text-white shadow-sm">
                <tr>
                  {[
                    "Nominativo",
                    "Operatore",
                    "Avanz.",
                    "IVA",
                    "Fiscali",
                    "Bilanci",
                    "770",
                    "CCGG",
                    "CU",
                    "IMU",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`${
                        i === 0
                          ? "sticky left-0 z-40 bg-slate-600 text-left"
                          : i === 1
                          ? "text-left"
                          : "text-center"
                      } border-r border-slate-500 px-2 py-2 font-semibold last:border-r-0`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((r, rowIndex) => {
                  const progress = getProgress(r);
                  const statusCells = [
                    r.stato_iva,
                    r.stato_fiscali,
                    r.stato_bilanci,
                    r.stato_770,
                    r.stato_ccgg,
                    r.stato_cu,
                    r.stato_imu,
                  ];

                  const rowBase =
                    rowIndex % 2 === 0 ? "bg-white" : "bg-slate-200/70";

                  return (
                    <tr
                      key={`${r.cliente_id}-${r.nominativo}`}
                      className={`border-b border-slate-300 ${rowBase} hover:bg-sky-100`}
                    >
                      <td
                        className={`sticky left-0 z-20 border-r border-slate-300 px-2 py-2 font-medium text-slate-900 ${
                          rowIndex % 2 === 0 ? "bg-white" : "bg-slate-200"
                        }`}
                      >
                        <div className="truncate" title={r.nominativo}>
                          {r.nominativo}
                        </div>
                      </td>

                      <td className="border-r border-slate-300 px-2 py-2 text-slate-700">
                        <div className="truncate">
                          {r.utente_operatore_id
                            ? utentiMap[r.utente_operatore_id] ||
                              r.utente_operatore_id
                            : ""}
                        </div>
                      </td>

                      <td className="border-r border-slate-300 px-2 py-1.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-semibold ${getProgressColor(
                              progress
                            )}`}
                          >
                            {progress}%
                          </span>
                          <div className="h-1.5 w-16 max-w-full overflow-hidden rounded bg-slate-300">
                            <div
                              className={`h-1.5 ${
                                progress === 100
                                  ? "bg-green-500"
                                  : progress >= 50
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {statusCells.map((stato, i) => (
                        <td
                          key={i}
                          className={`border-r border-slate-300 px-2 py-2 text-center font-medium last:border-r-0 ${getColor(
                            stato || ""
                          )}`}
                        >
                          {stato || ""}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {singleRow && (
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-sky-300 bg-white shadow-sm">
              <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-sky-200 bg-sky-50 px-4 py-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Aggiornamento cumulativo — {singleRow.nominativo}
                  </h2>
                  <p className="text-xs text-slate-600">
                    I dati sotto sono i record originali dei singoli
                    scadenzari. Il salvataggio aggiorna direttamente i moduli
                    di origine.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadCompanyDetails(singleRow)}
                    disabled={detailLoading || savingDetails}
                    className="rounded-md border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                  >
                    Aggiorna dati
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveAllDetails()}
                    disabled={
                      savingDetails ||
                      detailLoading ||
                      dirtyRecords.length === 0
                    }
                    className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingDetails
                      ? "Salvataggio..."
                      : `Salva tutte le modifiche${
                          dirtyRecords.length > 0
                            ? ` (${dirtyRecords.length})`
                            : ""
                        }`}
                  </button>
                </div>
              </div>

              {detailLoading ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Apertura scadenzari collegati...
                </div>
              ) : detailError ? (
                <div className="m-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {detailError}
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  {saveMessage && (
                    <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
                      {saveMessage}
                    </div>
                  )}

                  {MODULI.map((modulo) => {
                    const records = detailRecords.filter(
                      (record) => record.modulo === modulo.key
                    );

                    return (
                      <section
                        key={modulo.key}
                        className="rounded-lg border border-slate-200 bg-slate-50"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <h3 className="text-base font-bold text-slate-900">
                              {modulo.label}
                            </h3>
                            <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                              {records.length} record
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              window.open(modulo.route, "_blank", "noopener")
                            }
                            className="text-xs font-semibold text-sky-700 underline"
                          >
                            Apri scadenzario
                          </button>
                        </div>

                        {records.length === 0 ? (
                          <div className="px-4 py-4 text-sm text-slate-500">
                            Nessun record collegato.
                          </div>
                        ) : (
                          <div className="space-y-3 p-3">
                            {records.map((record, recordIndex) => {
                              const fields = modulo.fields.filter(
                                (field) => field.key in record.draft
                              );
                              const changed =
                                Object.keys(changesFor(record)).length > 0;

                              return (
                                <div
                                  key={record.key}
                                  className={`rounded-md border bg-white p-3 ${
                                    changed
                                      ? "border-amber-300 ring-1 ring-amber-100"
                                      : "border-slate-200"
                                  }`}
                                >
                                  <div className="mb-3 flex items-center justify-between">
                                    <div className="text-xs font-semibold text-slate-600">
                                      {record.anno
                                        ? `Anno ${record.anno}`
                                        : records.length > 1
                                        ? `Record ${recordIndex + 1}`
                                        : "Record corrente"}
                                    </div>
                                    {changed && (
                                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                        Modificato
                                      </span>
                                    )}
                                  </div>

                                  {fields.length === 0 ? (
                                    <div className="text-sm text-slate-500">
                                      Record presente, ma nessun campo operativo
                                      configurato per la modifica cumulativa.
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                      {fields.map((field) => (
                                        <div
                                          key={field.key}
                                          className={
                                            field.type === "textarea"
                                              ? "md:col-span-2 xl:col-span-4"
                                              : ""
                                          }
                                        >
                                          <label className="mb-1 block text-xs font-semibold text-slate-700">
                                            {field.label}
                                          </label>
                                          {renderField(record, field)}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

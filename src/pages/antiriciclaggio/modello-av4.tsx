import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import TitolariEffettiviForm from "@/components/antiriciclaggio/TitolariEffettiviForm";

type ClienteOption = {
  id: string;
  rapp_legale_id: string | null;
  label: string;
};

type RappresentanteRow = {
  id?: string;
  nome_cognome?: string | null;
  codice_fiscale?: string | null;
  luogo_nascita?: string | null;
  data_nascita?: string | null;
  indirizzo_residenza?: string | null;
  citta_residenza?: string | null;
  cap_residenza?: string | null;
  nazionalita?: string | null;
};

type FormState = {
  studio_id: string;
  cliente_id: string;
  av1_id: string;
  rapp_legale_id: string;

  dichiarante_nome_cognome: string;
  dichiarante_codice_fiscale: string;
  dichiarante_luogo_nascita: string;
  dichiarante_data_nascita: string;
  dichiarante_indirizzo_residenza: string;
  dichiarante_citta_residenza: string;
  dichiarante_cap_residenza: string;
  dichiarante_nazionalita: string;

  natura_prestazione: string;

  domanda1: boolean;
  domanda2: boolean;

  domanda3: boolean;
  domanda4: boolean;
  domanda5: boolean;
  spec_domanda5: string;

  domanda6: boolean;
  domanda7: boolean;
  domanda8: boolean;
  domanda9: boolean;

  nome_soc: string;
  sede_legale: string;
  indirizzo_sede: string;
  reg_imprese: string;
  num_reg_imprese: string;
  cod_fiscale_soc: string;

  nome_soc_bis: string;
  sede_legale_bis: string;
  indirizzo_sede_bis: string;
  reg_imprese_bis: string;
  num_reg_imprese_bis: string;
  cod_fiscale_soc_bis: string;
  nome_soc_ter: string;

  domanda10: boolean;
  domanda11: boolean;
  specifica12: string;

  specifica10b: string;
  specifica10c: string;
  specifica11c: string;

  specifica10d: string;
  specifica10e: string;
  specifica10f: string;

  luogo_firma: string;
  data_firma: string;
  luogo_firma_bis: string;
  data_firma_bis: string;

  stato: string;
  versione: number;
};

const initialFormState = (studioId = "", av1Id = ""): FormState => ({
  studio_id: studioId,
  cliente_id: "",
  av1_id: av1Id,
  rapp_legale_id: "",

  dichiarante_nome_cognome: "",
  dichiarante_codice_fiscale: "",
  dichiarante_luogo_nascita: "",
  dichiarante_data_nascita: "",
  dichiarante_indirizzo_residenza: "",
  dichiarante_citta_residenza: "",
  dichiarante_cap_residenza: "",
  dichiarante_nazionalita: "",

  natura_prestazione: "",

  domanda1: false,
  domanda2: false,

  domanda3: false,
  domanda4: false,
  domanda5: false,
  spec_domanda5: "",

  domanda6: false,
  domanda7: false,
  domanda8: false,
  domanda9: false,

  nome_soc: "",
  sede_legale: "",
  indirizzo_sede: "",
  reg_imprese: "",
  num_reg_imprese: "",
  cod_fiscale_soc: "",

  nome_soc_bis: "",
  sede_legale_bis: "",
  indirizzo_sede_bis: "",
  reg_imprese_bis: "",
  num_reg_imprese_bis: "",
  cod_fiscale_soc_bis: "",
  nome_soc_ter: "",

  domanda10: false,
  domanda11: false,
  specifica12: "",

  specifica10b: "",
  specifica10c: "",
  specifica11c: "",

  specifica10d: "",
  specifica10e: "",
  specifica10f: "",

  luogo_firma: "",
  data_firma: "",
  luogo_firma_bis: "",
  data_firma_bis: "",

  stato: "bozza",
  versione: 1,
});

function normalizeDateForInput(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildClienteLabel(row: any): string {
  const parts = [
    row?.cognome_nome,
    row?.denominazione,
    row?.ragione_sociale,
    [row?.cognome, row?.nome].filter(Boolean).join(" ").trim(),
    row?.nome_cognome,
    row?.codice_fiscale,
    row?.email,
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  return parts[0] || `Cliente ${row?.id ?? ""}`;
}

export default function ModelloAV4() {

  const [clienti, setClienti] = useState<ClienteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClienti, setLoadingClienti] = useState(false);
  const [loadingRappresentante, setLoadingRappresentante] = useState(false);
  const [av4Id, setAv4Id] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    if (typeof window === "undefined") {
      return { studioId: "", av1Id: "", clienteId: "" };
    }

    const params = new URLSearchParams(window.location.search);

    return {
      studioId: params.get("studio_id") || "",
      av1Id: params.get("av1_id") || "",
      clienteId: params.get("cliente_id") || "",
    };
  }, []);

  const [form, setForm] = useState<FormState>(
    initialFormState(queryParams.studioId, queryParams.av1Id)
  );

  function clearRappresentanteFields() {
    setForm((prev) => ({
      ...prev,
      rapp_legale_id: "",
      dichiarante_nome_cognome: "",
      dichiarante_codice_fiscale: "",
      dichiarante_luogo_nascita: "",
      dichiarante_data_nascita: "",
      dichiarante_indirizzo_residenza: "",
      dichiarante_citta_residenza: "",
      dichiarante_cap_residenza: "",
      dichiarante_nazionalita: "",
    }));
  }

async function loadClienti() {
  const supabase = getSupabaseClient() as any;
  setLoadingClienti(true);

  try {
    const { data, error } = await supabase
      .from("tbclienti")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("Errore caricamento clienti:", error);
      return;
    }

    const rows = Array.isArray(data) ? data : [];

    const mapped: ClienteOption[] = rows.map((row: any) => ({
      id: String(row.id),
      rapp_legale_id: row?.rapp_legale_id ? String(row.rapp_legale_id) : null,
      label: buildClienteLabel(row),
    }));

    setClienti(mapped);
  } catch (error) {
    console.error("Errore imprevisto caricamento clienti:", error);
  } finally {
    setLoadingClienti(false);
  }
}

 async function loadRappresentanteDaCliente(clienteId: string) {
  if (!clienteId) {
    clearRappresentanteFields();
    return;
  }

  const supabase = getSupabaseClient() as any;
  setLoadingRappresentante(true);

  try {
    const { data: clienteRow, error: clienteError } = await supabase
      .from("tbclienti")
      .select("id, rapp_legale_id")
      .eq("id", clienteId)
      .single();

    if (clienteError) {
      console.error("Errore caricamento cliente:", clienteError);
      clearRappresentanteFields();
      return;
    }

    const rappLegaleId = clienteRow?.rapp_legale_id
      ? String(clienteRow.rapp_legale_id)
      : "";

    if (!rappLegaleId) {
      clearRappresentanteFields();
      return;
    }

    const { data: rappRow, error: rappError } = await (supabase as any)
      .from("rapp_legali")
      .select(`
        id,
        nome_cognome,
        codice_fiscale,
        luogo_nascita,
        data_nascita,
        indirizzo_residenza,
        citta_residenza,
        cap_residenza,
        nazionalita
      `)
      .eq("id", rappLegaleId)
      .single();

    if (rappError) {
      console.error("Errore caricamento rappresentante:", rappError);
      clearRappresentanteFields();
      return;
    }

    const row = (rappRow || {}) as RappresentanteRow;

    setForm((prev) => ({
      ...prev,
      rapp_legale_id: rappLegaleId,
      dichiarante_nome_cognome: row.nome_cognome ?? "",
      dichiarante_codice_fiscale: row.codice_fiscale ?? "",
      dichiarante_luogo_nascita: row.luogo_nascita ?? "",
      dichiarante_data_nascita: normalizeDateForInput(row.data_nascita),
      dichiarante_indirizzo_residenza: row.indirizzo_residenza ?? "",
      dichiarante_citta_residenza: row.citta_residenza ?? "",
      dichiarante_cap_residenza: row.cap_residenza ?? "",
      dichiarante_nazionalita: row.nazionalita ?? "",
    }));
  } catch (error) {
    console.error("Errore imprevisto caricamento rappresentante:", error);
    clearRappresentanteFields();
  } finally {
    setLoadingRappresentante(false);
  }
}

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      studio_id: queryParams.studioId,
      av1_id: queryParams.av1Id,
      cliente_id: queryParams.clienteId || prev.cliente_id,
    }));
  }, [queryParams.studioId, queryParams.av1Id, queryParams.clienteId]);

  useEffect(() => {
    void loadClienti();
  }, []);

  useEffect(() => {
    if (queryParams.clienteId) {
      setForm((prev) => ({
        ...prev,
        cliente_id: queryParams.clienteId,
      }));
    }
  }, [queryParams.clienteId]);

  useEffect(() => {
    if (!form.cliente_id) {
      clearRappresentanteFields();
      return;
    }

    void loadRappresentanteDaCliente(form.cliente_id);
  }, [form.cliente_id]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setForm((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "domanda5" && type === "checkbox" && !checked) {
        next.spec_domanda5 = "";
      }

      if (name === "domanda8" && type === "checkbox" && !checked) {
        next.nome_soc = "";
        next.sede_legale = "";
        next.indirizzo_sede = "";
        next.reg_imprese = "";
        next.num_reg_imprese = "";
        next.cod_fiscale_soc = "";
      }

      if (name === "domanda9" && type === "checkbox" && !checked) {
        next.nome_soc_bis = "";
        next.sede_legale_bis = "";
        next.indirizzo_sede_bis = "";
        next.reg_imprese_bis = "";
        next.num_reg_imprese_bis = "";
        next.cod_fiscale_soc_bis = "";
        next.nome_soc_ter = "";
      }

      if (name === "domanda11" && type === "checkbox" && !checked) {
        next.specifica12 = "";
      }

      return next;
    });
  }

  function handleClienteChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selectedId = e.target.value;

    setForm((prev) => ({
      ...prev,
      cliente_id: selectedId,
    }));
  }

  function validateBeforeSave() {
    if (!form.studio_id) {
      alert("Manca studio_id in querystring.");
      return false;
    }

    if (!form.av1_id) {
      alert("Manca av1_id in querystring.");
      return false;
    }

    if (!form.cliente_id) {
      alert("Seleziona il cliente.");
      return false;
    }

    if (!form.rapp_legale_id) {
      alert("Per il cliente selezionato non risulta un rappresentante collegato.");
      return false;
    }

    return true;
  }

 async function salvaAV4() {
  if (!validateBeforeSave()) return;

  const supabase = getSupabaseClient() as any;

  try {
    setLoading(true);

    const payload = {
      studio_id: form.studio_id,
      cliente_id: form.cliente_id,
      av1_id: Number(form.av1_id),
      rapp_legale_id: form.rapp_legale_id || null,

      dichiarante_nome_cognome: form.dichiarante_nome_cognome || null,
      dichiarante_codice_fiscale: form.dichiarante_codice_fiscale || null,
      dichiarante_luogo_nascita: form.dichiarante_luogo_nascita || null,
      dichiarante_data_nascita: form.dichiarante_data_nascita || null,
      dichiarante_indirizzo_residenza: form.dichiarante_indirizzo_residenza || null,
      dichiarante_citta_residenza: form.dichiarante_citta_residenza || null,
      dichiarante_cap_residenza: form.dichiarante_cap_residenza || null,
      dichiarante_nazionalita: form.dichiarante_nazionalita || null,

      natura_prestazione: form.natura_prestazione || null,

      domanda1: form.domanda1,
      domanda2: form.domanda2,
      domanda3: form.domanda3,
      domanda4: form.domanda4,
      domanda5: form.domanda5,
      spec_domanda5: form.spec_domanda5 || null,

      domanda6: form.domanda6,
      domanda7: form.domanda7,
      domanda8: form.domanda8,
      domanda9: form.domanda9,

      nome_soc: form.nome_soc || null,
      sede_legale: form.sede_legale || null,
      indirizzo_sede: form.indirizzo_sede || null,
      reg_imprese: form.reg_imprese || null,
      num_reg_imprese: form.num_reg_imprese || null,
      cod_fiscale_soc: form.cod_fiscale_soc || null,

      nome_soc_bis: form.nome_soc_bis || null,
      sede_legale_bis: form.sede_legale_bis || null,
      indirizzo_sede_bis: form.indirizzo_sede_bis || null,
      reg_imprese_bis: form.reg_imprese_bis || null,
      num_reg_imprese_bis: form.num_reg_imprese_bis || null,
      cod_fiscale_soc_bis: form.cod_fiscale_soc_bis || null,
      nome_soc_ter: form.nome_soc_ter || null,

      domanda10: form.domanda10,
      domanda11: form.domanda11,
      specifica12: form.specifica12 || null,

      specifica10b: form.specifica10b || null,
      specifica10c: form.specifica10c || null,
      specifica11c: form.specifica11c || null,

      specifica10d: form.specifica10d || null,
      specifica10e: form.specifica10e || null,
      specifica10f: form.specifica10f || null,

      luogo_firma: form.luogo_firma || null,
      data_firma: form.data_firma || null,
      luogo_firma_bis: form.luogo_firma_bis || null,
      data_firma_bis: form.data_firma_bis || null,

      stato: form.stato,
      versione: form.versione,
    };

    const { data, error } = await supabase
      .from("tbAV4")
      .insert([payload])
      .select("id")
      .single();

    if (error) {
      console.error("Errore salvataggio AV4:", error);
      alert("Errore durante il salvataggio");
      return;
    }

    setAv4Id(String(data.id));
    alert("AV4 salvato correttamente");
  } catch (error) {
    console.error("Errore imprevisto salvataggio AV4:", error);
    alert("Errore durante il salvataggio");
  } finally {
    setLoading(false);
  }
}

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-bold mb-2">AV.4 – Dichiarazione del Cliente</h1>

      <p className="mb-6 text-sm leading-6">
        In ottemperanza alle disposizioni dell’art. 22 del D.Lgs. 231/2007
        (obblighi del cliente in materia di prevenzione e contrasto al
        riciclaggio/FDT come da Nota 1 e 2 dell’Allegato alla presente
        Dichiarazione) e successive modifiche e integrazioni, fornisco le
        sottostanti informazioni, assumendomi tutte le responsabilità di natura
        civile, amministrativa e penale per dichiarazioni non veritiere.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-medium mb-1">Studio ID</label>
          <input
            name="studio_id"
            value={form.studio_id}
            onChange={handleChange}
            className="border p-2 w-full rounded bg-gray-50"
            readOnly
          />
        </div>

        <div>
          <label className="block font-medium mb-1">AV1 ID</label>
          <input
            name="av1_id"
            value={form.av1_id}
            onChange={handleChange}
            className="border p-2 w-full rounded bg-gray-50"
            readOnly
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block font-medium mb-1">Cliente</label>

        <select
          name="cliente_id"
          value={form.cliente_id}
          onChange={handleClienteChange}
          className="border p-2 w-full rounded"
        >
          <option value="">
            {loadingClienti ? "Caricamento clienti..." : "Seleziona cliente"}
          </option>

          {clienti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block font-medium mb-1">
          Rappresentante collegato al cliente
        </label>

        <input
          value={
            loadingRappresentante
              ? "Caricamento rappresentante..."
              : form.dichiarante_nome_cognome || "Nessun rappresentante collegato"
          }
          className="border p-2 w-full rounded bg-gray-50"
          readOnly
        />

        <p className="text-xs text-gray-500 mt-1">
          Il rappresentante viene recuperato automaticamente da
          <strong> tbclienti.rapp_legale_id </strong>
          e caricato dalla tabella
          <strong> rapp_legali</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-medium mb-1">Cognome e nome</label>
          <input
            name="dichiarante_nome_cognome"
            value={form.dichiarante_nome_cognome}
            onChange={handleChange}
            className="border p-2 w-full rounded bg-gray-50"
            readOnly
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Codice fiscale</label>
          <input
            name="dichiarante_codice_fiscale"
            value={form.dichiarante_codice_fiscale}
            onChange={handleChange}
            className="border p-2 w-full rounded bg-gray-50"
            readOnly
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Luogo di nascita</label>
          <input
            name="dichiarante_luogo_nascita"
            value={form.dichiarante_luogo_nascita}
            onChange={handleChange}
            className="border p-2 w-full rounded bg-gray-50"
            readOnly
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Data di nascita</label>
          <input
            name="dichiarante_data_nascita"
            value={form.dichiarante_data_nascita}
            onChange={handleChange}
            className="border p-2 w-full rounded bg-gray-50"
            readOnly
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Indirizzo residenza</label>
          <input
            name="dichiarante_indirizzo_residenza"
            value={form.dichiarante_indirizzo_residenza}
            onChange={handleChange}
            className="border p-2 w-full rounded bg-gray-50"
            readOnly
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Città residenza</label>
          <input
            name="dichiarante_citta_residenza"
            value={form.dichiarante_citta_residenza}
            onChange={handleChange}
            className="border p-2 w-full rounded bg-gray-50"
            readOnly
          />
        </div>

        <div>
          <label className="block font-medium mb-1">CAP residenza</label>
          <input
            name="dichiarante_cap_residenza"
            value={form.dichiarante_cap_residenza}
            onChange={handleChange}
            className="border p-2 w-full rounded bg-gray-50"
            readOnly
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Nazionalità</label>
          <input
            name="dichiarante_nazionalita"
            value={form.dichiarante_nazionalita}
            onChange={handleChange}
            className="border p-2 w-full rounded bg-gray-50"
            readOnly
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="domanda1"
            checked={form.domanda1}
            onChange={handleChange}
          />
          Dati di nascita e residenza come da documento di identificazione allegato
        </label>
      </div>

      <div className="mb-6">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="domanda2"
            checked={form.domanda2}
            onChange={handleChange}
          />
          Domicilio diverso rispetto al documento di identificazione allegato
        </label>
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-1">
          Che, ai sensi dell’art.18, comma 1, lettera c), D.Lgs. 231/2007, lo
          scopo e la natura della prestazione professionale richiesta sono
        </label>

        <textarea
          name="natura_prestazione"
          value={form.natura_prestazione}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          rows={4}
        />
      </div>

      <div className="mt-6 font-semibold mb-3">Persona politicamente esposta</div>

      <div className="mb-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="domanda3"
            checked={form.domanda3}
            onChange={handleChange}
          />
          di non costituire persona politicamente esposta (estera o nazionale),
          ai sensi dell’art. 1, comma 2, lettera dd), del D.Lgs. 231/2007 oppure
        </label>
      </div>

      <div className="mb-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="domanda4"
            checked={form.domanda4}
            onChange={handleChange}
          />
          di non rivestire lo status di PPE da più di un anno
        </label>
      </div>

      <div className="mb-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="domanda5"
            checked={form.domanda5}
            onChange={handleChange}
          />
          di costituire persona politicamente esposta estera o nazionale, ai
          sensi dell’art. 1, comma 2, lettera dd), del D.Lgs. 231/2007
        </label>
      </div>

      {form.domanda5 && (
        <div className="mb-6">
          <label className="block font-medium mb-1">
            Specificare carica pubblica, nome e legame con il titolare della
            carica pubblica
          </label>

          <textarea
            name="spec_domanda5"
            value={form.spec_domanda5}
            onChange={handleChange}
            className="border p-2 w-full rounded"
            rows={3}
          />
        </div>
      )}

      <div className="mt-6 mb-3 text-sm leading-6">
        - ai fini dell’identificazione del Titolare Effettivo di cui all’art. 1,
        comma 2, lettera pp) e ai criteri per la determinazione della titolarità
        effettiva di clienti diversi dalle persone fisiche di cui all’art. 20
        del D.Lgs. 231/2007, consapevole delle sanzioni penali previste
        dall’art. 55 del D.Lgs. 231/2007 nel caso di falsa indicazione delle
        generalità del soggetto per conto del quale eventualmente viene eseguita
        l’operazione, dichiara:
      </div>

      <div className="mb-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="domanda6"
            checked={form.domanda6}
            onChange={handleChange}
          />
          di agire in proprio e, quindi, l’inesistenza di un diverso titolare
          effettivo così come previsto e definito dal D.Lgs. 231/2007
        </label>
      </div>

      <div className="mb-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="domanda7"
            checked={form.domanda7}
            onChange={handleChange}
          />
          di agire per conto dei seguenti titolari effettivi
        </label>
      </div>

      {form.domanda7 && (
        <div className="mb-6 p-4 border rounded">
          {av4Id ? (
            <TitolariEffettiviForm
              sezione="domanda7"
              av4_id={av4Id}
              studio_id={form.studio_id}
              cliente_id={form.cliente_id}
            />
          ) : (
            <p className="text-sm text-gray-600">
              Salva prima l’AV4 per poter inserire i titolari effettivi della
              sezione Domanda 7.
            </p>
          )}
        </div>
      )}

      <div className="mb-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="domanda8"
            checked={form.domanda8}
            onChange={handleChange}
          />
          di agire per conto della società/ente
        </label>
      </div>

      {form.domanda8 && (
        <div className="mb-6 border rounded p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block font-medium mb-1">Nome società / ente</label>
              <input
                name="nome_soc"
                value={form.nome_soc}
                onChange={handleChange}
                className="border p-2 w-full rounded"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Sede legale</label>
              <input
                name="sede_legale"
                value={form.sede_legale}
                onChange={handleChange}
                className="border p-2 w-full rounded"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Indirizzo sede</label>
              <input
                name="indirizzo_sede"
                value={form.indirizzo_sede}
                onChange={handleChange}
                className="border p-2 w-full rounded"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Registro imprese</label>
              <input
                name="reg_imprese"
                value={form.reg_imprese}
                onChange={handleChange}
                className="border p-2 w-full rounded"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Numero registro imprese</label>
              <input
                name="num_reg_imprese"
                value={form.num_reg_imprese}
                onChange={handleChange}
                className="border p-2 w-full rounded"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Codice fiscale società</label>
              <input
                name="cod_fiscale_soc"
                value={form.cod_fiscale_soc}
                onChange={handleChange}
                className="border p-2 w-full rounded"
              />
            </div>
          </div>

          <div className="mb-3 text-sm">
            in qualità di legale rappresentante, munito dei necessari poteri, e
            attesta che il/i titolare/i effettivi sono:
          </div>

          {av4Id ? (
            <TitolariEffettiviForm
              sezione="domanda8"
              av4_id={av4Id}
              studio_id={form.studio_id}
              cliente_id={form.cliente_id}
            />
          ) : (
            <p className="text-sm text-gray-600">
              Salva prima l’AV4 per poter inserire i titolari effettivi della
              sezione Domanda 8.
            </p>
          )}
        </div>
      )}

      <div className="mb-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="domanda9"
            checked={form.domanda9}
            onChange={handleChange}
          />
          (caso residuale, in assenza di controllo o partecipazioni rilevanti) di
          agire per conto della società/ente
        </label>
      </div>

      {form.domanda9 && (
        <div className="mb-6 border rounded p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block font-medium mb-1">Nome società / ente</label>
              <input
                name="nome_soc_bis"
                value={form.nome_soc_bis}
                onChange={handleChange}
                className="border p-2 w-full rounded"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Sede legale</label>
              <input
                name="sede_legale_bis"
                value={form.sede_legale_bis}
                onChange={handleChange}
                className="border p-2 w-full rounded"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Indirizzo sede</label>
              <input
                name="indirizzo_sede_bis"
                value={form.indirizzo_sede_bis}
                onChange={handleChange}
                className="border p-2 w-full rounded"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Registro imprese</label>
              <input
                name="reg_imprese_bis"
                value={form.reg_imprese_bis}
                onChange={handleChange}
                className="border p-2 w-full rounded"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Numero registro imprese</label>
              <input
                name="num_reg_imprese_bis"
                value={form.num_reg_imprese_bis}
                onChange={handleChange}
                className="border p-2 w-full rounded"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Codice fiscale società</label>
              <input
                name="cod_fiscale_soc_bis"
                value={form.cod_fiscale_soc_bis}
                onChange={handleChange}
                className="border p-2 w-full rounded"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-medium mb-1">
                Denominazione società per art. 20, comma 4
              </label>
              <input
                name="nome_soc_ter"
                value={form.nome_soc_ter}
                onChange={handleChange}
                className="border p-2 w-full rounded"
              />
            </div>
          </div>

          <div className="mb-3 text-sm">
            in qualità di legale rappresentante, munito dei necessari poteri, e
            attesta che ai sensi dell’articolo 20, comma 4, D.Lgs. 231/2007, i
            titolari effettivi sono:
          </div>

          {av4Id ? (
            <TitolariEffettiviForm
              sezione="domanda9"
              av4_id={av4Id}
              studio_id={form.studio_id}
              cliente_id={form.cliente_id}
            />
          ) : (
            <p className="text-sm text-gray-600">
              Salva prima l’AV4 per poter inserire i titolari effettivi della
              sezione Domanda 9.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 font-semibold mb-3">PPE titolari effettivi</div>

      <div className="mb-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="domanda10"
            checked={form.domanda10}
            onChange={handleChange}
          />
          che il/i titolare/i effettivo/i non costituisce/costituiscono persona/e
          politicamente esposta/e
        </label>
      </div>

      <div className="mb-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="domanda11"
            checked={form.domanda11}
            onChange={handleChange}
          />
          che il/i titolari effettivi costituisce/costituiscono persona/e
          politicamente esposte estere o nazionali
        </label>
      </div>

      {form.domanda11 && (
        <div className="mb-6">
          <label className="block font-medium mb-1">
            Specifica PPE titolari effettivi
          </label>
          <textarea
            name="specifica12"
            value={form.specifica12}
            onChange={handleChange}
            className="border p-2 w-full rounded"
            rows={3}
          />
        </div>
      )}

      <div className="mt-6 mb-4">
        <label className="block font-medium mb-1">
          Che le relazioni intercorrenti tra il Cliente e il titolare effettivo
          nonché, ove rilevi, l’esecutore sono
        </label>
        <textarea
          name="specifica10b"
          value={form.specifica10b}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          rows={3}
        />
      </div>

      <div className="mb-4">
        <label className="block font-medium mb-1">
          Che la provenienza dei fondi utilizzati nell’operazione è
        </label>
        <textarea
          name="specifica10c"
          value={form.specifica10c}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          rows={3}
        />
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-1">
          Che i mezzi di pagamento forniti dal Cliente al professionista sono
        </label>
        <textarea
          name="specifica11c"
          value={form.specifica11c}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          rows={3}
        />
      </div>

      <div className="mb-6 text-sm leading-6">
        Che i medesimi fondi e le risorse economiche eventualmente utilizzati
        non provengono né sono destinati a un’attività criminosa o al
        finanziamento del terrorismo di cui all’art. 2, co. 6, del D.Lgs.
        231/2007.
      </div>

      <div className="mt-6 font-semibold mb-3">Professione / attività del cliente</div>

      <div className="mb-4">
        <label className="block font-medium mb-1">
          Che la professione/attività del cliente è la seguente
        </label>
        <input
          name="specifica10d"
          value={form.specifica10d}
          onChange={handleChange}
          className="border p-2 w-full rounded"
        />
      </div>

      <div className="mb-4">
        <label className="block font-medium mb-1">Esercitata / svolta dal</label>
        <input
          name="specifica10e"
          value={form.specifica10e}
          onChange={handleChange}
          className="border p-2 w-full rounded"
        />
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-1">Nell’ambito territoriale</label>
        <input
          name="specifica10f"
          value={form.specifica10f}
          onChange={handleChange}
          className="border p-2 w-full rounded"
        />
      </div>

      <div className="mt-6 font-semibold mb-3">Firma</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-medium mb-1">Luogo firma</label>
          <input
            name="luogo_firma"
            value={form.luogo_firma}
            onChange={handleChange}
            className="border p-2 w-full rounded"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Data firma</label>
          <input
            type="date"
            name="data_firma"
            value={form.data_firma}
            onChange={handleChange}
            className="border p-2 w-full rounded"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Luogo firma bis</label>
          <input
            name="luogo_firma_bis"
            value={form.luogo_firma_bis}
            onChange={handleChange}
            className="border p-2 w-full rounded"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Data firma bis</label>
          <input
            type="date"
            name="data_firma_bis"
            value={form.data_firma_bis}
            onChange={handleChange}
            className="border p-2 w-full rounded"
          />
        </div>
      </div>

      <button
        onClick={salvaAV4}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-5 py-2 rounded"
      >
        {loading ? "Salvataggio..." : "Salva AV4"}
      </button>

      {!av4Id && (
        <p className="mt-3 text-sm text-gray-600">
          Dopo il primo salvataggio verrà abilitato l’inserimento dei titolari
          effettivi nelle sezioni Domanda 7, 8 e 9.
        </p>
      )}

      {av4Id && (
        <p className="mt-3 text-sm text-green-700">
          AV4 salvato. ID pratica: {av4Id}
        </p>
      )}
    </div>
  );
}

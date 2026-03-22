import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PublicAv4FormState = {
  id: string;
  public_token: string;
  public_enabled: boolean;

  cliente_id: string;
  av1_id: string;
  studio_id: string;
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

  pdf_firmato_cliente: string;

  compilato_da_cliente: boolean;
  public_opened_at: string;
  public_submitted_at: string;
};

const emptyForm: PublicAv4FormState = {
  id: "",
  public_token: "",
  public_enabled: false,

  cliente_id: "",
  av1_id: "",
  studio_id: "",
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

  pdf_firmato_cliente: "",

  compilato_da_cliente: false,
  public_opened_at: "",
  public_submitted_at: "",
};

function normalizeDateForInput(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapRowToForm(row: any): PublicAv4FormState {
  return {
    id: String(row?.id ?? ""),
    public_token: row?.public_token ?? "",
    public_enabled: !!row?.public_enabled,

    cliente_id: row?.cliente_id ? String(row.cliente_id) : "",
    av1_id: row?.av1_id ? String(row.av1_id) : "",
    studio_id: row?.studio_id ?? "",
    rapp_legale_id: row?.rapp_legale_id ? String(row.rapp_legale_id) : "",

    dichiarante_nome_cognome: row?.dichiarante_nome_cognome ?? "",
    dichiarante_codice_fiscale: row?.dichiarante_codice_fiscale ?? "",
    dichiarante_luogo_nascita: row?.dichiarante_luogo_nascita ?? "",
    dichiarante_data_nascita: normalizeDateForInput(row?.dichiarante_data_nascita),
    dichiarante_indirizzo_residenza: row?.dichiarante_indirizzo_residenza ?? "",
    dichiarante_citta_residenza: row?.dichiarante_citta_residenza ?? "",
    dichiarante_cap_residenza: row?.dichiarante_cap_residenza ?? "",
    dichiarante_nazionalita: row?.dichiarante_nazionalita ?? "",

    natura_prestazione: row?.natura_prestazione ?? "",

    domanda1: !!row?.domanda1,
    domanda2: !!row?.domanda2,

    domanda3: !!row?.domanda3,
    domanda4: !!row?.domanda4,
    domanda5: !!row?.domanda5,
    spec_domanda5: row?.spec_domanda5 ?? "",

    domanda6: !!row?.domanda6,
    domanda7: !!row?.domanda7,
    domanda8: !!row?.domanda8,
    domanda9: !!row?.domanda9,

    nome_soc: row?.nome_soc ?? "",
    sede_legale: row?.sede_legale ?? "",
    indirizzo_sede: row?.indirizzo_sede ?? "",
    reg_imprese: row?.reg_imprese ?? "",
    num_reg_imprese: row?.num_reg_imprese ?? "",
    cod_fiscale_soc: row?.cod_fiscale_soc ?? "",

    nome_soc_bis: row?.nome_soc_bis ?? "",
    sede_legale_bis: row?.sede_legale_bis ?? "",
    indirizzo_sede_bis: row?.indirizzo_sede_bis ?? "",
    reg_imprese_bis: row?.reg_imprese_bis ?? "",
    num_reg_imprese_bis: row?.num_reg_imprese_bis ?? "",
    cod_fiscale_soc_bis: row?.cod_fiscale_soc_bis ?? "",
    nome_soc_ter: row?.nome_soc_ter ?? "",

    domanda10: !!row?.domanda10,
    domanda11: !!row?.domanda11,
    specifica12: row?.specifica12 ?? "",

    specifica10b: row?.specifica10b ?? "",
    specifica10c: row?.specifica10c ?? "",
    specifica11c: row?.specifica11c ?? "",

    specifica10d: row?.specifica10d ?? "",
    specifica10e: row?.specifica10e ?? "",
    specifica10f: row?.specifica10f ?? "",

    luogo_firma: row?.luogo_firma ?? "",
    data_firma: normalizeDateForInput(row?.data_firma),
    luogo_firma_bis: row?.luogo_firma_bis ?? "",
    data_firma_bis: normalizeDateForInput(row?.data_firma_bis),

    pdf_firmato_cliente: row?.pdf_firmato_cliente ?? "",

    compilato_da_cliente: !!row?.compilato_da_cliente,
    public_opened_at: row?.public_opened_at ?? "",
    public_submitted_at: row?.public_submitted_at ?? "",
  };
}

export default function PublicAV4Page() {
  const router = useRouter();
  const token = useMemo(
    () => (typeof router.query.token === "string" ? router.query.token : ""),
    [router.query.token]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [disabledLink, setDisabledLink] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [signedPdfUrl, setSignedPdfUrl] = useState("");
  const [form, setForm] = useState<PublicAv4FormState>(emptyForm);

  useEffect(() => {
    if (!router.isReady || !token) return;

    const load = async () => {
      const supabase = getSupabaseClient() as any;
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("tbAV4")
          .select("*")
          .eq("public_token", token)
          .maybeSingle();

        if (error) {
          console.error("Errore caricamento AV4 pubblico:", error);
          setNotFound(true);
          return;
        }

        if (!data) {
          setNotFound(true);
          return;
        }

        if (!data.public_enabled) {
          setDisabledLink(true);
          return;
        }

        const mapped = mapRowToForm(data);
        setForm(mapped);
        setSignedPdfUrl(mapped.pdf_firmato_cliente || "");

        if (mapped.compilato_da_cliente) {
          setAlreadySubmitted(true);
        }

        if (!mapped.public_opened_at) {
          await supabase
            .from("tbAV4")
            .update({
              public_opened_at: new Date().toISOString(),
            })
            .eq("id", mapped.id);
        }
      } catch (err) {
        console.error("Errore imprevisto AV4 pubblico:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router.isReady, token]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setForm((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      if (type === "checkbox" && name === "domanda1" && checked) {
        next.domanda2 = false;
      }
      if (type === "checkbox" && name === "domanda2" && checked) {
        next.domanda1 = false;
      }

      if (type === "checkbox" && name === "domanda3" && checked) {
        next.domanda4 = false;
        next.domanda5 = false;
        next.spec_domanda5 = "";
      }

      if (type === "checkbox" && name === "domanda4" && checked) {
        next.domanda3 = false;
        next.domanda5 = false;
        next.spec_domanda5 = "";
      }

      if (type === "checkbox" && name === "domanda5" && checked) {
        next.domanda3 = false;
        next.domanda4 = false;
      }

      if (name === "domanda5" && type === "checkbox" && !checked) {
        next.spec_domanda5 = "";
      }

      if (type === "checkbox" && name === "domanda10" && checked) {
        next.domanda11 = false;
        next.specifica12 = "";
      }

      if (type === "checkbox" && name === "domanda11" && checked) {
        next.domanda10 = false;
      }

      if (name === "domanda11" && type === "checkbox" && !checked) {
        next.specifica12 = "";
      }

      return next;
    });
  }

  function handlePrintPdf() {
    window.print();
  }

  async function handleUploadSignedPdf(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file || !form.id) return;

    if (file.type !== "application/pdf") {
      alert("Seleziona un file PDF.");
      return;
    }

    const supabase = getSupabaseClient() as any;

    try {
      setUploadingPdf(true);

      const filePath = `av4-firmati/${form.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("documenti")
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) {
        console.error("Errore upload PDF firmato:", uploadError);
        alert("Errore durante il caricamento del PDF firmato.");
        return;
      }

      const { data } = supabase.storage.from("documenti").getPublicUrl(filePath);
      const publicUrl = data?.publicUrl || "";

      const { error: updateError } = await supabase
        .from("tbAV4")
        .update({
          pdf_firmato_cliente: publicUrl,
        })
        .eq("id", form.id)
        .eq("public_token", token);

      if (updateError) {
        console.error("Errore salvataggio URL PDF firmato:", updateError);
        alert("PDF caricato ma non salvato correttamente.");
        return;
      }

      setSignedPdfUrl(publicUrl);
      setForm((prev) => ({
        ...prev,
        pdf_firmato_cliente: publicUrl,
      }));

      alert("PDF firmato caricato correttamente.");
    } catch (error) {
      console.error("Errore upload PDF firmato:", error);
      alert("Errore durante il caricamento del PDF firmato.");
    } finally {
      setUploadingPdf(false);
      e.target.value = "";
    }
  }

  async function handleSubmit() {
    if (!form.id) {
      alert("AV4 non trovato.");
      return;
    }

    const supabase = getSupabaseClient() as any;

    try {
      setSaving(true);

      const payload = {
        natura_prestazione: form.natura_prestazione || null,

        domanda1: !!form.domanda1,
        domanda2: !!form.domanda2,

        domanda3: !!form.domanda3,
        domanda4: !!form.domanda4,
        domanda5: !!form.domanda5,
        spec_domanda5: form.spec_domanda5 || null,

        domanda10: !!form.domanda10,
        domanda11: !!form.domanda11,
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

        compilato_da_cliente: true,
        public_submitted_at: new Date().toISOString(),
        public_enabled: false,
      };

      const { error } = await supabase
        .from("tbAV4")
        .update(payload)
        .eq("id", form.id)
        .eq("public_token", token);

      if (error) {
        console.error("Errore salvataggio pubblico AV4:", error);
        alert("Errore durante il salvataggio.");
        return;
      }

      setAlreadySubmitted(true);
      setDisabledLink(true);
      alert("AV4 completato correttamente. Il link non è più riutilizzabile.");
    } catch (err) {
      console.error("Errore imprevisto salvataggio pubblico:", err);
      alert("Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardContent className="py-10 text-center text-slate-600">
              Caricamento AV4...
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Link non valido</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-700">
              Il collegamento AV4 non esiste oppure non è più disponibile.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (disabledLink && !alreadySubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Link disattivato</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-700">
              Questo collegamento AV4 è stato disattivato.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Modello AV4 pubblico</CardTitle>
            <p className="text-sm text-slate-600">
              Dichiarazione del cliente compilabile tramite collegamento riservato.
            </p>
          </CardHeader>

          <CardContent>
            {alreadySubmitted && (
              <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Questo AV4 risulta già completato. Il link non è più riutilizzabile.
              </div>
            )}

            <div id="print-area" className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Cognome e nome</label>
                  <input
                    name="dichiarante_nome_cognome"
                    value={form.dichiarante_nome_cognome}
                    readOnly
                    className="w-full rounded-md border bg-slate-50 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Codice fiscale</label>
                  <input
                    name="dichiarante_codice_fiscale"
                    value={form.dichiarante_codice_fiscale}
                    readOnly
                    className="w-full rounded-md border bg-slate-50 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Luogo di nascita</label>
                  <input
                    name="dichiarante_luogo_nascita"
                    value={form.dichiarante_luogo_nascita}
                    readOnly
                    className="w-full rounded-md border bg-slate-50 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Data di nascita</label>
                  <input
                    type="date"
                    name="dichiarante_data_nascita"
                    value={form.dichiarante_data_nascita}
                    readOnly
                    className="w-full rounded-md border bg-slate-50 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Indirizzo residenza</label>
                  <input
                    name="dichiarante_indirizzo_residenza"
                    value={form.dichiarante_indirizzo_residenza}
                    readOnly
                    className="w-full rounded-md border bg-slate-50 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Città residenza</label>
                  <input
                    name="dichiarante_citta_residenza"
                    value={form.dichiarante_citta_residenza}
                    readOnly
                    className="w-full rounded-md border bg-slate-50 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Natura della prestazione
                </label>
                <textarea
                  name="natura_prestazione"
                  value={form.natura_prestazione}
                  onChange={handleChange}
                  rows={4}
                  className="w-full rounded-md border px-3 py-2"
                  disabled={alreadySubmitted}
                />
              </div>

              <div className="space-y-3">
                <div className="font-semibold">Dichiarazioni cliente</div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="domanda1"
                    checked={form.domanda1}
                    onChange={handleChange}
                    disabled={alreadySubmitted}
                  />
                  Dati di nascita e residenza come da documento di identificazione allegato
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="domanda2"
                    checked={form.domanda2}
                    onChange={handleChange}
                    disabled={alreadySubmitted}
                  />
                  Domicilio diverso rispetto al documento di identificazione allegato
                </label>
              </div>

              <div className="space-y-3">
                <div className="font-semibold">Persona politicamente esposta</div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="domanda3"
                    checked={form.domanda3}
                    onChange={handleChange}
                    disabled={alreadySubmitted}
                  />
                  Non costituisce persona politicamente esposta
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="domanda4"
                    checked={form.domanda4}
                    onChange={handleChange}
                    disabled={alreadySubmitted}
                  />
                  Non riveste lo status di PPE da più di un anno
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="domanda5"
                    checked={form.domanda5}
                    onChange={handleChange}
                    disabled={alreadySubmitted}
                  />
                  Costituisce persona politicamente esposta
                </label>

                {form.domanda5 && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Specifica PPE
                    </label>
                    <textarea
                      name="spec_domanda5"
                      value={form.spec_domanda5}
                      onChange={handleChange}
                      rows={3}
                      className="w-full rounded-md border px-3 py-2"
                      disabled={alreadySubmitted}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="font-semibold">PPE titolari effettivi</div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="domanda10"
                    checked={form.domanda10}
                    onChange={handleChange}
                    disabled={alreadySubmitted}
                  />
                  Il titolare effettivo non è persona politicamente esposta
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="domanda11"
                    checked={form.domanda11}
                    onChange={handleChange}
                    disabled={alreadySubmitted}
                  />
                  Il titolare effettivo è persona politicamente esposta
                </label>

                {form.domanda11 && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Specifica PPE titolari effettivi
                    </label>
                    <textarea
                      name="specifica12"
                      value={form.specifica12}
                      onChange={handleChange}
                      rows={3}
                      className="w-full rounded-md border px-3 py-2"
                      disabled={alreadySubmitted}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Relazioni tra cliente e titolare effettivo
                </label>
                <textarea
                  name="specifica10b"
                  value={form.specifica10b}
                  onChange={handleChange}
                  rows={3}
                  className="w-full rounded-md border px-3 py-2"
                  disabled={alreadySubmitted}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Provenienza dei fondi
                </label>
                <textarea
                  name="specifica10c"
                  value={form.specifica10c}
                  onChange={handleChange}
                  rows={3}
                  className="w-full rounded-md border px-3 py-2"
                  disabled={alreadySubmitted}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Mezzi di pagamento
                </label>
                <textarea
                  name="specifica11c"
                  value={form.specifica11c}
                  onChange={handleChange}
                  rows={3}
                  className="w-full rounded-md border px-3 py-2"
                  disabled={alreadySubmitted}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Professione / attività
                  </label>
                  <input
                    name="specifica10d"
                    value={form.specifica10d}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2"
                    disabled={alreadySubmitted}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Esercitata / svolta dal
                  </label>
                  <input
                    name="specifica10e"
                    value={form.specifica10e}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2"
                    disabled={alreadySubmitted}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Ambito territoriale
                  </label>
                  <input
                    name="specifica10f"
                    value={form.specifica10f}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2"
                    disabled={alreadySubmitted}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Luogo firma</label>
                  <input
                    name="luogo_firma"
                    value={form.luogo_firma}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2"
                    disabled={alreadySubmitted}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Data firma</label>
                  <input
                    type="date"
                    name="data_firma"
                    value={form.data_firma}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2"
                    disabled={alreadySubmitted}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Luogo firma bis</label>
                  <input
                    name="luogo_firma_bis"
                    value={form.luogo_firma_bis}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2"
                    disabled={alreadySubmitted}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Data firma bis</label>
                  <input
                    type="date"
                    name="data_firma_bis"
                    value={form.data_firma_bis}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2"
                    disabled={alreadySubmitted}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">Carica PDF firmato</label>

                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleUploadSignedPdf}
                  disabled={alreadySubmitted}
                  className="block w-full rounded-md border px-3 py-2"
                />

                {uploadingPdf && (
                  <p className="text-sm text-slate-600">Caricamento PDF firmato...</p>
                )}

                {signedPdfUrl && (
                  <a
                    href={signedPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sky-700 underline"
                  >
                    Apri PDF firmato caricato
                  </a>
                )}
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="rounded-md border border-slate-300 bg-white px-5 py-3 text-slate-700 shadow hover:bg-slate-50"
                >
                  Stampa / Salva PDF
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || alreadySubmitted}
                  className="rounded-md bg-sky-600 px-5 py-3 text-white shadow hover:bg-sky-700 disabled:opacity-50"
                >
                  {saving ? "Salvataggio..." : "Salva e chiudi"}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          button,
          input[type="file"] {
            display: none !important;
          }

          .shadow,
          .shadow-sm {
            box-shadow: none !important;
          }

          .bg-slate-50,
          .bg-white {
            background: white !important;
          }

          .border {
            border-color: #d1d5db !important;
          }
        }
      `}</style>
    </div>
  );
}

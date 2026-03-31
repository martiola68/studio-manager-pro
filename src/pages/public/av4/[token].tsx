import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import TitolariEffettiviForm from "@/components/antiriciclaggio/TitolariEffettiviForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FormState = {
  id: string;
  public_token: string;
  public_enabled: boolean;

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

  compilato_da_cliente: boolean;
  public_opened_at: string;
  public_submitted_at: string;
  pdf_firmato_cliente: string;
};

const emptyForm: FormState = {
  id: "",
  public_token: "",
  public_enabled: false,

  studio_id: "",
  cliente_id: "",
  av1_id: "",
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

  compilato_da_cliente: false,
  public_opened_at: "",
  public_submitted_at: "",
  pdf_firmato_cliente: "",
};

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

function mapDbRowToForm(row: any): FormState {
  return {
    id: String(row?.id ?? ""),
    public_token: row?.public_token ?? "",
    public_enabled: !!row?.public_enabled,

    studio_id: row?.studio_id ?? "",
    cliente_id: row?.cliente_id ? String(row.cliente_id) : "",
    av1_id: row?.av1_id != null ? String(row.av1_id) : "",
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

    stato: row?.stato ?? "bozza",
    versione: Number(row?.versione ?? 1),

    compilato_da_cliente: !!row?.compilato_da_cliente,
    public_opened_at: row?.public_opened_at ?? "",
    public_submitted_at: row?.public_submitted_at ?? "",
    pdf_firmato_cliente: row?.pdf_firmato_cliente ?? "",
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
  const [av4Id, setAv4Id] = useState<string | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);

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

        if (!data.public_enabled && !data.compilato_da_cliente) {
          setDisabledLink(true);
          return;
        }

               const mapped = mapDbRowToForm(data);
        setForm(mapped);
        setAv4Id(mapped.id);
        setSignedPdfUrl(mapped.pdf_firmato_cliente || "");

        if (mapped.compilato_da_cliente || mapped.public_submitted_at) {
          setAlreadySubmitted(true);
          setDisabledLink(true);
          return;
        }

        if (!mapped.public_opened_at && mapped.id) {
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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
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

      if (type === "checkbox" && name === "domanda6" && checked) {
        next.domanda7 = false;
        next.domanda8 = false;
        next.domanda9 = false;

        next.nome_soc = "";
        next.sede_legale = "";
        next.indirizzo_sede = "";
        next.reg_imprese = "";
        next.num_reg_imprese = "";
        next.cod_fiscale_soc = "";

        next.nome_soc_bis = "";
        next.sede_legale_bis = "";
        next.indirizzo_sede_bis = "";
        next.reg_imprese_bis = "";
        next.num_reg_imprese_bis = "";
        next.cod_fiscale_soc_bis = "";
        next.nome_soc_ter = "";
      }

      if (type === "checkbox" && name === "domanda7" && checked) {
        next.domanda6 = false;
        next.domanda8 = false;
        next.domanda9 = false;

        next.nome_soc = "";
        next.sede_legale = "";
        next.indirizzo_sede = "";
        next.reg_imprese = "";
        next.num_reg_imprese = "";
        next.cod_fiscale_soc = "";

        next.nome_soc_bis = "";
        next.sede_legale_bis = "";
        next.indirizzo_sede_bis = "";
        next.reg_imprese_bis = "";
        next.num_reg_imprese_bis = "";
        next.cod_fiscale_soc_bis = "";
        next.nome_soc_ter = "";
      }

      if (type === "checkbox" && name === "domanda8" && checked) {
        next.domanda6 = false;
        next.domanda7 = false;
        next.domanda9 = false;

        next.nome_soc_bis = "";
        next.sede_legale_bis = "";
        next.indirizzo_sede_bis = "";
        next.reg_imprese_bis = "";
        next.num_reg_imprese_bis = "";
        next.cod_fiscale_soc_bis = "";
        next.nome_soc_ter = "";
      }

      if (type === "checkbox" && name === "domanda9" && checked) {
        next.domanda6 = false;
        next.domanda7 = false;
        next.domanda8 = false;

        next.nome_soc = "";
        next.sede_legale = "";
        next.indirizzo_sede = "";
        next.reg_imprese = "";
        next.num_reg_imprese = "";
        next.cod_fiscale_soc = "";
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
        .upload(filePath, file, { upsert: true });

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

  async function validateTitolariPrimaDelSalvataggio() {
    if (!av4Id) return;

    const supabase = getSupabaseClient() as any;
    const sezioniDaControllare: Array<"domanda7" | "domanda8" | "domanda9"> = [];

    if (form.domanda7) sezioniDaControllare.push("domanda7");
    if (form.domanda8) sezioniDaControllare.push("domanda8");
    if (form.domanda9) sezioniDaControllare.push("domanda9");

    for (const sezione of sezioniDaControllare) {
      const { data, error } = await supabase
        .from("tbAV4_titolari")
        .select("*")
        .eq("av4_id", av4Id)
        .eq("sezione", sezione);

      if (error) {
        throw new Error(`Errore caricamento titolari ${sezione}.`);
      }

      const titolari = data || [];

      if (!titolari.length) {
        throw new Error(`Inserire e salvare almeno un titolare effettivo per la sezione ${sezione}.`);
      }

      for (let i = 0; i < titolari.length; i++) {
        const titolare = titolari[i];

        if (!titolare?.codice_fiscale || !String(titolare.codice_fiscale).trim()) {
          throw new Error(
            `Codice fiscale obbligatorio per il titolare effettivo #${i + 1} della sezione ${sezione}.`
          );
        }
      }
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

      await validateTitolariPrimaDelSalvataggio();

      const payload = {
        natura_prestazione: form.natura_prestazione || null,

        domanda1: !!form.domanda1,
        domanda2: !!form.domanda2,
        domanda3: !!form.domanda3,
        domanda4: !!form.domanda4,
        domanda5: !!form.domanda5,
        spec_domanda5: form.spec_domanda5 || null,

        domanda6: !!form.domanda6,
        domanda7: !!form.domanda7,
        domanda8: !!form.domanda8,
        domanda9: !!form.domanda9,

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
    } catch (err: any) {
      console.error("Errore imprevisto salvataggio pubblico:", err);
      alert(err?.message || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-5xl">
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
        <div className="mx-auto max-w-5xl">
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

   if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <Card>
            <CardHeader>
              <CardTitle>Compilazione completata</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-700">
              Questo AV4 è già stato completato. Il collegamento non è più riutilizzabile.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (disabledLink) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-5xl">
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
      <div className="mx-auto max-w-5xl">
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
              <Card>
                <CardHeader>
                  <CardTitle>Dati principali</CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="mb-6 text-sm leading-6 text-gray-700">
                    In ottemperanza alle disposizioni dell’art. 22 del D.Lgs. 231/2007
                    (obblighi del cliente in materia di prevenzione e contrasto al
                    riciclaggio/FDT come da Nota 1 e 2 dell’Allegato alla presente
                    Dichiarazione) e successive modifiche e integrazioni, fornisco le
                    sottostanti informazioni, assumendomi tutte le responsabilità di natura
                    civile, amministrativa e penale per dichiarazioni non veritiere.
                  </p>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium">Cognome e nome</label>
                        <input
                          name="dichiarante_nome_cognome"
                          value={form.dichiarante_nome_cognome}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-gray-50 px-3 py-2"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">Codice fiscale</label>
                        <input
                          name="dichiarante_codice_fiscale"
                          value={form.dichiarante_codice_fiscale}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-gray-50 px-3 py-2"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">Luogo di nascita</label>
                        <input
                          name="dichiarante_luogo_nascita"
                          value={form.dichiarante_luogo_nascita}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-gray-50 px-3 py-2"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">Data di nascita</label>
                        <input
                          type="date"
                          name="dichiarante_data_nascita"
                          value={form.dichiarante_data_nascita}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-gray-50 px-3 py-2"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">Indirizzo residenza</label>
                        <input
                          name="dichiarante_indirizzo_residenza"
                          value={form.dichiarante_indirizzo_residenza}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-gray-50 px-3 py-2"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">Città residenza</label>
                        <input
                          name="dichiarante_citta_residenza"
                          value={form.dichiarante_citta_residenza}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-gray-50 px-3 py-2"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">CAP residenza</label>
                        <input
                          name="dichiarante_cap_residenza"
                          value={form.dichiarante_cap_residenza}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-gray-50 px-3 py-2"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">Nazionalità</label>
                        <input
                          name="dichiarante_nazionalita"
                          value={form.dichiarante_nazionalita}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-gray-50 px-3 py-2"
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Dichiarazioni del cliente</CardTitle>
                </CardHeader>

                <CardContent>
                  <div className="space-y-6">
                    <div>
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
                    </div>

                    <div>
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

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Che, ai sensi dell’art.18, comma 1, lettera c), D.Lgs. 231/2007, lo scopo e la natura
                        della prestazione professionale richiesta sono
                      </label>
                      <textarea
                        name="natura_prestazione"
                        value={form.natura_prestazione}
                        onChange={handleChange}
                        className="w-full rounded-md border px-3 py-2"
                        rows={4}
                        disabled={alreadySubmitted}
                      />
                    </div>

                    <div className="font-semibold">Persona politicamente esposta</div>

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="domanda3"
                          checked={form.domanda3}
                          onChange={handleChange}
                          disabled={alreadySubmitted}
                        />
                        di non costituire persona politicamente esposta (estera o nazionale), ai sensi
                        dell’art. 1, comma 2, lettera dd), del D.Lgs. 231/2007 oppure
                      </label>
                    </div>

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="domanda4"
                          checked={form.domanda4}
                          onChange={handleChange}
                          disabled={alreadySubmitted}
                        />
                        di non rivestire lo status di PPE da più di un anno
                      </label>
                    </div>

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="domanda5"
                          checked={form.domanda5}
                          onChange={handleChange}
                          disabled={alreadySubmitted}
                        />
                        di costituire persona politicamente esposta estera o nazionale, ai sensi
                        dell’art. 1, comma 2, lettera dd), del D.Lgs. 231/2007
                      </label>
                    </div>

                    {form.domanda5 && (
                      <div>
                        <label className="mb-1 block text-sm font-medium">
                          Specificare carica pubblica, nome e legame con il titolare della carica pubblica
                        </label>
                        <textarea
                          name="spec_domanda5"
                          value={form.spec_domanda5}
                          onChange={handleChange}
                          className="w-full rounded-md border px-3 py-2"
                          rows={3}
                          disabled={alreadySubmitted}
                        />
                      </div>
                    )}

                    <div className="text-sm leading-6 text-gray-700">
                      - ai fini dell’identificazione del Titolare Effettivo di cui all’art. 1, comma 2,
                      lettera pp) e ai criteri per la determinazione della titolarità effettiva di clienti
                      diversi dalle persone fisiche di cui all’art. 20 del D.Lgs. 231/2007, consapevole
                      delle sanzioni penali previste dall’art. 55 del D.Lgs. 231/2007 nel caso di falsa
                      indicazione delle generalità del soggetto per conto del quale eventualmente viene
                      eseguita l’operazione, dichiara:
                    </div>

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="domanda6"
                          checked={form.domanda6}
                          onChange={handleChange}
                          disabled={alreadySubmitted}
                        />
                        di agire in proprio e, quindi, l’inesistenza di un diverso titolare effettivo così
                        come previsto e definito dal D.Lgs. 231/2007
                      </label>
                    </div>

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="domanda7"
                          checked={form.domanda7}
                          onChange={handleChange}
                          disabled={alreadySubmitted}
                        />
                        di agire per conto dei seguenti titolari effettivi
                      </label>
                    </div>

                    {form.domanda7 && (
                      <div className="rounded-lg border p-4">
                        <TitolariEffettiviForm
                          sezione="domanda7"
                          av4_id={av4Id || ""}
                          studio_id={form.studio_id}
                          cliente_id={form.cliente_id}
                        />
                      </div>
                    )}

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="domanda8"
                          checked={form.domanda8}
                          onChange={handleChange}
                          disabled={alreadySubmitted}
                        />
                        di agire per conto della società/ente
                      </label>
                    </div>

                    {form.domanda8 && (
                      <div className="space-y-4 rounded-lg border p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium">Nome società / ente</label>
                            <input
                              name="nome_soc"
                              value={form.nome_soc}
                              onChange={handleChange}
                              className="w-full rounded-md border px-3 py-2"
                              disabled={alreadySubmitted}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">Sede legale</label>
                            <input
                              name="sede_legale"
                              value={form.sede_legale}
                              onChange={handleChange}
                              className="w-full rounded-md border px-3 py-2"
                              disabled={alreadySubmitted}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">Indirizzo sede</label>
                            <input
                              name="indirizzo_sede"
                              value={form.indirizzo_sede}
                              onChange={handleChange}
                              className="w-full rounded-md border px-3 py-2"
                              disabled={alreadySubmitted}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">Registro imprese</label>
                            <input
                              name="reg_imprese"
                              value={form.reg_imprese}
                              onChange={handleChange}
                              className="w-full rounded-md border px-3 py-2"
                              disabled={alreadySubmitted}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">Numero registro imprese</label>
                            <input
                              name="num_reg_imprese"
                              value={form.num_reg_imprese}
                              onChange={handleChange}
                              className="w-full rounded-md border px-3 py-2"
                              disabled={alreadySubmitted}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">Codice fiscale società</label>
                            <input
                              name="cod_fiscale_soc"
                              value={form.cod_fiscale_soc}
                              onChange={handleChange}
                              className="w-full rounded-md border px-3 py-2"
                              disabled={alreadySubmitted}
                            />
                          </div>
                        </div>

                        <div className="text-sm">
                          in qualità di legale rappresentante, munito dei necessari poteri, e attesta che il/i titolare/i effettivi sono:
                        </div>

                        <div className="rounded-lg border p-4">
                          <TitolariEffettiviForm
                            sezione="domanda8"
                            av4_id={av4Id || ""}
                            studio_id={form.studio_id}
                            cliente_id={form.cliente_id}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="domanda9"
                          checked={form.domanda9}
                          onChange={handleChange}
                          disabled={alreadySubmitted}
                        />
                        (caso residuale, in assenza di controllo o partecipazioni rilevanti) di agire per conto della società/ente
                      </label>
                    </div>

                    {form.domanda9 && (
                      <div className="space-y-4 rounded-lg border p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium">Nome società / ente</label>
                            <input
                              name="nome_soc_bis"
                              value={form.nome_soc_bis}
                              onChange={handleChange}
                              className="w-full rounded-md border px-3 py-2"
                              disabled={alreadySubmitted}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">Sede legale</label>
                            <input
                              name="sede_legale_bis"
                              value={form.sede_legale_bis}
                              onChange={handleChange}
                              className="w-full rounded-md border px-3 py-2"
                              disabled={alreadySubmitted}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">Indirizzo sede</label>
                            <input
                              name="indirizzo_sede_bis"
                              value={form.indirizzo_sede_bis}
                              onChange={handleChange}
                              className="w-full rounded-md border px-3 py-2"
                              disabled={alreadySubmitted}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">Registro imprese</label>
                            <input
                              name="reg_imprese_bis"
                              value={form.reg_imprese_bis}
                              onChange={handleChange}
                              className="w-full rounded-md border px-3 py-2"
                              disabled={alreadySubmitted}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">Numero registro imprese</label>
                            <input
                              name="num_reg_imprese_bis"
                              value={form.num_reg_imprese_bis}
                              onChange={handleChange}
                              className="w-full rounded-md border px-3 py-2"
                              disabled={alreadySubmitted}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">Codice fiscale società</label>
                            <input
                              name="cod_fiscale_soc_bis"
                              value={form.cod_fiscale_soc_bis}
                              onChange={handleChange}
                              className="w-full rounded-md border px-3 py-2"
                              disabled={alreadySubmitted}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium">
                              Denominazione società per art. 20, comma 4
                            </label>
                            <input
                              name="nome_soc_ter"
                              value={form.nome_soc_ter}
                              onChange={handleChange}
                              className="w-full rounded-md border px-3 py-2"
                              disabled={alreadySubmitted}
                            />
                          </div>
                        </div>

                        <div className="text-sm">
                          in qualità di legale rappresentante, munito dei necessari poteri, e attesta che ai sensi dell’articolo 20, comma 4, D.Lgs. 231/2007, i titolari effettivi sono:
                        </div>

                        <div className="rounded-lg border p-4">
                          <TitolariEffettiviForm
                            sezione="domanda9"
                            av4_id={av4Id || ""}
                            studio_id={form.studio_id}
                            cliente_id={form.cliente_id}
                          />
                        </div>
                      </div>
                    )}

                    <div className="font-semibold">PPE titolari effettivi</div>

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="domanda10"
                          checked={form.domanda10}
                          onChange={handleChange}
                          disabled={alreadySubmitted}
                        />
                        che il/i titolare/i effettivo/i non costituisce/costituiscono persona/e politicamente esposta/e
                      </label>
                    </div>

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="domanda11"
                          checked={form.domanda11}
                          onChange={handleChange}
                          disabled={alreadySubmitted}
                        />
                        che il/i titolari effettivi costituisce/costituiscono persona/e politicamente esposte estere o nazionali
                      </label>
                    </div>

                    {form.domanda11 && (
                      <div>
                        <label className="mb-1 block text-sm font-medium">Specifica PPE titolari effettivi</label>
                        <textarea
                          name="specifica12"
                          value={form.specifica12}
                          onChange={handleChange}
                          className="w-full rounded-md border px-3 py-2"
                          rows={3}
                          disabled={alreadySubmitted}
                        />
                      </div>
                    )}

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Che le relazioni intercorrenti tra il Cliente e il titolare effettivo nonché, ove rilevi, l’esecutore sono
                      </label>
                      <textarea
                        name="specifica10b"
                        value={form.specifica10b}
                        onChange={handleChange}
                        className="w-full rounded-md border px-3 py-2"
                        rows={3}
                        disabled={alreadySubmitted}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Che la provenienza dei fondi utilizzati nell’operazione è
                      </label>
                      <textarea
                        name="specifica10c"
                        value={form.specifica10c}
                        onChange={handleChange}
                        className="w-full rounded-md border px-3 py-2"
                        rows={3}
                        disabled={alreadySubmitted}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Che i mezzi di pagamento forniti dal Cliente al professionista sono
                      </label>
                      <textarea
                        name="specifica11c"
                        value={form.specifica11c}
                        onChange={handleChange}
                        className="w-full rounded-md border px-3 py-2"
                        rows={3}
                        disabled={alreadySubmitted}
                      />
                    </div>

                    <div className="text-sm leading-6 text-gray-700">
                      Che i medesimi fondi e le risorse economiche eventualmente utilizzati non provengono né sono destinati a un’attività criminosa o al finanziamento del terrorismo di cui all’art. 2, co. 6, del D.Lgs. 231/2007.
                    </div>

                    <div className="font-semibold">Professione / attività del cliente</div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Che la professione/attività del cliente è la seguente
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
                      <label className="mb-1 block text-sm font-medium">Esercitata / svolta dal</label>
                      <input
                        name="specifica10e"
                        value={form.specifica10e}
                        onChange={handleChange}
                        className="w-full rounded-md border px-3 py-2"
                        disabled={alreadySubmitted}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Nell’ambito territoriale</label>
                      <input
                        name="specifica10f"
                        value={form.specifica10f}
                        onChange={handleChange}
                        className="w-full rounded-md border px-3 py-2"
                        disabled={alreadySubmitted}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Firma</CardTitle>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Luogo</label>
                      <input
                        name="luogo_firma"
                        value={form.luogo_firma}
                        onChange={handleChange}
                        className="w-full rounded-md border px-3 py-2"
                        disabled={alreadySubmitted}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Data</label>
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
                      <label className="mb-1 block text-sm font-medium">Luogo</label>
                      <input
                        name="luogo_firma_bis"
                        value={form.luogo_firma_bis}
                        onChange={handleChange}
                        className="w-full rounded-md border px-3 py-2"
                        disabled={alreadySubmitted}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Data</label>
                      <input
                        type="date"
                        name="data_firma_bis"
                        value={form.data_firma_bis}
                        onChange={handleChange}
                        className="w-full rounded-md border px-3 py-2"
                        disabled={alreadySubmitted}
                      />
                    </div>

                   <div className="md:col-span-2 space-y-2">
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

                    <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
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

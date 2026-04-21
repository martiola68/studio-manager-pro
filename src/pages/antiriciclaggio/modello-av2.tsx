import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getStudioId } from "@/services/getStudioId";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FormStickyHeader from "@/components/antiriciclaggio/FormStickyHeader";
import { AV2_CHECKLIST } from "@/config/av2Checklist";

type Cliente = {
  id: string;
  cod_cliente?: string | null;
  ragione_sociale?: string | null;
  codice_fiscale?: string | null;
  partita_iva?: string | null;
};

type AV2FormState = {
  id?: string;
  pratica_id?: string;
  studio_id: string;
  cliente_id: string;
  av1_id: string;
  data_check: string;
  firma_check: string;
  [key: string]: string | boolean | undefined;
};

const buildInitialForm = (studioId: string): AV2FormState => {
  const base: AV2FormState = {
    id: "",
    pratica_id: "",
    studio_id: studioId,
    cliente_id: "",
    av1_id: "",
    data_check: "",
    firma_check: "",
  };

  for (let i = 1; i <= 23; i++) {
    base[`spunta${i}`] = false;
    base[`annotazioni${i}`] = "";
  }

  return base;
};

const formatClienteLabel = (cliente: Cliente) => {
  if (cliente.ragione_sociale) return cliente.ragione_sociale;
  if (cliente.cod_cliente) return cliente.cod_cliente;
  return cliente.id;
};

function normalizeDateValue(value: unknown) {
  if (!value) return "";
  const str = String(value);
  return str.includes("T") ? str.split("T")[0] : str;
}

export default function ModelloAV2Page() {
  const router = useRouter();
  const { id, av1_id, pratica_id, cliente_id, studio_id } = router.query;

  const [studioId, setStudioId] = useState<string>("");
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [form, setForm] = useState<AV2FormState>(buildInitialForm(""));
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clienteSelezionato = useMemo(
    () => clienti.find((c) => c.id === form.cliente_id) || null,
    [clienti, form.cliente_id]
  );

  const prefillFromAV1 = async (studioIdValue: string, av1IdValue: string) => {
    try {
      if (!av1IdValue) return;

      const { data: av1Row, error: av1Error } = await (supabase as any)
        .from("tbAV1")
        .select("id, studio_id, cliente_id, DataVerifica")
        .eq("id", Number(av1IdValue))
        .single();

      if (av1Error) {
        console.error("Errore caricamento AV1:", av1Error);
        setError(av1Error.message);
        return;
      }

      if (!av1Row) return;

      const resolvedStudioId = av1Row.studio_id || studioIdValue || "";
      const resolvedClienteId = av1Row.cliente_id || "";

      setForm((prev) => ({
        ...buildInitialForm(resolvedStudioId),
        ...prev,
        studio_id: resolvedStudioId,
        av1_id: String(av1Row.id),
        cliente_id: resolvedClienteId,
      }));
    } catch (err: any) {
      console.error("Errore prefill AV2 da AV1:", err);
      setError(err?.message || "Errore durante il prefill da AV1.");
    }
  };

   const prefillFromPratica = async (studioIdValue: string, praticaIdValue: string) => {
    try {
      if (!praticaIdValue) return;

      const { data: praticaRow, error: praticaError } = await (supabase as any)
        .from("tbPraticheAML")
        .select("id, studio_id, cliente_id, data_apertura, av1_id")
        .eq("id", praticaIdValue)
        .single();

      if (praticaError) {
        console.error("Errore caricamento pratica AML:", praticaError);
        setError(praticaError.message);
        return;
      }

      if (!praticaRow) return;

      const resolvedStudioId =
        praticaRow.studio_id ||
        studioIdValue ||
        (typeof studio_id === "string" ? studio_id : "") ||
        "";

      const resolvedClienteId =
        praticaRow.cliente_id ||
        (typeof cliente_id === "string" ? cliente_id : "") ||
        "";

      setForm((prev) => ({
        ...buildInitialForm(resolvedStudioId),
        ...prev,
        pratica_id: String(praticaRow.id),
        studio_id: resolvedStudioId,
        cliente_id: resolvedClienteId,
        av1_id: praticaRow.av1_id ? String(praticaRow.av1_id) : "",
        data_check: normalizeDateValue(praticaRow.data_apertura),
      }));
    } catch (err: any) {
      console.error("Errore prefill AV2 da pratica:", err);
      setError(err?.message || "Errore durante il prefill da pratica.");
    }
  };
  
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        const currentStudioId = await getStudioId();

        if (!currentStudioId) {
          setError("Studio ID non trovato nella sessione.");
          return;
        }

        setStudioId(currentStudioId);

        const { data: clientiData, error: clientiError } = await (supabase as any)
          .from("tbclienti")
          .select("id, cod_cliente, ragione_sociale, codice_fiscale, partita_iva")
          .eq("studio_id", currentStudioId)
          .order("ragione_sociale", { ascending: true });

        if (clientiError) {
          setError(clientiError.message);
          return;
        }

        setClienti((clientiData || []) as Cliente[]);

        if (id && typeof id === "string") {
          const { data, error } = await (supabase as any)
            .from("tbAV2")
            .select("*")
            .eq("id", id)
            .single();

          if (error) {
            setError(error.message);
            return;
          }

           if (data) {
            setForm({
              ...buildInitialForm(data.studio_id || currentStudioId),
              ...data,
              id: String(data.id),
              pratica_id:
                data.pratica_id ||
                (typeof pratica_id === "string" ? pratica_id : "") ||
                "",
              studio_id: data.studio_id || currentStudioId,
              cliente_id: data.cliente_id || "",
              av1_id: data.av1_id ? String(data.av1_id) : "",
              data_check: normalizeDateValue(data.data_check),
              firma_check: data.firma_check || "",
            });
            return;
          }
        }

       if (av1_id && typeof av1_id === "string") {
          await prefillFromAV1(currentStudioId, av1_id);
        } else if (pratica_id && typeof pratica_id === "string") {
          await prefillFromPratica(currentStudioId, pratica_id);
        } else {
          setForm((prev) => ({
            ...buildInitialForm(currentStudioId),
            pratica_id: typeof pratica_id === "string" ? pratica_id : "",
            studio_id: currentStudioId,
            cliente_id: typeof cliente_id === "string" ? cliente_id : "",
          }));
        }
      } catch (err: any) {
        console.error("Errore init AV2:", err);
        setError(err?.message || "Errore durante inizializzazione AV2.");
      } finally {
        setLoading(false);
      }
    };

    if (!router.isReady) return;
    void init();
   }, [router.isReady, id, av1_id, pratica_id, cliente_id, studio_id]);

  const handleAnnotazioneChange = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      [`annotazioni${index}`]: value,
    }));
  };

  const handleCheckboxChange = (index: number, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      [`spunta${index}`]: checked,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!studioId) {
        alert("Studio non disponibile.");
        return;
      }

      if (!form.cliente_id) {
        alert("Cliente non disponibile.");
        return;
      }

     const payload: Record<string, unknown> = {
        studio_id: studioId,
        cliente_id: form.cliente_id,
        pratica_id: form.pratica_id || null,
        av1_id: form.av1_id ? Number(form.av1_id) : null,
        data_check: form.data_check || null,
        firma_check: form.firma_check || null,
      };

      for (let i = 1; i <= 23; i++) {
        payload[`spunta${i}`] = !!form[`spunta${i}`];
        payload[`annotazioni${i}`] = String(form[`annotazioni${i}`] || "");
      }

      let savedId = form.id || "";

      if (form.id) {
        const { error } = await (supabase as any)
          .from("tbAV2")
          .update(payload)
          .eq("id", form.id);

        if (error) {
          setError(error.message);
          setSaving(false);
          return;
        }
      } else {
        const { data, error } = await (supabase as any)
          .from("tbAV2")
          .insert([payload])
          .select("id")
          .single();

        if (error) {
          setError(error.message);
          setSaving(false);
          return;
        }

        savedId = String(data.id);
      }

      if (form.av1_id) {
        const { error: av1UpdateError } = await (supabase as any)
          .from("tbAV1")
          .update({ AV2Generato: true })
          .eq("id", Number(form.av1_id));

        if (av1UpdateError) {
          console.error("Errore aggiornamento AV2Generato:", av1UpdateError);
        }
      }
      
       setForm((prev) => ({
        ...prev,
        id: savedId,
        pratica_id:
          prev.pratica_id ||
          (typeof pratica_id === "string" ? pratica_id : "") ||
          "",
      }));
      alert("Scheda AV2 salvata correttamente.");

      const praticaQuery =
        form.pratica_id || (typeof pratica_id === "string" ? pratica_id : "");

      await router.replace(
        praticaQuery
          ? `/antiriciclaggio/modello-av2?id=${savedId}&av1_id=${form.av1_id || ""}&pratica_id=${praticaQuery}`
          : `/antiriciclaggio/modello-av2?id=${savedId}&av1_id=${form.av1_id || ""}`
      );
      
    } catch (err: any) {
      console.error("Errore salvataggio AV2:", err);
      setError(err?.message || "Errore durante il salvataggio della scheda AV2.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const av2Id = form.id;
    if (!av2Id) {
      alert("Salva prima il record AV2, poi potrai stamparlo.");
      return;
    }
    router.push(`/antiriciclaggio/stampa-av2?id=${av2Id}`);
  };

  const handleChiudiModello = () => {
    router.push("/antiriciclaggio");
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-background">
      <FormStickyHeader
        title="Modello AV2"
        subtitle="Gestione documentazione e annotazioni professionista"
        onSave={handleSave}
        onPrint={handlePrint}
        onClose={handleChiudiModello}
        saving={saving || loading}
      />

      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 pb-32 pt-4 md:px-8 md:pb-40 md:pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Dati principali</CardTitle>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <p>Caricamento...</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium">Cliente</label>
                      <select
                        className="w-full rounded-md border bg-gray-100 px-3 py-2"
                        value={form.cliente_id}
                        disabled
                      >
                        <option value="">Seleziona cliente</option>
                        {clienti.map((cliente) => (
                          <option key={cliente.id} value={cliente.id}>
                            {formatClienteLabel(cliente)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Data check</label>
                      <input
                        type="date"
                        className="w-full rounded-md border px-3 py-2"
                        value={form.data_check || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            data_check: e.target.value,
                          }))
                        }
                      />
                    </div>

                    {clienteSelezionato && (
                      <div className="md:col-span-3">
                        <div className="rounded-md border bg-gray-50 px-4 py-3 text-sm text-gray-700">
                          <span className="font-semibold">Cliente selezionato:</span>{" "}
                          {formatClienteLabel(clienteSelezionato)}
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="md:col-span-3">
                        <p className="text-sm text-red-600">Errore: {error}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Check-list fascicolo cliente</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-[1200px]">
                    <div className="mb-4 grid grid-cols-12 gap-3 border-b pb-3 text-sm font-semibold">
                      <div className="col-span-1 text-center">X</div>
                      <div className="col-span-3">DOCUMENTAZIONE</div>
                      <div className="col-span-4">OSSERVAZIONI</div>
                      <div className="col-span-4">ANNOTAZIONI PROFESSIONISTA</div>
                    </div>

                    <div className="space-y-4">
                      {AV2_CHECKLIST.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-12 gap-3 rounded-lg border p-4"
                        >
                          <div className="col-span-1 flex items-start justify-center pt-1">
                            <input
                              type="checkbox"
                              checked={!!form[`spunta${item.id}`]}
                              onChange={(e) =>
                                handleCheckboxChange(item.id, e.target.checked)
                              }
                            />
                          </div>

                          <div className="col-span-3 whitespace-pre-line text-sm">
                            {item.documento}
                          </div>

                          <div className="col-span-4 whitespace-pre-line text-sm text-gray-700">
                            {item.osservazioni || "-"}
                          </div>

                          <div className="col-span-4">
                            <textarea
                              rows={5}
                              className="w-full rounded-md border px-3 py-2 text-sm"
                              value={String(form[`annotazioni${item.id}`] || "")}
                              onChange={(e) =>
                                handleAnnotazioneChange(item.id, e.target.value)
                              }
                              placeholder="Inserisci annotazioni..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Chiusura check-list</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Firma check</label>
                    <input
                      type="text"
                      className="w-full rounded-md border px-3 py-2"
                      value={form.firma_check || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          firma_check: e.target.value,
                        }))
                      }
                      placeholder="Firma professionista"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      Usa i pulsanti in alto a destra per <strong>salvare</strong>,{" "}
                      <strong>stampare</strong> o <strong>chiudere</strong> il modello.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getStudioId } from "@/services/getStudioId";
import { AV2_CHECKLIST } from "@/config/av2Checklist";
import { getStudioId } from "@/lib/getStudioId";

type Cliente = {
  id: string;
  cod_cliente?: string | null;
  ragione_sociale?: string | null;
};

type AV2FormState = {
  id?: string;
  studio_id: string;
  cliente_id: string;
  data_check: string;
  firma_check: string;
} & Record<string, boolean | string | undefined>;

const buildInitialForm = (studioId: string): AV2FormState => {
  const base: AV2FormState = {
    studio_id: studioId,
    cliente_id: "",
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
  return "Cliente";
};

export default function ModelloAV2Page() {
  const [studioId, setStudioId] = useState<string>("");
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [form, setForm] = useState<AV2FormState>(buildInitialForm(""));
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [messaggio, setMessaggio] = useState<string>("");

  useEffect(() => {
    void bootstrapPage();
  }, []);

  const clienteSelezionato = useMemo(
    () => clienti.find((c) => c.id === form.cliente_id) || null,
    [clienti, form.cliente_id]
  );

  const bootstrapPage = async () => {
    try {
      setLoading(true);
      setMessaggio("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      if (!user) {
        setMessaggio("Sessione non trovata.");
        return;
      }

const currentStudioId = await getStudioId();

if (!currentStudioId) {
  setMessaggio("Studio ID non trovato nella sessione.");
  return;
}

setStudioId(currentStudioId);
setForm(buildInitialForm(currentStudioId));

  const { data: clientiData, error: clientiError } = await (supabase as any)
  .from("tbclienti")
  .select("id, cod_cliente, ragione_sociale, codice_fiscale, partita_iva")
  .eq("studio_id", currentStudioId)
  .order("ragione_sociale", { ascending: true });
      
      if (clientiError) throw clientiError;

      setClienti(clientiData || []);
    } catch (error) {
      console.error("Errore bootstrap AV2:", error);
      setMessaggio("Errore durante il caricamento iniziale.");
    } finally {
      setLoading(false);
    }
  };

  const loadAV2ByCliente = async (clienteId: string) => {
    try {
      if (!clienteId || !studioId) return;

      setLoading(true);
      setMessaggio("");

      const { data, error } = await (supabase as any)
  .from("tbAV2")
  .select("*")
  .eq("studio_id", studioId)
  .eq("cliente_id", clienteId)
  .maybeSingle();

      if (error) throw error;

      if (data) {
        const nextForm: AV2FormState = {
          ...buildInitialForm(studioId),
          ...data,
          data_check: data.data_check || "",
          firma_check: data.firma_check || "",
        };

        setForm(nextForm);
      } else {
        const emptyForm = buildInitialForm(studioId);
        emptyForm.cliente_id = clienteId;
        setForm(emptyForm);
      }
    } catch (error) {
      console.error("Errore caricamento AV2:", error);
      setMessaggio("Errore nel caricamento della scheda AV2.");
    } finally {
      setLoading(false);
    }
  };

  const handleClienteChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const clienteId = e.target.value;

    setForm((prev) => ({
      ...buildInitialForm(studioId),
      cliente_id: clienteId,
    }));

    if (clienteId) {
      await loadAV2ByCliente(clienteId);
    }
  };

  const handleCheckboxChange = (index: number, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      [`spunta${index}`]: checked,
    }));
  };

  const handleAnnotazioneChange = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      [`annotazioni${index}`]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessaggio("");

      if (!studioId) {
        setMessaggio("Studio non disponibile.");
        return;
      }

      if (!form.cliente_id) {
        setMessaggio("Seleziona un cliente.");
        return;
      }

      const payload: Record<string, unknown> = {
        studio_id: studioId,
        cliente_id: form.cliente_id,
        data_check: form.data_check || null,
        firma_check: form.firma_check || null,
      };

      for (let i = 1; i <= 23; i++) {
        payload[`spunta${i}`] = Boolean(form[`spunta${i}`]);
        payload[`annotazioni${i}`] = String(form[`annotazioni${i}`] || "");
      }

      if (form.id) {
        const { error } = await (supabase as any)
        .from("tbAV2")
        .update(payload)
        .eq("id", form.id);

        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
  .from("tbAV2")
  .insert([payload])
  .select()
  .single();

        if (error) throw error;

        if (data) {
          setForm((prev) => ({
            ...prev,
            ...data,
          }));
        }
      }

      setMessaggio("Scheda AV2 salvata correttamente.");
    } catch (error) {
      console.error("Errore salvataggio AV2:", error);
      setMessaggio("Errore durante il salvataggio della scheda AV2.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            AV.2 – CHECK-LIST AI FINI DELLA FORMAZIONE DEL FASCICOLO DEL CLIENTE
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Gestione documentazione e annotazioni professionista.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Cliente
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                value={form.cliente_id}
                onChange={handleClienteChange}
                disabled={loading || saving}
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
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Data check
              </label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                value={form.data_check || ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    data_check: e.target.value,
                  }))
                }
                disabled={loading || saving}
              />
            </div>
          </div>

          {clienteSelezionato && (
            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold">Cliente selezionato:</span>{" "}
              {formatClienteLabel(clienteSelezionato)}
            </div>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-800">
            <div className="col-span-1 text-center">X</div>
            <div className="col-span-3">DOCUMENTAZIONE</div>
            <div className="col-span-4">OSSERVAZIONI</div>
            <div className="col-span-4">ANNOTAZIONI PROFESSIONISTA</div>
          </div>

          {AV2_CHECKLIST.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-12 gap-3 border-b border-slate-100 px-4 py-4"
            >
              <div className="col-span-1 flex items-start justify-center pt-1">
                <input
                  type="checkbox"
                  checked={Boolean(form[`spunta${item.id}`])}
                  onChange={(e) =>
                    handleCheckboxChange(item.id, e.target.checked)
                  }
                  disabled={loading || saving}
                  className="h-4 w-4"
                />
              </div>

              <div className="col-span-3 whitespace-pre-line text-sm text-slate-900">
                {item.documento}
              </div>

              <div className="col-span-4 whitespace-pre-line text-sm text-slate-600">
                {item.osservazioni || "-"}
              </div>

              <div className="col-span-4">
                <textarea
                  rows={5}
                  className="min-h-[120px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={String(form[`annotazioni${item.id}`] || "")}
                  onChange={(e) =>
                    handleAnnotazioneChange(item.id, e.target.value)
                  }
                  disabled={loading || saving}
                  placeholder="Inserisci annotazioni..."
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Firma check
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                value={form.firma_check || ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    firma_check: e.target.value,
                  }))
                }
                disabled={loading || saving}
                placeholder="Firma professionista"
              />
            </div>
          </div>

          {messaggio && (
            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {messaggio}
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvataggio..." : "Salva AV2"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

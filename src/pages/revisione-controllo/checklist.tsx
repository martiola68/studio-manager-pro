import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Save, RefreshCw } from "lucide-react";

type ChecklistItem = {
  id?: string;
  area: string;
  domanda: string;
  risposta: string | null;
  note: string | null;
  ordine: number;
};

export default function ChecklistRevisionePage() {
  const router = useRouter();

  const controlloId =
    typeof router.query.controllo_id === "string"
      ? router.query.controllo_id
      : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadChecklist() {
    try {
      setLoading(true);
      setError("");

      if (!controlloId) return;

      const res = await fetch(
        `/api/revisione-controllo/checklist?controllo_id=${controlloId}&crea_default=true`
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore caricamento checklist");
      }

      setChecklist(json.data || []);
    } catch (err: any) {
      setError(err?.message || "Errore caricamento checklist");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (router.isReady && controlloId) {
      loadChecklist();
    }
  }, [router.isReady, controlloId]);

  async function salvaChecklist() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/revisione-controllo/checklist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          controllo_id: controlloId,
          checklist,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore salvataggio checklist");
      }

      setSuccess("Checklist salvata correttamente");
    } catch (err: any) {
      setError(err?.message || "Errore salvataggio checklist");
    } finally {
      setSaving(false);
    }
  }

  function updateItem(
    index: number,
    field: keyof ChecklistItem,
    value: any
  ) {
    setChecklist((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  const grouped = checklist.reduce(
    (acc: Record<string, ChecklistItem[]>, item) => {
      if (!acc[item.area]) acc[item.area] = [];
      acc[item.area].push(item);
      return acc;
    },
    {}
  );

  return (
    <>
      <Head>
        <title>Checklist Revisione</title>
      </Head>

      <div className="mx-auto max-w-[1500px] p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Checklist controllo trimestrale
            </h1>

            <p className="text-sm text-gray-500">
              Verifica operativa di revisione e controllo.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadChecklist}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <RefreshCw size={16} />
              Aggiorna
            </button>

            <button
              onClick={salvaChecklist}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm text-white"
            >
              <Save size={16} />
              {saving ? "Salvataggio..." : "Salva"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-green-700">
            {success}
          </div>
        )}

        {loading ? (
          <div className="rounded border bg-white p-8 text-center">
            Caricamento checklist...
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([area, items]) => (
              <div
                key={area}
                className="overflow-hidden rounded-lg border bg-white"
              >
                <div className="border-b bg-gray-50 px-4 py-3">
                  <h2 className="font-semibold">{area}</h2>
                </div>

                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-3 text-left w-[55%]">
                          Verifica
                        </th>

                        <th className="p-3 text-center">
                          Esito
                        </th>

                        <th className="p-3 text-left">
                          Note
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map((item) => {
                        const index = checklist.findIndex(
                          (x) => x.id === item.id
                        );

                        return (
                          <tr key={item.id} className="border-b">
                            <td className="p-3">
                              {item.domanda}
                            </td>

                            <td className="p-3 text-center">
                              <select
                                value={item.risposta || ""}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "risposta",
                                    e.target.value || null
                                  )
                                }
                                className="rounded border px-2 py-1"
                              >
                                <option value="">
                                  --
                                </option>

                                <option value="SI">
                                  SI
                                </option>

                                <option value="NO">
                                  NO
                                </option>

                                <option value="N_A">
                                  N/A
                                </option>
                              </select>
                            </td>

                            <td className="p-3">
                              <input
                                value={item.note || ""}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "note",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded border px-2 py-1"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

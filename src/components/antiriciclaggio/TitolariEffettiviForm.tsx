import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Props = {
  sezione: "domanda7" | "domanda8" | "domanda9";
  av4_id?: string;
  studio_id: string;
  cliente_id: string;
};

type RigaTitolare = {
  id?: string;
  rapp_legale_id: string;
  nome_cognome: string;
  codice_fiscale: string;
  luogo_nascita: string;
  data_nascita: string;
  indirizzo_residenza: string;
  citta_residenza: string;
  cap_residenza: string;
  nazionalita: string;
};

function emptyRiga(): RigaTitolare {
  return {
    rapp_legale_id: "",
    nome_cognome: "",
    codice_fiscale: "",
    luogo_nascita: "",
    data_nascita: "",
    indirizzo_residenza: "",
    citta_residenza: "",
    cap_residenza: "",
    nazionalita: "",
  };
}

function normalizeId(value: unknown): string {
  return value ? String(value).trim() : "";
}

function normalizeDateForInput(value: unknown): string {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function TitolariEffettiviForm({
  sezione,
  av4_id,
  studio_id,
  cliente_id,
}: Props) {
  const supabase = getSupabaseClient() as any;

  const [rappresentanti, setRappresentanti] = useState<any[]>([]);
  const [righe, setRighe] = useState<RigaTitolare[]>([]);
  const [loadingRappresentanti, setLoadingRappresentanti] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadRappresentanti();
  }, [studio_id]);

  useEffect(() => {
    void loadSavedTitolari();
  }, [av4_id, sezione]);

  async function loadRappresentanti() {
    setLoadingRappresentanti(true);

    try {
      let query = supabase.from("rapp_legali").select("*").order("nome_cognome");

      if (studio_id) {
        query = query.eq("studio_id", studio_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Errore caricamento rappresentanti:", error);
        return;
      }

      setRappresentanti(data || []);
    } catch (error) {
      console.error("Errore imprevisto caricamento rappresentanti:", error);
    } finally {
      setLoadingRappresentanti(false);
    }
  }

  async function loadSavedTitolari() {
    if (!av4_id) {
      setRighe([]);
      return;
    }

    setLoadingSaved(true);

    try {
      const { data, error } = await supabase
        .from("tbAV4_titolari")
        .select("*")
        .eq("av4_id", normalizeId(av4_id))
        .eq("sezione", sezione)
        .order("nome_cognome", { ascending: true });

      if (error) {
        console.error("Errore caricamento titolari salvati:", error);
        setRighe([]);
        return;
      }

      const mapped: RigaTitolare[] = (data || []).map((row: any) => ({
        id: normalizeId(row.id),
        rapp_legale_id: normalizeId(row.rapp_legale_id),
        nome_cognome: row?.nome_cognome ?? "",
        codice_fiscale: row?.codice_fiscale ?? "",
        luogo_nascita: row?.luogo_nascita ?? "",
        data_nascita: normalizeDateForInput(row?.data_nascita),
        indirizzo_residenza: row?.indirizzo_residenza ?? "",
        citta_residenza: row?.citta_residenza ?? "",
        cap_residenza: row?.cap_residenza ?? "",
        nazionalita: row?.nazionalita ?? "",
      }));

      setRighe(mapped);
    } catch (error) {
      console.error("Errore imprevisto caricamento titolari salvati:", error);
      setRighe([]);
    } finally {
      setLoadingSaved(false);
    }
  }

  function aggiungiRiga() {
    setRighe((prev) => [...prev, emptyRiga()]);
  }

  function eliminaRiga(index: number) {
    setRighe((prev) => prev.filter((_, i) => i !== index));
  }

  function selezionaRappresentante(index: number, id: string) {
    const normalizedSelectedId = normalizeId(id);
    const rapp = rappresentanti.find((r) => normalizeId(r.id) === normalizedSelectedId);
    if (!rapp) return;

    setRighe((prev) => {
      const nuovaLista = [...prev];
      nuovaLista[index] = {
        ...nuovaLista[index],
        rapp_legale_id: normalizeId(rapp.id),
        nome_cognome: rapp.nome_cognome || "",
        codice_fiscale: rapp.codice_fiscale || "",
        luogo_nascita: rapp.luogo_nascita || "",
        data_nascita: normalizeDateForInput(rapp.data_nascita),
        indirizzo_residenza: rapp.indirizzo_residenza || "",
        citta_residenza: rapp.citta_residenza || "",
        cap_residenza: rapp.cap_residenza || "",
        nazionalita: rapp.nazionalita || "",
      };
      return nuovaLista;
    });
  }

  async function salvaTitolari() {
    if (!av4_id) {
      alert("Salva prima il modello AV4");
      return;
    }

    const righeValide = righe.filter(
      (r) =>
        normalizeId(r.rapp_legale_id) ||
        r.nome_cognome.trim() ||
        r.codice_fiscale.trim()
    );

    if (!righeValide.length) {
      alert("Inserisci almeno un titolare effettivo");
      return;
    }

    setSaving(true);

    try {
      const records = righeValide.map((r) => ({
        av4_id: normalizeId(av4_id),
        studio_id: normalizeId(studio_id) || null,
        cliente_id: normalizeId(cliente_id) || null,
        sezione,
        rapp_legale_id: normalizeId(r.rapp_legale_id) || null,
        nome_cognome: r.nome_cognome || "",
        codice_fiscale: r.codice_fiscale || "",
        luogo_nascita: r.luogo_nascita || "",
        data_nascita: r.data_nascita || null,
        indirizzo_residenza: r.indirizzo_residenza || "",
        citta_residenza: r.citta_residenza || "",
        cap_residenza: r.cap_residenza || "",
        nazionalita: r.nazionalita || "",
      }));

      const { error: deleteError } = await supabase
        .from("tbAV4_titolari")
        .delete()
        .eq("av4_id", normalizeId(av4_id))
        .eq("sezione", sezione);

      if (deleteError) {
        console.error("Errore pulizia titolari esistenti:", deleteError);
        alert("Errore durante l'aggiornamento dei titolari.");
        return;
      }

      const { error: insertError } = await supabase
        .from("tbAV4_titolari")
        .insert(records);

      if (insertError) {
        console.error("Errore salvataggio titolari:", insertError);
        alert("Errore salvataggio titolari");
        return;
      }

      await loadSavedTitolari();
      alert("Titolari salvati correttamente");
    } catch (error) {
      console.error("Errore imprevisto salvataggio titolari:", error);
      alert("Errore salvataggio titolari");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold">Titolari effettivi</h3>

        {(loadingRappresentanti || loadingSaved) && (
          <span className="text-sm text-gray-500">Caricamento...</span>
        )}
      </div>

      {!righe.length && !loadingSaved && (
        <div className="mb-4 rounded-md border bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Nessun titolare presente per questa sezione.
        </div>
      )}

      {righe.map((riga, index) => (
        <div
          key={`${riga.id || "new"}-${index}`}
          className="mb-3 rounded-lg border border-sky-200 bg-sky-50/40 p-3"
        >
          <div className="mb-2">
            <label className="mb-1 block text-sm font-medium">Seleziona nominativo</label>

            <select
              value={normalizeId(riga.rapp_legale_id)}
              onChange={(e) => selezionaRappresentante(index, e.target.value)}
              className="w-full rounded border p-2"
            >
              <option value="">Seleziona</option>

              {rappresentanti.map((r) => (
                <option key={normalizeId(r.id)} value={normalizeId(r.id)}>
                  {r.nome_cognome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              value={riga.nome_cognome}
              placeholder="Nome e cognome"
              className="rounded border p-2"
              readOnly
            />

            <input
              value={riga.codice_fiscale}
              placeholder="Codice fiscale"
              className="rounded border p-2"
              readOnly
            />

            <input
              value={riga.luogo_nascita}
              placeholder="Luogo nascita"
              className="rounded border p-2"
              readOnly
            />

            <input
              value={riga.data_nascita}
              placeholder="Data nascita"
              className="rounded border p-2"
              readOnly
            />

            <input
              value={riga.indirizzo_residenza}
              placeholder="Indirizzo residenza"
              className="rounded border p-2"
              readOnly
            />

            <input
              value={riga.citta_residenza}
              placeholder="Città residenza"
              className="rounded border p-2"
              readOnly
            />

            <input
              value={riga.cap_residenza}
              placeholder="CAP residenza"
              className="rounded border p-2"
              readOnly
            />

            <input
              value={riga.nazionalita}
              placeholder="Nazionalità"
              className="rounded border p-2"
              readOnly
            />
          </div>

          <button
            type="button"
            onClick={() => eliminaRiga(index)}
            className="mt-3 text-red-600"
          >
            Elimina
          </button>
        </div>
      ))}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={aggiungiRiga}
          className="rounded bg-gray-200 px-3 py-1"
        >
          + Aggiungi titolare
        </button>

        <button
          type="button"
          onClick={salvaTitolari}
          disabled={saving || !av4_id}
          className="rounded bg-blue-600 px-3 py-1 text-white disabled:bg-gray-400"
        >
          {saving ? "Salvataggio..." : "Salva titolari"}
        </button>
      </div>
    </div>
  );
}

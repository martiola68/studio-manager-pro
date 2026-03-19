import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { isValidCF, normalizeCF } from "@/utils/codiceFiscale";

type Props = {
  sezione: "domanda7" | "domanda8" | "domanda9";
  av4_id?: string;
  studio_id: string;
  cliente_id: string;
};

type SourceMode = "import" | "manual";

type RigaTitolare = {
  id?: string;
  rapp_legale_id: string;
  source_mode: SourceMode;
  nome_cognome: string;
  codice_fiscale: string;
  luogo_nascita: string;
  data_nascita: string;
  indirizzo_residenza: string;
  citta_residenza: string;
  cap_residenza: string;
  nazionalita: string;
  error_codice_fiscale?: string;
};

function emptyRiga(mode: SourceMode = "import"): RigaTitolare {
  return {
    rapp_legale_id: "",
    source_mode: mode,
    nome_cognome: "",
    codice_fiscale: "",
    luogo_nascita: "",
    data_nascita: "",
    indirizzo_residenza: "",
    citta_residenza: "",
    cap_residenza: "",
    nazionalita: "",
    error_codice_fiscale: "",
  };
}

function normalizeId(value: unknown): string {
  return value ? String(value).trim() : "";
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
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

function isDuplicateTitolare(
  righe: RigaTitolare[],
  candidato: RigaTitolare,
  currentIndex?: number
): boolean {
  const cf = normalizeCF(candidato.codice_fiscale);
  if (!cf) return false;

  return righe.some((r, index) => {
    if (currentIndex !== undefined && index === currentIndex) return false;
    return normalizeCF(r.codice_fiscale) === cf;
  });
}

function isMeaningfulRow(riga: RigaTitolare): boolean {
  return Boolean(
    normalizeId(riga.rapp_legale_id) ||
      normalizeText(riga.nome_cognome) ||
      normalizeCF(riga.codice_fiscale) ||
      normalizeText(riga.luogo_nascita) ||
      normalizeDateForInput(riga.data_nascita) ||
      normalizeText(riga.indirizzo_residenza) ||
      normalizeText(riga.citta_residenza) ||
      normalizeText(riga.cap_residenza) ||
      normalizeText(riga.nazionalita)
  );
}

function storageKey(sezione: string, studio_id: string, cliente_id: string) {
  return `av4_titolari_draft:${sezione}:${studio_id || "nostudio"}:${cliente_id || "nocliente"}`;
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
  const [initialized, setInitialized] = useState(false);

  const draftKey = useMemo(
    () => storageKey(sezione, studio_id, cliente_id),
    [sezione, studio_id, cliente_id]
  );

  useEffect(() => {
    void loadRappresentanti();
  }, [studio_id]);

  useEffect(() => {
    void initializeRows();
  }, [av4_id, sezione, draftKey]);

  useEffect(() => {
    if (!initialized) return;
    persistDraft();
  }, [righe, initialized, draftKey]);

  async function initializeRows() {
    setLoadingSaved(true);

    try {
      if (normalizeId(av4_id)) {
        const dbRows = await loadSavedTitolari(normalizeId(av4_id));
        if (dbRows.length > 0) {
          setRighe(dbRows);
          setInitialized(true);
          return;
        }
      }

      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRighe(
            parsed.map((row: any) => ({
              ...emptyRiga(row?.source_mode === "manual" ? "manual" : "import"),
              ...row,
              id: normalizeId(row?.id),
              rapp_legale_id: normalizeId(row?.rapp_legale_id),
              source_mode: row?.source_mode === "manual" ? "manual" : "import",
              nome_cognome: normalizeText(row?.nome_cognome),
              codice_fiscale: normalizeCF(row?.codice_fiscale),
              luogo_nascita: normalizeText(row?.luogo_nascita),
              data_nascita: normalizeDateForInput(row?.data_nascita),
              indirizzo_residenza: normalizeText(row?.indirizzo_residenza),
              citta_residenza: normalizeText(row?.citta_residenza),
              cap_residenza: normalizeText(row?.cap_residenza),
              nazionalita: normalizeText(row?.nazionalita),
              error_codice_fiscale: "",
            }))
          );
          setInitialized(true);
          return;
        }
      }

      setRighe([]);
      setInitialized(true);
    } catch (error) {
      console.error("Errore inizializzazione titolari:", error);
      setRighe([]);
      setInitialized(true);
    } finally {
      setLoadingSaved(false);
    }
  }

  function persistDraft() {
    try {
      const payload = righe.map((r) => ({
        ...r,
        id: normalizeId(r.id),
        rapp_legale_id: normalizeId(r.rapp_legale_id),
        codice_fiscale: normalizeCF(r.codice_fiscale),
        data_nascita: normalizeDateForInput(r.data_nascita),
        error_codice_fiscale: "",
      }));
      sessionStorage.setItem(draftKey, JSON.stringify(payload));
    } catch (error) {
      console.error("Errore salvataggio bozza titolari:", error);
    }
  }

  function clearDraft() {
    try {
      sessionStorage.removeItem(draftKey);
    } catch (error) {
      console.error("Errore rimozione bozza titolari:", error);
    }
  }

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

  async function loadSavedTitolari(currentAv4Id: string): Promise<RigaTitolare[]> {
    const { data, error } = await supabase
      .from("tbAV4_titolari")
      .select("*")
      .eq("av4_id", currentAv4Id)
      .eq("sezione", sezione)
      .order("nome_cognome", { ascending: true });

    if (error) {
      console.error("Errore caricamento titolari salvati:", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: normalizeId(row.id),
      rapp_legale_id: normalizeId(row.rapp_legale_id),
      source_mode: normalizeId(row.rapp_legale_id) ? "import" : "manual",
      nome_cognome: normalizeText(row?.nome_cognome),
      codice_fiscale: normalizeCF(row?.codice_fiscale),
      luogo_nascita: normalizeText(row?.luogo_nascita),
      data_nascita: normalizeDateForInput(row?.data_nascita),
      indirizzo_residenza: normalizeText(row?.indirizzo_residenza),
      citta_residenza: normalizeText(row?.citta_residenza),
      cap_residenza: normalizeText(row?.cap_residenza),
      nazionalita: normalizeText(row?.nazionalita),
      error_codice_fiscale: "",
    }));
  }

  function aggiungiRiga(mode: SourceMode) {
    setRighe((prev) => [...prev, emptyRiga(mode)]);
  }

  async function eliminaRiga(index: number) {
    const riga = righe[index];
    if (!riga) return;

    const conferma = window.confirm("Vuoi eliminare questo titolare effettivo?");
    if (!conferma) return;

    const rowId = normalizeId(riga.id);

    if (!rowId || !normalizeId(av4_id)) {
      setRighe((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    try {
      const { error } = await supabase.from("tbAV4_titolari").delete().eq("id", rowId);

      if (error) {
        console.error("Errore eliminazione titolare:", error);
        alert("Errore durante l'eliminazione del titolare effettivo.");
        return;
      }

      setRighe((prev) => prev.filter((_, i) => i !== index));
    } catch (error) {
      console.error("Errore imprevisto eliminazione titolare:", error);
      alert("Errore durante l'eliminazione del titolare effettivo.");
    }
  }

  function updateRiga(index: number, patch: Partial<RigaTitolare>) {
    setRighe((prev) => {
      const nuovaLista = [...prev];
      const current = nuovaLista[index] || emptyRiga();

      const next: RigaTitolare = {
        ...current,
        ...patch,
      };

      next.codice_fiscale = normalizeCF(next.codice_fiscale);
      next.data_nascita = normalizeDateForInput(next.data_nascita);

      if (!next.codice_fiscale) {
        next.error_codice_fiscale = "Codice fiscale obbligatorio";
      } else if (!isValidCF(next.codice_fiscale)) {
        next.error_codice_fiscale = "Codice fiscale non valido";
      } else if (isDuplicateTitolare(nuovaLista, next, index)) {
        next.error_codice_fiscale = "Codice fiscale già presente";
      } else {
        next.error_codice_fiscale = "";
      }

      nuovaLista[index] = next;
      return nuovaLista;
    });
  }

  function selezionaRappresentante(index: number, id: string) {
    const normalizedSelectedId = normalizeId(id);

    if (!normalizedSelectedId) {
      updateRiga(index, {
        rapp_legale_id: "",
        nome_cognome: "",
        codice_fiscale: "",
        luogo_nascita: "",
        data_nascita: "",
        indirizzo_residenza: "",
        citta_residenza: "",
        cap_residenza: "",
        nazionalita: "",
      });
      return;
    }

    const rapp = rappresentanti.find((r) => normalizeId(r.id) === normalizedSelectedId);
    if (!rapp) return;

    const next: RigaTitolare = {
      ...righe[index],
      rapp_legale_id: normalizeId(rapp.id),
      source_mode: "import",
      nome_cognome: normalizeText(rapp.nome_cognome),
      codice_fiscale: normalizeCF(rapp.codice_fiscale),
      luogo_nascita: normalizeText(rapp.luogo_nascita ?? rapp.comune_nascita),
      data_nascita: normalizeDateForInput(rapp.data_nascita),
      indirizzo_residenza: normalizeText(rapp.indirizzo_residenza),
      citta_residenza: normalizeText(rapp.citta_residenza ?? rapp.comune_residenza),
      cap_residenza: normalizeText(rapp.CAP),
      nazionalita: normalizeText(rapp.nazionalita ?? rapp.cittadinanza),
      error_codice_fiscale: "",
    };

    if (isDuplicateTitolare(righe, next, index)) {
      alert("Questo titolare effettivo è già presente.");
      return;
    }

    updateRiga(index, next);
  }

async function findOrCreateRappLegale(riga: RigaTitolare): Promise<string> {
  const codiceFiscale = normalizeCF(riga.codice_fiscale);

  if (!codiceFiscale) {
    throw new Error("Codice fiscale obbligatorio.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("rapp_legali")
    .select("id")
    .eq("studio_id", studio_id)
    .eq("codice_fiscale", codiceFiscale)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Errore ricerca rappresentante legale.");
  }

  if (existing?.id) {
    return normalizeId(existing.id);
  }

  const payload = {
  studio_id: normalizeId(studio_id) || null,
  nome_cognome: normalizeText(riga.nome_cognome),
  codice_fiscale: codiceFiscale,
  comune_nascita: normalizeText(riga.luogo_nascita) || null,
  data_nascita: normalizeDateForInput(riga.data_nascita) || null,
  indirizzo_residenza: normalizeText(riga.indirizzo_residenza) || null,
  comune_residenza: normalizeText(riga.citta_residenza) || null,
  CAP: normalizeText(riga.cap_residenza) || null,
  nazionalita: normalizeText(riga.nazionalita) || null,
};
  const { data: inserted, error: insertError } = await supabase
    .from("rapp_legali")
    .insert([payload])
    .select("id")
    .single();

  if (insertError) {
    throw new Error(insertError.message || "Errore inserimento in rapp_legali.");
  }

  return normalizeId(inserted.id);
}

  function validateRows(): { ok: boolean; message?: string; normalizedRows: RigaTitolare[] } {
    const righeValide = righe
      .map((r) => ({
        ...r,
        nome_cognome: normalizeText(r.nome_cognome),
        codice_fiscale: normalizeCF(r.codice_fiscale),
        luogo_nascita: normalizeText(r.luogo_nascita),
        data_nascita: normalizeDateForInput(r.data_nascita),
        indirizzo_residenza: normalizeText(r.indirizzo_residenza),
        citta_residenza: normalizeText(r.citta_residenza),
        cap_residenza: normalizeText(r.cap_residenza),
        nazionalita: normalizeText(r.nazionalita),
      }))
      .filter(isMeaningfulRow);

    if (!righeValide.length) {
      return { ok: false, message: "Inserisci almeno un titolare effettivo.", normalizedRows: [] };
    }

    for (let i = 0; i < righeValide.length; i++) {
      const r = righeValide[i];

      if (!r.nome_cognome) {
        return {
          ok: false,
          message: `Cognome e nome obbligatorio per il titolare #${i + 1}.`,
          normalizedRows: [],
        };
      }

      if (!r.codice_fiscale) {
        return {
          ok: false,
          message: `Codice fiscale obbligatorio per "${r.nome_cognome}".`,
          normalizedRows: [],
        };
      }

      if (!isValidCF(r.codice_fiscale)) {
        return {
          ok: false,
          message: `Codice fiscale non valido per "${r.nome_cognome}".`,
          normalizedRows: [],
        };
      }

      if (isDuplicateTitolare(righeValide, r, i)) {
        return {
          ok: false,
          message: `Codice fiscale duplicato per "${r.nome_cognome}".`,
          normalizedRows: [],
        };
      }
    }

    return { ok: true, normalizedRows: righeValide };
  }

  async function salvaTitolari() {
    const validation = validateRows();

    if (!validation.ok) {
      alert(validation.message || "Dati titolari non validi.");
      return;
    }

    setSaving(true);

    try {
      const normalizedRows = validation.normalizedRows;
      const rowsWithRappId: RigaTitolare[] = [];

      for (const r of normalizedRows) {
        let rappId = normalizeId(r.rapp_legale_id);

        if (r.source_mode === "manual" || !rappId) {
          rappId = await findOrCreateRappLegale(r);
        }

        rowsWithRappId.push({
          ...r,
          rapp_legale_id: rappId,
        });
      }

      setRighe(rowsWithRappId);

      if (!normalizeId(av4_id)) {
        persistDraft();
        await loadRappresentanti();
        alert(
          "Titolari salvati in bozza. Ora puoi salvare il modello AV4 e poi premere di nuovo 'Salva titolari' per registrarli nella pratica."
        );
        return;
      }

      const records = rowsWithRappId.map((r) => ({
        av4_id: normalizeId(av4_id),
        studio_id: normalizeId(studio_id) || null,
        cliente_id: normalizeId(cliente_id) || null,
        sezione,
        rapp_legale_id: normalizeId(r.rapp_legale_id) || null,
        nome_cognome: r.nome_cognome,
        codice_fiscale: r.codice_fiscale,
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

      const { error: insertError } = await supabase.from("tbAV4_titolari").insert(records);

      if (insertError) {
        console.error("Errore salvataggio titolari:", insertError);
        alert("Errore salvataggio titolari.");
        return;
      }

      clearDraft();
      const reloaded = await loadSavedTitolari(normalizeId(av4_id));
      setRighe(reloaded);
      await loadRappresentanti();

      alert("Titolari salvati correttamente.");
    } catch (error: any) {
  console.error("Errore imprevisto salvataggio titolari:", error);
  alert(error?.message || "Errore durante il salvataggio dei titolari.");
} finally {
  setSaving(false);
}
  }

  const showDraftInfo = !normalizeId(av4_id);

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold">Titolari effettivi</h3>

        {(loadingRappresentanti || loadingSaved) && (
          <span className="text-sm text-gray-500">Caricamento...</span>
        )}
      </div>

      {showDraftInfo && (
        <div className="mb-4 rounded-md border bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Puoi inserire i titolari anche prima del salvataggio AV4. In questa fase vengono
          conservati in bozza e i nominativi manuali vengono registrati in{" "}
          <strong>rapp_legali</strong> quando premi <strong>Salva titolari</strong>.
        </div>
      )}

      {!righe.length && !loadingSaved && (
        <div className="mb-4 rounded-md border bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Nessun titolare presente per questa sezione.
        </div>
      )}

      {righe.map((riga, index) => {
        const isManual = riga.source_mode === "manual";

        return (
          <div
            key={`${riga.id || "new"}-${index}`}
            className="mb-4 rounded-lg border border-sky-200 bg-sky-50/40 p-3"
          >
            {!isManual && (
              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium">Seleziona nominativo</label>

                <select
                  value={normalizeId(riga.rapp_legale_id)}
                  onChange={(e) => selezionaRappresentante(index, e.target.value)}
                  className="w-full rounded border p-2"
                >
                  <option value="">Seleziona</option>

                  {rappresentanti.map((r) => (
                    <option key={normalizeId(r.id)} value={normalizeId(r.id)}>
                      {normalizeText(r.nome_cognome)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                
                <input
                value={riga.nome_cognome}
                onChange={(e) => updateRiga(index, { nome_cognome: e.target.value })}
                placeholder="Cognome e nome"
                className="w-full rounded border p-2"
                readOnly={!isManual}
                />
              </div>

              <div>
                <input
                  value={riga.codice_fiscale}
                  onChange={(e) => updateRiga(index, { codice_fiscale: e.target.value })}
                  placeholder="Codice fiscale"
                  className={`w-full rounded border p-2 ${
                    riga.error_codice_fiscale ? "border-red-500" : ""
                  }`}
                  readOnly={!isManual}
                  required
                />
                {riga.error_codice_fiscale && (
                  <p className="mt-1 text-xs text-red-600">{riga.error_codice_fiscale}</p>
                )}
              </div>

              <input
                value={riga.luogo_nascita}
                onChange={(e) => updateRiga(index, { luogo_nascita: e.target.value })}
                placeholder="Luogo nascita"
                className="rounded border p-2"
                readOnly={!isManual}
              />

              <input
                type="date"
                value={riga.data_nascita}
                onChange={(e) => updateRiga(index, { data_nascita: e.target.value })}
                placeholder="Data nascita"
                className="rounded border p-2"
                readOnly={!isManual}
              />

              <input
                value={riga.indirizzo_residenza}
                onChange={(e) => updateRiga(index, { indirizzo_residenza: e.target.value })}
                placeholder="Indirizzo residenza"
                className="rounded border p-2"
                readOnly={!isManual}
              />

              <input
                value={riga.citta_residenza}
                onChange={(e) => updateRiga(index, { citta_residenza: e.target.value })}
                placeholder="Città residenza"
                className="rounded border p-2"
                readOnly={!isManual}
              />

              <input
                value={riga.cap_residenza}
                onChange={(e) => updateRiga(index, { cap_residenza: e.target.value })}
                placeholder="CAP residenza"
                className="rounded border p-2"
                readOnly={!isManual}
              />

              <input
                value={riga.nazionalita}
                onChange={(e) => updateRiga(index, { nazionalita: e.target.value })}
                placeholder="Nazionalità"
                className="rounded border p-2"
                readOnly={!isManual}
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
        );
      })}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => aggiungiRiga("import")}
          className="rounded bg-gray-200 px-3 py-1"
        >
          + Aggiungi da nominativo
        </button>

        <button
          type="button"
          onClick={() => aggiungiRiga("manual")}
          className="rounded bg-gray-200 px-3 py-1"
        >
          + Aggiungi manualmente
        </button>

        <button
          type="button"
          onClick={salvaTitolari}
          disabled={saving}
          className="rounded bg-blue-600 px-3 py-1 text-white disabled:bg-gray-400"
        >
          {saving ? "Salvataggio..." : "Salva titolari"}
        </button>
      </div>
    </div>
  );
}

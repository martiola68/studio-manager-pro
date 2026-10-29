import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { sendRichiestaDocumentoRappresentante } from "@/services/rappresentantiDocumentiService";
import { Eye, Pencil, Trash2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  getMicrosoftConnectionsForUser,
  resolveMicrosoftConnectionId,
} from "@/services/microsoftConnectionsService";

type Rapp = {
  id: string;
  documento_aml_id: string;
  soggetto_cliente_id: string;

  studio_id: string;
  nome_cognome: string | null;
  codice_fiscale: string | null;
  email: string | null;
  tipo_doc: string | null;
  scadenza_doc: string | null;
  allegato_doc: string | null;
  rappresentante_legale: boolean | null;
  doc_richiesto_il?: string | null;
  microsoft_connection_id?: string | null;
  created_at?: string | null;
};

type RappPreview = {
  nome_cognome: string;
  codice_fiscale?: string | null;
  qualifica?: string | null;

  tipo_soggetto: "amministratore";

  rappresentante_legale?: boolean;

  gia_presente?: boolean;

  selected: boolean;
};

function formatDateEU(value: string | null | undefined) {
  if (!value) return "-";

  const onlyDate = value.includes("T") ? value.split("T")[0] : value;
  const parts = onlyDate.split("-");

  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getScadenzaStatus(
  value: string | null | undefined
): "missing" | "valid" | "expired" {
  if (!value) return "missing";

  const onlyDate = value.includes("T") ? value.split("T")[0] : value;
  const date = new Date(`${onlyDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "missing";

  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return date < todayOnly ? "expired" : "valid";
}

function PresenzaBadge({
  label,
  present,
}: {
  label?: string;
  present: boolean;
}) {
  return (
    <span
      className={`inline-flex min-w-[92px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium ${
        present ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {label || (present ? "Presente" : "Mancante")}
    </span>
  );
}

function RappLegaleText({ value }: { value: boolean | null | undefined }) {
  const isYes = value === true;

  return (
    <span
      className={`inline-flex min-w-[42px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        isYes ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
      }`}
    >
      {isYes ? "SI" : "NO"}
    </span>
  );
}

function ScadenzaCell({
  value,
  enabled,
}: {
  value: string | null | undefined;
  enabled: boolean;
}) {
  if (!enabled) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  const status = getScadenzaStatus(value);

  if (status === "missing") {
    return <span className="text-sm text-red-700">-</span>;
  }

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span
        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
          status === "valid" ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <span
        className={`text-sm shrink-0 ${
          status === "valid" ? "text-green-800" : "text-red-700"
        }`}
      >
        {formatDateEU(value)}
      </span>
    </div>
  );
}

function getRowAmlState(r: Rapp): "neutral" | "green" | "yellow" | "red" {
  if (!r.rappresentante_legale) return "neutral";

  const hasEmail = !!r.email?.trim();
  const hasTipoDoc = !!r.tipo_doc?.trim();
  const hasAllegato = !!r.allegato_doc?.trim();
  const scadenzaStatus = getScadenzaStatus(r.scadenza_doc);
  const hasRichiesta = !!r.doc_richiesto_il;

  const isComplete =
    hasEmail && hasTipoDoc && hasAllegato && scadenzaStatus === "valid";

  if (isComplete) return "green";
  if (hasRichiesta) return "yellow";
  return "red";
}

function getRowClassName(r: Rapp): string {
  const state = getRowAmlState(r);

  switch (state) {
    case "green":
      return "bg-green-50 hover:bg-green-100/70 border-green-200";
    case "yellow":
      return "bg-yellow-50 hover:bg-yellow-100/70 border-yellow-200";
    case "red":
      return "bg-red-50 hover:bg-red-100/70 border-red-200";
    default:
      return "hover:bg-muted/30";
  }
}

function isOlderThan7Days(value: string | null | undefined): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;

  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 7);
  return d <= threshold;
}

function shouldSendDocumentRequest(r: Rapp): boolean {
  if (r.rappresentante_legale !== true) return false;
  if (!r.email?.trim()) return false;
  if (!r.microsoft_connection_id?.trim()) return false;

  const hasValidDoc =
    !!r.allegato_doc?.trim() && getScadenzaStatus(r.scadenza_doc) === "valid";

  if (hasValidDoc) return false;

  const alreadyRequestedRecently =
    !!r.doc_richiesto_il && !isOlderThan7Days(r.doc_richiesto_il);

  if (alreadyRequestedRecently) return false;

  return true;
}

function getDocumentoFilterState(
  r: Rapp
): "mancante" | "richiesto" | "presente" | "scaduto" {
  const hasDoc = !!r.allegato_doc?.trim();
  const scadenzaStatus = getScadenzaStatus(r.scadenza_doc);

  if (hasDoc && scadenzaStatus === "valid") {
    return "presente";
  }

  if (hasDoc && scadenzaStatus === "expired") {
    return "scaduto";
  }

  if (r.doc_richiesto_il) {
    return "richiesto";
  }

  return "mancante";
}

export default function RappresentantiIndexPage() {
  const router = useRouter();

  const [studioId, setStudioId] = useState<string>("");
  const [rows, setRows] = useState<Rapp[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [documentoFilter, setDocumentoFilter] = useState<
  "tutti" | "mancante" | "richiesto" | "presente" | "scaduto"
  >("tutti");

  const [previewOpen, setPreviewOpen] = useState(false);
const [previewRows, setPreviewRows] = useState<RappPreview[]>([]);
const [previewStats, setPreviewStats] = useState<any>(null);

  const [microsoftConnections, setMicrosoftConnections] = useState<any[]>([]);
const [loadingMicrosoftConnections, setLoadingMicrosoftConnections] = useState(false);
  const [nomeOperatore, setNomeOperatore] = useState<string>("");

   useEffect(() => {
    if (router.query.saved === "1") {
      alert("Salvataggio eseguito con successo");
    }
  }, [router.query]);

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseClient() as any;

      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("studio_id");
        if (cached) {
          setStudioId(cached);
          return;
        }
      }

      const { data: auth } = await supabase.auth.getUser();
      const email = auth?.user?.email;
      if (!email) return;

   const { data, error } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("email", email)
      .single();

    if (!error) {
      const sid = data?.studio_id ? String((data as any).studio_id) : "";
      if (sid) {
        setStudioId(sid);

        if (typeof window !== "undefined") {
          localStorage.setItem("studio_id", sid);
        }
      }
    }
  };

  void run();
}, []);

  useEffect(() => {
  if (!studioId) return;

  let cancelled = false;

  const loadMicrosoftConnections = async () => {
    const supabase = getSupabaseClient() as any;
    setLoadingMicrosoftConnections(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id || "";
      if (!userId) return;

      const rows = await getMicrosoftConnectionsForUser(studioId, userId);

      if (!cancelled) {
        setMicrosoftConnections(rows || []);
      }
    } catch (error) {
      console.error("Errore caricamento connessioni Microsoft:", error);
    } finally {
      if (!cancelled) {
        setLoadingMicrosoftConnections(false);
      }
    }
  };

  void loadMicrosoftConnections();

  return () => {
    cancelled = true;
  };
}, [studioId]);

 const loadRappresentanti = useCallback(async () => {
  if (!studioId) return;

  setLoading(true);

  try {
    const response = await fetch(
      `/api/rapp-legali?studio_id=${encodeURIComponent(studioId)}`
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error || "Errore caricamento rappresentanti"
      );
    }

    setRows(result.data || []);
  } catch (error: any) {
    alert(error?.message || "Errore caricamento rappresentanti");
  } finally {
    setLoading(false);
  }
}, [studioId]);

  useEffect(() => {
    if (!studioId) return;
    void loadRappresentanti();
  }, [studioId, loadRappresentanti]);

 const filtered = useMemo(() => {
  const s = q.trim().toLowerCase();

  return rows.filter((r) => {
    const matchSearch =
      !s ||
      (r.nome_cognome || "").toLowerCase().includes(s) ||
      (r.email || "").toLowerCase().includes(s) ||
      (r.tipo_doc || "").toLowerCase().includes(s);

    const statoDocumento = getDocumentoFilterState(r);

    const matchDocumento =
      documentoFilter === "tutti"
        ? true
        : statoDocumento === documentoFilter;

    return matchSearch && matchDocumento;
  });
}, [rows, q, documentoFilter]);

  async function handleOpenDoc(path: string) {
    try {
      const response = await fetch("/api/rapp-legali/open-doc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path }),
      });

      const raw = await response.text();

      let result: any;
      try {
        result = JSON.parse(raw);
      } catch {
        throw new Error(`La API non ha restituito JSON. Risposta: ${raw.slice(0, 300)}`);
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Errore apertura documento");
      }

      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      alert(error?.message || "Errore apertura documento");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminare questo rappresentante?")) return;

    try {
      const response = await fetch("/api/rapp-legali/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Errore eliminazione rappresentante");
      }

      setRows((prev) => prev.filter((r) => r.id !== id));
      alert("Rappresentante eliminato correttamente");
    } catch (error: any) {
      alert(error?.message || "Errore eliminazione rappresentante");
    }
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden p-3">
      <Card className="min-w-0 w-full max-w-full overflow-hidden">
              <CardContent className="min-w-0 w-full max-w-full space-y-3 px-3 pb-3 pt-0">
        <div className="flex w-full min-w-0 flex-col gap-2 md:flex-row">
  <Input
    placeholder="Cerca per cognome e nome, email, tipo documento..."
    value={q}
    onChange={(e) => setQ(e.target.value)}
    className="h-9 min-w-0 flex-1 text-sm"
  />

  <Select
    value={documentoFilter}
    onValueChange={(value: any) => setDocumentoFilter(value)}
  >
    <SelectTrigger className="h-9 w-full shrink-0 md:w-[220px]">
      <SelectValue placeholder="Filtro documento" />
    </SelectTrigger>

    <SelectContent>
      <SelectItem value="tutti">Tutti i documenti</SelectItem>
      <SelectItem value="mancante">Documento mancante</SelectItem>
      <SelectItem value="richiesto">Documento richiesto</SelectItem>
      <SelectItem value="presente">Documento presente</SelectItem>
      <SelectItem value="scaduto">Documento scaduto</SelectItem>
    </SelectContent>
  </Select>
</div>
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Caricamento elenco...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nessun rappresentante trovato.
            </div>
          ) : (
            <div className="w-full min-w-0 rounded-md border">
              <div className="w-full min-w-0">
                <div className="sticky top-0 z-10 hidden xl:grid-cols-[minmax(0,2.1fr)_minmax(0,0.78fr)_minmax(0,0.9fr)_minmax(0,1.22fr)_minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,1.13fr)_108px] items-center gap-2 border-b bg-muted/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide backdrop-blur xl:grid">
                  <div>Cognome e nome</div>
                  <div className="text-center">Rapp. legale</div>
                  <div>Email</div>
                  <div>Tipo documento</div>
                  <div>Scadenza documento</div>
                  <div>Doc. richiesto il</div>
                  <div>Documento allegato</div>
                  <div className="text-right">Azioni</div>
                </div>

                <div>
                  {filtered.map((r) => {
                    const isLegale = r.rappresentante_legale === true;

                    return (
                      <div
                        key={r.id}
                        className={`grid grid-cols-2 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,0.78fr)_minmax(0,0.9fr)_minmax(0,1.22fr)_minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,1.13fr)_108px] items-center gap-x-4 gap-y-2 border-b px-3 py-3 text-sm last:border-b-0 xl:gap-2 xl:py-2 ${getRowClassName(
                          r
                        )}`}
                      >
                        <div className="min-w-0 font-medium"><span className="mb-1 block text-[10px] uppercase text-slate-500 xl:hidden">Cognome e nome</span><span className="block truncate" title={r.nome_cognome || "-"}>{r.nome_cognome || "-"}</span></div>

                        <div className="min-w-0 xl:flex xl:justify-center"><span className="mb-1 block text-[10px] uppercase text-slate-500 xl:hidden">Rapp. legale</span><RappLegaleText value={r.rappresentante_legale} /></div>

                        <div className="min-w-0"><span className="mb-1 block text-[10px] uppercase text-slate-500 xl:hidden">Email</span>
                          {isLegale ? (
                            <PresenzaBadge present={!!r.email?.trim()} />
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>

                        <div className="min-w-0"><span className="mb-1 block text-[10px] uppercase text-slate-500 xl:hidden">Tipo documento</span><span className="block truncate">{isLegale ? r.tipo_doc || "-" : "-"}</span></div>

                        <div className="min-w-0"><span className="mb-1 block text-[10px] uppercase text-slate-500 xl:hidden">Scadenza documento</span>
                          <ScadenzaCell value={r.scadenza_doc} enabled={isLegale} />
                        </div>

                        <div className="min-w-0"><span className="mb-1 block text-[10px] uppercase text-slate-500 xl:hidden">Doc. richiesto il</span>
                          {isLegale ? (
                            <span className="text-sm">{formatDateEU(r.doc_richiesto_il)}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>

                        <div className="min-w-0"><span className="mb-1 block text-[10px] uppercase text-slate-500 xl:hidden">Documento allegato</span>
                          {isLegale ? (
                            <PresenzaBadge present={!!r.allegato_doc?.trim()} />
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>

                        <div className="flex min-w-0 items-center justify-start gap-1 xl:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Apri documento"
                            disabled={!r.allegato_doc}
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              if (r.allegato_doc) {
                                void handleOpenDoc(r.allegato_doc);
                              }
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            title="Modifica"
                            className="h-8 w-8 p-0"
                           onClick={() =>
                          router.push(
                          `/antiriciclaggio/rappresentanti/nuovo?id=${r.id}`
                            )
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            title="Elimina"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              void handleDelete(r.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-red-700">
                Stato AML rosso = documento mancante/scaduto e non richiesto
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-1 text-yellow-700">
                Stato AML giallo = richiesta inviata ma documentazione incompleta
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-green-700">
                Stato AML verde = documentazione completa e valida
              </span>
            </div>
          )}
        </CardContent>
      </Card>
  
     </div>
  );
}

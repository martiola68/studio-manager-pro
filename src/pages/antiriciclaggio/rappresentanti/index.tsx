import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendRichiestaDocumentoRappresentante } from "@/services/rappresentantiDocumentiService";
import { Eye, Pencil, Trash2 } from "lucide-react";

type Rapp = {
  id: string;
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

export default function RappresentantiIndexPage() {
  const router = useRouter();

  const [studioId, setStudioId] = useState<string>("");
  const [rows, setRows] = useState<Rapp[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [importingVisura, setImportingVisura] = useState(false);
  const [sendingMassivo, setSendingMassivo] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const loadRappresentanti = useCallback(async () => {
    if (!studioId) return;

    const supabase = getSupabaseClient() as any;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("rapp_legali")
        .select(
          "id, studio_id, nome_cognome, codice_fiscale, email, tipo_doc, scadenza_doc, allegato_doc, rappresentante_legale, doc_richiesto_il, microsoft_connection_id, created_at"
        )
        .eq("studio_id", studioId)
        .order("nome_cognome", { ascending: true });

      if (error) throw error;

      setRows((data || []) as Rapp[]);
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
    if (!s) return rows;

    return rows.filter(
      (r) =>
        (r.nome_cognome || "").toLowerCase().includes(s) ||
        (r.email || "").toLowerCase().includes(s) ||
        (r.tipo_doc || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

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

  async function handleImportVisura(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!studioId) {
      alert("Studio non disponibile");
      e.target.value = "";
      return;
    }

    try {
      setImportingVisura(true);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("studioId", studioId);

      const response = await fetch("/api/import-visura-rappresentanti", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Errore durante importazione visura");
      }

      await loadRappresentanti();

      const stats = result?.stats;

      if (stats) {
        alert(
          `Import completato.\n` +
            `Trovati nel PDF: ${stats.trovatiNelPdf ?? 0}\n` +
            `Validi con codice fiscale: ${stats.validiConCodiceFiscale ?? 0}\n` +
            `Unici per codice fiscale: ${stats.uniciPerCodiceFiscale ?? 0}\n` +
            `Duplicati interni PDF: ${stats.duplicatiInterniPdf ?? 0}\n` +
            `Già presenti in archivio: ${stats.giaPresentiInArchivio ?? 0}\n` +
            `Inseriti: ${stats.inseriti ?? 0}\n` +
            `Scartati senza codice fiscale: ${stats.scartatiSenzaCodiceFiscale ?? 0}`
        );
      } else {
        alert(
          `Import completato.\nInseriti: ${result.inserted ?? 0}\nDuplicati: ${result.duplicates ?? 0}\nScartati: ${result.skipped ?? 0}`
        );
      }
    } catch (error: any) {
      alert(error?.message || "Errore durante importazione visura");
    } finally {
      setImportingVisura(false);
      e.target.value = "";
    }
  }

  async function handleInvioMassivoRichiesteDocumento() {
    if (!studioId) {
      alert("studio_id non disponibile");
      return;
    }

    const candidati = rows.filter(shouldSendDocumentRequest);

    if (candidati.length === 0) {
      alert("Nessun rappresentante da contattare.");
      return;
    }

    if (
      !confirm(
        `Saranno inviate ${candidati.length} richieste documento ai rappresentanti legali con documento mancante/scaduto o con richiesta più vecchia di 7 giorni. Procedere?`
      )
    ) {
      return;
    }

    try {
      setSendingMassivo(true);

      let okCount = 0;
      let koCount = 0;
      const errori: string[] = [];

      for (const r of candidati) {
        try {
          await sendRichiestaDocumentoRappresentante({
            recordId: r.id,
            studioId,
            nomeDestinatario: r.nome_cognome || "Cliente",
            email: String(r.email || "").trim(),
            microsoftConnectionId: String(r.microsoft_connection_id || "").trim(),
            clienteId: null,
            av4Id: null,
            note: "Invio massivo richiesta documento da elenco rappresentanti",
          });

          okCount++;
      } catch (error: any) {
  koCount++;
  const msg =
    error?.message ||
    error?.error ||
    (typeof error === "string" ? error : JSON.stringify(error));
  errori.push(`${r.nome_cognome || r.id}: ${msg}`);
}
      }

      await loadRappresentanti();

     if (koCount > 0) {
  console.error("Errori invio massivo richieste documento:");
  errori.forEach((err, index) => {
    console.error(`${index + 1}. ${err}`);
  });
}

      alert(`Invio completato.\nEmail inviate: ${okCount}\nErrori: ${koCount}`);
    } catch (error: any) {
      alert(error?.message || "Errore durante l'invio massivo delle richieste.");
    } finally {
      setSendingMassivo(false);
    }
  }

  return (
    <div className="p-3">
      <Card>
        <CardHeader className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Antiriciclaggio • Rappresentanti</CardTitle>

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleImportVisura}
            />

            <Button
              type="button"
              variant="outline"
              disabled={importingVisura || !studioId}
              className="h-9 px-3 text-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {importingVisura ? "Importazione..." : "Importa visura"}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={sendingMassivo || !studioId}
              className="h-9 px-3 text-sm"
              onClick={() => {
                void handleInvioMassivoRichiesteDocumento();
              }}
            >
              {sendingMassivo ? "Invio richieste..." : "Invia richieste documenti"}
            </Button>

            <Button
              type="button"
              className="h-9 px-3 text-sm"
              onClick={() => router.push("/antiriciclaggio/rappresentanti/nuovo")}
            >
              Nuovo rappresentante
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 px-3 pb-3 pt-0">
          <Input
            placeholder="Cerca per cognome e nome, email, tipo documento..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 text-sm"
          />

          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Caricamento elenco...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nessun rappresentante trovato.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <div className="min-w-[1540px]">
                <div className="sticky top-0 z-10 grid grid-cols-[1.9fr_0.85fr_1.2fr_1.15fr_1fr_1fr_1.15fr_140px] items-center gap-3 border-b bg-muted/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur">
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
                        className={`grid grid-cols-[1.9fr_0.85fr_1.2fr_1.15fr_1fr_1fr_1.15fr_140px] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 ${getRowClassName(
                          r
                        )}`}
                      >
                        <div className="truncate font-medium">{r.nome_cognome || "-"}</div>

                        <div className="flex justify-center">
                          <RappLegaleText value={r.rappresentante_legale} />
                        </div>

                        <div>
                          {isLegale ? (
                            <PresenzaBadge present={!!r.email?.trim()} />
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>

                        <div className="truncate">{isLegale ? r.tipo_doc || "-" : "-"}</div>

                        <div className="min-w-[120px]">
                          <ScadenzaCell value={r.scadenza_doc} enabled={isLegale} />
                        </div>

                        <div className="min-w-[120px]">
                          {isLegale ? (
                            <span className="text-sm">{formatDateEU(r.doc_richiesto_il)}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>

                        <div className="min-w-[120px]">
                          {isLegale ? (
                            <PresenzaBadge present={!!r.allegato_doc?.trim()} />
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-1">
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
                              router.push(`/antiriciclaggio/rappresentanti/nuovo?id=${r.id}`)
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

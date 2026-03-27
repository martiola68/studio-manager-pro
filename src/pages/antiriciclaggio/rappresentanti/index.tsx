import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Pencil, Trash2, Check, X } from "lucide-react";

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
  created_at?: string | null;
};

function formatDateEU(value: string | null | undefined) {
  if (!value) return "-";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getScadenzaStatus(
  value: string | null | undefined
): "missing" | "valid" | "expired" {
  if (!value) return "missing";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "missing";

  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return date < todayOnly ? "expired" : "valid";
}

function EmailIndicator({ present }: { present: boolean }) {
  return present ? (
    <div className="flex items-center gap-2 text-green-600">
      <Check className="h-4 w-4" />
      <span className="text-sm">Presente</span>
    </div>
  ) : (
    <div className="flex items-center gap-2 text-red-600">
      <X className="h-4 w-4" />
      <span className="text-sm">Mancante</span>
    </div>
  );
}

function ScadenzaIndicator({ value }: { value: string | null | undefined }) {
  const status = getScadenzaStatus(value);

  if (status === "missing") {
    return <span className="text-sm whitespace-nowrap">-</span>;
  }

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span
        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
          status === "valid" ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <span className="text-sm shrink-0">{formatDateEU(value)}</span>
    </div>
  );
}

function AllegatoIndicator({ present }: { present: boolean }) {
  if (present) {
    return (
      <div className="flex min-w-[140px] items-center gap-2 whitespace-nowrap text-green-600">
        <Check className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium shrink-0">Presente</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-[140px] items-center gap-2 whitespace-nowrap text-red-600">
      <X className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium shrink-0">Mancante</span>
    </div>
  );
}

function RappLegaleIndicator({ value }: { value: boolean | null | undefined }) {
  return value ? (
    <div className="flex items-center justify-center text-green-600">
      <Check className="h-4 w-4" />
    </div>
  ) : (
    <div className="flex items-center justify-center text-muted-foreground">-</div>
  );
}

export default function RappresentantiIndexPage() {
  const router = useRouter();

  const [studioId, setStudioId] = useState<string>("");
  const [rows, setRows] = useState<Rapp[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [importingVisura, setImportingVisura] = useState(false);

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
          "id, studio_id, nome_cognome, codice_fiscale, email, tipo_doc, scadenza_doc, allegato_doc, rappresentante_legale, created_at"
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
        (r.codice_fiscale || "").toLowerCase().includes(s) ||
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
              className="h-9 px-3 text-sm"
              onClick={() => router.push("/antiriciclaggio/rappresentanti/nuovo")}
            >
              Nuovo rappresentante
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 px-3 pb-3 pt-0">
          <Input
            placeholder="Cerca per cognome e nome, CF, email, tipo documento..."
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
              <div className="min-w-[1450px]">
<div className="sticky top-0 z-10 grid grid-cols-[1.9fr_1.35fr_1.15fr_1fr_1fr_1.15fr_90px_120px] items-center gap-3 border-b bg-muted/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur"</div>
                  <div>Cognome e nome</div>
                  <div>Codice fiscale</div>
                  <div>Email</div>
                  <div>Tipo documento</div>
                  <div>Scadenza documento</div>
                  <div>Documento allegato</div>
                  <div className="text-center">Rapp. legale</div>
                  <div className="text-right">Azioni</div>
                </div>

                <div>
                  {filtered.map((r) => (
                    <div
                      key={r.id}
                      className="grid grid-cols-[2fr_1.4fr_1.4fr_1.2fr_1.2fr_1.7fr_120px_120px] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/30"
                    >
                      <div className="truncate font-medium">{r.nome_cognome || "-"}</div>
                      <div className="truncate">{r.codice_fiscale || "-"}</div>
                      <div>
                        <EmailIndicator present={!!r.email} />
                      </div>
                      <div className="truncate">{r.tipo_doc || "-"}</div>
                      <div className="min-w-[120px]">
                        <ScadenzaIndicator value={r.scadenza_doc} />
                      </div>
                      <div className="min-w-[160px]">
                        <AllegatoIndicator present={!!r.allegato_doc} />
                      </div>
                      <div className="flex justify-center">
                        <RappLegaleIndicator value={r.rappresentante_legale} />
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
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

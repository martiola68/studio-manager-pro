import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Pencil, Trash2 } from "lucide-react";

type Rapp = {
  id: string;
  studio_id: string;
  nome_cognome: string | null;
  codice_fiscale: string | null;
  tipo_doc: string | null;
  scadenza_doc: string | null;
  allegato_doc: string | null;
  created_at?: string | null;
};

function formatDateEU(value: string | null | undefined) {
  if (!value) return "-";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function RappresentantiIndexPage() {
  const router = useRouter();
  const [studioId, setStudioId] = useState<string>("");
  const [rows, setRows] = useState<Rapp[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

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

    const load = async () => {
      const supabase = getSupabaseClient() as any;
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("rapp_legali")
          .select(
            "id, studio_id, nome_cognome, codice_fiscale, tipo_doc, scadenza_doc, allegato_doc, created_at"
          )
          .eq("studio_id", studioId)
          .order("nome_cognome", { ascending: true });

        if (error) throw error;
        setRows((data || []) as Rapp[]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [studioId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter(
      (r) =>
        (r.nome_cognome || "").toLowerCase().includes(s) ||
        (r.codice_fiscale || "").toLowerCase().includes(s) ||
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

      const result = await response.json();

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
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Anticiclaggio • Rappresentanti</CardTitle>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() =>
                router.push("/antiriciclaggio/rappresentanti/nuovo")
              }
            >
              Nuovo rappresentante
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input
            placeholder="Cerca per cognome e nome, CF, tipo documento..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {loading ? (
            <div className="py-10 text-center text-muted-foreground">
              Caricamento elenco...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              Nessun rappresentante trovato.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <div
                  key={r.id}
                  className="border rounded-md p-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_1.4fr_1.2fr_1.2fr_1.2fr_auto] gap-4 items-center">
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Cognome e nome
                      </div>
                      <div className="font-medium">{r.nome_cognome || "-"}</div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground">
                        Codice fiscale
                      </div>
                      <div>{r.codice_fiscale || "-"}</div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground">
                        Tipo documento
                      </div>
                      <div>{r.tipo_doc || "-"}</div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground">
                        Scadenza documento
                      </div>
                      <div>{formatDateEU(r.scadenza_doc)}</div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground">
                        Documento allegato
                      </div>
                      <div>{r.allegato_doc ? "Presente" : "-"}</div>
                    </div>

                    <div className="flex items-center gap-2 md:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="Apri documento"
                        disabled={!r.allegato_doc}
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
                        onClick={() => {
                          void handleDelete(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// src/pages/antiriciclaggio/rappresentanti/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Search, Pencil, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Nota: se il tipo "rapp_legali" non è presente nei types generati,
 * teniamo un type locale minimale.
 */
type RappLegale = {
  id: string;
  studio_id: string;
  nome_cognom: string | null;
  codice_fiscale: string | null;
  tipo_doc: string | null;
  scadenza_doc: string | null; // date string
  allegato_doc: string | null; // PATH nel bucket (stabile) o URL
  created_at?: string | null;
};

function normalizeText(s: string) {
  return (s || "").trim().toLowerCase();
}

export default function RappresentantiIndexPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [studioId, setStudioId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [rows, setRows] = useState<RappLegale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog modifica nominativo
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<RappLegale | null>(null);
  const [newNome, setNewNome] = useState("");

  /* =========================================================
     STUDIO_ID: localStorage -> tbutenti (via email)
     ========================================================= */
  useEffect(() => {
    const loadStudioId = async () => {
      try {
        // 1) localStorage
        if (typeof window !== "undefined") {
          const cached = localStorage.getItem("studio_id");
          if (cached) {
            setStudioId(cached);
            return;
          }
        }

        // 2) utente loggato
        const supabase = getSupabaseClient();
        const { data: auth } = await supabase.auth.getUser();
        const email = auth?.user?.email;

        if (!email) {
          toast({
            title: "Errore",
            description: "Utente non loggato: impossibile recuperare studio_id.",
            variant: "destructive",
          });
          router.push("/login");
          return;
        }

        // 3) tbutenti via email
        const { data, error } = await supabase
          .from("tbutenti")
          .select("studio_id")
          .eq("email", email)
          .single();

        if (error) {
          toast({
            title: "Errore",
            description: `Errore lettura tbutenti: ${error.message}`,
            variant: "destructive",
          });
          return;
        }

        const sid = data?.studio_id ? String((data as any).studio_id) : "";
        if (!sid) {
          toast({
            title: "Errore",
            description: "studio_id non presente in tbutenti per questo utente.",
            variant: "destructive",
          });
          return;
        }

        setStudioId(sid);
        if (typeof window !== "undefined") {
          localStorage.setItem("studio_id", sid);
        }
      } catch (e) {
        toast({
          title: "Errore",
          description: "Impossibile inizializzare la pagina.",
          variant: "destructive",
        });
      }
    };

    void loadStudioId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================================================
     LOAD LIST
     ========================================================= */
  useEffect(() => {
    if (!studioId) return;

    const load = async () => {
      const supabase = getSupabaseClient();
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("rapp_legali")
          .select("id, studio_id, nome_cognom, codice_fiscale, tipo_doc, scadenza_doc, allegato_doc, created_at")
          .eq("studio_id", studioId)
          .order("nome_cognom", { ascending: true });

        if (error) throw error;

        setRows((data || []) as RappLegale[]);
      } catch (e: any) {
        console.error(e);
        toast({
          title: "Errore",
          description: e?.message ?? "Impossibile caricare i rappresentanti.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioId]);

  /* =========================================================
     FILTER (solo nominativo in alto)
     ========================================================= */
  const filtered = useMemo(() => {
    const term = normalizeText(searchTerm);
    if (!term) return rows;

    return rows.filter((r) => normalizeText(r.nome_cognom || "").includes(term));
  }, [rows, searchTerm]);

  /* =========================================================
     DOCUMENT OPEN (allegato_doc può essere path)
     ========================================================= */
  const handleOpenDoc = async (pathOrUrl: string) => {
    if (!pathOrUrl) return;

    // Se sembra già un URL, aprilo e basta
    if (/^https?:\/\//i.test(pathOrUrl)) {
      window.open(pathOrUrl, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const resp = await fetch(`/api/rapp-doc/url?path=${encodeURIComponent(pathOrUrl)}`);
      const json = await resp.json();

      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error ?? "Impossibile aprire il documento");
      }

      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e?.message ?? "Errore apertura documento",
        variant: "destructive",
      });
    }
  };

  /* =========================================================
     EDIT NOMINATIVO
     ========================================================= */
  const openEdit = (r: RappLegale) => {
    setEditing(r);
    setNewNome(r.nome_cognom || "");
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditing(null);
    setNewNome("");
  };

  const saveEdit = async () => {
    if (!editing) return;

    const nome = newNome.trim();
    if (!nome) {
      toast({
        title: "Errore",
        description: "Il nominativo è obbligatorio.",
        variant: "destructive",
      });
      return;
    }

    const supabase = getSupabaseClient();
    try {
      const { error } = await (supabase as any)
        .from("rapp_legali")
        .update({ nome_cognom: nome })
        .eq("id", editing.id);

      if (error) throw error;

      setRows((prev) =>
        prev
          .map((x) => (x.id === editing.id ? { ...x, nome_cognom: nome } : x))
          .sort((a, b) => (a.nome_cognom || "").localeCompare(b.nome_cognom || "", "it", { sensitivity: "base" }))
      );

      toast({ title: "Successo", description: "Nominativo aggiornato." });
      closeEdit();
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e?.message ?? "Impossibile salvare la modifica.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {/* RICERCA (come immagine 2) */}
      <Card>
        <CardHeader>
          <CardTitle>Ricerca e Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 bg-white border rounded-md px-3 py-2">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca per nominativo..."
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </CardContent>
      </Card>

      {/* TABELLA FORM */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Elenco Rappresentanti</CardTitle>

          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={() => router.push("/antiriciclaggio/rappresentanti/nuovo")}>
              Nuovo
            </Button>
            <Button variant="outline" type="button" onClick={() => router.push("/antiriciclaggio")}>
              Torna al menù
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-lg border overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[260px]">Nome e Cognome</TableHead>
                  <TableHead className="min-w-[190px]">Codice Fiscale</TableHead>
                  <TableHead className="min-w-[180px]">Tipo documento</TableHead>
                  <TableHead className="min-w-[160px]">Scadenza documento</TableHead>
                  <TableHead className="min-w-[180px]">Allegato documento</TableHead>
                  <TableHead className="w-[180px] text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Caricamento in corso...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Nessun rappresentante trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nome_cognom || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">{r.codice_fiscale || "-"}</TableCell>
                      <TableCell className="text-sm">{r.tipo_doc || "-"}</TableCell>
                      <TableCell className="text-sm">
                        {r.scadenza_doc ? String(r.scadenza_doc).substring(0, 10) : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.allegato_doc ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => void handleOpenDoc(r.allegato_doc as string)}
                          >
                            <ExternalLink className="w-4 h-4" />
                            Apri allegato
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="w-4 h-4" />
                          Modifica nominativo
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* DIALOG MODIFICA NOMINATIVO */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica nominativo</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome_cognom">Nome e Cognome</Label>
              <Input
                id="nome_cognom"
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                placeholder="Es. Mario Rossi"
              />
            </div>

            {editing?.codice_fiscale ? (
              <p className="text-xs text-muted-foreground">
                CF: <span className="font-mono">{editing.codice_fiscale}</span>
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEdit}>
              Annulla
            </Button>
            <Button type="button" onClick={() => void saveEdit()}>
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

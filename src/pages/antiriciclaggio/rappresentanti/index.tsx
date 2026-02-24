import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Rapp = {
  id: string;
  studio_id: string;
  nome_cognom: string | null;
  codice_fiscale: string | null;
  nazionalita: string | null;
  created_at?: string | null;
};

export default function RappresentantiIndexPage() {
  const router = useRouter();
  const [studioId, setStudioId] = useState<string>("");
  const [rows, setRows] = useState<Rapp[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // 1) studio_id (stessa logica del form)
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
          if (typeof window !== "undefined") localStorage.setItem("studio_id", sid);
        }
      }
    };

    void run();
  }, []);

  // 2) load elenco
  useEffect(() => {
    if (!studioId) return;

    const load = async () => {
      const supabase = getSupabaseClient() as any;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("rapp_legali")
          .select("id, studio_id, nome_cognom, codice_fiscale, nazionalita, created_at")
          .eq("studio_id", studioId)
          .order("nome_cognom", { ascending: true });

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
    return rows.filter(r =>
      (r.nome_cognom || "").toLowerCase().includes(s) ||
      (r.codice_fiscale || "").toLowerCase().includes(s) ||
      (r.nazionalita || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questo rappresentante?")) return;
    const supabase = getSupabaseClient() as any;

    const { error } = await supabase
      .from("rapp_legali")
      .delete()
      .eq("id", id)
      .eq("studio_id", studioId);

    if (!error) {
      setRows(prev => prev.filter(r => r.id !== id));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Anticiclaggio • Rappresentanti</CardTitle>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/antiriciclaggio")}>
              Torna al menù
            </Button>
            <Button onClick={() => router.push("/antiriciclaggio/rappresentanti/nuovo")}>
              Nuovo rappresentante
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input
            placeholder="Cerca per nome, CF, nazionalità…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Caricamento elenco...</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Nessun rappresentante trovato.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-2 border rounded-md p-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.nome_cognom || "-"}</div>
                    <div className="text-sm text-muted-foreground">
                      CF: {r.codice_fiscale || "-"} • Nazionalità: {r.nazionalita || "-"}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push(`/antiriciclaggio/rappresentanti/${r.id}`)}>
                      Modifica
                    </Button>
                    <Button variant="destructive" onClick={() => handleDelete(r.id)}>
                      Elimina
                    </Button>
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

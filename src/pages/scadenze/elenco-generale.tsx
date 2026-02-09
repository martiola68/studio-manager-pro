import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";
import { Search, Loader2 } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];

export default function ElencoGenerale() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [filteredClienti, setFilteredClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadClienti();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredClienti(clienti);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = clienti.filter(cliente =>
        cliente.ragione_sociale?.toLowerCase().includes(query) ||
        cliente.codice_fiscale?.toLowerCase().includes(query) ||
        cliente.partita_iva?.toLowerCase().includes(query)
      );
      setFilteredClienti(filtered);
    }
  }, [searchQuery, clienti]);

  async function loadClienti() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", user.id)
        .single();

      if (!userData?.studio_id) return;

      const { data, error } = await supabase
        .from("tbclienti")
        .select("*")
        .eq("studio_id", userData.studio_id)
        .order("ragione_sociale", { ascending: true });

      if (error) throw error;

      setClienti(data || []);
      setFilteredClienti(data || []);
    } catch (error) {
      console.error("Errore caricamento clienti:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateScadenzario(clienteId: string, field: keyof Cliente, value: boolean) {
    try {
      setUpdating(clienteId);

      const { error } = await supabase
        .from("tbclienti")
        .update({ [field]: value })
        .eq("id", clienteId);

      if (error) throw error;

      setClienti(prev =>
        prev.map(c => (c.id === clienteId ? { ...c, [field]: value } : c))
      );
    } catch (error) {
      console.error("Errore aggiornamento scadenzario:", error);
    } finally {
      setUpdating(null);
    }
  }

  const scadenzari = [
    { label: "LIPE", field: "flag_lipe" as keyof Cliente },
    { label: "Bilancio", field: "flag_bilancio" as keyof Cliente },
    { label: "IVA", field: "flag_iva" as keyof Cliente },
    { label: "CCGG", field: "flag_ccgg" as keyof Cliente },
    { label: "Esterometro", field: "flag_esterometro" as keyof Cliente },
    { label: "770", field: "flag_770" as keyof Cliente },
    { label: "Fiscali", field: "flag_fiscali" as keyof Cliente },
    { label: "IMU", field: "flag_imu" as keyof Cliente }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Elenco Generale Scadenzari</h1>
          <p className="text-gray-500 mt-1">Visione completa degli scadenzari per ogni cliente</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Clienti e Scadenzari ({filteredClienti.length})</CardTitle>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Cerca cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="sticky top-0 z-20 bg-white border-b">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-30 bg-white border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[300px] min-w-[300px] max-w-[300px]">Ragione Sociale</TableHead>
                      <TableHead className="min-w-[150px]">Utente Fiscale</TableHead>
                      <TableHead className="min-w-[150px]">Utente Parola</TableHead>
                      {scadenzari.map(scad => (
                        <TableHead key={scad.field} className="text-center min-w-[100px]">
                          {scad.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableBody>
                    {filteredClienti.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                          Nessun cliente trovato
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredClienti.map(cliente => (
                        <TableRow key={cliente.id}>
                          <TableCell className="sticky left-0 z-10 bg-white border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-medium w-[300px] min-w-[300px] max-w-[300px]">
                            {cliente.ragione_sociale || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 min-w-[150px]">
                            {cliente.utente_fiscale || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 min-w-[150px]">
                            {cliente.utente_parola || "-"}
                          </TableCell>
                          {scadenzari.map(scad => (
                            <TableCell key={scad.field} className="text-center min-w-[100px]">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={cliente[scad.field] as boolean || false}
                                  onCheckedChange={(checked) =>
                                    updateScadenzario(cliente.id, scad.field, checked as boolean)
                                  }
                                  disabled={updating === cliente.id}
                                />
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
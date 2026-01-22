import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileSpreadsheet, Download, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];

export default function AntiriciclaggioPage() {
  const { toast } = useToast();
  const [scadenze, setScadenze] = useState<Cliente[]>([]);
  const [filteredScadenze, setFilteredScadenze] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadScadenze = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tbclienti")
        .select("*")
        .eq("gestione_antiriciclaggio", true)
        .order("ragione_sociale");

      if (error) throw error;

      setScadenze(data || []);
      setFilteredScadenze(data || []);
    } catch (error) {
      console.error("Errore caricamento scadenze:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare lo scadenzario antiriciclaggio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScadenze();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredScadenze(scadenze);
    } else {
      const lowerSearch = searchTerm.toLowerCase();
      const filtered = scadenze.filter(
        (s) =>
          s.ragione_sociale?.toLowerCase().includes(lowerSearch) ||
          s.codice_fiscale?.toLowerCase().includes(lowerSearch) ||
          s.partita_iva?.toLowerCase().includes(lowerSearch)
      );
      setFilteredScadenze(filtered);
    }
  }, [searchTerm, scadenze]);

  const exportExcel = () => {
    const dataToExport = filteredScadenze.map((s) => ({
      "Cliente": s.ragione_sociale,
      "Prestazione A": s.tipo_prestazione_a,
      "Rischio A": s.rischio_ver_a,
      "Data Verifica A": s.data_ultima_verifica_antiric ? format(new Date(s.data_ultima_verifica_antiric), "dd/MM/yyyy") : "",
      "Scadenza A": s.scadenza_antiric ? format(new Date(s.scadenza_antiric), "dd/MM/yyyy") : "",
      "Prestazione B": s.tipo_prestazione_b,
      "Rischio B": s.rischio_ver_b,
      "Data Verifica B": s.data_ultima_verifica_b ? format(new Date(s.data_ultima_verifica_b), "dd/MM/yyyy") : "",
      "Scadenza B": s.scadenza_antiric_b ? format(new Date(s.scadenza_antiric_b), "dd/MM/yyyy") : "",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Antiriciclaggio");
    XLSX.writeFile(wb, "Scadenze_Antiriciclaggio.xlsx");
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "dd/MM/yyyy", { locale: it });
  };

  const getRiskBadge = (risk: string | null) => {
    if (!risk) return <Badge variant="outline">-</Badge>;
    
    switch (risk) {
      case "Molto significativo":
        return <Badge variant="destructive">Alto</Badge>;
      case "Abbastanza significativo":
        return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">Medio</Badge>;
      case "Poco significativo":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Basso</Badge>;
      case "Non significativo":
        return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200">Minimo</Badge>;
      default:
        return <Badge variant="outline">{risk}</Badge>;
    }
  };

  return (
    <main className="flex-1 overflow-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scadenzario Antiriciclaggio</h1>
          <p className="text-muted-foreground mt-2">
            Gestione delle scadenze per l'adeguata verifica della clientela
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadScadenze} title="Aggiorna">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" onClick={exportExcel} className="gap-2">
            <Download className="h-4 w-4" />
            Esporta Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clienti in Gestione
            </CardTitle>
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{scadenze.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Totale posizioni attive
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-lg shadow border">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Cliente</TableHead>
                <TableHead className="w-[200px]">Prestazione A</TableHead>
                <TableHead className="w-[120px]">Rischio A</TableHead>
                <TableHead className="w-[120px]">Data Verifica A</TableHead>
                <TableHead className="w-[120px]">Scadenza A</TableHead>
                <TableHead className="w-[200px]">Prestazione B</TableHead>
                <TableHead className="w-[120px]">Rischio B</TableHead>
                <TableHead className="w-[120px]">Data Verifica B</TableHead>
                <TableHead className="w-[120px]">Scadenza B</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Caricamento dati in corso...
                  </TableCell>
                </TableRow>
              ) : filteredScadenze.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nessun cliente trovato con gestione antiriciclaggio attiva
                  </TableCell>
                </TableRow>
              ) : (
                filteredScadenze.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.ragione_sociale}
                      <div className="text-xs text-muted-foreground">{row.codice_fiscale}</div>
                    </TableCell>
                    
                    {/* Blocco A */}
                    <TableCell className="text-sm text-muted-foreground">
                      {row.tipo_prestazione_a || "-"}
                    </TableCell>
                    <TableCell>
                      {getRiskBadge(row.rischio_ver_a)}
                    </TableCell>
                    <TableCell>
                      {formatDate(row.data_ultima_verifica_antiric)}
                    </TableCell>
                    <TableCell className={row.scadenza_antiric && new Date(row.scadenza_antiric) < new Date() ? "text-red-600 font-bold" : ""}>
                      {formatDate(row.scadenza_antiric)}
                    </TableCell>

                    {/* Blocco B */}
                    <TableCell className="text-sm text-muted-foreground">
                      {row.tipo_prestazione_b || "-"}
                    </TableCell>
                    <TableCell>
                      {getRiskBadge(row.rischio_ver_b)}
                    </TableCell>
                    <TableCell>
                      {formatDate(row.data_ultima_verifica_b)}
                    </TableCell>
                    <TableCell className={row.scadenza_antiric_b && new Date(row.scadenza_antiric_b) < new Date() ? "text-red-600 font-bold" : ""}>
                      {formatDate(row.scadenza_antiric_b)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
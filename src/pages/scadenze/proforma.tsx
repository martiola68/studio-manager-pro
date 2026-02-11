import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

// TypeScript types
type ScadenzaProformaRow = {
  id: string;
  nominativo: string | null;
  utente_operatore_id: string | null;
  utente_professionista_id: string | null;
  gennaio: boolean | null;
  febbraio: boolean | null;
  marzo: boolean | null;
  aprile: boolean | null;
  maggio: boolean | null;
  giugno: boolean | null;
  luglio: boolean | null;
  agosto: boolean | null;
  settembre: boolean | null;
  ottobre: boolean | null;
  novembre: boolean | null;
  dicembre: boolean | null;
};

type ScadenzaProforma = ScadenzaProformaRow & {
  operatore_nome?: string;
  professionista_nome?: string;
};

type Utente = {
  id: string;
  nome: string | null;
  cognome: string | null;
};

export default function ScadenzarioProforma() {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [scadenze, setScadenze] = useState<ScadenzaProforma[]>([]);
  const [filteredScadenze, setFilteredScadenze] = useState<ScadenzaProforma[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Filters
  const [searchNominativo, setSearchNominativo] = useState("");
  const [filterOperatore, setFilterOperatore] = useState<string>("all");
  const [filterProfessionista, setFilterProfessionista] = useState<string>("all");

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Apply filters
  useEffect(() => {
    applyFilters();
  }, [scadenze, searchNominativo, filterOperatore, filterProfessionista]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadScadenze(), loadUtenti()]);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadScadenze = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("tbscadproforma")
        .select(`
          *,
          operatore:tbutenti!tbscadproforma_utente_operatore_id_fkey(id, nome, cognome),
          professionista:tbutenti!tbscadproforma_utente_professionista_id_fkey(id, nome, cognome)
        `)
        .order("nominativo", { ascending: true });

      if (error) throw error;

      const mapped: ScadenzaProforma[] = (data || []).map((row: any) => ({
        ...row,
        operatore_nome: row.operatore ? `${row.operatore.nome || ""} ${row.operatore.cognome || ""}`.trim() : undefined,
        professionista_nome: row.professionista ? `${row.professionista.nome || ""} ${row.professionista.cognome || ""}`.trim() : undefined
      }));

      setScadenze(mapped);
    } catch (error: any) {
      toast({
        title: "Errore caricamento scadenze",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const loadUtenti = async () => {
    try {
      const { data, error } = await supabase
        .from("tbutenti")
        .select("id, nome, cognome")
        .order("cognome", { ascending: true });

      if (error) throw error;
      setUtenti(data || []);
    } catch (error: any) {
      toast({
        title: "Errore caricamento utenti",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const applyFilters = () => {
    let filtered = [...scadenze];

    // Filter by nominativo
    if (searchNominativo.trim()) {
      const search = searchNominativo.toLowerCase();
      filtered = filtered.filter(s =>
        s.nominativo?.toLowerCase().includes(search)
      );
    }

    // Filter by operatore
    if (filterOperatore !== "all") {
      filtered = filtered.filter(s => s.utente_operatore_id === filterOperatore);
    }

    // Filter by professionista
    if (filterProfessionista !== "all") {
      filtered = filtered.filter(s => s.utente_professionista_id === filterProfessionista);
    }

    setFilteredScadenze(filtered);
  };

  const updateField = async (id: string, field: keyof ScadenzaProformaRow, value: any) => {
    try {
      setSaving(id);

      const { error } = await (supabase as any)
        .from("tbscadproforma")
        .update({ [field]: value })
        .eq("id", id);

      if (error) throw error;

      // Update local state
      setScadenze(prev =>
        prev.map(s => (s.id === id ? { ...s, [field]: value } : s))
      );

      toast({
        title: "Salvato",
        description: "Modifica salvata con successo"
      });
    } catch (error: any) {
      toast({
        title: "Errore salvataggio",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(null);
    }
  };

  const handleCheckboxChange = (id: string, field: keyof ScadenzaProformaRow, currentValue: boolean | null) => {
    const newValue = !currentValue;
    updateField(id, field, newValue);
  };

  const handleUtenteChange = (id: string, field: "utente_operatore_id" | "utente_professionista_id", value: string) => {
    const finalValue = value === "none" ? null : value;
    updateField(id, field, finalValue);
  };

  // Stats
  const totalScadenze = scadenze.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavBar />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavBar />

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario PROFORMA</h1>
          <p className="text-gray-600 mt-1">Gestione scadenze PROFORMA mensili</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Totale Record</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{totalScadenze}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtri e Ricerca</CardTitle>
            <CardDescription>Filtra le scadenze per nominativo o utente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search Nominativo */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Cerca Nominativo</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Cerca per nominativo..."
                    value={searchNominativo}
                    onChange={(e) => setSearchNominativo(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Filter Operatore */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Utente Operatore</label>
                <Select value={filterOperatore} onValueChange={setFilterOperatore}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutti gli operatori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti gli operatori</SelectItem>
                    {utenti.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome} {u.cognome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Professionista */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Utente Professionista</label>
                <Select value={filterProfessionista} onValueChange={setFilterProfessionista}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutti i professionisti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i professionisti</SelectItem>
                    {utenti.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome} {u.cognome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reset Filters */}
            {(searchNominativo || filterOperatore !== "all" || filterProfessionista !== "all") && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchNominativo("");
                    setFilterOperatore("all");
                    setFilterProfessionista("all");
                  }}
                >
                  Reimposta filtri
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="sticky-col-header text-left p-3 font-semibold text-sm border-r">Nominativo</th>
                    <th className="text-left p-3 font-semibold text-sm border-r min-w-[150px]">Professionista</th>
                    <th className="text-left p-3 font-semibold text-sm border-r min-w-[150px]">Operatore</th>
                    <th className="text-center p-3 font-semibold text-sm border-r min-w-[100px]">Gennaio</th>
                    <th className="text-center p-3 font-semibold text-sm border-r min-w-[100px]">Febbraio</th>
                    <th className="text-center p-3 font-semibold text-sm border-r min-w-[100px]">Marzo</th>
                    <th className="text-center p-3 font-semibold text-sm border-r min-w-[100px]">Aprile</th>
                    <th className="text-center p-3 font-semibold text-sm border-r min-w-[100px]">Maggio</th>
                    <th className="text-center p-3 font-semibold text-sm border-r min-w-[100px]">Giugno</th>
                    <th className="text-center p-3 font-semibold text-sm border-r min-w-[100px]">Luglio</th>
                    <th className="text-center p-3 font-semibold text-sm border-r min-w-[100px]">Agosto</th>
                    <th className="text-center p-3 font-semibold text-sm border-r min-w-[100px]">Settembre</th>
                    <th className="text-center p-3 font-semibold text-sm border-r min-w-[100px]">Ottobre</th>
                    <th className="text-center p-3 font-semibold text-sm border-r min-w-[100px]">Novembre</th>
                    <th className="text-center p-3 font-semibold text-sm min-w-[100px]">Dicembre</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScadenze.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="text-center p-8 text-gray-500">
                        Nessuna scadenza trovata
                      </td>
                    </tr>
                  ) : (
                    filteredScadenze.map((scadenza) => (
                      <tr key={scadenza.id} className="border-b hover:bg-gray-50">
                        {/* Nominativo - Sticky Column */}
                        <td className="sticky-col-cell p-3 border-r font-medium">
                          {scadenza.nominativo || "-"}
                        </td>

                        {/* Professionista */}
                        <td className="p-3 border-r">
                          <Select
                            value={scadenza.utente_professionista_id || "none"}
                            onValueChange={(value) => handleUtenteChange(scadenza.id, "utente_professionista_id", value)}
                            disabled={saving === scadenza.id}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {scadenza.professionista_nome || "-"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {utenti.map(u => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.nome} {u.cognome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Operatore */}
                        <td className="p-3 border-r">
                          <Select
                            value={scadenza.utente_operatore_id || "none"}
                            onValueChange={(value) => handleUtenteChange(scadenza.id, "utente_operatore_id", value)}
                            disabled={saving === scadenza.id}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {scadenza.operatore_nome || "-"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {utenti.map(u => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.nome} {u.cognome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Gennaio */}
                        <td className="p-3 border-r text-center">
                          <Checkbox
                            checked={scadenza.gennaio || false}
                            onCheckedChange={() => handleCheckboxChange(scadenza.id, "gennaio", scadenza.gennaio)}
                            disabled={saving === scadenza.id}
                          />
                        </td>

                        {/* Febbraio */}
                        <td className="p-3 border-r text-center">
                          <Checkbox
                            checked={scadenza.febbraio || false}
                            onCheckedChange={() => handleCheckboxChange(scadenza.id, "febbraio", scadenza.febbraio)}
                            disabled={saving === scadenza.id}
                          />
                        </td>

                        {/* Marzo */}
                        <td className="p-3 border-r text-center">
                          <Checkbox
                            checked={scadenza.marzo || false}
                            onCheckedChange={() => handleCheckboxChange(scadenza.id, "marzo", scadenza.marzo)}
                            disabled={saving === scadenza.id}
                          />
                        </td>

                        {/* Aprile */}
                        <td className="p-3 border-r text-center">
                          <Checkbox
                            checked={scadenza.aprile || false}
                            onCheckedChange={() => handleCheckboxChange(scadenza.id, "aprile", scadenza.aprile)}
                            disabled={saving === scadenza.id}
                          />
                        </td>

                        {/* Maggio */}
                        <td className="p-3 border-r text-center">
                          <Checkbox
                            checked={scadenza.maggio || false}
                            onCheckedChange={() => handleCheckboxChange(scadenza.id, "maggio", scadenza.maggio)}
                            disabled={saving === scadenza.id}
                          />
                        </td>

                        {/* Giugno */}
                        <td className="p-3 border-r text-center">
                          <Checkbox
                            checked={scadenza.giugno || false}
                            onCheckedChange={() => handleCheckboxChange(scadenza.id, "giugno", scadenza.giugno)}
                            disabled={saving === scadenza.id}
                          />
                        </td>

                        {/* Luglio */}
                        <td className="p-3 border-r text-center">
                          <Checkbox
                            checked={scadenza.luglio || false}
                            onCheckedChange={() => handleCheckboxChange(scadenza.id, "luglio", scadenza.luglio)}
                            disabled={saving === scadenza.id}
                          />
                        </td>

                        {/* Agosto */}
                        <td className="p-3 border-r text-center">
                          <Checkbox
                            checked={scadenza.agosto || false}
                            onCheckedChange={() => handleCheckboxChange(scadenza.id, "agosto", scadenza.agosto)}
                            disabled={saving === scadenza.id}
                          />
                        </td>

                        {/* Settembre */}
                        <td className="p-3 border-r text-center">
                          <Checkbox
                            checked={scadenza.settembre || false}
                            onCheckedChange={() => handleCheckboxChange(scadenza.id, "settembre", scadenza.settembre)}
                            disabled={saving === scadenza.id}
                          />
                        </td>

                        {/* Ottobre */}
                        <td className="p-3 border-r text-center">
                          <Checkbox
                            checked={scadenza.ottobre || false}
                            onCheckedChange={() => handleCheckboxChange(scadenza.id, "ottobre", scadenza.ottobre)}
                            disabled={saving === scadenza.id}
                          />
                        </td>

                        {/* Novembre */}
                        <td className="p-3 border-r text-center">
                          <Checkbox
                            checked={scadenza.novembre || false}
                            onCheckedChange={() => handleCheckboxChange(scadenza.id, "novembre", scadenza.novembre)}
                            disabled={saving === scadenza.id}
                          />
                        </td>

                        {/* Dicembre */}
                        <td className="p-3 text-center">
                          <Checkbox
                            checked={scadenza.dicembre || false}
                            onCheckedChange={() => handleCheckboxChange(scadenza.id, "dicembre", scadenza.dicembre)}
                            disabled={saving === scadenza.id}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
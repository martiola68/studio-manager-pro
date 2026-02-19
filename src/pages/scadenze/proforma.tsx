import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";

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

const MONTH_FIELDS: Array<keyof ScadenzaProformaRow> = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

export default function ScadenzarioProforma() {
  const router = useRouter();
  const { toast } = useToast();

  const [scadenze, setScadenze] = useState<ScadenzaProforma[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Filtri (stesso schema IVA)
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState<string>("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState<string>("__all__");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadScadenze(), loadUtenti()]);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadScadenze = async () => {
    const { data, error } = await (supabase as any)
      .from("tbscadproforma")
      .select(
        `
        *,
        operatore:tbutenti!tbscadproforma_utente_operatore_id_fkey(id, nome, cognome),
        professionista:tbutenti!tbscadproforma_utente_professionista_id_fkey(id, nome, cognome)
      `
      )
      .order("nominativo", { ascending: true });

    if (error) throw error;

    const mapped: ScadenzaProforma[] = (data || []).map((row: any) => ({
      ...row,
      operatore_nome: row.operatore
        ? `${row.operatore.nome || ""} ${row.operatore.cognome || ""}`.trim()
        : "-",
      professionista_nome: row.professionista
        ? `${row.professionista.nome || ""} ${row.professionista.cognome || ""}`.trim()
        : "-",
    }));

    setScadenze(mapped);
  };

  const loadUtenti = async () => {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome")
      .order("cognome", { ascending: true });

    if (error) throw error;
    setUtenti(data || []);
  };

  const updateField = async (id: string, field: keyof ScadenzaProformaRow, value: any) => {
    try {
      setSaving(id);

      const { error } = await (supabase as any)
        .from("tbscadproforma")
        .update({ [field]: value })
        .eq("id", id);

      if (error) throw error;

      setScadenze((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    } catch (error: any) {
      toast({
        title: "Errore salvataggio",
        description: error.message,
        variant: "destructive",
      });
      // ricarico per riallineare
      await loadData();
    } finally {
      setSaving(null);
    }
  };

  const handleCheckboxChange = (
    id: string,
    field: keyof ScadenzaProformaRow,
    currentValue: boolean | null
  ) => {
    updateField(id, field, !currentValue);
  };

  // Filtri applicati (stesso approccio IVA)
  const filteredScadenze = useMemo(() => {
    return scadenze.filter((s) => {
      const matchSearch = (s.nominativo || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchOperatore = filterOperatore === "__all__" || s.utente_operatore_id === filterOperatore;
      const matchProfessionista =
        filterProfessionista === "__all__" || s.utente_professionista_id === filterProfessionista;
      return matchSearch && matchOperatore && matchProfessionista;
    });
  }, [scadenze, searchQuery, filterOperatore, filterProfessionista]);

  // Stats (3 cards come IVA, ma coerenti col PROFORMA)
  const stats = useMemo(() => {
    const totale = scadenze.length;
    const conAlmenoUnMese = scadenze.filter((r) => MONTH_FIELDS.some((m) => Boolean(r[m]))).length;
    const nessunMese = totale - conAlmenoUnMese;
    return { totale, conAlmenoUnMese, nessunMese };
  }, [scadenze]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin mb-4 text-blue-600" />
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header (identico IVA) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario PROFORMA</h1>
          <p className="text-gray-500 mt-1">Gestione scadenze PROFORMA mensili</p>
        </div>
      </div>

      {/* Stats (griglia identica IVA) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Totale Record</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totale}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Con almeno 1 mese</div>
            <div className="text-3xl font-bold text-green-600">{stats.conAlmenoUnMese}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Nessun mese</div>
            <div className="text-3xl font-bold text-orange-600">{stats.nessunMese}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtri (card + griglia identiche IVA) */}
      <Card>
        <CardHeader>
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cerca Nominativo</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cerca..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Utente Operatore</label>
              <Select value={filterOperatore} onValueChange={setFilterOperatore}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  {utenti.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.cognome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Utente Professionista</label>
              <Select value={filterProfessionista} onValueChange={setFilterProfessionista}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  {utenti.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.cognome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4a colonna “vuota” per mantenere identica la griglia a 4 (come IVA) */}
            <div className="hidden md:block" />
          </div>

          {(searchQuery || filterOperatore !== "__all__" || filterProfessionista !== "__all__") && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterOperatore("__all__");
                  setFilterProfessionista("__all__");
                }}
              >
                Reimposta filtri
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabella (struttura wrapper identica IVA: overflow-auto + max-h + thead sticky) */}
      <Card>
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto max-h-[600px]">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b sticky top-0 z-30 bg-white shadow-sm">
                <tr className="border-b transition-colors hover:bg-muted/50">
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground sticky-col-header border-r min-w-[240px]">
                    Nominativo
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px]">
                    Professionista
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px]">
                    Operatore
                  </th>

                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[110px]">
                    Gennaio
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[110px]">
                    Febbraio
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[110px]">
                    Marzo
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[110px]">
                    Aprile
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[110px]">
                    Maggio
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[110px]">
                    Giugno
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[110px]">
                    Luglio
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[110px]">
                    Agosto
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[110px]">
                    Settembre
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[110px]">
                    Ottobre
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[110px]">
                    Novembre
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[110px]">
                    Dicembre
                  </th>
                </tr>
              </thead>

              <tbody className="[&_tr:last-child]:border-0">
                {filteredScadenze.length === 0 ? (
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <td colSpan={15} className="p-2 align-middle text-center py-8 text-gray-500">
                      Nessuna scadenza trovata
                    </td>
                  </tr>
                ) : (
                  filteredScadenze.map((scadenza) => (
                    <tr key={scadenza.id} className="border-b transition-colors hover:bg-green-50">
                      <td className="p-2 align-middle sticky-col-cell border-r font-medium min-w-[240px]">
                        {scadenza.nominativo || "-"}
                      </td>

                      {/* NON EDITABILI: solo testo */}
                      <td className="p-2 align-middle min-w-[180px]">
                        {scadenza.professionista_nome || "-"}
                      </td>
                      <td className="p-2 align-middle min-w-[180px]">
                        {scadenza.operatore_nome || "-"}
                      </td>

                      <td className="p-2 align-middle text-center min-w-[110px]">
                        <Checkbox
                          checked={scadenza.gennaio || false}
                          onCheckedChange={() =>
                            handleCheckboxChange(scadenza.id, "gennaio", scadenza.gennaio)
                          }
                          disabled={saving === scadenza.id}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[110px]">
                        <Checkbox
                          checked={scadenza.febbraio || false}
                          onCheckedChange={() =>
                            handleCheckboxChange(scadenza.id, "febbraio", scadenza.febbraio)
                          }
                          disabled={saving === scadenza.id}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[110px]">
                        <Checkbox
                          checked={scadenza.marzo || false}
                          onCheckedChange={() =>
                            handleCheckboxChange(scadenza.id, "marzo", scadenza.marzo)
                          }
                          disabled={saving === scadenza.id}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[110px]">
                        <Checkbox
                          checked={scadenza.aprile || false}
                          onCheckedChange={() =>
                            handleCheckboxChange(scadenza.id, "aprile", scadenza.aprile)
                          }
                          disabled={saving === scadenza.id}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[110px]">
                        <Checkbox
                          checked={scadenza.maggio || false}
                          onCheckedChange={() =>
                            handleCheckboxChange(scadenza.id, "maggio", scadenza.maggio)
                          }
                          disabled={saving === scadenza.id}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[110px]">
                        <Checkbox
                          checked={scadenza.giugno || false}
                          onCheckedChange={() =>
                            handleCheckboxChange(scadenza.id, "giugno", scadenza.giugno)
                          }
                          disabled={saving === scadenza.id}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[110px]">
                        <Checkbox
                          checked={scadenza.luglio || false}
                          onCheckedChange={() =>
                            handleCheckboxChange(scadenza.id, "luglio", scadenza.luglio)
                          }
                          disabled={saving === scadenza.id}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[110px]">
                        <Checkbox
                          checked={scadenza.agosto || false}
                          onCheckedChange={() =>
                            handleCheckboxChange(scadenza.id, "agosto", scadenza.agosto)
                          }
                          disabled={saving === scadenza.id}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[110px]">
                        <Checkbox
                          checked={scadenza.settembre || false}
                          onCheckedChange={() =>
                            handleCheckboxChange(scadenza.id, "settembre", scadenza.settembre)
                          }
                          disabled={saving === scadenza.id}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[110px]">
                        <Checkbox
                          checked={scadenza.ottobre || false}
                          onCheckedChange={() =>
                            handleCheckboxChange(scadenza.id, "ottobre", scadenza.ottobre)
                          }
                          disabled={saving === scadenza.id}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[110px]">
                        <Checkbox
                          checked={scadenza.novembre || false}
                          onCheckedChange={() =>
                            handleCheckboxChange(scadenza.id, "novembre", scadenza.novembre)
                          }
                          disabled={saving === scadenza.id}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[110px]">
                        <Checkbox
                          checked={scadenza.dicembre || false}
                          onCheckedChange={() =>
                            handleCheckboxChange(scadenza.id, "dicembre", scadenza.dicembre)
                          }
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
  );
}

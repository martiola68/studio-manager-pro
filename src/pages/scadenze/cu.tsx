import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

function maskDateDDMMYYYY(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  let out = d;
  if (digits.length > 2) out += "/" + m;
  if (digits.length > 4) out += "/" + y;
  return out;
}

function ddmmyyyyToIso(value: string): string | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    dt.getUTCFullYear() !== yyyy ||
    dt.getUTCMonth() !== mm - 1 ||
    dt.getUTCDate() !== dd
  )
    return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(
    2,
    "0"
  )}`;
}

function isoToDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

type ScadenzaCURow = Database["public"]["Tables"]["tbscadcu"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

type ScadenzaCU = ScadenzaCURow & {
  professionista?: string;
  operatore?: string;
};

export default function ScadenzeCUPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaCU[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");

  // ✅ Stato locale per rendere editabile "Data Invio" senza reset mentre scrivi
  const [dateInputs, setDateInputs] = useState<Record<string, string>>({});

  const [stats, setStats] = useState({
    totale: 0,
    confermate: 0,
    nonConfermate: 0,
  });

  useEffect(() => {
    checkAuthAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      await loadData();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [scadenzeData, utentiData] = await Promise.all([
        loadScadenze(),
        loadUtenti(),
      ]);

      setScadenze(scadenzeData);
      setUtenti(utentiData);

      // ✅ inizializza i valori editabili della data dalla sorgente DB
      setDateInputs(
        Object.fromEntries(
          scadenzeData.map((s) => [s.id, isoToDDMMYYYY(s.data_invio)])
        )
      );

      const confermate = scadenzeData.filter((s) => s.conferma_riga).length;
      setStats({
        totale: scadenzeData.length,
        confermate,
        nonConfermate: scadenzeData.length - confermate,
      });
    } catch (error) {
      console.error("Errore caricamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadScadenze = async (): Promise<ScadenzaCU[]> => {
    const { data, error } = await supabase
      .from("tbscadcu")
      .select(
        `
        *,
        professionista:tbutenti!tbscadcu_utente_professionista_id_fkey(nome, cognome),
        operatore:tbutenti!tbscadcu_utente_operatore_id_fkey(nome, cognome)
      `
      )
      .order("nominativo", { ascending: true });

    if (error) throw error;

    return (data || []).map((record: any) => ({
      ...record,
      professionista: record.professionista
        ? `${record.professionista.nome} ${record.professionista.cognome}`
        : "-",
      operatore: record.operatore
        ? `${record.operatore.nome} ${record.operatore.cognome}`
        : "-",
    })) as ScadenzaCU[];
  };

  const loadUtenti = async (): Promise<Utente[]> => {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("*")
      .order("cognome", { ascending: true });

    if (error) throw error;
    return data || [];
  };

  const handleToggleField = async (
    scadenzaId: string,
    field: keyof ScadenzaCU,
    currentValue: any
  ) => {
    try {
      const newValue = !currentValue;

      setScadenze((prev) =>
        prev.map((s) => (s.id === scadenzaId ? { ...s, [field]: newValue } : s))
      );

      if (field === "conferma_riga") {
        setStats((prev) => ({
          ...prev,
          confermate: newValue ? prev.confermate + 1 : prev.confermate - 1,
          nonConfermate: newValue
            ? prev.nonConfermate - 1
            : prev.nonConfermate + 1,
        }));
      }

      const { error } = await supabase
        .from("tbscadcu")
        .update({ [field]: newValue })
        .eq("id", scadenzaId);

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
        variant: "destructive",
      });
      await loadData();
    }
  };

  const handleUpdateField = async (
    scadenzaId: string,
    field: keyof ScadenzaCU,
    value: any
  ) => {
    try {
      const { error } = await supabase
        .from("tbscadcu")
        .update({ [field]: value ?? null })
        .eq("id", scadenzaId);

      if (error) throw error;

      setScadenze((prev) =>
        prev.map((s) => (s.id === scadenzaId ? { ...s, [field]: value } : s))
      );
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo record?")) return;

    try {
      const { error } = await supabase.from("tbscadcu").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Record eliminato",
      });
      await loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il record",
        variant: "destructive",
      });
    }
  };

  const filteredScadenze = scadenze.filter((s) => {
    const matchSearch = (s.nominativo || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchOperatore =
      filterOperatore === "__all__" || s.utente_operatore_id === filterOperatore;
    const matchProfessionista =
      filterProfessionista === "__all__" ||
      s.utente_professionista_id === filterProfessionista;
    return matchSearch && matchOperatore && matchProfessionista;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario CU</h1>
          <p className="text-gray-500 mt-1">Gestione Certificazioni Uniche</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">
              Totale Certificazioni
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {stats.totale}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Confermate</div>
            <div className="text-3xl font-bold text-green-600">
              {stats.confermate}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Non Confermate</div>
            <div className="text-3xl font-bold text-orange-600">
              {stats.nonConfermate}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Cerca Nominativo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div>
              <Select value={filterOperatore} onValueChange={setFilterOperatore}>
                <SelectTrigger>
                  <SelectValue placeholder="Utente Operatore" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti gli operatori</SelectItem>
                  {utenti.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.cognome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select
                value={filterProfessionista}
                onValueChange={setFilterProfessionista}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Utente Professionista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    Tutti i professionisti
                  </SelectItem>
                  {utenti.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.cognome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto max-h-[600px]">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b sticky top-0 z-30 bg-white shadow-sm">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground sticky-col-header border-r min-w-[200px]">
                    Nominativo
                  </th>
                  <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px]">
                    Professionista
                  </th>
                  <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px]">
                    Operatore
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[140px]">
                    CU Autonomi
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    Inserite
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    Generate
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    Inviate
                  </th>
                  <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground min-w-[150px]">
                    Data Invio
                  </th>
                  <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground min-w-[120px]">
                    Num CU
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    Conferma
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[100px]">
                    Azioni
                  </th>
                </tr>
              </thead>

              <tbody className="[&_tr:last-child]:border-0">
                {filteredScadenze.length === 0 ? (
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td
                      colSpan={11}
                      className="p-2 align-middle text-center text-gray-500"
                    >
                      Nessun record trovato
                    </td>
                  </tr>
                ) : (
                  filteredScadenze.map((scadenza) => (
                    <tr
                      key={scadenza.id}
                      className="border-b transition-colors hover:bg-green-50 data-[state=selected]:bg-muted"
                    >
                      <td className="p-2 align-middle sticky-col-cell border-r font-medium min-w-[200px]">
                        {scadenza.nominativo}
                      </td>

                      <td className="p-2 align-middle min-w-[180px]">
                        {scadenza.professionista}
                      </td>

                      <td className="p-2 align-middle min-w-[180px]">
                        {scadenza.operatore}
                      </td>

                      {/* ✅ CU Autonomi - ora uguale alle altre checkbox */}
                      <td className="p-2 align-middle text-center min-w-[140px]">
                        <Checkbox
                          checked={scadenza.cu_autonomi || false}
                          onCheckedChange={() =>
                            handleToggleField(
                              scadenza.id,
                              "cu_autonomi",
                              scadenza.cu_autonomi
                            )
                          }
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Checkbox
                          checked={scadenza.inserite || false}
                          onCheckedChange={() =>
                            handleToggleField(
                              scadenza.id,
                              "inserite",
                              scadenza.inserite
                            )
                          }
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Checkbox
                          checked={scadenza.generate || false}
                          onCheckedChange={() =>
                            handleToggleField(
                              scadenza.id,
                              "generate",
                              scadenza.generate
                            )
                          }
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Checkbox
                          checked={scadenza.inviate || false}
                          onCheckedChange={() =>
                            handleToggleField(
                              scadenza.id,
                              "inviate",
                              scadenza.inviate
                            )
                          }
                        />
                      </td>

                      {/* ✅ Data Invio - editabile senza reset; salva su blur */}
                      <td className="p-2 align-middle min-w-[150px]">
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="gg/mm/aaaa"
                          value={dateInputs[scadenza.id] ?? ""}
                          onChange={(e) => {
                            const masked = maskDateDDMMYYYY(e.target.value);
                            setDateInputs((prev) => ({
                              ...prev,
                              [scadenza.id]: masked,
                            }));
                          }}
                          onBlur={() => {
                            const current = (dateInputs[scadenza.id] ?? "").trim();

                            // se svuoto, azzera anche su DB
                            if (!current) {
                              handleUpdateField(scadenza.id, "data_invio", null);
                              return;
                            }

                            const iso = ddmmyyyyToIso(current);

                            // salva solo se valida, altrimenti ripristina valore DB
                            if (iso) {
                              handleUpdateField(scadenza.id, "data_invio", iso);
                            } else {
                              const back = isoToDDMMYYYY(scadenza.data_invio);
                              setDateInputs((prev) => ({
                                ...prev,
                                [scadenza.id]: back,
                              }));
                              toast({
                                title: "Data non valida",
                                description:
                                  "Inserisci una data valida nel formato gg/mm/aaaa.",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="w-full"
                        />
                      </td>

                      <td className="p-2 align-middle min-w-[120px]">
                        <Input
                          type="text"
                          value={scadenza.num_cu || ""}
                          onChange={(e) =>
                            handleUpdateField(
                              scadenza.id,
                              "num_cu",
                              e.target.value
                            )
                          }
                          className="w-full"
                          placeholder="Numero CU"
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Checkbox
                          checked={scadenza.conferma_riga || false}
                          onCheckedChange={() =>
                            handleToggleField(
                              scadenza.id,
                              "conferma_riga",
                              scadenza.conferma_riga
                            )
                          }
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[100px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(scadenza.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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

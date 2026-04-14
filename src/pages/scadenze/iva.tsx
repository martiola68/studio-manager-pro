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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Trash2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type ScadenzaIvaRow = Database["public"]["Tables"]["tbscadiva"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

type ScadenzaIva = ScadenzaIvaRow & {
  anno_riferimento?: number | null;
  archiviato?: boolean | null;
};

export default function ScadenzeIvaPage() {
  const router = useRouter();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaIva[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterConferma, setFilterConferma] = useState("__all__");
  const [annoConsultazione, setAnnoConsultazione] = useState(currentYear);
  const [anniDisponibili, setAnniDisponibili] = useState<number[]>([]);

  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [noteTimers, setNoteTimers] = useState<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  const [stats, setStats] = useState({
    totale: 0,
    confermate: 0,
    nonConfermate: 0,
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, [annoConsultazione]);

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

  const loadScadenze = async (): Promise<ScadenzaIva[]> => {
    const { data: anniData, error: anniError } = await supabase
      .from("tbscadiva" as any)
      .select("anno_riferimento")
      .order("anno_riferimento", { ascending: true });

    if (anniError) throw anniError;

    const anni = Array.from(
      new Set(
        (((anniData ?? []) as any[]) || [])
          .map((r) => r.anno_riferimento)
          .filter((a): a is number => typeof a === "number")
      )
    ).sort((a, b) => a - b);

    setAnniDisponibili(anni);

    const annoDaUsare =
      anni.length > 0 && !anni.includes(annoConsultazione)
        ? anni[anni.length - 1]
        : annoConsultazione;

    if (annoDaUsare !== annoConsultazione) {
      setAnnoConsultazione(annoDaUsare);
    }

    const { data, error } = await supabase
      .from("tbscadiva" as any)
      .select("*")
      .eq("anno_riferimento", annoDaUsare)
      .order("nominativo", { ascending: true });

    if (error) throw error;

    return ((data ?? []) as unknown) as ScadenzaIva[];
  };

  const loadUtenti = async (): Promise<Utente[]> => {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("*")
      .order("cognome", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as unknown) as Utente[];
  };

  const handleToggleField = async (
    scadenzaId: string,
    field: keyof ScadenzaIva,
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
        .from("tbscadiva" as any)
        .update({ [field]: newValue } as any)
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
    field: keyof ScadenzaIva,
    value: any
  ) => {
    try {
      const { error } = await supabase
        .from("tbscadiva" as any)
        .update({ [field]: value || null } as any)
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

  const handleNoteChange = (scadenzaId: string, value: string) => {
    setLocalNotes((prev) => ({ ...prev, [scadenzaId]: value }));

    if (noteTimers[scadenzaId]) {
      clearTimeout(noteTimers[scadenzaId]);
    }

    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("tbscadiva" as any)
          .update({ note: value || null })
          .eq("id", scadenzaId);

        if (error) throw error;

        setScadenze((prev) =>
          prev.map((s) => (s.id === scadenzaId ? { ...s, note: value } : s))
        );
      } catch (error) {
        console.error("Errore salvataggio nota:", error);
        toast({
          title: "Errore",
          description: "Impossibile salvare la nota",
          variant: "destructive",
        });
      }
    }, 1000);

    setNoteTimers((prev) => ({ ...prev, [scadenzaId]: timer }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo record?")) return;

    try {
      const { error } = await supabase
        .from("tbscadiva" as any)
        .delete()
        .eq("id", id);

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
      filterOperatore === "__all__" ||
      s.utente_operatore_id === filterOperatore;

    const matchConferma =
      filterConferma === "__all__" ||
      (filterConferma === "true" ? s.conferma_riga : !s.conferma_riga);

    return matchSearch && matchOperatore && matchConferma;
  });

  const getUtenteNome = (utenteId: string | null): string => {
    if (!utenteId) return "-";
    const utente = utenti.find((u) => u.id === utenteId);
    return utente ? `${utente.nome} ${utente.cognome}` : "-";
  };

 const handlePrintOperatore = () => {
  if (filterOperatore === "__all__") return;

  const operatoreNome = getUtenteNome(filterOperatore);

  const righeHtml = filteredScadenze
    .map(
      (scadenza, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${scadenza.nominativo ?? ""}</td>
          <td style="text-align:center; font-weight:700;">${
            scadenza.conferma_riga ? "✓" : "X"
          }</td>
          <td style="text-align:center;">${
            scadenza.mod_definitivo ? "✓" : ""
          }</td>
          <td style="text-align:center;">${
            scadenza.asseverazione ? "✓" : ""
          }</td>
          <td style="text-align:center;">${
            scadenza.mod_inviato ? "✓" : ""
          }</td>
          <td>${scadenza.importo_credito ?? ""}</td>
        </tr>
      `
    )
    .join("");

  const printWindow = window.open("", "_blank", "width=1000,height=700");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Stampa Scadenzario IVA</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 18px;
            color: #111;
            font-size: 11px;
          }
          h1 {
            font-size: 18px;
            margin-bottom: 4px;
          }
          .meta {
            margin-bottom: 12px;
            color: #444;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            table-layout: fixed;
          }
          th, td {
            border: 1px solid #999;
            padding: 6px;
            text-align: left;
            vertical-align: top;
            word-wrap: break-word;
          }
          th {
            background: #f3f4f6;
          }
          .count {
            margin-bottom: 10px;
            font-weight: bold;
            font-size: 12px;
          }
          .col-num {
            width: 40px;
            text-align: center;
          }
          .col-nominativo {
            width: 50%;
          }
          .col-conferma {
            width: 70px;
            text-align: center;
          }
          .col-small {
            width: 70px;
            text-align: center;
          }
          .col-importo {
            width: 120px;
          }
          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <h1>Scadenzario IVA</h1>
        <div class="meta">Anno consultazione: ${annoConsultazione}</div>
        <div class="meta">Operatore: ${operatoreNome}</div>
        <div class="count">Totale record stampati: ${filteredScadenze.length}</div>

        <table>
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-nominativo">Nominativo</th>
              <th class="col-conferma">Conf.</th>
              <th class="col-small">Def.</th>
              <th class="col-small">Ass.</th>
              <th class="col-small">Inv.</th>
              <th class="col-importo">Credito</th>
            </tr>
          </thead>
          <tbody>
            ${
              righeHtml ||
              `<tr><td colspan="7">Nessun record trovato</td></tr>`
            }
          </tbody>
        </table>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
};

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

  const anni = anniDisponibili;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario IVA</h1>
          <p className="text-gray-500 mt-1">
            Gestione liquidazioni periodiche e versamenti IVA
          </p>
        </div>

        {filterOperatore !== "__all__" && (
          <Button
            type="button"
            onClick={handlePrintOperatore}
            className="bg-black text-white hover:bg-zinc-800"
          >
            <Printer className="h-4 w-4 mr-2" />
            Stampa elenco operatore
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">
              Totale Dichiarazioni
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Cerca Nominativo
              </label>
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
              <label className="text-sm font-medium mb-2 block">
                Utente Operatore
              </label>
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
              <label className="text-sm font-medium mb-2 block">
                Stato Conferma
              </label>
              <Select value={filterConferma} onValueChange={setFilterConferma}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  <SelectItem value="true">Solo Confermate</SelectItem>
                  <SelectItem value="false">Solo Non Confermate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Anno consultazione
              </label>
              <Select
                value={annoConsultazione.toString()}
                onValueChange={(value) => setAnnoConsultazione(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona anno" />
                </SelectTrigger>
                <SelectContent>
                  {anni.map((anno) => (
                    <SelectItem key={anno} value={anno.toString()}>
                      {anno}
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
                <tr className="border-b transition-colors hover:bg-muted/50">
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground sticky-col-header border-r min-w-[260px]">
                    Nominativo
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px]">
                    Operatore
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[110px]">
                    Mod. Pred.
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[90px]">
                    Def.
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[90px]">
                    Ass.
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[130px]">
                    Credito
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[90px]">
                    Inv.
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[150px]">
                    Data Invio
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[100px]">
                    Ricevuta
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[300px]">
                    Note
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[100px]">
                    Conferma
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[100px]">
                    Azioni
                  </th>
                </tr>
              </thead>

              <tbody className="[&_tr:last-child]:border-0">
                {filteredScadenze.length === 0 ? (
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <td
                      colSpan={12}
                      className="p-2 align-middle text-center py-8 text-gray-500"
                    >
                      Nessun record trovato
                    </td>
                  </tr>
                ) : (
                  filteredScadenze.map((scadenza) => (
                    <tr
                      key={scadenza.id}
                      className={`border-b transition-colors ${
                        scadenza.conferma_riga
                          ? "bg-green-100 hover:bg-green-100"
                          : scadenza.mod_definitivo
                          ? "bg-orange-100 hover:bg-orange-100"
                          : "hover:bg-green-50"
                      }`}
                    >
                      <td
                        className={`p-2 align-middle sticky-col-cell border-r font-medium min-w-[260px] ${
                          scadenza.conferma_riga
                            ? "!bg-green-100"
                            : scadenza.mod_definitivo
                            ? "!bg-orange-100"
                            : "!bg-white"
                        }`}
                      >
                        {scadenza.nominativo}
                      </td>

                      <td className="p-2 align-middle min-w-[180px]">
                        {getUtenteNome(scadenza.utente_operatore_id)}
                      </td>

                      <td className="p-2 align-middle text-center min-w-[110px]">
                        <Checkbox
                          checked={scadenza.mod_predisposto || false}
                          onCheckedChange={() =>
                            handleToggleField(
                              scadenza.id,
                              "mod_predisposto",
                              scadenza.mod_predisposto
                            )
                          }
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[90px]">
                        <Checkbox
                          checked={scadenza.mod_definitivo || false}
                          onCheckedChange={() =>
                            handleToggleField(
                              scadenza.id,
                              "mod_definitivo",
                              scadenza.mod_definitivo
                            )
                          }
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[90px]">
                        <Checkbox
                          checked={scadenza.asseverazione || false}
                          onCheckedChange={() =>
                            handleToggleField(
                              scadenza.id,
                              "asseverazione",
                              scadenza.asseverazione
                            )
                          }
                        />
                      </td>

                      <td className="p-2 align-middle min-w-[130px]">
                        <Input
                          type="number"
                          step="0.01"
                          value={scadenza.importo_credito || ""}
                          onChange={(e) =>
                            handleUpdateField(
                              scadenza.id,
                              "importo_credito",
                              parseFloat(e.target.value) || null
                            )
                          }
                          className="w-full"
                          placeholder="0.00"
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[90px]">
                        <Checkbox
                          checked={scadenza.mod_inviato || false}
                          onCheckedChange={() =>
                            handleToggleField(
                              scadenza.id,
                              "mod_inviato",
                              scadenza.mod_inviato
                            )
                          }
                        />
                      </td>

                      <td className="p-2 align-middle min-w-[150px]">
                        <Input
                          type="date"
                          value={scadenza.data_invio || ""}
                          onChange={(e) =>
                            handleUpdateField(
                              scadenza.id,
                              "data_invio",
                              e.target.value
                            )
                          }
                          className="w-full"
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[100px]">
                        <Checkbox
                          checked={scadenza.ricevuta || false}
                          onCheckedChange={() =>
                            handleToggleField(
                              scadenza.id,
                              "ricevuta",
                              scadenza.ricevuta
                            )
                          }
                        />
                      </td>

                      <td className="p-2 align-middle min-w-[300px]">
                        <Textarea
                          value={localNotes[scadenza.id] ?? scadenza.note ?? ""}
                          onChange={(e) =>
                            handleNoteChange(scadenza.id, e.target.value)
                          }
                          placeholder="Aggiungi note..."
                          className="min-h-[60px] resize-none"
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[100px]">
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

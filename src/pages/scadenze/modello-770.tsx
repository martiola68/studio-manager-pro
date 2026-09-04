import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Trash2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";

type Scadenza770 = Database["public"]["Tables"]["tbscad770"]["Row"] & {
  cliente?: {
    settore_fiscale?: boolean | null;
    settore_lavoro?: boolean | null;
    settore_consulenza?: boolean | null;
  } | null;
  anno_riferimento?: number | null;
  archiviato?: boolean | null;
};

type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

const TIPO_INVIO_OPTIONS = ["Totale", "Invio Separato"] as const;

const TIPO_770_OPTIONS = [
  "Solo aut",
  "Solo cap",
  "Solo Dip",
  "Aut+Dip",
  "Aut+Cap",
  "Aut+Dip+Cap",
  "Dip+Cap",
] as const;

export default function Scadenze770Page() {
  const router = useRouter();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<Scadenza770[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSettore, setFilterSettore] = useState("__all__");
  const [filterOperatoreFiscale, setFilterOperatoreFiscale] =
    useState("__all__");
  const [filterOperatorePayroll, setFilterOperatorePayroll] =
    useState("__all__");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

const loadScadenze = async (): Promise<Scadenza770[]> => {
  const { data: anniData, error: anniError } = await supabase
    .from("tbscad770" as any)
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
    .from("tbscad770" as any)
    .select(
      `
        *,
        cliente:tbclienti!tbscad770_cliente_id_fkey(
          settore_fiscale,
          settore_lavoro,
          settore_consulenza
        )
      `
    )
    .eq("anno_riferimento", annoDaUsare)
    .order("nominativo", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown) as Scadenza770[];
};
  
  const loadUtenti = async (): Promise<Utente[]> => {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("*")
      .order("nome", { ascending: true }).order("cognome", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as unknown) as Utente[];
  };

  const getUtenteLabelById = (id?: string | null) => {
    if (!id) return "";
    const u = utenti.find((x) => x.id === id);
    if (!u) return "";
    const nome = (u as any).nome ?? "";
    const cognome = (u as any).cognome ?? "";
    return `${nome} ${cognome}`.trim();
  };

  const handleToggleField = async (
    scadenzaId: string,
    field: string,
    currentValue: boolean | null
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

      const updates: any = { [field]: newValue };
      const { error } = await supabase
        .from("tbscad770" as any)
        .update(updates)
        .eq("id", scadenzaId);

      if (error) throw error;
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il campo",
        variant: "destructive",
      });
      await loadData();
    }
  };

  const handleUpdateField = async (
    scadenzaId: string,
    field: string,
    value: any
  ) => {
    try {
      const updates: any = { [field]: value || null };

      const { error } = await supabase
        .from("tbscad770" as any)
        .update(updates)
        .eq("id", scadenzaId);

      if (error) throw error;

      setScadenze((prev) =>
        prev.map((s) => (s.id === scadenzaId ? { ...s, [field]: value } : s))
      );
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il campo",
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
          .from("tbscad770" as any)
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
        .from("tbscad770" as any)
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

    const hasFiscale = s.cliente?.settore_fiscale === true;
    const hasLavoro = s.cliente?.settore_lavoro === true;

    const matchSettore =
      filterSettore === "__all__" ||
      (filterSettore === "Fiscale" && hasFiscale) ||
      (filterSettore === "Lavoro" && hasLavoro);

    const matchOperatoreFiscale =
      filterOperatoreFiscale === "__all__" ||
      s.utente_operatore_id === filterOperatoreFiscale;

    const matchOperatorePayroll =
      filterOperatorePayroll === "__all__" ||
      s.utente_payroll_id === filterOperatorePayroll;

    return (
      matchSearch &&
      matchSettore &&
      matchOperatoreFiscale &&
      matchOperatorePayroll
    );
  });

  const handlePrintOperatore = () => {
    const operatoreFiscaleLabel =
      filterOperatoreFiscale !== "__all__"
        ? getUtenteLabelById(filterOperatoreFiscale)
        : "";

    const operatorePayrollLabel =
      filterOperatorePayroll !== "__all__"
        ? getUtenteLabelById(filterOperatorePayroll)
        : "";

    const righeHtml = filteredScadenze
      .map(
        (scadenza, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${scadenza.nominativo ?? ""}</td>
          <td style="text-align:center;">${
            scadenza.mod_definitivo ? "✓" : ""
          }</td>
          <td style="text-align:center;">${
            scadenza.mod_inviato ? "✓" : ""
          }</td>
          <td style="text-align:center; font-weight:700;">${
            scadenza.conferma_riga ? "✓" : "X"
          }</td>
        </tr>
      `
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=1000,height=700");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Stampa Scadenzario 770</title>
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
              margin-bottom: 8px;
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
              width: 60%;
            }
            .col-small {
              width: 90px;
              text-align: center;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <h1>Scadenzario 770</h1>
          <div class="meta">Anno consultazione: ${annoConsultazione}</div>
          ${
            operatoreFiscaleLabel
              ? `<div class="meta">Operatore fiscale: ${operatoreFiscaleLabel}</div>`
              : ""
          }
          ${
            operatorePayrollLabel
              ? `<div class="meta">Operatore payroll: ${operatorePayrollLabel}</div>`
              : ""
          }
          <div class="count">Totale record stampati: ${filteredScadenze.length}</div>

          <table>
            <thead>
              <tr>
                <th class="col-num">#</th>
                <th class="col-nominativo">Nominativo</th>
                <th class="col-small">Def.</th>
                <th class="col-small">Inv.</th>
                <th class="col-small">Conf.</th>
              </tr>
            </thead>
            <tbody>
              ${
                righeHtml ||
                `<tr><td colspan="5">Nessun record trovato</td></tr>`
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

  const anni = anniDisponibili;

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
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-slate-200/70 px-3 pb-3 pt-2">
      <div className="flex shrink-0 items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario 770</h1>
          <p className="text-gray-500 mt-1">Gestione Modello 770</p>
        </div>

        {(filterOperatoreFiscale !== "__all__" ||
          filterOperatorePayroll !== "__all__") && (
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

      <div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border border-sky-200 bg-slate-50 shadow-sm">
          <CardContent className="pt-5">
            <div className="text-sm text-gray-600 mb-1">
              Totale Dichiarazioni
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {stats.totale}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-sky-200 bg-slate-50 shadow-sm">
          <CardContent className="pt-5">
            <div className="text-sm text-gray-600 mb-1">Confermate</div>
            <div className="text-3xl font-bold text-green-600">
              {stats.confermate}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-sky-200 bg-slate-50 shadow-sm">
          <CardContent className="pt-5">
            <div className="text-sm text-gray-600 mb-1">Non Confermate</div>
            <div className="text-3xl font-bold text-orange-600">
              {stats.nonConfermate}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shrink-0 border border-sky-200 bg-slate-50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Cerca Nominativo</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cerca..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 border-slate-300 bg-white pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Settore</Label>
              <Select value={filterSettore} onValueChange={setFilterSettore}>
                <SelectTrigger className="h-9 border-slate-300 bg-white">
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  <SelectItem value="Fiscale">Fiscale</SelectItem>
                  <SelectItem value="Lavoro">Lavoro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Operatore fiscale</Label>
              <Select
                value={filterOperatoreFiscale}
                onValueChange={setFilterOperatoreFiscale}
              >
                <SelectTrigger className="h-9 border-slate-300 bg-white">
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

            <div className="space-y-2">
              <Label>Operatore payroll</Label>
              <Select
                value={filterOperatorePayroll}
                onValueChange={setFilterOperatorePayroll}
              >
                <SelectTrigger className="h-9 border-slate-300 bg-white">
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

            <div className="space-y-2">
              <Label>Anno consultazione</Label>
              <Select
                value={annoConsultazione.toString()}
                onValueChange={(value) => setAnnoConsultazione(parseInt(value))}
              >
                <SelectTrigger className="h-9 border-slate-300 bg-white">
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

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border border-sky-200 bg-slate-50 shadow-sm">
        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          <div className="h-full w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="sticky top-0 z-30 bg-slate-600 text-white shadow-sm [&_tr]:border-b [&_tr]:border-slate-500">
                <tr className="border-b border-slate-500">
                  <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 sticky-col-header min-w-[260px] !bg-slate-600">
                    Nominativo
                  </th>
                  <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[120px]">
                    Settore
                  </th>
                  <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[180px]">
                    Operatore fiscale
                  </th>
                  <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[180px]">
                    Operatore payroll
                  </th>
                  <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[150px]">
                    Tipo invio
                  </th>
                  <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[180px]">
                    Tipo 770
                  </th>
                  <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[110px]">
                    Mod. Compilato
                  </th>
                  <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[110px]">
                    Mod. Definitivo
                  </th>
                  <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[110px]">
                    Mod. Inviato
                  </th>
                  <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[140px]">
                    data invio
                  </th>
                  <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[100px]">
                    Ricevuta
                  </th>
                  <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[300px]">
                    Note
                  </th>
                  <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[120px]">
                    Conferma
                  </th>
                  <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[100px]">
                    Azioni
                  </th>
                </tr>
              </thead>

              <tbody className="[&_tr:last-child]:border-0">
                {filteredScadenze.length === 0 ? (
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td
                      colSpan={14}
                      className="px-2 py-1 align-middle text-center py-8 text-gray-500"
                    >
                      Nessun record trovato
                    </td>
                  </tr>
                ) : (
                  filteredScadenze.map((scadenza) => {
                    const isConfermata = scadenza.conferma_riga || false;
                    const isRicevuta = scadenza.ricevuta || false;

                    const operatoreFiscaleLabel = getUtenteLabelById(
                      scadenza.utente_operatore_id
                    );
                    const operatorePayrollLabel = getUtenteLabelById(
                      scadenza.utente_payroll_id
                    );

                    const dataInvioValue = scadenza.data_invio
                      ? String(scadenza.data_invio).slice(0, 10)
                      : "";

                    return (
                      <tr
                        key={scadenza.id}
                        className={`border-b transition-colors ${
                          isConfermata
                            ? "bg-green-200 hover:bg-green-200"
                            : "bg-slate-50 hover:bg-slate-100"
                        } data-[state=selected]:bg-muted`}
                      >
                        <td
                          style={{
                            backgroundColor: isConfermata
                              ? "#bbf7d0"
                              : "#f8fafc",
                          }}
                          className={`px-2 py-1 align-middle sticky-col-cell border-r font-medium min-w-[260px] ${
                            isConfermata
                              ? "hover:bg-green-100"
                              : "hover:bg-green-50"
                          }`}
                        >
                          {scadenza.nominativo}
                        </td>

                        <td className="px-2 py-1 align-middle min-w-[120px]">
                          <div className="flex flex-col gap-1">
                            {scadenza.cliente?.settore_fiscale && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                Fiscale
                              </span>
                            )}
                            {scadenza.cliente?.settore_lavoro && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                Lavoro
                              </span>
                            )}
                            {scadenza.cliente?.settore_consulenza && (
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                Consulenza
                              </span>
                            )}
                            {!scadenza.cliente?.settore_fiscale &&
                              !scadenza.cliente?.settore_lavoro &&
                              !scadenza.cliente?.settore_consulenza && (
                                <span className="text-xs text-gray-500">-</span>
                              )}
                          </div>
                        </td>

                        <td className="px-2 py-1 align-middle min-w-[180px]">
                          <Input
                            type="text"
                            value={operatoreFiscaleLabel}
                            disabled={true}
                            className="h-8 w-full border-slate-300 bg-white text-xs disabled:bg-slate-100"
                          />
                        </td>

                        <td className="px-2 py-1 align-middle min-w-[180px]">
                          <Input
                            type="text"
                            value={operatorePayrollLabel}
                            disabled={true}
                            className="h-8 w-full border-slate-300 bg-white text-xs disabled:bg-slate-100"
                          />
                        </td>

                        <td className="px-2 py-1 align-middle min-w-[150px]">
                          <Select
                            value={scadenza.tipo_invio || "__none__"}
                            onValueChange={(value) =>
                              handleUpdateField(
                                scadenza.id,
                                "tipo_invio",
                                value === "__none__" ? null : value
                              )
                            }
                            disabled={isConfermata}
                          >
                            <SelectTrigger className="h-8 w-full border-slate-300 bg-white text-xs">
                              <SelectValue placeholder="Seleziona..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nessuno</SelectItem>
                              {TIPO_INVIO_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        <td className="px-2 py-1 align-middle min-w-[180px]">
                          <Select
                            value={scadenza.modelli_770 || "__none__"}
                            onValueChange={(value) =>
                              handleUpdateField(
                                scadenza.id,
                                "modelli_770",
                                value === "__none__" ? null : value
                              )
                            }
                            disabled={isConfermata}
                          >
                            <SelectTrigger className="h-8 w-full border-slate-300 bg-white text-xs">
                              <SelectValue placeholder="Seleziona..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nessuno</SelectItem>
                              {TIPO_770_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        <td className="px-2 py-1 align-middle text-center min-w-[110px]">
                          <select
                            value={scadenza.mod_compilato ? "SI" : "NO"}
                            onChange={(e) => {
                              const nextValue = e.target.value === "SI";
                              if (nextValue !== Boolean(scadenza.mod_compilato)) {
                                handleToggleField(scadenza.id, "mod_compilato", scadenza.mod_compilato);
                              }
                            }} disabled={isConfermata}
                            className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="NO">NO</option>
                            <option value="SI">SI</option>
                          </select>
                        </td>

                        <td className="px-2 py-1 align-middle text-center min-w-[110px]">
                          <select
                            value={scadenza.mod_definitivo ? "SI" : "NO"}
                            onChange={(e) => {
                              const nextValue = e.target.value === "SI";
                              if (nextValue !== Boolean(scadenza.mod_definitivo)) {
                                handleToggleField(scadenza.id, "mod_definitivo", scadenza.mod_definitivo);
                              }
                            }} disabled={isConfermata}
                            className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="NO">NO</option>
                            <option value="SI">SI</option>
                          </select>
                        </td>

                        <td className="px-2 py-1 align-middle text-center min-w-[110px]">
                          <select
                            value={scadenza.mod_inviato ? "SI" : "NO"}
                            onChange={(e) => {
                              const nextValue = e.target.value === "SI";
                              if (nextValue !== Boolean(scadenza.mod_inviato)) {
                                handleToggleField(scadenza.id, "mod_inviato", scadenza.mod_inviato);
                              }
                            }} disabled={isConfermata}
                            className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="NO">NO</option>
                            <option value="SI">SI</option>
                          </select>
                        </td>

                        <td className="px-2 py-1 align-middle text-center min-w-[140px]">
                          <Input
                            type="date"
                            value={dataInvioValue}
                            onChange={(e) =>
                              handleUpdateField(
                                scadenza.id,
                                "data_invio",
                                e.target.value
                              )
                            }
                            className="h-8 w-36 border-slate-300 bg-white text-xs"
                            disabled={isConfermata}
                            placeholder=""
                          />
                        </td>

                        <td className="px-2 py-1 align-middle text-center min-w-[100px]">
                          <select
                            value={isRicevuta ? "SI" : "NO"}
                            onChange={(e) => {
                              const nextValue = e.target.value === "SI";
                              if (nextValue !== Boolean(isRicevuta)) {
                                handleToggleField(scadenza.id, "ricevuta", scadenza.ricevuta);
                              }
                            }} disabled={isConfermata}
                            className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="NO">NO</option>
                            <option value="SI">SI</option>
                          </select>
                        </td>

                        <td className="px-2 py-1 align-middle min-w-[300px]">
                          <Textarea
                            value={localNotes[scadenza.id] ?? scadenza.note ?? ""}
                            onChange={(e) =>
                              handleNoteChange(scadenza.id, e.target.value)
                            }
                            rows={1}
                            className="h-8 min-h-8 resize-none border-slate-300 bg-white py-1.5 text-xs"
                            disabled={isConfermata}
                            placeholder="Note..."
                          />
                        </td>

                        <td className="px-2 py-1 align-middle text-center min-w-[120px]">
                          <select
                            value={isConfermata ? "SI" : "NO"}
                            onChange={(e) => {
                              const nextValue = e.target.value === "SI";
                              if (nextValue !== Boolean(isConfermata)) {
                                handleToggleField(scadenza.id, "conferma_riga", scadenza.conferma_riga);
                              }
                            }}
                            className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="NO">NO</option>
                            <option value="SI">SI</option>
                          </select>
                        </td>

                        <td className="px-2 py-1 align-middle text-center min-w-[100px]">
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

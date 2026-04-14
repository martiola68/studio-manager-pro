import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Trash2, Printer } from "lucide-react";
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
  ) {
    return null;
  }

  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function isoToDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

type ScadenzaCCGGRow = Database["public"]["Tables"]["tbscadccgg"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

type ScadenzaCCGG = ScadenzaCCGGRow & {
  operatore?: string;
  anno_riferimento?: number | null;
  archiviato?: boolean | null;
};

export default function ScadenzeCCGGPage() {
  const router = useRouter();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaCCGG[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterConferma, setFilterConferma] = useState("__all__");
  const [annoConsultazione, setAnnoConsultazione] = useState(currentYear);
  const [anniDisponibili, setAnniDisponibili] = useState<number[]>([]);

  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [noteTimers, setNoteTimers] = useState<Record<string, ReturnType<typeof setTimeout>>>({});
  const [dateInputs, setDateInputs] = useState<Record<string, string>>({});

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

      setDateInputs(
        Object.fromEntries(
          scadenzeData.map((s) => [s.id, isoToDDMMYYYY(s.data_comunicato)])
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

  const loadScadenze = async (): Promise<ScadenzaCCGG[]> => {
    const { data: anniData, error: anniError } = await supabase
      .from("tbscadccgg" as any)
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
      .from("tbscadccgg" as any)
      .select(
        `
        *,
        operatore:tbutenti!tbscadccgg_utente_operatore_id_fkey(nome, cognome)
      `
      )
      .eq("anno_riferimento", annoDaUsare)
      .order("nominativo", { ascending: true });

    if (error) throw error;

    return (((data ?? []) as any[]) || []).map((record) => ({
      ...record,
      operatore: record.operatore
        ? `${record.operatore.nome} ${record.operatore.cognome}`.trim()
        : "-",
    })) as ScadenzaCCGG[];
  };

  const loadUtenti = async (): Promise<Utente[]> => {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("*")
      .order("cognome", { ascending: true });

    if (error) throw error;
    return data || [];
  };

  const getUtenteNome = (utenteId: string | null) => {
    if (!utenteId) return "";
    const utente = utenti.find((u) => u.id === utenteId);
    if (!utente) return "";
    return `${utente.nome ?? ""} ${utente.cognome ?? ""}`.trim();
  };

  const handleToggleField = async (
    scadenzaId: string,
    field: keyof ScadenzaCCGG,
    currentValue: any
  ) => {
    try {
      const newValue = !currentValue;

      setScadenze((prev) =>
        prev.map((s) =>
          s.id === scadenzaId ? { ...s, [field]: newValue } : s
        )
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
        .from("tbscadccgg")
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
    field: keyof ScadenzaCCGG,
    value: any
  ) => {
    try {
      const { error } = await supabase
        .from("tbscadccgg")
        .update({ [field]: value || null } as any)
        .eq("id", scadenzaId);

      if (error) throw error;

      setScadenze((prev) =>
        prev.map((s) =>
          s.id === scadenzaId ? { ...s, [field]: value } : s
        )
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
          .from("tbscadccgg")
          .update({ note: value || null })
          .eq("id", scadenzaId);

        if (error) throw error;

        setScadenze((prev) =>
          prev.map((s) =>
            s.id === scadenzaId ? { ...s, note: value } : s
          )
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
        .from("tbscadccgg")
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

  const handlePrintOperatore = () => {
    if (filterOperatore === "__all__") return;

    const operatoreNome = getUtenteNome(filterOperatore);

    const righeHtml = filteredScadenze
      .map(
        (scadenza, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${scadenza.nominativo ?? ""}</td>
            <td style="text-align:center;">${
              scadenza.importo_calcolato ? "✓" : ""
            }</td>
            <td style="text-align:center;">${
              scadenza.f24_generato ? "✓" : ""
            }</td>
            <td style="text-align:center;">${
              scadenza.f24_comunicato ? "✓" : ""
            }</td>
            <td>${isoToDDMMYYYY(scadenza.data_comunicato)}</td>
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
          <title>Stampa Scadenzario CCGG</title>
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
            .count {
              margin-bottom: 10px;
              font-weight: bold;
              font-size: 12px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
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
            .col-num {
              width: 40px;
              text-align: center;
            }
            .col-nominativo {
              width: 42%;
            }
            .col-small {
              width: 70px;
              text-align: center;
            }
            .col-data {
              width: 110px;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <h1>Scadenzario CCGG</h1>
          <div class="meta">Anno consultazione: ${annoConsultazione}</div>
          <div class="meta">Operatore: ${operatoreNome}</div>
          <div class="count">Totale record stampati: ${filteredScadenze.length}</div>

          <table>
            <thead>
              <tr>
                <th class="col-num">#</th>
                <th class="col-nominativo">Nominativo</th>
                <th class="col-small">Imp. calc.</th>
                <th class="col-small">F24 gen.</th>
                <th class="col-small">F24 com.</th>
                <th class="col-data">Data com.</th>
                <th class="col-small">Conf.</th>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario CCGG</h1>
          <p className="text-gray-500 mt-1">
            Gestione Certificazioni Conformi Generale e Globale
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
            <div className="text-sm text-gray-600 mb-1">Totale Dichiarazioni</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totale}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Confermate</div>
            <div className="text-3xl font-bold text-green-600">{stats.confermate}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Non Confermate</div>
            <div className="text-3xl font-bold text-orange-600">{stats.nonConfermate}</div>
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
              <label className="text-sm font-medium mb-2 block">Stato Conferma</label>
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
              <label className="text-sm font-medium mb-2 block">Anno consultazione</label>
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
                <tr className="border-b border-gray-400 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground sticky-col-header border-r min-w-[260px]">
                    Nominativo
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px]">
                    Operatore
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[150px]">
                    Importo Calcolato
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    F24 Generato
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    F24 Comunicato
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[150px]">
                    Data Comunicato
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[300px]">
                    Note
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    Conferma
                  </th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[100px]">
                    Azioni
                  </th>
                </tr>
              </thead>

              <tbody className="[&_tr:last-child]:border-0">
                {filteredScadenze.length === 0 ? (
                  <tr className="border-b border-gray-400 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td colSpan={9} className="p-2 align-middle text-center py-8 text-gray-500">
                      Nessun record trovato
                    </td>
                  </tr>
                ) : (
                  filteredScadenze.map((scadenza) => {
                    const isGreenRow = scadenza.conferma_riga === true;

                    return (
                      <tr
                        key={scadenza.id}
                        className={`border-b border-gray-400 transition-colors data-[state=selected]:bg-muted ${
                          isGreenRow ? "bg-green-300 hover:bg-green-300" : "hover:bg-green-50"
                        }`}
                      >
                        <td
                          className={`p-2 align-middle sticky-col-cell border-r font-medium min-w-[260px] ${
                            isGreenRow ? "!bg-green-300" : ""
                          }`}
                        >
                          {scadenza.nominativo}
                        </td>

                        <td className="p-2 align-middle min-w-[180px]">
                          {scadenza.operatore}
                        </td>

                        <td className="p-2 align-middle text-center min-w-[150px]">
                          <Checkbox
                            checked={!!scadenza.importo_calcolato}
                            onCheckedChange={() =>
                              handleToggleField(
                                scadenza.id,
                                "importo_calcolato",
                                scadenza.importo_calcolato
                              )
                            }
                          />
                        </td>

                        <td className="p-2 align-middle text-center min-w-[120px]">
                          <Checkbox
                            checked={scadenza.f24_generato || false}
                            onCheckedChange={() =>
                              handleToggleField(
                                scadenza.id,
                                "f24_generato",
                                scadenza.f24_generato
                              )
                            }
                          />
                        </td>

                        <td className="p-2 align-middle text-center min-w-[120px]">
                          <Checkbox
                            checked={scadenza.f24_comunicato || false}
                            onCheckedChange={() =>
                              handleToggleField(
                                scadenza.id,
                                "f24_comunicato",
                                scadenza.f24_comunicato
                              )
                            }
                          />
                        </td>

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

                              if (!current) {
                                handleUpdateField(scadenza.id, "data_comunicato", null);
                                return;
                              }

                              const iso = ddmmyyyyToIso(current);

                              if (iso) {
                                handleUpdateField(scadenza.id, "data_comunicato", iso);
                              } else {
                                const back = isoToDDMMYYYY(scadenza.data_comunicato);
                                setDateInputs((prev) => ({
                                  ...prev,
                                  [scadenza.id]: back,
                                }));
                                toast({
                                  title: "Data non valida",
                                  description: "Inserisci una data valida nel formato gg/mm/aaaa.",
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="w-full"
                          />
                        </td>

                        <td className="p-2 align-middle min-w-[300px]">
                          <Textarea
                            value={localNotes[scadenza.id] ?? scadenza.note ?? ""}
                            onChange={(e) => handleNoteChange(scadenza.id, e.target.value)}
                            placeholder="Aggiungi note..."
                            className="min-h-[60px] resize-none"
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

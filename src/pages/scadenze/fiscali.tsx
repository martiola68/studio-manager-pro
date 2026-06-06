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
import {
  Search,
  Trash2,
  Printer,
  FileSpreadsheet,
  Mail,
  X,
} from "lucide-react";
import ExcelJS from "exceljs";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type ScadenzaFiscaliRow = Database["public"]["Tables"]["tbscadfiscali"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

type TipoEmailFiscali =
  | "saldo_primo_acconto_cciaa"
  | "secondo_acconto"
  | "dichiarazione_redditi"
  | "dichiarazione_irap";

type ScadenzaFiscali = ScadenzaFiscaliRow & {
  cliente_id?: string | null;
  anno_riferimento?: number | null;
  archiviato?: boolean | null;

  conferma_ires_saldo_acconto?: boolean | null;
  conferma_cciaa?: boolean | null;
  conferma_ires_secondo_acconto?: boolean | null;
  conferma_invio_dichiarazione?: boolean | null;
  conferma_irap_saldo_acconto?: boolean | null;
  conferma_irap_secondo_acconto?: boolean | null;
  conferma_irap_invio_dichiarazione?: boolean | null;

  saldi_primo_acconti_cciaa_dovuti?: boolean | null;
  secondo_acconti_dovuti?: boolean | null;
};

type EmailModalState = {
  open: boolean;
  loading: boolean;
  sending: boolean;
  scadenza: ScadenzaFiscali | null;
  tipo: TipoEmailFiscali | null;
  emails: string[];
  selectedEmail: string;
  subject: string;
  body: string;
};

export default function ScadenzeFiscaliPage() {
  const router = useRouter();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaFiscali[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [annoConsultazione, setAnnoConsultazione] = useState(currentYear);
  const [anniDisponibili, setAnniDisponibili] = useState<number[]>([]);

  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [noteTimers, setNoteTimers] = useState<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  const [emailModal, setEmailModal] = useState<EmailModalState>({
    open: false,
    loading: false,
    sending: false,
    scadenza: null,
    tipo: null,
    emails: [],
    selectedEmail: "",
    subject: "",
    body: "",
  });

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

  const loadScadenze = async (): Promise<ScadenzaFiscali[]> => {
    const { data: anniData, error: anniError } = await supabase
      .from("tbscadfiscali" as any)
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
      .from("tbscadfiscali" as any)
      .select("*")
      .eq("anno_riferimento", annoDaUsare)
      .order("nominativo", { ascending: true });

    if (error) throw error;

    return ((data ?? []) as unknown) as ScadenzaFiscali[];
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
    field: keyof ScadenzaFiscali,
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
        .from("tbscadfiscali" as any)
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
    field: keyof ScadenzaFiscali,
    value: any
  ) => {
    try {
      const { error } = await supabase
        .from("tbscadfiscali" as any)
        .update({ [field]: value === "" ? null : value } as any)
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
          .from("tbscadfiscali" as any)
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
        .from("tbscadfiscali" as any)
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

  const getTipoEmailLabel = (tipo: TipoEmailFiscali) => {
    switch (tipo) {
      case "saldo_primo_acconto_cciaa":
        return "Saldo / 1° acconto / CCIAA";
      case "secondo_acconto":
        return "2° acconto";
      case "dichiarazione_redditi":
        return "Dichiarazione redditi";
      case "dichiarazione_irap":
        return "Dichiarazione IRAP";
      default:
        return "Comunicazione fiscale";
    }
  };

  const apriInvioEmail = async (
    scadenza: ScadenzaFiscali,
    tipo: TipoEmailFiscali
  ) => {
    const label = getTipoEmailLabel(tipo);

    setEmailModal({
      open: true,
      loading: true,
      sending: false,
      scadenza,
      tipo,
      emails: [],
      selectedEmail: "",
      subject: `${label} - ${scadenza.nominativo} - ${scadenza.anno_riferimento}`,
      body: `Gentile Cliente,

con la presente trasmettiamo comunicazione relativa a: ${label}.

Anno di riferimento: ${scadenza.anno_riferimento}
Tipo redditi: ${scadenza.tipo_redditi || "-"}

Cordiali saluti.`,
    });

    try {

      if (!scadenza.cliente_id) {
  throw new Error("Cliente non collegato alla scadenza fiscale.");
}
      const { data: cliente, error } = await supabase
        .from("tbclienti" as any)
        .select("*")
       .eq("id", scadenza.cliente_id || "")
        .maybeSingle();

      if (error) throw error;

      const possibiliEmail = [
        cliente?.email,
        cliente?.pec,
        cliente?.email_pec,
        cliente?.email_amministrativa,
        cliente?.email_contabilita,
        cliente?.email_1,
        cliente?.email_2,
      ]
        .filter(Boolean)
        .map((e: string) => e.trim())
        .filter((e: string, index: number, arr: string[]) => arr.indexOf(e) === index);

      setEmailModal((prev) => ({
        ...prev,
        loading: false,
        emails: possibiliEmail,
        selectedEmail: possibiliEmail[0] || "",
      }));
    } catch (error: any) {
      console.error("Errore caricamento email cliente:", error);
      setEmailModal((prev) => ({
        ...prev,
        loading: false,
      }));
      toast({
        title: "Attenzione",
        description:
          "Non sono riuscito a recuperare automaticamente gli indirizzi email del cliente.",
        variant: "destructive",
      });
    }
  };

  const chiudiInvioEmail = () => {
    setEmailModal({
      open: false,
      loading: false,
      sending: false,
      scadenza: null,
      tipo: null,
      emails: [],
      selectedEmail: "",
      subject: "",
      body: "",
    });
  };

  const inviaEmailFiscali = async () => {
    if (!emailModal.scadenza || !emailModal.tipo) return;

    if (!emailModal.selectedEmail) {
      toast({
        title: "Email mancante",
        description: "Seleziona o inserisci un indirizzo email.",
        variant: "destructive",
      });
      return;
    }

    try {
      setEmailModal((prev) => ({ ...prev, sending: true }));

      const response = await fetch(
        `/api/scadenze/fiscali/${emailModal.scadenza.id}/invia-comunicazione`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tipo: emailModal.tipo,
            email: emailModal.selectedEmail,
            subject: emailModal.subject,
            body: emailModal.body,
          }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            "Errore durante l'invio della comunicazione"
        );
      }

      toast({
        title: "Email inviata",
        description: "Comunicazione fiscale inviata correttamente.",
      });

      chiudiInvioEmail();
      await loadData();
    } catch (error: any) {
      toast({
        title: "Errore invio email",
        description: error.message,
        variant: "destructive",
      });
      setEmailModal((prev) => ({ ...prev, sending: false }));
    }
  };

  const filteredScadenze = scadenze.filter((s) => {
    const matchSearch = (s.nominativo || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const matchOperatore =
      filterOperatore === "__all__" ||
      s.utente_operatore_id === filterOperatore;

    return matchSearch && matchOperatore;
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
            <td>${scadenza.tipo_redditi ?? ""}</td>
            <td style="text-align:center;">${
              scadenza.mod_r_compilato ? "SI" : "NO"
            }</td>
            <td style="text-align:center;">${
              scadenza.mod_r_definitivo ? "SI" : "NO"
            }</td>
            <td style="text-align:center;">${
              scadenza.saldi_primo_acconti_cciaa_dovuti ? "SI" : "NO"
            }</td>
            <td style="text-align:center;">${
              scadenza.conferma_ires_saldo_acconto ? "SI" : "NO"
            }</td>
            <td>${scadenza.data_com1 ?? ""}</td>
            <td style="text-align:center;">${
              scadenza.conferma_invio_dichiarazione ? "SI" : "NO"
            }</td>
            <td>${scadenza.data_r_invio ?? ""}</td>
          </tr>
        `
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=1000,height=700");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Stampa Scadenzario Fiscali</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 18px; color: #111; font-size: 11px; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            .meta { margin-bottom: 12px; color: #444; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
            th, td { border: 1px solid #999; padding: 6px; text-align: left; vertical-align: top; word-wrap: break-word; }
            th { background: #f3f4f6; }
            .count { margin-bottom: 10px; font-weight: bold; font-size: 12px; }
            .col-num { width: 40px; text-align: center; }
            .col-nominativo { width: 30%; }
            .col-small { width: 90px; text-align: center; }
            .col-data { width: 120px; }
          </style>
        </head>
        <body>
          <h1>Scadenzario Fiscali</h1>
          <div class="meta">Anno consultazione: ${annoConsultazione}</div>
          <div class="meta">Operatore: ${operatoreNome}</div>
          <div class="count">Totale record stampati: ${filteredScadenze.length}</div>
          <table>
            <thead>
              <tr>
                <th class="col-num">#</th>
                <th class="col-nominativo">Nominativo</th>
                <th class="col-small">Conf.</th>
                <th>Tipo Redditi</th>
                <th class="col-small">Comp.</th>
                <th class="col-small">Def.</th>
                <th class="col-small">Saldo/1°/CCIAA</th>
                <th class="col-small">Comunicato</th>
                <th class="col-data">Data</th>
                <th class="col-small">Invio Redditi</th>
                <th class="col-data">Data</th>
              </tr>
            </thead>
            <tbody>
              ${righeHtml || `<tr><td colspan="11">Nessun record trovato</td></tr>`}
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

  const handleExportExcelOperatore = async () => {
    if (filterOperatore === "__all__") return;

    const operatoreNome = getUtenteNome(filterOperatore);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Fiscali");

    worksheet.columns = [
      { header: "#", key: "num", width: 6 },
      { header: "Nominativo", key: "nominativo", width: 45 },
      { header: "Operatore", key: "operatore", width: 25 },
      { header: "Confermato", key: "confermato", width: 14 },
      { header: "Tipo Redditi", key: "tipo_redditi", width: 18 },
      { header: "Redditi compilato", key: "mod_r_compilato", width: 18 },
      { header: "Redditi definitivo", key: "mod_r_definitivo", width: 18 },
      {
        header: "Saldo/1° Acc./CCIAA",
        key: "saldi_primo_acconti_cciaa_dovuti",
        width: 24,
      },
      {
        header: "Comunicato Saldo/1° Acc./CCIAA",
        key: "conferma_ires_saldo_acconto",
        width: 28,
      },
      { header: "Data comunicazione", key: "data_com1", width: 18 },
      {
        header: "Invio Redditi",
        key: "conferma_invio_dichiarazione",
        width: 18,
      },
      { header: "Data invio Redditi", key: "data_r_invio", width: 18 },
      { header: "IRAP", key: "con_irap", width: 10 },
      {
        header: "IRAP saldo/acconto",
        key: "conferma_irap_saldo_acconto",
        width: 20,
      },
      {
        header: "IRAP secondo acconto",
        key: "conferma_irap_secondo_acconto",
        width: 22,
      },
      {
        header: "Invio IRAP",
        key: "conferma_irap_invio_dichiarazione",
        width: 18,
      },
      { header: "Data invio IRAP", key: "data_i_invio", width: 18 },
      {
        header: "2° Acconto",
        key: "secondo_acconti_dovuti",
        width: 18,
      },
      {
        header: "Comunicato 2° Acconto",
        key: "conferma_ires_secondo_acconto",
        width: 24,
      },
      { header: "Data comunicazione 2°", key: "data_com2", width: 22 },
      { header: "Note", key: "note", width: 50 },
    ];

    filteredScadenze.forEach((s, index) => {
      worksheet.addRow({
        num: index + 1,
        nominativo: s.nominativo || "",
        operatore: operatoreNome,
        confermato: s.conferma_riga ? "SI" : "NO",
        tipo_redditi: s.tipo_redditi || "",
        mod_r_compilato: s.mod_r_compilato ? "SI" : "NO",
        mod_r_definitivo: s.mod_r_definitivo ? "SI" : "NO",
        saldi_primo_acconti_cciaa_dovuti:
          s.saldi_primo_acconti_cciaa_dovuti ? "SI" : "NO",
        conferma_ires_saldo_acconto: s.conferma_ires_saldo_acconto
          ? "SI"
          : "NO",
        data_com1: s.data_com1 || "",
        conferma_invio_dichiarazione: s.conferma_invio_dichiarazione
          ? "SI"
          : "NO",
        data_r_invio: s.data_r_invio || "",
        con_irap: s.con_irap ? "SI" : "NO",
        conferma_irap_saldo_acconto: s.conferma_irap_saldo_acconto
          ? "SI"
          : "NO",
        conferma_irap_secondo_acconto: s.conferma_irap_secondo_acconto
          ? "SI"
          : "NO",
        conferma_irap_invio_dichiarazione:
          s.conferma_irap_invio_dichiarazione ? "SI" : "NO",
        data_i_invio: s.data_i_invio || "",
        secondo_acconti_dovuti: s.secondo_acconti_dovuti ? "SI" : "NO",
        conferma_ires_secondo_acconto: s.conferma_ires_secondo_acconto
          ? "SI"
          : "NO",
        data_com2: s.data_com2 || "",
        note: s.note || "",
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { vertical: "top", wrapText: true };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `scadenzario_fiscali_${operatoreNome.replace(
      /\s+/g,
      "_"
    )}_${annoConsultazione}.xlsx`;
    link.click();

    window.URL.revokeObjectURL(url);
  };

  const renderSiNoSelect = (
    scadenza: ScadenzaFiscali,
    field: keyof ScadenzaFiscali
  ) => (
    <Select
      value={scadenza[field] ? "SI" : "NO"}
      onValueChange={(value) =>
        handleUpdateField(scadenza.id, field, value === "SI")
      }
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="SI">SI</SelectItem>
        <SelectItem value="NO">NO</SelectItem>
      </SelectContent>
    </Select>
  );

  const renderCheck = (
    scadenza: ScadenzaFiscali,
    field: keyof ScadenzaFiscali
  ) => (
    <Checkbox
      checked={Boolean(scadenza[field])}
      onCheckedChange={() => handleToggleField(scadenza.id, field, scadenza[field])}
    />
  );

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
          <h1 className="text-3xl font-bold text-gray-900">
            Scadenzario Fiscali
          </h1>
          <p className="text-gray-500 mt-1">
            Gestione dichiarazioni fiscali e versamenti
          </p>
        </div>

        {filterOperatore !== "__all__" && (
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleExportExcelOperatore}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Esporta Excel
            </Button>

            <Button
              type="button"
              onClick={handlePrintOperatore}
              className="bg-black text-white hover:bg-zinc-800"
            >
              <Printer className="h-4 w-4 mr-2" />
              Stampa elenco operatore
            </Button>
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Cerca nominativo..."
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
                value={annoConsultazione.toString()}
                onValueChange={(value) => setAnnoConsultazione(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Anno consultazione" />
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
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground sticky-col-header border-r min-w-[300px]">
                    Nominativo
                  </th>
                  <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px]">
                    Operatore
                  </th>
                  <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground min-w-[120px]">
                    Tipo Redditi
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[80px]">
                    Comp.
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[80px]">
                    Def.
                  </th>

                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[170px]">
                    Saldo/1° Acc./CCIAA
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    Comunicato
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[150px]">
                    Data comunicazione
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    Email F24
                  </th>

                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[140px]">
                    Invio Redditi
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[130px]">
                    Data invio
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    Email Redditi
                  </th>

                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[100px]">
                    IRAP
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[140px]">
                    Compilato
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[140px]">
                    Definitivo
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[140px]">
                    Invio IRAP
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[130px]">
                    Data invio
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    Email IRAP
                  </th>

                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[150px]">
                    2° Acconto
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    Comunicato
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[150px]">
                    Data comunicazione
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    Email F24
                  </th>

                  <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground min-w-[200px]">
                    Note
                  </th>
                  <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                    Conferma Riga
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
                      colSpan={25}
                      className="p-2 align-middle text-center text-gray-500"
                    >
                      Nessun record trovato
                    </td>
                  </tr>
                ) : (
                  filteredScadenze.map((scadenza) => (
                    <tr
                      key={scadenza.id}
                      className={`border-b transition-colors data-[state=selected]:bg-muted ${
                        scadenza.conferma_riga
                          ? "bg-green-100 hover:bg-green-200"
                          : "hover:bg-green-50"
                      }`}
                    >
                      <td
                        style={{
                          backgroundColor: scadenza.conferma_riga
                            ? "#dcfce7"
                            : "#ffffff",
                        }}
                        className="p-2 align-middle sticky-col-cell border-r font-medium min-w-[300px]"
                      >
                        {scadenza.nominativo}
                      </td>

                      <td className="p-2 align-middle min-w-[180px]">
                        {getUtenteNome(scadenza.utente_operatore_id)}
                      </td>

                      <td className="p-2 align-middle min-w-[120px]">
                        <Select
                          value={scadenza.tipo_redditi || ""}
                          onValueChange={(value) =>
                            handleUpdateField(scadenza.id, "tipo_redditi", value)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USC">USC</SelectItem>
                            <SelectItem value="USP">USP</SelectItem>
                            <SelectItem value="ENC">ENC</SelectItem>
                            <SelectItem value="UPF FORF.">UPF FORF.</SelectItem>
                            <SelectItem value="UPF ORD.">UPF ORD.</SelectItem>
                            <SelectItem value="UPF BASE">UPF BASE</SelectItem>
                            <SelectItem value="730">730</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="p-2 align-middle text-center min-w-[80px]">
                        {renderCheck(scadenza, "mod_r_compilato")}
                      </td>

                      <td className="p-2 align-middle text-center min-w-[80px]">
                        {renderCheck(scadenza, "mod_r_definitivo")}
                      </td>

                      <td className="p-2 align-middle min-w-[170px]">
                        {renderSiNoSelect(
                          scadenza,
                          "saldi_primo_acconti_cciaa_dovuti"
                        )}
                      </td>

                      <td className="p-2 align-middle min-w-[120px]">
                        {renderSiNoSelect(
                          scadenza,
                          "conferma_ires_saldo_acconto"
                        )}
                      </td>

                      <td className="p-2 align-middle min-w-[150px]">
                        <Input
                          type="date"
                          value={scadenza.data_com1 || ""}
                          onChange={(e) =>
                            handleUpdateField(
                              scadenza.id,
                              "data_com1",
                              e.target.value
                            )
                          }
                          className={
                            scadenza.conferma_ires_saldo_acconto
                              ? "w-full bg-green-500 text-black"
                              : "w-full"
                          }
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            apriInvioEmail(
                              scadenza,
                              "saldo_primo_acconto_cciaa"
                            )
                          }
                          className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Invia
                        </Button>
                      </td>

                      <td className="p-2 align-middle text-center min-w-[140px]">
                        {renderCheck(scadenza, "conferma_invio_dichiarazione")}
                      </td>

                      <td className="p-2 align-middle min-w-[130px]">
                        <Input
                          type="date"
                          value={scadenza.data_r_invio || ""}
                          onChange={(e) =>
                            handleUpdateField(
                              scadenza.id,
                              "data_r_invio",
                              e.target.value
                            )
                          }
                          className={
                            scadenza.conferma_invio_dichiarazione
                              ? "w-full bg-green-500 text-black"
                              : "w-full"
                          }
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            apriInvioEmail(scadenza, "dichiarazione_redditi")
                          }
                          className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Invia
                        </Button>
                      </td>

                      <td className="p-2 align-middle text-center min-w-[100px]">
                        {renderCheck(scadenza, "con_irap")}
                      </td>

                      <td className="p-2 align-middle text-center min-w-[140px]">
                        {renderCheck(scadenza, "conferma_irap_saldo_acconto")}
                      </td>

                      <td className="p-2 align-middle text-center min-w-[140px]">
                        {renderCheck(scadenza, "conferma_irap_secondo_acconto")}
                      </td>

                      <td className="p-2 align-middle text-center min-w-[140px]">
                        {renderCheck(
                          scadenza,
                          "conferma_irap_invio_dichiarazione"
                        )}
                      </td>

                      <td className="p-2 align-middle min-w-[130px]">
                        <Input
                          type="date"
                          value={scadenza.data_i_invio || ""}
                          onChange={(e) =>
                            handleUpdateField(
                              scadenza.id,
                              "data_i_invio",
                              e.target.value
                            )
                          }
                          className={
                            scadenza.conferma_irap_invio_dichiarazione
                              ? "w-full bg-green-500 text-black"
                              : "w-full"
                          }
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            apriInvioEmail(scadenza, "dichiarazione_irap")
                          }
                          className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Invia
                        </Button>
                      </td>

                      <td className="p-2 align-middle min-w-[150px]">
                        {renderSiNoSelect(scadenza, "secondo_acconti_dovuti")}
                      </td>

                      <td className="p-2 align-middle min-w-[120px]">
                        {renderSiNoSelect(
                          scadenza,
                          "conferma_ires_secondo_acconto"
                        )}
                      </td>

                      <td className="p-2 align-middle min-w-[150px]">
                        <Input
                          type="date"
                          value={scadenza.data_com2 || ""}
                          onChange={(e) =>
                            handleUpdateField(
                              scadenza.id,
                              "data_com2",
                              e.target.value
                            )
                          }
                          className={
                            scadenza.conferma_ires_secondo_acconto
                              ? "w-full bg-green-500 text-black"
                              : "w-full"
                          }
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            apriInvioEmail(scadenza, "secondo_acconto")
                          }
                          className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Invia
                        </Button>
                      </td>

                      <td className="p-2 align-middle min-w-[200px]">
                        <Textarea
                          value={localNotes[scadenza.id] ?? scadenza.note ?? ""}
                          onChange={(e) =>
                            handleNoteChange(scadenza.id, e.target.value)
                          }
                          className="w-full min-h-[60px]"
                          placeholder="Note..."
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        {renderCheck(scadenza, "conferma_riga")}
                      </td>

                      <td className="p-2 align-middle text-center min-w-[100px]">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(scadenza.id)}
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

      {emailModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Invia comunicazione fiscale
                </h2>
                <p className="text-sm text-gray-500">
                  {emailModal.scadenza?.nominativo} -{" "}
                  {emailModal.tipo ? getTipoEmailLabel(emailModal.tipo) : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={chiudiInvioEmail}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {emailModal.loading ? (
                <div className="text-sm text-gray-500">
                  Caricamento indirizzi email...
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Email destinatario
                    </label>

                    {emailModal.emails.length > 0 ? (
                      <Select
                        value={emailModal.selectedEmail}
                        onValueChange={(value) =>
                          setEmailModal((prev) => ({
                            ...prev,
                            selectedEmail: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona email" />
                        </SelectTrigger>
                        <SelectContent>
                          {emailModal.emails.map((email) => (
                            <SelectItem key={email} value={email}>
                              {email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type="email"
                        value={emailModal.selectedEmail}
                        onChange={(e) =>
                          setEmailModal((prev) => ({
                            ...prev,
                            selectedEmail: e.target.value,
                          }))
                        }
                        placeholder="Inserisci email cliente"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Oggetto
                    </label>
                    <Input
                      value={emailModal.subject}
                      onChange={(e) =>
                        setEmailModal((prev) => ({
                          ...prev,
                          subject: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Corpo messaggio
                    </label>
                    <Textarea
                      value={emailModal.body}
                      onChange={(e) =>
                        setEmailModal((prev) => ({
                          ...prev,
                          body: e.target.value,
                        }))
                      }
                      className="min-h-[180px]"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={chiudiInvioEmail}
                disabled={emailModal.sending}
              >
                Annulla
              </Button>

              <Button
                type="button"
                onClick={inviaEmailFiscali}
                disabled={emailModal.loading || emailModal.sending}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Mail className="h-4 w-4 mr-2" />
                {emailModal.sending ? "Invio..." : "Invia email"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

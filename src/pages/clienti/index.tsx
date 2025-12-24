import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { clienteService } from "@/services/clienteService";
import { contattoService } from "@/services/contattoService";
import { utenteService } from "@/services/utenteService";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Edit, Trash2, Search, Plus, Calendar, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import type { Database } from "@/integrations/supabase/types";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type Prestazione = Database["public"]["Tables"]["tbprestazioni"]["Row"];

interface CSVRow {
  cod_cliente: string;
  ragione_sociale: string;
  partita_iva: string;
  codice_fiscale: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
  email: string;
  note?: string;
  attivo?: string;
  tipo_cliente?: string;
  flag_iva?: string;
  flag_cu?: string;
  flag_bilancio?: string;
  flag_fiscali?: string;
  flag_lipe?: string;
  flag_770?: string;
  flag_esterometro?: string;
  flag_ccgg?: string;
  flag_proforma?: string;
  flag_mail_attivo?: string;
  flag_mail_scadenze?: string;
  flag_mail_newsletter?: string;
  utente_operatore_id?: string;
  utente_professionista_id?: string;
  contatto1_id?: string;
  contatto2_id?: string;
  tipo_prestazione_id?: string;
  scadenza_antiric?: string;
}

interface ImportResult {
  success: number;
  duplicates: number;
  errors: number;
  duplicateDetails: Array<{ ragione_sociale: string; partita_iva: string; codice_fiscale: string }>;
  errorDetails: Array<{ row: number; ragione_sociale: string; error: string }>;
}

const TIPO_REDDITI_OPTIONS = ["SC", "SP", "ENC", "PF", "730"];

export default function ClientiPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [contatti, setContatti] = useState<Contatto[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [prestazioni, setPrestazioni] = useState<Prestazione[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [activeTab, setActiveTab] = useState("anagrafica");

  // CSV Import States
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [formData, setFormData] = useState({
    ragione_sociale: "",
    codice_fiscale: "",
    partita_iva: "",
    indirizzo: "",
    cap: "",
    citta: "",
    provincia: "",
    email: "",
    note: "",
    attivo: true,
    utente_operatore_id: "__none__",
    utente_professionista_id: "__none__",
    contatto1_id: "__none__",
    contatto2_id: "__none__",
    scadenza_antiric: "",
    tipo_prestazione_id: "__none__",
    tipo_cliente: "Esterno",
    tipo_redditi: "__none__",
    data_ultima_verifica_antiric: "",
    tipo_prestazione_a: "__none__",
    tipo_prestazione_b: "__none__",
    data_ultima_verifica_b: "",
    scadenza_antiric_b: "",
    flag_iva: true,
    flag_cu: true,
    flag_bilancio: true,
    flag_fiscali: true,
    flag_lipe: true,
    flag_770: true,
    flag_esterometro: true,
    flag_ccgg: true,
    flag_proforma: true,
    flag_mail_attivo: true,
    flag_mail_scadenze: true,
    flag_mail_newsletter: true
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
      const [clientiData, contattiData, utentiData, prestazioniData] = await Promise.all([
        clienteService.getClienti(),
        contattoService.getContatti(),
        utenteService.getUtenti(),
        loadPrestazioni()
      ]);
      setClienti(clientiData);
      setContatti(contattiData);
      setUtenti(utentiData);
      setPrestazioni(prestazioniData);
    } catch (error) {
      console.error("Errore caricamento dati:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPrestazioni = async (): Promise<Prestazione[]> => {
    const { data, error } = await supabase
      .from("tbprestazioni")
      .select("*")
      .order("descrizione");
    if (error) throw error;
    return data || [];
  };

  const checkDuplicates = async (partita_iva: string, codice_fiscale: string, excludeId?: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale, partita_iva, codice_fiscale")
      .or(`partita_iva.eq.${partita_iva},codice_fiscale.eq.${codice_fiscale}`);

    if (error) {
      console.error("Errore controllo duplicati:", error);
      return false;
    }

    const duplicates = data?.filter(c => excludeId ? c.id !== excludeId : true) || [];
    
    if (duplicates.length > 0) {
      const dup = duplicates[0];
      toast({
        title: "Cliente già esistente",
        description: `Trovato: ${dup.ragione_sociale} - P.IVA: ${dup.partita_iva || 'N/A'} - CF: ${dup.codice_fiscale}`,
        variant: "destructive"
      });
      return true;
    }

    return false;
  };

  // CSV Import Functions
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({
          title: "Formato non valido",
          description: "Seleziona un file CSV",
          variant: "destructive"
        });
        return;
      }
      setCsvFile(file);
      parseCSV(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      setCsvFile(file);
      parseCSV(file);
    } else {
      toast({
        title: "Formato non valido",
        description: "Seleziona un file CSV",
        variant: "destructive"
      });
    }
  };

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as CSVRow[];
        setCsvData(data);
        toast({
          title: "File caricato",
          description: `${data.length} record pronti per l'importazione`
        });
      },
      error: (error) => {
        toast({
          title: "Errore parsing CSV",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/template_importazione_clienti.csv';
    link.download = 'template_importazione_clienti.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const convertToBoolean = (value: string | undefined): boolean => {
    if (!value) return false;
    const lowerValue = value.toLowerCase().trim();
    return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes' || lowerValue === 'si';
  };

  const handleImportCSV = async () => {
    if (csvData.length === 0) {
      toast({
        title: "Nessun dato",
        description: "Carica un file CSV prima di importare",
        variant: "destructive"
      });
      return;
    }

    setImporting(true);
    setImportProgress(0);
    
    const result: ImportResult = {
      success: 0,
      duplicates: 0,
      errors: 0,
      duplicateDetails: [],
      errorDetails: []
    };

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
      try {
        // Validazione campi obbligatori
        if (!row.ragione_sociale || !row.partita_iva || !row.codice_fiscale || 
            !row.indirizzo || !row.cap || !row.citta || !row.provincia || !row.email) {
          result.errors++;
          result.errorDetails.push({
            row: i + 2,
            ragione_sociale: row.ragione_sociale || 'N/A',
            error: 'Campi obbligatori mancanti'
          });
          continue;
        }

        // Controllo duplicati
        const { data: existing } = await supabase
          .from("tbclienti")
          .select("id, ragione_sociale, partita_iva, codice_fiscale")
          .or(`partita_iva.eq.${row.partita_iva},codice_fiscale.eq.${row.codice_fiscale}`);

        if (existing && existing.length > 0) {
          result.duplicates++;
          result.duplicateDetails.push({
            ragione_sociale: row.ragione_sociale,
            partita_iva: row.partita_iva,
            codice_fiscale: row.codice_fiscale
          });
          setImportProgress(Math.round(((i + 1) / csvData.length) * 100));
          continue;
        }

        // Genera cod_cliente se mancante
        const codCliente = row.cod_cliente || `CL-${Date.now().toString().substr(-6)}-${i}`;

        // Prepara dati per inserimento
        const clienteData = {
          cod_cliente: codCliente,
          ragione_sociale: row.ragione_sociale,
          partita_iva: row.partita_iva,
          codice_fiscale: row.codice_fiscale,
          indirizzo: row.indirizzo,
          cap: row.cap,
          citta: row.citta,
          provincia: row.provincia,
          email: row.email,
          note: row.note || null,
          attivo: row.attivo ? convertToBoolean(row.attivo) : true,
          tipo_cliente: row.tipo_cliente || "Esterno",
          flag_iva: row.flag_iva ? convertToBoolean(row.flag_iva) : true,
          flag_cu: row.flag_cu ? convertToBoolean(row.flag_cu) : true,
          flag_bilancio: row.flag_bilancio ? convertToBoolean(row.flag_bilancio) : true,
          flag_fiscali: row.flag_fiscali ? convertToBoolean(row.flag_fiscali) : true,
          flag_lipe: row.flag_lipe ? convertToBoolean(row.flag_lipe) : true,
          flag_770: row.flag_770 ? convertToBoolean(row.flag_770) : true,
          flag_esterometro: row.flag_esterometro ? convertToBoolean(row.flag_esterometro) : true,
          flag_ccgg: row.flag_ccgg ? convertToBoolean(row.flag_ccgg) : true,
          flag_proforma: row.flag_proforma ? convertToBoolean(row.flag_proforma) : true,
          flag_mail_attivo: row.flag_mail_attivo ? convertToBoolean(row.flag_mail_attivo) : true,
          flag_mail_scadenze: row.flag_mail_scadenze ? convertToBoolean(row.flag_mail_scadenze) : true,
          flag_mail_newsletter: row.flag_mail_newsletter ? convertToBoolean(row.flag_mail_newsletter) : true,
          utente_operatore_id: row.utente_operatore_id?.trim() || null,
          utente_professionista_id: row.utente_professionista_id?.trim() || null,
          contatto1_id: row.contatto1_id?.trim() || null,
          contatto2_id: row.contatto2_id?.trim() || null,
          tipo_prestazione_id: row.tipo_prestazione_id?.trim() || null,
          scadenza_antiric: row.scadenza_antiric?.trim() || null
        };

        // Inserisci nel database
        await clienteService.createCliente(clienteData);
        result.success++;

      } catch (error) {
        console.error(`Errore riga ${i + 2}:`, error);
        result.errors++;
        result.errorDetails.push({
          row: i + 2,
          ragione_sociale: row.ragione_sociale || 'N/A',
          error: error instanceof Error ? error.message : 'Errore sconosciuto'
        });
      }

      setImportProgress(Math.round(((i + 1) / csvData.length) * 100));
    }

    setImporting(false);
    setImportResult(result);
    
    // Ricarica lista clienti
    await loadData();

    // Mostra riepilogo
    toast({
      title: "Importazione completata",
      description: `✅ ${result.success} importati | ⚠️ ${result.duplicates} duplicati | ❌ ${result.errors} errori`,
    });
  };

  const resetImport = () => {
    setCsvFile(null);
    setCsvData([]);
    setImportProgress(0);
    setImportResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ragione_sociale || !formData.partita_iva || !formData.codice_fiscale) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive"
      });
      return;
    }

    const hasDuplicates = await checkDuplicates(
      formData.partita_iva, 
      formData.codice_fiscale,
      editingCliente?.id
    );

    if (hasDuplicates) return;

    try {
      const dataToSave = {
        ...formData,
        utente_operatore_id: formData.utente_operatore_id && formData.utente_operatore_id !== "__none__" ? formData.utente_operatore_id : null,
        utente_professionista_id: formData.utente_professionista_id && formData.utente_professionista_id !== "__none__" ? formData.utente_professionista_id : null,
        contatto1_id: formData.contatto1_id && formData.contatto1_id !== "__none__" ? formData.contatto1_id : null,
        contatto2_id: formData.contatto2_id && formData.contatto2_id !== "__none__" ? formData.contatto2_id : null,
        tipo_prestazione_id: formData.tipo_prestazione_id && formData.tipo_prestazione_id !== "__none__" ? formData.tipo_prestazione_id : null,
        scadenza_antiric: formData.scadenza_antiric || null,
        tipo_redditi: formData.tipo_redditi && formData.tipo_redditi !== "__none__" ? formData.tipo_redditi : null,
        data_ultima_verifica_antiric: formData.data_ultima_verifica_antiric || null,
        tipo_prestazione_a: formData.tipo_prestazione_a && formData.tipo_prestazione_a !== "__none__" ? formData.tipo_prestazione_a : null,
        tipo_prestazione_b: formData.tipo_prestazione_b && formData.tipo_prestazione_b !== "__none__" ? formData.tipo_prestazione_b : null,
        data_ultima_verifica_b: formData.data_ultima_verifica_b || null,
        scadenza_antiric_b: formData.scadenza_antiric_b || null
      };

      if (editingCliente) {
        await clienteService.updateCliente(editingCliente.id, dataToSave);
        toast({
          title: "Successo",
          description: "Cliente aggiornato con successo"
        });
      } else {
        const codCliente = `CL-${Date.now().toString().substr(-6)}`;
        
        await clienteService.createCliente({
          ...dataToSave,
          cod_cliente: codCliente
        });
        toast({
          title: "Successo",
          description: "Cliente creato con successo"
        });
      }

      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il cliente",
        variant: "destructive"
      });
    }
  };

  const handleAggiungiAScadenzari = async (clienteId: string) => {
    const cliente = clienti.find(c => c.id === clienteId);
    if (!cliente) return;

    const scadenzariSelezionati = [];
    if (cliente.flag_iva) scadenzariSelezionati.push("IVA");
    if (cliente.flag_770) scadenzariSelezionati.push("770");
    if (cliente.flag_lipe) scadenzariSelezionati.push("Lipe");
    if (cliente.flag_esterometro) scadenzariSelezionati.push("Esterometro");
    if (cliente.flag_proforma) scadenzariSelezionati.push("Proforma");

    if (scadenzariSelezionati.length === 0) {
      toast({
        title: "Nessuno scadenzario selezionato",
        description: "Attiva almeno un flag per aggiungere il cliente agli scadenzari",
        variant: "destructive"
      });
      return;
    }

    try {
      const promises = [];

      if (cliente.flag_iva) {
        promises.push(
          supabase.from("tbscadiva").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id,
            conferma_riga: false
          })
        );
      }

      if (cliente.flag_770) {
        promises.push(
          supabase.from("tbscad770").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id,
            conferma_riga: false
          })
        );
      }

      if (cliente.flag_lipe) {
        promises.push(
          supabase.from("tbscadlipe").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id
          })
        );
      }

      if (cliente.flag_esterometro) {
        promises.push(
          supabase.from("tbscadestero").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id
          })
        );
      }

      if (cliente.flag_proforma) {
        promises.push(
          supabase.from("tbscadproforma").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id
          })
        );
      }

      await Promise.all(promises);

      toast({
        title: "Successo",
        description: `Cliente aggiunto a ${scadenzariSelezionati.length} scadenzari: ${scadenzariSelezionati.join(", ")}`
      });
    } catch (error) {
      console.error("Errore aggiunta scadenzari:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiungere agli scadenzari",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      ragione_sociale: cliente.ragione_sociale,
      codice_fiscale: cliente.codice_fiscale,
      partita_iva: cliente.partita_iva,
      indirizzo: cliente.indirizzo,
      cap: cliente.cap,
      citta: cliente.citta,
      provincia: cliente.provincia,
      email: cliente.email,
      note: cliente.note || "",
      attivo: cliente.attivo ?? true,
      utente_operatore_id: cliente.utente_operatore_id || "__none__",
      utente_professionista_id: cliente.utente_professionista_id || "__none__",
      contatto1_id: cliente.contatto1_id || "__none__",
      contatto2_id: cliente.contatto2_id || "__none__",
      scadenza_antiric: cliente.scadenza_antiric || "",
      tipo_prestazione_id: cliente.tipo_prestazione_id || "__none__",
      tipo_cliente: cliente.tipo_cliente || "Esterno",
      tipo_redditi: cliente.tipo_redditi || "__none__",
      data_ultima_verifica_antiric: cliente.data_ultima_verifica_antiric || "",
      tipo_prestazione_a: cliente.tipo_prestazione_a || "__none__",
      tipo_prestazione_b: cliente.tipo_prestazione_b || "__none__",
      data_ultima_verifica_b: cliente.data_ultima_verifica_b || "",
      scadenza_antiric_b: cliente.scadenza_antiric_b || "",
      flag_iva: cliente.flag_iva ?? true,
      flag_cu: cliente.flag_cu ?? true,
      flag_bilancio: cliente.flag_bilancio ?? true,
      flag_fiscali: cliente.flag_fiscali ?? true,
      flag_lipe: cliente.flag_lipe ?? true,
      flag_770: cliente.flag_770 ?? true,
      flag_esterometro: cliente.flag_esterometro ?? true,
      flag_ccgg: cliente.flag_ccgg ?? true,
      flag_proforma: cliente.flag_proforma ?? true,
      flag_mail_attivo: cliente.flag_mail_attivo ?? true,
      flag_mail_scadenze: cliente.flag_mail_scadenze ?? true,
      flag_mail_newsletter: cliente.flag_mail_newsletter ?? true
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo cliente? Verranno eliminate anche tutte le scadenze associate.")) return;

    try {
      await clienteService.deleteCliente(id);
      toast({
        title: "Successo",
        description: "Cliente eliminato con successo"
      });
      await loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il cliente",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      ragione_sociale: "",
      codice_fiscale: "",
      partita_iva: "",
      indirizzo: "",
      cap: "",
      citta: "",
      provincia: "",
      email: "",
      note: "",
      attivo: true,
      utente_operatore_id: "__none__",
      utente_professionista_id: "__none__",
      contatto1_id: "__none__",
      contatto2_id: "__none__",
      scadenza_antiric: "",
      tipo_prestazione_id: "__none__",
      tipo_cliente: "Esterno",
      tipo_redditi: "__none__",
      data_ultima_verifica_antiric: "",
      tipo_prestazione_a: "__none__",
      tipo_prestazione_b: "__none__",
      data_ultima_verifica_b: "",
      scadenza_antiric_b: "",
      flag_iva: true,
      flag_cu: true,
      flag_bilancio: true,
      flag_fiscali: true,
      flag_lipe: true,
      flag_770: true,
      flag_esterometro: true,
      flag_ccgg: true,
      flag_proforma: true,
      flag_mail_attivo: true,
      flag_mail_scadenze: true,
      flag_mail_newsletter: true
    });
    setEditingCliente(null);
    setActiveTab("anagrafica");
  };

  const filteredClienti = clienti.filter(c =>
    c.ragione_sociale.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.partita_iva.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.codice_fiscale.toLowerCase().includes(searchQuery.toLowerCase())
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Gestione Clienti</h1>
                <p className="text-gray-500 mt-1">Anagrafica completa e gestione scadenzari</p>
              </div>
              <div className="flex gap-3">
                {/* CSV Import Dialog */}
                <Dialog open={importDialogOpen} onOpenChange={(open) => {
                  setImportDialogOpen(open);
                  if (!open) resetImport();
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                      <Upload className="h-4 w-4 mr-2" />
                      Importa CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Importazione Massiva Clienti da CSV</DialogTitle>
                      <DialogDescription>
                        Carica un file CSV per importare più clienti contemporaneamente
                      </DialogDescription>
                    </DialogHeader>

                    {!importResult ? (
                      <div className="space-y-6">
                        {/* Download Template */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <FileSpreadsheet className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-semibold text-blue-900 mb-1">
                                Scarica il template CSV
                              </p>
                              <p className="text-sm text-blue-800 mb-3">
                                Usa il nostro modello per compilare i dati dei clienti con tutti i campi richiesti
                              </p>
                              <Button 
                                onClick={downloadTemplate}
                                size="sm"
                                variant="outline"
                                className="border-blue-600 text-blue-600 hover:bg-blue-100"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Scarica Template
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Upload Area */}
                        <div
                          onDrop={handleDrop}
                          onDragOver={(e) => e.preventDefault()}
                          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="hidden"
                            id="csv-upload"
                          />
                          <label htmlFor="csv-upload" className="cursor-pointer">
                            <Upload className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                            <p className="text-lg font-medium text-gray-900 mb-1">
                              Trascina qui il file CSV
                            </p>
                            <p className="text-sm text-gray-500">
                              oppure clicca per selezionarlo
                            </p>
                          </label>
                        </div>

                        {/* Preview */}
                        {csvData.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-gray-900">
                                Anteprima: {csvData.length} clienti
                              </h3>
                              <Button
                                onClick={resetImport}
                                variant="outline"
                                size="sm"
                              >
                                Carica altro file
                              </Button>
                            </div>

                            <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Ragione Sociale</TableHead>
                                    <TableHead>P.IVA</TableHead>
                                    <TableHead>CF</TableHead>
                                    <TableHead>Città</TableHead>
                                    <TableHead>Email</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {csvData.slice(0, 10).map((row, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell className="font-medium">{row.ragione_sociale}</TableCell>
                                      <TableCell className="font-mono text-sm">{row.partita_iva}</TableCell>
                                      <TableCell className="font-mono text-sm">{row.codice_fiscale}</TableCell>
                                      <TableCell>{row.citta}</TableCell>
                                      <TableCell className="text-sm">{row.email}</TableCell>
                                    </TableRow>
                                  ))}
                                  {csvData.length > 10 && (
                                    <TableRow>
                                      <TableCell colSpan={5} className="text-center text-gray-500">
                                        ... e altri {csvData.length - 10} clienti
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>

                            {/* Import Progress */}
                            {importing && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span>Importazione in corso...</span>
                                  <span className="font-semibold">{importProgress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${importProgress}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}

                            {/* Import Button */}
                            <div className="flex justify-end gap-3 pt-4">
                              <Button
                                onClick={() => setImportDialogOpen(false)}
                                variant="outline"
                                disabled={importing}
                              >
                                Annulla
                              </Button>
                              <Button
                                onClick={handleImportCSV}
                                disabled={importing || csvData.length === 0}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {importing ? (
                                  <>Importazione in corso...</>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Importa {csvData.length} Clienti
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Import Result */
                      <div className="space-y-6">
                        <div className="text-center py-6">
                          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                          <h3 className="text-2xl font-bold text-gray-900 mb-2">
                            Importazione Completata
                          </h3>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-4">
                          <Card className="border-l-4 border-l-green-600">
                            <CardContent className="pt-6">
                              <div className="text-center">
                                <p className="text-3xl font-bold text-green-600">
                                  {importResult.success}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">Clienti Importati</p>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="border-l-4 border-l-orange-600">
                            <CardContent className="pt-6">
                              <div className="text-center">
                                <p className="text-3xl font-bold text-orange-600">
                                  {importResult.duplicates}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">Duplicati Saltati</p>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="border-l-4 border-l-red-600">
                            <CardContent className="pt-6">
                              <div className="text-center">
                                <p className="text-3xl font-bold text-red-600">
                                  {importResult.errors}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">Errori</p>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Duplicates Details */}
                        {importResult.duplicateDetails.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-orange-600" />
                              Clienti Duplicati (già esistenti)
                            </h4>
                            <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Ragione Sociale</TableHead>
                                    <TableHead>P.IVA</TableHead>
                                    <TableHead>CF</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {importResult.duplicateDetails.map((dup, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>{dup.ragione_sociale}</TableCell>
                                      <TableCell className="font-mono text-sm">{dup.partita_iva}</TableCell>
                                      <TableCell className="font-mono text-sm">{dup.codice_fiscale}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}

                        {/* Error Details */}
                        {importResult.errorDetails.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-red-600" />
                              Errori di Importazione
                            </h4>
                            <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Riga</TableHead>
                                    <TableHead>Ragione Sociale</TableHead>
                                    <TableHead>Errore</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {importResult.errorDetails.map((err, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>{err.row}</TableCell>
                                      <TableCell>{err.ragione_sociale}</TableCell>
                                      <TableCell className="text-sm text-red-600">{err.error}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button onClick={() => setImportDialogOpen(false)}>
                            Chiudi
                          </Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                {/* New Client Dialog */}
                <Dialog open={dialogOpen} onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (!open) resetForm();
                }}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Nuovo Cliente
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingCliente ? "Modifica Cliente" : "Nuovo Cliente"}
                      </DialogTitle>
                      <DialogDescription>
                        Inserisci i dati completi del cliente
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                      <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
                          <TabsTrigger value="riferimenti">Riferimenti</TabsTrigger>
                          <TabsTrigger value="scadenzari">Scadenzari</TabsTrigger>
                          <TabsTrigger value="comunicazioni">Comunicazioni</TabsTrigger>
                        </TabsList>

                        <TabsContent value="anagrafica" className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="ragione_sociale">Ragione Sociale *</Label>
                            <Input
                              id="ragione_sociale"
                              value={formData.ragione_sociale}
                              onChange={(e) => setFormData({ ...formData, ragione_sociale: e.target.value })}
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="partita_iva">Partita IVA *</Label>
                              <Input
                                id="partita_iva"
                                value={formData.partita_iva}
                                onChange={(e) => setFormData({ ...formData, partita_iva: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="codice_fiscale">Codice Fiscale *</Label>
                              <Input
                                id="codice_fiscale"
                                value={formData.codice_fiscale}
                                onChange={(e) => setFormData({ ...formData, codice_fiscale: e.target.value })}
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="indirizzo">Indirizzo *</Label>
                            <Input
                              id="indirizzo"
                              value={formData.indirizzo}
                              onChange={(e) => setFormData({ ...formData, indirizzo: e.target.value })}
                              required
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="cap">CAP *</Label>
                              <Input
                                id="cap"
                                value={formData.cap}
                                onChange={(e) => setFormData({ ...formData, cap: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="citta">Città *</Label>
                              <Input
                                id="citta"
                                value={formData.citta}
                                onChange={(e) => setFormData({ ...formData, citta: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="provincia">Provincia *</Label>
                              <Input
                                id="provincia"
                                value={formData.provincia}
                                onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                                maxLength={2}
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                              id="email"
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="tipo_cliente">Tipo Cliente</Label>
                              <Select
                                value={formData.tipo_cliente}
                                onValueChange={(value) => setFormData({ ...formData, tipo_cliente: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Interno">Interno</SelectItem>
                                  <SelectItem value="Esterno">Esterno</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center space-x-2 pt-8">
                              <input
                                type="checkbox"
                                id="attivo"
                                checked={formData.attivo}
                                onChange={(e) => setFormData({ ...formData, attivo: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="attivo" className="cursor-pointer">Cliente Attivo</Label>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="note">Note</Label>
                            <Textarea
                              id="note"
                              value={formData.note}
                              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                              rows={3}
                            />
                          </div>
                        </TabsContent>

                        <TabsContent value="riferimenti" className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="utente_operatore_id">Utente Operatore</Label>
                              <Select
                                value={formData.utente_operatore_id || "__none__"}
                                onValueChange={(value) => setFormData({ ...formData, utente_operatore_id: value === "__none__" ? "" : value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona utente" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Nessuno</SelectItem>
                                  {utenti.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                      {u.nome} {u.cognome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="utente_professionista_id">Utente Professionista</Label>
                              <Select
                                value={formData.utente_professionista_id || "__none__"}
                                onValueChange={(value) => setFormData({ ...formData, utente_professionista_id: value === "__none__" ? "" : value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona utente" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Nessuno</SelectItem>
                                  {utenti.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                      {u.nome} {u.cognome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="contatto1_id">Contatto 1</Label>
                              <Select
                                value={formData.contatto1_id || "__none__"}
                                onValueChange={(value) => setFormData({ ...formData, contatto1_id: value === "__none__" ? "" : value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona contatto" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Nessuno</SelectItem>
                                  {contatti.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.nome} {c.cognome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="contatto2_id">Contatto 2</Label>
                              <Select
                                value={formData.contatto2_id || "__none__"}
                                onValueChange={(value) => setFormData({ ...formData, contatto2_id: value === "__none__" ? "" : value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona contatto" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Nessuno</SelectItem>
                                  {contatti.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.nome} {c.cognome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="tipo_prestazione_id">Tipo Prestazione</Label>
                            <Select
                              value={formData.tipo_prestazione_id || "__none__"}
                              onValueChange={(value) => setFormData({ ...formData, tipo_prestazione_id: value === "__none__" ? "" : value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona prestazione" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Nessuna</SelectItem>
                                {prestazioni.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.descrizione}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="tipo_redditi">Tipo Redditi</Label>
                            <Select
                              value={formData.tipo_redditi || "__none__"}
                              onValueChange={(value) => setFormData({ ...formData, tipo_redditi: value === "__none__" ? "" : value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona tipo redditi" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Nessuno</SelectItem>
                                {TIPO_REDDITI_OPTIONS.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="border-t pt-4 mt-4">
                            <h3 className="font-semibold mb-4 text-lg">Adeguata Verifica Clientela (Antiriciclaggio)</h3>
                            
                            {/* Sezione A */}
                            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <h4 className="font-semibold mb-3 text-blue-900">📋 Verifica A (Principale)</h4>
                              
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="tipo_prestazione_a">Tipo Prestazione A</Label>
                                  <Select
                                    value={formData.tipo_prestazione_a || "__none__"}
                                    onValueChange={(value) => setFormData({ ...formData, tipo_prestazione_a: value === "__none__" ? "" : value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona tipo prestazione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">Nessuna</SelectItem>
                                      <SelectItem value="Assistenza e consulenza societaria continuativa e generica">
                                        Assistenza e consulenza societaria continuativa e generica
                                      </SelectItem>
                                      <SelectItem value="Consulenza del Lavoro">
                                        Consulenza del Lavoro
                                      </SelectItem>
                                      <SelectItem value="Altre attività">
                                        Altre attività
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="data_ultima_verifica_antiric">Data Ultima Verifica A</Label>
                                    <Input
                                      id="data_ultima_verifica_antiric"
                                      type="date"
                                      value={formData.data_ultima_verifica_antiric}
                                      onChange={(e) => setFormData({ ...formData, data_ultima_verifica_antiric: e.target.value })}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="scadenza_antiric">Scadenza Antiriciclaggio A</Label>
                                    <Input
                                      id="scadenza_antiric"
                                      type="date"
                                      value={formData.scadenza_antiric}
                                      onChange={(e) => setFormData({ ...formData, scadenza_antiric: e.target.value })}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Sezione B */}
                            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                              <h4 className="font-semibold mb-3 text-green-900">📋 Verifica B (Secondaria)</h4>
                              
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="tipo_prestazione_b">Tipo Prestazione B</Label>
                                  <Select
                                    value={formData.tipo_prestazione_b || "__none__"}
                                    onValueChange={(value) => setFormData({ ...formData, tipo_prestazione_b: value === "__none__" ? "" : value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona tipo prestazione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">Nessuna</SelectItem>
                                      <SelectItem value="Assistenza e consulenza societaria continuativa e generica">
                                        Assistenza e consulenza societaria continuativa e generica
                                      </SelectItem>
                                      <SelectItem value="Consulenza del Lavoro">
                                        Consulenza del Lavoro
                                      </SelectItem>
                                      <SelectItem value="Altre attività">
                                        Altre attività
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="data_ultima_verifica_b">Data Ultima Verifica B</Label>
                                    <Input
                                      id="data_ultima_verifica_b"
                                      type="date"
                                      value={formData.data_ultima_verifica_b}
                                      onChange={(e) => setFormData({ ...formData, data_ultima_verifica_b: e.target.value })}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="scadenza_antiric_b">Scadenza Antiriciclaggio B</Label>
                                    <Input
                                      id="scadenza_antiric_b"
                                      type="date"
                                      value={formData.scadenza_antiric_b}
                                      onChange={(e) => setFormData({ ...formData, scadenza_antiric_b: e.target.value })}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="scadenzari" className="space-y-4">
                          <div className="space-y-3">
                            <p className="text-sm text-gray-600 mb-4">
                              Seleziona gli scadenzari attivi per questo cliente
                            </p>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="flag_iva"
                                  checked={formData.flag_iva}
                                  onChange={(e) => setFormData({ ...formData, flag_iva: e.target.checked })}
                                  className="rounded"
                                />
                                <Label htmlFor="flag_iva" className="cursor-pointer">IVA</Label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="flag_ccgg"
                                  checked={formData.flag_ccgg}
                                  onChange={(e) => setFormData({ ...formData, flag_ccgg: e.target.checked })}
                                  className="rounded"
                                />
                                <Label htmlFor="flag_ccgg" className="cursor-pointer">CCGG</Label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="flag_cu"
                                  checked={formData.flag_cu}
                                  onChange={(e) => setFormData({ ...formData, flag_cu: e.target.checked })}
                                  className="rounded"
                                />
                                <Label htmlFor="flag_cu" className="cursor-pointer">CU</Label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="flag_fiscali"
                                  checked={formData.flag_fiscali}
                                  onChange={(e) => setFormData({ ...formData, flag_fiscali: e.target.checked })}
                                  className="rounded"
                                />
                                <Label htmlFor="flag_fiscali" className="cursor-pointer">Fiscali</Label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="flag_bilancio"
                                  checked={formData.flag_bilancio}
                                  onChange={(e) => setFormData({ ...formData, flag_bilancio: e.target.checked })}
                                  className="rounded"
                                />
                                <Label htmlFor="flag_bilancio" className="cursor-pointer">Bilanci</Label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="flag_770"
                                  checked={formData.flag_770}
                                  onChange={(e) => setFormData({ ...formData, flag_770: e.target.checked })}
                                  className="rounded"
                                />
                                <Label htmlFor="flag_770" className="cursor-pointer">770</Label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="flag_lipe"
                                  checked={formData.flag_lipe}
                                  onChange={(e) => setFormData({ ...formData, flag_lipe: e.target.checked })}
                                  className="rounded"
                                />
                                <Label htmlFor="flag_lipe" className="cursor-pointer">Lipe</Label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="flag_esterometro"
                                  checked={formData.flag_esterometro}
                                  onChange={(e) => setFormData({ ...formData, flag_esterometro: e.target.checked })}
                                  className="rounded"
                                />
                                <Label htmlFor="flag_esterometro" className="cursor-pointer">Esterometro</Label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="flag_proforma"
                                  checked={formData.flag_proforma}
                                  onChange={(e) => setFormData({ ...formData, flag_proforma: e.target.checked })}
                                  className="rounded"
                                />
                                <Label htmlFor="flag_proforma" className="cursor-pointer">Proforma</Label>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="comunicazioni" className="space-y-4">
                          <p className="text-sm text-gray-600 mb-4">
                            Gestisci le preferenze di comunicazione del cliente
                          </p>

                          <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="flag_mail_attivo"
                                checked={formData.flag_mail_attivo}
                                onChange={(e) => setFormData({ ...formData, flag_mail_attivo: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="flag_mail_attivo" className="cursor-pointer">
                                Email Attiva
                              </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="flag_mail_scadenze"
                                checked={formData.flag_mail_scadenze}
                                onChange={(e) => setFormData({ ...formData, flag_mail_scadenze: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="flag_mail_scadenze" className="cursor-pointer">
                                Ricevi Mailing Scadenze
                              </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="flag_mail_newsletter"
                                checked={formData.flag_mail_newsletter}
                                onChange={(e) => setFormData({ ...formData, flag_mail_newsletter: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="flag_mail_newsletter" className="cursor-pointer">
                                Ricevi Newsletter
                              </Label>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>

                      <div className="flex gap-3 pt-6 mt-6 border-t">
                        <Button type="submit" className="flex-1">
                          {editingCliente ? "Aggiorna" : "Crea"} Cliente
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setDialogOpen(false)}
                        >
                          Annulla
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Cerca per ragione sociale, P.IVA o CF..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cod. Cliente</TableHead>
                      <TableHead>Ragione Sociale</TableHead>
                      <TableHead>P.IVA</TableHead>
                      <TableHead>Città</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClienti.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          Nessun cliente trovato
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredClienti.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell className="font-mono text-xs">{cliente.cod_cliente}</TableCell>
                          <TableCell className="font-medium">{cliente.ragione_sociale}</TableCell>
                          <TableCell className="font-mono text-sm">{cliente.partita_iva}</TableCell>
                          <TableCell>{cliente.citta}</TableCell>
                          <TableCell className="text-sm">{cliente.email}</TableCell>
                          <TableCell>
                            <Badge variant={cliente.attivo ? "default" : "secondary"}>
                              {cliente.attivo ? "Attivo" : "Non attivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleAggiungiAScadenzari(cliente.id)}
                                title="Aggiungi agli scadenzari"
                              >
                                <Calendar className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(cliente)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(cliente.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
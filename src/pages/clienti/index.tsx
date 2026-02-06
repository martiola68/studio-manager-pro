import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Upload, Download, Search, Building2, User, FolderLock, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

type ScadenzariSelezionati = {
  iva: boolean;
  cu: boolean;
  bilancio: boolean;
  fiscale: boolean;
  lipe: boolean;
  esterometro: boolean;
  ccgg: boolean;
  mod770: boolean;
  proforma: boolean;
  imu: boolean;
};

const TIPO_PRESTAZIONE_OPTIONS: string[] = [
  "Contabilità ordinaria",
  "Contabilità semplificata",
  "Regime forfettario",
  "Consulenza fiscale",
  "Consulenza del lavoro",
  "Revisione contabile",
  "Altra prestazione"
];

export default function ClientiPage() {
  const [clienti, setClienti] = useState<any[]>([]);
  const [utenti, setUtenti] = useState<any[]>([]);
  const [contatti, setContatti] = useState<any[]>([]);
  const [prestazioni, setPrestazioni] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string>("Tutti");
  const [selectedUtenteFiscale, setSelectedUtenteFiscale] = useState<string>("Tutti");
  const [selectedUtentePayroll, setSelectedUtentePayroll] = useState<string>("Tutti");
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const [formData, setFormData] = useState<{
    cod_cliente: string;
    tipo_cliente: string;
    tipologia_cliente: string;
    settore_fiscale: boolean;
    settore_lavoro: boolean;
    settore_consulenza: boolean;
    ragione_sociale: string;
    partita_iva: string;
    codice_fiscale: string;
    data_costituzione: string;
    forma_giuridica: string;
    capitale_sociale: string;
    pec: string;
    email: string;
    telefono: string;
    indirizzo: string;
    citta: string;
    cap: string;
    provincia: string;
    note: string;
    attivo: boolean;
    matricola_inps: string;
    tipo_redditi: string;
    tipo_prestazione_id: string;
    utente_fiscale_id: string;
    professionista_fiscale_id: string;
    utente_payroll_id: string;
    professionista_payroll_id: string;
    contatto1_id: string;
    contatto2_id: string;
    scadenzari: ScadenzariSelezionati;
  }>({
    cod_cliente: "",
    tipo_cliente: "Persona fisica",
    tipologia_cliente: "Interno",
    settore_fiscale: true,
    settore_lavoro: false,
    settore_consulenza: false,
    ragione_sociale: "",
    partita_iva: "",
    codice_fiscale: "",
    data_costituzione: "",
    forma_giuridica: "",
    capitale_sociale: "",
    pec: "",
    email: "",
    telefono: "",
    indirizzo: "",
    citta: "",
    cap: "",
    provincia: "",
    note: "",
    attivo: true,
    matricola_inps: "",
    tipo_redditi: "",
    tipo_prestazione_id: "",
    utente_fiscale_id: "",
    professionista_fiscale_id: "",
    utente_payroll_id: "",
    professionista_payroll_id: "",
    contatto1_id: "",
    contatto2_id: "",
    scadenzari: {
      iva: false,
      cu: false,
      bilancio: false,
      fiscale: false,
      lipe: false,
      esterometro: false,
      ccgg: false,
      mod770: false,
      proforma: false,
      imu: false
    }
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterClienti();
  }, [clienti, searchTerm, selectedLetter, selectedUtenteFiscale, selectedUtentePayroll]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log("🔍 Inizio caricamento clienti");

      // CRITICAL FIX: Recupero studioId dalla sessione se mancante
      let studioId = localStorage.getItem("studioId");
      
      if (!studioId || studioId.trim() === "") {
        console.warn("⚠️ studioId mancante in localStorage, recupero dalla sessione...");
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.user_metadata?.studio_id) {
          studioId = session.user.user_metadata.studio_id;
          localStorage.setItem("studioId", studioId);
          console.log("✅ studioId recuperato dalla sessione:", studioId);
        } else {
          console.error("❌ ERRORE: Impossibile recuperare studioId");
          toast({
            title: "Errore configurazione",
            description: "Studio ID non trovato. Effettua nuovamente il login.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      console.log("🔍 Studio ID:", studioId);

      const [clientiResponse, utentiResponse, contattiResponse, prestazioniResponse] = await Promise.all([
        supabase
          .from("tbclienti")
          .select("*")
          .eq("studio_id", studioId)
          .order("ragione_sociale"),
        supabase.from("tbutenti").select("*"),
        supabase.from("tbcontatti").select("*"),
        supabase.from("tbprestazioni").select("*"),
      ]);

      if (clientiResponse.error) {
        console.error("❌ Errore caricamento clienti:", clientiResponse.error);
        throw clientiResponse.error;
      }
      if (utentiResponse.error) throw utentiResponse.error;
      if (contattiResponse.error) throw contattiResponse.error;
      if (prestazioniResponse.error) throw prestazioniResponse.error;

      setClienti(clientiResponse.data || []);
      setUtenti(utentiResponse.data || []);
      setContatti(contattiResponse.data || []);
      setPrestazioni(prestazioniResponse.data || []);

      console.log("✅ Clienti caricati:", clientiResponse.data?.length || 0);
      console.log("✅ Utenti caricati:", utentiResponse.data?.length || 0);
      console.log("✅ Contatti caricati:", contattiResponse.data?.length || 0);
      console.log("✅ Prestazioni caricate:", prestazioniResponse.data?.length || 0);
      console.log("✅ Caricamento completato!");

      setLoading(false);
    } catch (error: any) {
      console.error("❌ Errore durante il caricamento:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile caricare i dati",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const filterClienti = () => {
    return clienti.filter(cliente => {
      const matchSearch = cliente.ragione_sociale?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchLetter = selectedLetter === "Tutti" || cliente.ragione_sociale?.charAt(0).toUpperCase() === selectedLetter;
      const matchUtenteFiscale = selectedUtenteFiscale === "Tutti" || cliente.utente_fiscale_id === selectedUtenteFiscale;
      const matchUtentePayroll = selectedUtentePayroll === "Tutti" || cliente.utente_payroll_id === selectedUtentePayroll;
      return matchSearch && matchLetter && matchUtenteFiscale && matchUtentePayroll;
    });
  };

  const handleSave = async () => {
    try {
      if (!formData.ragione_sociale.trim()) {
        toast({
          title: "Errore",
          description: "La ragione sociale è obbligatoria",
          variant: "destructive"
        });
        return;
      }

      const studioId = localStorage.getItem("studioId");

      const dataToSave = {
        ...formData,
        cod_cliente: formData.cod_cliente || `CLI-${Date.now()}`,
        studio_id: studioId,
        tipo_prestazione_id: formData.tipo_prestazione_id || undefined,
        tipo_redditi: formData.tipo_redditi || undefined,
        tipologia_cliente: formData.tipologia_cliente || "Interno",
        matricola_inps: formData.matricola_inps || undefined,
        contatto1_id: formData.contatto1_id || undefined,
        contatto2_id: formData.contatto2_id || undefined,
        utente_fiscale_id: formData.settore_fiscale ? (formData.utente_fiscale_id || undefined) : null,
        professionista_fiscale_id: formData.settore_fiscale ? (formData.professionista_fiscale_id || undefined) : null,
        utente_payroll_id: formData.settore_lavoro ? (formData.utente_payroll_id || undefined) : null,
        professionista_payroll_id: formData.settore_lavoro ? (formData.professionista_payroll_id || undefined) : null
      };

      if (editingId) {
        const { error } = await supabase
          .from("tbclienti")
          .update(dataToSave)
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Cliente aggiornato con successo"
        });
      } else {
        const { error } = await supabase
          .from("tbclienti")
          .insert([dataToSave]);

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Cliente creato con successo"
        });
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (cliente: any) => {
    setEditingId(cliente.id);
    setFormData({
      ...formData,
      ...cliente,
      cod_cliente: cliente.cod_cliente || "",
      tipo_cliente: cliente.tipo_cliente || "Persona fisica",
      tipologia_cliente: cliente.tipologia_cliente || "Interno",
      settore_fiscale: cliente.settore_fiscale ?? true,
      settore_lavoro: cliente.settore_lavoro ?? false,
      settore_consulenza: cliente.settore_consulenza ?? false,
      ragione_sociale: cliente.ragione_sociale || "",
      partita_iva: cliente.partita_iva || "",
      codice_fiscale: cliente.codice_fiscale || "",
      data_costituzione: cliente.data_costituzione || "",
      forma_giuridica: cliente.forma_giuridica || "",
      capitale_sociale: cliente.capitale_sociale || "",
      pec: cliente.pec || "",
      email: cliente.email || "",
      telefono: cliente.telefono || "",
      indirizzo: cliente.indirizzo || "",
      citta: cliente.citta || "",
      cap: cliente.cap || "",
      provincia: cliente.provincia || "",
      note: cliente.note || "",
      attivo: cliente.attivo ?? true,
      matricola_inps: cliente.matricola_inps || "",
      tipo_redditi: cliente.tipo_redditi || "",
      tipo_prestazione_id: cliente.tipo_prestazione_id || "",
      utente_fiscale_id: cliente.utente_fiscale_id || "",
      professionista_fiscale_id: cliente.professionista_fiscale_id || "",
      utente_payroll_id: cliente.utente_payroll_id || "",
      professionista_payroll_id: cliente.professionista_payroll_id || "",
      contatto1_id: cliente.contatto1_id || "",
      contatto2_id: cliente.contatto2_id || "",
      scadenzari: cliente.scadenzari || {
        iva: false,
        cu: false,
        bilancio: false,
        fiscale: false,
        lipe: false,
        esterometro: false,
        ccgg: false,
        mod770: false,
        proforma: false,
        imu: false
      }
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo cliente?")) return;

    try {
      const { error } = await supabase
        .from("tbclienti")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Cliente eliminato con successo"
      });

      loadData();
    } catch (error: any) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'eliminazione",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      cod_cliente: "",
      tipo_cliente: "Persona fisica",
      tipologia_cliente: "Interno",
      settore_fiscale: true,
      settore_lavoro: false,
      settore_consulenza: false,
      ragione_sociale: "",
      partita_iva: "",
      codice_fiscale: "",
      data_costituzione: "",
      forma_giuridica: "",
      capitale_sociale: "",
      pec: "",
      email: "",
      telefono: "",
      indirizzo: "",
      citta: "",
      cap: "",
      provincia: "",
      note: "",
      attivo: true,
      matricola_inps: "",
      tipo_redditi: "",
      tipo_prestazione_id: "",
      utente_fiscale_id: "",
      professionista_fiscale_id: "",
      utente_payroll_id: "",
      professionista_payroll_id: "",
      contatto1_id: "",
      contatto2_id: "",
      scadenzari: {
        iva: false,
        cu: false,
        bilancio: false,
        fiscale: false,
        lipe: false,
        esterometro: false,
        ccgg: false,
        mod770: false,
        proforma: false,
        imu: false
      }
    });
    setEditingId(null);
  };

  const downloadTemplate = () => {
    const headers = [
      "Tipo Cliente",
      "Tipologia Cliente",
      "Settore Fiscale (VERO/FALSO)",
      "Settore Lavoro (VERO/FALSO)",
      "Settore Consulenza (VERO/FALSO)",
      "Ragione Sociale",
      "Partita IVA",
      "Codice Fiscale",
      "Email",
      "Telefono",
      "Indirizzo",
      "Città",
      "CAP",
      "Provincia",
      "Attivo (VERO/FALSO)",
      "Tipo Redditi",
      "Matricola INPS",
      "Utente Fiscale",
      "Utente Payroll",
      "Contatto 1",
      "Note"
    ];

    const exampleRows = [
      [
        "Persona fisica",
        "Interno",
        "VERO",
        "FALSO",
        "FALSO",
        "ESEMPIO SRL",
        "01234567890",
        "RSSMRA85M01H501Z",
        "esempio@email.com",
        "3331234567",
        "Via Roma 1",
        "Milano",
        "20100",
        "MI",
        "VERO",
        "730",
        "",
        "Mario Rossi",
        "",
        "Giuseppe Verdi",
        "Note di esempio"
      ]
    ];

    const csvContent = [
      headers.join(","),
      ...exampleRows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "template_importazione_clienti.csv";
    link.click();

    toast({
      title: "Template scaricato",
      description: "Il template è stato scaricato con successo"
    });
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = text.split("\n").filter(row => row.trim());
      const studioId = localStorage.getItem("studioId");

      const findUtenteId = (nomeCompleto: string) => {
        if (!nomeCompleto) return null;
        const utente = utenti.find(u => 
          `${u.nome} ${u.cognome}`.toLowerCase() === nomeCompleto.toLowerCase().trim()
        );
        return utente?.id || null;
      };

      const findContattoId = (nomeCompleto: string) => {
        if (!nomeCompleto) return null;
        const contatto = contatti.find(c => 
          `${c.nome} ${c.cognome}`.toLowerCase() === nomeCompleto.toLowerCase().trim()
        );
        return contatto?.id || null;
      };

      const clientiDaImportare = [];

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(",").map(v => v.replace(/^"|"$/g, "").trim());

        const tipoCliente = (values[0] || "").toString().trim();
        const tipologiaCliente = (values[1] || "").toString().trim();
        const settoreFiscale = (values[2] || "VERO").toString().trim().toUpperCase();
        const settoreLavoro = (values[3] || "FALSO").toString().trim().toUpperCase();
        const settoreConsulenza = (values[4] || "FALSO").toString().trim().toUpperCase();
        const ragioneSociale = (values[5] || "").toString().trim();

        if (!tipoCliente || !tipologiaCliente || !ragioneSociale) {
          console.warn(`Riga ${i + 1} saltata: dati mancanti`);
          continue;
        }

        const attivoRaw = (values[14] || "VERO").toString().trim().toUpperCase();
        const attivo = attivoRaw === "VERO" || attivoRaw === "TRUE" || attivoRaw === "1";

        const fiscale = settoreFiscale === "VERO" || settoreFiscale === "TRUE" || settoreFiscale === "1";
        const lavoro = settoreLavoro === "VERO" || settoreLavoro === "TRUE" || settoreLavoro === "1";
        const consulenza = settoreConsulenza === "VERO" || settoreConsulenza === "TRUE" || settoreConsulenza === "1";

        const utenteFiscale = findUtenteId(values[17]?.toString().trim());
        const utentePayroll = findUtenteId(values[18]?.toString().trim());

        const contatto1 = findContattoId(values[19]?.toString().trim());

        clientiDaImportare.push({
          studio_id: studioId,
          cod_cliente: `CLI-${Date.now()}-${i}`,
          tipo_cliente: tipoCliente,
          tipologia_cliente: tipologiaCliente,
          settore_fiscale: fiscale,
          settore_lavoro: lavoro,
          settore_consulenza: consulenza,
          ragione_sociale: ragioneSociale,
          partita_iva: values[6] || "",
          codice_fiscale: values[7] || "",
          email: values[8] || "",
          telefono: values[9] || "",
          indirizzo: values[10] || "",
          citta: values[11] || "",
          cap: values[12] || "",
          provincia: values[13] || "",
          attivo,
          tipo_redditi: values[15] || "",
          matricola_inps: values[16] || "",
          utente_fiscale_id: fiscale ? utenteFiscale : null,
          utente_payroll_id: lavoro ? utentePayroll : null,
          contatto1_id: contatto1,
          note: values[20] || ""
        });
      }

      if (clientiDaImportare.length === 0) {
        toast({
          title: "Attenzione",
          description: "Nessun cliente valido trovato nel file",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from("tbclienti")
        .insert(clientiDaImportare);

      if (error) throw error;

      toast({
        title: "Successo",
        description: `${clientiDaImportare.length} clienti importati con successo`
      });

      setImportDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Errore importazione:", error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'importazione",
        variant: "destructive"
      });
    }
  };

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const filteredClienti = filterClienti();

  const clientiConCassetto = clienti.filter(c => c.scadenzari?.fiscale === true).length;
  const percentualeCassetto = clienti.length > 0 ? Math.round((clientiConCassetto / clienti.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestione Clienti</h1>
          <p className="text-muted-foreground">Totale clienti: {clienti.length}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Importa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Importa Clienti da CSV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Istruzioni:</h3>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Scarica il template CSV cliccando sul pulsante qui sotto</li>
                    <li>Compila il file con i dati dei clienti</li>
                    <li>Carica il file compilato usando il pulsante "Scegli file"</li>
                  </ol>
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2 text-sm">Campi obbligatori:</h4>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li><strong>Tipo Cliente</strong> - Persona fisica / Società <span className="text-red-500">OBBLIGATORIO</span></li>
                    <li><strong>Tipologia Cliente</strong> - Interno / Esterno <span className="text-red-500">OBBLIGATORIO</span></li>
                    <li><strong>Settore Fiscale</strong> - VERO/FALSO</li>
                    <li><strong>Settore Lavoro</strong> - VERO/FALSO</li>
                    <li><strong>Settore Consulenza</strong> - VERO/FALSO</li>
                    <li><strong>Ragione Sociale</strong> - Nome o ragione sociale <span className="text-red-500">OBBLIGATORIO</span></li>
                    <li><strong>Partita IVA</strong> - Opzionale</li>
                    <li><strong>Codice Fiscale</strong> - Opzionale</li>
                    <li><strong>Attivo</strong> - VERO/FALSO (default: VERO)</li>
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button onClick={downloadTemplate} variant="outline" className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Scarica Template
                  </Button>
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleImportCSV}
                      className="cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Modifica Cliente" : "Nuovo Cliente"}</DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="anagrafica" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
                  <TabsTrigger value="riferimenti">Riferimenti</TabsTrigger>
                  <TabsTrigger value="scadenzari">Scadenzari</TabsTrigger>
                  <TabsTrigger value="altro">Altro</TabsTrigger>
                </TabsList>

                <TabsContent value="anagrafica" className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tipo_cliente">Tipo Cliente *</Label>
                      <Select
                        value={formData.tipo_cliente}
                        onValueChange={(value) => setFormData({ ...formData, tipo_cliente: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Persona fisica">Persona fisica</SelectItem>
                          <SelectItem value="Società">Società</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="tipologia_cliente">Tipologia Cliente *</Label>
                      <Select
                        value={formData.tipologia_cliente}
                        onValueChange={(value) => setFormData({ ...formData, tipologia_cliente: value })}
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
                  </div>

                  <div className="space-y-2">
                    <Label>Settori *</Label>
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="settore_fiscale"
                          checked={formData.settore_fiscale}
                          onCheckedChange={(checked) => 
                            setFormData({ ...formData, settore_fiscale: checked as boolean })
                          }
                        />
                        <Label htmlFor="settore_fiscale" className="font-normal cursor-pointer">
                          Settore Fiscale
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="settore_lavoro"
                          checked={formData.settore_lavoro}
                          onCheckedChange={(checked) => 
                            setFormData({ ...formData, settore_lavoro: checked as boolean })
                          }
                        />
                        <Label htmlFor="settore_lavoro" className="font-normal cursor-pointer">
                          Settore Lavoro
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="settore_consulenza"
                          checked={formData.settore_consulenza}
                          onCheckedChange={(checked) => 
                            setFormData({ ...formData, settore_consulenza: checked as boolean })
                          }
                        />
                        <Label htmlFor="settore_consulenza" className="font-normal cursor-pointer">
                          Settore Consulenza
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="ragione_sociale">Ragione Sociale *</Label>
                    <Input
                      id="ragione_sociale"
                      value={formData.ragione_sociale}
                      onChange={(e) => setFormData({ ...formData, ragione_sociale: e.target.value })}
                      placeholder="Inserisci ragione sociale o nome completo"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="partita_iva">Partita IVA</Label>
                      <Input
                        id="partita_iva"
                        value={formData.partita_iva}
                        onChange={(e) => setFormData({ ...formData, partita_iva: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="codice_fiscale">Codice Fiscale</Label>
                      <Input
                        id="codice_fiscale"
                        value={formData.codice_fiscale}
                        onChange={(e) => setFormData({ ...formData, codice_fiscale: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="telefono">Telefono</Label>
                      <Input
                        id="telefono"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="indirizzo">Indirizzo</Label>
                    <Input
                      id="indirizzo"
                      value={formData.indirizzo}
                      onChange={(e) => setFormData({ ...formData, indirizzo: e.target.value })}
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="citta">Città</Label>
                      <Input
                        id="citta"
                        value={formData.citta}
                        onChange={(e) => setFormData({ ...formData, citta: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cap">CAP</Label>
                      <Input
                        id="cap"
                        value={formData.cap}
                        onChange={(e) => setFormData({ ...formData, cap: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="provincia">Provincia</Label>
                      <Input
                        id="provincia"
                        value={formData.provincia}
                        onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="riferimenti" className="space-y-4">
                  <div>
                    <Label htmlFor="utente_fiscale_id">Utente Fiscale</Label>
                    <Select
                      value={formData.utente_fiscale_id}
                      onValueChange={(value) => setFormData({ ...formData, utente_fiscale_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona utente fiscale" />
                      </SelectTrigger>
                      <SelectContent>
                        {utenti.map((utente) => (
                          <SelectItem key={utente.id} value={utente.id}>
                            {utente.nome} {utente.cognome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="professionista_fiscale_id">Professionista Fiscale</Label>
                    <Select
                      value={formData.professionista_fiscale_id}
                      onValueChange={(value) => setFormData({ ...formData, professionista_fiscale_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona professionista fiscale" />
                      </SelectTrigger>
                      <SelectContent>
                        {utenti.map((utente) => (
                          <SelectItem key={utente.id} value={utente.id}>
                            {utente.nome} {utente.cognome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="utente_payroll_id">Utente Payroll</Label>
                    <Select
                      value={formData.utente_payroll_id}
                      onValueChange={(value) => setFormData({ ...formData, utente_payroll_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona utente payroll" />
                      </SelectTrigger>
                      <SelectContent>
                        {utenti.map((utente) => (
                          <SelectItem key={utente.id} value={utente.id}>
                            {utente.nome} {utente.cognome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="professionista_payroll_id">Professionista Payroll</Label>
                    <Select
                      value={formData.professionista_payroll_id}
                      onValueChange={(value) => setFormData({ ...formData, professionista_payroll_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona professionista payroll" />
                      </SelectTrigger>
                      <SelectContent>
                        {utenti.map((utente) => (
                          <SelectItem key={utente.id} value={utente.id}>
                            {utente.nome} {utente.cognome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="contatto1_id">Contatto 1</Label>
                    <Select
                      value={formData.contatto1_id}
                      onValueChange={(value) => setFormData({ ...formData, contatto1_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona contatto" />
                      </SelectTrigger>
                      <SelectContent>
                        {contatti.map((contatto) => (
                          <SelectItem key={contatto.id} value={contatto.id}>
                            {contatto.nome} {contatto.cognome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="contatto2_id">Contatto 2</Label>
                    <Select
                      value={formData.contatto2_id}
                      onValueChange={(value) => setFormData({ ...formData, contatto2_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona contatto" />
                      </SelectTrigger>
                      <SelectContent>
                        {contatti.map((contatto) => (
                          <SelectItem key={contatto.id} value={contatto.id}>
                            {contatto.nome} {contatto.cognome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="scadenzari" className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.entries(formData.scadenzari).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox
                          id={`scadenzario_${key}`}
                          checked={value}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              scadenzari: { ...formData.scadenzari, [key]: checked as boolean }
                            })
                          }
                        />
                        <Label htmlFor={`scadenzario_${key}`} className="font-normal cursor-pointer">
                          {key.toUpperCase()}
                        </Label>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="altro" className="space-y-4">
                  <div>
                    <Label htmlFor="tipo_redditi">Tipo Redditi</Label>
                    <Select
                      value={formData.tipo_redditi}
                      onValueChange={(value) => setFormData({ ...formData, tipo_redditi: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona tipo redditi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="730">730</SelectItem>
                        <SelectItem value="UPF">UPF (Unico Persone Fisiche)</SelectItem>
                        <SelectItem value="Società">Società</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="matricola_inps">Matricola INPS</Label>
                    <Input
                      id="matricola_inps"
                      value={formData.matricola_inps}
                      onChange={(e) => setFormData({ ...formData, matricola_inps: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="tipo_prestazione_id">Tipo Prestazione</Label>
                    <Select
                      value={formData.tipo_prestazione_id}
                      onValueChange={(value) => setFormData({ ...formData, tipo_prestazione_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona tipo prestazione" />
                      </SelectTrigger>
                      <SelectContent>
                        {prestazioni.map((prestazione) => (
                          <SelectItem key={prestazione.id} value={prestazione.id}>
                            {prestazione.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="note">Note</Label>
                    <Textarea
                      id="note"
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="attivo"
                      checked={formData.attivo}
                      onCheckedChange={(checked) => setFormData({ ...formData, attivo: checked as boolean })}
                    />
                    <Label htmlFor="attivo" className="font-normal cursor-pointer">
                      Cliente Attivo
                    </Label>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleSave}>
                  {editingId ? "Aggiorna" : "Crea"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Select value={selectedUtenteFiscale} onValueChange={setSelectedUtenteFiscale}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtra per utente fiscale" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tutti">Tutti gli utenti fiscali</SelectItem>
              {utenti.map((utente) => (
                <SelectItem key={utente.id} value={utente.id}>
                  {utente.nome} {utente.cognome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedUtentePayroll} onValueChange={setSelectedUtentePayroll}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtra per utente payroll" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tutti">Tutti gli utenti payroll</SelectItem>
              {utenti.map((utente) => (
                <SelectItem key={utente.id} value={utente.id}>
                  {utente.nome} {utente.cognome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          <Button
            variant={selectedLetter === "Tutti" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedLetter("Tutti")}
          >
            Tutti
          </Button>
          {alphabet.map((letter) => (
            <Button
              key={letter}
              variant={selectedLetter === letter ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedLetter(letter)}
            >
              {letter}
            </Button>
          ))}
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cod.</TableHead>
                <TableHead>Ragione Sociale</TableHead>
                <TableHead>Settori</TableHead>
                <TableHead>P.IVA</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClienti.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nessun cliente trovato
                  </TableCell>
                </TableRow>
              ) : (
                filteredClienti.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-mono text-sm">{cliente.cod_cliente}</TableCell>
                    <TableCell className="font-medium">{cliente.ragione_sociale}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {cliente.settore_fiscale && (
                          <Badge variant="secondary" className="text-xs">Fiscale</Badge>
                        )}
                        {cliente.settore_lavoro && (
                          <Badge variant="secondary" className="text-xs">Lavoro</Badge>
                        )}
                        {cliente.settore_consulenza && (
                          <Badge variant="secondary" className="text-xs">Consulenza</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{cliente.partita_iva}</TableCell>
                    <TableCell>{cliente.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{cliente.tipo_cliente}</Badge>
                    </TableCell>
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
                          onClick={() => handleEdit(cliente)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cliente.id)}
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
        </div>
      </Card>
    </div>
  );
}
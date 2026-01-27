import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Edit, Trash2, Search, Plus, Upload, FileSpreadsheet, CheckCircle2, Calendar, X, ChevronDown } from "lucide-react";
import { clienteService } from "@/services/clienteService";
import { contattoService } from "@/services/contattoService";
import { utenteService } from "@/services/utenteService";
import { cassettiFiscaliService } from "@/services/cassettiFiscaliService";
import { riferimentiValoriService } from "@/services/riferimentiValoriService";
import { Switch } from "@/components/ui/switch";
import * as XLSX from "xlsx";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type CassettoFiscale = Database["public"]["Tables"]["tbcassetti_fiscali"]["Row"];
type Prestazione = Database["public"]["Tables"]["tbprestazioni"]["Row"];
type RiferimentoValore = Database["public"]["Tables"]["tbreferimenti_valori"]["Row"];

type ScadenzariSelezionati = {
  iva: boolean;
  cu: boolean;
  bilancio: boolean;
  fiscali: boolean;
  lipe: boolean;
  modello_770: boolean;
  esterometro: boolean;
  ccgg: boolean;
  proforma: boolean;
  imu: boolean;
};

type ComunicazioniPreferenze = {
  email_attiva: boolean;
  ricevi_mailing_scadenze: boolean;
  ricevi_newsletter: boolean;
};

const RISK_TO_MONTHS: Record<
  "Non significativo" | "Poco significativo" | "Abbastanza significativo" | "Molto significativo",
  number
> = {
  "Non significativo": 36,
  "Poco significativo": 36,
  "Abbastanza significativo": 12,
  "Molto significativo": 6,
};

const TIPO_PRESTAZIONE_OPTIONS: string[] = [
  "Amministrazione e liquidazione di aziende, patrimoni, singoli beni",
  "Amministrazione di società, enti, trust o strutture analoghe",
  "Assistenza, consulenza e rappresentanza in materia tributaria",
  "Assistenza per richiesta finanziamenti",
  "Assistenza e consulenza societaria continuativa e generica",
  "Attività di valutazione tecnica dell'iniziativa di impresa e di asseverazione dei business plan per l'accesso a finanziamenti pubblici",
  "Consulenza aziendale",
  "Consulenza contrattuale",
  "Consulenza economico-finanziaria",
  "Tenuta della contabilità",
  "Consulenza in materia di redazione bilancio",
  "Revisione legale dei conti",
  "Valutazioni di aziende, rami di azienda, patrimoni, singoli beni e diritti",
  "Collegio sindacale",
  "Apposizione del visto di conformità su dichiarazioni fiscali",
  "Predisposizione di interpelli",
  "Risposte di carattere fiscale e societario",
  "Incarico di curatore, commissario giudiziale e commissario liquidatore",
  "Liquidatore nominato dal Tribunale",
  "Invio telematico di Bilanci",
];

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

type PendingRiferimento = {
  tipo: "matricola_inps" | "pat_inail" | "codice_ditta_ce";
  valore: string;
} | null;

// STATI FONDAMENTALI
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    cod_cliente: "",
    ragione_sociale: "",
    partita_iva: "",
    codice_fiscale: "",
    indirizzo: "",
    cap: "",
    citta: "",
    provincia: "",
    email: "",
    pec: "",
    telefono: "",
    cellulare: "",
    tipo_cliente: "Persona fisica",
    tipologia_cliente: undefined as "Interno" | "Esterno" | undefined,
    attivo: true,
    note: "",
    utente_operatore_id: "",
    utente_professionista_id: "",
    utente_payroll_id: "",
    professionista_payroll_id: "",
    contatto1_id: "",
    contatto2_id: "",
    tipo_prestazione_id: "",
    tipo_redditi: undefined as "USC" | "USP" | "ENC" | "UPF" | "730" | undefined,
    cassetto_fiscale_id: "",
    settore: undefined as "Fiscale" | "Lavoro" | "Fiscale & Lavoro" | undefined,
    matricola_inps: "",
    pat_inail: "",
    codice_ditta_ce: "",
    tipo_prestazione_a: "",
    tipo_prestazione_b: "",
    rischio_ver_a: "",
    rischio_ver_b: "",
    gg_ver_a: undefined as number | undefined,
    gg_ver_b: undefined as number | undefined,
    data_ultima_verifica_antiric: undefined as Date | undefined,
    scadenza_antiric: undefined as Date | undefined,
    data_ultima_verifica_b: undefined as Date | undefined,
    scadenza_antiric_b: undefined as Date | undefined,
    gestione_antiriciclaggio: false,
    note_antiriciclaggio: "",
    giorni_scad_ver_a: null as number | null,
    giorni_scad_ver_b: null as number | null,
  });

  const [scadenzari, setScadenzari] = useState<ScadenzariSelezionati>({
    iva: true,
    cu: true,
    bilancio: true,
    fiscali: true,
    lipe: true,
    modello_770: true,
    esterometro: true,
    ccgg: true,
    proforma: true,
    imu: true,
  });

  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [contatti, setContatti] = useState<Contatto[]>([]);
  const [cassettiFiscali, setCassettiFiscali] = useState<CassettoFiscale[]>([]);
  const [prestazioni, setPrestazioni] = useState<Prestazione[]>([]);
  const [matricoleInps, setMatricoleInps] = useState<RiferimentoValore[]>([]);
  const [patInail, setPatInail] = useState<RiferimentoValore[]>([]);
  const [codiciDittaCe, setCodiciDittaCe] = useState<RiferimentoValore[]>([]);
  
  // STATI PER UI
  const [showDialog, setShowDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingRiferimento, setPendingRiferimento] = useState<PendingRiferimento>(null);
  const [showMatricolaDropdown, setShowMatricolaDropdown] = useState(false);
  const [showPatDropdown, setShowPatDropdown] = useState(false);
  const [showCodiceDropdown, setShowCodiceDropdown] = useState(false);

  // LOGICA IMPORTAZIONE CSV
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Rimuovi header
      const rows = jsonData.slice(1) as any[][];
      let importedCount = 0;
      let errorCount = 0;

      for (const row of rows) {
        // Mappatura colonne (array index based 0)
        // 0: Tipo Cliente (OBBLIGATORIO)
        // 1: Tipologia Cliente (OBBLIGATORIO)
        // 2: Settore (OBBLIGATORIO)
        // 3: Ragione Sociale (OBBLIGATORIO)
        // 4: P.IVA (Opzionale)
        // 5: CF (Opzionale)
        // 6: Indirizzo
        // 7: CAP
        // 8: Città
        // 9: Provincia
        // 10: Email
        // 11: Attivo
        // 12: Note
        // 13: Utente Fiscale
        // 14: Professionista Fiscale
        // 15: Utente Payroll
        // 16: Professionista Payroll
        // 17: Contatto 1
        // 18: Contatto 2
        // 19: Tipo Prestazione
        // 20: Tipo Redditi

        const tipoCliente = row[0]?.toString().trim();
        const tipologiaCliente = row[1]?.toString().trim();
        const settore = row[2]?.toString().trim();
        const ragioneSociale = row[3]?.toString().trim();

        if (!tipoCliente || !tipologiaCliente || !settore || !ragioneSociale) {
          console.warn("Riga saltata: dati obbligatori mancanti", row);
          errorCount++;
          continue;
        }

        // Helper per cercare ID da nome/cognome
        const findUserId = (name: string) => {
          if (!name) return null;
          const user = utenti.find(u => 
            `${u.nome} ${u.cognome}`.toLowerCase() === name.toLowerCase() ||
            u.username?.toLowerCase() === name.toLowerCase()
          );
          return user?.id || null;
        };

        const findContattoId = (name: string) => {
          if (!name) return null;
          const contatto = contatti.find(c => 
            `${c.cognome} ${c.nome}`.trim().toLowerCase() === name.toLowerCase()
          );
          return contatto?.id || null;
        };
        
        const findPrestazioneId = (desc: string) => {
          if (!desc) return null;
          const prestazione = prestazioni.find(p => p.descrizione?.toLowerCase() === desc.toLowerCase());
          return prestazione?.id || null;
        };

        const clienteData = {
          cod_cliente: `CL-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`, // Generato auto
          tipo_cliente: tipoCliente,
          tipologia_cliente: tipologiaCliente,
          settore: settore,
          ragione_sociale: ragioneSociale,
          partita_iva: row[4]?.toString().trim() || null,
          codice_fiscale: row[5]?.toString().trim() || null,
          indirizzo: row[6]?.toString().trim() || null,
          cap: row[7]?.toString().trim() || null,
          citta: row[8]?.toString().trim() || null,
          provincia: row[9]?.toString().trim() || null,
          email: row[10]?.toString().trim() || null,
          attivo: row[11]?.toString().trim().toUpperCase() === "FALSO" ? false : true,
          note: row[12]?.toString().trim() || null,
          utente_operatore_id: findUserId(row[13]?.toString().trim()),
          utente_professionista_id: findUserId(row[14]?.toString().trim()),
          utente_payroll_id: findUserId(row[15]?.toString().trim()),
          professionista_payroll_id: findUserId(row[16]?.toString().trim()),
          contatto1_id: findContattoId(row[17]?.toString().trim()),
          contatto2_id: findContattoId(row[18]?.toString().trim()),
          tipo_prestazione_id: findPrestazioneId(row[19]?.toString().trim()),
          tipo_redditi: row[20]?.toString().trim() || null
        };

        try {
          await clienteService.createCliente(clienteData);
          importedCount++;
        } catch (error) {
          console.error("Errore importazione riga:", error);
          errorCount++;
        }
      }

      toast({
        title: "Importazione Completata",
        description: `Importati: ${importedCount} | Errori/Saltati: ${errorCount}`,
        variant: importedCount > 0 ? "default" : "destructive"
      });

      loadData(); // Ricarica lista

    } catch (error) {
      console.error("Errore lettura file:", error);
      toast({
        title: "Errore Importazione",
        description: "Impossibile leggere il file CSV/Excel",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      // Reset input file
      e.target.value = "";
    }
  };

  const formSchema = z.object({}); // Placeholder

  const downloadTemplate = () => {
    const headers = [
      "Tipo Cliente",              // 0
      "Tipologia Cliente",         // 1
      "Settore",                   // 2
      "Ragione Sociale",           // 3
      "Partita IVA",               // 4
      "Codice Fiscale",            // 5
      "Indirizzo",                 // 6
      "CAP",                       // 7
      "Città",                     // 8
      "Provincia",                 // 9
      "Email",                     // 10
      "Attivo",                    // 11
      "Note",                      // 12
      "Utente Fiscale",            // 13
      "Professionista Fiscale",    // 14
      "Utente Payroll",            // 15
      "Professionista Payroll",    // 16
      "Contatto 1",                // 17
      "Contatto 2",                // 18
      "Tipo Prestazione",          // 19
      "Tipo Redditi"               // 20
    ];

    const exampleRows = [
      [
        "Persona fisica",          // Tipo Cliente
        "Interno",                 // Tipologia Cliente
        "Fiscale",                 // Settore
        "MARIO ROSSI SRL",         // Ragione Sociale
        "01234567890",             // P.IVA
        "RSSMRA80A01H501U",        // CF
        "Via Roma 1",              // Indirizzo
        "00100",                   // CAP
        "Roma",                    // Città
        "RM",                      // Provincia
        "info@mariorossi.it",      // Email
        "VERO",                    // Attivo
        "Note varie...",           // Note
        "",                        // Utente Fiscale
        "",                        // Professionista Fiscale
        "",                        // Utente Payroll
        "",                        // Professionista Payroll
        "",                        // Contatto 1
        "",                        // Contatto 2
        "",                        // Tipo Prestazione
        "USC"                      // Tipo Redditi
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
      description: "Compila il file CSV seguendo l'ordine esatto delle colonne."
    });
  };

  const clientiConCassetto = clienti.filter((c) => c.cassetto_fiscale_id).length;
  const percentualeCassetto = clienti.length > 0 ? Math.round((clientiConCassetto / clienti.length) * 100) : 0;

  const getNomeTipoRiferimento = (tipo: "matricola_inps" | "pat_inail" | "codice_ditta_ce") => {
    const nomi = {
      matricola_inps: "Matricola INPS",
      pat_inail: "PAT INAIL",
      codice_ditta_ce: "Codice Ditta CE"
    };
    return nomi[tipo];
  };

  const getFilteredSuggestions = (tipo: "matricola_inps" | "pat_inail" | "codice_ditta_ce", searchValue: string) => {
    const lista = tipo === "matricola_inps" ? matricoleInps : tipo === "pat_inail" ? patInail : codiciDittaCe;
    if (!searchValue) return lista;
    return lista.filter(item => item.valore.toLowerCase().includes(searchValue.toLowerCase()));
  };

  const isFieldEnabled = (field: "fiscale" | "payroll") => {
    if (!formData.settore) return true;
    if (formData.settore === "Fiscale & Lavoro") return true;
    if (formData.settore === "Fiscale" && field === "fiscale") return true;
    if (formData.settore === "Lavoro" && field === "payroll") return true;
    return false;
  };

  const handleEditCliente = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setShowDialog(true);
    if (cliente) {
      form.reset({
        cod_cliente: cliente.cod_cliente || '',
        tipo_cliente: cliente.tipo_cliente,
        tipologia_cliente: cliente.tipologia_cliente ?? undefined,
        settore: cliente.settore ?? undefined,
        ragione_sociale: cliente.ragione_sociale,
        partita_iva: cliente.partita_iva,
        codice_fiscale: cliente.codice_fiscale,
        indirizzo: cliente.indirizzo,
        cap: cliente.cap,
        citta: cliente.citta,
        provincia: cliente.provincia,
        email: cliente.email,
        attivo: cliente.attivo,
        note: cliente.note || ''
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Caricamento clienti...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Anagrafica Clienti</h1>
            <p className="text-muted-foreground mt-1">
              Anagrafica completa e gestione scadenzari
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Importa CSV
            </Button>
            <Button variant="outline" onClick={downloadTemplate}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Scarica Template
            </Button>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Cliente
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totale Contatti
            </CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{clienti.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Con Cassetto Fiscale
            </CardTitle>
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{clientiConCassetto}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Percentuale
            </CardTitle>
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{percentualeCassetto}%</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Ricerca e Filtri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              placeholder="Cerca per ragione sociale, P.IVA o CF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedLetter === "Tutti" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedLetter("Tutti")}
                className="px-4"
              >
                Tutti
              </Button>
              {alphabet.map((letter) => (
                <Button
                  key={letter}
                  variant={selectedLetter === letter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedLetter(letter)}
                  className="w-10 h-10 p-0"
                >
                  {letter}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filteredClienti.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nessun cliente trovato</h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || selectedLetter !== "Tutti"
                  ? "Prova a modificare i filtri di ricerca"
                  : "Inizia aggiungendo il tuo primo cliente"}
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Aggiungi Cliente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cod. Cliente</TableHead>
                  <TableHead>Ragione Sociale</TableHead>
                  <TableHead>P.IVA</TableHead>
                  <TableHead>Città</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-center">Scadenzari</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClienti.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-mono text-sm">
                      {cliente.cod_cliente || cliente.id.substring(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {cliente.ragione_sociale}
                    </TableCell>
                    <TableCell>{cliente.partita_iva}</TableCell>
                    <TableCell>{cliente.citta}</TableCell>
                    <TableCell>{cliente.email}</TableCell>
                    <TableCell>
                      {cliente.attivo ? (
                        <Badge variant="default" className="bg-green-600">
                          Attivo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inattivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleInsertIntoScadenzari(cliente)}
                        title="Inserisci negli Scadenzari"
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCliente ? "Modifica Cliente" : "Nuovo Cliente"}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="anagrafica" className="w-full">
            <TabsList className="grid w-full grid-cols-6 overflow-x-auto">
              <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
              <TabsTrigger value="riferimenti">Riferimenti</TabsTrigger>
              <TabsTrigger value="altri_dati">Altri Dati</TabsTrigger>
              <TabsTrigger value="antiriciclaggio">Antiriciclaggio</TabsTrigger>
              <TabsTrigger value="scadenzari">Scadenzari</TabsTrigger>
              <TabsTrigger value="comunicazioni">Comunicazioni</TabsTrigger>
            </TabsList>

            <TabsContent value="anagrafica" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cod_cliente">Codice Cliente</Label>
                  <Input
                    id="cod_cliente"
                    value={formData.cod_cliente}
                    onChange={(e) =>
                      setFormData({ ...formData, cod_cliente: e.target.value })
                    }
                    placeholder="Generato automaticamente se vuoto"
                  />
                </div>

                <div>
                  <Label htmlFor="tipo_cliente">Tipo Cliente</Label>
                  <Select
                    value={formData.tipo_cliente}
                    onValueChange={(value) =>
                      setFormData({ ...formData, tipo_cliente: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Persona fisica">Persona fisica</SelectItem>
                      <SelectItem value="Altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tipologia_cliente">Tipologia Cliente</Label>
                  <Select
                    value={formData.tipologia_cliente || undefined}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, tipologia_cliente: value as "Interno" | "Esterno" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipologia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Interno">Interno</SelectItem>
                      <SelectItem value="Esterno">Esterno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="settore">Settore</Label>
                  <Select
                    value={formData.settore || undefined}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, settore: value as "Fiscale" | "Lavoro" | "Fiscale & Lavoro" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona settore" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fiscale">Fiscale</SelectItem>
                      <SelectItem value="Lavoro">Lavoro</SelectItem>
                      <SelectItem value="Fiscale & Lavoro">Fiscale & Lavoro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="ragione_sociale">
                    Ragione Sociale <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="ragione_sociale"
                    value={formData.ragione_sociale}
                    onChange={(e) =>
                      setFormData({ ...formData, ragione_sociale: e.target.value })
                    }
                    placeholder="Es. HAPPY SRL"
                  />
                </div>

                <div>
                  <Label htmlFor="partita_iva">
                    P.IVA <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="partita_iva"
                    value={formData.partita_iva}
                    onChange={(e) =>
                      setFormData({ ...formData, partita_iva: e.target.value })
                    }
                    placeholder="01234567890"
                  />
                </div>

                <div>
                  <Label htmlFor="codice_fiscale">Codice Fiscale</Label>
                  <Input
                    id="codice_fiscale"
                    value={formData.codice_fiscale}
                    onChange={(e) =>
                      setFormData({ ...formData, codice_fiscale: e.target.value })
                    }
                    placeholder="RSSMRA80A01H501U"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="indirizzo">Indirizzo</Label>
                  <Input
                    id="indirizzo"
                    value={formData.indirizzo}
                    onChange={(e) =>
                      setFormData({ ...formData, indirizzo: e.target.value })
                    }
                    placeholder="Via Roma, 123"
                  />
                </div>

                <div>
                  <Label htmlFor="cap">CAP</Label>
                  <Input
                    id="cap"
                    value={formData.cap}
                    onChange={(e) => setFormData({ ...formData, cap: e.target.value })}
                    placeholder="00100"
                  />
                </div>

                <div>
                  <Label htmlFor="citta">Città</Label>
                  <Input
                    id="citta"
                    value={formData.citta}
                    onChange={(e) =>
                      setFormData({ ...formData, citta: e.target.value })
                    }
                    placeholder="Roma"
                  />
                </div>

                <div>
                  <Label htmlFor="provincia">Provincia</Label>
                  <Input
                    id="provincia"
                    value={formData.provincia}
                    onChange={(e) =>
                      setFormData({ ...formData, provincia: e.target.value })
                    }
                    placeholder="RM"
                    maxLength={2}
                  />
                </div>

                <div>
                  <Label htmlFor="email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="info@happy.it"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="attivo"
                    checked={formData.attivo}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, attivo: checked })
                    }
                  />
                  <Label htmlFor="attivo">Cliente Attivo</Label>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="note">Note</Label>
                  <Textarea
                    id="note"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Note aggiuntive..."
                    rows={4}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="riferimenti" className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="utente_operatore_id">Utente Fiscale</Label>
                  <Select
                    value={formData.utente_operatore_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, utente_operatore_id: value === "none" ? "" : value })
                    }
                    disabled={!isFieldEnabled("fiscale")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona utente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {utenti.map((utente) => (
                        <SelectItem key={utente.id} value={utente.id}>
                          {utente.nome} {utente.cognome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="utente_professionista_id">Professionista Fiscale</Label>
                  <Select
                    value={formData.utente_professionista_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, utente_professionista_id: value === "none" ? "" : value })
                    }
                    disabled={!isFieldEnabled("fiscale")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona professionista" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
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
                    value={formData.utente_payroll_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, utente_payroll_id: value === "none" ? "" : value })
                    }
                    disabled={!isFieldEnabled("payroll")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona utente payroll" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
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
                    value={formData.professionista_payroll_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, professionista_payroll_id: value === "none" ? "" : value })
                    }
                    disabled={!isFieldEnabled("payroll")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona professionista payroll" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
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
                    value={formData.contatto1_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, contatto1_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona contatto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
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
                    value={formData.contatto2_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, contatto2_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona contatto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {contatti.map((contatto) => (
                        <SelectItem key={contatto.id} value={contatto.id}>
                          {contatto.nome} {contatto.cognome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tipo_prestazione_id">Tipo Prestazione</Label>
                  <Select
                    value={formData.tipo_prestazione_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, tipo_prestazione_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona prestazione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {prestazioni.map((prestazione) => (
                        <SelectItem key={prestazione.id} value={prestazione.id}>
                          {prestazione.descrizione}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tipo_redditi">Tipo Redditi</Label>
                  <Select
                    value={formData.tipo_redditi || undefined}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, tipo_redditi: value as "USC" | "USP" | "ENC" | "UPF" | "730" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USC">USC - Società di Capitali</SelectItem>
                      <SelectItem value="USP">USP - Società di Persone</SelectItem>
                      <SelectItem value="ENC">ENC - Ente Non Commerciale</SelectItem>
                      <SelectItem value="UPF">UPF - Persona Fisica</SelectItem>
                      <SelectItem value="730">730 - Modello 730</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cassetto_fiscale_id">Referente Cassetto fiscale</Label>
                  <Select
                    value={formData.cassetto_fiscale_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, cassetto_fiscale_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona cassetto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {cassettiFiscali.map((cassetto) => (
                        <SelectItem key={cassetto.id} value={cassetto.id}>
                          {cassetto.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="altri_dati" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="matricola_inps">Matricola INPS</Label>
                  <Textarea
                    id="matricola_inps"
                    value={formData.matricola_inps}
                    onChange={(e) => setFormData({ ...formData, matricola_inps: e.target.value })}
                    placeholder="Inserisci matricola INPS..."
                    rows={2}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="pat_inail">Pat INAIL</Label>
                  <Textarea
                    id="pat_inail"
                    value={formData.pat_inail}
                    onChange={(e) => setFormData({ ...formData, pat_inail: e.target.value })}
                    placeholder="Inserisci Pat INAIL..."
                    rows={2}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="codice_ditta_ce">Codice Ditta CE</Label>
                  <Textarea
                    id="codice_ditta_ce"
                    value={formData.codice_ditta_ce}
                    onChange={(e) => setFormData({ ...formData, codice_ditta_ce: e.target.value })}
                    placeholder="Inserisci codice ditta CE..."
                    rows={2}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="antiriciclaggio" className="space-y-6 pt-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 ${!formData.gestione_antiriciclaggio ? "opacity-60" : ""}`}>
                <Label className="flex items-center gap-2 font-medium text-blue-900 cursor-pointer">
                  <Input
                    type="checkbox"
                    checked={formData.gestione_antiriciclaggio}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      gestione_antiriciclaggio: e.target.checked 
                    })}
                    className="w-5 h-5"
                  />
                  Gestione Antiriciclaggio
                </Label>
                <p className="text-sm text-blue-700 mt-2 ml-7">
                  Attiva questa opzione per abilitare la gestione e includere il cliente nello scadenzario Antiriciclaggio
                </p>
              </div>

              <h3 className="font-semibold text-lg mb-4">
                Adeguata Verifica Clientela (Antiriciclaggio)
              </h3>
              
              <div className="space-y-6">
                <Card className={`bg-blue-50 dark:bg-blue-950/20 ${!formData.gestione_antiriciclaggio ? "opacity-60" : ""}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-base">Verifica A (Principale)</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Tipo Prestazione A</Label>
                      <Select
                        value={formData.tipo_prestazione_a || ""}
                        onValueChange={(value) =>
                          setFormData({ ...formData, tipo_prestazione_a: value })
                        }
                        disabled={!formData.gestione_antiriciclaggio}
                      >
                        <SelectTrigger className={!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}>
                          <SelectValue placeholder="Seleziona tipo prestazione A" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPO_PRESTAZIONE_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Rischio Verifica A</Label>
                        <Select
                          value={formData.rischio_ver_a || ""}
                          onValueChange={(value) =>
                            handleRiskChange(
                              value,
                              "rischio_ver_a"
                            )
                          }
                          disabled={!formData.gestione_antiriciclaggio}
                        >
                          <SelectTrigger className={!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}>
                            <SelectValue placeholder="Seleziona rischio A" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Non significativo">Non significativo</SelectItem>
                            <SelectItem value="Poco significativo">Poco significativo</SelectItem>
                            <SelectItem value="Abbastanza significativo">Abbastanza significativo</SelectItem>
                            <SelectItem value="Molto significativo">Molto significativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Scadenza in mesi</Label>
                        <Input
                          type="number"
                          value={formData.gg_ver_a ?? ""}
                          onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : undefined;
                            handleGgVerChange("A", value);
                          }}
                          placeholder="36, 12 o 6"
                          disabled={!formData.gestione_antiriciclaggio}
                          className={!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Data Ultima Verifica A</Label>
                        <Input
                          type="date"
                          value={formData.data_ultima_verifica_antiric ? formData.data_ultima_verifica_antiric.toISOString().split('T')[0] : ""}
                          onChange={(e) => {
                            const dateValue = e.target.value ? new Date(e.target.value) : undefined;
                            handleVerificaDateChange("A", dateValue);
                          }}
                          className={`w-full ${!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}`}
                          disabled={!formData.gestione_antiriciclaggio}
                        />
                      </div>

                      <div>
                        <Label>Scadenza Antiriciclaggio A</Label>
                        <Input
                          type="date"
                          value={formData.scadenza_antiric ? formData.scadenza_antiric.toISOString().split('T')[0] : ""}
                          disabled
                          className="w-full bg-muted cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <Label>Giorni Scad. Ver A</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={formData.giorni_scad_ver_a !== null ? `${formData.giorni_scad_ver_a} giorni` : "N/A"}
                            disabled
                            className="w-full bg-muted cursor-not-allowed"
                          />
                          {formData.giorni_scad_ver_a !== null && (
                            <Badge className={getBadgeColor(formData.giorni_scad_ver_a)}>
                              {formData.giorni_scad_ver_a < 15 ? "🔴 URGENTE" : formData.giorni_scad_ver_a < 30 ? "🟠 ATTENZIONE" : "✅ OK"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-green-50 dark:bg-green-950/20 ${!formData.gestione_antiriciclaggio ? "opacity-60" : ""}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-base">Verifica B (Secondaria)</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Tipo Prestazione B</Label>
                      <Select
                        value={formData.tipo_prestazione_b || ""}
                        onValueChange={(value) =>
                          setFormData({ ...formData, tipo_prestazione_b: value })
                        }
                        disabled={!formData.gestione_antiriciclaggio}
                      >
                        <SelectTrigger className={!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}>
                          <SelectValue placeholder="Seleziona tipo prestazione B" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPO_PRESTAZIONE_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Rischio Verifica B</Label>
                        <Select
                          value={formData.rischio_ver_b || ""}
                          onValueChange={(value) =>
                            handleRiskChange(
                              value,
                              "rischio_ver_b"
                            )
                          }
                          disabled={!formData.gestione_antiriciclaggio}
                        >
                          <SelectTrigger className={!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}>
                            <SelectValue placeholder="Seleziona rischio B" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Non significativo">Non significativo</SelectItem>
                            <SelectItem value="Poco significativo">Poco significativo</SelectItem>
                            <SelectItem value="Abbastanza significativo">Abbastanza significativo</SelectItem>
                            <SelectItem value="Molto significativo">Molto significativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Scadenza in mesi</Label>
                        <Input
                          type="number"
                          value={formData.gg_ver_b ?? ""}
                          onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : undefined;
                            handleGgVerChange("B", value);
                          }}
                          placeholder="36, 12 o 6"
                          disabled={!formData.gestione_antiriciclaggio}
                          className={!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Data Ultima Verifica B</Label>
                        <Input
                          type="date"
                          value={formData.data_ultima_verifica_b ? formData.data_ultima_verifica_b.toISOString().split('T')[0] : ""}
                          onChange={(e) => {
                            const dateValue = e.target.value ? new Date(e.target.value) : undefined;
                            handleVerificaDateChange("B", dateValue);
                          }}
                          className={`w-full ${!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}`}
                          disabled={!formData.gestione_antiriciclaggio}
                        />
                      </div>

                      <div>
                        <Label>Scadenza Antiriciclaggio B</Label>
                        <Input
                          type="date"
                          value={formData.scadenza_antiric_b ? formData.scadenza_antiric_b.toISOString().split('T')[0] : ""}
                          disabled
                          className="w-full bg-muted cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <Label>Giorni Scad. Ver B</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={formData.giorni_scad_ver_b !== null ? `${formData.giorni_scad_ver_b} giorni` : "N/A"}
                            disabled
                            className="w-full bg-muted cursor-not-allowed"
                          />
                          {formData.giorni_scad_ver_b !== null && (
                            <Badge className={getBadgeColor(formData.giorni_scad_ver_b)}>
                              {formData.giorni_scad_ver_b < 15 ? "🔴 URGENTE" : formData.giorni_scad_ver_b < 30 ? "🟠 ATTENZIONE" : "✅ OK"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="scadenzari" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Seleziona gli scadenzari attivi per questo cliente
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_iva"
                    checked={scadenzari.iva}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, iva: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_iva">IVA</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_cu"
                    checked={scadenzari.cu}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, cu: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_cu">CU (Certificazione Unica)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_bilancio"
                    checked={scadenzari.bilancio}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, bilancio: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_bilancio">Bilanci</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_fiscali"
                    checked={scadenzari.fiscali}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, fiscali: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_fiscali">Fiscali</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_lipe"
                    checked={scadenzari.lipe}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, lipe: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_lipe">Lipe</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_modello_770"
                    checked={scadenzari.modello_770}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, modello_770: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_modello_770">770</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_esterometro"
                    checked={scadenzari.esterometro}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, esterometro: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_esterometro">Esterometro</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_ccgg"
                    checked={scadenzari.ccgg}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, ccgg: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_ccgg">CCGG</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_proforma"
                    checked={scadenzari.proforma}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, proforma: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_proforma">Proforma</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_imu"
                    checked={scadenzari.imu}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, imu: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_imu">IMU</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="comunicazioni" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Gestisci le preferenze di comunicazione del cliente
              </p>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="email_attiva"
                    checked={comunicazioni.email_attiva}
                    onCheckedChange={(checked) =>
                      setComunicazioni({ ...comunicazioni, email_attiva: checked as boolean })
                    }
                  />
                  <Label htmlFor="email_attiva">Email Attiva</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ricevi_mailing_scadenze"
                    checked={comunicazioni.ricevi_mailing_scadenze}
                    onCheckedChange={(checked) =>
                      setComunicazioni({ ...comunicazioni, ricevi_mailing_scadenze: checked as boolean })
                    }
                  />
                  <Label htmlFor="ricevi_mailing_scadenze">Ricevi Mailing Scadenze</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ricevi_newsletter"
                    checked={comunicazioni.ricevi_newsletter}
                    onCheckedChange={(checked) =>
                      setComunicazioni({ ...comunicazioni, ricevi_newsletter: checked as boolean })
                    }
                  />
                  <Label htmlFor="ricevi_newsletter">Ricevi Newsletter</Label>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave}>
              {editingCliente ? "Salva Modifiche" : "Crea Cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Conferma Inserimento</AlertDialogTitle>
            <AlertDialogDescription>
              Vuoi aggiungere il valore <strong>&quot;{pendingRiferimento?.valore}&quot;</strong> all&apos;elenco{" "}
              {pendingRiferimento ? getNomeTipoRiferimento(pendingRiferimento.tipo) : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelNewRiferimento}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmNewRiferimento}>
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input
        type="file"
        accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={handleImportCSV}
        className="hidden"
        id="file-upload"
      />
    </div>
  );
}
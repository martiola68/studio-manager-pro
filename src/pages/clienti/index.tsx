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
} from "@/components/ui/dialog";
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
import { Users, Edit, Trash2, Search, Plus, Upload, FileSpreadsheet, CheckCircle2, FolderOpen, Calendar } from "lucide-react";
import { clienteService } from "@/services/clienteService";
import { contattoService } from "@/services/contattoService";
import { utenteService } from "@/services/utenteService";
import { cassettiFiscaliService } from "@/services/cassettiFiscaliService";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type CassettoFiscale = Database["public"]["Tables"]["tbcassetti_fiscali"]["Row"];
type Prestazione = Database["public"]["Tables"]["tbprestazioni"]["Row"];

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

type VerificaAntiriciclaggio = {
  tipo_prestazione_id: string;
  data_ultima_verifica: Date | undefined;
  scadenza_antiriciclaggio: Date | undefined;
};

export default function ClientiPage() {
  const { toast } = useToast();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [filteredClienti, setFilteredClienti] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string>("Tutti");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [contatti, setContatti] = useState<Contatto[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [cassettiFiscali, setCassettiFiscali] = useState<CassettoFiscale[]>([]);
  const [prestazioni, setPrestazioni] = useState<Prestazione[]>([]);

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
    tipo_cliente: "PERSONA_FISICA" as string,
    attivo: true,
    note: "",
    utente_operatore_id: "",
    utente_professionista_id: "",
    contatto1_id: "",
    contatto2_id: "",
    tipo_prestazione_id: "",
    tipo_redditi: "" as "SC" | "SP" | "ENC" | "PF" | "730" | "",
    cassetto_fiscale_id: "",
    settore: "" as "Fiscale" | "Lavoro" | "",
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

  const [comunicazioni, setComunicazioni] = useState<ComunicazioniPreferenze>({
    email_attiva: true,
    ricevi_mailing_scadenze: true,
    ricevi_newsletter: true,
  });

  const [verificaA, setVerificaA] = useState<VerificaAntiriciclaggio>({
    tipo_prestazione_id: "",
    data_ultima_verifica: undefined,
    scadenza_antiriciclaggio: undefined,
  });

  const [verificaB, setVerificaB] = useState<VerificaAntiriciclaggio>({
    tipo_prestazione_id: "",
    data_ultima_verifica: undefined,
    scadenza_antiriciclaggio: undefined,
  });

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterClienti();
  }, [clienti, searchTerm, selectedLetter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientiData, contattiData, utentiData, cassettiData, prestazioniData] = await Promise.all([
        clienteService.getClienti(),
        contattoService.getContatti(),
        utenteService.getUtenti(),
        cassettiFiscaliService.getCassettiFiscali(),
        supabase.from("tbprestazioni").select("*").order("descrizione"),
      ]);

      setClienti(clientiData);
      setContatti(contattiData);
      setUtenti(utentiData);
      setCassettiFiscali(cassettiData);
      setPrestazioni(prestazioniData.data || []);
    } catch (error) {
      console.error("Errore caricamento dati:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterClienti = () => {
    let filtered = clienti;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.ragione_sociale?.toLowerCase().includes(search) ||
          c.partita_iva?.toLowerCase().includes(search) ||
          c.codice_fiscale?.toLowerCase().includes(search) ||
          c.email?.toLowerCase().includes(search)
      );
    }

    if (selectedLetter !== "Tutti") {
      filtered = filtered.filter((c) =>
        c.ragione_sociale?.toUpperCase().startsWith(selectedLetter)
      );
    }

    setFilteredClienti(filtered);
  };

  const handleSave = async () => {
    try {
      if (!formData.ragione_sociale || !formData.partita_iva || !formData.email) {
        toast({
          title: "Errore",
          description: "Compila tutti i campi obbligatori",
          variant: "destructive",
        });
        return;
      }

      const dataToSave = {
        ...formData,
        cod_cliente: formData.cod_cliente || `CL-${Date.now().toString().slice(-6)}`,
        utente_operatore_id: formData.utente_operatore_id || null,
        utente_professionista_id: formData.utente_professionista_id || null,
        contatto1_id: formData.contatto1_id || null,
        contatto2_id: formData.contatto2_id || null,
        tipo_prestazione_id: formData.tipo_prestazione_id || null,
        tipo_redditi: formData.tipo_redditi || null,
        cassetto_fiscale_id: formData.cassetto_fiscale_id || null,
        settore: formData.settore || null,
      };

      if (editingCliente) {
        await clienteService.updateCliente(editingCliente.id, dataToSave);
        toast({
          title: "Successo",
          description: "Cliente aggiornato con successo",
        });
      } else {
        await clienteService.createCliente(dataToSave);
        toast({
          title: "Successo",
          description: "Cliente creato con successo",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Errore salvataggio cliente:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il cliente",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo cliente?")) return;

    try {
      await clienteService.deleteCliente(id);
      toast({
        title: "Successo",
        description: "Cliente eliminato con successo",
      });
      loadData();
    } catch (error) {
      console.error("Errore eliminazione cliente:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il cliente",
        variant: "destructive",
      });
    }
  };

  const handleAddNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      cod_cliente: cliente.cod_cliente || "",
      ragione_sociale: cliente.ragione_sociale || "",
      partita_iva: cliente.partita_iva || "",
      codice_fiscale: cliente.codice_fiscale || "",
      indirizzo: cliente.indirizzo || "",
      cap: cliente.cap || "",
      citta: cliente.citta || "",
      provincia: cliente.provincia || "",
      email: cliente.email || "",
      tipo_cliente: cliente.tipo_cliente || "PERSONA_FISICA",
      attivo: cliente.attivo ?? true,
      note: cliente.note || "",
      utente_operatore_id: cliente.utente_operatore_id || "",
      utente_professionista_id: cliente.utente_professionista_id || "",
      contatto1_id: cliente.contatto1_id || "",
      contatto2_id: cliente.contatto2_id || "",
      tipo_prestazione_id: cliente.tipo_prestazione_id || "",
      tipo_redditi: (cliente.tipo_redditi as "SC" | "SP" | "ENC" | "PF" | "730") || "",
      cassetto_fiscale_id: cliente.cassetto_fiscale_id || "",
      settore: (cliente.settore as "Fiscale" | "Lavoro") || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCliente(null);
    setFormData({
      cod_cliente: "",
      ragione_sociale: "",
      partita_iva: "",
      codice_fiscale: "",
      indirizzo: "",
      cap: "",
      citta: "",
      provincia: "",
      email: "",
      tipo_cliente: "PERSONA_FISICA",
      attivo: true,
      note: "",
      utente_operatore_id: "",
      utente_professionista_id: "",
      contatto1_id: "",
      contatto2_id: "",
      tipo_prestazione_id: "",
      tipo_redditi: "",
      cassetto_fiscale_id: "",
      settore: "",
    });
    setScadenzari({
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
    setComunicazioni({
      email_attiva: true,
      ricevi_mailing_scadenze: true,
      ricevi_newsletter: true,
    });
    setVerificaA({
      tipo_prestazione_id: "",
      data_ultima_verifica: undefined,
      scadenza_antiriciclaggio: undefined,
    });
    setVerificaB({
      tipo_prestazione_id: "",
      data_ultima_verifica: undefined,
      scadenza_antiriciclaggio: undefined,
    });
  };

  const handleExportCSV = () => {
    const headers = ["Ragione Sociale", "P.IVA", "Codice Fiscale", "Email", "Città", "Stato"];
    const rows = filteredClienti.map((c) => [
      c.ragione_sociale,
      c.partita_iva,
      c.codice_fiscale,
      c.email,
      c.citta,
      c.attivo ? "Attivo" : "Inattivo",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clienti.csv";
    a.click();
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split("\n");

      let successCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(",");
        const clienteData = {
          cod_cliente: `IMP-${Date.now()}-${i}`,
          ragione_sociale: values[0]?.trim() || "",
          partita_iva: values[1]?.trim() || "",
          codice_fiscale: values[2]?.trim() || "",
          email: values[3]?.trim() || "",
          citta: values[4]?.trim() || "",
          attivo: values[5]?.trim().toLowerCase() === "attivo",
        };

        try {
          await clienteService.createCliente(clienteData as any);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Errore importazione riga ${i}:`, error);
        }
      }

      toast({
        title: "Importazione completata",
        description: `${successCount} clienti importati, ${errorCount} errori`,
      });

      loadData();
    } catch (error) {
      console.error("Errore importazione CSV:", error);
      toast({
        title: "Errore",
        description: "Impossibile importare il file CSV",
        variant: "destructive",
      });
    }
  };

  const clientiConCassetto = clienti.filter((c) => c.cassetto_fiscale_id).length;
  const percentualeCassetto = clienti.length > 0 ? Math.round((clientiConCassetto / clienti.length) * 100) : 0;

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
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-3xl font-bold">Gestione Clienti</h1>
            <p className="text-muted-foreground mt-1">
              Anagrafica completa e gestione scadenzari
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => document.getElementById("csv-upload")?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Importa CSV
            </Button>
            <Button onClick={handleAddNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuovo Cliente
            </Button>
          </div>
        </div>
      </div>

      {/* Statistiche */}
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

      {/* Ricerca e Filtri */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Ricerca e Filtri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Barra di ricerca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              placeholder="Cerca per ragione sociale, P.IVA o CF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>

          {/* Filtro alfabetico */}
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

      {/* Tabella Clienti */}
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

      {/* Dialog Nuovo/Modifica Cliente */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCliente ? "Modifica Cliente" : "Nuovo Cliente"}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="anagrafica" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
              <TabsTrigger value="riferimenti">Riferimenti</TabsTrigger>
              <TabsTrigger value="scadenzari">Scadenzari</TabsTrigger>
              <TabsTrigger value="comunicazioni">Comunicazioni</TabsTrigger>
            </TabsList>

            <TabsContent value="anagrafica" className="space-y-4">
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
                      <SelectItem value="PERSONA_FISICA">Persona Fisica</SelectItem>
                      <SelectItem value="PERSONA_GIURIDICA">Persona Giuridica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
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

                <div>
                  <Label htmlFor="settore">Settore</Label>
                  <Select
                    value={formData.settore || undefined}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, settore: value as "Fiscale" | "Lavoro" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona settore" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fiscale">Fiscale</SelectItem>
                      <SelectItem value="Lavoro">Lavoro</SelectItem>
                    </SelectContent>
                  </Select>
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
                    onChange={(e) => setFormData({ ...formData, citta: e.target.value })}
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

            <TabsContent value="riferimenti" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="utente_operatore_id">Utente Operatore</Label>
                  <Select
                    value={formData.utente_operatore_id || undefined}
                    onValueChange={(value) =>
                      setFormData({ ...formData, utente_operatore_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona utente" />
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
                  <Label htmlFor="utente_professionista_id">Utente Professionista</Label>
                  <Select
                    value={formData.utente_professionista_id || undefined}
                    onValueChange={(value) =>
                      setFormData({ ...formData, utente_professionista_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona utente" />
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
                    value={formData.contatto1_id || undefined}
                    onValueChange={(value) =>
                      setFormData({ ...formData, contatto1_id: value })
                    }
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
                    value={formData.contatto2_id || undefined}
                    onValueChange={(value) =>
                      setFormData({ ...formData, contatto2_id: value })
                    }
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
                  <Label htmlFor="tipo_prestazione_id">Tipo Prestazione</Label>
                  <Select
                    value={formData.tipo_prestazione_id || undefined}
                    onValueChange={(value) =>
                      setFormData({ ...formData, tipo_prestazione_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona prestazione" />
                    </SelectTrigger>
                    <SelectContent>
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
                      setFormData({ ...formData, tipo_redditi: value as "SC" | "SP" | "ENC" | "PF" | "730" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SC">SC - Società di Capitali</SelectItem>
                      <SelectItem value="SP">SP - Società di Persone</SelectItem>
                      <SelectItem value="ENC">ENC - Ente Non Commerciale</SelectItem>
                      <SelectItem value="PF">PF - Persona Fisica</SelectItem>
                      <SelectItem value="730">730 - Modello 730</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="cassetto_fiscale_id">Titolare Cassetto Fiscale</Label>
                  <Select
                    value={formData.cassetto_fiscale_id || undefined}
                    onValueChange={(value) =>
                      setFormData({ ...formData, cassetto_fiscale_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona cassetto" />
                    </SelectTrigger>
                    <SelectContent>
                      {cassettiFiscali.map((cassetto) => (
                        <SelectItem key={cassetto.id} value={cassetto.id}>
                          {cassetto.nominativo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Adeguata Verifica Clientela */}
              <div className="space-y-6 pt-6 border-t">
                <h3 className="font-semibold text-lg">
                  Adeguata Verifica Clientela (Antiriciclaggio)
                </h3>

                <Card className="bg-blue-50 dark:bg-blue-950/20">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-base">Verifica A (Principale)</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="verifica_a_tipo">Tipo Prestazione A</Label>
                      <Select
                        value={verificaA.tipo_prestazione_id || undefined}
                        onValueChange={(value) =>
                          setVerificaA({ ...verificaA, tipo_prestazione_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona prestazione" />
                        </SelectTrigger>
                        <SelectContent>
                          {prestazioni.map((prestazione) => (
                            <SelectItem key={prestazione.id} value={prestazione.id}>
                              {prestazione.descrizione}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Data Ultima Verifica A</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !verificaA.data_ultima_verifica && "text-muted-foreground"
                              )}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {verificaA.data_ultima_verifica ? (
                                format(verificaA.data_ultima_verifica, "dd/MM/yyyy", { locale: it })
                              ) : (
                                <span>gg/mm/aaaa</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={verificaA.data_ultima_verifica}
                              onSelect={(date) =>
                                setVerificaA({ ...verificaA, data_ultima_verifica: date })
                              }
                              locale={it}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label>Scadenza Antiriciclaggio A</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !verificaA.scadenza_antiriciclaggio && "text-muted-foreground"
                              )}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {verificaA.scadenza_antiriciclaggio ? (
                                format(verificaA.scadenza_antiriciclaggio, "dd/MM/yyyy", { locale: it })
                              ) : (
                                <span>gg/mm/aaaa</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={verificaA.scadenza_antiriciclaggio}
                              onSelect={(date) =>
                                setVerificaA({ ...verificaA, scadenza_antiriciclaggio: date })
                              }
                              locale={it}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 dark:bg-green-950/20">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-base">Verifica B (Secondaria)</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="verifica_b_tipo">Tipo Prestazione B</Label>
                      <Select
                        value={verificaB.tipo_prestazione_id || undefined}
                        onValueChange={(value) =>
                          setVerificaB({ ...verificaB, tipo_prestazione_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Nessuna" />
                        </SelectTrigger>
                        <SelectContent>
                          {prestazioni.map((prestazione) => (
                            <SelectItem key={prestazione.id} value={prestazione.id}>
                              {prestazione.descrizione}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Data Ultima Verifica B</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !verificaB.data_ultima_verifica && "text-muted-foreground"
                              )}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {verificaB.data_ultima_verifica ? (
                                format(verificaB.data_ultima_verifica, "dd/MM/yyyy", { locale: it })
                              ) : (
                                <span>gg/mm/aaaa</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={verificaB.data_ultima_verifica}
                              onSelect={(date) =>
                                setVerificaB({ ...verificaB, data_ultima_verifica: date })
                              }
                              locale={it}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label>Scadenza Antiriciclaggio B</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !verificaB.scadenza_antiriciclaggio && "text-muted-foreground"
                              )}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {verificaB.scadenza_antiriciclaggio ? (
                                format(verificaB.scadenza_antiriciclaggio, "dd/MM/yyyy", { locale: it })
                              ) : (
                                <span>gg/mm/aaaa</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={verificaB.scadenza_antiriciclaggio}
                              onSelect={(date) =>
                                setVerificaB({ ...verificaB, scadenza_antiriciclaggio: date })
                              }
                              locale={it}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="scadenzari" className="space-y-4">
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

            <TabsContent value="comunicazioni" className="space-y-4">
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

      <input
        type="file"
        accept=".csv"
        onChange={handleImportCSV}
        className="hidden"
        id="csv-upload"
      />
    </div>
  );
}
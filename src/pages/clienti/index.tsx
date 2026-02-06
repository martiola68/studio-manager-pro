import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Search, X, FileUp, Download, Users, Building2, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TopNavBar } from "@/components/TopNavBar"; // Fixed import
import * as XLSX from "xlsx";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type ClienteInsert = Database["public"]["Tables"]["tbclienti"]["Insert"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type Studio = Database["public"]["Tables"]["tbstudio"]["Row"];

// Updated FormData to match current DB schema
interface FormData {
  cod_cliente: string;
  ragione_sociale: string; // Was denominazione
  partita_iva: string; // Was piva
  codice_fiscale: string; // Was codicefiscale
  tipo_cliente: "Persona fisica" | "Altro"; // Was tipo
  tipo_redditi: "730" | "UPF" | "USP" | "USC" | "ENC" | null;
  
  // Address fields
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
  email: string;
  
  // Flags
  flag_iva: boolean;
  flag_esterometro: boolean;
  flag_lipe: boolean;
  flag_bilancio: boolean;
  flag_770: boolean;
  flag_ccgg: boolean;
  flag_imu: boolean;
  
  // References
  utente_operatore_id: string | null;
  utente_professionista_id: string | null;
  studio_id: string | null;
  attivo: boolean;
  note: string;

  // New fields from schema
  tipologia_cliente: "Interno" | "Esterno";
  settore_fiscale: boolean;
  settore_lavoro: boolean;
  settore_consulenza: boolean;
}

const initialFormData: FormData = {
  cod_cliente: "",
  ragione_sociale: "",
  partita_iva: "",
  codice_fiscale: "",
  tipo_cliente: "Altro",
  tipo_redditi: null,
  indirizzo: "",
  cap: "",
  citta: "",
  provincia: "",
  email: "",
  flag_iva: true,
  flag_esterometro: true,
  flag_lipe: true,
  flag_bilancio: true,
  flag_770: true,
  flag_ccgg: true,
  flag_imu: true,
  utente_operatore_id: null,
  utente_professionista_id: null,
  studio_id: null,
  attivo: true,
  note: "",
  tipologia_cliente: "Interno",
  settore_fiscale: false,
  settore_lavoro: false,
  settore_consulenza: false,
};

export default function ClientiPage() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deletingCliente, setDeletingCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"anagrafica" | "scadenzari">("anagrafica");
  const { toast } = useToast();

  useEffect(() => {
    fetchClienti();
    fetchUtenti();
    fetchStudio();
  }, []);

  const fetchClienti = async () => {
    try {
      const { data, error } = await supabase
        .from("tbclienti")
        .select("*")
        .order("ragione_sociale");

      if (error) throw error;
      setClienti(data || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchUtenti = async () => {
    try {
      const { data, error } = await supabase
        .from("tbutenti")
        .select("*")
        .eq("attivo", true)
        .order("cognome");

      if (error) throw error;
      setUtenti(data || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchStudio = async () => {
    try {
      const { data, error } = await supabase
        .from("tbstudio")
        .select("*")
        .single();

      if (error) throw error;
      setStudio(data);
    } catch (error: any) {
      console.error("Errore caricamento studio:", error);
    }
  };

  const filteredClienti = useMemo(() => {
    return clienti.filter((cliente) =>
      cliente.ragione_sociale?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.cod_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.partita_iva?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.codice_fiscale?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clienti, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Clean up empty strings to null for optional fields if needed, 
      // but most text fields in schema are nullable text or not null text.
      const clienteData: any = {
        ...formData,
        studio_id: studio?.id || null,
      };

      if (editingCliente) {
        const { error } = await supabase
          .from("tbclienti")
          .update(clienteData)
          .eq("id", editingCliente.id);

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Cliente aggiornato con successo",
        });
      } else {
        const { error } = await supabase
          .from("tbclienti")
          .insert(clienteData);

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Cliente creato con successo",
        });
      }

      setIsDialogOpen(false);
      setEditingCliente(null);
      setFormData(initialFormData);
      fetchClienti();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      cod_cliente: cliente.cod_cliente || "",
      ragione_sociale: cliente.ragione_sociale || "",
      partita_iva: cliente.partita_iva || "",
      codice_fiscale: cliente.codice_fiscale || "",
      tipo_cliente: (cliente.tipo_cliente as any) || "Altro",
      tipo_redditi: (cliente.tipo_redditi as any) || null,
      indirizzo: cliente.indirizzo || "",
      cap: cliente.cap || "",
      citta: cliente.citta || "",
      provincia: cliente.provincia || "",
      email: cliente.email || "",
      flag_iva: cliente.flag_iva ?? true,
      flag_esterometro: cliente.flag_esterometro ?? true,
      flag_lipe: cliente.flag_lipe ?? true,
      flag_bilancio: cliente.flag_bilancio ?? true,
      flag_770: cliente.flag_770 ?? true,
      flag_ccgg: cliente.flag_ccgg ?? true,
      flag_imu: cliente.flag_imu ?? true,
      utente_operatore_id: cliente.utente_operatore_id,
      utente_professionista_id: cliente.utente_professionista_id,
      studio_id: cliente.studio_id,
      attivo: cliente.attivo ?? true,
      note: cliente.note || "",
      tipologia_cliente: (cliente.tipologia_cliente as any) || "Interno",
      settore_fiscale: cliente.settore_fiscale ?? false,
      settore_lavoro: cliente.settore_lavoro ?? false,
      settore_consulenza: cliente.settore_consulenza ?? false,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingCliente) return;

    try {
      const { error } = await supabase
        .from("tbclienti")
        .delete()
        .eq("id", deletingCliente.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Cliente eliminato con successo",
      });

      setIsDeleteDialogOpen(false);
      setDeletingCliente(null);
      fetchClienti();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getUtenteNome = (utenteId: string | null): string => {
    if (!utenteId) return "-";
    const utente = utenti.find((u) => u.id === utenteId);
    return utente ? `${utente.nome || ""} ${utente.cognome || ""}`.trim() : "-";
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Simplified import logic for now
    toast({
        title: "Info",
        description: "Importazione temporaneamente disabilitata per manutenzione schema",
    });
    e.target.value = "";
  };

  const handleExportExcel = () => {
    const exportData = filteredClienti.map((cliente) => ({
      cod_cliente: cliente.cod_cliente,
      ragione_sociale: cliente.ragione_sociale,
      partita_iva: cliente.partita_iva,
      codice_fiscale: cliente.codice_fiscale,
      tipo_cliente: cliente.tipo_cliente,
      tipo_redditi: cliente.tipo_redditi,
      indirizzo: cliente.indirizzo,
      cap: cliente.cap,
      citta: cliente.citta,
      provincia: cliente.provincia,
      email: cliente.email,
      utente_operatore: getUtenteNome(cliente.utente_operatore_id),
      utente_professionista: getUtenteNome(cliente.utente_professionista_id),
      attivo: cliente.attivo,
      note: cliente.note,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clienti");
    XLSX.writeFile(workbook, `clienti_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <TopNavBar />
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <CardTitle className="text-2xl font-bold">Gestione Clienti</CardTitle>
              </div>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportExcel}
                  className="hidden"
                  id="import-excel"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("import-excel")?.click()}
                >
                  <FileUp className="h-4 w-4 mr-2" />
                  Importa
                </Button>
                <Button variant="outline" onClick={handleExportExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Esporta
                </Button>
                <Button onClick={() => {
                  setEditingCliente(null);
                  setFormData(initialFormData);
                  setIsDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuovo Cliente
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per denominazione, codice, P.IVA o codice fiscale..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codice</TableHead>
                    <TableHead>Denominazione</TableHead>
                    <TableHead>P.IVA</TableHead>
                    <TableHead>Codice Fiscale</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Tipo Redditi</TableHead>
                    {/* WIDENED COLUMN as requested */}
                    <TableHead className="min-w-[200px]">Utente Fiscale</TableHead>
                    <TableHead>Professionista Fiscale</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClienti.map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell>{cliente.cod_cliente}</TableCell>
                      <TableCell className="font-medium">{cliente.ragione_sociale}</TableCell>
                      <TableCell>{cliente.partita_iva}</TableCell>
                      <TableCell>{cliente.codice_fiscale}</TableCell>
                      <TableCell>
                        {cliente.tipo_cliente === "Altro" && <Building2 className="h-4 w-4 inline mr-1" />}
                        {cliente.tipo_cliente === "Persona fisica" && <UserCircle className="h-4 w-4 inline mr-1" />}
                        {cliente.tipo_cliente}
                      </TableCell>
                      <TableCell>{cliente.tipo_redditi || "-"}</TableCell>
                      <TableCell>{getUtenteNome(cliente.utente_operatore_id)}</TableCell>
                      <TableCell>{getUtenteNome(cliente.utente_professionista_id)}</TableCell>
                      <TableCell>{cliente.email || "-"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          cliente.attivo
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {cliente.attivo ? "Attivo" : "Inattivo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(cliente)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingCliente(cliente);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCliente ? "Modifica Cliente" : "Nuovo Cliente"}
              </DialogTitle>
              <DialogDescription>
                {editingCliente
                  ? "Modifica i dati del cliente esistente"
                  : "Inserisci i dati del nuovo cliente"}
              </DialogDescription>
            </DialogHeader>

            <div className="mb-4 border-b">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab("anagrafica")}
                  className={`pb-2 px-4 ${
                    activeTab === "anagrafica"
                      ? "border-b-2 border-primary font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  Anagrafica
                </button>
                <button
                  onClick={() => setActiveTab("scadenzari")}
                  className={`pb-2 px-4 ${
                    activeTab === "scadenzari"
                      ? "border-b-2 border-primary font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  Scadenzari
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {activeTab === "anagrafica" && (
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cod_cliente">Codice Cliente</Label>
                      <Input
                        id="cod_cliente"
                        value={formData.cod_cliente}
                        onChange={(e) =>
                          setFormData({ ...formData, cod_cliente: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="tipologia_cliente">Tipologia</Label>
                      <Select
                        value={formData.tipologia_cliente}
                        onValueChange={(value: any) =>
                          setFormData({ ...formData, tipologia_cliente: value })
                        }
                      >
                        <SelectTrigger id="tipologia_cliente">
                          <SelectValue placeholder="Seleziona tipologia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Interno">Interno</SelectItem>
                          <SelectItem value="Esterno">Esterno</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="ragione_sociale">Denominazione / Ragione Sociale *</Label>
                    <Input
                      id="ragione_sociale"
                      value={formData.ragione_sociale}
                      onChange={(e) =>
                        setFormData({ ...formData, ragione_sociale: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="partita_iva">P.IVA</Label>
                      <Input
                        id="partita_iva"
                        value={formData.partita_iva}
                        onChange={(e) =>
                          setFormData({ ...formData, partita_iva: e.target.value })
                        }
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
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tipo_cliente">Tipo</Label>
                      <Select
                        value={formData.tipo_cliente}
                        onValueChange={(value: any) =>
                          setFormData({ ...formData, tipo_cliente: value })
                        }
                      >
                        <SelectTrigger id="tipo_cliente">
                          <SelectValue placeholder="Seleziona tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Altro">Società / Altro</SelectItem>
                          <SelectItem value="Persona fisica">Persona Fisica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="tipo_redditi">Tipo Redditi</Label>
                      <Select
                        value={formData.tipo_redditi || ""}
                        onValueChange={(value: any) =>
                          setFormData({ ...formData, tipo_redditi: value || null })
                        }
                      >
                        <SelectTrigger id="tipo_redditi">
                          <SelectValue placeholder="Seleziona tipo redditi" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="730">730</SelectItem>
                          <SelectItem value="UPF">UPF</SelectItem>
                          <SelectItem value="USP">USP</SelectItem>
                          <SelectItem value="USC">USC</SelectItem>
                          <SelectItem value="ENC">ENC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2 border p-3 rounded">
                      <Checkbox
                        id="settore_fiscale"
                        checked={formData.settore_fiscale}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, settore_fiscale: !!checked })
                        }
                      />
                      <Label htmlFor="settore_fiscale">Fiscale</Label>
                    </div>
                    <div className="flex items-center space-x-2 border p-3 rounded">
                      <Checkbox
                        id="settore_lavoro"
                        checked={formData.settore_lavoro}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, settore_lavoro: !!checked })
                        }
                      />
                      <Label htmlFor="settore_lavoro">Lavoro</Label>
                    </div>
                    <div className="flex items-center space-x-2 border p-3 rounded">
                      <Checkbox
                        id="settore_consulenza"
                        checked={formData.settore_consulenza}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, settore_consulenza: !!checked })
                        }
                      />
                      <Label htmlFor="settore_consulenza">Consulenza</Label>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="indirizzo">Indirizzo</Label>
                    <Input
                      id="indirizzo"
                      value={formData.indirizzo}
                      onChange={(e) =>
                        setFormData({ ...formData, indirizzo: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="cap">CAP</Label>
                      <Input
                        id="cap"
                        value={formData.cap}
                        onChange={(e) =>
                          setFormData({ ...formData, cap: e.target.value })
                        }
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
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="utente_operatore_id">Utente Fiscale</Label>
                      <Select
                        value={formData.utente_operatore_id || ""}
                        onValueChange={(value) =>
                          setFormData({ ...formData, utente_operatore_id: value || null })
                        }
                      >
                        <SelectTrigger id="utente_operatore_id">
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
                      <Label htmlFor="utente_professionista_id">Professionista Fiscale</Label>
                      <Select
                        value={formData.utente_professionista_id || ""}
                        onValueChange={(value) =>
                          setFormData({ ...formData, utente_professionista_id: value || null })
                        }
                      >
                        <SelectTrigger id="utente_professionista_id">
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
                  </div>

                  <div>
                    <Label htmlFor="note">Note</Label>
                    <Input
                      id="note"
                      value={formData.note}
                      onChange={(e) =>
                        setFormData({ ...formData, note: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="attivo"
                      checked={formData.attivo}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, attivo: !!checked })
                      }
                    />
                    <Label htmlFor="attivo">Cliente Attivo</Label>
                  </div>
                </div>
              )}

              {activeTab === "scadenzari" && (
                <div className="grid gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="flag_iva"
                        checked={formData.flag_iva}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, flag_iva: !!checked })
                        }
                      />
                      <Label htmlFor="flag_iva">IVA</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="flag_esterometro"
                        checked={formData.flag_esterometro}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, flag_esterometro: !!checked })
                        }
                      />
                      <Label htmlFor="flag_esterometro">Esterometro</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="flag_lipe"
                        checked={formData.flag_lipe}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, flag_lipe: !!checked })
                        }
                      />
                      <Label htmlFor="flag_lipe">LIPE</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="flag_bilancio"
                        checked={formData.flag_bilancio}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, flag_bilancio: !!checked })
                        }
                      />
                      <Label htmlFor="flag_bilancio">Bilancio</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="flag_770"
                        checked={formData.flag_770}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, flag_770: !!checked })
                        }
                      />
                      <Label htmlFor="flag_770">Modello 770</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="flag_ccgg"
                        checked={formData.flag_ccgg}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, flag_ccgg: !!checked })
                        }
                      />
                      <Label htmlFor="flag_ccgg">CCGG</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="flag_imu"
                        checked={formData.flag_imu}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, flag_imu: !!checked })
                        }
                      />
                      <Label htmlFor="flag_imu">IMU</Label>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingCliente(null);
                    setFormData(initialFormData);
                  }}
                >
                  Annulla
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Salvataggio..." : editingCliente ? "Aggiorna" : "Crea"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conferma Eliminazione</DialogTitle>
              <DialogDescription>
                Sei sicuro di voler eliminare il cliente "{deletingCliente?.ragione_sociale}"?
                Questa azione non può essere annullata.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeletingCliente(null);
                }}
              >
                Annulla
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Elimina
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
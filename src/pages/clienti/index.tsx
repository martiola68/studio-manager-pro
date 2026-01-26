import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Trash2, Edit, Download, Upload } from "lucide-react";
import { ClienteService } from "@/services/clienteService";
import { Cliente } from "@/types";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";

export default function ClientiPage() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    cod_cliente: "",
    ragione_sociale: "",
    partita_iva: "",
    codice_fiscale: "",
    email: "",
    indirizzo: "",
    citta: "",
    cap: "",
    provincia: "",
    tipo_cliente: "",
    tipologia_cliente: "",
    settore: "",
    attivo: true,
  });

  useEffect(() => {
    loadClienti();
  }, []);

  const loadClienti = async () => {
    try {
      setLoading(true);
      const data = await ClienteService.getAll();
      setClienti(data);
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i clienti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedCliente) {
        await ClienteService.update(selectedCliente.id, formData);
        toast({
          title: "Cliente aggiornato",
          description: "Il cliente è stato aggiornato con successo",
        });
      } else {
        await ClienteService.create(formData);
        toast({
          title: "Cliente creato",
          description: "Il cliente è stato creato con successo",
        });
      }
      setIsDialogOpen(false);
      resetForm();
      loadClienti();
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile salvare il cliente",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!clienteToDelete) return;
    try {
      await ClienteService.delete(clienteToDelete);
      toast({
        title: "Cliente eliminato",
        description: "Il cliente è stato eliminato con successo",
      });
      setIsDeleteDialogOpen(false);
      setClienteToDelete(null);
      loadClienti();
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il cliente",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setFormData({
      cod_cliente: cliente.cod_cliente || "",
      ragione_sociale: cliente.ragione_sociale || "",
      partita_iva: cliente.partita_iva || "",
      codice_fiscale: cliente.codice_fiscale || "",
      email: cliente.email || "",
      indirizzo: cliente.indirizzo || "",
      citta: cliente.citta || "",
      cap: cliente.cap || "",
      provincia: cliente.provincia || "",
      tipo_cliente: cliente.tipo_cliente || "",
      tipologia_cliente: cliente.tipologia_cliente || "",
      settore: cliente.settore || "",
      attivo: cliente.attivo ?? true,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedCliente(null);
    setFormData({
      cod_cliente: "",
      ragione_sociale: "",
      partita_iva: "",
      codice_fiscale: "",
      email: "",
      indirizzo: "",
      citta: "",
      cap: "",
      provincia: "",
      tipo_cliente: "",
      tipologia_cliente: "",
      settore: "",
      attivo: true,
    });
  };

  const handleExport = () => {
    if (clienti.length === 0) {
      toast({
        title: "Nessun dato",
        description: "Non ci sono clienti da esportare",
        variant: "destructive",
      });
      return;
    }

    const dataToExport = clienti.map((cliente) => ({
      "Codice Cliente": cliente.cod_cliente || "",
      "Ragione Sociale": cliente.ragione_sociale || "",
      "Partita IVA": cliente.partita_iva || "",
      "Codice Fiscale": cliente.codice_fiscale || "",
      "Email": cliente.email || "",
      "Indirizzo": cliente.indirizzo || "",
      "Città": cliente.citta || "",
      "CAP": cliente.cap || "",
      "Provincia": cliente.provincia || "",
      "Tipo Cliente": cliente.tipo_cliente || "",
      "Tipologia Cliente": cliente.tipologia_cliente || "",
      "Settore": cliente.settore || "",
      "Attivo": cliente.attivo ? "Sì" : "No",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clienti");
    XLSX.writeFile(wb, "clienti_export.xlsx");

    toast({
      title: "Export completato",
      description: `${clienti.length} clienti esportati con successo`,
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        for (const row of jsonData as any[]) {
          const clienteData = {
            cod_cliente: row["Codice Cliente"] || "",
            ragione_sociale: row["Ragione Sociale"] || "",
            partita_iva: row["Partita IVA"] || "",
            codice_fiscale: row["Codice Fiscale"] || "",
            email: row["Email"] || "",
            indirizzo: row["Indirizzo"] || "",
            citta: row["Città"] || "",
            cap: row["CAP"] || "",
            provincia: row["Provincia"] || "",
            tipo_cliente: row["Tipo Cliente"] || "",
            tipologia_cliente: row["Tipologia Cliente"] || "",
            settore: row["Settore"] || "",
            attivo: row["Attivo"] === "Sì",
          };

          await ClienteService.create(clienteData);
        }

        toast({
          title: "Import completato",
          description: `${jsonData.length} clienti importati con successo`,
        });
        loadClienti();
      } catch (error) {
        toast({
          title: "Errore",
          description: "Impossibile importare i clienti",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredClienti = clienti.filter(
    (cliente) =>
      cliente.ragione_sociale?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.cod_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.partita_iva?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.codice_fiscale?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Gestione Clienti
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestisci i clienti dello studio
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="Cerca clienti..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button onClick={handleExport} variant="outline" className="flex-1 md:flex-none">
                <Download className="h-4 w-4 mr-2" />
                Esporta
              </Button>
              <Button
                variant="outline"
                className="flex-1 md:flex-none"
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Importa
              </Button>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImport}
              />
              <Button
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(true);
                }}
                className="flex-1 md:flex-none"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Cliente
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Caricamento...</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Codice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Ragione Sociale
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      P.IVA
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      C.F.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Indirizzo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Stato
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredClienti.map((cliente) => (
                    <tr
                      key={cliente.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {cliente.cod_cliente}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {cliente.ragione_sociale}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {cliente.email || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {cliente.partita_iva || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {cliente.codice_fiscale || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {cliente.indirizzo
                          ? `${cliente.indirizzo}, ${cliente.citta}`
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            cliente.attivo
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }`}
                        >
                          {cliente.attivo ? "Attivo" : "Inattivo"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
                              setClienteToDelete(cliente.id);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedCliente ? "Modifica Cliente" : "Nuovo Cliente"}
              </DialogTitle>
              <DialogDescription>
                {selectedCliente
                  ? "Modifica i dati del cliente"
                  : "Inserisci i dati del nuovo cliente"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cod_cliente">Codice Cliente *</Label>
                  <Input
                    id="cod_cliente"
                    value={formData.cod_cliente}
                    onChange={(e) =>
                      setFormData({ ...formData, cod_cliente: e.target.value })
                    }
                    required
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
                      <SelectValue placeholder="Seleziona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Persona Fisica">Persona Fisica</SelectItem>
                      <SelectItem value="Persona Giuridica">Persona Giuridica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="ragione_sociale">Ragione Sociale *</Label>
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
                  <Label htmlFor="partita_iva">Partita IVA</Label>
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

              <div>
                <Label htmlFor="indirizzo">Indirizzo *</Label>
                <Input
                  id="indirizzo"
                  value={formData.indirizzo}
                  onChange={(e) =>
                    setFormData({ ...formData, indirizzo: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="citta">Città *</Label>
                  <Input
                    id="citta"
                    value={formData.citta}
                    onChange={(e) =>
                      setFormData({ ...formData, citta: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cap">CAP *</Label>
                  <Input
                    id="cap"
                    value={formData.cap}
                    onChange={(e) =>
                      setFormData({ ...formData, cap: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="provincia">Provincia *</Label>
                  <Input
                    id="provincia"
                    value={formData.provincia}
                    onChange={(e) =>
                      setFormData({ ...formData, provincia: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipologia_cliente">Tipologia Cliente</Label>
                  <Select
                    value={formData.tipologia_cliente}
                    onValueChange={(value) =>
                      setFormData({ ...formData, tipologia_cliente: value })
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
                    value={formData.settore}
                    onValueChange={(value) =>
                      setFormData({ ...formData, settore: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona settore" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fiscale">Fiscale</SelectItem>
                      <SelectItem value="Lavoro">Lavoro</SelectItem>
                      <SelectItem value="Entrambi">Entrambi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="attivo"
                  checked={formData.attivo}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, attivo: checked as boolean })
                  }
                />
                <Label htmlFor="attivo" className="cursor-pointer">
                  Cliente Attivo
                </Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Annulla
                </Button>
                <Button type="submit">
                  {selectedCliente ? "Salva Modifiche" : "Crea Cliente"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare questo cliente? Questa azione non può
                essere annullata.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setClienteToDelete(null)}>
                Annulla
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Elimina</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
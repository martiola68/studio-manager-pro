import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { contattoService } from "@/services/contattoService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Edit, Trash2, Search, Plus, Upload, Download, FileSpreadsheet, AlertCircle, Phone, Mail, Smartphone, User, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import * as XLSX from "xlsx";

type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];

export default function ContattiPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contatti, setContatti] = useState<Contatto[]>([]);
  const [filteredContatti, setFilteredContatti] = useState<Contatto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [letterFilter, setLetterFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContatto, setEditingContatto] = useState<Contatto | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Stato del form con i nuovi campi
  const [formData, setFormData] = useState({
    cognome: "",
    nome: "",
    cell: "",
    tel: "",
    altro_telefono: "",
    email: "",
    pec: "",
    email_secondaria: "",
    email_altro: "",
    contatto_principale: "",
    note: ""
  });

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  useEffect(() => {
    filterContatti();
  }, [contatti, searchQuery, letterFilter]);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      await loadContatti();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadContatti = async () => {
    try {
      setLoading(true);
      const data = await contattoService.getContatti();
      setContatti(data);
    } catch (error) {
      console.error("Errore caricamento contatti:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i contatti",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterContatti = () => {
    let filtered = [...contatti];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.cognome.toLowerCase().includes(query) ||
        (c.nome || "").toLowerCase().includes(query) ||
        (c.email?.toLowerCase() || "").includes(query) ||
        (c.cell?.toLowerCase() || "").includes(query)
      );
    }

    if (letterFilter) {
      filtered = filtered.filter(c =>
        c.cognome.toUpperCase().startsWith(letterFilter)
      );
    }

    setFilteredContatti(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Preparazione dati per salvataggio
      // Nome inviato come stringa vuota se mancante (richiesto dal DB)
      // Altri campi opzionali come null se vuoti
      const dataToSave = {
        cognome: formData.cognome,
        nome: formData.nome || "", 
        cell: formData.cell || null,
        tel: formData.tel || null,
        altro_telefono: formData.altro_telefono || null,
        email: formData.email || null,
        pec: formData.pec || null,
        email_secondaria: formData.email_secondaria || null,
        email_altro: formData.email_altro || null,
        contatto_principale: formData.contatto_principale || null,
        note: formData.note || null
      };

      if (editingContatto) {
        await contattoService.updateContatto(editingContatto.id, dataToSave);
        toast({
          title: "Successo",
          description: "Contatto aggiornato con successo"
        });
      } else {
        await contattoService.createContatto(dataToSave);
        toast({
          title: "Successo",
          description: "Contatto creato con successo"
        });
      }

      setDialogOpen(false);
      resetForm();
      await loadContatti();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il contatto",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (contatto: Contatto) => {
    setEditingContatto(contatto);
    setFormData({
      cognome: contatto.cognome,
      nome: contatto.nome || "",
      cell: contatto.cell || "",
      tel: contatto.tel || "",
      altro_telefono: contatto.altro_telefono || "",
      email: contatto.email || "",
      pec: contatto.pec || "",
      email_secondaria: contatto.email_secondaria || "",
      email_altro: contatto.email_altro || "",
      contatto_principale: contatto.contatto_principale || "",
      note: contatto.note || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo contatto?")) return;

    try {
      await contattoService.deleteContatto(id);
      toast({
        title: "Successo",
        description: "Contatto eliminato con successo"
      });
      await loadContatti();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il contatto",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      cognome: "",
      nome: "",
      cell: "",
      tel: "",
      altro_telefono: "",
      email: "",
      pec: "",
      email_secondaria: "",
      email_altro: "",
      contatto_principale: "",
      note: ""
    });
    setEditingContatto(null);
  };

  const downloadTemplate = () => {
    const headers = [
      "cognome",
      "nome",
      "cell",
      "tel",
      "altro_telefono",
      "email",
      "pec",
      "email_secondaria",
      "email_altro",
      "contatto_principale",
      "note"
    ];

    const exampleRows = [
      [
        "Rossi",
        "Mario",
        "3331234567",
        "0212345678",
        "0298765432",
        "mario.rossi@email.it",
        "mario.rossi@pec.it",
        "mario.privato@email.it",
        "ufficio@email.it",
        "Dott. Bianchi",
        "Contatto importante"
      ]
    ];

    const csvContent = [
      headers.join(","),
      ...exampleRows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "template_importazione_contatti.csv";
    link.click();

    toast({
      title: "Template scaricato",
      description: "Compila il file CSV seguendo l'esempio fornito"
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv") && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        toast({
          title: "Formato non valido",
          description: "Seleziona un file Excel (.xlsx, .xls) o CSV",
          variant: "destructive"
        });
        return;
      }
      setCsvFile(file);
      parseFile(file);
    }
  };

  const parseFile = async (file: File) => {
    try {
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        // Gestione Excel
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          toast({
            title: "File vuoto",
            description: "Il file Excel non contiene dati",
            variant: "destructive"
          });
          return;
        }

        const headers = ["cognome", "nome", "cell", "tel", "altro_telefono", "email", "pec", "email_secondaria", "email_altro", "contatto_principale", "note"];
        const excelRows = jsonData.slice(1).map((row: any[], index) => {
          const rowData: any = { _lineNumber: index + 2 };
          headers.forEach((header, i) => {
            rowData[header] = row[i] ? String(row[i]).trim() : "";
          });
          return rowData;
        });

        setPreviewData(excelRows);
      } else {
        // Gestione CSV
        const text = await file.text();
        const lines = text.split("\n").filter(line => line.trim());
        
        if (lines.length < 2) {
          toast({
            title: "File vuoto",
            description: "Il file CSV non contiene dati",
            variant: "destructive"
          });
          return;
        }

        const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
        const csvRows = lines.slice(1).map((line, index) => {
          const values = line.split(",").map(v => v.trim().replace(/"/g, ""));
          const row: any = { _lineNumber: index + 2 };
          
          headers.forEach((header, i) => {
            row[header] = values[i] || "";
          });
          
          return row;
        });

        setPreviewData(csvRows);
      }
    } catch (error) {
      console.error("Errore lettura file:", error);
      toast({
        title: "Errore",
        description: "Impossibile leggere il file",
        variant: "destructive"
      });
    }
  };

  const validateContatto = (row: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!row.cognome?.trim()) errors.push("Cognome/Denominazione obbligatorio");
    
    // Validazioni di base per email
    [row.email, row.pec, row.email_secondaria, row.email_altro].forEach((email, idx) => {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const fieldNames = ["Email", "PEC", "Email secondaria", "Email altro"];
        errors.push(`${fieldNames[idx]} non valida`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      toast({
        title: "Nessun dato",
        description: "Carica un file CSV prima di importare",
        variant: "destructive"
      });
      return;
    }

    try {
      setImporting(true);
      let imported = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      for (const row of previewData) {
        const validation = validateContatto(row);
        
        if (!validation.valid) {
          errors++;
          errorDetails.push(`Riga ${row._lineNumber}: ${validation.errors.join(", ")}`);
          continue;
        }

        try {
          const contattoData = {
            cognome: row.cognome.trim(),
            nome: row.nome?.trim() || "", // Importante: stringa vuota se manca
            cell: row.cell?.trim() || null,
            tel: row.tel?.trim() || null,
            altro_telefono: row.altro_telefono?.trim() || null,
            email: row.email?.trim() || null,
            pec: row.pec?.trim() || null,
            email_secondaria: row.email_secondaria?.trim() || null,
            email_altro: row.email_altro?.trim() || null,
            contatto_principale: row.contatto_principale?.trim() || null,
            note: row.note?.trim() || null
          };

          await contattoService.createContatto(contattoData);
          imported++;
        } catch (error) {
          errors++;
          errorDetails.push(`Riga ${row._lineNumber}: Errore database`);
          console.error(`Errore importazione riga ${row._lineNumber}:`, error);
        }
      }

      if (errorDetails.length > 0) {
        console.log("Errori importazione:", errorDetails);
      }

      toast({
        title: "Importazione completata",
        description: `✅ Importati: ${imported} | ❌ Errori: ${errors}`,
        duration: 6000
      });

      setImportDialogOpen(false);
      setCsvFile(null);
      setPreviewData([]);
      await loadContatti();

    } catch (error) {
      console.error("Errore importazione:", error);
      toast({
        title: "Errore",
        description: "Errore durante l'importazione",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const getInitials = (nome: string, cognome: string): string => {
    const n = nome || "";
    const c = cognome || "";
    return `${n.charAt(0)}${c.charAt(0)}`.toUpperCase();
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

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Rubrica Contatti</h1>
            <p className="text-sm md:text-base text-gray-500 mt-1">Gestisci i contatti della rubrica</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 w-full sm:w-auto">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Importa Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
                <DialogHeader>
                  <DialogTitle>Importazione Contatti da Excel/CSV</DialogTitle>
                  <DialogDescription>
                    Carica un file Excel (.xlsx, .xls) o CSV per importare più contatti contemporaneamente
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-900">
                        <p className="font-semibold mb-2">📋 Come funziona:</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Scarica il template CSV aggiornato</li>
                          <li>Compila il file seguendo l'esempio</li>
                          <li>Carica il file compilato</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={downloadTemplate}
                    variant="outline"
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Scarica Template CSV
                  </Button>

                  <div className="space-y-2">
                    <Label htmlFor="csv-file">Carica File Excel/CSV</Label>
                    <Input
                      id="csv-file"
                      type="file"
                      accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                  </div>

                  {previewData.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <Button
                          onClick={handleImport}
                          disabled={importing}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {importing ? "Importazione..." : `Importa ${previewData.length} Contatti`}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuovo Contatto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
                <DialogHeader>
                  <DialogTitle>
                    {editingContatto ? "Modifica Contatto" : "Nuovo Contatto"}
                  </DialogTitle>
                  <DialogDescription>
                    Inserisci i dati del contatto. I campi contrassegnati con * sono obbligatori.
                  </DialogDescription>
                </DialogHeader>
                
                {/* FORM TABELLARE - 2 COLONNE */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Riga 1: Cognome (1) e Nome (2) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cognome">Cognome/Denominazione *</Label>
                      <Input
                        id="cognome"
                        value={formData.cognome}
                        onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                        required
                        placeholder="Es. Rossi o Nome Azienda"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome (facoltativo)</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        placeholder="Es. Mario"
                      />
                    </div>
                  </div>

                  {/* Riga 2: Cellulare (3) e Telefono (4) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cell">Cellulare</Label>
                      <Input
                        id="cell"
                        type="tel"
                        value={formData.cell}
                        onChange={(e) => setFormData({ ...formData, cell: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tel">Telefono</Label>
                      <Input
                        id="tel"
                        type="tel"
                        value={formData.tel}
                        onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Riga 3: Altro telefono (5) e Email (6) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="altro_telefono">Altro Telefono</Label>
                      <Input
                        id="altro_telefono"
                        type="tel"
                        value={formData.altro_telefono}
                        onChange={(e) => setFormData({ ...formData, altro_telefono: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Riga 4: PEC (7) e Email Secondaria (8) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pec">PEC</Label>
                      <Input
                        id="pec"
                        type="email"
                        value={formData.pec}
                        onChange={(e) => setFormData({ ...formData, pec: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email_secondaria">Email Secondaria</Label>
                      <Input
                        id="email_secondaria"
                        type="email"
                        value={formData.email_secondaria}
                        onChange={(e) => setFormData({ ...formData, email_secondaria: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Riga 5: Email Altro (9) e Contatto Principale (10) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email_altro">Email Altro</Label>
                      <Input
                        id="email_altro"
                        type="email"
                        value={formData.email_altro}
                        onChange={(e) => setFormData({ ...formData, email_altro: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contatto_principale">Contatto Principale</Label>
                      <Input
                        id="contatto_principale"
                        value={formData.contatto_principale}
                        onChange={(e) => setFormData({ ...formData, contatto_principale: e.target.value })}
                        placeholder="Es. Segretaria, Responsabile..."
                      />
                    </div>
                  </div>

                  {/* Riga 6: Note (11) - Full width */}
                  <div className="space-y-2">
                    <Label htmlFor="note">Note</Label>
                    <Textarea
                      id="note"
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t mt-4">
                    <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                      {editingContatto ? "Aggiorna" : "Salva"} Contatto
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setDialogOpen(false)}
                      className="w-full sm:w-auto"
                    >
                      Annulla
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Ricerca e Filtri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cerca per nome, cognome, email o telefono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={letterFilter === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setLetterFilter("")}
              className="min-w-[44px]"
            >
              Tutti
            </Button>
            {alphabet.map(letter => (
              <Button
                key={letter}
                variant={letterFilter === letter ? "default" : "outline"}
                size="sm"
                onClick={() => setLetterFilter(letter)}
                className="w-10 h-10"
              >
                {letter}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filteredContatti.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <UserCircle className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">Nessun contatto trovato</p>
              <p className="text-gray-400 text-sm mt-2">
                {searchQuery || letterFilter ? "Prova a modificare i filtri di ricerca" : "Inizia aggiungendo il tuo primo contatto"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredContatti.map((contatto) => (
            <Card key={contatto.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg md:text-xl">
                      {getInitials(contatto.nome || "", contatto.cognome)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 truncate">
                          {contatto.cognome} {contatto.nome}
                        </h3>
                        {contatto.contatto_principale && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 mt-1">
                            <User className="h-3 w-3 mr-1" />
                            {contatto.contatto_principale}
                          </Badge>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(contatto)}
                          className="h-10 w-10"
                          title="Modifica"
                        >
                          <Edit className="h-5 w-5 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(contatto.id)}
                          className="h-10 w-10 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Elimina"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {contatto.email && (
                        <a 
                          href={`mailto:${contatto.email}`}
                          className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors group"
                        >
                          <Mail className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600" />
                          <span className="truncate">{contatto.email}</span>
                        </a>
                      )}

                      {contatto.pec && (
                        <a 
                          href={`mailto:${contatto.pec}`}
                          className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors group"
                        >
                          <Mail className="h-4 w-4 flex-shrink-0 text-amber-500 group-hover:text-blue-600" />
                          <span className="truncate">PEC: {contatto.pec}</span>
                        </a>
                      )}

                      {contatto.email_secondaria && (
                        <a 
                          href={`mailto:${contatto.email_secondaria}`}
                          className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors group"
                        >
                          <Mail className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600" />
                          <span className="truncate">{contatto.email_secondaria}</span>
                        </a>
                      )}

                      {contatto.cell && (
                        <a 
                          href={`tel:${contatto.cell}`}
                          className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-600 transition-colors group"
                        >
                          <Smartphone className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-green-600" />
                          <span>{contatto.cell}</span>
                        </a>
                      )}
                      
                      {contatto.tel && (
                        <a 
                          href={`tel:${contatto.tel}`}
                          className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-600 transition-colors group"
                        >
                          <Phone className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-green-600" />
                          <span>{contatto.tel}</span>
                        </a>
                      )}
                    </div>

                    {contatto.note && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-gray-600 line-clamp-2">
                          <span className="font-semibold">Note:</span> {contatto.note}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
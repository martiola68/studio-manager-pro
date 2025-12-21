import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { contattoService } from "@/services/contattoService";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Edit, Trash2, Search, Plus, Upload, Download, FileSpreadsheet, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

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

  const [formData, setFormData] = useState({
    nome: "",
    cognome: "",
    email: "",
    cell: "",
    tel: "",
    note: "",
    cassetto_fiscale: false,
    utente: "",
    password: "",
    pin: "",
    password_iniziale: ""
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
        c.nome.toLowerCase().includes(query) ||
        c.cognome.toLowerCase().includes(query) ||
        (c.email?.toLowerCase() || "").includes(query)
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
      if (editingContatto) {
        await contattoService.updateContatto(editingContatto.id, formData);
        toast({
          title: "Successo",
          description: "Contatto aggiornato con successo"
        });
      } else {
        await contattoService.createContatto(formData);
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
      nome: contatto.nome,
      cognome: contatto.cognome,
      email: contatto.email || "",
      cell: contatto.cell || "",
      tel: contatto.tel || "",
      note: contatto.note || "",
      cassetto_fiscale: contatto.cassetto_fiscale || false,
      utente: contatto.utente || "",
      password: contatto.password || "",
      pin: contatto.pin || "",
      password_iniziale: contatto.password_iniziale || ""
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
      nome: "",
      cognome: "",
      email: "",
      cell: "",
      tel: "",
      note: "",
      cassetto_fiscale: false,
      utente: "",
      password: "",
      pin: "",
      password_iniziale: ""
    });
    setEditingContatto(null);
  };

  const downloadTemplate = () => {
    const headers = [
      "nome",
      "cognome",
      "email",
      "cell",
      "tel",
      "note",
      "cassetto_fiscale",
      "utente",
      "password",
      "pin",
      "password_iniziale"
    ];

    const exampleRows = [
      [
        "Mario",
        "Rossi",
        "mario.rossi@email.it",
        "3331234567",
        "0612345678",
        "Contatto principale",
        "true",
        "RSSMRA80A01H501Z",
        "password123",
        "12345",
        "temp123"
      ],
      [
        "Laura",
        "Bianchi",
        "laura.bianchi@email.it",
        "3337654321",
        "",
        "",
        "false",
        "",
        "",
        "",
        ""
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
      if (!file.name.endsWith(".csv")) {
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

  const parseCSV = async (file: File) => {
    try {
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
      const data = lines.slice(1).map((line, index) => {
        const values = line.split(",").map(v => v.trim().replace(/"/g, ""));
        const row: any = { _lineNumber: index + 2 };
        
        headers.forEach((header, i) => {
          row[header] = values[i] || "";
        });
        
        return row;
      });

      setPreviewData(data);
    } catch (error) {
      console.error("Errore parsing CSV:", error);
      toast({
        title: "Errore",
        description: "Impossibile leggere il file CSV",
        variant: "destructive"
      });
    }
  };

  const validateContatto = (row: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!row.nome?.trim()) errors.push("Nome obbligatorio");
    if (!row.cognome?.trim()) errors.push("Cognome obbligatorio");
    
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push("Email non valida");
    }

    if (row.cell && !/^\d{9,13}$/.test(row.cell.replace(/\s/g, ""))) {
      errors.push("Cellulare non valido");
    }

    if (row.tel && !/^\d{9,13}$/.test(row.tel.replace(/\s/g, ""))) {
      errors.push("Telefono non valido");
    }

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
            nome: row.nome.trim(),
            cognome: row.cognome.trim(),
            email: row.email?.trim() || null,
            cell: row.cell?.trim() || null,
            tel: row.tel?.trim() || null,
            note: row.note?.trim() || null,
            cassetto_fiscale: row.cassetto_fiscale?.toLowerCase() === "true" || false,
            utente: row.utente?.trim() || null,
            password: row.password?.trim() || null,
            pin: row.pin?.trim() || null,
            password_iniziale: row.password_iniziale?.trim() || null
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
                <h1 className="text-3xl font-bold text-gray-900">Rubrica Contatti</h1>
                <p className="text-gray-500 mt-1">Gestisci i contatti della rubrica</p>
              </div>
              <div className="flex gap-3">
                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                      <Upload className="h-4 w-4 mr-2" />
                      Importa CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Importazione Contatti da CSV</DialogTitle>
                      <DialogDescription>
                        Carica un file CSV per importare più contatti contemporaneamente
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <FileSpreadsheet className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-blue-900">
                            <p className="font-semibold mb-2">📋 Come funziona:</p>
                            <ol className="list-decimal list-inside space-y-1">
                              <li>Scarica il template CSV cliccando il pulsante qui sotto</li>
                              <li>Compila il file seguendo l'esempio fornito</li>
                              <li>Carica il file compilato</li>
                              <li>Verifica l'anteprima e conferma l'importazione</li>
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
                        <Label htmlFor="csv-file">Carica File CSV</Label>
                        <Input
                          id="csv-file"
                          type="file"
                          accept=".csv"
                          onChange={handleFileChange}
                          className="cursor-pointer"
                        />
                      </div>

                      {previewData.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Anteprima Dati ({previewData.length} righe)</h3>
                            <Badge variant="secondary">{csvFile?.name}</Badge>
                          </div>

                          <div className="border rounded-lg overflow-hidden">
                            <div className="overflow-x-auto max-h-96">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Cognome</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Cell</TableHead>
                                    <TableHead>Tel</TableHead>
                                    <TableHead>Cassetto</TableHead>
                                    <TableHead>Stato</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {previewData.slice(0, 10).map((row, index) => {
                                    const validation = validateContatto(row);
                                    return (
                                      <TableRow key={index} className={!validation.valid ? "bg-red-50" : ""}>
                                        <TableCell className="font-mono text-xs">{row._lineNumber}</TableCell>
                                        <TableCell>{row.nome || "-"}</TableCell>
                                        <TableCell>{row.cognome || "-"}</TableCell>
                                        <TableCell className="text-xs">{row.email || "-"}</TableCell>
                                        <TableCell className="text-xs">{row.cell || "-"}</TableCell>
                                        <TableCell className="text-xs">{row.tel || "-"}</TableCell>
                                        <TableCell>
                                          {row.cassetto_fiscale?.toLowerCase() === "true" ? (
                                            <Badge variant="default" className="text-xs">Sì</Badge>
                                          ) : (
                                            <Badge variant="secondary" className="text-xs">No</Badge>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {validation.valid ? (
                                            <Badge variant="default" className="bg-green-600 text-xs">✓ OK</Badge>
                                          ) : (
                                            <Badge variant="destructive" className="text-xs">
                                              <AlertCircle className="h-3 w-3 mr-1" />
                                              Errore
                                            </Badge>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>

                          {previewData.length > 10 && (
                            <p className="text-sm text-gray-500 text-center">
                              ... e altri {previewData.length - 10} contatti
                            </p>
                          )}

                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                              <div className="text-sm text-amber-900">
                                <p className="font-semibold mb-1">⚠️ Attenzione:</p>
                                <ul className="list-disc list-inside space-y-1">
                                  <li>Le righe con errori di validazione verranno saltate</li>
                                  <li>I contatti validi verranno importati</li>
                                  <li>Riceverai un report finale con successi ed errori</li>
                                </ul>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-3 pt-4">
                            <Button
                              onClick={handleImport}
                              disabled={importing}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              {importing ? (
                                <>
                                  <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                  Importazione in corso...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Importa {previewData.length} Contatti
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setImportDialogOpen(false);
                                setCsvFile(null);
                                setPreviewData([]);
                              }}
                              disabled={importing}
                            >
                              Annulla
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
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Nuovo Contatto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingContatto ? "Modifica Contatto" : "Nuovo Contatto"}
                      </DialogTitle>
                      <DialogDescription>
                        Inserisci i dati del contatto
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="nome">Nome *</Label>
                          <Input
                            id="nome"
                            value={formData.nome}
                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cognome">Cognome *</Label>
                          <Input
                            id="cognome"
                            value={formData.cognome}
                            onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                            required
                          />
                        </div>
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

                      <div className="grid grid-cols-2 gap-4">
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

                      <div className="space-y-2">
                        <Label htmlFor="note">Note</Label>
                        <Textarea
                          id="note"
                          value={formData.note}
                          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                          rows={3}
                        />
                      </div>

                      <div className="border-t pt-4">
                        <h3 className="font-semibold mb-3">Credenziali Cassetto Fiscale</h3>
                        
                        <div className="flex items-center space-x-2 mb-4">
                          <input
                            type="checkbox"
                            id="cassetto_fiscale"
                            checked={formData.cassetto_fiscale}
                            onChange={(e) => setFormData({ ...formData, cassetto_fiscale: e.target.checked })}
                            className="rounded"
                          />
                          <Label htmlFor="cassetto_fiscale" className="cursor-pointer">Ha Cassetto Fiscale</Label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="utente">Utente</Label>
                            <Input
                              id="utente"
                              value={formData.utente}
                              onChange={(e) => setFormData({ ...formData, utente: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="pin">PIN</Label>
                            <Input
                              id="pin"
                              value={formData.pin}
                              onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                              id="password"
                              type="password"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="password_iniziale">Password Iniziale</Label>
                            <Input
                              id="password_iniziale"
                              value={formData.password_iniziale}
                              onChange={(e) => setFormData({ ...formData, password_iniziale: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Button type="submit" className="flex-1">
                          {editingContatto ? "Aggiorna" : "Crea"} Contatto
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
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Cerca per nome, cognome o email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={letterFilter === "" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLetterFilter("")}
                    >
                      Tutti
                    </Button>
                    {alphabet.map(letter => (
                      <Button
                        key={letter}
                        variant={letterFilter === letter ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLetterFilter(letter)}
                        className="w-10"
                      >
                        {letter}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cognome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Cellulare</TableHead>
                      <TableHead>Telefono</TableHead>
                      <TableHead>Cassetto Fiscale</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContatti.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          Nessun contatto trovato
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContatti.map((contatto) => (
                        <TableRow key={contatto.id}>
                          <TableCell className="font-medium">{contatto.nome}</TableCell>
                          <TableCell>{contatto.cognome}</TableCell>
                          <TableCell>{contatto.email || "-"}</TableCell>
                          <TableCell>{contatto.cell || "-"}</TableCell>
                          <TableCell>{contatto.tel || "-"}</TableCell>
                          <TableCell>
                            {contatto.cassetto_fiscale ? (
                              <Badge variant="default">Sì</Badge>
                            ) : (
                              <Badge variant="secondary">No</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(contatto)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(contatto.id)}
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
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { contattoService } from "@/services/contattoService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Edit, Trash2, Search, Plus, Upload, Download, FileSpreadsheet, AlertCircle, Phone, Mail, Smartphone, User } from "lucide-react";
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

  const getInitials = (nome: string, cognome: string): string => {
    return `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase();
  };

  const contattiConCassetto = contatti.filter(c => c.cassetto_fiscale).length;

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
      {/* Header Mobile Responsive */}
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
                  <Upload className="h-4 w-4 mr-2" />
                  Importa CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
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

                      <div className="flex flex-col sm:flex-row gap-3 pt-4">
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
                          className="w-full sm:w-auto"
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
                <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuovo Contatto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
                <DialogHeader>
                  <DialogTitle>
                    {editingContatto ? "Modifica Contatto" : "Nuovo Contatto"}
                  </DialogTitle>
                  <DialogDescription>
                    Inserisci i dati del contatto
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        className="rounded w-5 h-5"
                      />
                      <Label htmlFor="cassetto_fiscale" className="cursor-pointer">Ha Cassetto Fiscale</Label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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

                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button type="submit" className="flex-1">
                      {editingContatto ? "Aggiorna" : "Crea"} Contatto
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              Totale Contatti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{contatti.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Con Cassetto Fiscale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{contattiConCassetto}</div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Percentuale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {contatti.length > 0 ? Math.round((contattiConCassetto / contatti.length) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
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

      {/* Contact Cards List */}
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
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg md:text-xl">
                      {getInitials(contatto.nome, contatto.cognome)}
                    </div>
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 truncate">
                          {contatto.nome} {contatto.cognome}
                        </h3>
                        {contatto.cassetto_fiscale && (
                          <Badge variant="default" className="mt-1">
                            <FileSpreadsheet className="h-3 w-3 mr-1" />
                            Cassetto Fiscale
                          </Badge>
                        )}
                      </div>

                      {/* Action Buttons */}
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

                    {/* Contact Info */}
                    <div className="space-y-2">
                      {contatto.email && (
                        <a 
                          href={`mailto:${contatto.email}`}
                          className="flex items-center gap-2 text-sm md:text-base text-gray-700 hover:text-blue-600 transition-colors group"
                        >
                          <Mail className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600" />
                          <span className="truncate">{contatto.email}</span>
                        </a>
                      )}
                      
                      {contatto.cell && (
                        <a 
                          href={`tel:${contatto.cell}`}
                          className="flex items-center gap-2 text-sm md:text-base text-gray-700 hover:text-green-600 transition-colors group"
                        >
                          <Smartphone className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-green-600" />
                          <span>{contatto.cell}</span>
                        </a>
                      )}
                      
                      {contatto.tel && (
                        <a 
                          href={`tel:${contatto.tel}`}
                          className="flex items-center gap-2 text-sm md:text-base text-gray-700 hover:text-green-600 transition-colors group"
                        >
                          <Phone className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-green-600" />
                          <span>{contatto.tel}</span>
                        </a>
                      )}

                      {contatto.note && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-gray-600 line-clamp-2">
                            <span className="font-semibold">Note:</span> {contatto.note}
                          </p>
                        </div>
                      )}
                    </div>
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
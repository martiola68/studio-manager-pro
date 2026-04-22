import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabase/client";
import { contattoService } from "@/services/contattoService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  UserCircle,
  Edit,
  Trash2,
  Search,
  Plus,
  Download,
  FileSpreadsheet,
  Phone,
  Mail,
  Smartphone,
  User,
  Lock,
  Unlock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import ExcelJS from "exceljs";

import {
  isEncryptionEnabled,
  isEncryptionLocked,
  encryptContattoSensitiveData,
  decryptContattoSensitiveData,
  lockCassetti,
} from "@/services/encryptionService";
import { useMasterPasswordGate } from "@/hooks/useMasterPasswordGate";
import { MasterPasswordDialog } from "@/components/security/MasterPasswordDialog";

type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];

type FormDataState = {
  cognome: string;
  nome: string;
  cell: string;
  tel: string;
  altro_telefono: string;
  email: string;
  pec: string;
  email_secondaria: string;
  email_altro: string;
  contatto_principale: string;
  note: string;
};

const initialFormData: FormDataState = {
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
  note: "",
};

export default function ContattiPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [studioId, setStudioId] = useState("");
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [encryptionLockedState, setEncryptionLockedState] = useState(true);

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

  const [formData, setFormData] = useState<FormDataState>(initialFormData);

  const masterPasswordGate = useMasterPasswordGate({
    studioId,
    onUnlocked: async () => {
      setEncryptionLockedState(false);
      await loadContatti();
    },
  });

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  useEffect(() => {
    void checkAuthAndLoad();
  }, []);

  useEffect(() => {
    filterContatti();
  }, [contatti, searchQuery, letterFilter]);

  const resolveStudioId = async (): Promise<string> => {
    const supabase = getSupabaseClient();

    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("studio_id");
      if (cached) {
        return cached;
      }
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;
    if (!session?.user?.email) {
      throw new Error("Utente non autenticato");
    }

    const { data, error: utenteError } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("email", session.user.email)
      .single();

    if (utenteError) throw utenteError;

    const sid = data?.studio_id ? String(data.studio_id) : "";
    if (!sid) {
      throw new Error("studio_id non disponibile");
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("studio_id", sid);
    }

    return sid;
  };

  const hydrateContatti = async (rows: Contatto[], enabled: boolean): Promise<Contatto[]> => {
    if (!enabled || isEncryptionLocked()) {
      return rows;
    }

    const decrypted = await Promise.all(
      rows.map(async (c) => {
        try {
          return {
            ...c,
            ...(await decryptContattoSensitiveData({
              cell: c.cell,
              tel: c.tel,
              altro_telefono: c.altro_telefono,
              email: c.email,
              pec: c.pec,
              email_secondaria: c.email_secondaria,
              email_altro: c.email_altro,
              note: c.note,
            })),
          } as Contatto;
        } catch {
          return c;
        }
      })
    );

    return decrypted;
  };

  const checkAuthAndLoad = async () => {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (!session) {
        router.push("/login");
        return;
      }

      const sid = await resolveStudioId();
      setStudioId(sid);

      const enabled = await isEncryptionEnabled(sid);
      setEncryptionEnabled(enabled);
      setEncryptionLockedState(isEncryptionLocked());

      await loadContatti(sid, enabled);
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadContatti = async (
    studioIdOverride?: string,
    encryptionEnabledOverride?: boolean
  ) => {
    try {
      setLoading(true);

      const sid = studioIdOverride || studioId;
      const enabled =
        typeof encryptionEnabledOverride === "boolean"
          ? encryptionEnabledOverride
          : sid
          ? await isEncryptionEnabled(sid)
          : false;

      setEncryptionEnabled(enabled);
      setEncryptionLockedState(isEncryptionLocked());

      const data = await contattoService.getContatti();
      const hydrated = await hydrateContatti(data, enabled);
      setContatti(hydrated);
    } catch (error) {
      console.error("Errore caricamento contatti:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i contatti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterContatti = () => {
    let filtered = [...contatti];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => {
        const cognome = (c.cognome || "").toLowerCase();
        const nome = (c.nome || "").toLowerCase();
        const email = (c.email || "").toLowerCase();
        const cell = (c.cell || "").toLowerCase();

        return (
          cognome.includes(query) ||
          nome.includes(query) ||
          email.includes(query) ||
          cell.includes(query)
        );
      });
    }

    if (letterFilter) {
      filtered = filtered.filter((c) =>
        (c.cognome || "").toUpperCase().startsWith(letterFilter)
      );
    }

    setFilteredContatti(filtered);
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingContatto(null);
  };

  const handleOpenNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (contatto: Contatto) => {
    setEditingContatto(contatto);
    setFormData({
      cognome: contatto.cognome || "",
      nome: contatto.nome || "",
      cell: contatto.cell || "",
      tel: contatto.tel || "",
      altro_telefono: contatto.altro_telefono || "",
      email: contatto.email || "",
      pec: contatto.pec || "",
      email_secondaria: contatto.email_secondaria || "",
      email_altro: contatto.email_altro || "",
      contatto_principale: contatto.contatto_principale || "",
      note: contatto.note || "",
    });
    setDialogOpen(true);
  };

  const handleEdit = async (contatto: Contatto) => {
    if (encryptionEnabled && isEncryptionLocked()) {
      masterPasswordGate.requireUnlock(async () => {
        await loadContatti();
        const fresh = await contattoService.getContatti();
        const enabled = studioId ? await isEncryptionEnabled(studioId) : false;
        const hydrated = await hydrateContatti(fresh, enabled);
        const found = hydrated.find((x) => x.id === contatto.id);

        if (found) {
          openEditDialog(found);
        }
      });
      return;
    }

    openEditDialog(contatto);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const run = async () => {
      try {
        let dataToSave: any = {
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
          note: formData.note || null,
        };

        if (encryptionEnabled) {
          const encrypted = await encryptContattoSensitiveData({
            cell: dataToSave.cell,
            tel: dataToSave.tel,
            altro_telefono: dataToSave.altro_telefono,
            email: dataToSave.email,
            pec: dataToSave.pec,
            email_secondaria: dataToSave.email_secondaria,
            email_altro: dataToSave.email_altro,
            note: dataToSave.note,
          });

          dataToSave = {
            ...dataToSave,
            ...encrypted,
          };
        }

        if (editingContatto) {
          await contattoService.updateContatto(editingContatto.id, dataToSave);
          toast({
            title: "Successo",
            description: "Contatto aggiornato con successo",
          });
        } else {
          await contattoService.createContatto(dataToSave);
          toast({
            title: "Successo",
            description: "Contatto creato con successo",
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
          variant: "destructive",
        });
      }
    };

    if (encryptionEnabled && isEncryptionLocked()) {
      masterPasswordGate.requireUnlock(run);
      return;
    }

    await run();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo contatto?")) return;

    try {
      await contattoService.deleteContatto(id);
      toast({
        title: "Successo",
        description: "Contatto eliminato con successo",
      });
      await loadContatti();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il contatto",
        variant: "destructive",
      });
    }
  };

  const handleLock = async () => {
    lockCassetti();
    setEncryptionLockedState(true);
    await loadContatti();
    toast({
      title: "Bloccato",
      description: "Dati sensibili bloccati",
    });
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
      "note",
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
        "Contatto importante",
      ],
    ];

    const csvContent = [
      headers.join(","),
      ...exampleRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "template_importazione_contatti.csv";
    link.click();

    toast({
      title: "Template scaricato",
      description: "Compila il file CSV seguendo l'esempio fornito",
    });
  };

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const lowerName = file.name.toLowerCase();

  if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".xlsx")) {
    toast({
      title: "Formato non valido",
      description: "Seleziona un file Excel (.xlsx) o CSV",
      variant: "destructive",
    });
    return;
  }

  setCsvFile(file);
  void parseFile(file);
};

 const parseFile = async (file: File) => {
  try {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".xlsx")) {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];

      if (!worksheet || worksheet.rowCount < 2) {
        toast({
          title: "File vuoto",
          description: "Il file Excel non contiene dati",
          variant: "destructive",
        });
        return;
      }

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
        "note",
      ];

      const excelRows: any[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const values = Array.isArray(row.values) ? row.values : [];
        const rowData: any = { _lineNumber: rowNumber };

        headers.forEach((header, i) => {
          const cellValue = values[i + 1];
          rowData[header] =
            cellValue !== null && cellValue !== undefined
              ? String(cellValue).trim()
              : "";
        });

        const hasContent = headers.some((header) => rowData[header]);
        if (hasContent) {
          excelRows.push(rowData);
        }
      });

      if (excelRows.length === 0) {
        toast({
          title: "File vuoto",
          description: "Il file Excel non contiene righe valide",
          variant: "destructive",
        });
        return;
      }

      setPreviewData(excelRows);
      return;
    }

    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      toast({
        title: "File vuoto",
        description: "Il file CSV non contiene dati",
        variant: "destructive",
      });
      return;
    }

    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().replace(/"/g, ""));

    const csvRows = lines.slice(1).map((line, index) => {
      const values = line
        .split(",")
        .map((v) => v.trim().replace(/"/g, ""));

      const row: any = { _lineNumber: index + 2 };
      headers.forEach((header, i) => {
        row[header] = values[i] || "";
      });
      return row;
    });

    setPreviewData(csvRows);
  } catch (error) {
    console.error("Errore lettura file:", error);
    toast({
      title: "Errore",
      description: "Impossibile leggere il file",
      variant: "destructive",
    });
  }
};

  const validateContatto = (row: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!row.cognome?.trim()) {
      errors.push("Cognome/Denominazione obbligatorio");
    }

    [row.email, row.pec, row.email_secondaria, row.email_altro].forEach(
      (email, idx) => {
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          const fieldNames = ["Email", "PEC", "Email secondaria", "Email altro"];
          errors.push(`${fieldNames[idx]} non valida`);
        }
      }
    );

    return { valid: errors.length === 0, errors };
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      toast({
        title: "Nessun dato",
        description: "Carica un file CSV prima di importare",
        variant: "destructive",
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
          errorDetails.push(
            `Riga ${row._lineNumber}: ${validation.errors.join(", ")}`
          );
          continue;
        }

        try {
          let contattoData: any = {
            cognome: row.cognome.trim(),
            nome: row.nome?.trim() || "",
            cell: row.cell?.trim() || null,
            tel: row.tel?.trim() || null,
            altro_telefono: row.altro_telefono?.trim() || null,
            email: row.email?.trim() || null,
            pec: row.pec?.trim() || null,
            email_secondaria: row.email_secondaria?.trim() || null,
            email_altro: row.email_altro?.trim() || null,
            contatto_principale: row.contatto_principale?.trim() || null,
            note: row.note?.trim() || null,
          };

          if (encryptionEnabled) {
            const encrypted = await encryptContattoSensitiveData({
              cell: contattoData.cell,
              tel: contattoData.tel,
              altro_telefono: contattoData.altro_telefono,
              email: contattoData.email,
              pec: contattoData.pec,
              email_secondaria: contattoData.email_secondaria,
              email_altro: contattoData.email_altro,
              note: contattoData.note,
            });

            contattoData = {
              ...contattoData,
              ...encrypted,
            };
          }

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
        duration: 6000,
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
        variant: "destructive",
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              Rubrica Contatti
            </h1>
            <p className="mt-1 text-sm text-gray-500 md:text-base">
              Gestisci i contatti della rubrica
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            {encryptionEnabled && (
              <Button
                variant="outline"
                onClick={() => {
                  if (encryptionLockedState) {
                    masterPasswordGate.setOpen(true);
                  } else {
                    void handleLock();
                  }
                }}
                className={
                  encryptionLockedState
                    ? "border-orange-600 text-orange-600"
                    : "border-green-600 text-green-600"
                }
              >
                {encryptionLockedState ? (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Sblocca Dati
                  </>
                ) : (
                  <>
                    <Unlock className="mr-2 h-4 w-4" />
                    Blocca Dati
                  </>
                )}
              </Button>
            )}

            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full border-green-600 text-green-600 hover:bg-green-50 sm:w-auto"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Importa Excel
                </Button>
              </DialogTrigger>

              <DialogContent className="mx-4 max-h-[90vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Importazione Contatti da Excel .xlsx / CSV</DialogTitle>
                  <DialogDescription>
                    Carica un file Excel (.xlsx) o CSV per importare più
                    contatti contemporaneamente
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                      <FileSpreadsheet className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                      <div className="text-sm text-blue-900">
                        <p className="mb-2 font-semibold">📋 Come funziona:</p>
                        <ol className="list-inside list-decimal space-y-1">
                          <li>Scarica il template CSV aggiornato</li>
                          <li>Compila il file seguendo l'esempio</li>
                          <li>Carica il file compilato</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <Button onClick={downloadTemplate} variant="outline" className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Scarica Template CSV
                  </Button>

                  <div className="space-y-2">
                    <Label htmlFor="csv-file">Carica File Excel .xlsx / CSV</Label>
                    <Input
                      id="csv-file"
                      type="file"
                      accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                  </div>

                  {previewData.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                        <Button
                          onClick={handleImport}
                          disabled={importing}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {importing
                            ? "Importazione..."
                            : `Importa ${previewData.length} Contatti`}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto"
                  onClick={handleOpenNew}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nuovo Contatto
                </Button>
              </DialogTrigger>

              <DialogContent className="mx-4 max-h-[90vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingContatto ? "Modifica Contatto" : "Nuovo Contatto"}
                  </DialogTitle>
                  <DialogDescription>
                    Inserisci i dati del contatto. I campi contrassegnati con *
                    sono obbligatori.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cognome">Cognome/Denominazione *</Label>
                      <Input
                        id="cognome"
                        value={formData.cognome}
                        onChange={(e) =>
                          setFormData({ ...formData, cognome: e.target.value })
                        }
                        required
                        placeholder="Es. Rossi o Nome Azienda"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome (facoltativo)</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) =>
                          setFormData({ ...formData, nome: e.target.value })
                        }
                        placeholder="Es. Mario"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cell">Cellulare</Label>
                      <Input
                        id="cell"
                        type="tel"
                        value={formData.cell}
                        onChange={(e) =>
                          setFormData({ ...formData, cell: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tel">Telefono</Label>
                      <Input
                        id="tel"
                        type="tel"
                        value={formData.tel}
                        onChange={(e) =>
                          setFormData({ ...formData, tel: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="altro_telefono">Altro Telefono</Label>
                      <Input
                        id="altro_telefono"
                        type="tel"
                        value={formData.altro_telefono}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            altro_telefono: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
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
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="pec">PEC</Label>
                      <Input
                        id="pec"
                        type="email"
                        value={formData.pec}
                        onChange={(e) =>
                          setFormData({ ...formData, pec: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email_secondaria">Email Secondaria</Label>
                      <Input
                        id="email_secondaria"
                        type="email"
                        value={formData.email_secondaria}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            email_secondaria: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email_altro">Email Altro</Label>
                      <Input
                        id="email_altro"
                        type="email"
                        value={formData.email_altro}
                        onChange={(e) =>
                          setFormData({ ...formData, email_altro: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contatto_principale">
                        Contatto Principale
                      </Label>
                      <Input
                        id="contatto_principale"
                        value={formData.contatto_principale}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contatto_principale: e.target.value,
                          })
                        }
                        placeholder="Es. Segretaria, Responsabile..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note">Note</Label>
                    <Textarea
                      id="note"
                      value={formData.note}
                      onChange={(e) =>
                        setFormData({ ...formData, note: e.target.value })
                      }
                      rows={3}
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row">
                    <Button
                      type="submit"
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
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
          <CardTitle className="text-base md:text-lg">
            Ricerca e Filtri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
            <Input
              placeholder="Cerca per nome, cognome, email o telefono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 pl-10"
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
            {alphabet.map((letter) => (
              <Button
                key={letter}
                variant={letterFilter === letter ? "default" : "outline"}
                size="sm"
                onClick={() => setLetterFilter(letter)}
                className="h-10 w-10"
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
              <UserCircle className="mx-auto mb-4 h-16 w-16 text-gray-300" />
              <p className="text-lg text-gray-500">Nessun contatto trovato</p>
              <p className="mt-2 text-sm text-gray-400">
                {searchQuery || letterFilter
                  ? "Prova a modificare i filtri di ricerca"
                  : "Inizia aggiungendo il tuo primo contatto"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredContatti.map((contatto) => (
            <Card key={contatto.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-3">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-lg font-bold text-white md:h-16 md:w-16 md:text-xl">
                      {getInitials(contatto.nome || "", contatto.cognome)}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="truncate text-base font-bold text-gray-900 md:text-lg">
                          {contatto.cognome} {contatto.nome}
                        </h3>
                        {contatto.contatto_principale && (
                          <Badge
                            variant="secondary"
                            className="mt-1 bg-blue-100 text-blue-800"
                          >
                            <User className="mr-1 h-3 w-3" />
                            {contatto.contatto_principale}
                          </Badge>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleEdit(contatto)}
                          className="h-10 w-10"
                          title="Modifica"
                        >
                          <Edit className="h-5 w-5 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDelete(contatto.id)}
                          className="h-10 w-10 text-red-600 hover:bg-red-50 hover:text-red-700"
                          title="Elimina"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {contatto.email && (
                        <a
                          href={`mailto:${contatto.email}`}
                          className="group flex items-center gap-2 text-sm text-gray-700 transition-colors hover:text-blue-600"
                        >
                          <Mail className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600" />
                          <span className="truncate">{contatto.email}</span>
                        </a>
                      )}

                      {contatto.pec && (
                        <a
                          href={`mailto:${contatto.pec}`}
                          className="group flex items-center gap-2 text-sm text-gray-700 transition-colors hover:text-blue-600"
                        >
                          <Mail className="h-4 w-4 flex-shrink-0 text-amber-500 group-hover:text-blue-600" />
                          <span className="truncate">PEC: {contatto.pec}</span>
                        </a>
                      )}

                      {contatto.email_secondaria && (
                        <a
                          href={`mailto:${contatto.email_secondaria}`}
                          className="group flex items-center gap-2 text-sm text-gray-700 transition-colors hover:text-blue-600"
                        >
                          <Mail className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600" />
                          <span className="truncate">
                            {contatto.email_secondaria}
                          </span>
                        </a>
                      )}

                      {contatto.cell && (
                        <a
                          href={`tel:${contatto.cell}`}
                          className="group flex items-center gap-2 text-sm text-gray-700 transition-colors hover:text-green-600"
                        >
                          <Smartphone className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-green-600" />
                          <span>{contatto.cell}</span>
                        </a>
                      )}

                      {contatto.tel && (
                        <a
                          href={`tel:${contatto.tel}`}
                          className="group flex items-center gap-2 text-sm text-gray-700 transition-colors hover:text-green-600"
                        >
                          <Phone className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-green-600" />
                          <span>{contatto.tel}</span>
                        </a>
                      )}
                    </div>

                    {contatto.note && (
                      <div className="mt-3 border-t pt-3">
                        <p className="line-clamp-2 text-sm text-gray-600">
                          <span className="font-semibold">Note:</span>{" "}
                          {contatto.note}
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

      <MasterPasswordDialog
        open={masterPasswordGate.open}
        onOpenChange={masterPasswordGate.setOpen}
        password={masterPasswordGate.password}
        onPasswordChange={masterPasswordGate.setPassword}
        onUnlock={masterPasswordGate.handleUnlock}
        loading={masterPasswordGate.unlocking}
      />
    </div>
  );
}

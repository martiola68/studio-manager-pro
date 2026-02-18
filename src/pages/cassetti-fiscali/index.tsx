"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Loader2,
  Search,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Lock,
  Unlock,
  ExternalLink,
} from "lucide-react";

import {
  cassettiFiscaliService,
  type CassettoFiscale,
} from "@/services/cassettiFiscaliService";

import {
  isEncryptionEnabled,
  encryptCassettoPasswords,
  unlockCassetti,
} from "@/services/encryptionService";

import { isEncrypted, decryptData, getStoredEncryptionKey } from "@/lib/encryption";

const formSchema = z.object({
  nominativo: z.string().min(2, "Il nominativo è obbligatorio"),
  username: z.string().optional(),
  password1: z.string().optional(),
  pw_attiva1: z.boolean().default(false),
  password2: z.string().optional(),
  pw_attiva2: z.boolean().default(false),
  pin: z.string().optional(),
  pw_iniziale: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type PendingAction =
  | { type: "reveal"; payload: { id: string; field: "pw1" | "pw2" | "pin" | "pw_init" } }
  | { type: "copy"; payload: { text: string; label: string } }
  | { type: "submit"; payload: { values: FormValues } }
  | null;

function hasKey() {
  return Boolean(getStoredEncryptionKey());
}

function isSensitiveEncrypted(item: CassettoFiscale) {
  return (
    (item.password1 && isEncrypted(item.password1)) ||
    (item.password2 && isEncrypted(item.password2)) ||
    (item.pin && isEncrypted(item.pin)) ||
    (item.pw_iniziale && isEncrypted(item.pw_iniziale)) ||
    (item.username && isEncrypted(item.username))
  );
}

export default function CassettiFiscaliPage() {
  const [studioId, setStudioId] = useState<string>("");
  const [cassetti, setCassetti] = useState<CassettoFiscale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCassetto, setEditingCassetto] = useState<CassettoFiscale | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  type ViewMode = "gestori" | "societa";
  const [viewMode, setViewMode] = useState<ViewMode>("gestori");

  // Encryption (non blocca la UI)
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nominativo: "",
      username: "",
      password1: "",
      pw_attiva1: true,
      password2: "",
      pw_attiva2: false,
      pin: "",
      pw_iniziale: "",
      note: "",
    },
  });

  // Carica studioId SOLO lato client (evita errori in build/SSR)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setStudioId(localStorage.getItem("studio_id") || "");
    }
  }, []);

  const refreshEncryptionEnabled = async () => {
    try {
      if (!studioId) {
        setEncryptionEnabled(false);
        return;
      }
      const enabled = await isEncryptionEnabled(studioId);
      setEncryptionEnabled(Boolean(enabled));
    } catch (e) {
      console.error("Error checking encryption enabled:", e);
      setEncryptionEnabled(false);
    }
  };

  const loadCassetti = async () => {
    try {
      setLoading(true);

      // Se studioId non è ancora pronto, carico comunque (se il tuo service accetta null)
      const data = await cassettiFiscaliService.getCassettiFiscali(
  studioId || null,
  viewMode
);
      const rows = (data ?? []) as CassettoFiscale[];

      const key = getStoredEncryptionKey();

      const hydrated = rows.map((item) => {
        if (!key) return item;

        try {
          const decryptedUsername =
            item.username && isEncrypted(item.username) ? decryptData(item.username, key) : item.username;

          const decryptedPassword1 =
            item.password1 && isEncrypted(item.password1) ? decryptData(item.password1, key) : item.password1;

          const decryptedPassword2 =
            item.password2 && isEncrypted(item.password2) ? decryptData(item.password2, key) : item.password2;

          const decryptedPin = item.pin && isEncrypted(item.pin) ? decryptData(item.pin, key) : item.pin;

          const decryptedPwInit =
            item.pw_iniziale && isEncrypted(item.pw_iniziale) ? decryptData(item.pw_iniziale, key) : item.pw_iniziale;

          return {
            ...item,
            username: decryptedUsername,
            password1: decryptedPassword1,
            password2: decryptedPassword2,
            pin: decryptedPin,
            pw_iniziale: decryptedPwInit,
          };
        } catch (e) {
          console.error("Error decrypting item:", item.id, e);
          return item;
        }
      });

      setCassetti(hydrated);
    } catch (error) {
      console.error("Error loading cassetti:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile caricare i cassetti fiscali",
      });
    } finally {
      setLoading(false);
    }
  };

  // Carico dati quando studioId è disponibile (e anche al primo render client)
 useEffect(() => {
  refreshEncryptionEnabled();
  loadCassetti();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [studioId, viewMode]);


  useEffect(() => {
    if (editingCassetto) {
      form.reset({
        nominativo: editingCassetto.nominativo,
        username: editingCassetto.username || "",
        password1: editingCassetto.password1 || "",
        pw_attiva1: editingCassetto.pw_attiva1 || false,
        password2: editingCassetto.password2 || "",
        pw_attiva2: editingCassetto.pw_attiva2 || false,
        pin: editingCassetto.pin || "",
        pw_iniziale: editingCassetto.pw_iniziale || "",
        note: editingCassetto.note || "",
      });
    } else {
      form.reset({
        nominativo: "",
        username: "",
        password1: "",
        pw_attiva1: true,
        password2: "",
        pw_attiva2: false,
        pin: "",
        pw_iniziale: "",
        note: "",
      });
    }
  }, [editingCassetto, form]);

  const handlePw1Change = (checked: boolean) => {
    form.setValue("pw_attiva1", checked);
    if (checked) form.setValue("pw_attiva2", false);
  };

  const handlePw2Change = (checked: boolean) => {
    form.setValue("pw_attiva2", checked);
    if (checked) form.setValue("pw_attiva1", false);
  };

  const requireUnlock = (action: PendingAction) => {
    setPendingAction(action);
    setUnlockDialogOpen(true);
  };

  const doCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: `${label} copiata negli appunti`, duration: 2000 });

    setTimeout(() => {
      navigator.clipboard.writeText("");
    }, 10000);
  };

  const copyToClipboard = (text: string | null | undefined, label: string) => {
    if (!text) return;

    if (encryptionEnabled && !hasKey() && isEncrypted(text)) {
      requireUnlock({ type: "copy", payload: { text, label } });
      return;
    }

    doCopy(text, label);
  };

  const togglePasswordVisibility = (
    id: string,
    field: "pw1" | "pw2" | "pin" | "pw_init",
    forceShow?: boolean
  ) => {
    if (encryptionEnabled && !hasKey()) {
      requireUnlock({ type: "reveal", payload: { id, field } });
      return;
    }

    const k = `${id}_${field}`;
    setVisiblePasswords((prev) => ({
      ...prev,
      [k]: forceShow ? true : !prev[k],
    }));

    const willShow = forceShow ? true : !visiblePasswords[k];

    if (willShow) {
      setTimeout(() => {
        setVisiblePasswords((prev) => ({ ...prev, [k]: false }));
      }, 30000);
    }
  };

  const handleUnlock = async () => {
    try {
      if (!studioId) return;

      const result = await unlockCassetti(studioId, unlockPassword);

      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Errore",
          description: result.error || "Password errata",
        });
        return;
      }

      setUnlockDialogOpen(false);
      setUnlockPassword("");

      toast({
        title: "🔓 Sbloccato",
        description: "Ora puoi visualizzare/copiare/salvare i campi cifrati.",
      });

      await loadCassetti();

      const next = pendingAction;
      setPendingAction(null);

      if (!next) return;

      if (next.type === "reveal") {
        const { id, field } = next.payload;
        togglePasswordVisibility(id, field, true);
      } else if (next.type === "copy") {
        const { text, label } = next.payload;
        doCopy(text, label);
      } else if (next.type === "submit") {
        await doSubmit(next.payload.values);
      }
    } catch (error) {
      console.error("Unlock error:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile sbloccare i cassetti",
      });
    }
  };

  const doSubmit = async (values: FormValues) => {
    try {
      if (encryptionEnabled && !hasKey()) {
        requireUnlock({ type: "submit", payload: { values } });
        return;
      }

      let dataToSave: any = { ...values };

      if (encryptionEnabled) {
        const encrypted = await encryptCassettoPasswords({
          password1: values.password1,
          password2: values.password2,
          pin: values.pin,
          pw_iniziale: values.pw_iniziale,
        });
        dataToSave = { ...values, ...encrypted };
      }

      if (editingCassetto) {
        await cassettiFiscaliService.update(editingCassetto.id, dataToSave);
        toast({ title: "Successo", description: "Cassetto fiscale aggiornato" });
      } else {
        await cassettiFiscaliService.create(dataToSave);
        toast({ title: "Successo", description: "Nuovo cassetto fiscale creato" });
      }

      form.reset({
        nominativo: "",
        username: "",
        password1: "",
        pw_attiva1: true,
        password2: "",
        pw_attiva2: false,
        pin: "",
        pw_iniziale: "",
        note: "",
      });

      setDialogOpen(false);
      setEditingCassetto(null);
      await loadCassetti();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile salvare i dati",
      });
    }
  };

  const onSubmit = async (values: FormValues) => {
    await doSubmit(values);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo cassetto fiscale?")) return;
    try {
      await cassettiFiscaliService.delete(id);
      toast({ title: "Successo", description: "Cassetto fiscale eliminato" });
      loadCassetti();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile eliminare il cassetto fiscale",
      });
    }
  };

  const filteredCassetti = useMemo(() => {
    return cassetti.filter((cassetto) => {
      if (searchTerm === "") return true;

      if (searchTerm.length === 1 && /^[A-Z]$/i.test(searchTerm)) {
        return cassetto.nominativo?.toUpperCase().startsWith(searchTerm.toUpperCase());
      }

      const term = searchTerm.toLowerCase();

      const nominativoMatch = cassetto.nominativo?.toLowerCase().includes(term);

      const usernameMatch =
        cassetto.username && !isEncrypted(cassetto.username)
          ? cassetto.username.toLowerCase().includes(term)
          : false;

      const pinMatch =
        cassetto.pin && !isEncrypted(cassetto.pin) ? cassetto.pin.toLowerCase().includes(term) : false;

      return Boolean(nominativoMatch || usernameMatch || pinMatch);
    });
  }, [cassetti, searchTerm]);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const renderSensitiveCell = (
    cassetto: CassettoFiscale,
    field: "pw1" | "pw2" | "pin" | "pw_init"
  ) => {
    const map: Record<
      typeof field,
      { value?: string | null; mask: string; label: string }
    > = {
      pw1: { value: cassetto.password1, mask: "••••••••", label: "Password 1" },
      pw2: { value: cassetto.password2, mask: "••••••••", label: "Password 2" },
      pin: { value: cassetto.pin, mask: "••••", label: "PIN" },
      pw_init: { value: cassetto.pw_iniziale, mask: "••••••••", label: "Password Iniziale" },
    };

    const { value, mask, label } = map[field];
    const k = `${cassetto.id}_${field}`;
    const isVisible = Boolean(visiblePasswords[k]);

    const locked = encryptionEnabled && !hasKey() && value && isEncrypted(value);
    const display = !value ? "-" : locked ? "🔒" : isVisible ? value : mask;

    return (
      <div className="flex items-center gap-2">
        <span className="font-mono">{display}</span>

        {value && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => togglePasswordVisibility(cassetto.id, field)}
              title={locked ? "Sblocca per visualizzare" : isVisible ? "Nascondi" : "Mostra"}
            >
              {locked ? (
                <Lock className="h-3 w-3" />
              ) : isVisible ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => copyToClipboard(value, label)}
              title={locked ? "Sblocca per copiare" : "Copia"}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
  <div className="max-w-7xl mx-auto p-4 md:p-8">
    <div className="flex justify-between items-center mb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cassetti Fiscali</h1>
        <p className="text-muted-foreground">Gestione credenziali cassetti fiscali</p>

        {encryptionEnabled && !hasKey() && (
          <p className="text-xs text-orange-600 mt-2">
            🔒 Cifratura attiva: i campi sensibili restano mascherati finché non sblocchi (la lista NON è bloccata).
          </p>
        )}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {/* Toggle vista (spostato QUI, non dentro il bottone Agenzia) */}
        <Button
          type="button"
          onClick={() => setViewMode("gestori")}
          className={`text-white ${
            viewMode === "gestori"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-black hover:bg-gray-800"
          }`}
        >
          Gestori
        </Button>

        <Button
          type="button"
          onClick={() => setViewMode("societa")}
          className={`text-white ${
            viewMode === "societa"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-black hover:bg-gray-800"
          }`}
        >
          Società collegate
        </Button>

        <Button
          variant="outline"
          onClick={() =>
            window.open(
              "https://iampe.agenziaentrate.gov.it/sam/UI/Login?realm=/agenziaentrate",
              "_blank"
            )
          }
        >
          <ExternalLink className="mr-2 h-4 w-4" /> Agenzia delle Entrate
        </Button>

        {encryptionEnabled && !hasKey() && (
          <Button variant="outline" onClick={() => setUnlockDialogOpen(true)}>
            <Unlock className="mr-2 h-4 w-4" /> Sblocca
          </Button>
        )}

        <Button
          onClick={() => {
            setEditingCassetto(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nuovo Cassetto
        </Button>
      </div>
    </div>

    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />

          {/* Toggle duplicato RIMOSSO da qui: resta solo l'Input */}
          <Input
            placeholder={
              viewMode === "gestori"
                ? "Cerca per nominativo o username..."
                : "Cerca per ragione sociale o gestore..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          <Button
            variant={searchTerm === "" ? "default" : "outline"}
            size="sm"
            onClick={() => setSearchTerm("")}
          >
            Tutti
          </Button>
          {alphabet.map((letter) => (
            <Button
              key={letter}
              variant={searchTerm.startsWith(letter) ? "default" : "outline"}
              size="sm"
              className="w-8 px-0"
              onClick={() => setSearchTerm(letter)}
            >
              {letter}
            </Button>
          ))}
        </div>
      </div>

        <div className="rounded-md border bg-white shadow-sm overflow-hidden">
          <div className="relative w-full overflow-auto max-h-[600px]">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-30 bg-white shadow-sm">
                <TableRow>
                  <TableHead className="sticky-col-header bg-white">Nominativo</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Password 1</TableHead>
                  <TableHead>Password 2</TableHead>
                  <TableHead>PIN</TableHead>
                 <TableHead>
                      {viewMode === "societa" ? "Codice fiscale" : "Password Iniziale"}
                    </TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredCassetti.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nessun cassetto fiscale trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCassetti.map((cassetto) => {
                    const usernameLocked =
                      encryptionEnabled && !hasKey() && cassetto.username && isEncrypted(cassetto.username);

                    return (
                      <TableRow key={cassetto.id}>
                        <TableCell className="sticky-col-cell font-medium bg-white">
                          {cassetto.nominativo}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">
                              {!cassetto.username ? "-" : usernameLocked ? "🔒" : cassetto.username}
                            </span>

                            {cassetto.username && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(cassetto.username, "Username")}
                                title={usernameLocked ? "Sblocca per copiare" : "Copia username"}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className={cassetto.pw_attiva1 ? "bg-blue-50/50" : ""}>
                          {renderSensitiveCell(cassetto, "pw1")}
                        </TableCell>

                        <TableCell className={cassetto.pw_attiva2 ? "bg-blue-50/50" : ""}>
                          {renderSensitiveCell(cassetto, "pw2")}
                        </TableCell>

                        <TableCell>{renderSensitiveCell(cassetto, "pin")}</TableCell>

                        <TableCell>{renderSensitiveCell(cassetto, "pw_init")}</TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingCassetto(cassetto);
                                setDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(cassetto.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {encryptionEnabled && !hasKey() && isSensitiveEncrypted(cassetto) && (
                            <div className="text-[10px] text-muted-foreground mt-1 flex justify-end gap-1 items-center">
                              <Lock className="h-3 w-3" />
                              <span>sensibile cifrato</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </table>
          </div>
        </div>
      </div>

      {/* Unlock Dialog (on-demand, non blocca la lista) */}
      <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔒 Sblocca Dati Cifrati</DialogTitle>
            <DialogDescription>
              Inserisci la Master Password per visualizzare/copiare/salvare i campi cifrati.
              <br />
              <span className="text-sm text-orange-600 mt-2 block">
                💡 Se non l’hai configurata: <strong>Impostazioni → Dati Studio</strong>
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Master Password</label>
              <Input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Inserisci Master Password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUnlock();
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleUnlock}>
              <Unlock className="mr-2 h-4 w-4" /> Sblocca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCassetto ? "Modifica Cassetto Fiscale" : "Nuovo Cassetto Fiscale"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nominativo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nominativo / Cliente</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Mario Rossi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Username..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PIN</FormLabel>
                      <FormControl>
                        <Input placeholder="PIN..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div
                className={`p-4 border rounded-md ${
                  form.watch("pw_attiva1") ? "bg-blue-50 border-blue-200" : "bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Password 1</h4>
                  <FormField
                    control={form.control}
                    name="pw_attiva1"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={handlePw1Change} />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">Attiva</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="password1"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Password 1..."
                          {...field}
                          disabled={!form.watch("pw_attiva1") && form.watch("pw_attiva2")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div
                className={`p-4 border rounded-md ${
                  form.watch("pw_attiva2") ? "bg-blue-50 border-blue-200" : "bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Password 2</h4>
                  <FormField
                    control={form.control}
                    name="pw_attiva2"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={handlePw2Change} />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">Attiva</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="password2"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Password 2..."
                          {...field}
                          disabled={!form.watch("pw_attiva2") && form.watch("pw_attiva1")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

            <FormField
  control={form.control}
  name="pw_iniziale"
  render={({ field }) => (
    <FormItem>
      <FormLabel>
        {viewMode === "societa" ? "Codice fiscale" : "Password iniziale"}
      </FormLabel>
      <FormControl>
        <Input
          placeholder={
            viewMode === "societa"
              ? "Codice fiscale..."
              : "Password iniziale..."
          }
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>

              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Note aggiuntive..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit">
                  {editingCassetto ? "Salva Modifiche" : "Crea Cassetto"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

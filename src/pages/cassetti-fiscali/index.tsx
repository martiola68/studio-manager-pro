import { useState, useEffect, useMemo } from "react";
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

function isSensitiveEncrypted(item: CassettoFiscale) {
  return (
    (item.password1 && isEncrypted(item.password1)) ||
    (item.password2 && isEncrypted(item.password2)) ||
    (item.pin && isEncrypted(item.pin)) ||
    (item.pw_iniziale && isEncrypted(item.pw_iniziale)) ||
    (item.username && isEncrypted(item.username))
  );
}

function hasKey() {
  return Boolean(getStoredEncryptionKey());
}

export default function CassettiFiscaliPage() {
  const [cassetti, setCassetti] = useState<CassettoFiscale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCassetto, setEditingCassetto] = useState<CassettoFiscale | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

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

  const handlePw1Change = (checked: boolean) => {
    form.setValue("pw_attiva1", checked);
    if (checked) form.setValue("pw_attiva2", false);
  };

  const handlePw2Change = (checked: boolean) => {
    form.setValue("pw_attiva2", checked);
    if (checked) form.setValue("pw_attiva1", false);
  };

  const studioId = useMemo(() => localStorage.getItem("studio_id") || "", []);

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
      // non blocchiamo mai la UI
      setEncryptionEnabled(false);
    }
  };

  const loadCassetti = async () => {
    try {
      setLoading(true);
      const data = await cassettiFiscaliService.getCassettiFiscali(studioId || null);

      const key = getStoredEncryptionKey();

      // Se ho la key -> decifro e mostro chiaro
      // Se NON ho la key -> NON blocco la lista: mostro comunque nominativo e maschero i campi sensibili
      const hydrated = data.map((item) => {
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

  useEffect(() => {
    refreshEncryptionEnabled();
    loadCassetti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const requireUnlock = (action: PendingAction) => {
    setPendingAction(action);
    setUnlockDialogOpen(true);
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
        description: "Ora puoi visualizzare/copiare/salvare i dati cifrati.",
      });

      // ricarico per mostrare i valori decifrati
      await loadCassetti();

      // rieseguo l’azione pending
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

  const doCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: `${label} copiata negli appunti`, duration: 2000 });

    setTimeout(() => {
      navigator.clipboard.writeText("");
    }, 10000);
  };

  const copyToClipboard = (text: string | null | undefined, label: string) => {
    if (!text) return;

    // Se cifratura attiva e non abbiamo key (quindi con buona probabilità è cifrato) -> unlock on-demand
    if (encryptionEnabled && !hasKey() && isEncrypted(text)) {
      requireUnlock({ type: "copy", payload: { text, label } });
      return;
    }

    doCopy(text, label);
  };

  const togglePasswordVisibility = (id: string, field: "pw1" | "pw2" | "pin" | "pw_init", forceShow?: boolean) => {
    // Se cifratura attiva e non ho key -> chiedo unlock ma NON blocco la pagina
    if (encryptionEnabled && !hasKey()) {
      requireUnlock({ type: "reveal", payload: { id, field } });
      return;
    }

    const key = `${id}_${field}`;
    setVisiblePasswords((prev) => ({
      ...prev,
      [key]: forceShow ? true : !prev[key],
    }));

    const willShow = forceShow ? true : !visiblePasswords[key];

    // Auto-hide after 30 seconds
    if (willShow) {
      setTimeout(() => {
        setVisiblePasswords((prev) => ({ ...prev, [key]: false }));
      }, 30000);
    }
  };

  const doSubmit = async (values: FormValues) => {
    try {
      // Se cifratura attiva ma non sbloccato -> chiedi unlock on-demand SOLO per il salvataggio
      if (encryptionEnabled && !hasKey()) {
        requireUnlock({ type: "submit", payload: { values } });
        return;
      }

      // Encrypt passwords (Master Password system) se attivo
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

      // Se username è cifrato e non ho key, la ricerca su username non ha senso:
      // non blocco nulla, semplicemente cerco su nominativo e su eventuali campi già in chiaro.
      const term = searchTerm.toLowerCase();

      const nominativoMatch = cassetto.nominativo?.toLowerCase().includes(term);
      const usernameMatch = cassetto.username && !isEncrypted(cassetto.username) ? cassetto.username.toLowerCase().includes(term) : false;
      const pinMatch = cassetto.pin && !isEncrypted(cassetto.pin) ? cassetto.pin.toLowerCase().includes(term) : false;

      return Boolean(nominativoMatch || usernameMatch || pinMatch);
    });
  }, [cassetti, searchTerm]);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const renderSensitiveCell = (cassetto: CassettoFiscale, field: "pw1" | "pw2" | "pin" | "pw_init") => {
    const map: Record<typeof field, { value?: string | null; mask: string; label: string }> = {
      pw1: { value: cassetto.password1, mask: "••••••••", label: "Password 1" },
      pw2: { value: cassetto.password2, mask: "••••••••", label: "Password 2" },
      pin: { value: cassetto.pin, mask: "••••", label: "PIN" },
      pw_init: { value: cassetto.pw_iniziale, mask: "••••••••", label: "Password Iniziale" },
    };

    const { value, mask, label } = map[field];
    const key = `${cassetto.id}_${field}`;
    const isVisible = Boolean(visiblePasswords[key]);

    // Se cifrato e non ho key -> non mostro valore, ma consento click per sbloccare on-demand
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

        <div className="flex gap-2">
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
            <Input
              placeholder="Cerca per nominativo o username..."
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
              <TableHeader className="sticky t

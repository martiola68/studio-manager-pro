import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabase/client";
import { comunicazioneService } from "@/services/comunicazioneService";
import { clienteService } from "@/services/clienteService";
import { emailService } from "@/services/emailService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Plus, Paperclip, Search, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";

type Comunicazione = Database["public"]["Tables"]["tbcomunicazioni"]["Row"];
type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

type TipoComunicazione = "newsletter" | "scadenze" | "singola" | "interna";

type TemplateScadenza =
  | "iva_trimestrale"
  | "iva_mensile"
  | "ritenute"
  | "imu"
  | "f24_dipendenti"
  | "imposte"
  | "altro";

const templateScadenze = [
  { value: "iva_trimestrale", label: "IVA trimestrale" },
  { value: "iva_mensile", label: "IVA mensile" },
  { value: "ritenute", label: "Ritenute d'acconto" },
  { value: "imu", label: "IMU" },
  { value: "f24_dipendenti", label: "F24 dipendenti" },
  { value: "imposte", label: "Imposte" },
  { value: "altro", label: "Altro F24" },
] as const;

const mesi = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

const trimestri = [
  "1° trimestre",
  "2° trimestre",
  "3° trimestre",
  "4° trimestre",
];

type AllegatoComunicazione = {
  nome: string;
  tipo: string;
  dimensione: number;
  bucket: string;
  path: string;
};

export default function ComunicazioniPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [comunicazioni, setComunicazioni] = useState<Comunicazione[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [multiDestinatari, setMultiDestinatari] = useState(false);
  const [selectedDestinatari, setSelectedDestinatari] = useState<string[]>([]);
  const [searchDestinatari, setSearchDestinatari] = useState("");

const [formData, setFormData] = useState({
  tipo: "singola" as TipoComunicazione,
  destinatario_id: "",
  destinatario_email: "",
  oggetto: "",
  messaggio: "",
});

const [templateData, setTemplateData] = useState({
  template: "" as TemplateScadenza | "",
  periodoTipo: "mese" as "mese" | "trimestre" | "anno" | "rata",
  periodo: "",
  anno: String(new Date().getFullYear()),
  dataScadenza: "",
  associaRitenute: false,
});

  useEffect(() => {
    void checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (!session) {
        await router.push("/login");
        return;
      }

      await loadData();
    } catch (error) {
      console.error("Errore auth:", error);
      await router.push("/login");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const [comunicazioniData, clientiData, utentiData] = await Promise.all([
        comunicazioneService.getComunicazioni(),
        clienteService.getClienti(),
        loadUtenti(),
      ]);

      setComunicazioni(comunicazioniData);
      setClienti(clientiData);
      setUtenti(utentiData);
    } catch (error) {
      console.error("Errore caricamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUtenti = async (): Promise<Utente[]> => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("tbutenti")
      .select("*")
      .eq("attivo", true)
      .order("cognome", { ascending: true });

    if (error) throw error;
    return data || [];
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const uploadAllegato = async (): Promise<AllegatoComunicazione | null> => {
    if (!selectedFile) return null;

    try {
      const supabase = getSupabaseClient();
      const BUCKET_NAME = "messaggi-allegati";

      const safeName = selectedFile.name.replace(/[^\w.\-]+/g, "_");
      const fileName = `${Date.now()}_${safeName}`;
      const filePath = `comunicazioni/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: selectedFile.type || undefined,
        });

      if (uploadError) throw uploadError;

      return {
        nome: selectedFile.name,
        tipo: selectedFile.type || "application/octet-stream",
        dimensione: selectedFile.size,
        bucket: BUCKET_NAME,
        path: filePath,
      };
    } catch (error) {
      console.error("Errore upload:", error);
      throw new Error("Errore caricamento allegato");
    }
  };

  const formatDateIT = (value: string) => {
  if (!value) return "[data scadenza]";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "[data scadenza]";
  return d.toLocaleDateString("it-IT");
};

const getTemplateLabel = (value: string) => {
  return templateScadenze.find((t) => t.value === value)?.label || "";
};

const generaMessaggioScadenza = (data = templateData) => {
  const tipoLabel = getTemplateLabel(data.template);
  const periodo = data.periodo || "[periodo]";
  const anno = data.anno || String(new Date().getFullYear());
  const scadenza = formatDateIT(data.dataScadenza);

  let oggetto = "";
  let messaggio = "";

  if (data.template === "iva_trimestrale") {
    oggetto = `Invio modello F24 IVA - ${periodo} ${anno}`;
    messaggio = `Gentile Cliente,

in allegato si trasmette il modello F24 relativo al pagamento dell'IVA del ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.`;
  } else if (data.template === "iva_mensile") {
    oggetto = `Invio modello F24 IVA - mese di ${periodo} ${anno}`;
    messaggio = `Gentile Cliente,

in allegato si trasmette il modello F24 relativo al pagamento dell'IVA del mese di ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.`;
  } else if (data.template === "ritenute") {
    oggetto = `Invio modello F24 ritenute - ${periodo} ${anno}`;
    messaggio = `Gentile Cliente,

in allegato si trasmette il modello F24 relativo al versamento delle ritenute d'acconto riferite al periodo ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.`;
  } else if (data.template === "imu") {
    oggetto = `Invio modello F24 IMU - ${periodo} ${anno}`;
    messaggio = `Gentile Cliente,

in allegato si trasmette il modello F24 relativo al pagamento IMU per ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.`;
  } else if (data.template === "f24_dipendenti") {
    oggetto = `Invio modello F24 dipendenti - ${periodo} ${anno}`;
    messaggio = `Gentile Cliente,

in allegato si trasmette il modello F24 relativo ai versamenti connessi al personale dipendente per il periodo ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.`;
  } else if (data.template === "imposte") {
    oggetto = `Invio modello F24 imposte - ${periodo} ${anno}`;
    messaggio = `Gentile Cliente,

in allegato si trasmette il modello F24 relativo al pagamento delle imposte per ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.`;
  } else if (data.template === "altro") {
    oggetto = `Invio modello F24 - ${periodo} ${anno}`;
    messaggio = `Gentile Cliente,

in allegato si trasmette il modello F24 relativo alla scadenza ${tipoLabel || "indicata"} per ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.`;
  }

  if (data.associaRitenute && data.template !== "ritenute") {
    oggetto += " e ritenute";
    messaggio += `

La comunicazione comprende anche le eventuali ritenute d'acconto associate alla medesima scadenza.`;
  }

  messaggio += `

Cordiali saluti`;

  setFormData((prev) => ({
    ...prev,
    tipo: "scadenze",
    oggetto,
    messaggio,
  }));
};

  const getClienteEmail = (clienteId: string) => {
  const cliente = clienti.find((c) => c.id === clienteId);

  return (
    (cliente as any)?.email ||
    (cliente as any)?.pec ||
    (cliente as any)?.email_amministrativa ||
    "-"
  );
};

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

   if (!formData.oggetto || !formData.messaggio) {
  toast({
    title: "Errore",
    description: "Oggetto e messaggio sono obbligatori",
    variant: "destructive",
  });
  return;
}

if (formData.tipo === "singola" && !formData.destinatario_email.trim()) {
  toast({
    title: "Email destinatario obbligatoria",
    description: "Inserisci l'indirizzo email prima di inviare.",
    variant: "destructive",
  });
  return;
}

    if (formData.tipo === "singola" && !formData.destinatario_id) {
      toast({
        title: "Errore",
        description: "Seleziona un destinatario",
        variant: "destructive",
      });
      return;
    }

    if (
      formData.tipo === "interna" &&
      multiDestinatari &&
      selectedDestinatari.length === 0
    ) {
      toast({
        title: "Errore",
        description: "Seleziona almeno un destinatario",
        variant: "destructive",
      });
      return;
    }

    try {
      setSending(true);

      let allegati: AllegatoComunicazione[] | null = null;

      if (selectedFile) {
        const fileData = await uploadAllegato();
        allegati = fileData ? [fileData] : null;
      }

      let destinatariCount = 0;

      if (formData.tipo === "singola") {
        destinatariCount = 1;
      } else if (formData.tipo === "newsletter") {
        destinatariCount = clienti.filter(
          (c) => c.attivo && c.flag_mail_attivo && c.flag_mail_newsletter
        ).length;
      } else if (formData.tipo === "scadenze") {
        destinatariCount = clienti.filter(
          (c) => c.attivo && c.flag_mail_attivo && c.flag_mail_scadenze
        ).length;
      } else if (formData.tipo === "interna") {
        destinatariCount = multiDestinatari
          ? selectedDestinatari.length
          : utenti.filter((u) => u.attivo).length;
      }

   await comunicazioneService.createComunicazione({
  tipo: formData.tipo,
  oggetto: formData.oggetto,
  messaggio: formData.messaggio,
  allegati,
  destinatari_count: destinatariCount,
  stato: "Inviata",
  data_invio: new Date().toISOString(),
});

const supabase = getSupabaseClient();

const {
  data: { session },
} = await supabase.auth.getSession();

let microsoftConnectionId: string | undefined = undefined;

if (session?.user?.email) {
  const { data: utenteRow, error: utenteRowError } = await supabase
    .from("tbutenti")
    .select("microsoft_connection_id")
    .eq("email", session.user.email)
    .maybeSingle();

  if (utenteRowError) {
    throw utenteRowError;
  }

  microsoftConnectionId = utenteRow?.microsoft_connection_id || undefined;
}

const emailResult = await emailService.sendComunicazioneEmail({
  tipo: formData.tipo,
  destinatarioId:
    formData.tipo === "singola" ? formData.destinatario_id : undefined,
  destinatarioEmail:
    formData.tipo === "singola"
      ? formData.destinatario_email.trim()
      : undefined,
  destinatariIds:
    formData.tipo === "interna" && multiDestinatari
      ? selectedDestinatari
      : undefined,
  oggetto: formData.oggetto,
  messaggio: formData.messaggio,
  allegati,
  microsoftConnectionId,
});

      if (emailResult?.success) {
        const details = [
          `${emailResult.sent} inviate`,
          emailResult.failed > 0 ? `${emailResult.failed} fallite` : null,
          emailResult.skipped > 0
            ? `${emailResult.skipped} escluse (formato invalido)`
            : null,
        ]
          .filter(Boolean)
          .join(", ");

        toast({
          title: "Comunicazione inviata",
          description: details,
        });
      } else {
        toast({
          title: "Errore parziale",
          description:
            emailResult?.error || "Alcune email non sono state inviate",
          variant: "destructive",
        });
      }

      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Errore invio:", error);
      toast({
        title: "Errore",
        description: "Impossibile inviare la comunicazione",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

 const resetForm = () => {
 setFormData({
  tipo: "singola",
  destinatario_id: "",
  destinatario_email: "",
  oggetto: "",
  messaggio: "",
});
  setSelectedFile(null);
  setMultiDestinatari(false);
  setSelectedDestinatari([]);
  setSearchDestinatari("");
  setTemplateData({
    template: "",
    periodoTipo: "mese",
    periodo: "",
    anno: String(new Date().getFullYear()),
    dataScadenza: "",
    associaRitenute: false,
  });
};

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo messaggio dallo storico?")) {
      return;
    }

    try {
      await comunicazioneService.deleteComunicazione(id);
      toast({
        title: "Eliminato",
        description: "Messaggio eliminato dallo storico",
      });
      await loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il messaggio",
        variant: "destructive",
      });
    }
  };

  const handleDestinatarioToggle = (utenteId: string) => {
    setSelectedDestinatari((prev) =>
      prev.includes(utenteId)
        ? prev.filter((id) => id !== utenteId)
        : [...prev, utenteId]
    );
  };

  const handleSelezionaTuttiSettore = (settore: string) => {
    const utentiFiltrati = utenti.filter((u) => {
      if (settore === "tutti") return true;
      return (u.settore || "").toLowerCase() === settore.toLowerCase();
    });

    const nuoviIds = utentiFiltrati.map((u) => u.id);

    setSelectedDestinatari((prev) => {
      const newSelection = [...prev];
      nuoviIds.forEach((id) => {
        if (!newSelection.includes(id)) newSelection.push(id);
      });
      return newSelection;
    });
  };

  const handleDeselezionaTutti = () => {
    setSelectedDestinatari([]);
  };

  const getUtentiFiltrati = () => {
    return utenti.filter((u) => {
      const fullName = `${u.nome} ${u.cognome}`.toLowerCase();
      return (
        searchDestinatari === "" ||
        fullName.includes(searchDestinatari.toLowerCase())
      );
    });
  };

  const filteredComunicazioni = comunicazioni.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      (c.oggetto || "").toLowerCase().includes(q) ||
      (c.messaggio || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comunicazioni</h1>
          <p className="text-gray-500 mt-1">
            Gestione invio email e comunicazioni massive
          </p>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nuova Comunicazione
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-3xl h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Nuova Comunicazione</DialogTitle>
              <DialogDescription>
                Invia email a singoli clienti o gruppi di distribuzione
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={handleSubmit}
              className="space-y-4 overflow-y-auto flex-1 pr-2"
            >
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo Invio</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: TipoComunicazione) => {
                    setFormData({ ...formData, tipo: value });
                    setMultiDestinatari(false);
                    setSelectedDestinatari([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
  <SelectItem value="singola">Singolo Cliente</SelectItem>
  <SelectItem value="interna">
    Comunicazione Interna
  </SelectItem>
</SelectContent>
              </Select>

<div className="space-y-2">
  <Label htmlFor="destinatario_email">Email destinatario *</Label>
  <Input
    id="destinatario_email"
    type="email"
    value={formData.destinatario_email}
    onChange={(e) =>
      setFormData({
        ...formData,
        destinatario_email: e.target.value,
      })
    }
    placeholder="email@cliente.it"
    required
  />
</div>
</div>

              {formData.tipo === "scadenze" && (
  <div className="space-y-4 rounded-lg border bg-blue-50 p-4">
    <div>
      <Label className="mb-2 block">Template scadenza</Label>

      <div className="flex flex-wrap gap-2">
        {templateScadenze.map((template) => (
          <Button
            key={template.value}
            type="button"
            variant={
              templateData.template === template.value
                ? "default"
                : "outline"
            }
            size="sm"
            onClick={() => {
              const next = {
                ...templateData,
                template: template.value as TemplateScadenza,
                periodoTipo:
                  template.value === "iva_trimestrale"
                    ? "trimestre"
                    : templateData.periodoTipo,
              };

              setTemplateData(next);
            }}
          >
            {template.label}
          </Button>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <div className="space-y-2">
        <Label>Periodo tipo</Label>
        <Select
          value={templateData.periodoTipo}
          onValueChange={(value: "mese" | "trimestre" | "anno" | "rata") =>
            setTemplateData({
              ...templateData,
              periodoTipo: value,
              periodo: "",
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mese">Mese</SelectItem>
            <SelectItem value="trimestre">Trimestre</SelectItem>
            <SelectItem value="anno">Anno</SelectItem>
            <SelectItem value="rata">Rata</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Periodo</Label>

        {templateData.periodoTipo === "mese" && (
          <Select
            value={templateData.periodo}
            onValueChange={(value) =>
              setTemplateData({ ...templateData, periodo: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona mese" />
            </SelectTrigger>
            <SelectContent>
              {mesi.map((mese) => (
                <SelectItem key={mese} value={mese}>
                  {mese}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {templateData.periodoTipo === "trimestre" && (
          <Select
            value={templateData.periodo}
            onValueChange={(value) =>
              setTemplateData({ ...templateData, periodo: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona trimestre" />
            </SelectTrigger>
            <SelectContent>
              {trimestri.map((trimestre) => (
                <SelectItem key={trimestre} value={trimestre}>
                  {trimestre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(templateData.periodoTipo === "anno" ||
          templateData.periodoTipo === "rata") && (
          <Input
            value={templateData.periodo}
            onChange={(e) =>
              setTemplateData({
                ...templateData,
                periodo: e.target.value,
              })
            }
            placeholder={
              templateData.periodoTipo === "anno"
                ? "Esempio: saldo/acconto"
                : "Esempio: 1ª rata"
            }
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>Anno</Label>
        <Input
          type="number"
          value={templateData.anno}
          onChange={(e) =>
            setTemplateData({ ...templateData, anno: e.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Scadenza pagamento</Label>
        <Input
          type="date"
          value={templateData.dataScadenza}
          onChange={(e) =>
            setTemplateData({
              ...templateData,
              dataScadenza: e.target.value,
            })
          }
        />
      </div>
    </div>

    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id="associaRitenute"
          checked={templateData.associaRitenute}
          onCheckedChange={(checked) =>
            setTemplateData({
              ...templateData,
              associaRitenute: !!checked,
            })
          }
        />
        <Label htmlFor="associaRitenute" className="cursor-pointer">
          Associa anche ritenute d'acconto
        </Label>
      </div>

      <Button
        type="button"
        className="bg-blue-600 hover:bg-blue-700"
        onClick={() => generaMessaggioScadenza()
        disabled={!templateData.template}
      >
        Compila messaggio
      </Button>
    </div>
  </div>
)}

              {formData.tipo === "singola" && (
                <div className="space-y-2">
                  <Label htmlFor="destinatario">Destinatario</Label>
                <Select
  value={formData.destinatario_id}
  onValueChange={(value) => {
    const cliente = clienti.find((c) => c.id === value) as any;

    setFormData({
      ...formData,
      destinatario_id: value,
      destinatario_email:
        cliente?.email ||
        cliente?.email_amministrativa ||
        cliente?.pec ||
        "",
    });
  }}
>
  <SelectTrigger>
    <SelectValue placeholder="Seleziona cliente" />
  </SelectTrigger>
  <SelectContent>
    {clienti
      .filter((c) => c.attivo)
      .map((cliente) => (
        <SelectItem key={cliente.id} value={cliente.id}>
          {cliente.ragione_sociale}
        </SelectItem>
      ))}
  </SelectContent>
</Select>

{formData.destinatario_id && (
  <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
    Email destinatario:{" "}
    <span className="font-medium">
      {getClienteEmail(formData.destinatario_id)}
    </span>
  </div>
)}
                </div>
              )}

              {formData.tipo === "interna" && (
                <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="multiDestinatari"
                      checked={multiDestinatari}
                      onCheckedChange={(checked) => {
                        setMultiDestinatari(!!checked);
                        if (!checked) setSelectedDestinatari([]);
                      }}
                    />
                    <Label
                      htmlFor="multiDestinatari"
                      className="font-medium cursor-pointer"
                    >
                      Invio a più destinatari
                    </Label>
                  </div>

                  {multiDestinatari && (
                    <>
                      <div className="space-y-2">
                        <Label>Destinatari Multipli</Label>
                        <Input
                          placeholder="Cerca destinatari..."
                          value={searchDestinatari}
                          onChange={(e) =>
                            setSearchDestinatari(e.target.value)
                          }
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleSelezionaTuttiSettore("lavoro")
                          }
                        >
                          Settore Lavoro
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleSelezionaTuttiSettore("fiscale")
                          }
                        >
                          Settore Fiscale
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleSelezionaTuttiSettore("consulenza")
                          }
                        >
                          Settore Consulenza
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelezionaTuttiSettore("tutti")}
                        >
                          Tutti
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDeselezionaTutti}
                        >
                          Deseleziona Tutti
                        </Button>
                      </div>

                      <div className="border rounded-md max-h-[220px] overflow-y-auto p-2 bg-white">
                        {getUtentiFiltrati().map((utente) => (
                          <div
                            key={utente.id}
                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded"
                          >
                            <Checkbox
                              id={`utente-${utente.id}`}
                              checked={selectedDestinatari.includes(utente.id)}
                              onCheckedChange={() =>
                                handleDestinatarioToggle(utente.id)
                              }
                            />
                            <Label
                              htmlFor={`utente-${utente.id}`}
                              className="flex-1 cursor-pointer"
                            >
                              {utente.nome} {utente.cognome}
                              {utente.settore && (
                                <span className="text-gray-500 text-sm ml-1">
                                  ({utente.settore})
                                </span>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>

                      <div className="text-sm text-gray-600">
                        Selezionati:{" "}
                        <span className="font-medium">
                          {selectedDestinatari.length}
                        </span>{" "}
                        utenti
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="oggetto">Oggetto</Label>
                <Input
                  id="oggetto"
                  value={formData.oggetto}
                  onChange={(e) =>
                    setFormData({ ...formData, oggetto: e.target.value })
                  }
                  placeholder="Oggetto della mail..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="messaggio">Messaggio</Label>
                <Textarea
                  id="messaggio"
                  value={formData.messaggio}
                  onChange={(e) =>
                    setFormData({ ...formData, messaggio: e.target.value })
                  }
                  placeholder="Scrivi qui il tuo messaggio..."
                  rows={8}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="allegato">Allegato</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="allegato"
                    type="file"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {selectedFile && (
                    <Badge variant="secondary" className="px-2 py-1">
                      {selectedFile.name}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
               <Button
  type="button"
  variant="outline"
  onClick={() => {
    resetForm();
    setDialogOpen(false);
  }}
  disabled={sending}
>
  Annulla
</Button>
                <Button
                  type="submit"
                  disabled={sending}
                  className="bg-blue-600"
                >
                  {sending ? (
                    <>Invio in corso...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Invia Messaggio
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <CardTitle>Storico Comunicazioni</CardTitle>
            <div className="relative flex-1 max-w-sm ml-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cerca nello storico..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Oggetto</TableHead>
                <TableHead>Destinatari</TableHead>
                <TableHead>Allegati</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredComunicazioni.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Nessuna comunicazione trovata
                  </TableCell>
                </TableRow>
              ) : (
                filteredComunicazioni.map((comm) => (
                  <TableRow key={comm.id}>
                    <TableCell className="text-sm">
                      {comm.data_invio
                        ? new Date(comm.data_invio).toLocaleDateString("it-IT")
                        : "-"}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          comm.tipo === "newsletter"
                            ? "default"
                            : comm.tipo === "scadenze"
                              ? "destructive"
                              : comm.tipo === "interna"
                                ? "outline"
                                : "secondary"
                        }
                      >
                        {comm.tipo === "interna"
                          ? "INTERNA"
                          : String(comm.tipo || "").toUpperCase()}
                      </Badge>
                    </TableCell>

                    <TableCell className="font-medium">{comm.oggetto}</TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-gray-500" />
                        <span className="text-sm">
                          {comm.destinatari_count || 0}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {comm.allegati ? (
                        <Paperclip className="h-4 w-4 text-blue-600" />
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(comm.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

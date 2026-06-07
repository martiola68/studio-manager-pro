import { useEffect, useState } from "react";
import { Send } from "lucide-react";

import HeaderComunicazioni from "@/components/comunicazioni/HeaderComunicazioni";
import StoricoComunicazioni from "@/components/comunicazioni/StoricoComunicazioni";
import UploadAllegati from "@/components/comunicazioni/UploadAllegati";

import { comunicazioneService } from "@/services/comunicazioneService";
import { clienteService } from "@/services/clienteService";
import { emailService } from "@/services/emailService";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";

type Comunicazione = Database["public"]["Tables"]["tbcomunicazioni"]["Row"];
type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];

type ContattoOption = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
};

type AllegatoComunicazione = {
  nome: string;
  tipo: string;
  dimensione: number;
  bucket: string;
  path: string;
};

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
  { value: "ritenute", label: "Ritenute" },
  { value: "imu", label: "IMU" },
  { value: "f24_dipendenti", label: "F24 dipendenti" },
  { value: "imposte", label: "Imposte" },
  { value: "altro", label: "Altro / email libera" },
] as const;

const periodiIvaTrimestrale = [
  "1° trimestre",
  "2° trimestre",
  "3° trimestre",
  "Acconto",
  "4° trimestre",
];

const periodiImu = ["Giugno", "Dicembre"];

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

export default function ComunicazioniClientiPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

const [utenteInvio, setUtenteInvio] = useState({
  nomeCompleto: "",
  email: "",
  societa: "",
});

  const [comunicazioni, setComunicazioni] = useState<Comunicazione[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [searchClienti, setSearchClienti] = useState("");
  const [clientiResults, setClientiResults] = useState<Cliente[]>([]);

  const [searchContatti, setSearchContatti] = useState("");
  const [contattiResults, setContattiResults] = useState<ContattoOption[]>([]);

  const [formData, setFormData] = useState({
    destinatario_id: "",
    destinatario_cliente: "",
    destinatario_email: "",
    oggetto: "",
    messaggio: "",
  });

  const [templateData, setTemplateData] = useState({
    template: "" as TemplateScadenza | "",
    periodo: "",
    anno: String(new Date().getFullYear()),
    dataScadenza: "",
  });

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const supabase = getSupabaseClient();

const {
  data: { user },
} = await supabase.auth.getUser();

if (user?.id) {
  const { data: utente } = await supabase
    .from("tbutenti")
    .select("nome, cognome, email, studio_id, microsoft_connection_id")
    .eq("id", user.id)
    .maybeSingle();

let societa = "";

if (utente?.studio_id) {
  const { data: studio } = await supabase
    .from("tbstudio")
    .select("ragione_sociale, ragione_sociale_tenant2, microsoft_connection_id_tenant2")
    .eq("id", utente.studio_id)
    .maybeSingle();

  const isTenant2 =
    !!(utente as any)?.microsoft_connection_id &&
    !!(studio as any)?.microsoft_connection_id_tenant2 &&
    (utente as any).microsoft_connection_id ===
      (studio as any).microsoft_connection_id_tenant2;

  societa = isTenant2
    ? (studio as any)?.ragione_sociale_tenant2 || ""
    : (studio as any)?.ragione_sociale || "";
}

  setUtenteInvio({
    nomeCompleto: `${utente?.nome || ""} ${utente?.cognome || ""}`.trim(),
    email: utente?.email || user.email || "",
    societa,
  });
}

      const comunicazioniData = await comunicazioneService.getComunicazioni();

      setComunicazioni(
        comunicazioniData.filter(
          (c) => c.tipo === "singola" || c.tipo === "scadenze"
        )
      );
    } catch (error) {
      console.error(error);

      toast({
        title: "Errore",
        description: "Errore caricamento dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadAllegati = async (): Promise<AllegatoComunicazione[]> => {
    if (selectedFiles.length === 0) return [];

    const supabase = getSupabaseClient();
    const uploadedFiles: AllegatoComunicazione[] = [];

    for (const file of selectedFiles) {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const fileName = `${Date.now()}_${safeName}`;
      const filePath = `comunicazioni/${fileName}`;

      const { error } = await supabase.storage
        .from("messaggi-allegati")
        .upload(filePath, file);

      if (error) throw error;

      uploadedFiles.push({
        nome: file.name,
        tipo: file.type,
        dimensione: file.size,
        bucket: "messaggi-allegati",
        path: filePath,
      });
    }

    return uploadedFiles;
  };

  const loadClientiDestinatari = async (term: string) => {
    const supabase = getSupabaseClient();

    let query = supabase
      .from("tbclienti")
      .select("*")
      .eq("attivo", true)
      .limit(30);

    if (term.trim()) {
      query = query.ilike("ragione_sociale", `%${term}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      setClientiResults([]);
      return;
    }

    setClientiResults((data as Cliente[]) || []);
  };

  const loadContattiDestinatari = async (term: string) => {
    const supabase = getSupabaseClient();

    let query = supabase
      .from("tbcontatti")
      .select("id, nome, cognome, email")
      .not("email", "is", null)
      .limit(30);

    if (term.trim()) {
      query = query.or(
        `nome.ilike.%${term}%,cognome.ilike.%${term}%,email.ilike.%${term}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      setContattiResults([]);
      return;
    }

    setContattiResults((data as ContattoOption[]) || []);
  };

  const getContattoLabel = (contatto: ContattoOption) => {
    const fullName = `${contatto.cognome || ""} ${contatto.nome || ""}`.trim();
    return fullName || contatto.email || "Contatto";
  };

  const formatDateIT = (value: string) => {
    if (!value) return "[data scadenza]";

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "[data scadenza]";

    return d.toLocaleDateString("it-IT");
  };

  const getPeriodiDisponibili = () => {
    if (templateData.template === "iva_trimestrale") {
      return periodiIvaTrimestrale;
    }

    if (templateData.template === "imu") {
      return periodiImu;
    }

    return mesi;
  };

  const getDettaglioImu = () => {
    if (templateData.periodo === "Giugno") {
      return "Acconto / Unica soluzione";
    }

    if (templateData.periodo === "Dicembre") {
      return "Saldo";
    }

    return "";
  };

  const generaMessaggioScadenza = () => {
    const periodo = templateData.periodo || "[periodo]";
    const anno = templateData.anno || String(new Date().getFullYear());
    const scadenza = formatDateIT(templateData.dataScadenza);
    const cliente = formData.destinatario_cliente || "Cliente";

    let oggetto = "";
    let messaggio = "";

    if (templateData.template === "iva_trimestrale") {
      oggetto = `Invio modello F24 IVA - ${periodo} ${anno}`;
      messaggio = `Gentile ${cliente},

in allegato si trasmette il modello F24 relativo al pagamento dell'IVA del periodo ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.

Cordiali saluti`;
    }

    if (templateData.template === "iva_mensile") {
      oggetto = `Invio modello F24 IVA - mese di ${periodo} ${anno}`;
      messaggio = `Gentile ${cliente},

in allegato si trasmette il modello F24 relativo al pagamento IVA del mese di ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.

Cordiali saluti`;
    }

    if (templateData.template === "ritenute") {
      oggetto = `Invio modello F24 ritenute - ${periodo} ${anno}`;
      messaggio = `Gentile ${cliente},

in allegato si trasmette il modello F24 relativo alle ritenute del periodo ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.

Cordiali saluti`;
    }

    if (templateData.template === "imu") {
      const dettaglioImu = getDettaglioImu() || "[acconto/saldo]";
      oggetto = `Invio modello F24 IMU - ${dettaglioImu} ${anno}`;
      messaggio = `Gentile ${cliente},

in allegato si trasmette il modello F24 IMU relativo a ${dettaglioImu} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.

Cordiali saluti`;
    }

    if (templateData.template === "f24_dipendenti") {
      oggetto = `Invio F24 dipendenti - ${periodo} ${anno}`;
      messaggio = `Gentile ${cliente},

in allegato si trasmette il modello F24 dipendenti relativo al periodo ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.

Cordiali saluti`;
    }

    if (templateData.template === "imposte") {
      oggetto = `Invio F24 imposte - ${periodo} ${anno}`;
      messaggio = `Gentile ${cliente},

in allegato si trasmette il modello F24 relativo alle imposte per ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.

Cordiali saluti`;
    }

    if (templateData.template === "altro") {
      oggetto = "";
      messaggio = `Gentile ${cliente},

scrivi qui il testo della comunicazione.

Cordiali saluti`;
    }

    setFormData((prev) => ({
      ...prev,
      oggetto,
      messaggio,
    }));
  };
const buildEmailClienteHtml = (params: {
  cliente: string;
  messaggio: string;
  utenteNome: string;
  utenteEmail: string;
  societa: string;
}) => {
  const righe = params.messaggio
    .split("\n")
    .map((riga) => riga.trim())
    .filter(Boolean);

  return `
<div style="margin:0; padding:0; background:#ffffff; font-family:Arial, Helvetica, sans-serif; color:#111827;">
  <div style="max-width:720px; margin:0 auto; padding:24px 20px;">
    <div style="font-size:15px; line-height:1.7;">
      ${righe
        .map((riga) => `<p style="margin:0 0 14px 0;">${riga}</p>`)
        .join("")}
    </div>
  </div>
</div>
`.trim();
};

  const handleSubmit = async () => {
    try {
      if (!formData.destinatario_email || !formData.oggetto || !formData.messaggio) {
        toast({
          title: "Errore",
          description: "Compila tutti i campi obbligatori",
          variant: "destructive",
        });

        return;
      }

      setSending(true);

      const allegati =
        selectedFiles.length > 0 ? await uploadAllegati() : [];

      const tipoComunicazione =
        templateData.template === "altro" ? "singola" : "scadenze";

      await comunicazioneService.createComunicazione({
        tipo: tipoComunicazione,
        oggetto: formData.oggetto,
        messaggio: formData.messaggio,
        allegati,
        destinatari_count: 1,
        stato: "Inviata",
        data_invio: new Date().toISOString(),
      });

 const messaggioHtml = buildEmailClienteHtml({
  cliente: formData.destinatario_cliente,
  messaggio: formData.messaggio,
  utenteNome: utenteInvio.nomeCompleto,
  utenteEmail: utenteInvio.email,
  societa: utenteInvio.societa,
});

const emailResult = await emailService.sendComunicazioneEmail({
  tipo: "singola",
  destinatarioId: formData.destinatario_id,
  destinatarioEmail: formData.destinatario_email,
  oggetto: formData.oggetto,
  messaggio: messaggioHtml,
  allegati,
});

console.log("RISULTATO INVIO EMAIL CLIENTE", emailResult);

if (!emailResult?.success) {
  toast({
    title: "Email non inviata",
    description: emailResult?.error || "Errore sconosciuto durante l'invio",
    variant: "destructive",
  });
  return;
}

      toast({
        title: "Comunicazione inviata",
      });

      setFormData({
        destinatario_id: "",
        destinatario_cliente: "",
        destinatario_email: "",
        oggetto: "",
        messaggio: "",
      });

      setTemplateData({
        template: "",
        periodo: "",
        anno: String(new Date().getFullYear()),
        dataScadenza: "",
      });

      setSearchClienti("");
      setSearchContatti("");
      setClientiResults([]);
      setContattiResults([]);
      setSelectedFiles([]);

      await loadData();
    } catch (error) {
      console.error(error);

      toast({
        title: "Errore",
        description: "Errore invio comunicazione",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await comunicazioneService.deleteComunicazione(id);

      toast({
        title: "Comunicazione eliminata",
      });

      await loadData();
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Caricamento...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-1 md:px-8 md:pb-8 md:pt-2">
      <HeaderComunicazioni
        titolo="Comunicazioni Clienti"
        descrizione="Invio comunicazioni singole e avvisi scadenze"
      />

      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Nuova Comunicazione</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Cliente</Label>

                <div className="flex gap-2">
                  <Input
                    value={searchClienti}
                    onChange={(e) => setSearchClienti(e.target.value)}
                    placeholder="Cerca cliente..."
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => loadClientiDestinatari(searchClienti)}
                  >
                    Cerca
                  </Button>
                </div>

                {clientiResults.length > 0 && (
                  <div className="max-h-[140px] overflow-y-auto rounded-md border bg-white">
                    {clientiResults.map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            destinatario_id: cliente.id,
                            destinatario_cliente: cliente.ragione_sociale || "",
                          }));
                          setSearchClienti(cliente.ragione_sociale || "");
                          setClientiResults([]);
                        }}
                      >
                        <span>{cliente.ragione_sociale}</span>

                        {formData.destinatario_id === cliente.id && (
                          <Badge>Selezionato</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Contatto Email</Label>

                <div className="flex gap-2">
                  <Input
                    value={searchContatti}
                    onChange={(e) => setSearchContatti(e.target.value)}
                    placeholder="Cerca contatto..."
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => loadContattiDestinatari(searchContatti)}
                  >
                    Cerca
                  </Button>
                </div>

                {contattiResults.length > 0 && (
                  <div className="max-h-[140px] overflow-y-auto rounded-md border bg-white">
                    {contattiResults.map((contatto) => (
                      <button
                        key={contatto.id}
                        type="button"
                        className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            destinatario_email: contatto.email || "",
                          }));
                          setSearchContatti(contatto.email || "");
                          setContattiResults([]);
                        }}
                      >
                        <span>
                          {getContattoLabel(contatto)}
                          <span className="ml-2 text-gray-500">
                            {contatto.email}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Email destinatario *</Label>

                <Input
                  type="email"
                  value={formData.destinatario_email}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      destinatario_email: e.target.value,
                    }))
                  }
                  placeholder="email@cliente.it"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Template comunicazione</Label>

              <div className="flex flex-wrap items-center gap-2">
                {templateScadenze.map((template) => (
                  <Button
                    key={template.value}
                    type="button"
                    variant={
                      templateData.template === template.value
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      setTemplateData((prev) => ({
                        ...prev,
                        template: template.value as TemplateScadenza,
                        periodo: "",
                      }))
                    }
                  >
                    {template.label}
                  </Button>
                ))}

                <Button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={generaMessaggioScadenza}
                  disabled={!templateData.template}
                >
                  {templateData.template === "altro"
                    ? "Prepara email"
                    : "Genera messaggio"}
                </Button>
              </div>
            </div>

            {templateData.template !== "altro" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Periodo</Label>

                  <Select
                    value={templateData.periodo}
                    onValueChange={(value) =>
                      setTemplateData((prev) => ({
                        ...prev,
                        periodo: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona periodo" />
                    </SelectTrigger>

                    <SelectContent>
                      {getPeriodiDisponibili().map((periodo) => (
                        <SelectItem key={periodo} value={periodo}>
                          {periodo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Anno</Label>

                  <Input
                    value={templateData.anno}
                    onChange={(e) =>
                      setTemplateData((prev) => ({
                        ...prev,
                        anno: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data Scadenza</Label>

                  <Input
                    type="date"
                    value={templateData.dataScadenza}
                    onChange={(e) =>
                      setTemplateData((prev) => ({
                        ...prev,
                        dataScadenza: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Oggetto</Label>

              <Input
                value={formData.oggetto}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    oggetto: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Messaggio</Label>

              <Textarea
                rows={9}
                value={formData.messaggio}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    messaggio: e.target.value,
                  }))
                }
              />
            </div>

            <UploadAllegati files={selectedFiles} onChange={setSelectedFiles} />

            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={sending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Invio..." : "Invia Comunicazione"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <StoricoComunicazioni comunicazioni={comunicazioni} onDelete={handleDelete} />
      </div>
    </div>
  );
}

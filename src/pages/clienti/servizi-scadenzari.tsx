import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { getSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Mail,
  Save,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ClienteLite = {
  id: string;
  studio_id: string;
  cod_cliente: string | null;
  ragione_sociale: string | null;
  codice_fiscale: string | null;
  partita_iva: string | null;
  cliente?: boolean | null;
  attivo?: boolean | null;
};

type ServiziCliente = {
  id?: string;

  studio_id: string;
  cliente_id: string;

  contabilita: boolean;
  consulenza: boolean;
  paghe: boolean;
  consulenza_lavoro: boolean;

  flag_iva: boolean;
  flag_cu: boolean;
  flag_bilancio: boolean;
  flag_fiscali: boolean;
  flag_lipe: boolean;
  flag_770: boolean;
  flag_esterometro: boolean;
  flag_ccgg: boolean;
  flag_proforma: boolean;
  flag_imu: boolean;

  flag_mail_scadenze: boolean;

  gestione_esterometro: boolean;
  note_esterometro: string;
};

const initialServizi: ServiziCliente = {
  studio_id: "",
  cliente_id: "",

  contabilita: false,
  consulenza: false,
  paghe: false,
  consulenza_lavoro: false,

  flag_iva: false,
  flag_cu: false,
  flag_bilancio: false,
  flag_fiscali: false,
  flag_lipe: false,
  flag_770: false,
  flag_esterometro: false,
  flag_ccgg: false,
  flag_proforma: false,
  flag_imu: false,

  flag_mail_scadenze: false,

  gestione_esterometro: false,
  note_esterometro: "",
};

type BooleanField =
  | "contabilita"
  | "consulenza"
  | "paghe"
  | "consulenza_lavoro"
  | "flag_iva"
  | "flag_cu"
  | "flag_bilancio"
  | "flag_fiscali"
  | "flag_lipe"
  | "flag_770"
  | "flag_esterometro"
  | "flag_ccgg"
  | "flag_proforma"
  | "flag_imu"
  | "flag_mail_scadenze"
  | "gestione_esterometro";

const serviziOptions: Array<{
  key: BooleanField;
  label: string;
  description: string;
}> = [
  {
    key: "contabilita",
    label: "Contabilità",
    description:
      "Gestione contabile ordinaria o semplificata del cliente.",
  },
  {
    key: "consulenza",
    label: "Consulenza",
    description:
      "Attività di consulenza professionale generale.",
  },
  {
    key: "paghe",
    label: "Paghe",
    description:
      "Elaborazione paghe e adempimenti del personale.",
  },
  {
    key: "consulenza_lavoro",
    label: "Consulenza del lavoro",
    description:
      "Consulenza e assistenza in materia di lavoro.",
  },
];

const scadenzariOptions: Array<{
  key: BooleanField;
  label: string;
}> = [
  {
    key: "flag_iva",
    label: "IVA",
  },
  {
    key: "flag_lipe",
    label: "LIPE",
  },
  {
    key: "flag_cu",
    label: "CU – Certificazione Unica",
  },
  {
    key: "flag_bilancio",
    label: "Bilanci",
  },
  {
    key: "flag_fiscali",
    label: "Fiscali",
  },
  {
    key: "flag_770",
    label: "Modello 770",
  },
  {
    key: "flag_esterometro",
    label: "Esterometro",
  },
  {
    key: "flag_ccgg",
    label: "Concessioni governative",
  },
  {
    key: "flag_proforma",
    label: "Proforma",
  },
  {
    key: "flag_imu",
    label: "IMU",
  },
];

export default function ServiziScadenzariClientePage() {
  const router = useRouter();
  const { toast } = useToast();

  const clienteId =
    typeof router.query.cliente_id === "string"
      ? router.query.cliente_id
      : "";

  const [cliente, setCliente] =
    useState<ClienteLite | null>(null);

  const [formData, setFormData] =
    useState<ServiziCliente>(initialServizi);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    if (!clienteId) {
      setLoading(false);

      toast({
        title: "Errore",
        description:
          "Cliente non specificato.",
        variant: "destructive",
      });

      return;
    }

    void loadData();
  }, [router.isReady, clienteId]);

  const loadData = async () => {
    const supabase =
      getSupabaseClient();

    try {
      setLoading(true);

      /*
       * Recuperiamo prima il cliente.
       */
      const {
        data: clienteData,
        error: clienteError,
      } = await supabase
        .from("tbclienti")
        .select(`
          id,
          studio_id,
          cod_cliente,
          ragione_sociale,
          codice_fiscale,
          partita_iva,
          cliente,
          attivo
        `)
        .eq("id", clienteId)
        .maybeSingle();

      if (
        clienteError ||
        !clienteData
      ) {
        throw new Error(
          clienteError?.message ||
            "Cliente non trovato."
        );
      }

      const clienteLetto =
        clienteData as ClienteLite;

      /*
       * Questa pagina può essere utilizzata
       * soltanto per veri clienti.
       */
      if (
        clienteLetto.cliente !== true
      ) {
        throw new Error(
          "Il nominativo selezionato non è un cliente dello studio."
        );
      }

      setCliente(clienteLetto);

      /*
       * Recuperiamo la configurazione già
       * presente nella nuova tabella.
       */
      const {
        data: serviziData,
        error: serviziError,
      } = await (supabase as any)
        .from("tbclienti_servizi")
        .select("*")
        .eq(
          "cliente_id",
          clienteLetto.id
        )
        .eq(
          "studio_id",
          clienteLetto.studio_id
        )
        .maybeSingle();

      if (serviziError) {
        throw serviziError;
      }

      if (serviziData) {
        setFormData({
          id:
            serviziData.id,

          studio_id:
            clienteLetto.studio_id,

          cliente_id:
            clienteLetto.id,

          contabilita:
            Boolean(
              serviziData.contabilita
            ),

          consulenza:
            Boolean(
              serviziData.consulenza
            ),

          paghe:
            Boolean(
              serviziData.paghe
            ),

          consulenza_lavoro:
            Boolean(
              serviziData.consulenza_lavoro
            ),

          flag_iva:
            Boolean(
              serviziData.flag_iva
            ),

          flag_cu:
            Boolean(
              serviziData.flag_cu
            ),

          flag_bilancio:
            Boolean(
              serviziData.flag_bilancio
            ),

          flag_fiscali:
            Boolean(
              serviziData.flag_fiscali
            ),

          flag_lipe:
            Boolean(
              serviziData.flag_lipe
            ),

          flag_770:
            Boolean(
              serviziData.flag_770
            ),

          flag_esterometro:
            Boolean(
              serviziData.flag_esterometro
            ),

          flag_ccgg:
            Boolean(
              serviziData.flag_ccgg
            ),

          flag_proforma:
            Boolean(
              serviziData.flag_proforma
            ),

          flag_imu:
            Boolean(
              serviziData.flag_imu
            ),

          flag_mail_scadenze:
            Boolean(
              serviziData.flag_mail_scadenze
            ),

          gestione_esterometro:
            Boolean(
              serviziData.gestione_esterometro
            ),

          note_esterometro:
            String(
              serviziData.note_esterometro ||
                ""
            ),
        });
      } else {
        /*
         * Compatibilità: nel caso in cui
         * la migrazione non abbia creato
         * ancora la riga, predisponiamo
         * una nuova configurazione.
         */
        setFormData({
          ...initialServizi,

          studio_id:
            clienteLetto.studio_id,

          cliente_id:
            clienteLetto.id,
        });
      }
    } catch (error: any) {
      console.error(
        "Errore caricamento servizi cliente:",
        error
      );

      toast({
        title: "Errore",
        description:
          error?.message ||
          "Impossibile caricare i servizi del cliente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleField = (
    field: BooleanField,
    checked: boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: checked,
    }));
  };

  const handleSave = async () => {
    if (
      !cliente ||
      !formData.studio_id ||
      !formData.cliente_id
    ) {
      toast({
        title: "Errore",
        description:
          "Dati del cliente incompleti.",
        variant: "destructive",
      });

      return;
    }

    const supabase =
      getSupabaseClient();

    try {
      setSaving(true);

      const payload = {
        studio_id:
          formData.studio_id,

        cliente_id:
          formData.cliente_id,

        contabilita:
          formData.contabilita,

        consulenza:
          formData.consulenza,

        paghe:
          formData.paghe,

        consulenza_lavoro:
          formData.consulenza_lavoro,

        flag_iva:
          formData.flag_iva,

        flag_cu:
          formData.flag_cu,

        flag_bilancio:
          formData.flag_bilancio,

        flag_fiscali:
          formData.flag_fiscali,

        flag_lipe:
          formData.flag_lipe,

        flag_770:
          formData.flag_770,

        flag_esterometro:
          formData.flag_esterometro,

        flag_ccgg:
          formData.flag_ccgg,

        flag_proforma:
          formData.flag_proforma,

        flag_imu:
          formData.flag_imu,

        flag_mail_scadenze:
          formData.flag_mail_scadenze,

        gestione_esterometro:
          formData.gestione_esterometro,

        note_esterometro:
          formData.note_esterometro
            .trim() || null,

        updated_at:
          new Date().toISOString(),
      };

      const {
        data,
        error,
      } = await (supabase as any)
        .from("tbclienti_servizi")
        .upsert(
          payload,
          {
            onConflict:
              "studio_id,cliente_id",
          }
        )
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      setFormData((prev) => ({
        ...prev,
        id: data?.id || prev.id,
      }));

      toast({
        title: "Successo",
        description:
          "Servizi e scadenzari aggiornati correttamente.",
      });
    } catch (error: any) {
      console.error(
        "Errore salvataggio servizi cliente:",
        error
      );

      toast({
        title: "Errore",
        description:
          error?.message ||
          "Impossibile salvare i servizi del cliente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        Caricamento...
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="p-6 space-y-4">
        <p>
          Cliente non disponibile.
        </p>

        <Button
          variant="outline"
          onClick={() =>
            router.push("/clienti")
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna ai clienti
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Servizi e scadenzari
          </h1>

          <p className="text-muted-foreground">
            Configurazione operativa del cliente
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() =>
            router.push("/clienti")
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna ai clienti
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Cliente
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">
                Codice cliente
              </div>

              <div className="font-semibold">
                {cliente.cod_cliente || "-"}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground">
                Ragione sociale
              </div>

              <div className="font-semibold">
                {cliente.ragione_sociale || "-"}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">
                Stato
              </div>

              <div className="font-semibold">
                {cliente.attivo
                  ? "Attivo"
                  : "Inattivo"}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground">
                Codice fiscale
              </div>

              <div className="font-semibold">
                {cliente.codice_fiscale || "-"}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground">
                Partita IVA
              </div>

              <div className="font-semibold">
                {cliente.partita_iva || "-"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BriefcaseBusiness className="h-5 w-5" />
            Servizi dello studio
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {serviziOptions.map(
              (option) => (
                <div
                  key={option.key}
                  className="flex items-start gap-3 rounded-lg border p-4"
                >
                  <Checkbox
                    id={option.key}
                    checked={
                      Boolean(
                        formData[
                          option.key
                        ]
                      )
                    }
                    onCheckedChange={(
                      checked
                    ) =>
                      toggleField(
                        option.key,
                        checked === true
                      )
                    }
                  />

                  <div className="space-y-1">
                    <Label
                      htmlFor={option.key}
                      className="cursor-pointer font-semibold"
                    >
                      {option.label}
                    </Label>

                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Scadenzari attivi
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scadenzariOptions.map(
              (option) => (
                <div
                  key={option.key}
                  className="flex items-center gap-3 rounded-lg border p-4"
                >
                  <Checkbox
                    id={option.key}
                    checked={
                      Boolean(
                        formData[
                          option.key
                        ]
                      )
                    }
                    onCheckedChange={(
                      checked
                    ) =>
                      toggleField(
                        option.key,
                        checked === true
                      )
                    }
                  />

                  <Label
                    htmlFor={option.key}
                    className="cursor-pointer font-medium"
                  >
                    {option.label}
                  </Label>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Gestione Esterometro
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="gestione_esterometro"
              checked={
                formData.gestione_esterometro
              }
              onCheckedChange={(checked) =>
                toggleField(
                  "gestione_esterometro",
                  checked === true
                )
              }
            />

            <Label
              htmlFor="gestione_esterometro"
              className="cursor-pointer"
            >
              Abilita gestione specifica Esterometro
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note_esterometro">
              Note Esterometro
            </Label>

            <Textarea
              id="note_esterometro"
              value={
                formData.note_esterometro
              }
              disabled={
                !formData.gestione_esterometro
              }
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  note_esterometro:
                    event.target.value,
                }))
              }
              placeholder="Inserisci eventuali indicazioni operative..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Comunicazioni
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="flag_mail_scadenze"
              checked={
                formData.flag_mail_scadenze
              }
              onCheckedChange={(checked) =>
                toggleField(
                  "flag_mail_scadenze",
                  checked === true
                )
              }
            />

            <div className="space-y-1">
              <Label
                htmlFor="flag_mail_scadenze"
                className="cursor-pointer font-semibold"
              >
                Abilita email relative alle scadenze
              </Label>

              <p className="text-sm text-muted-foreground">
                Consente l’invio delle comunicazioni automatiche
                collegate agli scadenzari del cliente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          disabled={saving}
          onClick={() =>
            router.push("/clienti")
          }
        >
          Annulla
        </Button>

        <Button
          disabled={
            saving ||
            cliente.attivo !== true
          }
          onClick={handleSave}
        >
          <Save className="mr-2 h-4 w-4" />

          {saving
            ? "Salvataggio..."
            : "Salva configurazione"}
        </Button>
      </div>

      {cliente.attivo !== true && (
        <p className="text-right text-sm font-medium text-amber-700">
          Il cliente è inattivo. La configurazione può essere
          consultata ma non modificata.
        </p>
      )}
    </div>
  );
}

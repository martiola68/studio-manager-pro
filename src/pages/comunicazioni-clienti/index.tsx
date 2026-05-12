import { useEffect, useState } from "react";

import { Send } from "lucide-react";

import HeaderComunicazioni from "@/components/comunicazioni/HeaderComunicazioni";
import SimulazioneInvio from "@/components/comunicazioni/SimulazioneInvio";
import StoricoComunicazioni from "@/components/comunicazioni/StoricoComunicazioni";
import UploadAllegati from "@/components/comunicazioni/UploadAllegati";

import { comunicazioneService } from "@/services/comunicazioneService";
import { clienteService } from "@/services/clienteService";
import { emailService } from "@/services/emailService";

import { getSupabaseClient } from "@/lib/supabase/client";

import type { Database } from "@/lib/supabase/types";

import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";

type Comunicazione =
  Database["public"]["Tables"]["tbcomunicazioni"]["Row"];

type Cliente =
  Database["public"]["Tables"]["tbclienti"]["Row"];

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
  {
    value: "iva_trimestrale",
    label: "IVA trimestrale",
  },
  {
    value: "iva_mensile",
    label: "IVA mensile",
  },
  {
    value: "ritenute",
    label: "Ritenute",
  },
  {
    value: "imu",
    label: "IMU",
  },
  {
    value: "f24_dipendenti",
    label: "F24 dipendenti",
  },
  {
    value: "imposte",
    label: "Imposte",
  },
  {
    value: "altro",
    label: "Altro",
  },
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

export default function ComunicazioniClientiPage() {
  const { toast } = useToast();

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [modalita, setModalita] =
    useState<
      "singola" | "scadenze"
    >("singola");

  const [comunicazioni, setComunicazioni] =
    useState<Comunicazione[]>([]);

  const [clienti, setClienti] =
    useState<Cliente[]>([]);

  const [selectedFiles, setSelectedFiles] =
    useState<File[]>([]);

  const [simulazioneInvio, setSimulazioneInvio] =
    useState(true);

  const [searchClienti, setSearchClienti] =
    useState("");

  const [clientiResults, setClientiResults] =
    useState<Cliente[]>([]);

  const [searchContatti, setSearchContatti] =
    useState("");

  const [contattiResults, setContattiResults] =
    useState<ContattoOption[]>([]);

  const [formData, setFormData] =
    useState({
      destinatario_id: "",
      destinatario_cliente:
        "",
      destinatario_email:
        "",
      oggetto: "",
      messaggio: "",
    });

  const [templateData, setTemplateData] =
    useState({
      template:
        "" as TemplateScadenza | "",
      periodoTipo:
        "mese" as
          | "mese"
          | "trimestre"
          | "anno"
          | "rata",
      periodo: "",
      anno: String(
        new Date().getFullYear()
      ),
      dataScadenza: "",
      associaRitenute: false,
    });

  useEffect(() => {
    void loadData();
  }, []);
const loadData = async () => {
    try {
      setLoading(true);

      const [
        comunicazioniData,
        clientiData,
      ] = await Promise.all([
        comunicazioneService.getComunicazioni(),
        clienteService.getClienti(),
      ]);

      setComunicazioni(
        comunicazioniData.filter(
          (c) =>
            c.tipo === "singola" ||
            c.tipo === "scadenze"
        )
      );

      setClienti(clientiData);
    } catch (error) {
      console.error(error);

      toast({
        title: "Errore",
        description:
          "Errore caricamento dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadAllegati =
    async (): Promise<
      AllegatoComunicazione[]
    > => {
      if (selectedFiles.length === 0) {
        return [];
      }

      const supabase =
        getSupabaseClient();

      const uploadedFiles:
        AllegatoComunicazione[] =
        [];

      for (const file of selectedFiles) {
        const safeName =
          file.name.replace(
            /[^\w.\-]+/g,
            "_"
          );

        const fileName = `${Date.now()}_${safeName}`;

        const filePath = `comunicazioni/${fileName}`;

        const { error } =
          await supabase.storage
            .from("messaggi-allegati")
            .upload(
              filePath,
              file
            );

        if (error) {
          throw error;
        }

        uploadedFiles.push({
          nome: file.name,
          tipo: file.type,
          dimensione:
            file.size,
          bucket:
            "messaggi-allegati",
          path: filePath,
        });
      }

      return uploadedFiles;
    };

  const loadClientiDestinatari =
    async (
      term: string
    ) => {
      const supabase =
        getSupabaseClient();

      let query =
        supabase
          .from("tbclienti")
          .select("*")
          .eq("attivo", true)
          .limit(30);

      if (term.trim()) {
        query = query.ilike(
          "ragione_sociale",
          `%${term}%`
        );
      }

      const { data } =
        await query;

      setClientiResults(
        (data as Cliente[]) ||
          []
      );
    };

  const loadContattiDestinatari =
    async (
      term: string
    ) => {
      const supabase =
        getSupabaseClient();

      let query =
        supabase
          .from("tbcontatti")
          .select(
            "id, nome, cognome, email"
          )
          .not(
            "email",
            "is",
            null
          )
          .limit(30);

      if (term.trim()) {
        query = query.or(
          `nome.ilike.%${term}%,cognome.ilike.%${term}%,email.ilike.%${term}%`
        );
      }

      const { data } =
        await query;

      setContattiResults(
        (data as ContattoOption[]) ||
          []
      );
    };

  const getContattoLabel = (
    contatto: ContattoOption
  ) => {
    return `${contatto.cognome || ""} ${
      contatto.nome || ""
    }`.trim();
  };

  const formatDateIT = (
    value: string
  ) => {
    if (!value)
      return "[data scadenza]";

    const d = new Date(value);

    return d.toLocaleDateString(
      "it-IT"
    );
  };

  const getTemplateLabel = (
    value: string
  ) => {
    return (
      templateScadenze.find(
        (t) =>
          t.value === value
      )?.label || ""
    );
  };

  const generaMessaggioScadenza =
    (
      data = templateData
    ) => {
      const tipoLabel =
        getTemplateLabel(
          data.template
        );

      const periodo =
        data.periodo;

      const anno =
        data.anno;

      const scadenza =
        formatDateIT(
          data.dataScadenza
        );

      let oggetto = "";

      let messaggio = "";

      if (
        data.template ===
        "iva_trimestrale"
      ) {
        oggetto = `Invio modello F24 IVA - ${periodo} ${anno}`;

        messaggio = `Gentile ${formData.destinatario_cliente},

in allegato si trasmette il modello F24 relativo al pagamento dell'IVA del periodo ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.

Cordiali saluti`;
      }

      if (
        data.template ===
        "iva_mensile"
      ) {
        oggetto = `Invio modello F24 IVA - mese di ${periodo} ${anno}`;

        messaggio = `Gentile ${formData.destinatario_cliente},

in allegato si trasmette il modello F24 relativo al pagamento IVA del mese di ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.

Cordiali saluti`;
      }

      if (
        data.template ===
        "ritenute"
      ) {
        oggetto = `Invio modello F24 ritenute - ${periodo} ${anno}`;

        messaggio = `Gentile ${formData.destinatario_cliente},

in allegato si trasmette il modello F24 relativo alle ritenute del periodo ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.

Cordiali saluti`;
      }

      if (
        data.template ===
        "imu"
      ) {
        oggetto = `Invio modello F24 IMU - ${periodo} ${anno}`;

        messaggio = `Gentile ${formData.destinatario_cliente},

in allegato si trasmette il modello F24 IMU relativo al periodo ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.

Cordiali saluti`;
      }

      if (
        data.template ===
        "f24_dipendenti"
      ) {
        oggetto = `Invio F24 dipendenti - ${periodo} ${anno}`;

        messaggio = `Gentile ${formData.destinatario_cliente},

in allegato si trasmette il modello F24 dipendenti relativo al periodo ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.

Cordiali saluti`;
      }

      if (
        data.template ===
        "imposte"
      ) {
        oggetto = `Invio F24 imposte - ${periodo} ${anno}`;

        messaggio = `Gentile ${formData.destinatario_cliente},

in allegato si trasmette il modello F24 relativo alle imposte per ${periodo} ${anno}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.

Cordiali saluti`;
      }

      if (
        data.template ===
        "altro"
      ) {
        oggetto = `Invio modello F24 - ${tipoLabel}`;

        messaggio = `Gentile ${formData.destinatario_cliente},

in allegato si trasmette il modello F24 relativo alla scadenza ${tipoLabel}.

Il versamento dovrà essere effettuato entro il giorno ${scadenza}.

Cordiali saluti`;
      }

      setFormData({
        ...formData,
        oggetto,
        messaggio,
      });
    };

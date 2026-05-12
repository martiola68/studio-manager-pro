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

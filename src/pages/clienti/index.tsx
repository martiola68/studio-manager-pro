import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

import {
  Users,
  Edit,
  Trash2,
  Search,
  Plus,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Lock,
  Unlock,
} from "lucide-react";

import { clienteService } from "@/services/clienteService";
import { contattoService } from "@/services/contattoService";
import { utenteService } from "@/services/utenteService";
import { cassettiFiscaliService } from "@/services/cassettiFiscaliService";
import { useStudio } from "@/contexts/StudioContext";

import {
  isEncryptionEnabled,
  isEncryptionLocked,
  encryptClienteSensitiveData,
  decryptClienteSensitiveData,
  unlockCassetti,
  lockCassetti,
} from "@/services/encryptionService";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type CassettoFiscale =
  Database["public"]["Tables"]["tbcassetti_fiscali"]["Row"];
type Prestazione = Database["public"]["Tables"]["tbprestazioni"]["Row"];

type ScadenzariSelezionati = {
  iva: boolean;
  cu: boolean;
  bilancio: boolean;
  fiscali: boolean;
  lipe: boolean;
  modello_770: boolean;
  esterometro: boolean;
  ccgg: boolean;
  proforma: boolean;
  imu: boolean;
};

type ClienteFormData = {
  cod_cliente: string;
  tipo_cliente: string;
  tipologia_cliente: "Interno" | "Esterno";
  settore_fiscale: boolean;
  settore_lavoro: boolean;
  settore_consulenza: boolean;
  ragione_sociale: string;
  partita_iva: string;
  codice_fiscale: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
  email: string;
  attivo: boolean;
  cassetto_fiscale_id: string;

  matricola_inps: string;
  pat_inail: string;
  codice_ditta_ce: string;

  utente_operatore_id: string;
  utente_professionista_id: string;
  utente_payroll_id: string;
  professionista_payroll_id: string;

  contatto1_id: string;
  referente_esterno: string;

  tipo_prestazione_id: string;
  tipo_redditi?: "USC" | "USP" | "ENC" | "UPF" | "730";

  note: string;

  // comunicazioni (NEL form, così si salvano sempre)
  flag_mail_attivo: boolean;
  flag_mail_scadenze: boolean;
  flag_mail_newsletter: boolean;
};

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const initialFormData: ClienteFormData = {
  cod_cliente: "",
  tipo_cliente: "Persona fisica",
  tipologia_cliente: "Interno",
  settore_fiscale: true,
  settore_lavoro: false,
  settore_consulenza: false,
  ragione_sociale: "",
  partita_iva: "",
  codice_fiscale: "",
  indirizzo: "",
  cap: "",
  citta: "",
  provincia: "",
  email: "",
  attivo: true,
  cassetto_fiscale_id: "",

  matricola_inps: "",
  pat_inail: "",
  codice_ditta_ce: "",

  utente_operatore_id: "",
  utente_professionista_id: "",
  utente_payroll_id: "",
  professionista_payroll_id: "",

  contatto1_id: "",
  referente_esterno: "",

  tipo_prestazione_id: "",
  tipo_redditi: undefined,

  note: "",

  flag_mail_attivo: false,
  flag_mail_scadenze: false,
  flag_mail_newsletter: false,
};

const initialScadenzari: ScadenzariSelezionati = {
  iva: false,
  cu: false,
  bilancio: false,
  fiscali: false,
  lipe: false,
  modello_770: false,
  esterometro: false,
  ccgg: false,
  proforma: false,
  imu: false,
};

const SCADENZARI_OPTIONS: Array<{
  key: keyof ScadenzariSelezionati;
  label: string;
}> = [
  { key: "iva", label: "IVA" },
  { key: "lipe", label: "LIPE" },
  { key: "cu", label: "CU (Certificazione Unica)" },
  { key: "bilancio", label: "Bilanci" },
  { key: "fiscali", label: "Fiscali" },
  { key: "modello_770", label: "770" },
  { key: "esterometro", label: "Esterometro" },
  { key: "ccgg", label: "CCGG" },
  { key: "proforma", label: "Proforma" },
  { key: "imu", label: "IMU" },
];

export default function ClientiPage() {
  const { toast } = useToast();
  const { studioId } = useStudio();

  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [contatti, setContatti] = useState<Contatto[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [cassettiFiscali, setCassettiFiscali] = useState<CassettoFiscale[]>([]);
  const [prestazioni, setPrestazioni] = useState<Prestazione[]>([]);

  const [loading, setLoading] = useState(true);

  const [vistaClienti, setVistaClienti] = useState<
    "clienti" | "elenco_generale"
  >("clienti");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string>("Tutti");
  const [selectedUtenteFiscale, setSelectedUtenteFiscale] =
    useState<string>("all");
  const [selectedUtentePayroll, setSelectedUtentePayroll] =
    useState<string>("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  // form states
  const [formData, setFormData] = useState<ClienteFormData>(initialFormData);
  const [scadenzari, setScadenzari] =
    useState<ScadenzariSelezionati>(initialScadenzari);

  // encryption
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [encryptionLocked, setEncryptionLocked] = useState(true);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");

  const clientiConCassetto = useMemo(
    () => clienti.filter((c) => c.cassetto_fiscale_id).length,
    [clienti]
  );

  const percentualeCassetto = useMemo(() => {
    if (!clienti.length) return 0;
    return Math.round((clientiConCassetto / clienti.length) * 100);
  }, [clienti.length, clientiConCassetto]);

  const getUtenteNome = useCallback(
    (utenteId: string | null): string => {
      if (!utenteId) return "-";
      const utente = utenti.find((u) => u.id === utenteId);
      return utente ? `${utente.nome} ${utente.cognome}` : "-";
    },
    [utenti]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

  const supabase = getSupabaseClient();
      const [clientiData, contattiData, utentiData, cassettiData, prestazioniRes] =
        await Promise.all([
          clienteService.getClienti(),
          contattoService.getContatti(),
          utenteService.getUtenti(),
          cassettiFiscaliService.getCassettiFiscali(),
          supabase.from("tbprestazioni").select("*").order("descrizione"),
        ]);

      setClienti(clientiData ?? []);
      setContatti(contattiData ?? []);
      setUtenti(utentiData ?? []);
      setCassettiFiscali((cassettiData ?? []) as CassettoFiscale[]);
      setPrestazioni(prestazioniRes.data ?? []);
    } catch (error) {
      console.error("Errore caricamento dati:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();

    const checkEncryption = async () => {
      const enabled = await isEncryptionEnabled(studioId || "");
      const locked = isEncryptionLocked();
      setEncryptionEnabled(enabled);
      setEncryptionLocked(locked);
    };

    checkEncryption();
  }, [studioId, loadData]);

  // ✅ FUORI da useMemo (era il bug principale)
  const toggleClienteFlag = useCallback(
    async (
      clienteId: string,
      field:
        | "flag_iva"
        | "flag_lipe"
        | "flag_bilancio"
        | "flag_770"
        | "flag_imu"
        | "flag_cu"
        | "flag_fiscali"
        | "flag_esterometro"
        | "flag_ccgg",
      nextValue: boolean
    ) => {
      // 1) UI ottimistica
      setClienti((prev) =>
        prev.map((c) =>
          c.id === clienteId ? ({ ...c, [field]: nextValue } as any) : c
        )
      );

      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase
          .from("tbclienti")
          .update({ [field]: nextValue } as any)
          .eq("id", clienteId);

        if (error) throw error;

        toast({
          title: "Aggiornato",
          description: "Scadenzario aggiornato correttamente",
        });
      } catch (e: any) {
        // rollback UI se fallisce
        setClienti((prev) =>
          prev.map((c) =>
            c.id === clienteId ? ({ ...c, [field]: !nextValue } as any) : c
          )
        );

        toast({
          title: "Errore",
          description: e?.message || "Impossibile aggiornare lo scadenzario",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const filteredClienti = useMemo(() => {
    let filtered = [...clienti];

    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.ragione_sociale?.toLowerCase().includes(s) ||
          c.partita_iva?.toLowerCase().includes(s) ||
          c.codice_fiscale?.toLowerCase().includes(s) ||
          c.email?.toLowerCase().includes(s) ||
          c.cod_cliente?.toLowerCase().includes(s)
      );
    }

    if (selectedLetter !== "Tutti") {
      filtered = filtered.filter((c) =>
        (c.ragione_sociale || "").toUpperCase().startsWith(selectedLetter)
      );
    }

    if (selectedUtenteFiscale !== "all") {
      filtered = filtered.filter(
        (c) => c.utente_operatore_id === selectedUtenteFiscale
      );
    }

    if (selectedUtentePayroll !== "all") {
      filtered = filtered.filter(
        (c) => c.utente_payroll_id === selectedUtentePayroll
      );
    }

    return filtered;
  }, [
    clienti,
    searchTerm,
    selectedLetter,
    selectedUtenteFiscale,
    selectedUtentePayroll,
  ]);

  const resetForm = () => {
    setEditingCliente(null);
    setFormData(initialFormData);
    setScadenzari(initialScadenzari);
  };

  const handleAddNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = async (cliente: Cliente) => {
    setIsDialogOpen(true);
    setEditingCliente(cliente);

const supabase = getSupabaseClient();
    // rileggo record completo dal DB
    let clienteDb: any = cliente;
    try {
      const { data, error } = await supabase
        .from("tbclienti")
        .select("*")
        .eq("id", cliente.id)
        .maybeSingle();

      if (!error && data) clienteDb = data;
    } catch (e) {
      console.error("Errore lettura cliente:", e);
    }

    // decrypt se possibile
    let clienteData = { ...clienteDb };
    if (encryptionEnabled && !encryptionLocked) {
      try {
        const decrypted = await decryptClienteSensitiveData({
          codice_fiscale: clienteData.codice_fiscale,
          partita_iva: clienteData.partita_iva,
          matricola_inps: clienteData.matricola_inps,
          pat_inail: clienteData.pat_inail,
          codice_ditta_ce: clienteData.codice_ditta_ce,
          note: clienteData.note,
        });
        clienteData = { ...clienteData, ...decrypted };
      } catch (e) {
        console.error("Decryption error:", e);
      }
    }

    setFormData({
      cod_cliente: clienteData.cod_cliente || "",
      tipo_cliente: clienteData.tipo_cliente || "Persona fisica",
      tipologia_cliente:
        (clienteData.tipologia_cliente as "Interno" | "Esterno") || "Interno",
      settore_fiscale: clienteData.settore_fiscale ?? true,
      settore_lavoro: clienteData.settore_lavoro ?? false,
      settore_consulenza: clienteData.settore_consulenza ?? false,
      ragione_sociale: clienteData.ragione_sociale || "",
      partita_iva: clienteData.partita_iva || "",
      codice_fiscale: clienteData.codice_fiscale || "",
      indirizzo: clienteData.indirizzo || "",
      cap: clienteData.cap || "",
      citta: clienteData.citta || "",
      provincia: clienteData.provincia || "",
      email: clienteData.email || "",
      attivo: clienteData.attivo ?? true,
      cassetto_fiscale_id: clienteData.cassetto_fiscale_id || "",

      matricola_inps: clienteData.matricola_inps || "",
      pat_inail: clienteData.pat_inail || "",
      codice_ditta_ce: clienteData.codice_ditta_ce || "",

      utente_operatore_id: clienteData.utente_operatore_id || "",
      utente_professionista_id: clienteData.utente_professionista_id || "",
      utente_payroll_id: clienteData.utente_payroll_id || "",
      professionista_payroll_id: clienteData.professionista_payroll_id || "",

      contatto1_id: clienteData.contatto1_id || "",
      referente_esterno: clienteData.referente_esterno || "",

      tipo_prestazione_id: clienteData.tipo_prestazione_id || "",
      tipo_redditi:
        (clienteData.tipo_redditi as
          | "USC"
          | "USP"
          | "ENC"
          | "UPF"
          | "730") || undefined,

      note: clienteData.note || "",

      flag_mail_attivo: clienteData.flag_mail_attivo ?? false,
      flag_mail_scadenze: clienteData.flag_mail_scadenze ?? false,
      flag_mail_newsletter: clienteData.flag_mail_newsletter ?? false,
    });

    setScadenzari({
      iva: clienteData.flag_iva ?? false,
      cu: clienteData.flag_cu ?? false,
      bilancio: clienteData.flag_bilancio ?? false,
      fiscali: clienteData.flag_fiscali ?? false,
      lipe: clienteData.flag_lipe ?? false,
      modello_770: clienteData.flag_770 ?? false,
      esterometro: clienteData.flag_esterometro ?? false,
      ccgg: clienteData.flag_ccgg ?? false,
      proforma: clienteData.flag_proforma ?? false,
      imu: clienteData.flag_imu ?? false,
    });
  };

  const handleSave = async () => {
    try {
      if (!formData.ragione_sociale || !formData.email) {
        toast({
          title: "Errore",
          description: "Compila tutti i campi obbligatori",
          variant: "destructive",
        });
        return;
      }

      let dataToSave: any = {
        ...formData,

        cod_cliente:
          formData.cod_cliente || `CL-${Date.now().toString().slice(-6)}`,

        utente_operatore_id: formData.utente_operatore_id || undefined,
        utente_professionista_id: formData.utente_professionista_id || undefined,
        utente_payroll_id: formData.utente_payroll_id || undefined,
        professionista_payroll_id:
          formData.professionista_payroll_id || undefined,

        contatto1_id: formData.contatto1_id || undefined,
        referente_esterno: formData.referente_esterno || undefined,
        tipo_prestazione_id: formData.tipo_prestazione_id || undefined,
        tipo_redditi: formData.tipo_redditi || undefined,
        cassetto_fiscale_id: formData.cassetto_fiscale_id || undefined,

        matricola_inps: formData.matricola_inps || undefined,
        pat_inail: formData.pat_inail || undefined,
        codice_ditta_ce: formData.codice_ditta_ce || undefined,

        // scadenzari
        flag_iva: scadenzari.iva,
        flag_cu: scadenzari.cu,
        flag_bilancio: scadenzari.bilancio,
        flag_lipe: scadenzari.lipe,
        flag_esterometro: scadenzari.esterometro,
        flag_proforma: scadenzari.proforma,
        flag_fiscali: scadenzari.fiscali,
        flag_770: scadenzari.modello_770, // ✅ corretto
        flag_ccgg: scadenzari.ccgg,
        flag_imu: scadenzari.imu,
      };

      // encrypt se abilitato + sbloccato
      if (encryptionEnabled && !encryptionLocked) {
        try {
          const encrypted = await encryptClienteSensitiveData({
            codice_fiscale: dataToSave.codice_fiscale,
            partita_iva: dataToSave.partita_iva,
            matricola_inps: dataToSave.matricola_inps,
            pat_inail: dataToSave.pat_inail,
            codice_ditta_ce: dataToSave.codice_ditta_ce,
            note: dataToSave.note,
          });
          dataToSave = { ...dataToSave, ...encrypted };
        } catch (error) {
          console.error("Encryption error:", error);
          toast({
            title: "Errore Encryption",
            description:
              "Impossibile cifrare i dati. Verifica di aver sbloccato la protezione.",
            variant: "destructive",
          });
          return;
        }
      }

      if (editingCliente) {
        await clienteService.updateCliente(editingCliente.id, dataToSave);
        toast({
          title: "Successo",
          description: "Cliente aggiornato con successo",
        });
      } else {
        await clienteService.createCliente(dataToSave);
        toast({ title: "Successo", description: "Cliente creato con successo" });
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error("Errore salvataggio cliente:", error);
      toast({
        title: "Errore",
        description: error?.message || "Impossibile salvare il cliente",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo cliente?")) return;
    try {
      await clienteService.deleteCliente(id);
      toast({ title: "Successo", description: "Cliente eliminato con successo" });
      loadData();
    } catch (error) {
      console.error("Errore eliminazione cliente:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il cliente",
        variant: "destructive",
      });
    }
  };

// ✅ usa i flag DEL CLIENTE (non lo state del form)
const handleInsertIntoScadenzari = async (cliente: Cliente) => {
  try {
    const supabase = getSupabaseClient();

    const scadenzariAttivi: string[] = [];
    if (cliente.flag_iva) scadenzariAttivi.push("IVA");
    if (cliente.flag_lipe) scadenzariAttivi.push("LIPE");
    if (cliente.flag_cu) scadenzariAttivi.push("CU");
    if (cliente.flag_770) scadenzariAttivi.push("770");
    if (cliente.flag_bilancio) scadenzariAttivi.push("Bilanci");
    if (cliente.flag_fiscali) scadenzariAttivi.push("Fiscali");

    // ⬇️ studio_id: prendilo dal cliente se c’è (consigliato)
    const studioId = (cliente as any).studio_id;

    if (!studioId) {
      toast({
        title: "Errore",
        description: "studio_id mancante: impossibile inserire negli scadenzari",
        variant: "destructive",
      });
      return;
    }

    const baseData = {
      id: cliente.id, // puoi metterlo qui ed evitare di ripeterlo nei case
      studio_id: studioId,
      nominativo: cliente.ragione_sociale,
      utente_operatore_id: cliente.utente_operatore_id,
    };

    await Promise.all(
      scadenzariAttivi.map((s) => {
        switch (s) {
          case "IVA":
            return supabase.from("tbscadiva").upsert(baseData, { onConflict: "id" });

          case "CU":
            return supabase.from("tbscadcu").upsert(baseData, { onConflict: "id" });

          case "Bilanci":
            return supabase.from("tbscadbilanci").upsert(baseData, { onConflict: "id" });

          case "Fiscali":
            return supabase.from("tbscadfiscali").upsert(baseData, { onConflict: "id" });

          case "LIPE":
            return supabase.from("tbscadlipe").upsert(baseData, { onConflict: "id" });

          case "770":
            return supabase
              .from("tbscad770")
              .upsert(
                {
                  ...baseData,
                  utente_payroll_id: cliente.utente_payroll_id,
                  professionista_payroll_id: cliente.professionista_payroll_id,
                },
                { onConflict: "id" }
              );

          default:
            return Promise.resolve(null);
        }
      })
    );

    toast({
      title: "Successo",
      description: `Cliente inserito in ${scadenzariAttivi.length} scadenzari: ${scadenzariAttivi.join(
        ", "
      )}`,
    });
  } catch (error) {
    console.error("Errore inserimento scadenzari:", error);
    toast({
      title: "Errore",
      description: "Impossibile inserire il cliente negli scadenzari",
      variant: "destructive",
    });
  }
};

  const downloadTemplate = () => {
    const headers = [
      "Tipo Cliente",
      "Tipologia Cliente",
      "Settore Fiscale (VERO/FALSO)",
      "Settore Lavoro (VERO/FALSO)",
      "Settore Consulenza (VERO/FALSO)",
      "Ragione Sociale",
      "Partita IVA",
      "Codice Fiscale",
      "Indirizzo",
      "CAP",
      "Città",
      "Provincia",
      "Email",
      "Attivo",
      "Note",
    ];

    const exampleRows = [
      [
        "Persona fisica",
        "Interno",
        "VERO",
        "FALSO",
        "FALSO",
        "ESEMPIO SRL",
        "01234567890",
        "RSSMRA80A01H501U",
        "Via Roma, 1",
        "00100",
        "Roma",
        "RM",
        "info@esempio.it",
        "VERO",
        "Note di esempio",
      ],
    ];

    const csvContent = [
      headers.join(","),
      ...exampleRows.map((row) => row.map((c) => `"${c}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "template_importazione_clienti.csv";
    link.click();

    toast({
      title: "Template scaricato",
      description:
        "Compila il file CSV seguendo l'esempio fornito. Lascia vuoti i campi non obbligatori.",
    });
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

const supabase = getSupabaseClient();
    setImportLoading(true);

    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Errore",
          description: "Utente non autenticato. Effettua il login.",
          variant: "destructive",
        });
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", user.id)
        .single();

      if (userError || !userData?.studio_id) {
        toast({
          title: "Errore",
          description: "Impossibile recuperare lo studio dell'utente.",
          variant: "destructive",
        });
        return;
      }

      const studioIdFromUser = userData.studio_id as string;

      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) return;

      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => (row[h] = values[idx] || ""));

        const ragione = row["ragione_sociale"] || row["Ragione Sociale"] || "";
        if (!ragione) continue;

        try {
          const { error } = await supabase.from("tbclienti").insert({
            ragione_sociale: ragione,
            codice_fiscale: row["codice_fiscale"] || row["Codice Fiscale"] || null,
            partita_iva: row["partita_iva"] || row["Partita IVA"] || null,
            indirizzo: row["indirizzo"] || row["Indirizzo"] || null,
            cap: row["cap"] || row["CAP"] || null,
            citta: row["citta"] || row["Città"] || null,
            provincia: row["provincia"] || row["Provincia"] || null,
            email: row["email"] || row["Email"] || null,
            tipo_cliente:
              row["tipo_cliente"] || row["Tipo Cliente"] || "Persona fisica",
            tipologia_cliente:
              row["tipologia_cliente"] || row["Tipologia Cliente"] || "Interno",
            studio_id: studioIdFromUser,
          });

          if (error) {
            if ((error as any).code === "23505") duplicateCount++;
            else {
              errorCount++;
              errors.push(`Riga ${i + 1}: ${error.message}`);
            }
          } else successCount++;
        } catch (e: any) {
          errorCount++;
          errors.push(`Riga ${i + 1}: ${e.message}`);
        }
      }

      const report: string[] = [];
      if (successCount) report.push(`✅ ${successCount} clienti importati`);
      if (duplicateCount) report.push(`⚠️ ${duplicateCount} duplicati saltati`);
      if (errorCount) report.push(`❌ ${errorCount} errori`);

      toast({
        title: "Importazione completata",
        description: report.join("\n"),
        variant: successCount ? "default" : "destructive",
      });

      if (errors.length) console.error("Errori import:", errors.slice(0, 10));

      loadData();
      setImportDialogOpen(false);
      event.target.value = "";
    } catch (error) {
      console.error("Errore importazione file:", error);
      toast({
        title: "Errore",
        description: "Impossibile importare il file. Verifica che sia un CSV valido.",
        variant: "destructive",
      });
    } finally {
      setImportLoading(false);
    }
  };

  const handleUnlockCassetti = () => setShowUnlockDialog(true);

  const handleConfirmUnlock = async () => {
    try {
      const result = await unlockCassetti(studioId || "", unlockPassword);
      if (result.success) {
        setEncryptionLocked(false);
        setShowUnlockDialog(false);
        setUnlockPassword("");
        toast({
          title: "Sbloccato",
          description: "Dati sensibili sbloccati con successo",
        });
        loadData();
      } else {
        toast({
          title: "Errore",
          description: result.error || "Password errata",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e.message || "Errore durante lo sblocco",
        variant: "destructive",
      });
    }
  };

  const handleLockCassetti = () => {
    lockCassetti();
    setEncryptionLocked(true);
    toast({ title: "Bloccato", description: "Dati sensibili bloccati" });
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Caricamento clienti...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* HEADER */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-3xl font-bold">Gestione Clienti</h1>
            <p className="text-muted-foreground mt-1">
              Anagrafica completa e gestione scadenzari
            </p>
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              variant={vistaClienti === "clienti" ? "default" : "outline"}
              onClick={() => setVistaClienti("clienti")}
            >
              Clienti
            </Button>

            <Button
              variant={vistaClienti === "elenco_generale" ? "default" : "outline"}
              onClick={() => setVistaClienti("elenco_generale")}
            >
              Elenco Generale Scadenzari
            </Button>

            {encryptionEnabled && (
              <Button
                variant="outline"
                onClick={encryptionLocked ? handleUnlockCassetti : handleLockCassetti}
                className={
                  encryptionLocked
                    ? "border-orange-600 text-orange-600"
                    : "border-green-600 text-green-600"
                }
              >
                {encryptionLocked ? (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Sblocca Dati
                  </>
                ) : (
                  <>
                    <Unlock className="h-4 w-4 mr-2" />
                    Blocca Dati
                  </>
                )}
              </Button>
            )}

            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-50"
                  disabled={importLoading}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Importa Excel/CSV
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
                <DialogHeader>
                  <DialogTitle>Importazione Clienti da Excel/CSV</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  <Button onClick={downloadTemplate} variant="outline" className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Scarica Template CSV
                  </Button>

                  <div className="space-y-2">
                    <Label htmlFor="csv-file-clienti">Carica File CSV</Label>
                    <Input
                      id="csv-file-clienti"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleImportCSV}
                      className="cursor-pointer"
                      disabled={importLoading}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button onClick={handleAddNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuovo Cliente
            </Button>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totale Clienti
            </CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{clienti.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Con Cassetto Fiscale
            </CardTitle>
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">
              {clientiConCassetto}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Percentuale
            </CardTitle>
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">
              {percentualeCassetto}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTRI */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Ricerca e Filtri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                placeholder="Cerca per ragione sociale, P.IVA, CF o Codice Cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 text-base"
              />
            </div>

            <Select value={selectedUtenteFiscale} onValueChange={setSelectedUtenteFiscale}>
              <SelectTrigger className="w-full md:w-[200px] h-12">
                <SelectValue placeholder="Utente Fiscale" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti (Fiscale)</SelectItem>
                {utenti
                  .slice()
                  .sort((a, b) =>
                    `${a.cognome} ${a.nome}`.toLowerCase().localeCompare(
                      `${b.cognome} ${b.nome}`.toLowerCase()
                    )
                  )
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.cognome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={selectedUtentePayroll} onValueChange={setSelectedUtentePayroll}>
              <SelectTrigger className="w-full md:w-[200px] h-12">
                <SelectValue placeholder="Utente Payroll" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti (Payroll)</SelectItem>
                {utenti
                  .slice()
                  .sort((a, b) =>
                    `${a.cognome} ${a.nome}`.toLowerCase().localeCompare(
                      `${b.cognome} ${b.nome}`.toLowerCase()
                    )
                  )
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.cognome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedLetter === "Tutti" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedLetter("Tutti")}
              className="px-4"
            >
              Tutti
            </Button>

            {alphabet.map((letter) => (
              <Button
                key={letter}
                variant={selectedLetter === letter ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedLetter(letter)}
                className="w-10 h-10 p-0"
              >
                {letter}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

     {/* TABELLA */}
<Card>
  <CardContent className="p-0">
    {filteredClienti.length === 0 ? (
      <div className="text-center py-12">
        <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nessun cliente trovato</h3>
        <p className="text-muted-foreground mb-6">
          {searchTerm ||
          selectedLetter !== "Tutti" ||
          selectedUtenteFiscale !== "all" ||
          selectedUtentePayroll !== "all"
            ? "Prova a modificare i filtri di ricerca"
            : "Inizia aggiungendo il tuo primo cliente"}
        </p>
        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Aggiungi Cliente
        </Button>
      </div>
    ) : (
      <div className="overflow-x-auto">
        {vistaClienti === "clienti" ? (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                {/* Cod. Cliente */}
                <TableHead className="sticky left-0 bg-background z-20 w-[120px] border-r">
                  Cod. Cliente
                </TableHead>

                {/* Ragione Sociale */}
                <TableHead className="sticky left-[120px] bg-background z-20 w-[250px] border-r pr-4">
                  Ragione Sociale
                </TableHead>

                {/* Utente Fiscale (allineato a pl-8 pr-3 come la cella) */}
                <TableHead className="min-w-[220px] pl-8 pr-3 text-left">
                  Utente Fiscale
                </TableHead>

                {/* Utente Payroll (allineato a px-3 come la cella) */}
                <TableHead className="min-w-[200px] px-3 text-left">
                  Utente Payroll
                </TableHead>

                {/* Stato */}
                <TableHead className="min-w-[100px]">
                  Stato
                </TableHead>

                {/* Scadenzari (allineato al centro e con larghezza coerente con l’icona) */}
                <TableHead className="min-w-[90px] text-center">
                  Scadenzari
                </TableHead>

                {/* Azioni (allineato a destra con larghezza coerente alle icone) */}
                <TableHead className="sticky right-0 bg-background z-20 w-[120px] text-right">
                  Azioni
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredClienti.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell
                    className="sticky left-0 bg-background z-30 font-mono text-sm w-[120px] truncate border-r"
                    title={cliente.cod_cliente || cliente.id}
                  >
                    {cliente.cod_cliente || cliente.id.substring(0, 8).toUpperCase()}
                  </TableCell>

                  <TableCell
                    className="sticky left-[120px] bg-background z-20 font-medium w-[250px] truncate border-r pr-4"
                    title={cliente.ragione_sociale || ""}
                  >
                    {cliente.ragione_sociale}
                  </TableCell>

                  <TableCell className="min-w-[220px] pl-8 pr-3 text-left align-middle relative z-0">
                    <div className="w-full whitespace-nowrap text-left">
                      {getUtenteNome(cliente.utente_operatore_id) ?? "-"}
                    </div>
                  </TableCell>

                  <TableCell className="min-w-[200px] px-3 text-left align-middle">
                    {getUtenteNome(cliente.utente_payroll_id) ?? "-"}
                  </TableCell>

                  <TableCell className="min-w-[100px]">
                    {cliente.attivo ? (
                      <Badge variant="default" className="bg-green-600">
                        Attivo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inattivo</Badge>
                    )}
                  </TableCell>

                  <TableCell className="min-w-[90px] text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleInsertIntoScadenzari(cliente)}
                      title="Inserisci negli Scadenzari"
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </TableCell>

                  <TableCell className="sticky right-0 bg-background z-10 w-[120px] text-right">
                    <div className="flex justify-end gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(cliente)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(cliente.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-20 w-[350px]">
                  Cliente
                </TableHead>
                <TableHead className="min-w-[220px] text-left">
                  Utente Fiscale
                </TableHead>
                <TableHead className="text-center min-w-[90px]">IVA</TableHead>
                <TableHead className="text-center min-w-[90px]">LIPE</TableHead>
                <TableHead className="text-center min-w-[100px]">Bilancio</TableHead>
                <TableHead className="text-center min-w-[90px]">770</TableHead>
                <TableHead className="text-center min-w-[90px]">IMU</TableHead>
                <TableHead className="text-center min-w-[90px]">CU</TableHead>
                <TableHead className="text-center min-w-[110px]">Fiscali</TableHead>
                <TableHead className="text-center min-w-[130px]">Esterometro</TableHead>
                <TableHead className="text-center min-w-[100px]">CCGG</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredClienti.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium w-[350px] truncate">
                    {cliente.ragione_sociale}
                  </TableCell>

                  <TableCell className="min-w-[220px] text-left">
                    {getUtenteNome(cliente.utente_operatore_id)}
                  </TableCell>

                  <TableCell className="text-center">
                    <Checkbox
                      checked={!!cliente.flag_iva}
                      onCheckedChange={(v) =>
                        toggleClienteFlag(cliente.id, "flag_iva", v === true)
                      }
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Checkbox
                      checked={!!cliente.flag_lipe}
                      onCheckedChange={(v) =>
                        toggleClienteFlag(cliente.id, "flag_lipe", v === true)
                      }
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Checkbox
                      checked={!!cliente.flag_bilancio}
                      onCheckedChange={(v) =>
                        toggleClienteFlag(cliente.id, "flag_bilancio", v === true)
                      }
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Checkbox
                      checked={!!cliente.flag_770}
                      onCheckedChange={(v) =>
                        toggleClienteFlag(cliente.id, "flag_770", v === true)
                      }
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Checkbox
                      checked={!!cliente.flag_imu}
                      onCheckedChange={(v) =>
                        toggleClienteFlag(cliente.id, "flag_imu", v === true)
                      }
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Checkbox
                      checked={!!cliente.flag_cu}
                      onCheckedChange={(v) =>
                        toggleClienteFlag(cliente.id, "flag_cu", v === true)
                      }
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Checkbox
                      checked={!!cliente.flag_fiscali}
                      onCheckedChange={(v) =>
                        toggleClienteFlag(cliente.id, "flag_fiscali", v === true)
                      }
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Checkbox
                      checked={!!cliente.flag_esterometro}
                      onCheckedChange={(v) =>
                        toggleClienteFlag(cliente.id, "flag_esterometro", v === true)
                      }
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Checkbox
                      checked={!!cliente.flag_ccgg}
                      onCheckedChange={(v) =>
                        toggleClienteFlag(cliente.id, "flag_ccgg", v === true)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    )}
  </CardContent>
</Card>

      {/* DIALOG CREAZIONE/MODIFICA */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCliente ? "Modifica Cliente" : "Nuovo Cliente"}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="anagrafica" className="w-full">
            <TabsList className="grid w-full grid-cols-5 overflow-x-auto">
              <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
              <TabsTrigger value="riferimenti">Riferimenti</TabsTrigger>
              <TabsTrigger value="comunicazioni">Comunicazioni</TabsTrigger>
              <TabsTrigger value="altri_dati">Altri Dati</TabsTrigger>
              <TabsTrigger value="scadenzari">Scadenzari</TabsTrigger>
            </TabsList>

            {/* ANAGRAFICA */}
          <TabsContent value="anagrafica" className="space-y-4 pt-4">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <Label htmlFor="cod_cliente">Codice Cliente</Label>
      <Input
        id="cod_cliente"
        value={formData.cod_cliente}
        onChange={(e) => setFormData({ ...formData, cod_cliente: e.target.value })}
        disabled
        placeholder="Generato automaticamente"
      />
    </div>

    <div>
      <Label htmlFor="tipo_cliente">Tipo Cliente</Label>
      <Select
        value={formData.tipo_cliente}
        onValueChange={(value) => setFormData({ ...formData, tipo_cliente: value })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Persona fisica">Persona fisica</SelectItem>
          <SelectItem value="Altro">Altro</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div>
      <Label htmlFor="tipologia_cliente">Tipologia Cliente</Label>
      <Select
        value={formData.tipologia_cliente || undefined}
        onValueChange={(value: string) =>
          setFormData({ ...formData, tipologia_cliente: value as "Interno" | "Esterno" })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleziona tipologia" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Interno">Interno</SelectItem>
          <SelectItem value="Esterno">Esterno</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="md:col-span-2 space-y-2">
      <Label>Settori *</Label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-md p-4 bg-muted/20">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="settore-fiscale"
            checked={formData.settore_fiscale}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, settore_fiscale: checked as boolean })
            }
          />
          <Label htmlFor="settore-fiscale" className="font-medium cursor-pointer">
            Settore Fiscale
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="settore-lavoro"
            checked={formData.settore_lavoro}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, settore_lavoro: checked as boolean })
            }
          />
          <Label htmlFor="settore-lavoro" className="font-medium cursor-pointer">
            Settore Lavoro
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="settore-consulenza"
            checked={formData.settore_consulenza}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, settore_consulenza: checked as boolean })
            }
          />
          <Label htmlFor="settore-consulenza" className="font-medium cursor-pointer">
            Settore Consulenza
          </Label>
        </div>
      </div>
    </div>

    <div className="md:col-span-2">
      <Label htmlFor="ragione_sociale">
        Ragione Sociale <span className="text-red-500">*</span>
      </Label>
      <Input
        id="ragione_sociale"
        value={formData.ragione_sociale}
        onChange={(e) => setFormData({ ...formData, ragione_sociale: e.target.value })}
        placeholder="Ragione sociale..."
      />
    </div>

    <div>
      <Label htmlFor="partita_iva">P.IVA</Label>
      <div className="relative">
        <Input
          id="partita_iva"
          value={formData.partita_iva}
          onChange={(e) => setFormData({ ...formData, partita_iva: e.target.value })}
          placeholder="01234567890"
        />
        {encryptionEnabled && encryptionLocked && formData.partita_iva && (
          <div className="absolute inset-0 bg-muted/50 backdrop-blur-sm flex items-center justify-center rounded-md">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>

    <div>
      <Label htmlFor="codice_fiscale">Codice Fiscale</Label>
      <div className="relative">
        <Input
          id="codice_fiscale"
          value={formData.codice_fiscale}
          onChange={(e) => setFormData({ ...formData, codice_fiscale: e.target.value })}
          placeholder="RSSMRA80A01H501U"
        />
        {encryptionEnabled && encryptionLocked && formData.codice_fiscale && (
          <div className="absolute inset-0 bg-muted/50 backdrop-blur-sm flex items-center justify-center rounded-md">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>

    <div className="md:col-span-2">
      <Label htmlFor="indirizzo">Indirizzo</Label>
      <Input
        id="indirizzo"
        value={formData.indirizzo}
        onChange={(e) => setFormData({ ...formData, indirizzo: e.target.value })}
        placeholder="Via Roma, 123"
      />
    </div>

    <div>
      <Label htmlFor="cap">CAP</Label>
      <Input
        id="cap"
        value={formData.cap}
        onChange={(e) => setFormData({ ...formData, cap: e.target.value })}
        placeholder="00100"
      />
    </div>

    <div>
      <Label htmlFor="citta">Città</Label>
      <Input
        id="citta"
        value={formData.citta}
        onChange={(e) => setFormData({ ...formData, citta: e.target.value })}
        placeholder="Roma"
      />
    </div>

    <div>
      <Label htmlFor="provincia">Provincia</Label>
      <Input
        id="provincia"
        value={formData.provincia}
        onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
        placeholder="RM"
        maxLength={2}
      />
    </div>

    <div>
      <Label htmlFor="email">
        Email <span className="text-red-500">*</span>
      </Label>
      <Input
        id="email"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        placeholder="info@azienda.it"
      />
    </div>

    <div className="flex items-center space-x-2">
      <Switch
        id="attivo"
        checked={formData.attivo}
        onCheckedChange={(checked) => setFormData({ ...formData, attivo: checked })}
      />
      <Label htmlFor="attivo">Cliente Attivo</Label>
    </div>

    <div className="md:col-span-2">
      <Label htmlFor="note">Note</Label>
      <Textarea
        id="note"
        value={formData.note}
        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
        placeholder="Note aggiuntive..."
        rows={4}
      />
    </div>
  </div>
</TabsContent>

            {/* RIFERIMENTI */}
           <TabsContent value="riferimenti" className="space-y-6 pt-4">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <Label htmlFor="utente_operatore_id">Utente Fiscale</Label>
      <Select
        value={formData.utente_operatore_id || "none"}
        onValueChange={(value) =>
          setFormData({ ...formData, utente_operatore_id: value === "none" ? "" : value })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleziona utente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nessuno</SelectItem>
          {utenti
            .slice()
            .sort((a, b) =>
              (`${a.cognome} ${a.nome}`.toLowerCase()).localeCompare(
                `${b.cognome} ${b.nome}`.toLowerCase()
              )
            )
            .map((utente) => (
              <SelectItem key={utente.id} value={utente.id}>
                {utente.nome} {utente.cognome}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>

    <div>
      <Label htmlFor="utente_professionista_id">Professionista Fiscale</Label>
      <Select
        value={formData.utente_professionista_id || "none"}
        onValueChange={(value) =>
          setFormData({
            ...formData,
            utente_professionista_id: value === "none" ? "" : value,
          })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleziona professionista" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nessuno</SelectItem>
          {utenti
            .slice()
            .sort((a, b) =>
              (`${a.cognome} ${a.nome}`.toLowerCase()).localeCompare(
                `${b.cognome} ${b.nome}`.toLowerCase()
              )
            )
            .map((utente) => (
              <SelectItem key={utente.id} value={utente.id}>
                {utente.nome} {utente.cognome}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>

    <div>
      <Label htmlFor="utente_payroll_id">Utente Payroll</Label>
      <Select
        value={formData.utente_payroll_id || "none"}
        onValueChange={(value) =>
          setFormData({ ...formData, utente_payroll_id: value === "none" ? "" : value })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleziona utente payroll" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nessuno</SelectItem>
          {utenti
            .slice()
            .sort((a, b) =>
              (`${a.cognome} ${a.nome}`.toLowerCase()).localeCompare(
                `${b.cognome} ${b.nome}`.toLowerCase()
              )
            )
            .map((utente) => (
              <SelectItem key={utente.id} value={utente.id}>
                {utente.nome} {utente.cognome}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>

    <div>
      <Label htmlFor="professionista_payroll_id">Professionista Payroll</Label>
      <Select
        value={formData.professionista_payroll_id || "none"}
        onValueChange={(value) =>
          setFormData({
            ...formData,
            professionista_payroll_id: value === "none" ? "" : value,
          })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleziona professionista payroll" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nessuno</SelectItem>
          {utenti
            .slice()
            .sort((a, b) =>
              (`${a.cognome} ${a.nome}`.toLowerCase()).localeCompare(
                `${b.cognome} ${b.nome}`.toLowerCase()
              )
            )
            .map((utente) => (
              <SelectItem key={utente.id} value={utente.id}>
                {utente.nome} {utente.cognome}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>

    <div>
      <Label htmlFor="contatto1_id">Contatto 1</Label>
      <Select
        value={formData.contatto1_id || "none"}
        onValueChange={(value) =>
          setFormData({ ...formData, contatto1_id: value === "none" ? "" : value })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleziona contatto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nessuno</SelectItem>
          {contatti
            .slice()
            .sort((a, b) =>
              (`${a.cognome || ""} ${a.nome || ""}`.toLowerCase()).localeCompare(
                `${b.cognome || ""} ${b.nome || ""}`.toLowerCase()
              )
            )
            .map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome} {c.cognome}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>

    <div>
      <Label htmlFor="referente_esterno">Referente esterno</Label>
      <Input
        id="referente_esterno"
        value={formData.referente_esterno}
        onChange={(e) => setFormData({ ...formData, referente_esterno: e.target.value })}
        placeholder="Nome referente esterno"
      />
    </div>

    <div>
      <Label htmlFor="tipo_prestazione_id">Tipo Prestazione</Label>
      <Select
        value={formData.tipo_prestazione_id || "none"}
        onValueChange={(value) =>
          setFormData({
            ...formData,
            tipo_prestazione_id: value === "none" ? "" : value,
          })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleziona prestazione" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nessuno</SelectItem>
          {prestazioni.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.descrizione}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div>
      <Label htmlFor="tipo_redditi">Tipo Redditi</Label>
      <Select
        value={formData.tipo_redditi || undefined}
        onValueChange={(value: string) =>
          setFormData({
            ...formData,
            tipo_redditi: value as "USC" | "USP" | "ENC" | "UPF" | "730",
          })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleziona tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="USC">USC</SelectItem>
          <SelectItem value="USP">USP</SelectItem>
          <SelectItem value="ENC">ENC</SelectItem>
          <SelectItem value="UPF">UPF</SelectItem>
          <SelectItem value="730">730</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="md:col-span-2">
      <Label htmlFor="cassetto_fiscale_id">Referente Cassetto fiscale</Label>
      <Select
        value={formData.cassetto_fiscale_id || "none"}
        onValueChange={(value) =>
          setFormData({
            ...formData,
            cassetto_fiscale_id: value === "none" ? "" : value,
          })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleziona referente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nessuno</SelectItem>
          {cassettiFiscali.map((cassetto) => (
            <SelectItem key={cassetto.id} value={cassetto.id}>
              {cassetto.nominativo} ({cassetto.username})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
</TabsContent>

            {/* COMUNICAZIONI */}
           {/* COMUNICAZIONI */}
<TabsContent value="comunicazioni" className="pt-4">
  <div className="space-y-4">
    <div className="flex items-center justify-between border rounded-md p-4">
      <div className="space-y-1">
        <Label htmlFor="flag_mail_attivo" className="font-medium">
          Email Attive
        </Label>
        <p className="text-sm text-muted-foreground">
          Abilita l’invio delle comunicazioni email al cliente
        </p>
      </div>
      <Switch
        id="flag_mail_attivo"
        checked={formData.flag_mail_attivo}
        onCheckedChange={(checked) =>
          setFormData({ ...formData, flag_mail_attivo: checked })
        }
      />
    </div>

    <div className="flex items-center justify-between border rounded-md p-4">
      <div className="space-y-1">
        <Label htmlFor="flag_mail_scadenze" className="font-medium">
          Email Scadenze
        </Label>
        <p className="text-sm text-muted-foreground">
          Invia notifiche email per le scadenze fiscali
        </p>
      </div>
      <Switch
        id="flag_mail_scadenze"
        checked={formData.flag_mail_scadenze}
        onCheckedChange={(checked) =>
          setFormData({ ...formData, flag_mail_scadenze: checked })
        }
      />
    </div>

    <div className="flex items-center justify-between border rounded-md p-4">
      <div className="space-y-1">
        <Label htmlFor="flag_mail_newsletter" className="font-medium">
          Newsletter
        </Label>
        <p className="text-sm text-muted-foreground">
          Abilita l’invio di newsletter e comunicazioni informative
        </p>
      </div>
      <Switch
        id="flag_mail_newsletter"
        checked={formData.flag_mail_newsletter}
        onCheckedChange={(checked) =>
          setFormData({ ...formData, flag_mail_newsletter: checked })
        }
      />
    </div>
  </div>
</TabsContent>

            {/* ALTRI DATI */}
          <TabsContent value="altri_dati" className="space-y-4 pt-4">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="md:col-span-2">
      <Label htmlFor="matricola_inps">Matricola INPS</Label>
      <Textarea
        id="matricola_inps"
        value={formData.matricola_inps}
        onChange={(e) => setFormData({ ...formData, matricola_inps: e.target.value })}
        placeholder="Inserisci matricola INPS..."
        rows={2}
      />
    </div>

    <div className="md:col-span-2">
      <Label htmlFor="pat_inail">Pat INAIL</Label>
      <Textarea
        id="pat_inail"
        value={formData.pat_inail}
        onChange={(e) => setFormData({ ...formData, pat_inail: e.target.value })}
        placeholder="Inserisci Pat INAIL..."
        rows={2}
      />
    </div>

    <div className="md:col-span-2">
      <Label htmlFor="codice_ditta_ce">Codice Ditta CE</Label>
      <Textarea
        id="codice_ditta_ce"
        value={formData.codice_ditta_ce}
        onChange={(e) => setFormData({ ...formData, codice_ditta_ce: e.target.value })}
        placeholder="Inserisci codice ditta CE..."
        rows={2}
      />
    </div>
  </div>
</TabsContent>

            {/* SCADENZARI */}
            <TabsContent value="scadenzari" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Seleziona gli scadenzari attivi per questo cliente
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SCADENZARI_OPTIONS.map(({ key, label }) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      checked={!!scadenzari[key]}
                      onCheckedChange={(checked) =>
                        setScadenzari((s) => ({ ...s, [key]: checked === true }))
                      }
                    />
                    <Label>{label}</Label>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}
            >
              Annulla
            </Button>
            <Button onClick={handleSave}>
              {editingCliente ? "Salva Modifiche" : "Crea Cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG SBLOCCO */}
      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sblocca Dati Sensibili</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Inserisci la password principale dello studio per visualizzare e modificare i
              dati sensibili (CF, P.IVA, ecc).
            </p>

            <div className="space-y-2">
              <Label htmlFor="unlock-password">Password Principale</Label>
              <Input
                id="unlock-password"
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Inserisci password..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowUnlockDialog(false)}>
                Annulla
              </Button>
              <Button onClick={handleConfirmUnlock}>Sblocca</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

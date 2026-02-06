import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useToast } from "@/hooks/use-toast";
import { Users, Edit, Trash2, Search, Plus, Upload, FileSpreadsheet, CheckCircle2, Calendar } from "lucide-react";
import { clienteService } from "@/services/clienteService";
import { contattoService } from "@/services/contattoService";
import { utenteService } from "@/services/utenteService";
import { cassettiFiscaliService } from "@/services/cassettiFiscaliService";
import { Switch } from "@/components/ui/switch";
import * as XLSX from "xlsx";
import { useStudio } from "@/contexts/StudioContext";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type CassettoFiscale = Database["public"]["Tables"]["tbcassetti_fiscali"]["Row"];
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

const TIPO_PRESTAZIONE_OPTIONS: string[] = [
  "Amministrazione e liquidazione di aziende, patrimoni, singoli beni",
  "Amministrazione di società, enti, trust o strutture analoghe",
  "Assistenza, consulenza e rappresentanza in materia tributaria",
  "Assistenza per richiesta finanziamenti",
  "Assistenza e consulenza societaria continuativa e generica",
  "Attività di valutazione tecnica dell'iniziativa di impresa e di asseverazione dei business plan per l'accesso a finanziamenti pubblici",
  "Consulenza aziendale",
  "Consulenza contrattuale",
  "Consulenza economico-finanziaria",
  "Tenuta della contabilità",
  "Consulenza in materia di redazione bilancio",
  "Revisione legale dei conti",
  "Valutazioni di aziende, rami di azienda, patrimoni, singoli beni e diritti",
  "Collegio sindacale",
  "Apposizione del visto di conformità su dichiarazioni fiscali",
  "Predisposizione di interpelli",
  "Risposte di carattere fiscale e societario",
  "Incarico di curatore, commissario giudiziale e commissario liquidatore",
  "Liquidatore nominato dal Tribunale",
  "Invio telematico di Bilanci",
];

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

export default function ClientiPage() {
  const { toast } = useToast();
  const { studioId } = useStudio();

  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [filteredClienti, setFilteredClienti] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string>("Tutti");
  const [selectedUtenteFiscale, setSelectedUtenteFiscale] = useState<string>("all");
  const [selectedUtentePayroll, setSelectedUtentePayroll] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [contatti, setContatti] = useState<Contatto[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [cassettiFiscali, setCassettiFiscali] = useState<CassettoFiscale[]>([]);
  const [prestazioni, setPrestazioni] = useState<Prestazione[]>([]);

  const [scadenzari, setScadenzari] = useState<ScadenzariSelezionati>({
    iva: true,
    cu: true,
    bilancio: true,
    fiscali: true,
    lipe: true,
    modello_770: true,
    esterometro: true,
    ccgg: true,
    proforma: true,
    imu: true,
  });

  const [formData, setFormData] = useState<{
    cod_cliente: string;
    tipo_cliente: string;
    tipologia_cliente?: string;
    settore?: string;
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
    gestione_antiriciclaggio: boolean;
    note_antiriciclaggio: string;
    giorni_scad_ver_a: number | null;
    giorni_scad_ver_b: number | null;
    tipo_prestazione_a: string;
    tipo_prestazione_b: string;
    rischio_ver_a: string;
    rischio_ver_b: string;
    gg_ver_a: number | null;
    gg_ver_b: number | null;
    data_ultima_verifica_antiric: Date | null;
    scadenza_antiric: Date | null;
    data_ultima_verifica_b: Date | null;
    scadenza_antiric_b: Date | null;
    note: string;
  }>({
    cod_cliente: "",
    tipo_cliente: "Persona fisica",
    tipologia_cliente: "Interno",
    settore: "Fiscale",
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
    gestione_antiriciclaggio: false,
    note_antiriciclaggio: "",
    giorni_scad_ver_a: null,
    giorni_scad_ver_b: null,
    tipo_prestazione_a: "",
    tipo_prestazione_b: "",
    rischio_ver_a: "",
    rischio_ver_b: "",
    gg_ver_a: null,
    gg_ver_b: null,
    data_ultima_verifica_antiric: null,
    scadenza_antiric: null,
    data_ultima_verifica_b: null,
    scadenza_antiric_b: null,
    note: "",
  });

  const handleRiskChange = (
    value: string,
    field: "rischio_ver_a" | "rischio_ver_b"
  ) => {
    let months = 0;
    const riskValue = value as "Non significativo" | "Poco significativo" | "Abbastanza significativo" | "Molto significativo";

    switch (riskValue) {
      case "Non significativo":
        months = 60;
        break;
      case "Poco significativo":
        months = 36;
        break;
      case "Abbastanza significativo":
        months = 24;
        break;
      case "Molto significativo":
        months = 12;
        break;
      default:
        months = 0;
    }

    const today = new Date();
    const scadenza = addMonths(today, months);

    if (field === "rischio_ver_a") {
      setFormData((prev) => ({
        ...prev,
        rischio_ver_a: riskValue,
        gg_ver_a: months,
        data_ultima_verifica_antiric: today,
        scadenza_antiric: scadenza,
        giorni_scad_ver_a: calcolaGiorniScadenza(scadenza),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        rischio_ver_b: riskValue,
        gg_ver_b: months,
        data_ultima_verifica_b: today,
        scadenza_antiric_b: scadenza,
        giorni_scad_ver_b: calcolaGiorniScadenza(scadenza),
      }));
    }
  };

  const handleGgVerChange = (blocco: "A" | "B", value: number | null) => {
    if (blocco === "A") {
      setFormData(prev => {
        const updated = { ...prev, gg_ver_a: value };
        if (updated.data_ultima_verifica_antiric && value) {
          updated.scadenza_antiric = addMonths(updated.data_ultima_verifica_antiric, value);
          updated.giorni_scad_ver_a = calcolaGiorniScadenza(updated.scadenza_antiric);
        }
        return updated;
      });
    } else {
      setFormData(prev => {
        const updated = { ...prev, gg_ver_b: value };
        if (updated.data_ultima_verifica_b && value) {
          updated.scadenza_antiric_b = addMonths(updated.data_ultima_verifica_b, value);
          updated.giorni_scad_ver_b = calcolaGiorniScadenza(updated.scadenza_antiric_b);
        }
        return updated;
      });
    }
  };

  const handleVerificaDateChange = (blocco: "A" | "B", date: Date | null) => {
    if (blocco === "A") {
      setFormData(prev => {
        const updated = { ...prev, data_ultima_verifica_antiric: date };
        if (date && prev.gg_ver_a) {
          updated.scadenza_antiric = addMonths(date, prev.gg_ver_a);
          updated.giorni_scad_ver_a = calcolaGiorniScadenza(updated.scadenza_antiric);
        }
        return updated;
      });
    } else {
      setFormData(prev => {
        const updated = { ...prev, data_ultima_verifica_b: date };
        if (date && prev.gg_ver_b) {
          updated.scadenza_antiric_b = addMonths(date, prev.gg_ver_b);
          updated.giorni_scad_ver_b = calcolaGiorniScadenza(updated.scadenza_antiric_b);
        }
        return updated;
      });
    }
  };

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const calcolaGiorniScadenza = (scadenza: Date | null): number | null => {
    if (!scadenza) return null;
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const scadenzaDate = new Date(scadenza);
    scadenzaDate.setHours(0, 0, 0, 0);
    const diffTime = scadenzaDate.getTime() - oggi.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getBadgeColor = (giorni: number | null): string => {
    if (giorni === null) return "bg-gray-200 text-gray-700";
    if (giorni < 15) return "bg-red-600 text-white";
    if (giorni < 30) return "bg-orange-500 text-white";
    return "bg-green-600 text-white";
  };

  const getUtenteNome = (utenteId: string | null): string => {
    if (!utenteId) return "-";
    const utente = utenti.find(u => u.id === utenteId);
    return utente ? `${utente.nome} ${utente.cognome}` : "-";
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterClienti();
  }, [clienti, searchTerm, selectedLetter, selectedUtenteFiscale, selectedUtentePayroll]);

  useEffect(() => {
    if (formData.settore === "Fiscale") {
      setFormData(prev => ({
        ...prev,
        utente_payroll_id: "",
        professionista_payroll_id: ""
      }));
    } else if (formData.settore === "Lavoro") {
      setFormData(prev => ({
        ...prev,
        utente_operatore_id: "",
        utente_professionista_id: ""
      }));
    }
  }, [formData.settore]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [
        clientiData,
        contattiData,
        utentiData,
        cassettiData,
        prestazioniData
      ] = await Promise.all([
        clienteService.getClienti(),
        contattoService.getContatti(),
        utenteService.getUtenti(),
        cassettiFiscaliService.getCassettiFiscali(),
        supabase.from("tbprestazioni").select("*").order("descrizione")
      ]);

      // Mappo i 3 flag booleani a stringa 'settore' per compatibilità con form originale
      const clientiMappati = (clientiData || []).map((cliente: any) => {
        let settore = "Fiscale"; // Default
        const flags = [];
        if (cliente.settore_fiscale) flags.push("Fiscale");
        if (cliente.settore_lavoro) flags.push("Lavoro");
        if (cliente.settore_consulenza) flags.push("Consulenza");

        if (flags.includes("Fiscale") && flags.includes("Lavoro")) {
          settore = "Fiscale & Lavoro";
        } else if (flags.length > 0) {
          settore = flags.join(" & ");
        } else if (cliente.settore) {
          // Fallback per vecchi record se esiste ancora la colonna (raro)
          settore = cliente.settore;
        }

        return { ...cliente, settore };
      });

      setClienti(clientiMappati);
      setContatti(contattiData);
      setUtenti(utentiData);
      setCassettiFiscali(cassettiData);
      setPrestazioni(prestazioniData.data || []);
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
  };

  const filterClienti = () => {
    let filtered = clienti;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.ragione_sociale?.toLowerCase().includes(search) ||
          c.partita_iva?.toLowerCase().includes(search) ||
          c.codice_fiscale?.toLowerCase().includes(search) ||
          c.email?.toLowerCase().includes(search) ||
          c.cod_cliente?.toLowerCase().includes(search)
      );
    }

    if (selectedLetter !== "Tutti") {
      filtered = filtered.filter((c) =>
        c.ragione_sociale?.toUpperCase().startsWith(selectedLetter)
      );
    }

    if (selectedUtenteFiscale !== "all") {
      filtered = filtered.filter((c) => c.utente_operatore_id === selectedUtenteFiscale);
    }

    if (selectedUtentePayroll !== "all") {
      filtered = filtered.filter((c) => c.utente_payroll_id === selectedUtentePayroll);
    }

    setFilteredClienti(filtered);
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

      const dataToSave = {
        ...formData,
        cod_cliente: formData.cod_cliente || `CL-${Date.now().toString().slice(-6)}`,
        utente_operatore_id: formData.utente_operatore_id || null,
        utente_professionista_id: formData.utente_professionista_id || null,
        utente_payroll_id: formData.utente_payroll_id || null,
        professionista_payroll_id: formData.professionista_payroll_id || null,
        contatto1_id: formData.contatto1_id || null,
        referente_esterno: formData.referente_esterno || null,
        tipo_prestazione_id: formData.tipo_prestazione_id || null,
        tipo_redditi: formData.tipo_redditi || null,
        cassetto_fiscale_id: formData.cassetto_fiscale_id || null,

        // Mappatura Settore Stringa -> Flags DB
        settore_fiscale: formData.settore?.includes("Fiscale") || false,
        settore_lavoro: formData.settore?.includes("Lavoro") || false,
        settore_consulenza: formData.settore?.includes("Consulenza") || false,
        tipologia_cliente: formData.tipologia_cliente || "Interno",

        matricola_inps: formData.matricola_inps || null,
        pat_inail: formData.pat_inail || null,
        codice_ditta_ce: formData.codice_ditta_ce || null,

        tipo_prestazione_a: formData.tipo_prestazione_a || null,
        tipo_prestazione_b: formData.tipo_prestazione_b || null,
        rischio_ver_a: formData.rischio_ver_a || null,
        rischio_ver_b: formData.rischio_ver_b || null,
        gg_ver_a: formData.gg_ver_a ?? null,
        gg_ver_b: formData.gg_ver_b ?? null,
        data_ultima_verifica_antiric: formData.data_ultima_verifica_antiric?.toISOString() || null,
        scadenza_antiric: formData.scadenza_antiric?.toISOString() || null,
        data_ultima_verifica_b: formData.data_ultima_verifica_b?.toISOString() || null,
        scadenza_antiric_b: formData.scadenza_antiric_b?.toISOString() || null,
        gestione_antiriciclaggio: formData.gestione_antiriciclaggio,
        note_antiriciclaggio: formData.note_antiriciclaggio,
        giorni_scad_ver_a: formData.giorni_scad_ver_a ?? null,
        giorni_scad_ver_b: formData.giorni_scad_ver_b ?? null,

        flag_iva: scadenzari.iva,
        flag_cu: scadenzari.cu,
        flag_bilancio: scadenzari.bilancio,
        flag_fiscali: scadenzari.fiscali,
        flag_lipe: scadenzari.lipe,
        flag_770: scadenzari.modello_770,
        flag_esterometro: scadenzari.esterometro,
        flag_ccgg: scadenzari.ccgg,
        flag_proforma: scadenzari.proforma,
        flag_imu: scadenzari.imu,
      };

      // Rimuovo il campo 'settore' che non esiste nel DB
      delete (dataToSave as any).settore;

      if (editingCliente) {
        await clienteService.updateCliente(editingCliente.id, dataToSave);
        toast({
          title: "Successo",
          description: "Cliente aggiornato con successo",
        });
      } else {
        await clienteService.createCliente(dataToSave);
        toast({
          title: "Successo",
          description: "Cliente creato con successo",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error("Errore salvataggio cliente:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare il cliente",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo cliente?")) return;

    try {
      await clienteService.deleteCliente(id);
      toast({
        title: "Successo",
        description: "Cliente eliminato con successo",
      });
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

  const handleInsertIntoScadenzari = async (cliente: Cliente) => {
    try {
      const scadenzariAttivi: string[] = [];
      const inserimenti: any[] = [];

      const baseData = {
        nominativo: cliente.ragione_sociale,
        utente_operatore_id: cliente.utente_operatore_id,
      };

      if (cliente.flag_iva) {
        scadenzariAttivi.push("IVA");
        inserimenti.push(
          supabase.from("tbscadiva").upsert({
            ...baseData,
            id: cliente.id,
          }, { onConflict: "id" }).then()
        );
      }

      if (cliente.flag_cu) {
        scadenzariAttivi.push("CU");
        inserimenti.push(
          supabase.from("tbscadcu").upsert({
            ...baseData,
            id: cliente.id,
          }, { onConflict: "id" }).then()
        );
      }

      if (cliente.flag_bilancio) {
        scadenzariAttivi.push("Bilanci");
        inserimenti.push(
          supabase.from("tbscadbilanci").upsert({
            ...baseData,
            id: cliente.id,
          }, { onConflict: "id" }).then()
        );
      }

      if (cliente.flag_fiscali) {
        scadenzariAttivi.push("Fiscali");
        inserimenti.push(
          supabase.from("tbscadfiscali").upsert({
            ...baseData,
            id: cliente.id,
          }, { onConflict: "id" }).then()
        );
      }

      if (cliente.flag_lipe) {
        scadenzariAttivi.push("LIPE");
        inserimenti.push(
          supabase.from("tbscadlipe").upsert({
            ...baseData,
            id: cliente.id,
          }, { onConflict: "id" }).then()
        );
      }

      if (cliente.flag_770) {
        scadenzariAttivi.push("770");
        inserimenti.push(
          supabase.from("tbscad770").upsert({
            ...baseData,
            id: cliente.id,
            utente_payroll_id: cliente.utente_payroll_id,
            professionista_payroll_id: cliente.professionista_payroll_id,
          }, { onConflict: "id" }).then()
        );
      }

      if (cliente.flag_esterometro) {
        scadenzariAttivi.push("Esterometro");
        inserimenti.push(
          supabase.from("tbscadestero").upsert({
            ...baseData,
            id: cliente.id,
          }, { onConflict: "id" }).then()
        );
      }

      if (cliente.flag_ccgg) {
        scadenzariAttivi.push("CCGG");
        inserimenti.push(
          supabase.from("tbscadccgg").upsert({
            ...baseData,
            id: cliente.id,
          }, { onConflict: "id" }).then()
        );
      }

      if (cliente.flag_proforma) {
        scadenzariAttivi.push("Proforma");
        inserimenti.push(
          supabase.from("tbscadproforma").upsert({
            ...baseData,
            id: cliente.id,
          }, { onConflict: "id" }).then()
        );
      }

      if (cliente.flag_imu) {
        scadenzariAttivi.push("IMU");

        const professionista = utenti.find(u => u.id === cliente.utente_professionista_id);
        const operatore = utenti.find(u => u.id === cliente.utente_operatore_id);

        const promises = [
          supabase.from("tbscadimu").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            professionista: professionista ? `${professionista.nome} ${professionista.cognome}` : null,
            operatore: operatore ? `${operatore.nome} ${operatore.cognome}` : null,
            acconto_imu: false,
            acconto_dovuto: false,
            acconto_comunicato: false,
            data_com_acconto: null,
            saldo_imu: false,
            saldo_dovuto: false,
            saldo_comunicato: false,
            data_com_saldo: null,
            dichiarazione_imu: false,
            data_scad_dichiarazione: null,
            dichiarazione_presentata: false,
            data_presentazione: null,
            note: null,
            conferma_riga: false
          }, { onConflict: "id" }).then()
        ];

        inserimenti.push(...promises);
      }

      if (cliente.gestione_antiriciclaggio) {
        scadenzariAttivi.push("Antiriciclaggio");
      }

      if (scadenzariAttivi.length === 0) {
        toast({
          title: "Attenzione",
          description: "Nessuno scadenzario selezionato per questo cliente nell'anagrafica",
          variant: "destructive",
        });
        return;
      }

      await Promise.all(inserimenti);

      toast({
        title: "Successo",
        description: `Cliente inserito in ${scadenzariAttivi.length} scadenzari: ${scadenzariAttivi.join(", ")}`,
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

  const handleAddNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);

    setFormData({
      ...formData,
      ...cliente,
      cod_cliente: cliente.cod_cliente || "",
      tipo_cliente: cliente.tipo_cliente || "Persona fisica",
      tipologia_cliente: cliente.tipologia_cliente || undefined,
      settore: (cliente as any).settore || undefined,
      ragione_sociale: cliente.ragione_sociale || "",
      partita_iva: cliente.partita_iva || "",
      codice_fiscale: cliente.codice_fiscale || "",
      indirizzo: cliente.indirizzo || "",
      cap: cliente.cap || "",
      citta: cliente.citta || "",
      provincia: cliente.provincia || "",
      email: cliente.email || "",
      attivo: cliente.attivo ?? false,
      tipo_redditi: (cliente.tipo_redditi as any) || undefined,
      utente_operatore_id: cliente.utente_operatore_id || "",
      utente_professionista_id: cliente.utente_professionista_id || "",
      utente_payroll_id: cliente.utente_payroll_id || "",
      professionista_payroll_id: cliente.professionista_payroll_id || "",
      contatto1_id: cliente.contatto1_id || "",
      referente_esterno: cliente.referente_esterno || "",
      tipo_prestazione_id: cliente.tipo_prestazione_id || "",
      cassetto_fiscale_id: cliente.cassetto_fiscale_id || "",
      matricola_inps: cliente.matricola_inps || "",
      pat_inail: cliente.pat_inail || "",
      codice_ditta_ce: cliente.codice_ditta_ce || "",
      note_antiriciclaggio: cliente.note_antiriciclaggio || "",
      gestione_antiriciclaggio: cliente.gestione_antiriciclaggio ?? false,
      gg_ver_a: cliente.gg_ver_a ?? null,
      gg_ver_b: cliente.gg_ver_b ?? null,
      data_ultima_verifica_antiric: cliente.data_ultima_verifica_antiric ? new Date(cliente.data_ultima_verifica_antiric) : null,
      scadenza_antiric: cliente.scadenza_antiric ? new Date(cliente.scadenza_antiric) : null,
      data_ultima_verifica_b: cliente.data_ultima_verifica_b ? new Date(cliente.data_ultima_verifica_b) : null,
      scadenza_antiric_b: cliente.scadenza_antiric_b ? new Date(cliente.scadenza_antiric_b) : null,
      rischio_ver_a: cliente.rischio_ver_a || "",
      rischio_ver_b: cliente.rischio_ver_b || "",
      tipo_prestazione_a: cliente.tipo_prestazione_a || "",
      tipo_prestazione_b: cliente.tipo_prestazione_b || "",
      giorni_scad_ver_a: cliente.giorni_scad_ver_a ?? null,
      giorni_scad_ver_b: cliente.giorni_scad_ver_b ?? null,
      note: cliente.note || "",
    });

    setScadenzari({
      iva: cliente.flag_iva ?? false,
      cu: cliente.flag_cu ?? false,
      bilancio: cliente.flag_bilancio ?? false,
      fiscali: cliente.flag_fiscali ?? false,
      lipe: cliente.flag_lipe ?? false,
      modello_770: cliente.flag_770 ?? false,
      esterometro: cliente.flag_esterometro ?? false,
      ccgg: cliente.flag_ccgg ?? false,
      proforma: cliente.flag_proforma ?? false,
      imu: cliente.flag_imu ?? false,
    });

    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCliente(null);
    setFormData({
      cod_cliente: "",
      tipo_cliente: "Persona fisica",
      tipologia_cliente: "Interno",
      settore: "Fiscale",
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
      gestione_antiriciclaggio: false,
      note_antiriciclaggio: "",
      giorni_scad_ver_a: null,
      giorni_scad_ver_b: null,
      tipo_prestazione_a: "",
      tipo_prestazione_b: "",
      rischio_ver_a: "",
      rischio_ver_b: "",
      gg_ver_a: null,
      gg_ver_b: null,
      data_ultima_verifica_antiric: null,
      scadenza_antiric: null,
      data_ultima_verifica_b: null,
      scadenza_antiric_b: null,
      note: "",
    });
    setScadenzari({
      iva: true,
      cu: true,
      bilancio: true,
      fiscali: true,
      lipe: true,
      modello_770: true,
      esterometro: true,
      ccgg: true,
      proforma: true,
      imu: true,
    });
  };

  const downloadTemplate = () => {
    const headers = [
      "Tipo Cliente",
      "Tipologia Cliente",
      "Settore",
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
      "Utente Fiscale",
      "Professionista Fiscale",
      "Utente Payroll",
      "Professionista Payroll",
      "Contatto 1",
      "Contatto 2",
      "Tipo Prestazione",
      "Tipo Redditi"
    ];

    const exampleRows = [
      [
        "Persona fisica",
        "Interno",
        "Fiscale",
        "ESEMPIO SRL",
        "01234567890",
        "01234567890",
        "Via Roma 1",
        "00100",
        "Roma",
        "RM",
        "info@esempio.it",
        "VERO",
        "Note di esempio",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "USC"
      ]
    ];

    const csvContent = [
      headers.join(";"),
      ...exampleRows.map(row => row.join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "template_importazione_clienti.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonData) {
        try {
          const rowData = row as any;

          const utenteOperatore = utenti.find(
            u => `${u.nome} ${u.cognome}` === rowData["Utente Fiscale"]
          );
          const utenteProfessionista = utenti.find(
            u => `${u.nome} ${u.cognome}` === rowData["Professionista Fiscale"]
          );
          const utentePayroll = utenti.find(
            u => `${u.nome} ${u.cognome}` === rowData["Utente Payroll"]
          );
          const professionistaPayroll = utenti.find(
            u => `${u.nome} ${u.cognome}` === rowData["Professionista Payroll"]
          );

          const clienteData = {
            cod_cliente: rowData["Codice Cliente"] || `CL-${Date.now().toString().slice(-6)}`,
            tipo_cliente: rowData["Tipo Cliente"] || "Persona fisica",
            tipologia_cliente: rowData["Tipologia Cliente"] || "Interno",
            settore_fiscale: rowData["Settore"]?.includes("Fiscale") || false,
            settore_lavoro: rowData["Settore"]?.includes("Lavoro") || false,
            settore_consulenza: rowData["Settore"]?.includes("Consulenza") || false,
            ragione_sociale: rowData["Ragione Sociale"],
            partita_iva: rowData["Partita IVA"] || null,
            codice_fiscale: rowData["Codice Fiscale"] || null,
            indirizzo: rowData["Indirizzo"] || null,
            cap: rowData["CAP"] || null,
            citta: rowData["Città"] || null,
            provincia: rowData["Provincia"] || null,
            email: rowData["Email"],
            attivo: rowData["Attivo"]?.toString().toLowerCase() === "vero" || true,
            note: rowData["Note"] || null,
            utente_operatore_id: utenteOperatore?.id || null,
            utente_professionista_id: utenteProfessionista?.id || null,
            utente_payroll_id: utentePayroll?.id || null,
            professionista_payroll_id: professionistaPayroll?.id || null,
            tipo_redditi: rowData["Tipo Redditi"] || null,
            flag_iva: true,
            flag_cu: true,
            flag_bilancio: true,
            flag_fiscali: true,
            flag_lipe: true,
            flag_770: true,
            flag_esterometro: true,
            flag_ccgg: true,
            flag_proforma: true,
            flag_imu: true,
          };

          await clienteService.createCliente(clienteData);
          successCount++;
        } catch (error) {
          console.error("Errore importazione riga:", error);
          errorCount++;
        }
      }

      toast({
        title: "Importazione completata",
        description: `${successCount} clienti importati con successo${errorCount > 0 ? `, ${errorCount} errori` : ""}`,
      });

      setImportDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Errore importazione file:", error);
      toast({
        title: "Errore",
        description: "Impossibile importare il file",
        variant: "destructive",
      });
    }

    event.target.value = "";
  };

  const handleExportExcel = () => {
    const exportData = filteredClienti.map((cliente) => ({
      "Codice Cliente": cliente.cod_cliente,
      "Tipo Cliente": cliente.tipo_cliente,
      "Tipologia Cliente": cliente.tipologia_cliente,
      "Settore": (cliente as any).settore,
      "Ragione Sociale": cliente.ragione_sociale,
      "Partita IVA": cliente.partita_iva,
      "Codice Fiscale": cliente.codice_fiscale,
      "Indirizzo": cliente.indirizzo,
      "CAP": cliente.cap,
      "Città": cliente.citta,
      "Provincia": cliente.provincia,
      "Email": cliente.email,
      "Utente Fiscale": getUtenteNome(cliente.utente_operatore_id),
      "Professionista Fiscale": getUtenteNome(cliente.utente_professionista_id),
      "Utente Payroll": getUtenteNome(cliente.utente_payroll_id),
      "Professionista Payroll": getUtenteNome(cliente.professionista_payroll_id),
      "Tipo Redditi": cliente.tipo_redditi,
      "Attivo": cliente.attivo ? "SI" : "NO",
      "Note": cliente.note,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clienti");
    XLSX.writeFile(workbook, `clienti_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Caricamento in corso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-2">
            <Users className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-bold">Gestione Clienti</CardTitle>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              id="import-file"
              onChange={handleImportExcel}
            />
            <Button variant="outline" onClick={() => document.getElementById("import-file")?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Importa
            </Button>
            <Button variant="outline" onClick={downloadTemplate}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Template
            </Button>
            <Button variant="outline" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Esporta
            </Button>
            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Cliente
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per denominazione, codice, P.IVA o codice fiscale..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedUtenteFiscale} onValueChange={setSelectedUtenteFiscale}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Utente Fiscale" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli Utenti</SelectItem>
                {utenti.map((utente) => (
                  <SelectItem key={utente.id} value={utente.id}>
                    {utente.nome} {utente.cognome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedUtentePayroll} onValueChange={setSelectedUtentePayroll}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Utente Payroll" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli Utenti</SelectItem>
                {utenti.map((utente) => (
                  <SelectItem key={utente.id} value={utente.id}>
                    {utente.nome} {utente.cognome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-1 flex-wrap">
            <Button
              variant={selectedLetter === "Tutti" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedLetter("Tutti")}
            >
              Tutti
            </Button>
            {alphabet.map((letter) => (
              <Button
                key={letter}
                variant={selectedLetter === letter ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedLetter(letter)}
              >
                {letter}
              </Button>
            ))}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Denominazione</TableHead>
                  <TableHead>P.IVA</TableHead>
                  <TableHead>Codice Fiscale</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tipo Redditi</TableHead>
                  <TableHead className="min-w-[200px]">Utente Fiscale</TableHead>
                  <TableHead>Professionista Fiscale</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClienti.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      Nessun cliente trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClienti.map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">{cliente.cod_cliente}</TableCell>
                      <TableCell>{cliente.ragione_sociale}</TableCell>
                      <TableCell>{cliente.partita_iva}</TableCell>
                      <TableCell>{cliente.codice_fiscale}</TableCell>
                      <TableCell>{cliente.tipo_cliente}</TableCell>
                      <TableCell>{cliente.tipo_redditi || "-"}</TableCell>
                      <TableCell>{getUtenteNome(cliente.utente_operatore_id)}</TableCell>
                      <TableCell>{getUtenteNome(cliente.utente_professionista_id)}</TableCell>
                      <TableCell>{cliente.email}</TableCell>
                      <TableCell>
                        <Badge variant={cliente.attivo ? "default" : "secondary"}>
                          {cliente.attivo ? "Attivo" : "Inattivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(cliente)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleInsertIntoScadenzari(cliente)}
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cliente.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Resto del codice del Dialog rimane invariato - CONTINUA NEL PROSSIMO MESSAGGIO per non superare il limite */}
    </div>
  );
}
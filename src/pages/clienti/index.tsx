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
import { Users, Edit, Trash2, Search, Plus, Upload, FileSpreadsheet, CheckCircle2, Calendar, X, ChevronDown } from "lucide-react";
import { clienteService } from "@/services/clienteService";
import { contattoService } from "@/services/contattoService";
import { utenteService } from "@/services/utenteService";
import { cassettiFiscaliService } from "@/services/cassettiFiscaliService";
import { riferimentiValoriService } from "@/services/riferimentiValoriService";
import { Switch } from "@/components/ui/switch";
import * as XLSX from "xlsx";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type CassettoFiscale = Database["public"]["Tables"]["tbcassetti_fiscali"]["Row"];
type Prestazione = Database["public"]["Tables"]["tbprestazioni"]["Row"];
type RiferimentoValore = Database["public"]["Tables"]["tbreferimenti_valori"]["Row"];

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

type ComunicazioniPreferenze = {
  email_attiva: boolean;
  ricevi_mailing_scadenze: boolean;
  ricevi_newsletter: boolean;
};

const RISK_TO_MONTHS: Record<
  "Non significativo" | "Poco significativo" | "Abbastanza significativo" | "Molto significativo",
  number
> = {
  "Non significativo": 36,
  "Poco significativo": 36,
  "Abbastanza significativo": 12,
  "Molto significativo": 6,
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

type PendingRiferimento = {
  tipo: "matricola_inps" | "pat_inail" | "codice_ditta_ce";
  valore: string;
} | null;

export default function ClientiPage() {
  const { toast } = useToast();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [filteredClienti, setFilteredClienti] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string>("Tutti");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contatti, setContatti] = useState<Contatto[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [cassettiFiscali, setCassettiFiscali] = useState<CassettoFiscale[]>([]);
  const [prestazioni, setPrestazioni] = useState<Prestazione[]>([]);

  const [matricoleInps, setMatricoleInps] = useState<RiferimentoValore[]>([]);
  const [patInail, setPatInail] = useState<RiferimentoValore[]>([]);
  const [codiciDittaCe, setCodiciDittaCe] = useState<RiferimentoValore[]>([]);

  const [showMatricolaDropdown, setShowMatricolaDropdown] = useState(false);
  const [showPatDropdown, setShowPatDropdown] = useState(false);
  const [showCodiceDropdown, setShowCodiceDropdown] = useState(false);

  const [pendingRiferimento, setPendingRiferimento] = useState<PendingRiferimento>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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

  const [formData, setFormData] = useState({
    cod_cliente: '',
    ragione_sociale: '',
    partita_iva: '',
    codice_fiscale: '',
    indirizzo: '',
    cap: '',
    citta: '',
    provincia: '',
    email: '',
    tipo_cliente: "PERSONA_FISICA" as string,
    tipologia_cliente: undefined as "CL interno" | "CL esterno" | undefined,
    attivo: true,
    note: '',
    utente_operatore_id: '',
    utente_professionista_id: '',
    utente_payroll_id: '',
    professionista_payroll_id: '',
    contatto1_id: '',
    contatto2_id: '',
    tipo_prestazione_id: '',
    tipo_redditi: undefined as "SC" | "SP" | "ENC" | "PF" | "730" | undefined,
    cassetto_fiscale_id: '',
    settore: undefined as "Fiscale" | "Lavoro" | "Fiscale & Lavoro" | undefined,
    matricola_inps: '',
    pat_inail: '',
    codice_ditta_ce: '',
    tipo_prestazione_a: '',
    tipo_prestazione_b: '',
    rischio_ver_a: undefined as "Non significativo" | "Poco significativo" | "Abbastanza significativo" | "Molto significativo" | undefined,
    rischio_ver_b: undefined as "Non significativo" | "Poco significativo" | "Abbastanza significativo" | "Molto significativo" | undefined,
    gg_ver_a: undefined as number | undefined,
    gg_ver_b: undefined as number | undefined,
    data_ultima_verifica_antiric: undefined as Date | undefined,
    scadenza_antiric: undefined as Date | undefined,
    data_ultima_verifica_b: undefined as Date | undefined,
    scadenza_antiric_b: undefined as Date | undefined,
    gestione_antiriciclaggio: false,
    note_antiriciclaggio: '',
    giorni_scad_ver_a: null as number | null,
    giorni_scad_ver_b: null as number | null,
  });

  const [comunicazioni, setComunicazioni] = useState<ComunicazioniPreferenze>({
    email_attiva: true,
    ricevi_mailing_scadenze: true,
    ricevi_newsletter: true,
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

  const handleGgVerChange = (blocco: "A" | "B", value: number | undefined) => {
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

  const handleVerificaDateChange = (blocco: "A" | "B", date: Date | undefined) => {
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

  const calcolaGiorniScadenza = (scadenza: Date | undefined): number | null => {
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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterClienti();
  }, [clienti, searchTerm, selectedLetter]);

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
        prestazioniData,
        matricoleData,
        patData,
        codiciData
      ] = await Promise.all([
        clienteService.getClienti(),
        contattoService.getContatti(),
        utenteService.getUtenti(),
        cassettiFiscaliService.getCassettiFiscali(),
        supabase.from("tbprestazioni").select("*").order("descrizione"),
        riferimentiValoriService.getValoriByTipo("matricola_inps"),
        riferimentiValoriService.getValoriByTipo("pat_inail"),
        riferimentiValoriService.getValoriByTipo("codice_ditta_ce")
      ]);

      setClienti(clientiData);
      setContatti(contattiData);
      setUtenti(utentiData);
      setCassettiFiscali(cassettiData);
      setPrestazioni(prestazioniData.data || []);
      setMatricoleInps(matricoleData);
      setPatInail(patData);
      setCodiciDittaCe(codiciData);
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
          c.email?.toLowerCase().includes(search)
      );
    }

    if (selectedLetter !== "Tutti") {
      filtered = filtered.filter((c) =>
        c.ragione_sociale?.toUpperCase().startsWith(selectedLetter)
      );
    }

    setFilteredClienti(filtered);
  };

  const handleSave = async () => {
    try {
      if (!formData.ragione_sociale || !formData.partita_iva || !formData.email) {
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
        contatto2_id: formData.contatto2_id || null,
        tipo_prestazione_id: formData.tipo_prestazione_id || null,
        tipo_redditi: formData.tipo_redditi || null,
        cassetto_fiscale_id: formData.cassetto_fiscale_id || null,
        settore: formData.settore || null,
        tipologia_cliente: formData.tipologia_cliente || null,
        matricola_inps: formData.matricola_inps || null,
        pat_inail: formData.pat_inail || null,
        codice_ditta_ce: formData.codice_ditta_ce || null,
        tipo_prestazione_a: formData.tipo_prestazione_a || null,
        tipo_prestazione_b: formData.tipo_prestazione_b || null,
        rischio_ver_a: formData.rischio_ver_a || null,
        rischio_ver_b: formData.rischio_ver_b || null,
        gg_ver_a: formData.gg_ver_a || null,
        gg_ver_b: formData.gg_ver_b || null,
        data_ultima_verifica_antiric: formData.data_ultima_verifica_antiric?.toISOString() || null,
        scadenza_antiric: formData.scadenza_antiric?.toISOString() || null,
        data_ultima_verifica_b: formData.data_ultima_verifica_b?.toISOString() || null,
        scadenza_antiric_b: formData.scadenza_antiric_b?.toISOString() || null,
        gestione_antiriciclaggio: formData.gestione_antiriciclaggio,
        note_antiriciclaggio: formData.note_antiriciclaggio,
        giorni_scad_ver_a: formData.giorni_scad_ver_a,
        giorni_scad_ver_b: formData.giorni_scad_ver_b,
        
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
    } catch (error) {
      console.error("Errore salvataggio cliente:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il cliente",
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
      cod_cliente: cliente.cod_cliente || '',
      ragione_sociale: cliente.ragione_sociale || '',
      partita_iva: cliente.partita_iva || '',
      codice_fiscale: cliente.codice_fiscale || '',
      indirizzo: cliente.indirizzo || '',
      cap: cliente.cap || '',
      citta: cliente.citta || '',
      provincia: cliente.provincia || '',
      email: cliente.email || '',
      tipo_cliente: cliente.tipo_cliente || "PERSONA_FISICA",
      tipologia_cliente: (cliente.tipologia_cliente as "CL interno" | "CL esterno") || undefined,
      attivo: cliente.attivo ?? true,
      note: cliente.note || '',
      utente_operatore_id: cliente.utente_operatore_id || '',
      utente_professionista_id: cliente.utente_professionista_id || '',
      utente_payroll_id: cliente.utente_payroll_id || '',
      professionista_payroll_id: cliente.professionista_payroll_id || '',
      contatto1_id: cliente.contatto1_id || '',
      contatto2_id: cliente.contatto2_id || '',
      tipo_prestazione_id: cliente.tipo_prestazione_id || '',
      tipo_redditi: (cliente.tipo_redditi as "SC" | "SP" | "ENC" | "PF" | "730") || undefined,
      cassetto_fiscale_id: cliente.cassetto_fiscale_id || '',
      settore: (cliente.settore as "Fiscale" | "Lavoro" | "Fiscale & Lavoro") || undefined,
      matricola_inps: cliente.matricola_inps || '',
      pat_inail: cliente.pat_inail || '',
      codice_ditta_ce: cliente.codice_ditta_ce || '',
      tipo_prestazione_a: cliente.tipo_prestazione_a || '',
      tipo_prestazione_b: cliente.tipo_prestazione_b || '',
      rischio_ver_a: (cliente.rischio_ver_a as "Non significativo" | "Poco significativo" | "Abbastanza significativo" | "Molto significativo") || undefined,
      rischio_ver_b: (cliente.rischio_ver_b as "Non significativo" | "Poco significativo" | "Abbastanza significativo" | "Molto significativo") || undefined,
      gg_ver_a: cliente.gg_ver_a || undefined,
      gg_ver_b: cliente.gg_ver_b || undefined,
      data_ultima_verifica_antiric: cliente.data_ultima_verifica_antiric ? new Date(cliente.data_ultima_verifica_antiric) : undefined,
      scadenza_antiric: cliente.scadenza_antiric ? new Date(cliente.scadenza_antiric) : undefined,
      data_ultima_verifica_b: cliente.data_ultima_verifica_b ? new Date(cliente.data_ultima_verifica_b) : undefined,
      scadenza_antiric_b: cliente.scadenza_antiric_b ? new Date(cliente.scadenza_antiric_b) : undefined,
      gestione_antiriciclaggio: cliente.gestione_antiriciclaggio ?? false,
      note_antiriciclaggio: cliente.note_antiriciclaggio || '',
      giorni_scad_ver_a: cliente.giorni_scad_ver_a ?? null,
      giorni_scad_ver_b: cliente.giorni_scad_ver_b ?? null,
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
    
    setComunicazioni({
      email_attiva: cliente.email_attiva ?? true,
      ricevi_mailing_scadenze: cliente.ricevi_mailing_scadenze ?? true,
      ricevi_newsletter: cliente.ricevi_newsletter ?? true,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCliente(null);
    setFormData({
      cod_cliente: '',
      ragione_sociale: '',
      partita_iva: '',
      codice_fiscale: '',
      indirizzo: '',
      cap: '',
      citta: '',
      provincia: '',
      email: '',
      tipo_cliente: "PERSONA_FISICA",
      tipologia_cliente: undefined,
      attivo: true,
      note: '',
      utente_operatore_id: '',
      utente_professionista_id: '',
      utente_payroll_id: '',
      professionista_payroll_id: '',
      contatto1_id: '',
      contatto2_id: '',
      tipo_prestazione_id: '',
      tipo_redditi: undefined,
      cassetto_fiscale_id: '',
      settore: undefined,
      matricola_inps: '',
      pat_inail: '',
      codice_ditta_ce: '',
      tipo_prestazione_a: '',
      tipo_prestazione_b: '',
      rischio_ver_a: undefined,
      rischio_ver_b: undefined,
      gg_ver_a: undefined,
      gg_ver_b: undefined,
      data_ultima_verifica_antiric: undefined,
      scadenza_antiric: undefined,
      data_ultima_verifica_b: undefined,
      scadenza_antiric_b: undefined,
      gestione_antiriciclaggio: false,
      note_antiriciclaggio: '',
      giorni_scad_ver_a: null,
      giorni_scad_ver_b: null,
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
    setComunicazioni({
      email_attiva: true,
      ricevi_mailing_scadenze: true,
      ricevi_newsletter: true,
    });
  };

  const handleRequestNewRiferimento = async (tipo: "matricola_inps" | "pat_inail" | "codice_ditta_ce", valore: string) => {
    if (!valore.trim()) return;

    const lista = tipo === "matricola_inps" ? matricoleInps : tipo === "pat_inail" ? patInail : codiciDittaCe;
    const exists = lista.some(item => item.valore.toLowerCase() === valore.toLowerCase());

    if (exists) {
      if (tipo === "matricola_inps") {
        setFormData({ ...formData, matricola_inps: valore });
        setShowMatricolaDropdown(false);
      } else if (tipo === "pat_inail") {
        setFormData({ ...formData, pat_inail: valore });
        setShowPatDropdown(false);
      } else {
        setFormData({ ...formData, codice_ditta_ce: valore });
        setShowCodiceDropdown(false);
      }
      return;
    }

    setPendingRiferimento({ tipo, valore });
    setShowConfirmDialog(true);
  };

  const handleConfirmNewRiferimento = async () => {
    if (!pendingRiferimento) return;

    const { tipo, valore } = pendingRiferimento;

    try {
      const existingValue = await riferimentiValoriService.checkExists(tipo, valore);

      if (existingValue) {
        toast({
          title: "ℹ️ Valore già esistente",
          description: `Il valore "${existingValue.valore}" è già presente nell'elenco`,
          variant: "default",
        });

        const updatedList = await riferimentiValoriService.getValoriByTipo(tipo);
        
        if (tipo === "matricola_inps") {
          setMatricoleInps(updatedList);
          setFormData({ ...formData, matricola_inps: existingValue.valore });
          setShowMatricolaDropdown(false);
        } else if (tipo === "pat_inail") {
          setPatInail(updatedList);
          setFormData({ ...formData, pat_inail: existingValue.valore });
          setShowPatDropdown(false);
        } else if (tipo === "codice_ditta_ce") {
          setCodiciDittaCe(updatedList);
          setFormData({ ...formData, codice_ditta_ce: existingValue.valore });
          setShowCodiceDropdown(false);
        }

        setShowConfirmDialog(false);
        setPendingRiferimento(null);
        return;
      }

      const newValue = await riferimentiValoriService.createValore(tipo, valore);

      if (newValue) {
        toast({
          title: "✅ Successo",
          description: `${tipo === "matricola_inps" ? "Matricola INPS" : tipo === "pat_inail" ? "Pat INAIL" : "Codice Ditta CE"} aggiunto con successo`,
        });

        const updatedList = await riferimentiValoriService.getValoriByTipo(tipo);
        
        if (tipo === "matricola_inps") {
          setMatricoleInps(updatedList);
          setFormData({ ...formData, matricola_inps: newValue.valore });
          setShowMatricolaDropdown(false);
        } else if (tipo === "pat_inail") {
          setPatInail(updatedList);
          setFormData({ ...formData, pat_inail: newValue.valore });
          setShowPatDropdown(false);
        } else if (tipo === "codice_ditta_ce") {
          setCodiciDittaCe(updatedList);
          setFormData({ ...formData, codice_ditta_ce: newValue.valore });
          setShowCodiceDropdown(false);
        }
      }
    } catch (error: any) {
      console.error("Errore durante l'inserimento del riferimento:", error);

      if (error.message?.includes("duplicate key") || error.message?.includes("unique constraint") || error.code === "23505") {
        toast({
          title: "⚠️ Valore già esistente",
          description: `Il valore "${valore}" è già presente nell'elenco`,
          variant: "default",
        });

        try {
          const updatedList = await riferimentiValoriService.getValoriByTipo(tipo);
          
          if (tipo === "matricola_inps") {
            setMatricoleInps(updatedList);
            setFormData({ ...formData, matricola_inps: valore });
            setShowMatricolaDropdown(false);
          } else if (tipo === "pat_inail") {
            setPatInail(updatedList);
            setFormData({ ...formData, pat_inail: valore });
            setShowPatDropdown(false);
          } else if (tipo === "codice_ditta_ce") {
            setCodiciDittaCe(updatedList);
            setFormData({ ...formData, codice_ditta_ce: valore });
            setShowCodiceDropdown(false);
          }
        } catch (reloadError) {
          console.error("Errore durante il ricaricamento della lista:", reloadError);
        }
      } else {
        toast({
          title: "❌ Errore",
          description: "Impossibile salvare il valore. Riprova.",
          variant: "destructive",
        });
      }
    } finally {
      setShowConfirmDialog(false);
      setPendingRiferimento(null);
    }
  };

  const handleCancelNewRiferimento = () => {
    setShowConfirmDialog(false);
    setPendingRiferimento(null);
  };

  const handleDeleteRiferimentoValore = async (id: string, tipo: "matricola_inps" | "pat_inail" | "codice_ditta_ce") => {
    try {
      await riferimentiValoriService.deleteValore(id);
      
      if (tipo === "matricola_inps") {
        setMatricoleInps(matricoleInps.filter(m => m.id !== id));
      } else if (tipo === "pat_inail") {
        setPatInail(patInail.filter(p => p.id !== id));
      } else {
        setCodiciDittaCe(codiciDittaCe.filter(c => c.id !== id));
      }

      toast({
        title: "Successo",
        description: "Valore eliminato con successo",
      });
    } catch (error) {
      console.error("Errore eliminazione valore:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il valore",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = () => {
    const headers = ["Ragione Sociale", "P.IVA", "Codice Fiscale", "Email", "Città", "Stato"];
    const rows = filteredClienti.map((c) => [
      c.ragione_sociale,
      c.partita_iva,
      c.codice_fiscale,
      c.email,
      c.citta,
      c.attivo ? "Attivo" : "Inattivo",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clienti.csv";
    a.click();
  };

  const downloadTemplate = () => {
    const headers = [
      "tipo_cliente",
      "tipologia_cliente",
      "settore",
      "ragione_sociale",
      "partita_iva",
      "codice_fiscale",
      "indirizzo",
      "cap",
      "citta",
      "provincia",
      "email",
      "attivo",
      "note"
    ];

    const exampleRows = [
      [
        "Persona Giuridica",
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
        "Note di esempio"
      ]
    ];

    const csvContent = [
      headers.join(","),
      ...exampleRows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "template_importazione_clienti.csv";
    link.click();

    toast({
      title: "Template scaricato",
      description: "Compila il file CSV seguendo l'esempio fornito. Lascia vuoti i campi non obbligatori se non disponibili."
    });
  };

  const clientiConCassetto = clienti.filter((c) => c.cassetto_fiscale_id).length;
  const percentualeCassetto = clienti.length > 0 ? Math.round((clientiConCassetto / clienti.length) * 100) : 0;

  const getNomeTipoRiferimento = (tipo: "matricola_inps" | "pat_inail" | "codice_ditta_ce") => {
    const nomi = {
      matricola_inps: "Matricola INPS",
      pat_inail: "PAT INAIL",
      codice_ditta_ce: "Codice Ditta CE"
    };
    return nomi[tipo];
  };

  const getFilteredSuggestions = (tipo: "matricola_inps" | "pat_inail" | "codice_ditta_ce", searchValue: string) => {
    const lista = tipo === "matricola_inps" ? matricoleInps : tipo === "pat_inail" ? patInail : codiciDittaCe;
    if (!searchValue) return lista;
    return lista.filter(item => item.valore.toLowerCase().includes(searchValue.toLowerCase()));
  };

  const isFieldEnabled = (field: "fiscale" | "payroll") => {
    if (!formData.settore) return true;
    if (formData.settore === "Fiscale & Lavoro") return true;
    if (formData.settore === "Fiscale" && field === "fiscale") return true;
    if (formData.settore === "Lavoro" && field === "payroll") return true;
    return false;
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      let rows: any[] = [];

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        rows = jsonData.slice(1).map((row: any) => {
          if (Array.isArray(row)) {
            return row;
          }
          return [];
        });
      } else {
        const text = await file.text();
        const lines = text.split("\n");
        rows = lines.slice(1).map(line => {
          const delimiter = line.includes(";") ? ";" : ",";
          return line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
        });
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const values = rows[i];
        
        if (!values || values.length === 0 || !values[0]) continue;

        const tipoClienteRaw = (values[0] || "").toString().trim().toLowerCase();
        const tipologiaRaw = (values[1] || "").toString().trim().toLowerCase();
        const settoreRaw = (values[2] || "").toString().trim();
        const ragioneSociale = (values[3] || "").toString().trim();
        const piva = (values[4] || "").toString().trim();
        const cf = (values[5] || "").toString().trim();
        const indirizzo = (values[6] || "").toString().trim();
        const cap = (values[7] || "").toString().trim();
        const citta = (values[8] || "").toString().trim();
        const provincia = (values[9] || "").toString().trim();
        const email = (values[10] || "").toString().trim();
        const attivoRaw = (values[11] || "VERO").toString().trim().toUpperCase();
        const note = (values[12] || "").toString().trim();

        if (!ragioneSociale) {
          errors.push(`Riga ${i + 2}: Ragione sociale obbligatoria`);
          errorCount++;
          continue;
        }

        if (!tipoClienteRaw) {
          errors.push(`Riga ${i + 2}: Tipo cliente obbligatorio`);
          errorCount++;
          continue;
        }

        if (!tipologiaRaw) {
          errors.push(`Riga ${i + 2}: Tipologia cliente obbligatoria`);
          errorCount++;
          continue;
        }

        if (!settoreRaw) {
          errors.push(`Riga ${i + 2}: Settore obbligatorio`);
          errorCount++;
          continue;
        }

        const tipoCliente = tipoClienteRaw.includes("fisica") 
          ? "PERSONA_FISICA" 
          : tipoClienteRaw.includes("giuridica") 
          ? "PERSONA_GIURIDICA" 
          : "PERSONA_GIURIDICA";

        let tipologia: "CL interno" | "CL esterno" | null = null;
        if (tipologiaRaw.includes("interno") || tipologiaRaw.includes("interna")) {
          tipologia = "CL interno";
        } else if (tipologiaRaw.includes("esterno") || tipologiaRaw.includes("esterna")) {
          tipologia = "CL esterno";
        }

        if (!tipologia) {
          errors.push(`Riga ${i + 2}: Tipologia non valida (deve essere Interno o Esterno)`);
          errorCount++;
          continue;
        }

        let settore: "Fiscale" | "Lavoro" | "Fiscale & Lavoro" | null = null;
        if (settoreRaw.toLowerCase().includes("fiscale") && settoreRaw.toLowerCase().includes("lavoro")) {
          settore = "Fiscale & Lavoro";
        } else if (settoreRaw.toLowerCase().includes("fiscale")) {
          settore = "Fiscale";
        } else if (settoreRaw.toLowerCase().includes("lavoro")) {
          settore = "Lavoro";
        }

        if (!settore) {
          errors.push(`Riga ${i + 2}: Settore non valido (deve essere Fiscale, Lavoro o Fiscale & Lavoro)`);
          errorCount++;
          continue;
        }

        const attivo = attivoRaw === "VERO" || attivoRaw === "TRUE" || attivoRaw === "SI" || attivoRaw === "1";

        const clienteData: any = {
          tipo_cliente: tipoCliente,
          tipologia_cliente: tipologia,
          settore: settore,
          ragione_sociale: ragioneSociale,
          attivo: attivo,
        };

        if (piva) clienteData.partita_iva = piva;
        if (cf) clienteData.codice_fiscale = cf;
        if (indirizzo) clienteData.indirizzo = indirizzo;
        if (cap) clienteData.cap = cap;
        if (citta) clienteData.citta = citta;
        if (provincia) clienteData.provincia = provincia;
        if (email) clienteData.email = email;
        if (note) clienteData.note = note;

        try {
          await clienteService.createCliente(clienteData);
          successCount++;
        } catch (error: any) {
          errorCount++;
          const errorMsg = error.message || "Errore sconosciuto";
          errors.push(`Riga ${i + 2}: ${errorMsg}`);
          console.error(`Errore importazione riga ${i + 2}:`, error);
        }
      }

      if (errors.length > 0 && errors.length <= 10) {
        console.error("Primi 10 errori importazione:", errors.slice(0, 10));
      }

      toast({
        title: "Importazione completata",
        description: `✅ ${successCount} clienti importati con successo\n${errorCount > 0 ? `❌ ${errorCount} errori` : ''}`,
        variant: successCount > 0 ? "default" : "destructive",
      });

      loadData();
      
      event.target.value = "";
    } catch (error) {
      console.error("Errore importazione file:", error);
      toast({
        title: "Errore",
        description: "Impossibile importare il file. Verifica che sia un file Excel (.xlsx, .xls) o CSV valido.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Caricamento clienti...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-3xl font-bold">Gestione Clienti</h1>
            <p className="text-muted-foreground mt-1">
              Anagrafica completa e gestione scadenzari
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 w-full sm:w-auto">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Importa Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
                <DialogHeader>
                  <DialogTitle>Importazione Clienti da Excel/CSV</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-900">
                        <p className="font-semibold mb-2">📋 Colonne richieste (in ordine):</p>
                        <ol className="list-decimal list-inside space-y-1 text-xs">
                          <li><strong>Tipo Cliente</strong> - <span className="text-red-600">OBBLIGATORIO</span> (Persona fisica/Persona giuridica)</li>
                          <li><strong>Tipologia Cliente</strong> - <span className="text-red-600">OBBLIGATORIO</span> (Interno/Esterno)</li>
                          <li><strong>Settore</strong> - <span className="text-red-600">OBBLIGATORIO</span> (Fiscale/Lavoro/Fiscale & Lavoro)</li>
                          <li><strong>Ragione Sociale</strong> - <span className="text-red-600">OBBLIGATORIO</span></li>
                          <li><strong>Partita IVA</strong> - Opzionale</li>
                          <li><strong>Codice Fiscale</strong> - Opzionale</li>
                          <li><strong>Indirizzo</strong> - Opzionale</li>
                          <li><strong>CAP</strong> - Opzionale</li>
                          <li><strong>Città</strong> - Opzionale</li>
                          <li><strong>Provincia</strong> - Opzionale</li>
                          <li><strong>Email</strong> - Opzionale</li>
                          <li><strong>Attivo</strong> - Opzionale (VERO/FALSO, default: VERO)</li>
                          <li><strong>Note</strong> - Opzionale</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={downloadTemplate}
                    variant="outline"
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Scarica Template CSV
                  </Button>

                  <div className="space-y-2">
                    <Label htmlFor="csv-file-clienti">Carica File Excel/CSV</Label>
                    <Input
                      id="csv-file-clienti"
                      type="file"
                      accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCsvFile(file);
                          handleImportCSV(e);
                        }
                      }}
                      className="cursor-pointer"
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totale Contatti
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
            <div className="text-4xl font-bold text-blue-600">{clientiConCassetto}</div>
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
            <div className="text-4xl font-bold text-green-600">{percentualeCassetto}%</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Ricerca e Filtri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              placeholder="Cerca per ragione sociale, P.IVA o CF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>

          <div className="space-y-3">
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filteredClienti.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nessun cliente trovato</h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || selectedLetter !== "Tutti"
                  ? "Prova a modificare i filtri di ricerca"
                  : "Inizia aggiungendo il tuo primo cliente"}
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Aggiungi Cliente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cod. Cliente</TableHead>
                  <TableHead>Ragione Sociale</TableHead>
                  <TableHead>P.IVA</TableHead>
                  <TableHead>Città</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-center">Scadenzari</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClienti.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-mono text-sm">
                      {cliente.cod_cliente || cliente.id.substring(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {cliente.ragione_sociale}
                    </TableCell>
                    <TableCell>{cliente.partita_iva}</TableCell>
                    <TableCell>{cliente.citta}</TableCell>
                    <TableCell>{cliente.email}</TableCell>
                    <TableCell>
                      {cliente.attivo ? (
                        <Badge variant="default" className="bg-green-600">
                          Attivo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inattivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleInsertIntoScadenzari(cliente)}
                        title="Inserisci negli Scadenzari"
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCliente ? "Modifica Cliente" : "Nuovo Cliente"}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="anagrafica" className="w-full">
            <TabsList className="grid w-full grid-cols-6 overflow-x-auto">
              <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
              <TabsTrigger value="riferimenti">Riferimenti</TabsTrigger>
              <TabsTrigger value="altri_dati">Altri Dati</TabsTrigger>
              <TabsTrigger value="antiriciclaggio">Antiriciclaggio</TabsTrigger>
              <TabsTrigger value="scadenzari">Scadenzari</TabsTrigger>
              <TabsTrigger value="comunicazioni">Comunicazioni</TabsTrigger>
            </TabsList>

            <TabsContent value="anagrafica" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cod_cliente">Codice Cliente</Label>
                  <Input
                    id="cod_cliente"
                    value={formData.cod_cliente}
                    onChange={(e) =>
                      setFormData({ ...formData, cod_cliente: e.target.value })
                    }
                    placeholder="Generato automaticamente se vuoto"
                  />
                </div>

                <div>
                  <Label htmlFor="tipo_cliente">Tipo Cliente</Label>
                  <Select
                    value={formData.tipo_cliente}
                    onValueChange={(value) =>
                      setFormData({ ...formData, tipo_cliente: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERSONA_FISICA">Persona Fisica</SelectItem>
                      <SelectItem value="PERSONA_GIURIDICA">Persona Giuridica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tipologia_cliente">Tipologia Cliente</Label>
                  <Select
                    value={formData.tipologia_cliente || undefined}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, tipologia_cliente: value as "CL interno" | "CL esterno" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipologia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CL interno">Interno</SelectItem>
                      <SelectItem value="CL esterno">Esterno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="settore">Settore</Label>
                  <Select
                    value={formData.settore || undefined}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, settore: value as "Fiscale" | "Lavoro" | "Fiscale & Lavoro" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona settore" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fiscale">Fiscale</SelectItem>
                      <SelectItem value="Lavoro">Lavoro</SelectItem>
                      <SelectItem value="Fiscale & Lavoro">Fiscale & Lavoro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="ragione_sociale">
                    Ragione Sociale <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="ragione_sociale"
                    value={formData.ragione_sociale}
                    onChange={(e) =>
                      setFormData({ ...formData, ragione_sociale: e.target.value })
                    }
                    placeholder="Es. HAPPY SRL"
                  />
                </div>

                <div>
                  <Label htmlFor="partita_iva">
                    P.IVA <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="partita_iva"
                    value={formData.partita_iva}
                    onChange={(e) =>
                      setFormData({ ...formData, partita_iva: e.target.value })
                    }
                    placeholder="01234567890"
                  />
                </div>

                <div>
                  <Label htmlFor="codice_fiscale">Codice Fiscale</Label>
                  <Input
                    id="codice_fiscale"
                    value={formData.codice_fiscale}
                    onChange={(e) =>
                      setFormData({ ...formData, codice_fiscale: e.target.value })
                    }
                    placeholder="RSSMRA80A01H501U"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="indirizzo">Indirizzo</Label>
                  <Input
                    id="indirizzo"
                    value={formData.indirizzo}
                    onChange={(e) =>
                      setFormData({ ...formData, indirizzo: e.target.value })
                    }
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
                    onChange={(e) =>
                      setFormData({ ...formData, citta: e.target.value })
                    }
                    placeholder="Roma"
                  />
                </div>

                <div>
                  <Label htmlFor="provincia">Provincia</Label>
                  <Input
                    id="provincia"
                    value={formData.provincia}
                    onChange={(e) =>
                      setFormData({ ...formData, provincia: e.target.value })
                    }
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
                    placeholder="info@happy.it"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="attivo"
                    checked={formData.attivo}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, attivo: checked })
                    }
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

            <TabsContent value="riferimenti" className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="utente_operatore_id">Utente Fiscale</Label>
                  <Select
                    value={formData.utente_operatore_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, utente_operatore_id: value === "none" ? "" : value })
                    }
                    disabled={!isFieldEnabled("fiscale")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona utente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {utenti.map((utente) => (
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
                      setFormData({ ...formData, utente_professionista_id: value === "none" ? "" : value })
                    }
                    disabled={!isFieldEnabled("fiscale")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona professionista" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {utenti.map((utente) => (
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
                    disabled={!isFieldEnabled("payroll")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona utente payroll" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {utenti.map((utente) => (
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
                      setFormData({ ...formData, professionista_payroll_id: value === "none" ? "" : value })
                    }
                    disabled={!isFieldEnabled("payroll")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona professionista payroll" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {utenti.map((utente) => (
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
                      {contatti.map((contatto) => (
                        <SelectItem key={contatto.id} value={contatto.id}>
                          {contatto.nome} {contatto.cognome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="contatto2_id">Contatto 2</Label>
                  <Select
                    value={formData.contatto2_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, contatto2_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona contatto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {contatti.map((contatto) => (
                        <SelectItem key={contatto.id} value={contatto.id}>
                          {contatto.nome} {contatto.cognome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tipo_prestazione_id">Tipo Prestazione</Label>
                  <Select
                    value={formData.tipo_prestazione_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, tipo_prestazione_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona prestazione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {prestazioni.map((prestazione) => (
                        <SelectItem key={prestazione.id} value={prestazione.id}>
                          {prestazione.descrizione}
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
                      setFormData({ ...formData, tipo_redditi: value as "SC" | "SP" | "ENC" | "PF" | "730" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SC">SC - Società di Capitali</SelectItem>
                      <SelectItem value="SP">SP - Società di Persone</SelectItem>
                      <SelectItem value="ENC">ENC - Ente Non Commerciale</SelectItem>
                      <SelectItem value="PF">PF - Persona Fisica</SelectItem>
                      <SelectItem value="730">730 - Modello 730</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cassetto_fiscale_id">Referente Cassetto fiscale</Label>
                  <Select
                    value={formData.cassetto_fiscale_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, cassetto_fiscale_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona cassetto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {cassettiFiscali.map((cassetto) => (
                        <SelectItem key={cassetto.id} value={cassetto.id}>
                          {cassetto.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

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

            <TabsContent value="antiriciclaggio" className="space-y-6 pt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <Label className="flex items-center gap-2 font-medium text-blue-900 cursor-pointer">
                  <Input
                    type="checkbox"
                    checked={formData.gestione_antiriciclaggio}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      gestione_antiriciclaggio: e.target.checked 
                    })}
                    className="w-5 h-5"
                  />
                  Gestione Antiriciclaggio
                </Label>
                <p className="text-sm text-blue-700 mt-2 ml-7">
                  Attiva questa opzione per abilitare la gestione e includere il cliente nello scadenzario Antiriciclaggio
                </p>
              </div>

              <h3 className="font-semibold text-lg mb-4">
                Adeguata Verifica Clientela (Antiriciclaggio)
              </h3>
              
              <div className="space-y-6">
                <Card className={`bg-blue-50 dark:bg-blue-950/20 ${!formData.gestione_antiriciclaggio ? "opacity-60" : ""}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-base">Verifica A (Principale)</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Tipo Prestazione A</Label>
                      <Select
                        value={formData.tipo_prestazione_a || ""}
                        onValueChange={(value) =>
                          setFormData({ ...formData, tipo_prestazione_a: value })
                        }
                        disabled={!formData.gestione_antiriciclaggio}
                      >
                        <SelectTrigger className={!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}>
                          <SelectValue placeholder="Seleziona tipo prestazione A" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPO_PRESTAZIONE_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Rischio Verifica A</Label>
                        <Select
                          value={formData.rischio_ver_a || ""}
                          onValueChange={(value) =>
                            handleRiskChange(
                              value,
                              "rischio_ver_a"
                            )
                          }
                          disabled={!formData.gestione_antiriciclaggio}
                        >
                          <SelectTrigger className={!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}>
                            <SelectValue placeholder="Seleziona rischio A" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Non significativo">Non significativo</SelectItem>
                            <SelectItem value="Poco significativo">Poco significativo</SelectItem>
                            <SelectItem value="Abbastanza significativo">Abbastanza significativo</SelectItem>
                            <SelectItem value="Molto significativo">Molto significativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Scadenza in mesi</Label>
                        <Input
                          type="number"
                          value={formData.gg_ver_a ?? ""}
                          onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : undefined;
                            handleGgVerChange("A", value);
                          }}
                          placeholder="36, 12 o 6"
                          disabled={!formData.gestione_antiriciclaggio}
                          className={!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Data Ultima Verifica A</Label>
                        <Input
                          type="date"
                          value={formData.data_ultima_verifica_antiric ? formData.data_ultima_verifica_antiric.toISOString().split('T')[0] : ""}
                          onChange={(e) => {
                            const dateValue = e.target.value ? new Date(e.target.value) : undefined;
                            handleVerificaDateChange("A", dateValue);
                          }}
                          className={`w-full ${!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}`}
                          disabled={!formData.gestione_antiriciclaggio}
                        />
                      </div>

                      <div>
                        <Label>Scadenza Antiriciclaggio A</Label>
                        <Input
                          type="date"
                          value={formData.scadenza_antiric ? formData.scadenza_antiric.toISOString().split('T')[0] : ""}
                          disabled
                          className="w-full bg-muted cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <Label>Giorni Scad. Ver A</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={formData.giorni_scad_ver_a !== null ? `${formData.giorni_scad_ver_a} giorni` : "N/A"}
                            disabled
                            className="w-full bg-muted cursor-not-allowed"
                          />
                          {formData.giorni_scad_ver_a !== null && (
                            <Badge className={getBadgeColor(formData.giorni_scad_ver_a)}>
                              {formData.giorni_scad_ver_a < 15 ? "🔴 URGENTE" : formData.giorni_scad_ver_a < 30 ? "🟠 ATTENZIONE" : "✅ OK"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-green-50 dark:bg-green-950/20 ${!formData.gestione_antiriciclaggio ? "opacity-60" : ""}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-base">Verifica B (Secondaria)</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Tipo Prestazione B</Label>
                      <Select
                        value={formData.tipo_prestazione_b || ""}
                        onValueChange={(value) =>
                          setFormData({ ...formData, tipo_prestazione_b: value })
                        }
                        disabled={!formData.gestione_antiriciclaggio}
                      >
                        <SelectTrigger className={!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}>
                          <SelectValue placeholder="Seleziona tipo prestazione B" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPO_PRESTAZIONE_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Rischio Verifica B</Label>
                        <Select
                          value={formData.rischio_ver_b || ""}
                          onValueChange={(value) =>
                            handleRiskChange(
                              value,
                              "rischio_ver_b"
                            )
                          }
                          disabled={!formData.gestione_antiriciclaggio}
                        >
                          <SelectTrigger className={!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}>
                            <SelectValue placeholder="Seleziona rischio B" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Non significativo">Non significativo</SelectItem>
                            <SelectItem value="Poco significativo">Poco significativo</SelectItem>
                            <SelectItem value="Abbastanza significativo">Abbastanza significativo</SelectItem>
                            <SelectItem value="Molto significativo">Molto significativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Scadenza in mesi</Label>
                        <Input
                          type="number"
                          value={formData.gg_ver_b ?? ""}
                          onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : undefined;
                            handleGgVerChange("B", value);
                          }}
                          placeholder="36, 12 o 6"
                          disabled={!formData.gestione_antiriciclaggio}
                          className={!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Data Ultima Verifica B</Label>
                        <Input
                          type="date"
                          value={formData.data_ultima_verifica_b ? formData.data_ultima_verifica_b.toISOString().split('T')[0] : ""}
                          onChange={(e) => {
                            const dateValue = e.target.value ? new Date(e.target.value) : undefined;
                            handleVerificaDateChange("B", dateValue);
                          }}
                          className={`w-full ${!formData.gestione_antiriciclaggio ? "cursor-not-allowed bg-gray-100" : ""}`}
                          disabled={!formData.gestione_antiriciclaggio}
                        />
                      </div>

                      <div>
                        <Label>Scadenza Antiriciclaggio B</Label>
                        <Input
                          type="date"
                          value={formData.scadenza_antiric_b ? formData.scadenza_antiric_b.toISOString().split('T')[0] : ""}
                          disabled
                          className="w-full bg-muted cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <Label>Giorni Scad. Ver B</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={formData.giorni_scad_ver_b !== null ? `${formData.giorni_scad_ver_b} giorni` : "N/A"}
                            disabled
                            className="w-full bg-muted cursor-not-allowed"
                          />
                          {formData.giorni_scad_ver_b !== null && (
                            <Badge className={getBadgeColor(formData.giorni_scad_ver_b)}>
                              {formData.giorni_scad_ver_b < 15 ? "🔴 URGENTE" : formData.giorni_scad_ver_b < 30 ? "🟠 ATTENZIONE" : "✅ OK"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="scadenzari" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Seleziona gli scadenzari attivi per questo cliente
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_iva"
                    checked={scadenzari.iva}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, iva: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_iva">IVA</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_cu"
                    checked={scadenzari.cu}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, cu: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_cu">CU (Certificazione Unica)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_bilancio"
                    checked={scadenzari.bilancio}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, bilancio: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_bilancio">Bilanci</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_fiscali"
                    checked={scadenzari.fiscali}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, fiscali: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_fiscali">Fiscali</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_lipe"
                    checked={scadenzari.lipe}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, lipe: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_lipe">Lipe</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_modello_770"
                    checked={scadenzari.modello_770}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, modello_770: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_modello_770">770</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_esterometro"
                    checked={scadenzari.esterometro}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, esterometro: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_esterometro">Esterometro</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_ccgg"
                    checked={scadenzari.ccgg}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, ccgg: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_ccgg">CCGG</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_proforma"
                    checked={scadenzari.proforma}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, proforma: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_proforma">Proforma</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scad_imu"
                    checked={scadenzari.imu}
                    onCheckedChange={(checked) =>
                      setScadenzari({ ...scadenzari, imu: checked as boolean })
                    }
                  />
                  <Label htmlFor="scad_imu">IMU</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="comunicazioni" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Gestisci le preferenze di comunicazione del cliente
              </p>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="email_attiva"
                    checked={comunicazioni.email_attiva}
                    onCheckedChange={(checked) =>
                      setComunicazioni({ ...comunicazioni, email_attiva: checked as boolean })
                    }
                  />
                  <Label htmlFor="email_attiva">Email Attiva</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ricevi_mailing_scadenze"
                    checked={comunicazioni.ricevi_mailing_scadenze}
                    onCheckedChange={(checked) =>
                      setComunicazioni({ ...comunicazioni, ricevi_mailing_scadenze: checked as boolean })
                    }
                  />
                  <Label htmlFor="ricevi_mailing_scadenze">Ricevi Mailing Scadenze</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ricevi_newsletter"
                    checked={comunicazioni.ricevi_newsletter}
                    onCheckedChange={(checked) =>
                      setComunicazioni({ ...comunicazioni, ricevi_newsletter: checked as boolean })
                    }
                  />
                  <Label htmlFor="ricevi_newsletter">Ricevi Newsletter</Label>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave}>
              {editingCliente ? "Salva Modifiche" : "Crea Cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Conferma Inserimento</AlertDialogTitle>
            <AlertDialogDescription>
              Vuoi aggiungere il valore <strong>&quot;{pendingRiferimento?.valore}&quot;</strong> all&apos;elenco{" "}
              {pendingRiferimento ? getNomeTipoRiferimento(pendingRiferimento.tipo) : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelNewRiferimento}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmNewRiferimento}>
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input
        type="file"
        accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={handleImportCSV}
        className="hidden"
        id="file-upload"
      />
    </div>
  );
}
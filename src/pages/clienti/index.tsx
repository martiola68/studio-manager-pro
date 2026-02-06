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
import { Users, Edit, Trash2, Search, Plus, Upload, FileSpreadsheet, CheckCircle2, Calendar, Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { clienteService } from "@/services/clienteService";
import { contattoService } from "@/services/contattoService";
import { utenteService } from "@/services/utenteService";
import { cassettiFiscaliService } from "@/services/cassettiFiscaliService";
import { Switch } from "@/components/ui/switch";
import * as XLSX from "xlsx";
import { useStudio } from "@/contexts/StudioContext";
import { 
  isEncryptionEnabled, 
  isEncryptionLocked,
  encryptClienteSensitiveData,
  decryptClienteSensitiveData,
  getStoredEncryptionKey,
  unlockCassetti,
  lockCassetti,
  migrateAllClientiToEncrypted
} from "@/services/encryptionService";

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

  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [encryptionLocked, setEncryptionLocked] = useState(true);
  const [showSensitiveData, setShowSensitiveData] = useState<{[key: string]: boolean}>({});
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");

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
    filterClienti();
  }, [clienti, searchTerm, selectedLetter, selectedUtenteFiscale, selectedUtentePayroll]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log("🔍 [DEBUG] Inizio caricamento clienti...");

      const studioId = localStorage.getItem("studioId") || "";
      console.log("🔍 [DEBUG] Studio ID:", studioId);

      const { data: clientiData, error: clientiError } = await (supabase as any)
        .from("tbclienti")
        .select(`
          *,
          settore_fiscale,
          settore_lavoro,
          settore_consulenza,
          utente_fiscale:tbutenti!tbclienti_utente_fiscale_id_fkey(id, nome, cognome),
          professionista_fiscale:tbutenti!tbclienti_professionista_fiscale_id_fkey(id, nome, cognome),
          utente_payroll:tbutenti!tbclienti_utente_payroll_id_fkey(id, nome, cognome),
          professionista_payroll:tbutenti!tbclienti_professionista_payroll_id_fkey(id, nome, cognome),
          contatto1:tbcontatti!tbclienti_contatto1_id_fkey(id, cognome, nome),
          tipo_prestazione:tbprestazioni!tbclienti_tipo_prestazione_id_fkey(descrizione)
        `)
        .eq("studio_id", studioId)
        .order("ragione_sociale");

      if (clientiError) {
        console.error("❌ [DEBUG] Errore query clienti:", clientiError);
        throw clientiError;
      }

      console.log("✅ [DEBUG] Clienti caricati:", clientiData?.length || 0);
      setClienti((clientiData as any) || []);

      const { data: utentiData } = await supabase
        .from("tbutenti")
        .select("id, nome, cognome, settore")
        .eq("studio_id", studioId)
        .eq("attivo", true)
        .order("cognome");

      console.log("✅ [DEBUG] Utenti caricati:", utentiData?.length || 0);
      setUtenti((utentiData as any) || []);

      const { data: contattiData } = await supabase
        .from("tbcontatti")
        .select("id, cognome, nome")
        .eq("studio_id", studioId)
        .order("cognome");

      console.log("✅ [DEBUG] Contatti caricati:", contattiData?.length || 0);
      setContatti((contattiData as any) || []);

      const { data: tipiPrestazioneData } = await supabase
        .from("tbprestazioni")
        .select("id, descrizione")
        .eq("studio_id", studioId)
        .order("descrizione");

      console.log("✅ [DEBUG] Tipi prestazione caricati:", tipiPrestazioneData?.length || 0);
      setPrestazioni((tipiPrestazioneData as any) || []);

      console.log("✅ [DEBUG] Caricamento completato!");
    } catch (error) {
      console.error("❌ [DEBUG] Errore fatale:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      console.log("🔍 [DEBUG] setLoading(false) eseguito");
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

      let dataToSave = {
        ...formData,
        cod_cliente: formData.cod_cliente || `CL-${Date.now().toString().slice(-6)}`,
        utente_operatore_id: (formData.settore_fiscale && formData.utente_operatore_id) || undefined,
        utente_professionista_id: (formData.settore_fiscale && formData.utente_professionista_id) || undefined,
        utente_payroll_id: (formData.settore_lavoro && formData.utente_payroll_id) || undefined,
        professionista_payroll_id: (formData.settore_lavoro && formData.professionista_payroll_id) || undefined,
        contatto1_id: formData.contatto1_id || undefined,
        referente_esterno: formData.referente_esterno || undefined,
        tipo_prestazione_id: formData.tipo_prestazione_id || undefined,
        tipo_redditi: formData.tipo_redditi || undefined,
        cassetto_fiscale_id: formData.cassetto_fiscale_id || undefined,
        settore_fiscale: formData.settore_fiscale,
        settore_lavoro: formData.settore_lavoro,
        settore_consulenza: formData.settore_consulenza,
        tipologia_cliente: formData.tipologia_cliente || "Interno",
        matricola_inps: formData.matricola_inps || undefined,
        pat_inail: formData.pat_inail || undefined,
        codice_ditta_ce: formData.codice_ditta_ce || undefined,
        tipo_prestazione_a: formData.tipo_prestazione_a || undefined,
        tipo_prestazione_b: formData.tipo_prestazione_b || undefined,
        rischio_ver_a: formData.rischio_ver_a || undefined,
        rischio_ver_b: formData.rischio_ver_b || undefined,
        gg_ver_a: formData.gg_ver_a ?? undefined,
        gg_ver_b: formData.gg_ver_b ?? undefined,
        data_ultima_verifica_antiric: formData.data_ultima_verifica_antiric?.toISOString() || undefined,
        scadenza_antiric: formData.scadenza_antiric?.toISOString() || undefined,
        data_ultima_verifica_b: formData.data_ultima_verifica_b?.toISOString() || undefined,
        scadenza_antiric_b: formData.scadenza_antiric_b?.toISOString() || undefined,
        gestione_antiriciclaggio: formData.gestione_antiriciclaggio,
        note_antiriciclaggio: formData.note_antiriciclaggio,
        giorni_scad_ver_a: formData.giorni_scad_ver_a ?? undefined,
        giorni_scad_ver_b: formData.giorni_scad_ver_b ?? undefined,
        
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

      // Encrypt sensitive fields if encryption is enabled and unlocked
      if (encryptionEnabled && !encryptionLocked) {
        try {
          const encrypted = await encryptClienteSensitiveData({
            codice_fiscale: dataToSave.codice_fiscale,
            partita_iva: dataToSave.partita_iva,
            matricola_inps: dataToSave.matricola_inps,
            pat_inail: dataToSave.pat_inail,
            codice_ditta_ce: dataToSave.codice_ditta_ce,
            note: dataToSave.note,
            note_antiriciclaggio: dataToSave.note_antiriciclaggio,
          });
          
          // Merge encrypted data, converting nulls to undefined to satisfy strict types if needed, 
          // or cast to any if the service accepts nulls (which Supabase does)
          dataToSave = { 
            ...dataToSave, 
            ...encrypted,
            // Ensure compatibility with types that strictly want undefined for "empty"
            codice_fiscale: encrypted.codice_fiscale || dataToSave.codice_fiscale,
            partita_iva: encrypted.partita_iva || dataToSave.partita_iva,
          } as any;
        } catch (error: any) {
          console.error("Encryption error:", error);
          toast({
            title: "Errore Encryption",
            description: "Impossibile cifrare i dati. Verifica di aver sbloccato la protezione.",
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

  const handleUnlockCassetti = () => {
    setShowUnlockDialog(true);
  };

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
        loadData(); // Reload to decrypt data
      } else {
        toast({
          title: "Errore",
          description: result.error || "Password errata",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante lo sblocco",
        variant: "destructive",
      });
    }
  };

  const handleLockCassetti = () => {
    lockCassetti();
    setEncryptionLocked(true);
    setShowSensitiveData({});
    toast({
      title: "Bloccato",
      description: "Dati sensibili bloccati",
    });
    loadData(); // Reload to hide decrypted data
  };

  const handleAddNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = async (cliente: Cliente) => {
    setEditingCliente(cliente);
    
    let clienteData = { ...cliente };
    
    // Decrypt sensitive fields if encryption is enabled and unlocked
    if (encryptionEnabled && !encryptionLocked) {
      try {
        const decrypted = await decryptClienteSensitiveData({
          codice_fiscale: cliente.codice_fiscale,
          partita_iva: cliente.partita_iva,
          matricola_inps: cliente.matricola_inps,
          pat_inail: cliente.pat_inail,
          codice_ditta_ce: cliente.codice_ditta_ce,
          note: cliente.note,
          note_antiriciclaggio: cliente.note_antiriciclaggio,
        });
        
        clienteData = { ...clienteData, ...decrypted };
      } catch (error) {
        console.error("Decryption error:", error);
      }
    }
    
    setFormData({
      ...formData,
      ...clienteData,
      cod_cliente: clienteData.cod_cliente || "",
      tipo_cliente: clienteData.tipo_cliente || "Persona fisica",
      tipologia_cliente: clienteData.tipologia_cliente || undefined,
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
      attivo: clienteData.attivo ?? false,
      tipo_redditi: (clienteData.tipo_redditi as any) || undefined,
      utente_operatore_id: clienteData.utente_operatore_id || "",
      utente_professionista_id: clienteData.utente_professionista_id || "",
      utente_payroll_id: clienteData.utente_payroll_id || "",
      professionista_payroll_id: clienteData.professionista_payroll_id || "",
      contatto1_id: clienteData.contatto1_id || "",
      referente_esterno: clienteData.referente_esterno || "",
      tipo_prestazione_id: clienteData.tipo_prestazione_id || "",
      cassetto_fiscale_id: clienteData.cassetto_fiscale_id || "",
      matricola_inps: clienteData.matricola_inps || "",
      pat_inail: clienteData.pat_inail || "",
      codice_ditta_ce: clienteData.codice_ditta_ce || "",
      note_antiriciclaggio: clienteData.note_antiriciclaggio || "",
      gestione_antiriciclaggio: clienteData.gestione_antiriciclaggio ?? false,
      gg_ver_a: clienteData.gg_ver_a ?? null,
      gg_ver_b: clienteData.gg_ver_b ?? null,
      data_ultima_verifica_antiric: clienteData.data_ultima_verifica_antiric ? new Date(clienteData.data_ultima_verifica_antiric) : null,
      data_ultima_verifica_b: clienteData.data_ultima_verifica_b ? new Date(clienteData.data_ultima_verifica_b) : null,
      scadenza_antiric: clienteData.scadenza_antiric ? new Date(clienteData.scadenza_antiric) : null,
      scadenza_antiric_b: clienteData.scadenza_antiric_b ? new Date(clienteData.scadenza_antiric_b) : null,
      rischio_ver_a: clienteData.rischio_ver_a || "",
      rischio_ver_b: clienteData.rischio_ver_b || "",
      tipo_prestazione_a: clienteData.tipo_prestazione_a || "",
      tipo_prestazione_b: clienteData.tipo_prestazione_b || "",
      giorni_scad_ver_a: clienteData.giorni_scad_ver_a ?? null,
      giorni_scad_ver_b: clienteData.giorni_scad_ver_b ?? null,
      note: clienteData.note || "",
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
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCliente(null);
    setFormData({
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
        "VERO",
        "FALSO",
        "FALSO",
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

        const tipoCliente = (values[0] || "").toString().trim();
        const tipologiaCliente = (values[1] || "").toString().trim();
        const settoreFiscaleRaw = (values[2] || "VERO").toString().trim().toUpperCase();
        const settoreLavoroRaw = (values[3] || "FALSO").toString().trim().toUpperCase();
        const settoreConsulenzaRaw = (values[4] || "FALSO").toString().trim().toUpperCase();
        const ragioneSociale = (values[5] || "").toString().trim();

        if (!tipoCliente || !tipologiaCliente || !ragioneSociale) {
          errors.push(`Riga ${i + 2}: Campi obbligatori mancanti`);
          errorCount++;
          continue;
        }

        const findUserId = (name: string) => {
          if (!name) return null;
          const user = utenti.find(u => 
            `${u.nome} ${u.cognome}`.toLowerCase().trim() === name.toLowerCase().trim()
          );
          return user?.id || null;
        };

        const findContattoId = (name: string) => {
          if (!name) return null;
          const contatto = contatti.find(c => 
            `${c.nome} ${c.cognome}`.toLowerCase().trim() === name.toLowerCase().trim()
          );
          return contatto?.id || null;
        };

        const findPrestazioneId = (desc: string) => {
          if (!desc) return null;
          const prestazione = prestazioni.find(p => 
            p.descrizione?.toLowerCase().trim() === desc.toLowerCase().trim()
          );
          return prestazione?.id || null;
        };

        const attivoRaw = (values[13] || "VERO").toString().trim().toUpperCase();
        const attivo = attivoRaw === "VERO" || attivoRaw === "TRUE" || attivoRaw === "SI" || attivoRaw === "1";
        
        const settoreFiscale = settoreFiscaleRaw === "VERO" || settoreFiscaleRaw === "TRUE" || settoreFiscaleRaw === "SI" || settoreFiscaleRaw === "1";
        const settoreLavoro = settoreLavoroRaw === "VERO" || settoreLavoroRaw === "TRUE" || settoreLavoroRaw === "SI" || settoreLavoroRaw === "1";
        const settoreConsulenza = settoreConsulenzaRaw === "VERO" || settoreConsulenzaRaw === "TRUE" || settoreConsulenzaRaw === "SI" || settoreConsulenzaRaw === "1";

        const clienteData: any = {
          tipo_cliente: tipoCliente,
          tipologia_cliente: tipologiaCliente,
          settore_fiscale: settoreFiscale,
          settore_lavoro: settoreLavoro,
          settore_consulenza: settoreConsulenza,
          ragione_sociale: ragioneSociale,
          attivo: attivo,
        };

        if (values[6]) clienteData.partita_iva = values[6].toString().trim();
        if (values[7]) clienteData.codice_fiscale = values[7].toString().trim();
        if (values[8]) clienteData.indirizzo = values[8].toString().trim();
        if (values[9]) clienteData.cap = values[9].toString().trim();
        if (values[10]) clienteData.citta = values[10].toString().trim();
        if (values[11]) clienteData.provincia = values[11].toString().trim();
        if (values[12]) clienteData.email = values[12].toString().trim();
        if (values[14]) clienteData.note = values[14].toString().trim();
        
        const utenteFiscale = findUserId(values[15]?.toString().trim());
        if (utenteFiscale && settoreFiscale) clienteData.utente_operatore_id = utenteFiscale;
        
        const profFiscale = findUserId(values[16]?.toString().trim());
        if (profFiscale && settoreFiscale) clienteData.utente_professionista_id = profFiscale;
        
        const utentePayroll = findUserId(values[17]?.toString().trim());
        if (utentePayroll && settoreLavoro) clienteData.utente_payroll_id = utentePayroll;
        
        const profPayroll = findUserId(values[18]?.toString().trim());
        if (profPayroll && settoreLavoro) clienteData.professionista_payroll_id = profPayroll;
        
        const contatto1 = findContattoId(values[19]?.toString().trim());
        if (contatto1) clienteData.contatto1_id = contatto1;
        
        const contatto2 = findContattoId(values[20]?.toString().trim());
        if (contatto2) clienteData.contatto2_id = contatto2;
        
        const prestazione = findPrestazioneId(values[21]?.toString().trim());
        if (prestazione) clienteData.tipo_prestazione_id = prestazione;
        
        if (values[22]) clienteData.tipo_redditi = values[22].toString().trim();

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
      setImportDialogOpen(false);
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

  const clientiConCassetto = clienti.filter((c) => c.cassetto_fiscale_id).length;
  const percentualeCassetto = clienti.length > 0 ? Math.round((clientiConCassetto / clienti.length) * 100) : 0;

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
            {encryptionEnabled && (
              <Button
                variant="outline"
                onClick={encryptionLocked ? handleUnlockCassetti : handleLockCassetti}
                className={encryptionLocked ? "border-orange-600 text-orange-600" : "border-green-600 text-green-600"}
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
                          <li><strong>Tipo Cliente</strong> - <span className="text-red-600">OBBLIGATORIO</span> (Persona fisica/Altro)</li>
                          <li><strong>Tipologia Cliente</strong> - <span className="text-red-600">OBBLIGATORIO</span> (Interno/Esterno)</li>
                          <li><strong>Settore Fiscale</strong> - <span className="text-red-600">OBBLIGATORIO</span> (VERO/FALSO)</li>
                          <li><strong>Settore Lavoro</strong> - <span className="text-red-600">OBBLIGATORIO</span> (VERO/FALSO)</li>
                          <li><strong>Settore Consulenza</strong> - <span className="text-red-600">OBBLIGATORIO</span> (VERO/FALSO)</li>
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
                          <li><strong>Utente Fiscale</strong> - Opzionale (nome utente dal sistema)</li>
                          <li><strong>Professionista Fiscale</strong> - Opzionale (nome professionista dal sistema)</li>
                          <li><strong>Utente Payroll</strong> - Opzionale (nome utente dal sistema)</li>
                          <li><strong>Professionista Payroll</strong> - Opzionale (nome professionista dal sistema)</li>
                          <li><strong>Contatto 1</strong> - Opzionale (nome contatto dalla rubrica)</li>
                          <li><strong>Contatto 2</strong> - Opzionale (nome contatto dalla rubrica)</li>
                          <li><strong>Tipo Prestazione</strong> - Opzionale (descrizione dalla tabella prestazioni)</li>
                          <li><strong>Tipo Redditi</strong> - Opzionale (USC/USP/ENC/UPF/730)</li>
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
                      onChange={handleImportCSV}
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
                {utenti.map((utente) => (
                  <SelectItem key={utente.id} value={utente.id}>
                    {utente.nome} {utente.cognome}
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
                {utenti.map((utente) => (
                  <SelectItem key={utente.id} value={utente.id}>
                    {utente.nome} {utente.cognome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                {searchTerm || selectedLetter !== "Tutti" || selectedUtenteFiscale !== "all" || selectedUtentePayroll !== "all"
                  ? "Prova a modificare i filtri di ricerca"
                  : "Inizia aggiungendo il tuo primo cliente"}
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Aggiungi Cliente
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-20 shadow-r w-[120px] min-w-[120px] max-w-[120px]">Cod. Cliente</TableHead>
                    <TableHead className="sticky left-[120px] bg-background z-20 shadow-r w-[250px] min-w-[250px] max-w-[250px]">Ragione Sociale</TableHead>
                    <TableHead className="min-w-[220px] pl-6">Utente Fiscale</TableHead>
                    <TableHead className="min-w-[200px]">Utente Payroll</TableHead>
                    <TableHead className="min-w-[100px]">Stato</TableHead>
                    <TableHead className="text-center">Scadenzari</TableHead>
                    <TableHead className="sticky right-0 bg-background z-20 shadow-l text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClienti.map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-mono text-sm w-[120px] min-w-[120px] max-w-[120px] truncate" title={cliente.cod_cliente || cliente.id}>
                        {cliente.cod_cliente || cliente.id.substring(0, 8).toUpperCase()}
                      </TableCell>
                      <TableCell className="sticky left-[120px] bg-background z-10 font-medium w-[250px] min-w-[250px] max-w-[250px] truncate" title={cliente.ragione_sociale || ""}>
                        {cliente.ragione_sociale}
                      </TableCell>
                      <TableCell className="min-w-[220px] pl-6">
                        {getUtenteNome(cliente.utente_operatore_id)}
                      </TableCell>
                      <TableCell className="min-w-[200px]">{getUtenteNome(cliente.utente_payroll_id)}</TableCell>
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
                      <TableCell className="sticky right-0 bg-background z-10 text-right">
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
            </div>
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
            <TabsList className="grid w-full grid-cols-5 overflow-x-auto">
              <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
              <TabsTrigger value="riferimenti">Riferimenti</TabsTrigger>
              <TabsTrigger value="altri_dati">Altri Dati</TabsTrigger>
              <TabsTrigger value="antiriciclaggio">Antiriciclaggio</TabsTrigger>
              <TabsTrigger value="scadenzari">Scadenzari</TabsTrigger>
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
                    disabled
                    placeholder="Generato automaticamente"
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
                        onCheckedChange={(checked) => {
                          const newValue = checked as boolean;
                          setFormData({ 
                            ...formData, 
                            settore_fiscale: newValue,
                            // Svuota campi fiscali se deselezionato
                            ...((!newValue) && {
                              utente_operatore_id: "",
                              utente_professionista_id: ""
                            })
                          });
                        }}
                      />
                      <Label htmlFor="settore-fiscale" className="font-medium cursor-pointer">
                        Settore Fiscale
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="settore-lavoro"
                        checked={formData.settore_lavoro}
                        onCheckedChange={(checked) => {
                          const newValue = checked as boolean;
                          setFormData({ 
                            ...formData, 
                            settore_lavoro: newValue,
                            // Svuota campi payroll se deselezionato
                            ...((!newValue) && {
                              utente_payroll_id: "",
                              professionista_payroll_id: ""
                            })
                          });
                        }}
                      />
                      <Label htmlFor="settore-lavoro" className="font-medium cursor-pointer">
                        Settore Lavoro
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="settore-consulenza"
                        checked={formData.settore_consulenza}
                        onCheckedChange={(checked) => {
                          setFormData({ ...formData, settore_consulenza: checked as boolean });
                        }}
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
                  <div className="relative">
                    <Input
                      id="partita_iva"
                      value={formData.partita_iva}
                      onChange={(e) =>
                        setFormData({ ...formData, partita_iva: e.target.value })
                      }
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
                      onChange={(e) =>
                        setFormData({ ...formData, codice_fiscale: e.target.value })
                      }
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
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
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
                    disabled={!formData.settore_fiscale}
                  >
                    <SelectTrigger className={!formData.settore_fiscale ? "cursor-not-allowed bg-gray-100" : ""}>
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
                  {!formData.settore_fiscale && (
                    <p className="text-xs text-muted-foreground mt-1">Abilita "Settore Fiscale" per attivare questo campo</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="utente_professionista_id">Professionista Fiscale</Label>
                  <Select
                    value={formData.utente_professionista_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, utente_professionista_id: value === "none" ? "" : value })
                    }
                    disabled={!formData.settore_fiscale}
                  >
                    <SelectTrigger className={!formData.settore_fiscale ? "cursor-not-allowed bg-gray-100" : ""}>
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
                  {!formData.settore_fiscale && (
                    <p className="text-xs text-muted-foreground mt-1">Abilita "Settore Fiscale" per attivare questo campo</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="utente_payroll_id">Utente Payroll</Label>
                  <Select
                    value={formData.utente_payroll_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, utente_payroll_id: value === "none" ? "" : value })
                    }
                    disabled={!formData.settore_lavoro}
                  >
                    <SelectTrigger className={!formData.settore_lavoro ? "cursor-not-allowed bg-gray-100" : ""}>
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
                  {!formData.settore_lavoro && (
                    <p className="text-xs text-muted-foreground mt-1">Abilita "Settore Lavoro" per attivare questo campo</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="professionista_payroll_id">Professionista Payroll</Label>
                  <Select
                    value={formData.professionista_payroll_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, professionista_payroll_id: value === "none" ? "" : value })
                    }
                    disabled={!formData.settore_lavoro}
                  >
                    <SelectTrigger className={!formData.settore_lavoro ? "cursor-not-allowed bg-gray-100" : ""}>
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
                  {!formData.settore_lavoro && (
                    <p className="text-xs text-muted-foreground mt-1">Abilita "Settore Lavoro" per attivare questo campo</p>
                  )}
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
                        .sort((a, b) => {
                          const cognomeA = (a.cognome || "").toLowerCase();
                          const cognomeB = (b.cognome || "").toLowerCase();
                          return cognomeA.localeCompare(cognomeB);
                        })
                        .map((contatto) => (
                        <SelectItem key={contatto.id} value={contatto.id}>
                          {contatto.cognome?.toUpperCase()} {contatto.nome?.toUpperCase()}
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
                    onChange={(e) =>
                      setFormData({ ...formData, referente_esterno: e.target.value })
                    }
                    placeholder="Nome referente esterno"
                  />
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
                      setFormData({ ...formData, tipo_redditi: value as "USC" | "USP" | "ENC" | "UPF" | "730" })
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

                <div>
                  <Label htmlFor="cassetto_fiscale_id">Referente Cassetto fiscale</Label>
                  <Select
                    value={formData.cassetto_fiscale_id || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, cassetto_fiscale_id: value === "none" ? "" : value })
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
                            const value = e.target.value ? Number(e.target.value) : null;
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
                            const dateValue = e.target.value ? new Date(e.target.value) : null;
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
                            const value = e.target.value ? Number(e.target.value) : null;
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
                            const dateValue = e.target.value ? new Date(e.target.value) : null;
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

      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sblocca Dati Sensibili</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Inserisci la password principale dello studio per visualizzare e modificare i dati sensibili (CF, P.IVA, ecc).
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
              <Button onClick={handleConfirmUnlock}>
                Sblocca
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
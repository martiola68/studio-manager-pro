import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { clienteService } from "@/services/clienteService";
import { contattoService } from "@/services/contattoService";
import { utenteService } from "@/services/utenteService";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Edit, Trash2, Search, Plus, UserPlus, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type Prestazione = Database["public"]["Tables"]["tbprestazioni"]["Row"];

export default function ClientiPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [contatti, setContatti] = useState<Contatto[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [prestazioni, setPrestazioni] = useState<Prestazione[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [activeTab, setActiveTab] = useState("anagrafica");

  const [formData, setFormData] = useState({
    ragione_sociale: "",
    codice_fiscale: "",
    partita_iva: "",
    indirizzo: "",
    cap: "",
    citta: "",
    provincia: "",
    email: "",
    note: "",
    attivo: true,
    utente_operatore_id: "",
    utente_professionista_id: "",
    contatto1_id: "",
    contatto2_id: "",
    scadenza_antiric: "",
    tipo_prestazione_id: "",
    tipo_cliente: "Esterno",
    flag_iva: true,
    flag_cu: true,
    flag_bilancio: true,
    flag_fiscali: true,
    flag_lipe: true,
    flag_770: true,
    flag_esterometro: true,
    flag_ccgg: true,
    flag_proforma: true,
    flag_mail_attivo: true,
    flag_mail_scadenze: true,
    flag_mail_newsletter: true
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      await loadData();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientiData, contattiData, utentiData, prestazioniData] = await Promise.all([
        clienteService.getClienti(),
        contattoService.getContatti(),
        utenteService.getUtenti(),
        loadPrestazioni()
      ]);
      setClienti(clientiData);
      setContatti(contattiData);
      setUtenti(utentiData);
      setPrestazioni(prestazioniData);
    } catch (error) {
      console.error("Errore caricamento dati:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPrestazioni = async (): Promise<Prestazione[]> => {
    const { data, error } = await supabase
      .from("tbprestazioni")
      .select("*")
      .order("descrizione");
    if (error) throw error;
    return data || [];
  };

  const checkDuplicates = async (partita_iva: string, codice_fiscale: string, excludeId?: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale, partita_iva, codice_fiscale")
      .or(`partita_iva.eq.${partita_iva},codice_fiscale.eq.${codice_fiscale}`);

    if (error) {
      console.error("Errore controllo duplicati:", error);
      return false;
    }

    const duplicates = data?.filter(c => excludeId ? c.id !== excludeId : true) || [];
    
    if (duplicates.length > 0) {
      const dup = duplicates[0];
      toast({
        title: "Cliente già esistente",
        description: `Trovato: ${dup.ragione_sociale} - P.IVA: ${dup.partita_iva || 'N/A'} - CF: ${dup.codice_fiscale}`,
        variant: "destructive"
      });
      return true;
    }

    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ragione_sociale || !formData.partita_iva || !formData.codice_fiscale) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive"
      });
      return;
    }

    const hasDuplicates = await checkDuplicates(
      formData.partita_iva, 
      formData.codice_fiscale,
      editingCliente?.id
    );

    if (hasDuplicates) return;

    try {
      // Prepara i dati convertendo stringhe vuote in null per i campi UUID
      const dataToSave = {
        ...formData,
        utente_operatore_id: formData.utente_operatore_id || null,
        utente_professionista_id: formData.utente_professionista_id || null,
        contatto1_id: formData.contatto1_id || null,
        contatto2_id: formData.contatto2_id || null,
        tipo_prestazione_id: formData.tipo_prestazione_id || null,
        scadenza_antiric: formData.scadenza_antiric || null
      };

      if (editingCliente) {
        await clienteService.updateCliente(editingCliente.id, dataToSave);
        toast({
          title: "Successo",
          description: "Cliente aggiornato con successo"
        });
      } else {
        // Genera un codice cliente provvisorio se non gestito dal DB
        const codCliente = `CL-${Date.now().toString().substr(-6)}`;
        
        await clienteService.createCliente({
          ...dataToSave,
          cod_cliente: codCliente
        });
        toast({
          title: "Successo",
          description: "Cliente creato con successo"
        });
      }

      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il cliente",
        variant: "destructive"
      });
    }
  };

  const handleAggiungiAScadenzari = async (clienteId: string) => {
    const cliente = clienti.find(c => c.id === clienteId);
    if (!cliente) return;

    const scadenzariSelezionati = [];
    if (cliente.flag_iva) scadenzariSelezionati.push("IVA");
    if (cliente.flag_ccgg) scadenzariSelezionati.push("CCGG");
    if (cliente.flag_cu) scadenzariSelezionati.push("CU");
    if (cliente.flag_fiscali) scadenzariSelezionati.push("Fiscali");
    if (cliente.flag_bilancio) scadenzariSelezionati.push("Bilanci");
    if (cliente.flag_770) scadenzariSelezionati.push("770");
    if (cliente.flag_lipe) scadenzariSelezionati.push("Lipe");
    if (cliente.flag_esterometro) scadenzariSelezionati.push("Esterometro");
    if (cliente.flag_proforma) scadenzariSelezionati.push("Proforma");

    if (scadenzariSelezionati.length === 0) {
      toast({
        title: "Nessuno scadenzario selezionato",
        description: "Attiva almeno un flag per aggiungere il cliente agli scadenzari",
        variant: "destructive"
      });
      return;
    }

    try {
      const promises = [];

      if (cliente.flag_iva) {
        promises.push(
          supabase.from("tbscadiva").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id,
            conferma_riga: false
          })
        );
      }

      if (cliente.flag_ccgg) {
        promises.push(
          supabase.from("tbscadccgg").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id,
            conferma_riga: false
          })
        );
      }

      if (cliente.flag_cu) {
        promises.push(
          supabase.from("tbscadcu").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id,
            conferma_riga: false
          })
        );
      }

      if (cliente.flag_fiscali) {
        promises.push(
          supabase.from("tbscadfiscali").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id,
            conferma_riga: false
          })
        );
      }

      if (cliente.flag_bilancio) {
        promises.push(
          supabase.from("tbscadbilanci").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id,
            conferma_riga: false
          })
        );
      }

      if (cliente.flag_770) {
        promises.push(
          supabase.from("tbscad770").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id,
            conferma_riga: false
          })
        );
      }

      if (cliente.flag_lipe) {
        promises.push(
          supabase.from("tbscadlipe").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id
          })
        );
      }

      if (cliente.flag_esterometro) {
        promises.push(
          supabase.from("tbscadestero").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id
          })
        );
      }

      if (cliente.flag_proforma) {
        promises.push(
          supabase.from("tbscadproforma").upsert({
            id: cliente.id,
            nominativo: cliente.ragione_sociale,
            utente_operatore_id: cliente.utente_operatore_id,
            utente_professionista_id: cliente.utente_professionista_id
          })
        );
      }

      await Promise.all(promises);

      toast({
        title: "Successo",
        description: `Cliente aggiunto a ${scadenzariSelezionati.length} scadenzari: ${scadenzariSelezionati.join(", ")}`
      });
    } catch (error) {
      console.error("Errore aggiunta scadenzari:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiungere agli scadenzari",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      ragione_sociale: cliente.ragione_sociale,
      codice_fiscale: cliente.codice_fiscale,
      partita_iva: cliente.partita_iva,
      indirizzo: cliente.indirizzo,
      cap: cliente.cap,
      citta: cliente.citta,
      provincia: cliente.provincia,
      email: cliente.email,
      note: cliente.note || "",
      attivo: cliente.attivo ?? true,
      utente_operatore_id: cliente.utente_operatore_id || "",
      utente_professionista_id: cliente.utente_professionista_id || "",
      contatto1_id: cliente.contatto1_id || "",
      contatto2_id: cliente.contatto2_id || "",
      scadenza_antiric: cliente.scadenza_antiric || "",
      tipo_prestazione_id: cliente.tipo_prestazione_id || "",
      tipo_cliente: cliente.tipo_cliente || "Esterno",
      flag_iva: cliente.flag_iva ?? true,
      flag_cu: cliente.flag_cu ?? true,
      flag_bilancio: cliente.flag_bilancio ?? true,
      flag_fiscali: cliente.flag_fiscali ?? true,
      flag_lipe: cliente.flag_lipe ?? true,
      flag_770: cliente.flag_770 ?? true,
      flag_esterometro: cliente.flag_esterometro ?? true,
      flag_ccgg: cliente.flag_ccgg ?? true,
      flag_proforma: cliente.flag_proforma ?? true,
      flag_mail_attivo: cliente.flag_mail_attivo ?? true,
      flag_mail_scadenze: cliente.flag_mail_scadenze ?? true,
      flag_mail_newsletter: cliente.flag_mail_newsletter ?? true
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo cliente? Verranno eliminate anche tutte le scadenze associate.")) return;

    try {
      await clienteService.deleteCliente(id);
      toast({
        title: "Successo",
        description: "Cliente eliminato con successo"
      });
      await loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il cliente",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      ragione_sociale: "",
      codice_fiscale: "",
      partita_iva: "",
      indirizzo: "",
      cap: "",
      citta: "",
      provincia: "",
      email: "",
      note: "",
      attivo: true,
      utente_operatore_id: "",
      utente_professionista_id: "",
      contatto1_id: "",
      contatto2_id: "",
      scadenza_antiric: "",
      tipo_prestazione_id: "",
      tipo_cliente: "Esterno",
      flag_iva: true,
      flag_cu: true,
      flag_bilancio: true,
      flag_fiscali: true,
      flag_lipe: true,
      flag_770: true,
      flag_esterometro: true,
      flag_ccgg: true,
      flag_proforma: true,
      flag_mail_attivo: true,
      flag_mail_scadenze: true,
      flag_mail_newsletter: true
    });
    setEditingCliente(null);
    setActiveTab("anagrafica");
  };

  const filteredClienti = clienti.filter(c =>
    c.ragione_sociale.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.partita_iva.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.codice_fiscale.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Gestione Clienti</h1>
                <p className="text-gray-500 mt-1">Anagrafica completa e gestione scadenzari</p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuovo Cliente
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingCliente ? "Modifica Cliente" : "Nuovo Cliente"}
                    </DialogTitle>
                    <DialogDescription>
                      Inserisci i dati completi del cliente
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
                        <TabsTrigger value="riferimenti">Riferimenti</TabsTrigger>
                        <TabsTrigger value="scadenzari">Scadenzari</TabsTrigger>
                        <TabsTrigger value="comunicazioni">Comunicazioni</TabsTrigger>
                      </TabsList>

                      <TabsContent value="anagrafica" className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="ragione_sociale">Ragione Sociale *</Label>
                          <Input
                            id="ragione_sociale"
                            value={formData.ragione_sociale}
                            onChange={(e) => setFormData({ ...formData, ragione_sociale: e.target.value })}
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="partita_iva">Partita IVA *</Label>
                            <Input
                              id="partita_iva"
                              value={formData.partita_iva}
                              onChange={(e) => setFormData({ ...formData, partita_iva: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="codice_fiscale">Codice Fiscale *</Label>
                            <Input
                              id="codice_fiscale"
                              value={formData.codice_fiscale}
                              onChange={(e) => setFormData({ ...formData, codice_fiscale: e.target.value })}
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="indirizzo">Indirizzo *</Label>
                          <Input
                            id="indirizzo"
                            value={formData.indirizzo}
                            onChange={(e) => setFormData({ ...formData, indirizzo: e.target.value })}
                            required
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="cap">CAP *</Label>
                            <Input
                              id="cap"
                              value={formData.cap}
                              onChange={(e) => setFormData({ ...formData, cap: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="citta">Città *</Label>
                            <Input
                              id="citta"
                              value={formData.citta}
                              onChange={(e) => setFormData({ ...formData, citta: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="provincia">Provincia *</Label>
                            <Input
                              id="provincia"
                              value={formData.provincia}
                              onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                              maxLength={2}
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="tipo_cliente">Tipo Cliente</Label>
                            <Select
                              value={formData.tipo_cliente}
                              onValueChange={(value) => setFormData({ ...formData, tipo_cliente: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Interno">Interno</SelectItem>
                                <SelectItem value="Esterno">Esterno</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center space-x-2 pt-8">
                            <input
                              type="checkbox"
                              id="attivo"
                              checked={formData.attivo}
                              onChange={(e) => setFormData({ ...formData, attivo: e.target.checked })}
                              className="rounded"
                            />
                            <Label htmlFor="attivo" className="cursor-pointer">Cliente Attivo</Label>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="note">Note</Label>
                          <Textarea
                            id="note"
                            value={formData.note}
                            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            rows={3}
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="riferimenti" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="utente_operatore_id">Utente Operatore</Label>
                            <Select
                              value={formData.utente_operatore_id || "__none__"}
                              onValueChange={(value) => setFormData({ ...formData, utente_operatore_id: value === "__none__" ? "" : value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona utente" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Nessuno</SelectItem>
                                {utenti.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.nome} {u.cognome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="utente_professionista_id">Utente Professionista</Label>
                            <Select
                              value={formData.utente_professionista_id || "__none__"}
                              onValueChange={(value) => setFormData({ ...formData, utente_professionista_id: value === "__none__" ? "" : value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona utente" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Nessuno</SelectItem>
                                {utenti.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.nome} {u.cognome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="contatto1_id">Contatto 1</Label>
                            <Select
                              value={formData.contatto1_id || "__none__"}
                              onValueChange={(value) => setFormData({ ...formData, contatto1_id: value === "__none__" ? "" : value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona contatto" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Nessuno</SelectItem>
                                {contatti.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.nome} {c.cognome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="contatto2_id">Contatto 2</Label>
                            <Select
                              value={formData.contatto2_id || "__none__"}
                              onValueChange={(value) => setFormData({ ...formData, contatto2_id: value === "__none__" ? "" : value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona contatto" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Nessuno</SelectItem>
                                {contatti.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.nome} {c.cognome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="tipo_prestazione_id">Tipo Prestazione</Label>
                          <Select
                            value={formData.tipo_prestazione_id || "__none__"}
                            onValueChange={(value) => setFormData({ ...formData, tipo_prestazione_id: value === "__none__" ? "" : value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona prestazione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nessuna</SelectItem>
                              {prestazioni.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.descrizione}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="scadenza_antiric">Scadenza Antiriciclaggio</Label>
                          <Input
                            id="scadenza_antiric"
                            type="date"
                            value={formData.scadenza_antiric}
                            onChange={(e) => setFormData({ ...formData, scadenza_antiric: e.target.value })}
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="scadenzari" className="space-y-4">
                        <div className="space-y-3">
                          <p className="text-sm text-gray-600 mb-4">
                            Seleziona gli scadenzari attivi per questo cliente
                          </p>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="flag_iva"
                                checked={formData.flag_iva}
                                onChange={(e) => setFormData({ ...formData, flag_iva: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="flag_iva" className="cursor-pointer">IVA</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="flag_ccgg"
                                checked={formData.flag_ccgg}
                                onChange={(e) => setFormData({ ...formData, flag_ccgg: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="flag_ccgg" className="cursor-pointer">CCGG</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="flag_cu"
                                checked={formData.flag_cu}
                                onChange={(e) => setFormData({ ...formData, flag_cu: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="flag_cu" className="cursor-pointer">CU</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="flag_fiscali"
                                checked={formData.flag_fiscali}
                                onChange={(e) => setFormData({ ...formData, flag_fiscali: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="flag_fiscali" className="cursor-pointer">Fiscali</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="flag_bilancio"
                                checked={formData.flag_bilancio}
                                onChange={(e) => setFormData({ ...formData, flag_bilancio: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="flag_bilancio" className="cursor-pointer">Bilanci</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="flag_770"
                                checked={formData.flag_770}
                                onChange={(e) => setFormData({ ...formData, flag_770: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="flag_770" className="cursor-pointer">770</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="flag_lipe"
                                checked={formData.flag_lipe}
                                onChange={(e) => setFormData({ ...formData, flag_lipe: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="flag_lipe" className="cursor-pointer">Lipe</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="flag_esterometro"
                                checked={formData.flag_esterometro}
                                onChange={(e) => setFormData({ ...formData, flag_esterometro: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="flag_esterometro" className="cursor-pointer">Esterometro</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="flag_proforma"
                                checked={formData.flag_proforma}
                                onChange={(e) => setFormData({ ...formData, flag_proforma: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="flag_proforma" className="cursor-pointer">Proforma</Label>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="comunicazioni" className="space-y-4">
                        <p className="text-sm text-gray-600 mb-4">
                          Gestisci le preferenze di comunicazione del cliente
                        </p>

                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="flag_mail_attivo"
                              checked={formData.flag_mail_attivo}
                              onChange={(e) => setFormData({ ...formData, flag_mail_attivo: e.target.checked })}
                              className="rounded"
                            />
                            <Label htmlFor="flag_mail_attivo" className="cursor-pointer">
                              Email Attiva
                            </Label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="flag_mail_scadenze"
                              checked={formData.flag_mail_scadenze}
                              onChange={(e) => setFormData({ ...formData, flag_mail_scadenze: e.target.checked })}
                              className="rounded"
                            />
                            <Label htmlFor="flag_mail_scadenze" className="cursor-pointer">
                              Ricevi Mailing Scadenze
                            </Label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="flag_mail_newsletter"
                              checked={formData.flag_mail_newsletter}
                              onChange={(e) => setFormData({ ...formData, flag_mail_newsletter: e.target.checked })}
                              className="rounded"
                            />
                            <Label htmlFor="flag_mail_newsletter" className="cursor-pointer">
                              Ricevi Newsletter
                            </Label>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="flex gap-3 pt-6 mt-6 border-t">
                      <Button type="submit" className="flex-1">
                        {editingCliente ? "Aggiorna" : "Crea"} Cliente
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setDialogOpen(false)}
                      >
                        Annulla
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Cerca per ragione sociale, P.IVA o CF..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cod. Cliente</TableHead>
                      <TableHead>Ragione Sociale</TableHead>
                      <TableHead>P.IVA</TableHead>
                      <TableHead>Città</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClienti.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          Nessun cliente trovato
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredClienti.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell className="font-mono text-xs">{cliente.cod_cliente}</TableCell>
                          <TableCell className="font-medium">{cliente.ragione_sociale}</TableCell>
                          <TableCell className="font-mono text-sm">{cliente.partita_iva}</TableCell>
                          <TableCell>{cliente.citta}</TableCell>
                          <TableCell className="text-sm">{cliente.email}</TableCell>
                          <TableCell>
                            <Badge variant={cliente.attivo ? "default" : "secondary"}>
                              {cliente.attivo ? "Attivo" : "Non attivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleAggiungiAScadenzari(cliente.id)}
                                title="Aggiungi agli scadenzari"
                              >
                                <Calendar className="h-4 w-4 text-green-600" />
                              </Button>
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
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
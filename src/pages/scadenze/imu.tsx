import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Plus, Search, Pencil, Trash2, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { imuService } from "@/services/imuService";
import { utenteService } from "@/services/utenteService";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// Tipo base dal DB
type ScadenzaIMUBase = Database["public"]["Tables"]["tbscadimu"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

// Tipo esteso con le relazioni
interface ScadenzaIMU extends ScadenzaIMUBase {
  professionista?: { nome: string; cognome: string } | null;
  operatore?: { nome: string; cognome: string } | null;
}

export default function ScadenzeIMU() {
  const router = useRouter();
  const { toast } = useToast();

  const [scadenze, setScadenze] = useState<ScadenzaIMU[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScadenza, setEditingScadenza] = useState<ScadenzaIMU | null>(null);
  const [currentUserStudioId, setCurrentUserStudioId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    nominativo: "",
    utente_professionista_id: "",
    utente_operatore_id: "",
    acconto_imu: false,
    acconto_dovuto: false,
    acconto_comunicato: false,
    acconto_data: "",
    saldo_imu: false,
    saldo_dovuto: false,
    saldo_comunicato: false,
    saldo_data: "",
    dichiarazione_imu: false,
    dichiarazione_scadenza: "",
    dichiarazione_presentazione: false,
    dichiarazione_data_pres: "",
  });

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    // Recupera studio_id (assumiamo single tenant o primo studio disponibile)
    const { data: studio } = await supabase
      .from("tbstudio")
      .select("id")
      .single();
    
    if (studio) {
      setCurrentUserStudioId(studio.id);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [scadenzeData, utentiData] = await Promise.all([
        imuService.fetchAll(),
        utenteService.getUtenti()
      ]);
      // Casting necessario perché il service ritorna i dati con le relazioni ma il tipo base non le ha
      setScadenze(scadenzeData as unknown as ScadenzaIMU[]);
      setUtenti(utentiData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserStudioId) {
      toast({
        title: "Errore",
        description: "Impossibile identificare lo studio dell'utente",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepara i dati per il salvataggio
      const dataToSave = {
        ...formData,
        studio_id: currentUserStudioId, // Aggiunge lo studio_id
        // Gestione date vuote: se stringa vuota manda null (o undefined per il DB)
        acconto_data: formData.acconto_data || null,
        saldo_data: formData.saldo_data || null,
        dichiarazione_scadenza: formData.dichiarazione_scadenza || null,
        dichiarazione_data_pres: formData.dichiarazione_data_pres || null,
      };

      if (editingScadenza) {
        await imuService.update(editingScadenza.id, dataToSave);
        toast({
          title: "Successo",
          description: "Scadenza IMU aggiornata con successo",
        });
      } else {
        await imuService.create(dataToSave);
        toast({
          title: "Successo",
          description: "Scadenza IMU creata con successo",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error saving scadenza:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare la scadenza",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (scadenza: ScadenzaIMU) => {
    setEditingScadenza(scadenza);
    setFormData({
      nominativo: scadenza.nominativo || "",
      utente_professionista_id: scadenza.utente_professionista_id || "",
      utente_operatore_id: scadenza.utente_operatore_id || "",
      acconto_imu: scadenza.acconto_imu || false,
      acconto_dovuto: scadenza.acconto_dovuto || false,
      acconto_comunicato: scadenza.acconto_comunicato || false,
      acconto_data: scadenza.acconto_data || "",
      saldo_imu: scadenza.saldo_imu || false,
      saldo_dovuto: scadenza.saldo_dovuto || false,
      saldo_comunicato: scadenza.saldo_comunicato || false,
      saldo_data: scadenza.saldo_data || "",
      dichiarazione_imu: scadenza.dichiarazione_imu || false,
      dichiarazione_scadenza: scadenza.dichiarazione_scadenza || "",
      dichiarazione_presentazione: scadenza.dichiarazione_presentazione || false,
      dichiarazione_data_pres: scadenza.dichiarazione_data_pres || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa scadenza IMU?")) return;

    try {
      await imuService.delete(id);
      toast({
        title: "Successo",
        description: "Scadenza IMU eliminata con successo",
      });
      loadData();
    } catch (error) {
      console.error("Error deleting scadenza:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare la scadenza",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingScadenza(null);
    setFormData({
      nominativo: "",
      utente_professionista_id: "",
      utente_operatore_id: "",
      acconto_imu: false,
      acconto_dovuto: false,
      acconto_comunicato: false,
      acconto_data: "",
      saldo_imu: false,
      saldo_dovuto: false,
      saldo_comunicato: false,
      saldo_data: "",
      dichiarazione_imu: false,
      dichiarazione_scadenza: "",
      dichiarazione_presentazione: false,
      dichiarazione_data_pres: "",
    });
  };

  const filteredScadenze = scadenze.filter(scadenza =>
    scadenza.nominativo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatoBadge = (scadenza: ScadenzaIMU) => {
    // Logica semplificata per lo stato
    if (scadenza.dichiarazione_presentazione) {
      return <Badge className="bg-green-500">Completato</Badge>;
    }
    
    // Se c'è un acconto o saldo dovuto non ancora comunicato
    if ((scadenza.acconto_dovuto && !scadenza.acconto_comunicato) || 
        (scadenza.saldo_dovuto && !scadenza.saldo_comunicato)) {
      return <Badge variant="destructive">Da Comunicare</Badge>;
    }

    return <Badge className="bg-yellow-500">In Corso</Badge>;
  };

  return (
    <>
      <Head>
        <title>Scadenze IMU - Studio Manager Pro</title>
      </Head>

      <div className="container mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Scadenze IMU</h1>
            <p className="text-muted-foreground">Gestione scadenze IMU con acconto, saldo e dichiarazione</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nuova Scadenza IMU
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingScadenza ? "Modifica Scadenza IMU" : "Nuova Scadenza IMU"}
                </DialogTitle>
                <DialogDescription>
                  Compila tutti i campi per gestire la scadenza IMU
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                {/* Dati Generali */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium">Anagrafica e Assegnazione</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nominativo">Nominativo Cliente *</Label>
                        <Input
                          id="nominativo"
                          value={formData.nominativo}
                          onChange={(e) => setFormData({ ...formData, nominativo: e.target.value })}
                          required
                          placeholder="Es. Mario Rossi"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="professionista">Professionista</Label>
                        <Select
                          value={formData.utente_professionista_id}
                          onValueChange={(value) => setFormData({ ...formData, utente_professionista_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona..." />
                          </SelectTrigger>
                          <SelectContent>
                            {utenti.map((utente) => (
                              <SelectItem key={utente.id} value={utente.id}>
                                {utente.nome} {utente.cognome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="operatore">Operatore</Label>
                        <Select
                          value={formData.utente_operatore_id}
                          onValueChange={(value) => setFormData({ ...formData, utente_operatore_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona..." />
                          </SelectTrigger>
                          <SelectContent>
                            {utenti.map((utente) => (
                              <SelectItem key={utente.id} value={utente.id}>
                                {utente.nome} {utente.cognome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Acconto IMU */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium">Acconto IMU (Giugno)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div className="flex items-center space-x-2 h-10">
                        <Checkbox
                          id="acconto_imu"
                          checked={formData.acconto_imu}
                          onCheckedChange={(checked) => setFormData({ ...formData, acconto_imu: checked as boolean })}
                        />
                        <Label htmlFor="acconto_imu" className="font-normal cursor-pointer">Pratica Acconto</Label>
                      </div>

                      <div className="flex items-center space-x-2 h-10">
                        <Checkbox
                          id="acconto_dovuto"
                          checked={formData.acconto_dovuto}
                          onCheckedChange={(checked) => setFormData({ ...formData, acconto_dovuto: checked as boolean })}
                        />
                        <Label htmlFor="acconto_dovuto" className="font-normal cursor-pointer">Importo Dovuto</Label>
                      </div>

                      <div className="flex items-center space-x-2 h-10">
                        <Checkbox
                          id="acconto_comunicato"
                          checked={formData.acconto_comunicato}
                          onCheckedChange={(checked) => setFormData({ ...formData, acconto_comunicato: checked as boolean })}
                        />
                        <Label htmlFor="acconto_comunicato" className="font-normal cursor-pointer">Comunicato al cliente</Label>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="acconto_data">Data Comunicazione</Label>
                        <Input
                          id="acconto_data"
                          type="date"
                          value={formData.acconto_data}
                          onChange={(e) => setFormData({ ...formData, acconto_data: e.target.value })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Saldo IMU */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium">Saldo IMU (Dicembre)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div className="flex items-center space-x-2 h-10">
                        <Checkbox
                          id="saldo_imu"
                          checked={formData.saldo_imu}
                          onCheckedChange={(checked) => setFormData({ ...formData, saldo_imu: checked as boolean })}
                        />
                        <Label htmlFor="saldo_imu" className="font-normal cursor-pointer">Pratica Saldo</Label>
                      </div>

                      <div className="flex items-center space-x-2 h-10">
                        <Checkbox
                          id="saldo_dovuto"
                          checked={formData.saldo_dovuto}
                          onCheckedChange={(checked) => setFormData({ ...formData, saldo_dovuto: checked as boolean })}
                        />
                        <Label htmlFor="saldo_dovuto" className="font-normal cursor-pointer">Importo Dovuto</Label>
                      </div>

                      <div className="flex items-center space-x-2 h-10">
                        <Checkbox
                          id="saldo_comunicato"
                          checked={formData.saldo_comunicato}
                          onCheckedChange={(checked) => setFormData({ ...formData, saldo_comunicato: checked as boolean })}
                        />
                        <Label htmlFor="saldo_comunicato" className="font-normal cursor-pointer">Comunicato al cliente</Label>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="saldo_data">Data Comunicazione</Label>
                        <Input
                          id="saldo_data"
                          type="date"
                          value={formData.saldo_data}
                          onChange={(e) => setFormData({ ...formData, saldo_data: e.target.value })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Dichiarazione IMU */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium">Dichiarazione IMU</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div className="flex items-center space-x-2 h-10">
                        <Checkbox
                          id="dichiarazione_imu"
                          checked={formData.dichiarazione_imu}
                          onCheckedChange={(checked) => setFormData({ ...formData, dichiarazione_imu: checked as boolean })}
                        />
                        <Label htmlFor="dichiarazione_imu" className="font-normal cursor-pointer">Da Presentare</Label>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dichiarazione_scadenza">Data Scadenza</Label>
                        <Input
                          id="dichiarazione_scadenza"
                          type="date"
                          value={formData.dichiarazione_scadenza}
                          onChange={(e) => setFormData({ ...formData, dichiarazione_scadenza: e.target.value })}
                        />
                      </div>

                      <div className="flex items-center space-x-2 h-10">
                        <Checkbox
                          id="dichiarazione_presentazione"
                          checked={formData.dichiarazione_presentazione}
                          onCheckedChange={(checked) => setFormData({ ...formData, dichiarazione_presentazione: checked as boolean })}
                        />
                        <Label htmlFor="dichiarazione_presentazione" className="font-normal cursor-pointer">Presentata</Label>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dichiarazione_data_presentazione">Data Presentazione</Label>
                        <Input
                          id="dichiarazione_data_presentazione"
                          type="date"
                          value={formData.dichiarazione_data_pres}
                          onChange={(e) => setFormData({ ...formData, dichiarazione_data_pres: e.target.value })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button type="submit">
                    {editingScadenza ? "Salva Modifiche" : "Crea Scadenza"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nominativo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Caricamento...</div>
            ) : filteredScadenze.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nessuna scadenza IMU trovata. Crea la prima!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nominativo</TableHead>
                      <TableHead>Professionista</TableHead>
                      <TableHead>Operatore</TableHead>
                      <TableHead className="text-center">Acconto</TableHead>
                      <TableHead className="text-center">Saldo</TableHead>
                      <TableHead className="text-center">Dichiarazione</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredScadenze.map((scadenza) => (
                      <TableRow key={scadenza.id}>
                        <TableCell className="font-medium">{scadenza.nominativo}</TableCell>
                        <TableCell>
                          {scadenza.professionista 
                            ? `${scadenza.professionista.nome} ${scadenza.professionista.cognome}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {scadenza.operatore
                            ? `${scadenza.operatore.nome} ${scadenza.operatore.cognome}`
                            : "-"}
                        </TableCell>
                        
                        {/* Status Acconto */}
                        <TableCell className="text-center">
                          {scadenza.acconto_imu ? (
                            scadenza.acconto_comunicato ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Comunicato</Badge>
                            ) : (
                              scadenza.acconto_dovuto ? (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Da Comunicare</Badge>
                              ) : (
                                <Badge variant="outline" className="text-gray-500">In Corso</Badge>
                              )
                            )
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </TableCell>

                        {/* Status Saldo */}
                        <TableCell className="text-center">
                          {scadenza.saldo_imu ? (
                            scadenza.saldo_comunicato ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Comunicato</Badge>
                            ) : (
                              scadenza.saldo_dovuto ? (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Da Comunicare</Badge>
                              ) : (
                                <Badge variant="outline" className="text-gray-500">In Corso</Badge>
                              )
                            )
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </TableCell>

                        {/* Status Dichiarazione */}
                        <TableCell className="text-center">
                          {scadenza.dichiarazione_imu ? (
                            scadenza.dichiarazione_presentazione ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Presentata</Badge>
                            ) : (
                              <div className="flex flex-col items-center">
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Da Fare</Badge>
                                {scadenza.dichiarazione_scadenza && (
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Scad: {new Date(scadenza.dichiarazione_scadenza).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            )
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </TableCell>

                        <TableCell>{getStatoBadge(scadenza)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(scadenza)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(scadenza.id)}
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
      </div>
    </>
  );
}
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { comunicazioneService } from "@/services/comunicazioneService";
import { clienteService } from "@/services/clienteService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Plus, Paperclip, Search, Trash2, Eye, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Comunicazione = Database["public"]["Tables"]["tbcomunicazioni"]["Row"];
type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];

export default function ComunicazioniPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [comunicazioni, setComunicazioni] = useState<Comunicazione[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    tipo: "newsletter" as "newsletter" | "scadenze" | "singola",
    destinatario_id: "", // Per invio singolo
    oggetto: "",
    messaggio: ""
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
      const [comunicazioniData, clientiData] = await Promise.all([
        comunicazioneService.getComunicazioni(),
        clienteService.getClienti()
      ]);
      setComunicazioni(comunicazioniData);
      setClienti(clientiData);
    } catch (error) {
      console.error("Errore caricamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const uploadAllegato = async (): Promise<any> => {
    if (!selectedFile) return null;

    try {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `allegati/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("comunicazioni-assets")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("comunicazioni-assets")
        .getPublicUrl(filePath);

      return {
        nome: selectedFile.name,
        url: publicUrl,
        tipo: selectedFile.type,
        dimensione: selectedFile.size
      };
    } catch (error) {
      console.error("Errore upload:", error);
      throw new Error("Errore caricamento allegato");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.oggetto || !formData.messaggio) {
      toast({
        title: "Errore",
        description: "Oggetto e messaggio sono obbligatori",
        variant: "destructive"
      });
      return;
    }

    if (formData.tipo === "singola" && !formData.destinatario_id) {
      toast({
        title: "Errore",
        description: "Seleziona un destinatario",
        variant: "destructive"
      });
      return;
    }

    try {
      setSending(true);

      // 1. Upload allegato se presente
      let allegati = null;
      if (selectedFile) {
        const fileData = await uploadAllegato();
        allegati = [fileData]; // Salviamo come array JSON
      }

      // 2. Determina destinatari
      let destinatariCount = 0;
      if (formData.tipo === "singola") {
        destinatariCount = 1;
      } else if (formData.tipo === "newsletter") {
        destinatariCount = clienti.filter(c => c.attivo && c.flag_mail_attivo && c.flag_mail_newsletter).length;
      } else if (formData.tipo === "scadenze") {
        destinatariCount = clienti.filter(c => c.attivo && c.flag_mail_attivo && c.flag_mail_scadenze).length;
      }

      // 3. Salva comunicazione nel DB
      await comunicazioneService.createComunicazione({
        tipo: formData.tipo,
        oggetto: formData.oggetto,
        messaggio: formData.messaggio,
        allegati: allegati, // JSON field
        destinatari_count: destinatariCount,
        stato: "Inviata", // Simuliamo l'invio immediato
        data_invio: new Date().toISOString()
      });

      // TODO: Qui andrebbe integrato l'invio reale delle email (es. SendGrid, AWS SES)
      // Per ora simuliamo solo il salvataggio

      toast({
        title: "Inviata con successo",
        description: `Comunicazione inviata a ${destinatariCount} destinatari`
      });

      setDialogOpen(false);
      setFormData({
        tipo: "newsletter",
        destinatario_id: "",
        oggetto: "",
        messaggio: ""
      });
      setSelectedFile(null);
      await loadData();

    } catch (error) {
      console.error("Errore invio:", error);
      toast({
        title: "Errore",
        description: "Impossibile inviare la comunicazione",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo messaggio dallo storico?")) return;

    try {
      await comunicazioneService.deleteComunicazione(id);
      toast({
        title: "Eliminato",
        description: "Messaggio eliminato dallo storico"
      });
      await loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il messaggio",
        variant: "destructive"
      });
    }
  };

  const filteredComunicazioni = comunicazioni.filter(c =>
    c.oggetto.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.messaggio.toLowerCase().includes(searchQuery.toLowerCase())
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
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comunicazioni</h1>
          <p className="text-gray-500 mt-1">Gestione invio email e comunicazioni massive</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nuova Comunicazione
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Nuova Comunicazione</DialogTitle>
              <DialogDescription>
                Invia email a singoli clienti o gruppi di distribuzione
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo Invio</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value: any) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newsletter">Newsletter (Tutti iscritti)</SelectItem>
                      <SelectItem value="scadenze">Avviso Scadenze</SelectItem>
                      <SelectItem value="singola">Singolo Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.tipo === "singola" && (
                  <div className="space-y-2">
                    <Label htmlFor="destinatario">Destinatario</Label>
                    <Select
                      value={formData.destinatario_id}
                      onValueChange={(value) => setFormData({ ...formData, destinatario_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clienti.filter(c => c.attivo).map((cliente) => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.ragione_sociale}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="oggetto">Oggetto</Label>
                <Input
                  id="oggetto"
                  value={formData.oggetto}
                  onChange={(e) => setFormData({ ...formData, oggetto: e.target.value })}
                  placeholder="Oggetto della mail..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="messaggio">Messaggio</Label>
                <Textarea
                  id="messaggio"
                  value={formData.messaggio}
                  onChange={(e) => setFormData({ ...formData, messaggio: e.target.value })}
                  placeholder="Scrivi qui il tuo messaggio..."
                  rows={8}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="allegato">Allegato</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="allegato"
                    type="file"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {selectedFile && (
                    <Badge variant="secondary" className="px-2 py-1">
                      {selectedFile.name}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
                  disabled={sending}
                >
                  Annulla
                </Button>
                <Button type="submit" disabled={sending} className="bg-blue-600">
                  {sending ? (
                    <>Invio in corso...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Invia Messaggio
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <CardTitle>Storico Comunicazioni</CardTitle>
            <div className="relative flex-1 max-w-sm ml-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cerca nello storico..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Oggetto</TableHead>
                <TableHead>Destinatari</TableHead>
                <TableHead>Allegati</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredComunicazioni.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Nessuna comunicazione trovata
                  </TableCell>
                </TableRow>
              ) : (
                filteredComunicazioni.map((comm) => (
                  <TableRow key={comm.id}>
                    <TableCell className="text-sm">
                      {comm.data_invio ? new Date(comm.data_invio).toLocaleDateString("it-IT") : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        comm.tipo === "newsletter" ? "default" : 
                        comm.tipo === "scadenze" ? "destructive" : "secondary"
                      }>
                        {comm.tipo.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{comm.oggetto}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-gray-500" />
                        <span className="text-sm">{comm.destinatari_count || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {comm.allegati ? (
                        <Paperclip className="h-4 w-4 text-blue-600" />
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(comm.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
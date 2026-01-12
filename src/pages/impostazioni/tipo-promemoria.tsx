import { useState, useEffect } from "react";
import Head from "next/head";
import { tipoPromemoriaService } from "@/services/tipoPromemoriaService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";

type TipoPromemoria = Database["public"]["Tables"]["tbtipopromemoria"]["Row"];

export default function TipoPromemoriaPage() {
  const [tipi, setTipi] = useState<TipoPromemoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoPromemoria | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: "",
    descrizione: "",
    colore: "#3B82F6",
  });

  useEffect(() => {
    fetchTipi();
  }, []);

  const fetchTipi = async () => {
    try {
      setLoading(true);
      const data = await tipoPromemoriaService.getTipiPromemoria();
      setTipi(data);
    } catch (error) {
      console.error("Errore caricamento tipi promemoria:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i tipi di promemoria",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingTipo) {
        await tipoPromemoriaService.aggiornaTipoPromemoria(editingTipo.id, formData);
        toast({
          title: "Successo",
          description: "Tipo promemoria aggiornato con successo",
        });
      } else {
        await tipoPromemoriaService.creaTipoPromemoria(formData);
        toast({
          title: "Successo",
          description: "Tipo promemoria creato con successo",
        });
      }

      setShowDialog(false);
      resetForm();
      fetchTipi();
    } catch (error: any) {
      console.error("Errore salvataggio tipo promemoria:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare il tipo promemoria",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo tipo di promemoria?")) return;

    try {
      await tipoPromemoriaService.eliminaTipoPromemoria(id);
      toast({
        title: "Successo",
        description: "Tipo promemoria eliminato con successo",
      });
      fetchTipi();
    } catch (error: any) {
      console.error("Errore eliminazione tipo promemoria:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il tipo promemoria",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (tipo: TipoPromemoria) => {
    setEditingTipo(tipo);
    setFormData({
      nome: tipo.nome,
      descrizione: tipo.descrizione || "",
      colore: tipo.colore || "#3B82F6",
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingTipo(null);
    setFormData({
      nome: "",
      descrizione: "",
      colore: "#3B82F6",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Caricamento tipi promemoria...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Tipi Promemoria | Studio Manager</title>
      </Head>

      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">Tipi Promemoria</h1>
              <p className="text-muted-foreground mt-2">
                Gestione delle tipologie di promemoria
              </p>
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuovo Tipo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTipo ? "Modifica Tipo Promemoria" : "Nuovo Tipo Promemoria"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Es: Consulenza"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="descrizione">Descrizione</Label>
                    <Textarea
                      id="descrizione"
                      value={formData.descrizione}
                      onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                      placeholder="Descrizione della tipologia"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="colore">Colore</Label>
                    <div className="flex gap-2">
                      <Input
                        id="colore"
                        type="color"
                        value={formData.colore}
                        onChange={(e) => setFormData({ ...formData, colore: e.target.value })}
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        value={formData.colore}
                        onChange={(e) => setFormData({ ...formData, colore: e.target.value })}
                        placeholder="#3B82F6"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                      Annulla
                    </Button>
                    <Button type="submit">
                      {editingTipo ? "Aggiorna" : "Crea"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Elenco Tipi Promemoria</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colore</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tipi.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nessun tipo di promemoria trovato
                      </TableCell>
                    </TableRow>
                  ) : (
                    tipi.map((tipo) => (
                      <TableRow key={tipo.id}>
                        <TableCell>
                          <div
                            className="w-8 h-8 rounded-full border-2"
                            style={{ backgroundColor: tipo.colore || "#3B82F6" }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{tipo.nome}</TableCell>
                        <TableCell>{tipo.descrizione || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(tipo)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(tipo.id)}
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
      </div>
    </>
  );
}
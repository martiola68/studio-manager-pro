import { useEffect, useState } from "react";
import Head from "next/head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { studioService } from "@/services/studioService";
import { tipoPromemoriaService, type TipoPromemoriaCatalogo } from "@/services/tipoPromemoriaService";
import { supabase } from "@/lib/supabase/client";

const EMPTY_FORM = { nome: "", colore: "#3B82F6" };

export default function TipoPromemoriaPage() {
  const { toast } = useToast();
  const [tipi, setTipi] = useState<TipoPromemoriaCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [canManageSystem, setCanManageSystem] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoPromemoriaCatalogo | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => { void initialize(); }, []);

  const initialize = async () => {
    try {
      setLoading(true);
      const studio = await studioService.getStudio();
      if (!studio?.id) throw new Error("Studio non configurato");
      setStudioId(studio.id);
      const { data: systemAdmin, error } = await (supabase as any).rpc("is_system_catalog_admin");
      if (error) console.warn("Verifica amministratore catalogo non disponibile:", error);
      setCanManageSystem(systemAdmin === true);
      await fetchTipi(studio.id);
    } catch (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile caricare i tipi di promemoria", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const fetchTipi = async (currentStudioId = studioId) => {
    if (!currentStudioId) return;
    const data = await tipoPromemoriaService.getTipiPromemoria(currentStudioId);
    setTipi(data.filter((tipo) => tipo.origine === "S"));
  };

  const resetForm = () => { setEditingTipo(null); setFormData({ ...EMPTY_FORM }); };

  const handleEdit = (tipo: TipoPromemoriaCatalogo) => {
    if (!canManageSystem) return;
    setEditingTipo(tipo);
    setFormData({ nome: tipo.nome, colore: tipo.colore || "#3B82F6" });
    setShowDialog(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageSystem || !studioId) return;
    try {
      if (editingTipo) {
        await tipoPromemoriaService.aggiornaTipoPromemoria(editingTipo.id, { nome: formData.nome.trim(), descrizione: null, colore: formData.colore });
      } else {
        await tipoPromemoriaService.creaTipoPromemoria({ nome: formData.nome.trim(), descrizione: null, colore: formData.colore, studio_id: studioId, origine: "S" });
      }
      setShowDialog(false);
      resetForm();
      await fetchTipi(studioId);
      toast({ title: "Successo", description: editingTipo ? "Tipo di sistema aggiornato" : "Tipo di sistema creato" });
    } catch (error) {
      console.error(error);
      toast({ title: "Errore", description: error instanceof Error ? error.message : "Impossibile salvare il tipo promemoria", variant: "destructive" });
    }
  };

  const handleDelete = async (tipo: TipoPromemoriaCatalogo) => {
    if (!canManageSystem || !confirm("Eliminare questo tipo di sistema?")) return;
    try {
      await tipoPromemoriaService.eliminaTipoPromemoria(tipo.id);
      await fetchTipi();
      toast({ title: "Successo", description: "Tipo promemoria eliminato" });
    } catch (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile eliminare il tipo promemoria", variant: "destructive" });
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Caricamento tipi promemoria...</div>;

  return <><Head><title>Tipi Promemoria | Studio Manager</title></Head><div className="flex-1 p-8"><div className="max-w-6xl mx-auto">
    <div className="flex justify-between items-center mb-8"><div><h1 className="text-3xl font-bold">Tipi Promemoria</h1><p className="text-muted-foreground mt-2">Catalogo unico dei tipi promemoria di sistema</p></div>
      {canManageSystem && <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}><DialogTrigger asChild><Button onClick={resetForm}><Plus className="mr-2 h-4 w-4" />Nuovo Tipo</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{editingTipo ? "Modifica Tipo Promemoria" : "Nuovo Tipo Promemoria"}</DialogTitle></DialogHeader><form onSubmit={handleSubmit} className="space-y-4"><div><Label>Tipo</Label><div className="mt-2"><Badge className="bg-slate-900 text-white">S · Sistema</Badge></div></div><div><Label htmlFor="nome">Nome *</Label><Input id="nome" className="mt-1" value={formData.nome} onChange={(e)=>setFormData({...formData,nome:e.target.value})} required /></div><div><Label htmlFor="colore">Colore</Label><div className="flex gap-2"><Input id="colore" type="color" value={formData.colore} onChange={(e)=>setFormData({...formData,colore:e.target.value})} className="w-20 h-10"/><Input value={formData.colore} onChange={(e)=>setFormData({...formData,colore:e.target.value})}/></div></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setShowDialog(false)}>Annulla</Button><Button type="submit">{editingTipo ? "Aggiorna" : "Crea"}</Button></div></form></DialogContent></Dialog>}
    </div>
    <Card><CardHeader><CardTitle>Elenco Tipi Promemoria</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Colore</TableHead><TableHead>Tipo</TableHead><TableHead>Nome</TableHead>{canManageSystem && <TableHead className="text-right">Azioni</TableHead>}</TableRow></TableHeader><TableBody>{tipi.length===0?<TableRow><TableCell colSpan={canManageSystem?4:3} className="text-center py-8 text-muted-foreground">Nessun tipo di promemoria trovato</TableCell></TableRow>:tipi.map((tipo)=><TableRow key={tipo.id}><TableCell><div className="w-8 h-8 rounded-full border-2" style={{backgroundColor:tipo.colore||"#3B82F6"}}/></TableCell><TableCell><Badge className="bg-slate-900 text-white">S · Sistema</Badge></TableCell><TableCell className="font-medium">{tipo.nome}</TableCell>{canManageSystem&&<TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={()=>handleEdit(tipo)} title="Modifica"><Edit className="h-4 w-4"/></Button><Button variant="ghost" size="icon" onClick={()=>handleDelete(tipo)} title="Elimina"><Trash2 className="h-4 w-4"/></Button></div></TableCell>}</TableRow>)}</TableBody></Table></CardContent></Card>
  </div></div></>;
}

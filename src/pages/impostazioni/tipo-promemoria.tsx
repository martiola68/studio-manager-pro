import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Plus, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { studioService } from "@/services/studioService";
import {
  tipoPromemoriaService,
  type TipoPromemoriaCatalogo,
} from "@/services/tipoPromemoriaService";
import { supabase } from "@/lib/supabase/client";

const EMPTY_FORM = {
  origine: "P" as "S" | "P",
  nome: "",
  descrizione: "",
  colore: "#3B82F6",
};

const CATALOGO_TIPI: Record<string, string[]> = {
  "Generali": ["Appuntamento", "Chiamata", "Email", "Riunione", "Videoconferenza", "Scadenza", "Avviso di scadenza", "Scadenza Documento", "Richiamare cliente", "Sollecito", "Follow-up", "Attività interna", "Nota operativa"],
  "Clienti / Pratiche": ["Apertura pratica", "Lavorazione pratica", "Verifica pratica", "Integrazione documenti", "Documenti mancanti", "Invio documenti", "Firma documenti", "Chiusura pratica", "Rinnovo pratica", "Aggiornamento anagrafica"],
  "Fiscale": ["Dichiarazione redditi", "IVA", "LIPE", "770", "CU", "IMU", "IRAP", "F24", "Esterometro", "Intrastat", "Dichiarazione IVA", "Acconto imposte", "Saldo imposte", "Comunicazione fiscale", "Adempimento fiscale"],
  "Contabilità": ["Registrazioni contabili", "Chiusura contabilità", "Situazione contabile", "Riconciliazione bancaria", "Liquidazione IVA", "Controllo contabile", "Bilancio", "Deposito bilancio", "Inventario", "Controllo documentazione contabile"],
  "Enti": ["Agenzia delle Entrate", "INPS", "INAIL", "Camera di commercio", "Altri enti", "Comunicazione ente", "Risposta ente", "Richiesta documentazione ente"],
  "Contenzioso": ["Avviso bonario", "Cartella", "Accertamento", "CIVIS", "Autotutela", "Ricorso", "Udienza", "Rateazione", "Sgravio", "Risposta Agenzia Entrate", "Termine contenzioso"],
  "Lavoro / Paghe": ["Assunzione", "Cessazione", "Trasformazione rapporto", "Proroga", "Collocamento", "Collocamento disabili", "Elaborazione paghe", "Presenze", "Ferie e permessi", "Malattia", "Infortunio", "Contestazione disciplinare", "Conciliazione", "Comunicazione obbligatoria"],
  "Societario": ["Assemblea", "CDA", "Verbale", "Distribuzione utili", "Nomina amministratore", "Cambio amministratore", "Nomina sindaco/revisore", "Scadenza carica", "Variazione societaria", "Messa in liquidazione", "Pratica CCIAA", "Deposito atto"],
  "Antiriciclaggio": ["Adeguata verifica", "Identificazione cliente", "Titolare effettivo", "AV1", "AV2", "AV4", "Aggiornamento AML", "Rinnovo adeguata verifica", "Documento identità in scadenza"],
  "Revisione / Controllo": ["Revisione", "Checklist revisione", "Follow-up revisione", "Controllo di gestione", "Report trimestrale", "Verifica documentazione", "Richiesta documentazione"],
  "Consulenza": ["Consulenza base", "Consulenza Senior", "Parere", "Analisi", "Elaborazioni", "Riunione cliente", "Attività professionale"],
  "Documenti": ["Documento da predisporre", "Documento da verificare", "Documento da firmare", "Documento da inviare", "Documento da ricevere", "Documento in scadenza", "Rinnovo documento"],
  "Incassi / Amministrazione": ["Emissione parcella", "Proforma", "Fattura", "Incasso", "Pagamento", "Sollecito pagamento", "Recupero credito", "Rinnovo contratto"],
};

export default function TipoPromemoriaPage() {
  const { toast } = useToast();
  const [tipi, setTipi] = useState<TipoPromemoriaCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [canManageSystem, setCanManageSystem] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoPromemoriaCatalogo | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [catalogOpen, setCatalogOpen] = useState(false);

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
      console.error("Errore inizializzazione tipi promemoria:", error);
      toast({ title: "Errore", description: "Impossibile caricare i tipi di promemoria", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const fetchTipi = async (currentStudioId = studioId) => {
    if (!currentStudioId) return;
    try { setTipi(await tipoPromemoriaService.getTipiPromemoria(currentStudioId)); }
    catch (error) {
      console.error("Errore caricamento tipi promemoria:", error);
      toast({ title: "Errore", description: "Impossibile caricare i tipi di promemoria", variant: "destructive" });
    }
  };

  const catalogoFiltrato = useMemo(() => {
    const q = formData.nome.trim().toLocaleLowerCase("it");
    return Object.entries(CATALOGO_TIPI).map(([categoria, nomi]) => [categoria, q ? nomi.filter((nome) => nome.toLocaleLowerCase("it").includes(q)) : nomi] as const).filter(([, nomi]) => nomi.length > 0);
  }, [formData.nome]);

  const canEditTipo = (tipo: TipoPromemoriaCatalogo) => tipo.origine === "P" || canManageSystem;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!studioId) return;
    try {
      if (editingTipo) {
        if (!canEditTipo(editingTipo)) throw new Error("Tipo di sistema modificabile solo dall'Amministratore di Sistema.");
        await tipoPromemoriaService.aggiornaTipoPromemoria(editingTipo.id, { nome: formData.nome.trim(), descrizione: formData.descrizione.trim(), colore: formData.colore });
        toast({ title: "Successo", description: "Tipo promemoria aggiornato" });
      } else {
        const origine = canManageSystem ? formData.origine : "P";
        await tipoPromemoriaService.creaTipoPromemoria({ nome: formData.nome.trim(), descrizione: formData.descrizione.trim(), colore: formData.colore, studio_id: studioId, origine });
        toast({ title: "Successo", description: origine === "S" ? "Tipo promemoria di sistema creato" : "Tipo promemoria personale creato" });
      }
      setShowDialog(false); resetForm(); await fetchTipi(studioId);
    } catch (error) {
      console.error("Errore salvataggio tipo promemoria:", error);
      toast({ title: "Errore", description: error instanceof Error ? error.message : "Impossibile salvare il tipo promemoria", variant: "destructive" });
    }
  };

  const handleDelete = async (tipo: TipoPromemoriaCatalogo) => {
    if (!canEditTipo(tipo) || !confirm("Sei sicuro di voler eliminare questo tipo di promemoria?")) return;
    try { await tipoPromemoriaService.eliminaTipoPromemoria(tipo.id); toast({ title: "Successo", description: "Tipo promemoria eliminato" }); await fetchTipi(); }
    catch (error) { console.error("Errore eliminazione tipo promemoria:", error); toast({ title: "Errore", description: "Impossibile eliminare il tipo promemoria", variant: "destructive" }); }
  };

  const handleEdit = (tipo: TipoPromemoriaCatalogo) => {
    if (!canEditTipo(tipo)) return;
    setEditingTipo(tipo); setFormData({ origine: tipo.origine, nome: tipo.nome, descrizione: tipo.descrizione || "", colore: tipo.colore || "#3B82F6" }); setShowDialog(true);
  };

  const resetForm = () => { setEditingTipo(null); setFormData({ ...EMPTY_FORM }); setCatalogOpen(false); };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" /><p className="mt-4 text-muted-foreground">Caricamento tipi promemoria...</p></div></div>;

  return <><Head><title>Tipi Promemoria | Studio Manager</title></Head><div className="flex-1 p-8"><div className="max-w-6xl mx-auto">
    <div className="flex justify-between items-center mb-8"><div><h1 className="text-3xl font-bold">Tipi Promemoria</h1><p className="text-muted-foreground mt-2">Tipi di sistema condivisi e tipi personali dello studio</p></div>
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}><DialogTrigger asChild><Button onClick={resetForm}><Plus className="mr-2 h-4 w-4" />Nuovo Tipo</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>{editingTipo ? "Modifica Tipo Promemoria" : "Nuovo Tipo Promemoria"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingTipo && <div><Label>Origine</Label>{canManageSystem ? <div className="mt-2 flex gap-2"><Button type="button" variant={formData.origine === "S" ? "default" : "outline"} onClick={() => setFormData((p) => ({...p, origine:"S"}))}>S · Sistema</Button><Button type="button" variant={formData.origine === "P" ? "default" : "outline"} onClick={() => setFormData((p) => ({...p, origine:"P"}))}>P · Personale</Button></div> : <div className="mt-2"><Badge className="bg-amber-100 text-amber-900">P · Personale</Badge><p className="text-xs text-muted-foreground mt-1">I nuovi tipi sono personali dello studio.</p></div>}</div>}
            {editingTipo && <div><Label>Origine</Label><div className="mt-2"><Badge className={editingTipo.origine === "S" ? "bg-slate-900 text-white" : "bg-amber-100 text-amber-900"}>{editingTipo.origine === "S" ? "S · Sistema" : "P · Personale"}</Badge></div></div>}
            <div className="relative"><Label htmlFor="nome">Nome *</Label><div className="relative mt-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input id="nome" className="pl-9" value={formData.nome} onFocus={() => !editingTipo && setCatalogOpen(true)} onChange={(e) => { setFormData({...formData,nome:e.target.value}); if (!editingTipo) setCatalogOpen(true); }} placeholder="Cerca o scrivi un tipo di promemoria..." required /></div>
              {!editingTipo && catalogOpen && <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-background shadow-lg">{catalogoFiltrato.length ? catalogoFiltrato.map(([categoria,nomi]) => <div key={categoria}><div className="sticky top-0 bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">{categoria}</div>{nomi.map((nome) => <button key={nome} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => {setFormData((p)=>({...p,nome}));setCatalogOpen(false);}}>{nome}</button>)}</div>) : <div className="p-3 text-sm"><strong>“{formData.nome}”</strong> non è nel catalogo.<div className="mt-1 text-muted-foreground">Puoi comunque crearlo come tipo personalizzato dello studio.</div></div>}</div>}
              {!editingTipo && <p className="mt-1 text-xs text-muted-foreground">Seleziona dal catalogo oppure scrivi un tipo personalizzato.</p>}
            </div>
            <div><Label htmlFor="descrizione">Descrizione</Label><Textarea id="descrizione" value={formData.descrizione} onChange={(e)=>setFormData({...formData,descrizione:e.target.value})} placeholder="Descrizione della tipologia" rows={3}/></div>
            <div><Label htmlFor="colore">Colore</Label><div className="flex gap-2"><Input id="colore" type="color" value={formData.colore} onChange={(e)=>setFormData({...formData,colore:e.target.value})} className="w-20 h-10"/><Input type="text" value={formData.colore} onChange={(e)=>setFormData({...formData,colore:e.target.value})} placeholder="#3B82F6"/></div></div>
            <div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={()=>setShowDialog(false)}>Annulla</Button><Button type="submit">{editingTipo ? "Aggiorna" : "Crea"}</Button></div>
          </form></DialogContent></Dialog></div>
    <Card><CardHeader><CardTitle>Elenco Tipi Promemoria</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Colore</TableHead><TableHead>Tipo</TableHead><TableHead>Nome</TableHead><TableHead>Descrizione</TableHead><TableHead className="text-right">Azioni</TableHead></TableRow></TableHeader><TableBody>
      {tipi.length===0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nessun tipo di promemoria trovato</TableCell></TableRow> : tipi.map((tipo)=>{const editable=canEditTipo(tipo);return <TableRow key={tipo.id}><TableCell><div className="w-8 h-8 rounded-full border-2" style={{backgroundColor:tipo.colore||"#3B82F6"}}/></TableCell><TableCell><Badge className={tipo.origine==="S"?"bg-slate-900 text-white":"bg-amber-100 text-amber-900"}>{tipo.origine==="S"?"S · Sistema":"P · Personale"}</Badge></TableCell><TableCell className="font-medium">{tipo.nome}</TableCell><TableCell>{tipo.descrizione||"-"}</TableCell><TableCell className="text-right">{editable?<div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={()=>handleEdit(tipo)} title="Modifica"><Edit className="h-4 w-4"/></Button><Button variant="ghost" size="icon" onClick={()=>handleDelete(tipo)} title="Elimina"><Trash2 className="h-4 w-4"/></Button></div>:<span className="text-xs text-muted-foreground">Solo lettura</span>}</TableCell></TableRow>})}
    </TableBody></Table></CardContent></Card>
  </div></div></>;
}

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Calculator, FolderTree, PackageOpen, ReceiptText, TrendingDown, BookOpen } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getStudioId } from "@/lib/getStudioId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Cliente = { id:string; ragione_sociale:string|null; cod_cliente:string|null };
type Totali = { cespiti:number; costo:number; fondo:number; netto:number };

export default function CespitiDashboardPage() {
  const router=useRouter();
  const [studioId,setStudioId]=useState("");
  const [clienti,setClienti]=useState<Cliente[]>([]);
  const [clienteId,setClienteId]=useState("");
  const [totali,setTotali]=useState<Totali>({cespiti:0,costo:0,fondo:0,netto:0});
  const [loading,setLoading]=useState(true);
  const esercizio=useMemo(()=>new Date().getFullYear(),[]);

  useEffect(()=>{ void init(); },[]);
  useEffect(()=>{ if(studioId) void loadTotali(); },[studioId,clienteId]);

  async function init(){
    try{
      const sid=await getStudioId();
      if(!sid) throw new Error("Studio non disponibile");
      setStudioId(sid);
      const supabase=getSupabaseClient();
      const {data,error}=await (supabase as any).from("tbclienti")
        .select("id,ragione_sociale,cod_cliente").eq("studio_id",sid).eq("cliente",true).eq("attivo",true)
        .order("ragione_sociale");
      if(error) throw error;
      setClienti((data||[]) as Cliente[]);
    } finally { setLoading(false); }
  }

  async function loadTotali(){
    const supabase=getSupabaseClient();
    let q=(supabase as any).from("tbcespiti")
      .select("id,costo_originario,fondo_civilistico_iniziale").eq("studio_id",studioId);
    if(clienteId) q=q.eq("cliente_id",clienteId);
    const {data,error}=await q;
    if(error){ setTotali({cespiti:0,costo:0,fondo:0,netto:0}); return; }
    const rows=data||[];
    const costo=rows.reduce((s:any,r:any)=>s+Number(r.costo_originario||0),0);
    const fondo=rows.reduce((s:any,r:any)=>s+Number(r.fondo_civilistico_iniziale||0),0);
    setTotali({cespiti:rows.length,costo,fondo,netto:costo-fondo});
  }

  const euro=(n:number)=>new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(n);

  return <div className="container mx-auto p-6 space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><h1 className="text-3xl font-bold">Cespiti e Ammortamenti</h1>
      <p className="text-muted-foreground">Gestione civilistica e fiscale integrata in Studio Manager Pro · esercizio {esercizio}</p></div>
      <div className="min-w-[320px]"><label className="text-sm font-medium">Società</label>
        <select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={clienteId} onChange={e=>setClienteId(e.target.value)}>
          <option value="">Tutte le società attive</option>
          {clienti.map(c=><option key={c.id} value={c.id}>{c.cod_cliente ? c.cod_cliente+" · " : ""}{c.ragione_sociale||"Senza denominazione"}</option>)}
        </select>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Cespiti</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{loading?"—":totali.cespiti}</div></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Costo storico</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{euro(totali.costo)}</div></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Fondo iniziale</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{euro(totali.fondo)}</div></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Valore netto</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{euro(totali.netto)}</div></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Gestione</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      <Button variant="outline" className="h-24 flex-col gap-2" onClick={()=>router.push("/cespiti/categorie")}><FolderTree/>Categorie</Button>
      <Button variant="outline" className="h-24 flex-col gap-2" onClick={()=>router.push("/cespiti/elenco")}><PackageOpen/>Cespiti</Button>
      <Button variant="outline" className="h-24 flex-col gap-2" onClick={()=>router.push("/cespiti/movimenti")}><TrendingDown/>Movimenti</Button>
      <Button variant="outline" className="h-24 flex-col gap-2" onClick={()=>router.push("/cespiti/ammortamenti")}><Calculator/>Calcolo ammortamenti</Button>
      <Button variant="outline" className="h-24 flex-col gap-2" onClick={()=>router.push("/cespiti/registro")}><ReceiptText/>Registro cespiti</Button>\n      <Button variant="outline" className="h-24 flex-col gap-2" onClick={()=>router.push("/cespiti/scritture")}><BookOpen/>Scritture contabili</Button>
    </CardContent></Card>

    <Card><CardContent className="pt-6 text-sm text-muted-foreground">
      Le aliquote fiscali restano parametrizzabili per categoria. I risultati annuali saranno storicizzati per cespite prima della chiusura dell'esercizio, mantenendo separati valori civilistici e fiscali.
    </CardContent></Card>
  </div>;
}

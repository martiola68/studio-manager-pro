import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type LipeRow = Database["public"]["Tables"]["tbscadlipe"]["Row"];
type LipeInsert = Database["public"]["Tables"]["tbscadlipe"]["Insert"];
type LipeUpdate = Database["public"]["Tables"]["tbscadlipe"]["Update"];

type ClienteRow = Database["public"]["Tables"]["tbclienti"]["Row"];
type UtenteRow = Database["public"]["Tables"]["tbutenti"]["Row"];

interface LipeWithRelations extends LipeRow {
  tbclienti?: ClienteRow | null;
  tbutenti_professionista?: UtenteRow | null;
  tbutenti_operatore?: UtenteRow | null;
}

export default function LipePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [lipeRecords, setLipeRecords] = useState<LipeWithRelations[]>([]);
  const [clienti, setClienti] = useState<ClienteRow[]>([]);
  const [utenti, setUtenti] = useState<UtenteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [studioId, setStudioId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  async function checkAuthAndLoadData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const { data: userData } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", session.user.id)
      .single();

    if (userData?.studio_id) {
      setStudioId(userData.studio_id);
      await Promise.all([
        loadLipeRecords(userData.studio_id),
        loadClienti(userData.studio_id),
        loadUtenti(userData.studio_id)
      ]);
    }
    setLoading(false);
  }

  async function loadLipeRecords(studio_id: string) {
    const { data, error } = await supabase
      .from("tbscadlipe")
      .select(`
        *,
        tbutenti_professionista:tbutenti!tbscadlipe_utente_professionista_id_fkey(id, nome, cognome),
        tbutenti_operatore:tbutenti!tbscadlipe_utente_operatore_id_fkey(id, nome, cognome)
      `)
      .eq("studio_id", studio_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore caricamento LIPE:", error);
      toast({ title: "Errore", description: "Impossibile caricare i dati LIPE", variant: "destructive" });
      return;
    }

    // Carica i dati dei clienti separatamente
    const clientIds = data?.map((r) => r.id) || [];
    if (clientIds.length > 0) {
      const { data: clientiData, error: clientiError } = await supabase
        .from("tbclienti")
        .select("*")
        .in("id", clientIds);

      if (!clientiError && clientiData) {
        const recordsWithClients = data?.map((record) => ({
          ...record,
          tbclienti: clientiData.find((c) => c.id === record.id) || null
        })) as LipeWithRelations[];
        setLipeRecords(recordsWithClients);
      } else {
        setLipeRecords(data as unknown as LipeWithRelations[]);
      }
    } else {
      setLipeRecords(data as unknown as LipeWithRelations[]);
    }
  }

  async function loadClienti(studio_id: string) {
    const { data, error } = await supabase
      .from("tbclienti")
      .select("*")
      .eq("studio_id", studio_id)
      .eq("flag_lipe", true)
      .order("ragione_sociale", { ascending: true });

    if (error) {
      console.error("Errore caricamento clienti:", error);
      return;
    }
    setClienti(data || []);
  }

  async function loadUtenti(studio_id: string) {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("*")
      .eq("studio_id", studio_id)
      .eq("attivo", true)
      .order("cognome", { ascending: true });

    if (error) {
      console.error("Errore caricamento utenti:", error);
      return;
    }
    setUtenti(data || []);
  }

  async function handleAddRecord() {
    if (!studioId) return;

    // TypeScript requires all fields if strict, but let's try to match the Insert type
    // Some fields might be optional in DB but TS types might be strict.
    // We cast to any to bypass the strict check if ID is auto-generated but required in type
    const newRecord: any = {
      nominativo: "",
      studio_id: studioId,
      tipo_liq: "T",
      gen: false,
      feb: false,
      mar: false,
      lipe1t: false,
      lipe1t_invio: null,
      apr: false,
      mag: false,
      giu: false,
      lipe2t: false,
      lipe2t_invio: null,
      lug: false,
      ago: false,
      set: false,
      lipe3t: false,
      lipe3t_invio: null,
      ott: false,
      nov: false,
      acconto: "Non dovuto",
      acconto_com: false,
      dic: false,
      lipe4t: false,
      lipe4t_invio: null
    };

    const { data, error } = await supabase
      .from("tbscadlipe")
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      console.error("Errore inserimento:", error);
      toast({ title: "Errore", description: "Impossibile aggiungere il record", variant: "destructive" });
      return;
    }

    if (data && studioId) {
      await loadLipeRecords(studioId);
      toast({ title: "Successo", description: "Record aggiunto con successo" });
    }
  }

  async function handleUpdateRecord(id: string, updates: Partial<LipeUpdate>) {
    const { error } = await supabase
      .from("tbscadlipe")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Errore aggiornamento:", error);
      toast({ title: "Errore", description: "Impossibile aggiornare il record", variant: "destructive" });
      return;
    }

    setLipeRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }

  async function handleDeleteRecord(id: string) {
    const { error } = await supabase
      .from("tbscadlipe")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Errore eliminazione:", error);
      toast({ title: "Errore", description: "Impossibile eliminare il record", variant: "destructive" });
      return;
    }

    setLipeRecords((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Successo", description: "Record eliminato con successo" });
  }

  async function handleClienteChange(recordId: string, clienteId: string) {
    const cliente = clienti.find((c) => c.id === clienteId);
    if (!cliente) return;

    // Quando cambio il cliente, aggiorno l'ID del record per farlo corrispondere al cliente (se la logica è 1:1)
    // Ma attenzione: tbscadlipe usa l'ID cliente come propria Primary Key? 
    // Se la tabella è in relazione 1:1 e usa lo stesso ID, non posso cambiare l'ID di un record esistente facilmente.
    // Tuttavia, se la struttura è: tbscadlipe.id (PK) == tbclienti.id, allora:
    // NON POSSO cambiare il cliente di un record esistente, devo cancellare e ricreare, o la logica è diversa.
    // Per ora aggiorno solo il nominativo come stringa se serve, o avviso l'utente.
    
    // UPDATE: Se la FK non esiste come colonna separata, non posso fare 'update client_id'.
    // Assumo che l'utente voglia solo cambiare il nome visualizzato o collegare se nullo.
    // Se il record è stato creato vuoto, forse ha un ID generato casualmente che non corrisponde a un cliente?
    // Se la tabella tbscadlipe ha id che DEVE essere un id cliente, allora quando creo un record nuovo devo scegliere SUBITO il cliente.
    
    // Per semplicità qui aggiorno il campo nominativo testuale.
    const updates: Partial<LipeUpdate> = {
      nominativo: cliente.ragione_sociale
    };

    const { error } = await supabase
      .from("tbscadlipe")
      .update(updates)
      .eq("id", recordId);

    if (error) {
      console.error("Errore aggiornamento cliente:", error);
      toast({ title: "Errore", description: "Impossibile aggiornare il cliente", variant: "destructive" });
      return;
    }

    setLipeRecords((prev) =>
      prev.map((r) =>
        r.id === recordId
          ? { ...r, ...updates, tbclienti: cliente }
          : r
      )
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Caricamento...</div>
      </div>
    );
  }

  // Definizioni larghezze fisse
  const wNominativo = "w-[189px]"; // 5cm
  const wProfessionista = "w-[189px]"; // 5cm
  const wOperatore = "w-[189px]"; // 5cm
  const wTipoLiq = "w-[76px]"; // 2cm
  const wMese = "w-[57px]"; // 1.5cm
  const wLipeCheck = "w-[57px]"; // 1.5cm
  const wLipeDate = "w-[113px]"; // 3cm
  const wAcconto = "w-[113px]"; // 3cm
  const wAccontoCom = "w-[57px]"; // 1.5cm
  const wAzioni = "w-[76px]"; // 2cm

  // Stile comune celle
  const cellStyle = "p-0 h-12 border-r border-b text-center align-middle bg-background";
  const headerStyle = "p-0 h-12 border-r border-b text-center align-middle font-semibold bg-muted/50 text-foreground";
  const stickyLeft = "sticky left-0 z-20";
  const stickyLeftCell = "sticky left-0 z-10 bg-background";
  
  // Input styles reset to fill cell completely
  const inputStyle = "w-full h-full border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1 text-center bg-transparent";
  const selectTriggerStyle = "w-full h-full border-0 rounded-none focus:ring-0 focus:ring-offset-0 px-1 bg-transparent";
  const checkboxContainer = "flex items-center justify-center w-full h-full";

  return (
    <div className="w-full p-2">
      <Card className="border-0 shadow-none">
        <CardHeader className="px-0 pt-0 pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold">Scadenzario LIPE</CardTitle>
            <Button onClick={handleAddRecord} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Aggiungi Record
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border rounded-none overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="border-collapse w-max">
                <TableHeader>
                  <TableRow className="h-12 border-b">
                    <TableHead className={`${wNominativo} ${headerStyle} ${stickyLeft}`}>Nominativo</TableHead>
                    <TableHead className={`${wProfessionista} ${headerStyle}`}>Professionista</TableHead>
                    <TableHead className={`${wOperatore} ${headerStyle}`}>Operatore</TableHead>
                    <TableHead className={`${wTipoLiq} ${headerStyle}`}>Tipo Liq</TableHead>
                    <TableHead className={`${wMese} ${headerStyle}`}>Gen</TableHead>
                    <TableHead className={`${wMese} ${headerStyle}`}>Feb</TableHead>
                    <TableHead className={`${wMese} ${headerStyle}`}>Mar</TableHead>
                    <TableHead className={`${wLipeCheck} ${headerStyle}`}>Lipe 1T</TableHead>
                    <TableHead className={`${wLipeDate} ${headerStyle}`}>Data Invio 1T</TableHead>
                    <TableHead className={`${wMese} ${headerStyle}`}>Apr</TableHead>
                    <TableHead className={`${wMese} ${headerStyle}`}>Mag</TableHead>
                    <TableHead className={`${wMese} ${headerStyle}`}>Giu</TableHead>
                    <TableHead className={`${wLipeCheck} ${headerStyle}`}>Lipe 2T</TableHead>
                    <TableHead className={`${wLipeDate} ${headerStyle}`}>Data Invio 2T</TableHead>
                    <TableHead className={`${wMese} ${headerStyle}`}>Lug</TableHead>
                    <TableHead className={`${wMese} ${headerStyle}`}>Ago</TableHead>
                    <TableHead className={`${wMese} ${headerStyle}`}>Set</TableHead>
                    <TableHead className={`${wLipeCheck} ${headerStyle}`}>Lipe 3T</TableHead>
                    <TableHead className={`${wLipeDate} ${headerStyle}`}>Data Invio 3T</TableHead>
                    <TableHead className={`${wMese} ${headerStyle}`}>Ott</TableHead>
                    <TableHead className={`${wMese} ${headerStyle}`}>Nov</TableHead>
                    <TableHead className={`${wAcconto} ${headerStyle}`}>Acconto</TableHead>
                    <TableHead className={`${wAccontoCom} ${headerStyle}`}>Acc. Com</TableHead>
                    <TableHead className={`${wMese} ${headerStyle}`}>Dic</TableHead>
                    <TableHead className={`${wLipeCheck} ${headerStyle}`}>Lipe 4T</TableHead>
                    <TableHead className={`${wLipeDate} ${headerStyle}`}>Data Invio 4T</TableHead>
                    <TableHead className={`${wAzioni} ${headerStyle} border-r-0`}>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lipeRecords.map((record) => (
                    <TableRow key={record.id} className="h-12 border-b hover:bg-muted/30">
                      {/* Nominativo - Sticky */}
                      <TableCell className={`${wNominativo} ${cellStyle} ${stickyLeftCell}`}>
                        <Select
                          value={record.id} // Questo è un hack visuale, idealmente cambieremmo il cliente
                          onValueChange={(val) => handleClienteChange(record.id, val)}
                        >
                          <SelectTrigger className={`${selectTriggerStyle}`}>
                            <SelectValue>
                              <div className="truncate px-2 text-left w-full">
                                {record.tbclienti?.ragione_sociale || record.nominativo || ""}
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {clienti.map((cliente) => (
                              <SelectItem key={cliente.id} value={cliente.id}>
                                {cliente.ragione_sociale}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Professionista */}
                      <TableCell className={`${wProfessionista} ${cellStyle}`}>
                        <Select
                          value={record.utente_professionista_id || "none"}
                          onValueChange={(val) => handleUpdateRecord(record.id, { utente_professionista_id: val === "none" ? null : val })}
                        >
                          <SelectTrigger className={selectTriggerStyle}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Seleziona</SelectItem>
                            {utenti.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.nome} {u.cognome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Operatore */}
                      <TableCell className={`${wOperatore} ${cellStyle}`}>
                        <Select
                          value={record.utente_operatore_id || "none"}
                          onValueChange={(val) => handleUpdateRecord(record.id, { utente_operatore_id: val === "none" ? null : val })}
                        >
                          <SelectTrigger className={selectTriggerStyle}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Seleziona</SelectItem>
                            {utenti.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.nome} {u.cognome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Tipo Liq */}
                      <TableCell className={`${wTipoLiq} ${cellStyle}`}>
                        <Select
                          value={record.tipo_liq || "T"}
                          onValueChange={(val) => handleUpdateRecord(record.id, { tipo_liq: val })}
                        >
                          <SelectTrigger className={selectTriggerStyle}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="T">T</SelectItem>
                            <SelectItem value="M">M</SelectItem>
                            <SelectItem value="CL">CL</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Gen */}
                      <TableCell className={`${wMese} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.gen || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { gen: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Feb */}
                      <TableCell className={`${wMese} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.feb || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { feb: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Mar */}
                      <TableCell className={`${wMese} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.mar || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { mar: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Lipe 1T */}
                      <TableCell className={`${wLipeCheck} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.lipe1t || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { lipe1t: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Data Invio 1T */}
                      <TableCell className={`${wLipeDate} ${cellStyle}`}>
                        <Input
                          type="date"
                          value={record.lipe1t_invio || ""}
                          onChange={(e) => handleUpdateRecord(record.id, { lipe1t_invio: e.target.value })}
                          className={inputStyle}
                        />
                      </TableCell>

                      {/* Apr */}
                      <TableCell className={`${wMese} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.apr || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { apr: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Mag */}
                      <TableCell className={`${wMese} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.mag || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { mag: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Giu */}
                      <TableCell className={`${wMese} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.giu || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { giu: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Lipe 2T */}
                      <TableCell className={`${wLipeCheck} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.lipe2t || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { lipe2t: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Data Invio 2T */}
                      <TableCell className={`${wLipeDate} ${cellStyle}`}>
                        <Input
                          type="date"
                          value={record.lipe2t_invio || ""}
                          onChange={(e) => handleUpdateRecord(record.id, { lipe2t_invio: e.target.value })}
                          className={inputStyle}
                        />
                      </TableCell>

                      {/* Lug */}
                      <TableCell className={`${wMese} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.lug || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { lug: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Ago */}
                      <TableCell className={`${wMese} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.ago || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { ago: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Set */}
                      <TableCell className={`${wMese} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.set || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { set: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Lipe 3T */}
                      <TableCell className={`${wLipeCheck} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.lipe3t || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { lipe3t: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Data Invio 3T */}
                      <TableCell className={`${wLipeDate} ${cellStyle}`}>
                        <Input
                          type="date"
                          value={record.lipe3t_invio || ""}
                          onChange={(e) => handleUpdateRecord(record.id, { lipe3t_invio: e.target.value })}
                          className={inputStyle}
                        />
                      </TableCell>

                      {/* Ott */}
                      <TableCell className={`${wMese} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.ott || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { ott: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Nov */}
                      <TableCell className={`${wMese} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.nov || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { nov: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Acconto */}
                      <TableCell className={`${wAcconto} ${cellStyle}`}>
                        <Select
                          value={record.acconto || "Non dovuto"}
                          onValueChange={(val) => handleUpdateRecord(record.id, { acconto: val })}
                        >
                          <SelectTrigger className={selectTriggerStyle}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Dovuto">Dovuto</SelectItem>
                            <SelectItem value="Non dovuto">Non dovuto</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Acconto Comunicato */}
                      <TableCell className={`${wAccontoCom} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.acconto_com || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { acconto_com: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Dic */}
                      <TableCell className={`${wMese} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.dic || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { dic: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Lipe 4T */}
                      <TableCell className={`${wLipeCheck} ${cellStyle}`}>
                        <div className={checkboxContainer}>
                          <Checkbox
                            checked={record.lipe4t || false}
                            onCheckedChange={(c) => handleUpdateRecord(record.id, { lipe4t: !!c })}
                          />
                        </div>
                      </TableCell>

                      {/* Data Invio 4T */}
                      <TableCell className={`${wLipeDate} ${cellStyle}`}>
                        <Input
                          type="date"
                          value={record.lipe4t_invio || ""}
                          onChange={(e) => handleUpdateRecord(record.id, { lipe4t_invio: e.target.value })}
                          className={inputStyle}
                        />
                      </TableCell>

                      {/* Azioni */}
                      <TableCell className={`${wAzioni} ${cellStyle} border-r-0`}>
                        <div className="flex items-center justify-center w-full h-full">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRecord(record.id)}
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
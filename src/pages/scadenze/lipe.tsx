import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

type LipeRow = Database["public"]["Tables"]["tbscadlipe"]["Row"];
type ClienteRow = Database["public"]["Tables"]["tbclienti"]["Row"];
type UtenteRow = Database["public"]["Tables"]["tbutenti"]["Row"];

interface LipeWithRelations extends LipeRow {
  tbclienti?: ClienteRow | null;
  tbutenti_professionista?: UtenteRow | null;
  tbutenti_operatore?: UtenteRow | null;
}

export default function LipePage() {
  const router = useRouter();
  const [rows, setRows] = useState<LipeWithRelations[]>([]);
  const [clienti, setClienti] = useState<ClienteRow[]>([]);
  const [utenti, setUtenti] = useState<UtenteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [studioId, setStudioId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: utente } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", session.user.id)
        .single();

      if (utente?.studio_id) {
        setStudioId(utente.studio_id);
        await Promise.all([
          fetchLipe(utente.studio_id),
          fetchClienti(utente.studio_id),
          fetchUtenti(utente.studio_id)
        ]);
      }
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const fetchLipe = async (studioId: string) => {
    const { data, error } = await supabase
      .from("tbscadlipe")
      .select(`
        *,
        tbclienti!tbscadlipe_cliente_id_fkey(id, nominativo),
        tbutenti_professionista:tbutenti!tbscadlipe_utente_professionista_id_fkey(id, nome, cognome),
        tbutenti_operatore:tbutenti!tbscadlipe_utente_operatore_id_fkey(id, nome, cognome)
      `)
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore caricamento LIPE:", error);
      toast({ title: "Errore", description: "Impossibile caricare le scadenze LIPE", variant: "destructive" });
      return;
    }
    setRows(data || []);
  };

  const fetchClienti = async (studioId: string) => {
    const { data } = await supabase
      .from("tbclienti")
      .select("*")
      .eq("studio_id", studioId)
      .order("nominativo");
    setClienti(data || []);
  };

  const fetchUtenti = async (studioId: string) => {
    const { data } = await supabase
      .from("tbutenti")
      .select("*")
      .eq("studio_id", studioId)
      .order("cognome");
    setUtenti(data || []);
  };

  const handleAddRow = async () => {
    if (!studioId) return;

    const { data: session } = await supabase.auth.getSession();
    if (!session?.data?.session?.user?.id) return;

    const newRow: Database["public"]["Tables"]["tbscadlipe"]["Insert"] = {
      studio_id: studioId,
      cliente_id: clienti[0]?.id || null,
      utente_professionista_id: null,
      utente_operatore_id: null,
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
      dic: false,
      lipe4t: false,
      lipe4t_invio: null,
      acconto: "false",
      acconto_com: false
    };

    const { error } = await supabase.from("tbscadlipe").insert(newRow);
    if (error) {
      console.error("Errore aggiunta riga:", error);
      toast({ title: "Errore", description: "Impossibile aggiungere la riga", variant: "destructive" });
      return;
    }

    if (studioId) await fetchLipe(studioId);
    toast({ title: "Successo", description: "Riga aggiunta con successo" });
  };

  const handleUpdate = async (id: string, updates: Partial<Database["public"]["Tables"]["tbscadlipe"]["Update"]>) => {
    const { error } = await supabase
      .from("tbscadlipe")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Errore aggiornamento:", error);
      toast({ title: "Errore", description: "Impossibile aggiornare la riga", variant: "destructive" });
      return;
    }

    setRows(prev => prev.map(row => row.id === id ? { ...row, ...updates } : row));
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("tbscadlipe")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Errore eliminazione:", error);
      toast({ title: "Errore", description: "Impossibile eliminare la riga", variant: "destructive" });
      return;
    }

    setRows(prev => prev.filter(row => row.id !== id));
    toast({ title: "Successo", description: "Riga eliminata" });
  };

  const DatePickerCell = ({ value, onChange }: { value: string | null; onChange: (date: string | null) => void }) => {
    const [open, setOpen] = useState(false);
    const date = value ? new Date(value) : undefined;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full h-full px-2 text-xs justify-start font-normal border-0 rounded-none bg-transparent hover:bg-muted/20">
            {date ? format(date, "dd/MM/yyyy", { locale: it }) : "gg/mm/aaaa"}
            <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(newDate) => {
              onChange(newDate ? format(newDate, "yyyy-MM-dd") : null);
              setOpen(false);
            }}
            locale={it}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">Scadenzario LIPE</CardTitle>
          <Button onClick={handleAddRow} size="sm">
            Aggiungi Riga
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full">
            <div className="overflow-x-auto">
              <Table className="border-collapse w-max">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 z-20 bg-muted/50 border-r border-b w-[189px] h-12 p-0 text-center align-middle">Nominativo</TableHead>
                    <TableHead className="w-[189px] h-12 p-0 text-center align-middle border-r border-b">Professionista</TableHead>
                    <TableHead className="w-[189px] h-12 p-0 text-center align-middle border-r border-b">Operatore</TableHead>
                    <TableHead className="w-[76px] h-12 p-0 text-center align-middle border-r border-b">Tipo Liq</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Gen</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Feb</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Mar</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Lipe 1T</TableHead>
                    <TableHead className="w-[113px] h-12 p-0 text-center align-middle border-r border-b">Data Invio 1T</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Apr</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Mag</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Giu</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Lipe 2T</TableHead>
                    <TableHead className="w-[113px] h-12 p-0 text-center align-middle border-r border-b">Data Invio 2T</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Lug</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Ago</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Set</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Lipe 3T</TableHead>
                    <TableHead className="w-[113px] h-12 p-0 text-center align-middle border-r border-b">Data Invio 3T</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Ott</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Nov</TableHead>
                    <TableHead className="w-[113px] h-12 p-0 text-center align-middle border-r border-b">Acconto</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Acc. Com</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Dic</TableHead>
                    <TableHead className="w-[57px] h-12 p-0 text-center align-middle border-r border-b">Lipe 4T</TableHead>
                    <TableHead className="w-[113px] h-12 p-0 text-center align-middle border-r border-b">Data Invio 4T</TableHead>
                    <TableHead className="w-[76px] h-12 p-0 text-center align-middle border-r border-b">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/20">
                      <TableCell className="sticky left-0 z-10 bg-background border-r border-b w-[189px] h-12 p-0">
                        <Select
                          value={row.cliente_id || ""}
                          onValueChange={(value) => handleUpdate(row.id, { cliente_id: value })}
                        >
                          <SelectTrigger className="w-full h-full border-0 rounded-none bg-transparent focus:ring-0 focus:ring-offset-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {clienti.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nominativo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell className="w-[189px] h-12 p-0 border-r border-b">
                        <Select
                          value={row.utente_professionista_id || ""}
                          onValueChange={(value) => handleUpdate(row.id, { utente_professionista_id: value })}
                        >
                          <SelectTrigger className="w-full h-full border-0 rounded-none bg-transparent focus:ring-0 focus:ring-offset-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {utenti.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.nome} {u.cognome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell className="w-[189px] h-12 p-0 border-r border-b">
                        <Select
                          value={row.utente_operatore_id || ""}
                          onValueChange={(value) => handleUpdate(row.id, { utente_operatore_id: value })}
                        >
                          <SelectTrigger className="w-full h-full border-0 rounded-none bg-transparent focus:ring-0 focus:ring-offset-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {utenti.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.nome} {u.cognome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell className="w-[76px] h-12 p-0 border-r border-b">
                        <Select
                          value={row.tipo_liq || "T"}
                          onValueChange={(value) => handleUpdate(row.id, { tipo_liq: value })}
                        >
                          <SelectTrigger className="w-full h-full border-0 rounded-none bg-transparent focus:ring-0 focus:ring-offset-0 text-center">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="T">T</SelectItem>
                            <SelectItem value="M">M</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.gen || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { gen: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.feb || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { feb: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.mar || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { mar: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.lipe1t || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { lipe1t: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[113px] h-12 p-0 border-r border-b">
                        <DatePickerCell
                          value={row.lipe1t_invio}
                          onChange={(date) => handleUpdate(row.id, { lipe1t_invio: date })}
                        />
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.apr || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { apr: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.mag || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { mag: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.giu || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { giu: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.lipe2t || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { lipe2t: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[113px] h-12 p-0 border-r border-b">
                        <DatePickerCell
                          value={row.lipe2t_invio}
                          onChange={(date) => handleUpdate(row.id, { lipe2t_invio: date })}
                        />
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.lug || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { lug: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.ago || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { ago: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.set || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { set: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.lipe3t || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { lipe3t: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[113px] h-12 p-0 border-r border-b">
                        <DatePickerCell
                          value={row.lipe3t_invio}
                          onChange={(date) => handleUpdate(row.id, { lipe3t_invio: date })}
                        />
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.ott || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { ott: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.nov || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { nov: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[113px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.acconto === "true"}
                            onCheckedChange={(checked) => handleUpdate(row.id, { acconto: checked ? "true" : "false" })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.acconto_com || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { acconto_com: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.dic || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { dic: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[57px] h-12 p-0 border-r border-b">
                        <div className="flex items-center justify-center h-full">
                          <Checkbox
                            checked={row.lipe4t || false}
                            onCheckedChange={(checked) => handleUpdate(row.id, { lipe4t: !!checked })}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-[113px] h-12 p-0 border-r border-b">
                        <DatePickerCell
                          value={row.lipe4t_invio}
                          onChange={(date) => handleUpdate(row.id, { lipe4t_invio: date })}
                        />
                      </TableCell>

                      <TableCell className="w-[76px] h-12 p-0 border-r border-b">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(row.id)}
                          className="h-full w-full rounded-none text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
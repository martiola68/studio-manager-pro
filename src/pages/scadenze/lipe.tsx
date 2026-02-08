import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

interface LipeRecord {
  id: string;
  gen: boolean;
  feb: boolean;
  mar: boolean;
  apr: boolean;
  mag: boolean;
  giu: boolean;
  lug: boolean;
  ago: boolean;
  set: boolean;
  ott: boolean;
  nov: boolean;
  dic: boolean;
  lipe1t: boolean;
  lipe2t: boolean;
  lipe3t: boolean;
  lipe4t: boolean;
  utente_operatore_id: string | null;
  utente_professionista_id: string | null;
  studio_id: string;
  tbclienti: {
    ragione_sociale: string;
    codice_fiscale: string | null;
  } | null;
}

export default function Lipe() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [lipeRecords, setLipeRecords] = useState<LipeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [operatoreFilter, setOperatoreFilter] = useState<string>("all");
  const [professionistaFilter, setProfessionistaFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [operatori, setOperatori] = useState<any[]>([]);
  const [professionisti, setProfessionisti] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totale: 0,
    inviate: 0,
    daCompletare: 0,
  });

  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    loadUserAndData();
  }, [currentPage, operatoreFilter, professionistaFilter, searchQuery]);

  async function loadUserAndData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: userData } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", session.user.id)
      .single();

    if (userData?.studio_id) {
      await Promise.all([
        loadLipeRecords(userData.studio_id),
        loadStats(userData.studio_id),
        loadOperatori(userData.studio_id),
        loadProfessionisti(userData.studio_id),
      ]);
    }
  }

  async function loadLipeRecords(studioId: string) {
    setLoading(true);
    try {
      // Query con JOIN su tbclienti per recuperare ragione_sociale
      let query = supabase
        .from("tbscadlipe")
        .select(`
          *,
          tbclienti!inner (
            ragione_sociale,
            codice_fiscale
          )
        `, { count: "exact" })
        .eq("studio_id", studioId);

      // Filtro sulla tabella collegata tbclienti
      if (searchQuery) {
        query = query.ilike("tbclienti.ragione_sociale", `%${searchQuery}%`);
      }

      if (operatoreFilter !== "all") {
        query = query.eq("utente_operatore_id", operatoreFilter);
      }

      if (professionistaFilter !== "all") {
        query = query.eq("utente_professionista_id", professionistaFilter);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Ordinamento sulla tabella collegata
      const { data, error, count } = await query
        .order("ragione_sociale", { foreignTable: "tbclienti", ascending: true })
        .range(from, to);

      if (error) throw error;

      setLipeRecords(data || []);
      setTotalRecords(count || 0);
      setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));
    } catch (error) {
      console.error("Errore caricamento LIPE:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati LIPE",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(studioId: string) {
    try {
      const { data, error } = await supabase
        .from("tbscadlipe")
        .select("*")
        .eq("studio_id", studioId);

      if (error) throw error;

      const totale = data?.length || 0;
      const inviate = data?.filter(r => r.lipe1t && r.lipe2t && r.lipe3t && r.lipe4t).length || 0;
      const daCompletare = totale - inviate;

      setStats({ totale, inviate, daCompletare });
    } catch (error) {
      console.error("Errore caricamento stats:", error);
    }
  }

  async function loadOperatori(studioId: string) {
    try {
      const { data, error } = await supabase
        .from("tbutenti")
        .select("id, nome, cognome")
        .eq("studio_id", studioId)
        .eq("ruolo", "operatore")
        .order("cognome");

      if (error) throw error;
      setOperatori(data || []);
    } catch (error) {
      console.error("Errore caricamento operatori:", error);
    }
  }

  async function loadProfessionisti(studioId: string) {
    try {
      const { data, error } = await supabase
        .from("tbutenti")
        .select("id, nome, cognome")
        .eq("studio_id", studioId)
        .eq("ruolo", "professionista")
        .order("cognome");

      if (error) throw error;
      setProfessionisti(data || []);
    } catch (error) {
      console.error("Errore caricamento professionisti:", error);
    }
  }

  async function handleCheckboxChange(recordId: string, field: keyof LipeRecord, value: boolean) {
    try {
      const { error } = await supabase
        .from("tbscadlipe")
        .update({ [field]: value })
        .eq("id", recordId);

      if (error) throw error;

      setLipeRecords(prev =>
        prev.map(r => r.id === recordId ? { ...r, [field]: value } : r)
      );

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: userData } = await supabase
          .from("tbutenti")
          .select("studio_id")
          .eq("id", session.user.id)
          .single();

        if (userData?.studio_id) {
          loadStats(userData.studio_id);
        }
      }
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il dato",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="text-sm font-medium text-muted-foreground">Totale Dichiarazioni</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totale}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="text-sm font-medium text-muted-foreground">Inviate</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.inviate}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="text-sm font-medium text-muted-foreground">Da Completare</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.daCompletare}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Gestione LIPE</h2>
            <div className="text-sm text-muted-foreground">
              Pagina {currentPage} di {totalPages} - {totalRecords} dichiarazioni
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Input
              placeholder="Cerca per Ragione Sociale..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="max-w-xs"
            />

            <Select value={operatoreFilter} onValueChange={(value) => {
              setOperatoreFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtra per operatore" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli operatori</SelectItem>
                {operatori.map(op => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.cognome} {op.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={professionistaFilter} onValueChange={(value) => {
              setProfessionistaFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtra per professionista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i professionisti</SelectItem>
                {professionisti.map(prof => (
                  <SelectItem key={prof.id} value={prof.id}>
                    {prof.cognome} {prof.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Ragione Sociale</TableHead>
                  <TableHead className="min-w-[120px]">Codice Fiscale</TableHead>
                  <TableHead className="text-center">Gen</TableHead>
                  <TableHead className="text-center">Feb</TableHead>
                  <TableHead className="text-center">Mar</TableHead>
                  <TableHead className="text-center">Apr</TableHead>
                  <TableHead className="text-center">Mag</TableHead>
                  <TableHead className="text-center">Giu</TableHead>
                  <TableHead className="text-center">Lug</TableHead>
                  <TableHead className="text-center">Ago</TableHead>
                  <TableHead className="text-center">Set</TableHead>
                  <TableHead className="text-center">Ott</TableHead>
                  <TableHead className="text-center">Nov</TableHead>
                  <TableHead className="text-center">Dic</TableHead>
                  <TableHead className="text-center">1° Trim</TableHead>
                  <TableHead className="text-center">2° Trim</TableHead>
                  <TableHead className="text-center">3° Trim</TableHead>
                  <TableHead className="text-center">4° Trim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={18} className="text-center py-8">
                      Caricamento in corso...
                    </TableCell>
                  </TableRow>
                ) : lipeRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={18} className="text-center py-8 text-muted-foreground">
                      Nessuna dichiarazione trovata
                    </TableCell>
                  </TableRow>
                ) : (
                  lipeRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.tbclienti?.ragione_sociale || "N/A"}</TableCell>
                      <TableCell>{record.tbclienti?.codice_fiscale || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.gen}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "gen", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.feb}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "feb", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.mar}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "mar", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.apr}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "apr", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.mag}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "mag", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.giu}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "giu", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.lug}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "lug", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.ago}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "ago", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.set}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "set", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.ott}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "ott", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.nov}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "nov", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.dic}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "dic", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.lipe1t}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "lipe1t", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.lipe2t}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "lipe2t", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.lipe3t}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "lipe3t", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.lipe4t}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "lipe4t", checked as boolean)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber = i + 1;
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNumber)}
                        isActive={currentPage === pageNumber}
                        className="cursor-pointer"
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
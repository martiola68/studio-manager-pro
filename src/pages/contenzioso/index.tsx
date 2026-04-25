import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit } from "lucide-react";

type Scadenza = {
  id: string;
  cliente_id: string;
  tipo_atto_id: string;
  numero_atto: string | null;
  tipo_atto_dettaglio: string | null;
  anno_riferimento: number | null;
  data_ricezione: string | null;
  data_scadenza: string | null;
  contestazione: string | null;
  responso: string | null;
  fare_ricorso: boolean | null;
  tbclienti?: { id: string; ragione_sociale: string | null } | null;
  tbcontenzioso_tipi_atto?: {
    id: string;
    descrizione: string;
    giorni_scadenza: number;
  } | null;
};

type TipoAtto = {
  id: string;
  descrizione: string;
};

export default function ContenziosoIndexPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<Scadenza[]>([]);
  const [tipiAtto, setTipiAtto] = useState<TipoAtto[]>([]);

  const [search, setSearch] = useState("");
const [archivioFiltro, setArchivioFiltro] = useState("avvisi");
const [tipoFiltro, setTipoFiltro] = useState("all");
const [statoFiltro, setStatoFiltro] = useState("all");
  
async function loadData() {
  const supabase = getSupabaseClient();

  try {
    setLoading(true);

    const tabella =
      archivioFiltro === "avvisi"
        ? "tbcontenzioso_avvisi_bonari"
        : "tbcontenzioso_esattoriale";

    const [tipiRes, scadenzeRes] = await Promise.all([
      (supabase as any)
        .from("tbcontenzioso_tipi_atto")
        .select("id, descrizione")
        .eq("attivo", true)
        .order("descrizione"),

      (supabase as any)
        .from(tabella)
        .select(
          `
          *,
          tbclienti:cliente_id(id, ragione_sociale),
          tbcontenzioso_tipi_atto:tipo_atto_id(id, descrizione, giorni_scadenza)
        `
        )
        .order("data_scadenza", { ascending: true }),
    ]);

    if (tipiRes.error) throw tipiRes.error;
    if (scadenzeRes.error) throw scadenzeRes.error;

    setTipiAtto(((tipiRes.data || []) as unknown) as TipoAtto[]);
    setScadenze(((scadenzeRes.data || []) as unknown) as Scadenza[]);
  } catch (error: any) {
    toast({
      title: "Errore",
      description: error?.message || "Impossibile caricare il contenzioso",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
}
  
useEffect(() => {
  void loadData();
}, [archivioFiltro]);

  function getStatoScadenza(dataScadenza?: string | null) {
    if (!dataScadenza) return "Senza scadenza";

    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    const scad = new Date(dataScadenza);
    scad.setHours(0, 0, 0, 0);

    if (scad < oggi) return "Scaduta";

    const diff = Math.ceil(
      (scad.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diff <= 15) return "In scadenza";

    return "Aperta";
  }

  function getBadgeVariant(stato: string) {
    if (stato === "Scaduta") return "destructive";
    if (stato === "In scadenza") return "destructive";
    if (stato === "Senza scadenza") return "secondary";
    return "default";
  }

  function getEditHref(row: Scadenza) {
    const tipo = row.tbcontenzioso_tipi_atto?.descrizione?.toLowerCase();

    if (tipo === "avviso bonario") {
      return `/contenzioso/avvisi-bonari/${row.id}`;
    }

    return `/contenzioso`;
  }

  const filtered = useMemo(() => {
    return scadenze.filter((row) => {
      const cliente = row.tbclienti?.ragione_sociale || "";
      const numero = row.numero_atto || "";
      const tipo = row.tbcontenzioso_tipi_atto?.descrizione || "";
      const stato = getStatoScadenza(row.data_scadenza);

      const searchOk =
        !search.trim() ||
        cliente.toLowerCase().includes(search.toLowerCase()) ||
        numero.toLowerCase().includes(search.toLowerCase()) ||
        tipo.toLowerCase().includes(search.toLowerCase());

      const tipoOk = tipoFiltro === "all" || row.tipo_atto_id === tipoFiltro;
      const statoOk = statoFiltro === "all" || stato === statoFiltro;

      return searchOk && tipoOk && statoOk;
    });
  }, [scadenze, search, tipoFiltro, statoFiltro]);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        Caricamento contenzioso...
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Contenzioso</h1>
          <p className="text-muted-foreground mt-1">
            Riepilogo generale scadenze contenzioso
          </p>
        </div>

<div className="flex gap-2">
 <Link href="/contenzioso/tipi-atto">
  <Button>
    <Plus className="mr-2 h-4 w-4" />
    Nuovo atto
  </Button>
</Link>

  <Link href="/contenzioso/avvisi-bonari/nuovo">
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      Nuovo avviso bonario
    </Button>
  </Link>
</div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtri</CardTitle>
        </CardHeader>
       <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
  <Select value={archivioFiltro} onValueChange={setArchivioFiltro}>
    <SelectTrigger>
      <SelectValue placeholder="Archivio" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="avvisi">Avvisi bonari</SelectItem>
      <SelectItem value="esattoriale">Accertamenti e cartelle</SelectItem>
    </SelectContent>
  </Select>

  <Input
            placeholder="Cerca cliente, numero atto, tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Select value={archivioFiltro} onValueChange={setArchivioFiltro}>
  <SelectTrigger>
    <SelectValue placeholder="Archivio" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="avvisi">Avvisi bonari</SelectItem>
    <SelectItem value="esattoriale">Accertamenti e cartelle</SelectItem>
  </SelectContent>
</Select>

          <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo atto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi atto</SelectItem>
              {tipiAtto.map((tipo) => (
                <SelectItem key={tipo.id} value={tipo.id}>
                  {tipo.descrizione}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statoFiltro} onValueChange={setStatoFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Stato scadenza" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="Aperta">Aperta</SelectItem>
              <SelectItem value="In scadenza">In scadenza</SelectItem>
              <SelectItem value="Scaduta">Scaduta</SelectItem>
              <SelectItem value="Senza scadenza">Senza scadenza</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Elenco scadenze</CardTitle>
        </CardHeader>

        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Nessuna scadenza trovata.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo atto</TableHead>
                    <TableHead>Numero atto</TableHead>
                    <TableHead>Dettaglio</TableHead>
                    <TableHead>Anno</TableHead>
                    <TableHead>Ricezione</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Contestazione</TableHead>
                    <TableHead>Responso</TableHead>
                    <TableHead>Ricorso</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filtered.map((row) => {
                    const stato = getStatoScadenza(row.data_scadenza);

                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          {row.tbclienti?.ragione_sociale || "-"}
                        </TableCell>
                        <TableCell>
                          {row.tbcontenzioso_tipi_atto?.descrizione || "-"}
                        </TableCell>
                        <TableCell>{row.numero_atto || "-"}</TableCell>
                        <TableCell>{row.tipo_atto_dettaglio || "-"}</TableCell>
                        <TableCell>{row.anno_riferimento || "-"}</TableCell>
                        <TableCell>{row.data_ricezione || "-"}</TableCell>
                        <TableCell>{row.data_scadenza || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(stato) as any}>
                            {stato}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.contestazione || "-"}</TableCell>
                        <TableCell>{row.responso || "-"}</TableCell>
                        <TableCell>{row.fare_ricorso ? "Sì" : "No"}</TableCell>
                        <TableCell className="text-right">
                          <Link href={getEditHref(row)}>
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

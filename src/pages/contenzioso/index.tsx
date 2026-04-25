import React, { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useStudio } from "@/contexts/StudioContext";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, Edit, Trash2 } from "lucide-react";

type Cliente = {
  id: string;
  ragione_sociale: string | null;
};

type TipoAtto = {
  id: string;
  descrizione: string;
  giorni_scadenza: number;
};

type Scadenza = {
  id: string;
  studio_id: string;
  cliente_id: string;
  tipo_atto_id: string;
  numero_atto: string | null;
  tipo_atto_dettaglio: string | null;
  anno_riferimento: number | null;
  data_emissione: string | null;
  data_ricezione: string | null;
  data_scadenza: string | null;
  motivazione: string | null;
  contestazione: string | null;
  tipo_contestazione: string | null;
  data_invio_contestazione: string | null;
  responso: string | null;
  comunicato_cliente: boolean | null;
  data_comunicazione: string | null;
  fare_ricorso: boolean | null;
  motivazione_ricorso: string | null;
  genera_scadenza_ricorso: boolean | null;
  allegato_atto: string | null;
  allegato_civis: string | null;
  allegato_responso: string | null;
  created_at: string | null;

  tbclienti?: Cliente | null;
  tbcontenzioso_tipi_atto?: TipoAtto | null;
};

type FormData = {
  cliente_id: string;
  tipo_atto_id: string;
  numero_atto: string;
  tipo_atto_dettaglio: string;
  anno_riferimento: string;
  data_emissione: string;
  data_ricezione: string;
  motivazione: string;
  contestazione: "NO" | "SI" | "PARZIALE";
  tipo_contestazione: string;
  data_invio_contestazione: string;
  responso: string;
  comunicato_cliente: boolean;
  data_comunicazione: string;
  fare_ricorso: boolean;
  motivazione_ricorso: string;
  genera_scadenza_ricorso: boolean;
};

const initialForm: FormData = {
  cliente_id: "",
  tipo_atto_id: "",
  numero_atto: "",
  tipo_atto_dettaglio: "",
  anno_riferimento: "",
  data_emissione: "",
  data_ricezione: "",
  motivazione: "",
  contestazione: "NO",
  tipo_contestazione: "",
  data_invio_contestazione: "",
  responso: "",
  comunicato_cliente: false,
  data_comunicazione: "",
  fare_ricorso: false,
  motivazione_ricorso: "",
  genera_scadenza_ricorso: false,
};

export default function ContenziosoPage() {
  const { studioId } = useStudio();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [tipiAtto, setTipiAtto] = useState<TipoAtto[]>([]);
  const [scadenze, setScadenze] = useState<Scadenza[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Scadenza | null>(null);
  const [formData, setFormData] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const tipoAttoSelezionato = useMemo(() => {
    return tipiAtto.find((t) => t.id === formData.tipo_atto_id) || null;
  }, [tipiAtto, formData.tipo_atto_id]);

  const dataScadenzaStimata = useMemo(() => {
    if (!formData.data_ricezione || !tipoAttoSelezionato) return "";

    const d = new Date(formData.data_ricezione);
    d.setDate(d.getDate() + Number(tipoAttoSelezionato.giorni_scadenza || 0));

    return d.toISOString().slice(0, 10);
  }, [formData.data_ricezione, tipoAttoSelezionato]);

  async function loadData() {
    const supabase = getSupabaseClient();

    try {
      setLoading(true);

      const [clientiRes, tipiRes, scadenzeRes] = await Promise.all([
        supabase
          .from("tbclienti")
          .select("id, ragione_sociale")
          .order("ragione_sociale"),

        supabase
          .from("tbcontenzioso_tipi_atto" as any)
          .select("id, descrizione, giorni_scadenza")
          .eq("attivo", true)
          .order("descrizione"),

        supabase
          .from("tbcontenzioso_scadenze" as any)
          .select(
            `
            *,
            tbclienti:cliente_id(id, ragione_sociale),
            tbcontenzioso_tipi_atto:tipo_atto_id(id, descrizione, giorni_scadenza)
          `
          )
          .order("data_scadenza", { ascending: true }),
      ]);

      if (clientiRes.error) throw clientiRes.error;
      if (tipiRes.error) throw tipiRes.error;
      if (scadenzeRes.error) throw scadenzeRes.error;

      setClienti((clientiRes.data || []) as Cliente[]);
      setTipiAtto((tipiRes.data || []) as TipoAtto[]);
      setScadenze((scadenzeRes.data || []) as Scadenza[]);
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
  }, []);

  function resetForm() {
    setEditing(null);
    setFormData(initialForm);
    setErrors({});
  }

  function handleNew() {
    resetForm();

    const avvisoBonario = tipiAtto.find(
      (t) => t.descrizione.toLowerCase() === "avviso bonario"
    );

    setFormData({
      ...initialForm,
      tipo_atto_id: avvisoBonario?.id || "",
    });

    setDialogOpen(true);
  }

  function handleEdit(row: Scadenza) {
    setEditing(row);

    setFormData({
      cliente_id: row.cliente_id || "",
      tipo_atto_id: row.tipo_atto_id || "",
      numero_atto: row.numero_atto || "",
      tipo_atto_dettaglio: row.tipo_atto_dettaglio || "",
      anno_riferimento: row.anno_riferimento ? String(row.anno_riferimento) : "",
      data_emissione: row.data_emissione || "",
      data_ricezione: row.data_ricezione || "",
      motivazione: row.motivazione || "",
      contestazione: (row.contestazione as "NO" | "SI" | "PARZIALE") || "NO",
      tipo_contestazione: row.tipo_contestazione || "",
      data_invio_contestazione: row.data_invio_contestazione || "",
      responso: row.responso || "",
      comunicato_cliente: !!row.comunicato_cliente,
      data_comunicazione: row.data_comunicazione || "",
      fare_ricorso: !!row.fare_ricorso,
      motivazione_ricorso: row.motivazione_ricorso || "",
      genera_scadenza_ricorso: !!row.genera_scadenza_ricorso,
    });

    setErrors({});
    setDialogOpen(true);
  }

  async function handleSave() {
    const newErrors: Record<string, boolean> = {};
    const missing: string[] = [];

    if (!studioId) {
      toast({
        title: "Errore",
        description: "Studio ID mancante",
        variant: "destructive",
      });
      return;
    }

    if (!formData.cliente_id) {
      newErrors.cliente_id = true;
      missing.push("Cliente");
    }

    if (!formData.tipo_atto_id) {
      newErrors.tipo_atto_id = true;
      missing.push("Tipo atto");
    }

    if (!formData.data_ricezione) {
      newErrors.data_ricezione = true;
      missing.push("Data ricezione");
    }

    if (missing.length > 0) {
      setErrors(newErrors);
      toast({
        title: "Campi obbligatori mancanti",
        description: missing.join(", "),
        variant: "destructive",
      });
      return;
    }

    const supabase = getSupabaseClient();

    const payload = {
      studio_id: studioId,
      cliente_id: formData.cliente_id,
      tipo_atto_id: formData.tipo_atto_id,
      numero_atto: formData.numero_atto || null,
      tipo_atto_dettaglio: formData.tipo_atto_dettaglio || null,
      anno_riferimento: formData.anno_riferimento
        ? Number(formData.anno_riferimento)
        : null,
      data_emissione: formData.data_emissione || null,
      data_ricezione: formData.data_ricezione,
      motivazione: formData.motivazione || null,
      contestazione: formData.contestazione,
      tipo_contestazione: formData.tipo_contestazione || null,
      data_invio_contestazione: formData.data_invio_contestazione || null,
      responso: formData.responso || null,
      comunicato_cliente: formData.comunicato_cliente,
      data_comunicazione: formData.data_comunicazione || null,
      fare_ricorso: formData.fare_ricorso,
      motivazione_ricorso: formData.motivazione_ricorso || null,
      genera_scadenza_ricorso: formData.genera_scadenza_ricorso,
    };

    try {
      if (editing) {
        const { error } = await supabase
          .from("tbcontenzioso_scadenze" as any)
          .update(payload)
          .eq("id", editing.id);

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Scadenza aggiornata",
        });
      } else {
        const { error } = await supabase
          .from("tbcontenzioso_scadenze" as any)
          .insert(payload);

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Scadenza creata",
        });
      }

      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error?.message || "Impossibile salvare",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminare questa scadenza?")) return;

    const supabase = getSupabaseClient();

    try {
      const { error } = await supabase
        .from("tbcontenzioso_scadenze" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Eliminato",
        description: "Scadenza eliminata",
      });

      await loadData();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error?.message || "Impossibile eliminare",
        variant: "destructive",
      });
    }
  }

  function statoScadenza(dataScadenza?: string | null) {
    if (!dataScadenza) return "secondary";

    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    const scad = new Date(dataScadenza);
    scad.setHours(0, 0, 0, 0);

    if (scad < oggi) return "destructive";

    const diff = Math.ceil(
      (scad.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diff <= 15) return "destructive";
    return "default";
  }

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
            Gestione scadenze, avvisi bonari e atti
          </p>
        </div>

        <Button onClick={handleNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuova scadenza
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scadenze contenzioso</CardTitle>
        </CardHeader>

        <CardContent>
          {scadenze.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nessuna scadenza presente.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo atto</TableHead>
                    <TableHead>Numero atto</TableHead>
                    <TableHead>Anno</TableHead>
                    <TableHead>Ricezione</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead>Contestazione</TableHead>
                    <TableHead>Responso</TableHead>
                    <TableHead>Ricorso</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {scadenze.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.tbclienti?.ragione_sociale || "-"}
                      </TableCell>
                      <TableCell>
                        {row.tbcontenzioso_tipi_atto?.descrizione || "-"}
                      </TableCell>
                      <TableCell>{row.numero_atto || "-"}</TableCell>
                      <TableCell>{row.anno_riferimento || "-"}</TableCell>
                      <TableCell>{row.data_ricezione || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={statoScadenza(row.data_scadenza) as any}>
                          {row.data_scadenza || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.contestazione || "-"}</TableCell>
                      <TableCell>{row.responso || "-"}</TableCell>
                      <TableCell>{row.fare_ricorso ? "Sì" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(row)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(row.id)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifica scadenza" : "Nuova scadenza contenzioso"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div>
              <Label>Cliente *</Label>
              <Select
                value={formData.cliente_id || ""}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, cliente_id: value }))
                }
              >
                <SelectTrigger className={errors.cliente_id ? "border-red-500" : ""}>
                  <SelectValue placeholder="Seleziona cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clienti.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.ragione_sociale || "-"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo atto *</Label>
              <Select
                value={formData.tipo_atto_id || ""}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, tipo_atto_id: value }))
                }
              >
                <SelectTrigger className={errors.tipo_atto_id ? "border-red-500" : ""}>
                  <SelectValue placeholder="Seleziona tipo atto" />
                </SelectTrigger>
                <SelectContent>
                  {tipiAtto.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.descrizione} ({t.giorni_scadenza} giorni)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Numero atto</Label>
              <Input
                value={formData.numero_atto}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, numero_atto: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Tipo atto dettaglio</Label>
              <Select
                value={formData.tipo_atto_dettaglio || ""}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, tipo_atto_dettaglio: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Redditi, IVA, 770..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Redditi">Redditi</SelectItem>
                  <SelectItem value="IVA">IVA</SelectItem>
                  <SelectItem value="770">770</SelectItem>
                  <SelectItem value="IRAP">IRAP</SelectItem>
                  <SelectItem value="Altro">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Anno riferimento</Label>
              <Input
                type="number"
                value={formData.anno_riferimento}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    anno_riferimento: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Data emissione</Label>
              <Input
                type="date"
                value={formData.data_emissione}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    data_emissione: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Data ricezione *</Label>
              <Input
                type="date"
                className={errors.data_ricezione ? "border-red-500" : ""}
                value={formData.data_ricezione}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    data_ricezione: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Data scadenza</Label>
              <Input value={dataScadenzaStimata} disabled />
            </div>

            <div className="md:col-span-2">
              <Label>Motivazione</Label>
              <Textarea
                value={formData.motivazione}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    motivazione: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            <div>
              <Label>Contestazione</Label>
              <Select
                value={formData.contestazione}
                onValueChange={(value: "NO" | "SI" | "PARZIALE") =>
                  setFormData((prev) => ({ ...prev, contestazione: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NO">No</SelectItem>
                  <SelectItem value="SI">Sì</SelectItem>
                  <SelectItem value="PARZIALE">Parziale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo contestazione</Label>
              <Select
                value={formData.tipo_contestazione || ""}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, tipo_contestazione: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Civis">Civis</SelectItem>
                  <SelectItem value="Autotutela ufficio">Autotutela ufficio</SelectItem>
                  <SelectItem value="PEC">PEC</SelectItem>
                  <SelectItem value="Altro">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data invio contestazione</Label>
              <Input
                type="date"
                value={formData.data_invio_contestazione}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    data_invio_contestazione: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Responso</Label>
              <Select
                value={formData.responso || ""}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, responso: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona responso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACCOLTA">Accolta</SelectItem>
                  <SelectItem value="RESPINTA">Respinta</SelectItem>
                  <SelectItem value="ACCOLTA PARZIALE">
                    Accolta parzialmente
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="comunicato_cliente"
                type="checkbox"
                checked={formData.comunicato_cliente}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    comunicato_cliente: e.target.checked,
                  }))
                }
              />
              <Label htmlFor="comunicato_cliente">Comunicato al cliente</Label>
            </div>

            <div>
              <Label>Data comunicazione</Label>
              <Input
                type="date"
                value={formData.data_comunicazione}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    data_comunicazione: e.target.value,
                  }))
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="fare_ricorso"
                type="checkbox"
                checked={formData.fare_ricorso}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    fare_ricorso: e.target.checked,
                  }))
                }
              />
              <Label htmlFor="fare_ricorso">Fare ricorso</Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="genera_scadenza_ricorso"
                type="checkbox"
                checked={formData.genera_scadenza_ricorso}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    genera_scadenza_ricorso: e.target.checked,
                  }))
                }
              />
              <Label htmlFor="genera_scadenza_ricorso">
                Genera scadenza ricorso
              </Label>
            </div>

            <div className="md:col-span-2">
              <Label>Motivazione ricorso</Label>
              <Textarea
                value={formData.motivazione_ricorso}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    motivazione_ricorso: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Annulla
            </Button>

            <Button type="button" onClick={handleSave}>
              {editing ? "Salva modifiche" : "Crea scadenza"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

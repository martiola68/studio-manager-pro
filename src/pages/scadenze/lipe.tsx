import { useEffect, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/router";
import type { Database } from "@/integrations/supabase/types";

type LipeRow = Database["public"]["Tables"]["tbscadlipe"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

type TipoLiqValue = "Mensile" | "Trimestrale" | "Esterna";

type LipeRecord = LipeRow & {
  nominativo: string;
  utente_professionista_id?: string | null;
  utente_operatore_id?: string | null;
  TipoLiq?: string | null;
  gen?: boolean | null;
  feb?: boolean | null;
  mar?: boolean | null;
  apr?: boolean | null;
  mag?: boolean | null;
  giu?: boolean | null;
  lug?: boolean | null;
  ago?: boolean | null;
  set?: boolean | null;
  ott?: boolean | null;
  nov?: boolean | null;
  dic?: boolean | null;
  lipe1t?: boolean | null;
  lipe1t_invio?: string | null;
  lipe2t?: boolean | null;
  lipe2t_invio?: string | null;
  lipe3t?: boolean | null;
  lipe3t_invio?: string | null;
  lipe4t?: boolean | null;
  lipe4t_invio?: string | null;
  acconto?: string | null;
  acconto_com?: boolean | null;

conferma_1_trimestre?: boolean | null;
conferma_2_trimestre?: boolean | null;
conferma_3_trimestre?: boolean | null;
conferma_4_trimestre?: boolean | null;
conferma_acconto_iva?: boolean | null;
  professionista?: string;
  operatore?: string;
  anno_riferimento?: number | null;
  archiviato?: boolean | null;
};

type CampoMese =
  | "gen"
  | "feb"
  | "mar"
  | "apr"
  | "mag"
  | "giu"
  | "lug"
  | "ago"
  | "set"
  | "ott"
  | "nov"
  | "dic";

const mesiDisabilitatiPerTipo: Record<TipoLiqValue, CampoMese[]> = {
  Mensile: [],
  Trimestrale: ["gen", "feb", "apr", "mag", "lug", "ago", "ott", "nov"],
  Esterna: ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"],
};

const baseHeaderClass =
  "h-9 px-2 text-center align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600";

const baseCellClass = "px-2 py-1 align-middle border-r border-slate-200";

const groupHeaderQ1 = "bg-slate-600";
const groupCellQ1 = "bg-sky-50";

const groupHeaderQ2 = "bg-slate-600";
const groupCellQ2 = "bg-emerald-50";

const groupHeaderQ3 = "bg-slate-600";
const groupCellQ3 = "bg-amber-50";

const groupHeaderQ4 = "bg-slate-600";
const groupCellQ4 = "bg-violet-50";

const isInvioMancante = (
  lipe: boolean | null | undefined,
  dataInvio: string | null | undefined
) => {
  return lipe === true && !dataInvio;
};

function BooleanSelect({
  value,
  disabled = false,
  onChange,
}: {
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <select
      value={value ? "SI" : "NO"}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === "SI")}
      className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    >
      <option value="NO">NO</option>
      <option value="SI">SI</option>
    </select>
  );
}

export default function ScadenzeLipePage() {
  const router = useRouter();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<LipeRecord[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterTipoLiq, setFilterTipoLiq] = useState("__all__");
  const [annoConsultazione, setAnnoConsultazione] = useState(currentYear);
  const [anniDisponibili, setAnniDisponibili] = useState<number[]>([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annoConsultazione]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [scadenzeData, utentiData] = await Promise.all([loadScadenze(), loadUtenti()]);
      setScadenze(scadenzeData);
      setUtenti(utentiData);
    } catch (error) {
      console.error("Errore caricamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadScadenze = async (): Promise<LipeRecord[]> => {
    const { data: anniData, error: anniError } = await supabase
      .from("tbscadlipe" as any)
      .select("anno_riferimento")
      .order("anno_riferimento", { ascending: true });

    if (anniError) throw anniError;

    const anni = Array.from(
      new Set(
        (((anniData ?? []) as any[]) || [])
          .map((r) => r.anno_riferimento)
          .filter((a): a is number => typeof a === "number")
      )
    ).sort((a, b) => a - b);

    setAnniDisponibili(anni);

    const annoDaUsare =
      anni.length > 0 && !anni.includes(annoConsultazione)
        ? anni[anni.length - 1]
        : annoConsultazione;

    if (annoDaUsare !== annoConsultazione) {
      setAnnoConsultazione(annoDaUsare);
    }

    const { data, error } = await supabase
      .from("tbscadlipe" as any)
      .select(`
        *,
        professionista:tbutenti!tbscadlipe_utente_professionista_id_fkey(nome, cognome),
        operatore:tbutenti!tbscadlipe_utente_operatore_id_fkey(nome, cognome)
      `)
      .eq("anno_riferimento", annoDaUsare)
      .order("nominativo", { ascending: true });

    if (error) throw error;

    return ((data || []) as any[]).map((record) => ({
      ...record,
      professionista: record.professionista
        ? `${record.professionista.nome} ${record.professionista.cognome}`
        : "-",
      operatore: record.operatore
        ? `${record.operatore.nome} ${record.operatore.cognome}`
        : "-",
    })) as LipeRecord[];
  };

  const loadUtenti = async (): Promise<Utente[]> => {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("*")
      .order("nome", { ascending: true }).order("cognome", { ascending: true });

    if (error) throw error;
    return data || [];
  };

  const getTipoLiq = (record: LipeRecord): TipoLiqValue => {
    const value = record.TipoLiq;
    if (value === "Trimestrale" || value === "Esterna") return value;
    return "Mensile";
  };

  const isMonthDisabled = (record: LipeRecord, month: CampoMese) => {
    const tipo = getTipoLiq(record);
    return mesiDisabilitatiPerTipo[tipo].includes(month);
  };

  const handleToggleField = async (
    recordId: string,
    field: keyof LipeRecord,
    currentValue: boolean | null
  ) => {
    try {
      const record = scadenze.find((r) => r.id === recordId);

      if (
        record &&
        ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"].includes(
          field as string
        ) &&
        isMonthDisabled(record, field as CampoMese)
      ) {
        return;
      }

      const newValue = !currentValue;

      const { error } = await supabase
        .from("tbscadlipe")
        .update({ [field]: newValue })
        .eq("id", recordId);

      if (error) throw error;

      setScadenze((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, [field]: newValue } : r))
      );

      toast({
        title: "Aggiornato",
        description: `Campo ${field} aggiornato con successo`,
      });
    } catch (error) {
      console.error(`Errore aggiornamento ${field}:`, error);
      toast({
        title: "Errore",
        description: `Impossibile aggiornare ${field}`,
        variant: "destructive",
      });
    }
  };

  const handleUpdateValue = async (
    recordId: string,
    field: keyof LipeRecord,
    value: string
  ) => {
    try {
      const { error } = await supabase
        .from("tbscadlipe")
        .update({ [field]: value || null })
        .eq("id", recordId);

      if (error) throw error;

      setScadenze((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, [field]: value || null } : r))
      );

      toast({
        title: "Aggiornato",
        description: `Campo ${field} aggiornato con successo`,
      });
    } catch (error) {
      console.error(`Errore aggiornamento ${field}:`, error);
      toast({
        title: "Errore",
        description: `Impossibile aggiornare ${field}`,
        variant: "destructive",
      });
    }
  };

const handleDeleteRecord = async (
  recordId: string,
  nominativo: string
) => {
  if (
    !confirm(
      `Eliminare il record LIPE di "${nominativo}"?`
    )
  )
    return;

  try {
    const { error } = await supabase
      .from("tbscadlipe")
      .delete()
      .eq("id", recordId);

    if (error) throw error;

    setScadenze((prev) => prev.filter((r) => r.id !== recordId));

    toast({
      title: "Eliminato",
      description: "Record eliminato correttamente",
    });
  } catch (error) {
    console.error("Errore eliminazione record:", error);
    toast({
      title: "Errore",
      description: "Impossibile eliminare il record",
      variant: "destructive",
    });
  }
};
  
const filteredScadenze = scadenze.filter((s) => {
  const matchSearch = (s.nominativo || "")
    .toLowerCase()
    .includes(searchQuery.toLowerCase());

  const matchOperatore =
    filterOperatore === "__all__" || s.utente_operatore_id === filterOperatore;

  const tipoLiq = s.TipoLiq || "Mensile";
  const matchTipoLiq =
    filterTipoLiq === "__all__" || tipoLiq === filterTipoLiq;

  return matchSearch && matchOperatore && matchTipoLiq;
});

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Caricamento LIPE...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-slate-200/70 px-3 pb-3 pt-2">
      <div className="flex shrink-0 items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario Liquidazioni IVA e LIPE</h1>
          <p className="text-gray-500 mt-1">Gestione liquidazioni IVA periodiche e LIPE</p>
        </div>
      </div>

      <Card className="shrink-0 border border-sky-200 bg-slate-50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
 <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
  <div className="space-y-2">
    <label className="text-sm font-medium">Cerca Nominativo</label>
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        placeholder="Cerca per nominativo..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-9 border-slate-300 bg-white pl-10"
      />
    </div>
  </div>

  <div className="space-y-2">
    <label className="text-sm font-medium">Utente Operatore</label>
    <Select value={filterOperatore} onValueChange={setFilterOperatore}>
      <SelectTrigger className="h-9 border-slate-300 bg-white">
        <SelectValue placeholder="Tutti gli operatori" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">Tutti gli operatori</SelectItem>
        {utenti.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.nome} {u.cognome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  <div className="space-y-2">
    <label className="text-sm font-medium">Tipo liquidazione</label>
    <Select value={filterTipoLiq} onValueChange={setFilterTipoLiq}>
      <SelectTrigger className="h-9 border-slate-300 bg-white">
        <SelectValue placeholder="Tutti i tipi" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">Tutti i tipi</SelectItem>
        <SelectItem value="Mensile">Mensile</SelectItem>
        <SelectItem value="Trimestrale">Trimestrale</SelectItem>
        <SelectItem value="Esterna">Esterna</SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div className="space-y-2">
    <label className="text-sm font-medium">Anno consultazione</label>
    <Select
      value={annoConsultazione.toString()}
      onValueChange={(value) => setAnnoConsultazione(parseInt(value))}
    >
      <SelectTrigger className="h-9 border-slate-300 bg-white">
        <SelectValue placeholder="Seleziona anno" />
      </SelectTrigger>
      <SelectContent>
        {anniDisponibili.map((anno) => (
          <SelectItem key={anno} value={anno.toString()}>
            {anno}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
</div>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border border-sky-200 bg-slate-50 shadow-sm">
        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          <div className="h-full w-full overflow-auto">
            <table className="w-full caption-bottom text-sm border-collapse">
              <thead className="sticky top-0 z-30 bg-slate-600 text-white shadow-sm">
                <tr className="border-b border-slate-500">
                 <th className="sticky-col-header h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[300px] border-r border-slate-500 !bg-slate-600">
                  Nominativo
                  </th>
                    <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[180px] border-r border-slate-500 bg-slate-600">
                      Operatore
                    </th>
                  <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[170px] border-r border-slate-500 bg-slate-600">
                    Tipo liquidazione
                  </th>

                  <th className={`${baseHeaderClass} ${groupHeaderQ1} min-w-[60px]`}>Gen</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ1} min-w-[60px]`}>Feb</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ1} min-w-[60px]`}>Mar</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ1} min-w-[80px]`}>LIPE 1T</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ1} min-w-[140px]`}>Data Invio 1T</th>

                  <th className={`${baseHeaderClass} ${groupHeaderQ2} min-w-[60px]`}>Apr</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ2} min-w-[60px]`}>Mag</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ2} min-w-[60px]`}>Giu</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ2} min-w-[80px]`}>LIPE 2T</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ2} min-w-[140px]`}>Data Invio 2T</th>

                  <th className={`${baseHeaderClass} ${groupHeaderQ3} min-w-[60px]`}>Lug</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ3} min-w-[60px]`}>Ago</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ3} min-w-[60px]`}>Set</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ3} min-w-[80px]`}>LIPE 3T</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ3} min-w-[140px]`}>Data Invio 3T</th>

                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[60px]`}>Ott</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[60px]`}>Nov</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[60px]`}>Dic</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[120px]`}>Acconto</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[100px]`}>Acconto Com</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[80px]`}>LIPE 4T</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[140px]`}>
                    Data Invio 4T
                    </th>

                    <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[100px] border-r-0`}>
                        Azioni
                    </th>
                </tr>
              </thead>

              <tbody>
                {filteredScadenze.length === 0 ? (
                  <tr className="border-b border-gray-300">
                   <td colSpan={26} className="p-4 text-center text-gray-500">
                      Nessun record trovato
                    </td>
                  </tr>
                ) : (
                  filteredScadenze.map((scadenza) => (
                    <tr key={scadenza.id} className="border-b border-slate-200 hover:bg-slate-100">
                      <td
  className={`sticky-col-cell px-2 py-1 align-middle font-medium min-w-[300px] border-r border-slate-200 bg-slate-50 ${
    getTipoLiq(scadenza) === "Esterna" ? "text-red-600 font-bold" : ""
  }`}
>
  {scadenza.nominativo}
</td>
                          <td className="px-2 py-1 align-middle min-w-[180px] border-r border-slate-200">
                            {scadenza.operatore}
                          </td>

                      <td className="px-2 py-1 align-middle min-w-[170px] border-r border-slate-200">
                        <Select
                          value={getTipoLiq(scadenza)}
                          onValueChange={(value: TipoLiqValue) =>
                            handleUpdateValue(scadenza.id, "TipoLiq", value)
                          }
                        >
                          <SelectTrigger className="h-8 border-slate-300 bg-white text-xs">
                            <SelectValue placeholder="Seleziona tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mensile">Mensile</SelectItem>
                            <SelectItem value="Trimestrale">Trimestrale</SelectItem>
                            <SelectItem value="Esterna">Esterna</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      <td className={`${baseCellClass} ${groupCellQ1} text-center min-w-[60px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.gen)}
                          disabled={isMonthDisabled(scadenza, "gen")}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.gen)) {
                              handleToggleField(scadenza.id, "gen", scadenza.gen || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ1} text-center min-w-[60px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.feb)}
                          disabled={isMonthDisabled(scadenza, "feb")}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.feb)) {
                              handleToggleField(scadenza.id, "feb", scadenza.feb || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ1} text-center min-w-[60px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.mar)}
                          disabled={isMonthDisabled(scadenza, "mar")}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.mar)) {
                              handleToggleField(scadenza.id, "mar", scadenza.mar || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ1} text-center min-w-[80px]`}>
                       <BooleanSelect
                          value={Boolean(scadenza.conferma_1_trimestre)}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.conferma_1_trimestre)) {
                              handleToggleField(scadenza.id, "conferma_1_trimestre", scadenza.conferma_1_trimestre || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ1} min-w-[140px]`}>
                        <Input
                          type="date"
                          value={scadenza.lipe1t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(scadenza.id, "lipe1t_invio", e.target.value)
                          }
className={
  isInvioMancante(scadenza.lipe1t, scadenza.lipe1t_invio)
    ? "h-8 border-slate-300 bg-red-600 text-xs text-white"
  : scadenza.conferma_1_trimestre
? "h-8 border-slate-300 bg-green-200 text-xs text-slate-900"
    : "h-8 border-slate-300 bg-white text-xs"
}
                        />
                      </td>

                      <td className={`${baseCellClass} ${groupCellQ2} text-center min-w-[60px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.apr)}
                          disabled={isMonthDisabled(scadenza, "apr")}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.apr)) {
                              handleToggleField(scadenza.id, "apr", scadenza.apr || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ2} text-center min-w-[60px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.mag)}
                          disabled={isMonthDisabled(scadenza, "mag")}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.mag)) {
                              handleToggleField(scadenza.id, "mag", scadenza.mag || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ2} text-center min-w-[60px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.giu)}
                          disabled={isMonthDisabled(scadenza, "giu")}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.giu)) {
                              handleToggleField(scadenza.id, "giu", scadenza.giu || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ2} text-center min-w-[80px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.conferma_2_trimestre)}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.conferma_2_trimestre)) {
                              handleToggleField(scadenza.id, "conferma_2_trimestre", scadenza.conferma_2_trimestre || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ2} min-w-[140px]`}>
                        <Input
                          type="date"
                          value={scadenza.lipe2t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(scadenza.id, "lipe2t_invio", e.target.value)
                          }
 className={
  isInvioMancante(scadenza.lipe2t, scadenza.lipe2t_invio)
    ? "h-8 border-slate-300 bg-red-600 text-xs text-white"
   : scadenza.conferma_2_trimestre
? "h-8 border-slate-300 bg-green-200 text-xs text-slate-900"
    : "h-8 border-slate-300 bg-white text-xs"
}
                        />
                      </td>

                      <td className={`${baseCellClass} ${groupCellQ3} text-center min-w-[60px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.lug)}
                          disabled={isMonthDisabled(scadenza, "lug")}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.lug)) {
                              handleToggleField(scadenza.id, "lug", scadenza.lug || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ3} text-center min-w-[60px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.ago)}
                          disabled={isMonthDisabled(scadenza, "ago")}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.ago)) {
                              handleToggleField(scadenza.id, "ago", scadenza.ago || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ3} text-center min-w-[60px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.set)}
                          disabled={isMonthDisabled(scadenza, "set")}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.set)) {
                              handleToggleField(scadenza.id, "set", scadenza.set || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ3} text-center min-w-[80px]`}>
                       <BooleanSelect
                          value={Boolean(scadenza.conferma_3_trimestre)}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.conferma_3_trimestre)) {
                              handleToggleField(scadenza.id, "conferma_3_trimestre", scadenza.conferma_3_trimestre || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ3} min-w-[140px]`}>
 <Input
  type="date"
  value={scadenza.lipe3t_invio || ""}
  onChange={(e) =>
    handleUpdateValue(scadenza.id, "lipe3t_invio", e.target.value)
  }
  className={
    isInvioMancante(scadenza.lipe3t, scadenza.lipe3t_invio)
      ? "h-8 border-slate-300 bg-red-600 text-xs text-white"
    : scadenza.conferma_3_trimestre
? "h-8 border-slate-300 bg-green-200 text-xs text-slate-900"
      : "h-8 border-slate-300 bg-white text-xs"
  }
/>
                      </td>

                      <td className={`${baseCellClass} ${groupCellQ4} text-center min-w-[60px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.ott)}
                          disabled={isMonthDisabled(scadenza, "ott")}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.ott)) {
                              handleToggleField(scadenza.id, "ott", scadenza.ott || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ4} text-center min-w-[60px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.nov)}
                          disabled={isMonthDisabled(scadenza, "nov")}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.nov)) {
                              handleToggleField(scadenza.id, "nov", scadenza.nov || false);
                            }
                          }}
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ4} text-center min-w-[60px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.dic)}
                          disabled={isMonthDisabled(scadenza, "dic")}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.dic)) {
                              handleToggleField(scadenza.id, "dic", scadenza.dic || false);
                            }
                          }}
                        />
                      </td>

                      <td className={`${baseCellClass} ${groupCellQ4} min-w-[120px]`}>
                        <Input
                          type="text"
                          value={scadenza.acconto || ""}
                          onChange={(e) =>
                            handleUpdateValue(scadenza.id, "acconto", e.target.value)
                          }
                          className="h-8 border-slate-300 bg-white text-xs"
                          placeholder="Metodo"
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ4} text-center min-w-[100px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.conferma_acconto_iva)}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.conferma_acconto_iva)) {
                              handleToggleField(scadenza.id, "conferma_acconto_iva", scadenza.conferma_acconto_iva || false);
                            }
                          }}
                        />
                      </td>

                      <td className={`${baseCellClass} ${groupCellQ4} text-center min-w-[80px]`}>
                        <BooleanSelect
                          value={Boolean(scadenza.conferma_4_trimestre)}
                          onChange={(nextValue) => {
                            if (nextValue !== Boolean(scadenza.conferma_4_trimestre)) {
                              handleToggleField(scadenza.id, "conferma_4_trimestre", scadenza.conferma_4_trimestre || false);
                            }
                          }}
                        />
                      </td>
  
<td className={`${baseCellClass} ${groupCellQ4} min-w-[140px]`}>
  <Input
    type="date"
    value={scadenza.lipe4t_invio || ""}
    onChange={(e) =>
      handleUpdateValue(scadenza.id, "lipe4t_invio", e.target.value)
    }
    className={
      isInvioMancante(scadenza.lipe4t, scadenza.lipe4t_invio)
        ? "h-8 border-slate-300 bg-red-600 text-xs text-white"
       : scadenza.conferma_4_trimestre
? "h-8 border-slate-300 bg-green-200 text-xs text-slate-900"
        : "h-8 border-slate-300 bg-white text-xs"
    }
  />
</td>

<td className={`${baseCellClass} ${groupCellQ4} text-center min-w-[100px] border-r-0`}>
 <button
  type="button"
  onClick={() =>
    handleDeleteRecord(
      scadenza.id,
      scadenza.nominativo
    )
  }
  className="text-red-600 hover:text-red-800 transition-colors"
  title={`Elimina ${scadenza.nominativo}`}
>
  <Trash2 className="h-4 w-4" />
</button>
</td>

</tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

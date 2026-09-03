import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ScadenzaIva } from "./types";

type Props = {
  scadenze: ScadenzaIva[];
  localNotes: Record<string, string>;
  getUtenteNome: (utenteId: string | null) => string;
  onSetBoolean: (id: string, field: keyof ScadenzaIva, value: boolean) => void;
  onUpdateField: (id: string, field: keyof ScadenzaIva, value: any) => void;
  onNoteChange: (id: string, value: string) => void;
  onDelete: (id: string) => void;
};

const BooleanSelect = ({ value, onChange }: { value: boolean | null; onChange: (value: boolean) => void }) => (
  <select
    value={value ? "SI" : "NO"}
    onChange={(e) => onChange(e.target.value === "SI")}
    className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700"
  >
    <option value="NO">NO</option>
    <option value="SI">SI</option>
  </select>
);

export function IvaScrollableTable({
  scadenze,
  localNotes,
  getUtenteNome,
  onSetBoolean,
  onUpdateField,
  onNoteChange,
  onDelete,
}: Props) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border border-sky-200 bg-slate-50 shadow-sm">
      <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
        <div className="h-full w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="sticky top-0 z-30 bg-slate-600 text-white shadow-sm [&_tr]:border-b [&_tr]:border-slate-500">
              <tr className="border-b border-slate-500">
                <th className="sticky-col-header h-9 min-w-[260px] border-r border-slate-500 !bg-slate-600 px-2 text-left align-middle font-semibold !text-slate-50">Nominativo</th>
                <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[180px]">Operatore</th>
                <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 min-w-[110px]">Mod. Pred.</th>
                <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 min-w-[90px]">Def.</th>
                <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 min-w-[90px]">Ass.</th>
                <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[130px]">Credito</th>
                <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 min-w-[90px]">Inv.</th>
                <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[150px]">Data Invio</th>
                <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 min-w-[100px]">Ricevuta</th>
                <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[300px]">Note</th>
                <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 min-w-[100px]">Conferma</th>
                <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 min-w-[100px]">Azioni</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {scadenze.length === 0 ? (
                <tr className="border-b transition-colors hover:bg-muted/50">
                  <td colSpan={12} className="px-2 py-8 align-middle text-center text-gray-500">Nessun record trovato</td>
                </tr>
              ) : (
                scadenze.map((scadenza) => (
                  <tr
                    key={scadenza.id}
                    className={`border-b transition-colors ${
                      scadenza.conferma_riga
                        ? "bg-green-100 hover:bg-green-100"
                        : scadenza.mod_definitivo
                        ? "bg-orange-100 hover:bg-orange-100"
                        : "bg-slate-50 hover:bg-slate-100"
                    }`}
                  >
                    <td className={`px-2 py-1 align-middle sticky-col-cell border-r font-medium min-w-[260px] ${scadenza.conferma_riga ? "!bg-green-100" : scadenza.mod_definitivo ? "!bg-orange-100" : "!bg-slate-50"}`}>
                      {scadenza.nominativo}
                    </td>
                    <td className="px-2 py-1 align-middle min-w-[180px]">{getUtenteNome(scadenza.utente_operatore_id)}</td>
                    <td className="px-2 py-1 align-middle text-center min-w-[110px]"><BooleanSelect value={scadenza.mod_predisposto} onChange={(v) => onSetBoolean(scadenza.id, "mod_predisposto", v)} /></td>
                    <td className="px-2 py-1 align-middle text-center min-w-[90px]"><BooleanSelect value={scadenza.mod_definitivo} onChange={(v) => onSetBoolean(scadenza.id, "mod_definitivo", v)} /></td>
                    <td className="px-2 py-1 align-middle text-center min-w-[90px]"><BooleanSelect value={scadenza.asseverazione} onChange={(v) => onSetBoolean(scadenza.id, "asseverazione", v)} /></td>
                    <td className="px-2 py-1 align-middle min-w-[130px]">
                      <Input type="number" step="0.01" value={scadenza.importo_credito || ""} onChange={(e) => onUpdateField(scadenza.id, "importo_credito", parseFloat(e.target.value) || null)} className="h-8 w-full border-slate-300 bg-white" placeholder="0.00" />
                    </td>
                    <td className="px-2 py-1 align-middle text-center min-w-[90px]"><BooleanSelect value={scadenza.mod_inviato} onChange={(v) => onSetBoolean(scadenza.id, "mod_inviato", v)} /></td>
                    <td className="px-2 py-1 align-middle min-w-[150px]">
                      <Input type="date" value={scadenza.data_invio || ""} onChange={(e) => onUpdateField(scadenza.id, "data_invio", e.target.value)} className="h-8 w-full border-slate-300 bg-white" />
                    </td>
                    <td className="px-2 py-1 align-middle text-center min-w-[100px]"><BooleanSelect value={scadenza.ricevuta} onChange={(v) => onSetBoolean(scadenza.id, "ricevuta", v)} /></td>
                    <td className="px-2 py-1 align-middle min-w-[300px]">
                      <Textarea value={localNotes[scadenza.id] ?? scadenza.note ?? ""} onChange={(e) => onNoteChange(scadenza.id, e.target.value)} placeholder="Aggiungi note..." rows={1} className="min-h-8 h-8 resize-none border-slate-300 bg-white py-1.5" />
                    </td>
                    <td className="px-2 py-1 align-middle text-center min-w-[100px]"><BooleanSelect value={scadenza.conferma_riga} onChange={(v) => onSetBoolean(scadenza.id, "conferma_riga", v)} /></td>
                    <td className="px-2 py-1 align-middle text-center min-w-[100px]">
                      <Button variant="ghost" size="sm" onClick={() => onDelete(scadenza.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

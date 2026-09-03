import { Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IvaStats, UtenteIva } from "./types";

type Props = {
  stats: IvaStats;
  utenti: UtenteIva[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filterOperatore: string;
  setFilterOperatore: (value: string) => void;
  filterConferma: string;
  setFilterConferma: (value: string) => void;
  annoConsultazione: number;
  setAnnoConsultazione: (value: number) => void;
  anni: number[];
  onPrintOperatore: () => void;
};

export function IvaFixedPanel({
  stats,
  utenti,
  searchQuery,
  setSearchQuery,
  filterOperatore,
  setFilterOperatore,
  filterConferma,
  setFilterConferma,
  annoConsultazione,
  setAnnoConsultazione,
  anni,
  onPrintOperatore,
}: Props) {
  return (
    <div className="shrink-0 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario IVA</h1>
          <p className="text-gray-500 mt-1">
            Gestione liquidazioni periodiche e versamenti IVA
          </p>
        </div>

        {filterOperatore !== "__all__" && (
          <Button
            type="button"
            onClick={onPrintOperatore}
            className="bg-black text-white hover:bg-zinc-800"
          >
            <Printer className="h-4 w-4 mr-2" />
            Stampa elenco operatore
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border border-sky-200 bg-slate-50 shadow-sm">
          <CardContent className="pt-5">
            <div className="text-sm text-gray-600 mb-1">Totale Dichiarazioni</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totale}</div>
          </CardContent>
        </Card>
        <Card className="border border-sky-200 bg-slate-50 shadow-sm">
          <CardContent className="pt-5">
            <div className="text-sm text-gray-600 mb-1">Confermate</div>
            <div className="text-3xl font-bold text-green-600">{stats.confermate}</div>
          </CardContent>
        </Card>
        <Card className="border border-sky-200 bg-slate-50 shadow-sm">
          <CardContent className="pt-5">
            <div className="text-sm text-gray-600 mb-1">Non Confermate</div>
            <div className="text-3xl font-bold text-orange-600">{stats.nonConfermate}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-sky-200 bg-slate-50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cerca Nominativo</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cerca..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 border-slate-300 bg-white pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Utente Operatore</label>
              <Select value={filterOperatore} onValueChange={setFilterOperatore}>
                <SelectTrigger className="h-9 border-slate-300 bg-white">
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  {utenti.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.cognome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Stato Conferma</label>
              <Select value={filterConferma} onValueChange={setFilterConferma}>
                <SelectTrigger className="h-9 border-slate-300 bg-white">
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  <SelectItem value="true">Solo Confermate</SelectItem>
                  <SelectItem value="false">Solo Non Confermate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Anno consultazione</label>
              <Select
                value={annoConsultazione.toString()}
                onValueChange={(value) => setAnnoConsultazione(parseInt(value))}
              >
                <SelectTrigger className="h-9 border-slate-300 bg-white">
                  <SelectValue placeholder="Seleziona anno" />
                </SelectTrigger>
                <SelectContent>
                  {anni.map((anno) => (
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
    </div>
  );
}

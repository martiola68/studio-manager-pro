import { useState } from "react";

import { Search, Trash2, Users, Paperclip, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";

import type { Database } from "@/lib/supabase/types";

type Comunicazione =
  Database["public"]["Tables"]["tbcomunicazioni"]["Row"];

interface Props {
  comunicazioni: Comunicazione[];
  onDelete: (id: string) => void;
}

export default function StoricoComunicazioni({
  comunicazioni,
  onDelete,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filteredComunicazioni = comunicazioni.filter((c) => {
    const q = searchQuery.toLowerCase();

    return (
      (c.oggetto || "").toLowerCase().includes(q) ||
      (c.messaggio || "").toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Storico Comunicazioni</CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              {comunicazioni.length} comunicazioni registrate
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen((prev) => !prev)}
            className="flex items-center gap-2"
          >
            {open ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Nascondi storico
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Mostra storico
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {open && (
        <CardContent>
          <div className="mb-4 flex justify-end">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <Input
                placeholder="Cerca nello storico..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Oggetto</TableHead>
                <TableHead>Destinatari</TableHead>
                <TableHead>Allegati</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredComunicazioni.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-gray-500"
                  >
                    Nessuna comunicazione trovata
                  </TableCell>
                </TableRow>
              ) : (
                filteredComunicazioni.map((comm) => (
                  <TableRow key={comm.id}>
                    <TableCell className="text-sm">
                      {comm.data_invio
                        ? new Date(comm.data_invio).toLocaleDateString("it-IT")
                        : "-"}
                    </TableCell>

                    <TableCell>
                      <Badge>
                        {String(comm.tipo || "").toUpperCase()}
                      </Badge>
                    </TableCell>

                    <TableCell className="font-medium">
                      {comm.oggetto}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-gray-500" />
                        <span className="text-sm">
                          {comm.destinatari_count || 0}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {comm.allegati ? (
                        <Paperclip className="h-4 w-4 text-blue-600" />
                      ) : (
                        "-"
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(comm.id)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}

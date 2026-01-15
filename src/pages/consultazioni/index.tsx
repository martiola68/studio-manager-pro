import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FolderOpen, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];

export default function ConsultazioniPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [filteredClienti, setFilteredClienti] = useState<Cliente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  
  // Checkbox mutualmente esclusive
  const [checkboxes, setCheckboxes] = useState({
    bilanci: false,
    fiscali: false,
    generale: false
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  useEffect(() => {
    filterClienti();
  }, [searchQuery, clienti]);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      await loadData();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tbclienti")
        .select("*")
        .order("ragione_sociale");

      if (error) throw error;
      setClienti(data || []);
      setFilteredClienti(data || []);
    } catch (error) {
      console.error("Errore caricamento dati:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i clienti",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterClienti = () => {
    if (!searchQuery.trim()) {
      setFilteredClienti(clienti);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = clienti.filter(
      (c) =>
        c.ragione_sociale?.toLowerCase().includes(query) ||
        c.codice_fiscale?.toLowerCase().includes(query) ||
        c.partita_iva?.toLowerCase().includes(query)
    );
    setFilteredClienti(filtered);
  };

  const handleCheckboxChange = (tipo: "bilanci" | "fiscali" | "generale") => {
    setCheckboxes({
      bilanci: tipo === "bilanci",
      fiscali: tipo === "fiscali",
      generale: tipo === "generale"
    });
  };

  const handleSelectCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    // Reset checkbox quando si seleziona un nuovo cliente
    setCheckboxes({
      bilanci: false,
      fiscali: false,
      generale: false
    });
  };

  const handleOpenPath = (percorso: string) => {
    if (!percorso) {
      toast({
        title: "Attenzione",
        description: "Nessun percorso configurato",
        variant: "destructive"
      });
      return;
    }

    // Tenta di aprire con protocollo file://
    const fileUrl = `file:///${percorso.replace(/\\/g, '/')}`;
    
    // Crea un link temporaneo e lo clicca
    const link = document.createElement('a');
    link.href = fileUrl;
    link.target = '_blank';
    link.click();
    
    // Feedback all'utente
    toast({
      title: "Apertura percorso",
      description: `Tentativo di aprire: ${percorso}`,
      duration: 3000
    });
  };

  const handleOpenFolder = (percorso: string) => {
    if (!percorso) {
      toast({
        title: "Attenzione",
        description: "Nessun percorso configurato",
        variant: "destructive"
      });
      return;
    }

    if (percorso.startsWith("http://") || percorso.startsWith("https://")) {
      window.open(percorso, "_blank");
      return;
    }

    navigator.clipboard.writeText(percorso).then(() => {
      toast({
        title: "Percorso copiato",
        description: "Il percorso è stato copiato negli appunti. Aprilo manualmente da Esplora File.",
      });
    });
  };

  const handleClearSelection = () => {
    setSelectedCliente(null);
    setCheckboxes({
      bilanci: false,
      fiscali: false,
      generale: false
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Consultazioni Documenti</h1>
        <p className="text-gray-500 mt-1">Accesso rapido ai percorsi documentali</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sezione selezione cliente */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Seleziona Cliente</CardTitle>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Cerca per ragione sociale, CF o P.IVA..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ragione Sociale</TableHead>
                    <TableHead>Codice Fiscale</TableHead>
                    <TableHead>Partita IVA</TableHead>
                    <TableHead className="text-right">Azione</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClienti.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                        {searchQuery ? "Nessun cliente trovato" : "Nessun cliente disponibile"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClienti.map((cliente) => (
                      <TableRow
                        key={cliente.id}
                        className={`cursor-pointer hover:bg-gray-50 ${
                          selectedCliente?.id === cliente.id ? "bg-blue-50" : ""
                        }`}
                        onClick={() => handleSelectCliente(cliente)}
                      >
                        <TableCell className="font-medium">{cliente.ragione_sociale}</TableCell>
                        <TableCell className="text-gray-600">{cliente.codice_fiscale || "-"}</TableCell>
                        <TableCell className="text-gray-600">{cliente.partita_iva || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectCliente(cliente);
                            }}
                          >
                            Seleziona
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Sezione tipo documento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Tipo Documento
              {selectedCliente && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="h-8 px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedCliente ? (
              <>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-900">Cliente selezionato:</p>
                  <p className="text-sm text-blue-700 mt-1">{selectedCliente.ragione_sociale}</p>
                </div>

                <div className="space-y-4">
                  <Label className="text-base font-semibold">Seleziona tipo di documento:</Label>
                  
                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                    <Checkbox
                      id="bilanci"
                      checked={checkboxes.bilanci}
                      onCheckedChange={() => handleCheckboxChange("bilanci")}
                    />
                    <Label htmlFor="bilanci" className="cursor-pointer flex-1">
                      Bilanci
                      {!selectedCliente.percorso_bilanci && (
                        <span className="ml-2 text-xs text-red-500">(non configurato)</span>
                      )}
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                    <Checkbox
                      id="fiscali"
                      checked={checkboxes.fiscali}
                      onCheckedChange={() => handleCheckboxChange("fiscali")}
                    />
                    <Label htmlFor="fiscali" className="cursor-pointer flex-1">
                      Fiscali
                      {!selectedCliente.percorso_fiscali && (
                        <span className="ml-2 text-xs text-red-500">(non configurato)</span>
                      )}
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                    <Checkbox
                      id="generale"
                      checked={checkboxes.generale}
                      onCheckedChange={() => handleCheckboxChange("generale")}
                    />
                    <Label htmlFor="generale" className="cursor-pointer flex-1">
                      Generale
                      {!selectedCliente.percorso_generale && (
                        <span className="ml-2 text-xs text-red-500">(non configurato)</span>
                      )}
                    </Label>
                  </div>
                </div>

                {(checkboxes.bilanci || checkboxes.fiscali || checkboxes.generale) && (
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <p className="font-medium mb-2 text-sm">Percorso selezionato:</p>
                    <button
                      onClick={() => {
                        const percorso = checkboxes.bilanci 
                          ? selectedCliente.percorso_bilanci 
                          : checkboxes.fiscali 
                          ? selectedCliente.percorso_fiscali 
                          : selectedCliente.percorso_generale;
                        if (percorso) handleOpenPath(percorso);
                      }}
                      className="text-blue-600 hover:text-blue-800 hover:underline text-left font-mono text-xs break-all w-full"
                    >
                      {checkboxes.bilanci && selectedCliente.percorso_bilanci}
                      {checkboxes.fiscali && selectedCliente.percorso_fiscali}
                      {checkboxes.generale && selectedCliente.percorso_generale}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Seleziona un cliente dalla tabella</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
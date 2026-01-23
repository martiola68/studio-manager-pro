import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { clienteService } from "@/services/clienteService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Search, Trash2, Edit, Phone, Mail, MapPin, MoreVertical, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ClienteForm } from "@/components/clienti/ClienteForm";
import type { Database } from "@/integrations/supabase/types";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];

export default function ClientiPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null);

  const loadClienti = async () => {
    try {
      setLoading(true);
      let data;
      if (searchQuery.length > 2) {
        data = await clienteService.searchClienti(searchQuery);
      } else {
        data = await clienteService.getClienti();
      }
      setClienti(data);
    } catch (error) {
      console.error("Errore caricamento clienti:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile caricare la lista dei clienti.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClienti();
    }, 300); // Debounce search
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDelete = async () => {
    if (!clienteToDelete) return;

    try {
      await clienteService.deleteCliente(clienteToDelete);
      toast({
        title: "Cliente eliminato",
        description: "Il cliente è stato rimosso con successo.",
      });
      loadClienti();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Errore eliminazione",
        description: "Impossibile eliminare il cliente. Verifica che non abbia dati collegati critici.",
      });
    } finally {
      setClienteToDelete(null);
    }
  };

  const openEditDialog = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setSelectedCliente(null);
    setIsDialogOpen(true);
  };

  const handleFormSuccess = () => {
    setIsDialogOpen(false);
    loadClienti();
  };

  return (
    <>
      <Head>
        <title>Gestione Clienti | Studio Manager Pro</title>
      </Head>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Clienti</h1>
            <p className="text-gray-500 mt-1">Gestisci l'anagrafica dei tuoi clienti</p>
          </div>
          <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Nuovo Cliente
          </Button>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Anagrafica</CardTitle>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Cerca cliente..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              </div>
            ) : clienti.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-lg font-medium">Nessun cliente trovato</p>
                <p className="text-sm">Prova a modificare la ricerca o aggiungi un nuovo cliente.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ragione Sociale</TableHead>
                      <TableHead className="hidden md:table-cell">Contatti</TableHead>
                      <TableHead className="hidden lg:table-cell">Dati Fiscali</TableHead>
                      <TableHead className="hidden lg:table-cell">Indirizzo</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clienti.map((cliente) => (
                      <TableRow key={cliente.id} className="hover:bg-gray-50/50">
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="text-base text-gray-900">{cliente.ragione_sociale}</span>
                            {cliente.referente && (
                              <span className="text-xs text-gray-500 mt-0.5">Ref: {cliente.referente}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-col gap-1 text-sm text-gray-600">
                            {cliente.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3" />
                                <span className="truncate max-w-[180px]" title={cliente.email}>{cliente.email}</span>
                              </div>
                            )}
                            {cliente.telefono && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                <span>{cliente.telefono}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-col gap-0.5 text-sm">
                            {cliente.partita_iva && (
                              <span className="text-gray-600">P.IVA: <span className="font-mono text-xs">{cliente.partita_iva}</span></span>
                            )}
                            {cliente.codice_fiscale && (
                              <span className="text-gray-600">CF: <span className="font-mono text-xs">{cliente.codice_fiscale}</span></span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-start gap-2 text-sm text-gray-600 max-w-[200px]">
                            {cliente.indirizzo && (
                              <>
                                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                                <span className="truncate">
                                  {cliente.indirizzo}
                                  {cliente.citta && `, ${cliente.citta}`}
                                  {cliente.provincia && ` (${cliente.provincia})`}
                                </span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={cliente.attivo ? "default" : "secondary"} className={cliente.attivo ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200" : "bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200"}>
                            {cliente.attivo ? "Attivo" : "Inattivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(cliente)}>
                                <Edit className="mr-2 h-4 w-4" /> Modifica
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                onClick={() => setClienteToDelete(cliente.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Elimina
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCliente ? "Modifica Cliente" : "Nuovo Cliente"}</DialogTitle>
          </DialogHeader>
          <ClienteForm 
            clienteToEdit={selectedCliente} 
            onSuccess={handleFormSuccess} 
            onCancel={() => setIsDialogOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!clienteToDelete} onOpenChange={(open) => !open && setClienteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Eliminerà permanentemente il cliente e tutti i dati associati (scadenze, documenti, ecc.).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Elimina Cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
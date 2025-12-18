import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Archive, Plus, AlertTriangle, CalendarCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GenerazioneScadenzariPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [annoArchiviazione, setAnnoArchiviazione] = useState(new Date().getFullYear() - 1);
  const [annoGenerazione, setAnnoGenerazione] = useState(new Date().getFullYear());

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: utente } = await supabase
        .from("tbutenti")
        .select("tipo_utente")
        .eq("email", session.user.email)
        .single();

      if (utente?.tipo_utente !== "Admin") {
        router.push("/dashboard");
        return;
      }

      setLoading(false);
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const handleArchivia = async () => {
    if (!confirm(`Sei sicuro di voler archiviare tutte le scadenze dell'anno ${annoArchiviazione}?\n\nQuesta operazione NON può essere annullata!`)) {
      return;
    }

    try {
      setProcessing(true);

      // TODO: Implementare logica di archiviazione
      // 1. Creare tabelle archivio (es. TBScadIva_2023, TBScadCCGG_2023, ecc.)
      // 2. Copiare i dati nelle tabelle archivio
      // 3. Eliminare i dati dalle tabelle correnti

      toast({
        title: "Funzionalità in sviluppo",
        description: "L'archiviazione delle scadenze sarà implementata a breve",
      });

    } catch (error) {
      console.error("Errore archiviazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile archiviare le scadenze",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleGenera = async () => {
    if (!confirm(`Sei sicuro di voler generare gli scadenzari per l'anno ${annoGenerazione}?\n\nVerranno creati record per tutti i clienti attivi in base ai flag attivi.`)) {
      return;
    }

    try {
      setProcessing(true);

      // Carica tutti i clienti attivi
      const { data: clienti, error: clientiError } = await supabase
        .from("tbclienti")
        .select("*")
        .eq("attivo", true);

      if (clientiError) throw clientiError;

      if (!clienti || clienti.length === 0) {
        toast({
          title: "Attenzione",
          description: "Nessun cliente attivo trovato",
        });
        return;
      }

      let generati = 0;
      let errori = 0;

      for (const cliente of clienti) {
        try {
          // TBScadIva - Prima verifica se esiste
          if (cliente.flag_iva) {
            const { data: existing } = await supabase
              .from("tbscadiva")
              .select("id")
              .eq("id", cliente.id)
              .single();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadiva")
                .insert({
                  id: cliente.id,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                  utente_professionista_id: cliente.utente_professionista_id,
                  conferma_riga: false
                });
              if (!error) generati++;
              else errori++;
            }
          }

          // TBScadCCGG
          if (cliente.flag_ccgg) {
            const { data: existing } = await supabase
              .from("tbscadccgg")
              .select("id")
              .eq("id", cliente.id)
              .single();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadccgg")
                .insert({
                  id: cliente.id,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                  utente_professionista_id: cliente.utente_professionista_id,
                  conferma_riga: false
                });
              if (!error) generati++;
              else errori++;
            }
          }

          // TBScadCU
          if (cliente.flag_cu) {
            const { data: existing } = await supabase
              .from("tbscadcu")
              .select("id")
              .eq("id", cliente.id)
              .single();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadcu")
                .insert({
                  id: cliente.id,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                  utente_professionista_id: cliente.utente_professionista_id,
                  conferma_riga: false
                });
              if (!error) generati++;
              else errori++;
            }
          }

          // TBScadFiscali
          if (cliente.flag_fiscali) {
            const { data: existing } = await supabase
              .from("tbscadfiscali")
              .select("id")
              .eq("id", cliente.id)
              .single();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadfiscali")
                .insert({
                  id: cliente.id,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                  utente_professionista_id: cliente.utente_professionista_id,
                  conferma_riga: false
                });
              if (!error) generati++;
              else errori++;
            }
          }

          // TBScadBilanci
          if (cliente.flag_bilancio) {
            const { data: existing } = await supabase
              .from("tbscadbilanci")
              .select("id")
              .eq("id", cliente.id)
              .single();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadbilanci")
                .insert({
                  id: cliente.id,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                  utente_professionista_id: cliente.utente_professionista_id,
                  conferma_riga: false
                });
              if (!error) generati++;
              else errori++;
            }
          }

          // TBScad770
          if (cliente.flag_770) {
            const { data: existing } = await supabase
              .from("tbscad770")
              .select("id")
              .eq("id", cliente.id)
              .single();

            if (!existing) {
              const { error } = await supabase
                .from("tbscad770")
                .insert({
                  id: cliente.id,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                  utente_professionista_id: cliente.utente_professionista_id,
                  conferma_riga: false
                });
              if (!error) generati++;
              else errori++;
            }
          }

          // TBScadLipe
          if (cliente.flag_lipe) {
            const { data: existing } = await supabase
              .from("tbscadlipe")
              .select("id")
              .eq("id", cliente.id)
              .single();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadlipe")
                .insert({
                  id: cliente.id,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                  utente_professionista_id: cliente.utente_professionista_id
                });
              if (!error) generati++;
              else errori++;
            }
          }

          // TBScadEstero
          if (cliente.flag_esterometro) {
            const { data: existing } = await supabase
              .from("tbscadestero")
              .select("id")
              .eq("id", cliente.id)
              .single();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadestero")
                .insert({
                  id: cliente.id,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                  utente_professionista_id: cliente.utente_professionista_id
                });
              if (!error) generati++;
              else errori++;
            }
          }

          // TBScadProforma
          if (cliente.flag_proforma) {
            const { data: existing } = await supabase
              .from("tbscadproforma")
              .select("id")
              .eq("id", cliente.id)
              .single();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadproforma")
                .insert({
                  id: cliente.id,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                  utente_professionista_id: cliente.utente_professionista_id
                });
              if (!error) generati++;
              else errori++;
            }
          }
        } catch (error) {
          console.error(`Errore elaborazione cliente ${cliente.ragione_sociale}:`, error);
          errori++;
        }
      }

      toast({
        title: "Generazione completata",
        description: `Generati ${generati} nuovi scadenzari per ${clienti.length} clienti${errori > 0 ? ` (${errori} errori)` : ''}`
      });

    } catch (error) {
      console.error("Errore generazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile generare gli scadenzari",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
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

  const anni = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Generazione Scadenzari</h1>
              <p className="text-gray-500 mt-1">Archivia scadenze precedenti e genera nuovi scadenzari</p>
            </div>

            <div className="space-y-6">
              <Card className="border-l-4 border-l-red-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <Archive className="h-5 w-5" />
                    Archivia Scadenze
                  </CardTitle>
                  <CardDescription>
                    Archivia tutte le scadenze di un anno precedente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-red-800">
                        <p className="font-semibold mb-1">ATTENZIONE!</p>
                        <p>L'archiviazione sposterà tutte le scadenze dell'anno selezionato in tabelle archivio separate. Questa operazione NON può essere annullata.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="anno_archiviazione">Anno da Archiviare</Label>
                    <Select
                      value={annoArchiviazione.toString()}
                      onValueChange={(value) => setAnnoArchiviazione(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
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

                  <Button
                    onClick={handleArchivia}
                    disabled={processing}
                    variant="destructive"
                    className="w-full"
                  >
                    {processing ? (
                      <>
                        <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Archiviazione in corso...
                      </>
                    ) : (
                      <>
                        <Archive className="h-4 w-4 mr-2" />
                        Archivia Scadenze {annoArchiviazione}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <CalendarCog className="h-5 w-5" />
                    Genera Nuovi Scadenzari
                  </CardTitle>
                  <CardDescription>
                    Genera automaticamente gli scadenzari per l'anno selezionato
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">Come funziona:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Vengono generati scadenzari solo per i clienti ATTIVI</li>
                        <li>Vengono creati solo gli scadenzari relativi ai flag attivi del cliente</li>
                        <li>Se uno scadenzario esiste già, NON viene duplicato</li>
                        <li>I nominativi vengono inseriti automaticamente in base ai flag attivi</li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="anno_generazione">Anno da Generare</Label>
                    <Select
                      value={annoGenerazione.toString()}
                      onValueChange={(value) => setAnnoGenerazione(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
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

                  <Button
                    onClick={handleGenera}
                    disabled={processing}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {processing ? (
                      <>
                        <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Generazione in corso...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Genera Scadenzari {annoGenerazione}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
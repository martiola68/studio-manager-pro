import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { authService } from "@/services/authService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Archive, Plus, AlertTriangle, CalendarCog, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

export default function GenerazioneScadenzariPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [annoArchiviazione, setAnnoArchiviazione] = useState(new Date().getFullYear() - 1);
  const [annoGenerazione, setAnnoGenerazione] = useState(new Date().getFullYear());
  
  // Flag per scelta scadenzari
  const [scadenzariFlags, setScadenzariFlags] = useState({
    iva: true,
    ccgg: true,
    cu: true,
    fiscali: true,
    bilanci: true,
    modello770: true,
    lipe: true,
    esterometro: true,
    proforma: true,
    imu: true
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const authUser = await authService.getCurrentUser();
      if (!authUser || !authUser.id) {
        router.push("/login");
        return;
      }

      const profile = await authService.getUserProfile(authUser.id);
      const { data: utente } = await supabase
        .from("tbutenti")
        .select("tipo_utente")
        .eq("email", authUser.email)
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

  const handleAzzeraScadenzario = async (nomeScadenzario: string, nomeTabella: string) => {
    if (!confirm(`Sei sicuro di voler AZZERARE COMPLETAMENTE lo scadenzario ${nomeScadenzario}?\n\nQuesta operazione eliminerà TUTTI i dati e NON può essere annullata!`)) {
      return;
    }

    try {
      setProcessing(true);

      const { error } = await supabase
        .from(nomeTabella as any) // Fix: cast a any per evitare errore TS
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Elimina tutti i record

      if (error) throw error;

      toast({
        title: "Successo",
        description: `Scadenzario ${nomeScadenzario} azzerato completamente`
      });

    } catch (error) {
      console.error("Errore azzeramento:", error);
      toast({
        title: "Errore",
        description: `Impossibile azzerare lo scadenzario ${nomeScadenzario}`,
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
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
    const scadenzariSelezionati = Object.entries(scadenzariFlags)
      .filter(([_, selected]) => selected)
      .map(([key, _]) => key);

    if (scadenzariSelezionati.length === 0) {
      toast({
        title: "Attenzione",
        description: "Seleziona almeno uno scadenzario da generare",
      });
      return;
    }

    if (!confirm(`Sei sicuro di voler generare gli scadenzari selezionati per l'anno ${annoGenerazione}?\n\nVerranno creati record per tutti i clienti attivi in base ai flag attivi.`)) {
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
          // TBScadIva
          if (scadenzariFlags.iva && cliente.flag_iva) {
            const { data: existing } = await supabase
              .from("tbscadiva")
              .select("id")
              .eq("id", cliente.id)
              .maybeSingle();

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
          if (scadenzariFlags.ccgg && cliente.flag_ccgg) {
            const { data: existing } = await supabase
              .from("tbscadccgg")
              .select("id")
              .eq("id", cliente.id)
              .maybeSingle();

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
          if (scadenzariFlags.cu && cliente.flag_cu) {
            const { data: existing } = await supabase
              .from("tbscadcu")
              .select("id")
              .eq("id", cliente.id)
              .maybeSingle();

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
          if (scadenzariFlags.fiscali && cliente.flag_fiscali) {
            const { data: existing } = await supabase
              .from("tbscadfiscali")
              .select("id")
              .eq("id", cliente.id)
              .maybeSingle();

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
          if (scadenzariFlags.bilanci && cliente.flag_bilancio) {
            const { data: existing } = await supabase
              .from("tbscadbilanci")
              .select("id")
              .eq("id", cliente.id)
              .maybeSingle();

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
          if (scadenzariFlags.modello770 && cliente.flag_770) {
            const { data: existing } = await supabase
              .from("tbscad770")
              .select("id")
              .eq("id", cliente.id)
              .maybeSingle();

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
          if (scadenzariFlags.lipe && cliente.flag_lipe) {
            const { data: existing } = await supabase
              .from("tbscadlipe")
              .select("id")
              .eq("id", cliente.id)
              .maybeSingle();

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
          if (scadenzariFlags.esterometro && cliente.flag_esterometro) {
            const { data: existing } = await supabase
              .from("tbscadestero")
              .select("id")
              .eq("id", cliente.id)
              .maybeSingle();

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
          if (scadenzariFlags.proforma && cliente.flag_proforma) {
            const { data: existing } = await supabase
              .from("tbscadproforma")
              .select("id")
              .eq("id", cliente.id)
              .maybeSingle();

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

          // TBScadIMU
          if (scadenzariFlags.imu && cliente.flag_imu) {
            const { data: existing } = await supabase
              .from("tbscadimu")
              .select("id")
              .eq("id", cliente.id)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadimu")
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
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Generazione Scadenzari</h1>
        <p className="text-gray-500 mt-1">Archivia scadenze precedenti, genera nuovi scadenzari o azzera dati esistenti</p>
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

            <div className="space-y-3">
              <Label>Scadenzari da Archiviare</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="arch_iva" 
                    checked={scadenzariFlags.iva}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, iva: checked as boolean})}
                  />
                  <label htmlFor="arch_iva" className="text-sm cursor-pointer">IVA</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="arch_ccgg" 
                    checked={scadenzariFlags.ccgg}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, ccgg: checked as boolean})}
                  />
                  <label htmlFor="arch_ccgg" className="text-sm cursor-pointer">CCGG</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="arch_cu" 
                    checked={scadenzariFlags.cu}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, cu: checked as boolean})}
                  />
                  <label htmlFor="arch_cu" className="text-sm cursor-pointer">CU</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="arch_fiscali" 
                    checked={scadenzariFlags.fiscali}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, fiscali: checked as boolean})}
                  />
                  <label htmlFor="arch_fiscali" className="text-sm cursor-pointer">Fiscali</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="arch_bilanci" 
                    checked={scadenzariFlags.bilanci}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, bilanci: checked as boolean})}
                  />
                  <label htmlFor="arch_bilanci" className="text-sm cursor-pointer">Bilanci</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="arch_770" 
                    checked={scadenzariFlags.modello770}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, modello770: checked as boolean})}
                  />
                  <label htmlFor="arch_770" className="text-sm cursor-pointer">Modello 770</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="arch_lipe" 
                    checked={scadenzariFlags.lipe}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, lipe: checked as boolean})}
                  />
                  <label htmlFor="arch_lipe" className="text-sm cursor-pointer">LIPE</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="arch_esterometro" 
                    checked={scadenzariFlags.esterometro}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, esterometro: checked as boolean})}
                  />
                  <label htmlFor="arch_esterometro" className="text-sm cursor-pointer">Esterometro</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="arch_proforma" 
                    checked={scadenzariFlags.proforma}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, proforma: checked as boolean})}
                  />
                  <label htmlFor="arch_proforma" className="text-sm cursor-pointer">Proforma</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="arch_imu" 
                    checked={scadenzariFlags.imu}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, imu: checked as boolean})}
                  />
                  <label htmlFor="arch_imu" className="text-sm cursor-pointer">IMU</label>
                </div>
              </div>
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
                  Archivia Selezionati {annoArchiviazione}
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

            <div className="space-y-3">
              <Label>Scadenzari da Generare</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="flag_iva" 
                    checked={scadenzariFlags.iva}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, iva: checked as boolean})}
                  />
                  <label htmlFor="flag_iva" className="text-sm cursor-pointer">IVA</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="flag_ccgg" 
                    checked={scadenzariFlags.ccgg}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, ccgg: checked as boolean})}
                  />
                  <label htmlFor="flag_ccgg" className="text-sm cursor-pointer">CCGG</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="flag_cu" 
                    checked={scadenzariFlags.cu}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, cu: checked as boolean})}
                  />
                  <label htmlFor="flag_cu" className="text-sm cursor-pointer">CU</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="flag_fiscali" 
                    checked={scadenzariFlags.fiscali}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, fiscali: checked as boolean})}
                  />
                  <label htmlFor="flag_fiscali" className="text-sm cursor-pointer">Fiscali</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="flag_bilanci" 
                    checked={scadenzariFlags.bilanci}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, bilanci: checked as boolean})}
                  />
                  <label htmlFor="flag_bilanci" className="text-sm cursor-pointer">Bilanci</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="flag_770" 
                    checked={scadenzariFlags.modello770}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, modello770: checked as boolean})}
                  />
                  <label htmlFor="flag_770" className="text-sm cursor-pointer">Modello 770</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="flag_lipe" 
                    checked={scadenzariFlags.lipe}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, lipe: checked as boolean})}
                  />
                  <label htmlFor="flag_lipe" className="text-sm cursor-pointer">LIPE</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="flag_esterometro" 
                    checked={scadenzariFlags.esterometro}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, esterometro: checked as boolean})}
                  />
                  <label htmlFor="flag_esterometro" className="text-sm cursor-pointer">Esterometro</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="flag_proforma" 
                    checked={scadenzariFlags.proforma}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, proforma: checked as boolean})}
                  />
                  <label htmlFor="flag_proforma" className="text-sm cursor-pointer">Proforma</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="flag_imu" 
                    checked={scadenzariFlags.imu}
                    onCheckedChange={(checked) => setScadenzariFlags({...scadenzariFlags, imu: checked as boolean})}
                  />
                  <label htmlFor="flag_imu" className="text-sm cursor-pointer">IMU</label>
                </div>
              </div>
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
                  Genera Scadenzari Selezionati {annoGenerazione}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <Trash2 className="h-5 w-5" />
              Azzera Scadenzari
            </CardTitle>
            <CardDescription>
              Elimina TUTTI i dati di uno scadenzario specifico
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <p className="font-semibold mb-1">ATTENZIONE!</p>
                  <p>L'azzeramento eliminerà PERMANENTEMENTE tutti i dati dello scadenzario selezionato. Questa operazione NON può essere annullata!</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <Button
                onClick={() => handleAzzeraScadenzario("IVA", "tbscadiva")}
                disabled={processing}
                variant="outline"
                className="border-orange-300 hover:bg-orange-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Azzera IVA
              </Button>
              <Button
                onClick={() => handleAzzeraScadenzario("CCGG", "tbscadccgg")}
                disabled={processing}
                variant="outline"
                className="border-orange-300 hover:bg-orange-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Azzera CCGG
              </Button>
              <Button
                onClick={() => handleAzzeraScadenzario("CU", "tbscadcu")}
                disabled={processing}
                variant="outline"
                className="border-orange-300 hover:bg-orange-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Azzera CU
              </Button>
              <Button
                onClick={() => handleAzzeraScadenzario("Fiscali", "tbscadfiscali")}
                disabled={processing}
                variant="outline"
                className="border-orange-300 hover:bg-orange-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Azzera Fiscali
              </Button>
              <Button
                onClick={() => handleAzzeraScadenzario("Bilanci", "tbscadbilanci")}
                disabled={processing}
                variant="outline"
                className="border-orange-300 hover:bg-orange-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Azzera Bilanci
              </Button>
              <Button
                onClick={() => handleAzzeraScadenzario("Modello 770", "tbscad770")}
                disabled={processing}
                variant="outline"
                className="border-orange-300 hover:bg-orange-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Azzera 770
              </Button>
              <Button
                onClick={() => handleAzzeraScadenzario("LIPE", "tbscadlipe")}
                disabled={processing}
                variant="outline"
                className="border-orange-300 hover:bg-orange-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Azzera LIPE
              </Button>
              <Button
                onClick={() => handleAzzeraScadenzario("Esterometro", "tbscadestero")}
                disabled={processing}
                variant="outline"
                className="border-orange-300 hover:bg-orange-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Azzera Esterometro
              </Button>
              <Button
                onClick={() => handleAzzeraScadenzario("Proforma", "tbscadproforma")}
                disabled={processing}
                variant="outline"
                className="border-orange-300 hover:bg-orange-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Azzera Proforma
              </Button>
              <Button
                onClick={() => handleAzzeraScadenzario("IMU", "tbscadimu")}
                disabled={processing}
                variant="outline"
                className="border-orange-300 hover:bg-orange-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Azzera IMU
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
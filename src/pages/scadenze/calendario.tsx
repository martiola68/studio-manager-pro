import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, AlertTriangle, Clock, CheckCircle2, FileText, Plus } from "lucide-react";
import { authService } from "@/services/authService";
import { tipoScadenzaService } from "@/services/tipoScadenzaService";
import { studioService } from "@/services/studioService";
import type { Database } from "@/lib/supabase/types";
import { useToast } from "@/hooks/use-toast";

type TipoScadenza = Database["public"]["Tables"]["tbtipi_scadenze"]["Row"];

interface ScadenzaConUrgenza extends TipoScadenza {
  urgenza: "scaduta" | "7giorni" | "30giorni" | "oltre30";
  giorniRimanenti: number;
}

const TIPI_SCADENZA_OPTIONS = [
  { value: "tutti", label: "Tutte le scadenze" },
  { value: "iva", label: "IVA" },
  { value: "fiscale", label: "Fiscali" },
  { value: "bilancio", label: "Bilanci" },
  { value: "770", label: "770" },
  { value: "lipe", label: "LIPE" },
  { value: "esterometro", label: "Esterometro" },
  { value: "ccgg", label: "CCGG" },
  { value: "cu", label: "CU" },
  { value: "proforma", label: "Proforma" },
  { value: "antiriciclaggio", label: "Antiriciclaggio" },
];

export default function CalendarioScadenzePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaConUrgenza[]>([]);
  const [filtroTipo, setFiltroTipo] = useState("tutti");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const studio = await studioService.getStudio();
      if (!studio) {
        toast({
          title: "Attenzione",
          description: "Nessuno studio configurato. Contatta l'amministratore.",
          variant: "destructive",
        });
        return;
      }

      await loadScadenze(studio.id);
    } catch (error) {
      console.error("Errore autenticazione:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadScadenze = async (studioId: string) => {
    try {
      const data = await tipoScadenzaService.getAll(studioId);
      
      // Calcola urgenza e giorni rimanenti per ogni scadenza
      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);

      const scadenzeConUrgenza: ScadenzaConUrgenza[] = data
        .filter((s) => s.attivo !== false)
        .map((scadenza) => {
          const dataScadenza = new Date(scadenza.data_scadenza);
          dataScadenza.setHours(0, 0, 0, 0);
          
          const diffTime = dataScadenza.getTime() - oggi.getTime();
          const giorniRimanenti = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let urgenza: "scaduta" | "7giorni" | "30giorni" | "oltre30";
          if (giorniRimanenti < 0) {
            urgenza = "scaduta";
          } else if (giorniRimanenti <= 7) {
            urgenza = "7giorni";
          } else if (giorniRimanenti <= 30) {
            urgenza = "30giorni";
          } else {
            urgenza = "oltre30";
          }

          return {
            ...scadenza,
            urgenza,
            giorniRimanenti,
          };
        })
        .sort((a, b) => a.giorniRimanenti - b.giorniRimanenti);

      setScadenze(scadenzeConUrgenza);
    } catch (error) {
      console.error("Errore caricamento scadenze:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le scadenze",
        variant: "destructive",
      });
    }
  };

  const scadenzeFiltrate = scadenze.filter((s) => {
    if (filtroTipo === "tutti") return true;
    return s.tipo_scadenza === filtroTipo;
  });

  const scadenzeScadute = scadenzeFiltrate.filter((s) => s.urgenza === "scaduta");
  const scadenze7Giorni = scadenzeFiltrate.filter((s) => s.urgenza === "7giorni");
  const scadenze30Giorni = scadenzeFiltrate.filter((s) => s.urgenza === "30giorni");
  const scadenzeOltre30 = scadenzeFiltrate.filter((s) => s.urgenza === "oltre30");

  const getTipoLabel = (tipo: string) => {
    return TIPI_SCADENZA_OPTIONS.find((t) => t.value === tipo)?.label || tipo;
  };

  const getUrgenzaBadgeColor = (urgenza: string) => {
    switch (urgenza) {
      case "scaduta":
        return "destructive";
      case "7giorni":
        return "default";
      case "30giorni":
        return "secondary";
      default:
        return "outline";
    }
  };

  const formatGiorniRimanenti = (giorni: number) => {
    if (giorni < 0) return `Scaduta da ${Math.abs(giorni)} giorni`;
    if (giorni === 0) return "Scade oggi";
    if (giorni === 1) return "Scade domani";
    return `Tra ${giorni} giorni`;
  };

  const ScadenzaCard = ({ scadenza }: { scadenza: ScadenzaConUrgenza }) => (
    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {scadenza.nome}
            </h3>
            <Badge variant="outline">{getTipoLabel(scadenza.tipo_scadenza)}</Badge>
          </div>
          
          {scadenza.descrizione && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {scadenza.descrizione}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700 dark:text-gray-300">
                {new Date(scadenza.data_scadenza).toLocaleDateString("it-IT")}
              </span>
            </div>
            
            {scadenza.ricorrente && (
              <Badge variant="secondary" className="text-xs">
                Ricorrente
              </Badge>
            )}
          </div>

          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Preavvisi: {scadenza.giorni_preavviso_1} e {scadenza.giorni_preavviso_2} giorni
          </div>
        </div>

        <div className="text-right">
          <Badge variant={getUrgenzaBadgeColor(scadenza.urgenza)}>
            {formatGiorniRimanenti(scadenza.giorniRimanenti)}
          </Badge>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Caricamento...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Calendario Scadenze - Studio Manager Pro</title>
      </Head>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Calendario Scadenze</h1>
            <p className="text-gray-500 mt-1">Gestione scadenze personalizzate e varie</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Nuova Scadenza
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Totale Scadenze
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scadenzeFiltrate.length}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Scadute
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {scadenzeScadute.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Prossimi 7 giorni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {scadenze7Giorni.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Prossimi 30 giorni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {scadenze30Giorni.length}
            </div>
          </CardContent>
        </Card>

        <div className="mb-6">
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filtra per tipo" />
            </SelectTrigger>
            <SelectContent>
              {TIPI_SCADENZA_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {scadenzeFiltrate.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Nessuna scadenza trovata
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {filtroTipo === "tutti"
                ? "Vai in Impostazioni > Tipi Scadenze per configurare le prime scadenze"
                : "Nessuna scadenza configurata per questo tipo"}
            </p>
            {filtroTipo === "tutti" && (
              <Button
                className="mt-4"
                onClick={() => router.push("/impostazioni/tipi-scadenze")}
              >
                Configura Scadenze
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Scadute */}
            {scadenzeScadute.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h2 className="text-xl font-bold text-red-600">
                    Scadute ({scadenzeScadute.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {scadenzeScadute.map((scadenza) => (
                    <ScadenzaCard key={scadenza.id} scadenza={scadenza} />
                  ))}
                </div>
              </div>
            )}

            {/* Prossimi 7 giorni */}
            {scadenze7Giorni.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-orange-600" />
                  <h2 className="text-xl font-bold text-orange-600">
                    Prossimi 7 giorni ({scadenze7Giorni.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {scadenze7Giorni.map((scadenza) => (
                    <ScadenzaCard key={scadenza.id} scadenza={scadenza} />
                  ))}
                </div>
              </div>
            )}

            {/* Prossimi 30 giorni */}
            {scadenze30Giorni.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-yellow-600" />
                  <h2 className="text-xl font-bold text-yellow-600">
                    Prossimi 30 giorni ({scadenze30Giorni.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {scadenze30Giorni.map((scadenza) => (
                    <ScadenzaCard key={scadenza.id} scadenza={scadenza} />
                  ))}
                </div>
              </div>
            )}

            {/* Oltre 30 giorni */}
            {scadenzeOltre30.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-green-600" />
                  <h2 className="text-xl font-bold text-green-600">
                    Oltre 30 giorni ({scadenzeOltre30.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {scadenzeOltre30.map((scadenza) => (
                    <ScadenzaCard key={scadenza.id} scadenza={scadenza} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
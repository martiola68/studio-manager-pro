import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/services/authService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Building2, Settings, Shield, FileText, ChevronRight, Briefcase, CalendarCog } from "lucide-react";
import Link from "next/link";

export default function ImpostazioniPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
      // Verifica se è Admin
      const { data: utente } = await supabase
        .from("tbutenti")
        .select("tipo_utente")
        .eq("email", authUser.email)
        .single();

      if (utente?.tipo_utente !== "Admin") {
        router.push("/dashboard");
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    } catch (error) {
      console.error("Errore verifica autenticazione:", error);
      router.push("/login");
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

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Impostazioni</h1>
        <p className="text-gray-500 mt-1">Configurazione generale del sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/impostazioni/utenti">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-600">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Gestione Utenti</CardTitle>
                  <CardDescription>Crea e modifica utenti</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Gestisci gli utenti del sistema, assegna ruoli e permessi
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/impostazioni/ruoli">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-purple-600">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Shield className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Ruoli Operatori</CardTitle>
                  <CardDescription>Gestisci i ruoli</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Definisci i ruoli operativi per la classificazione degli utenti
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/impostazioni/prestazioni">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-green-600">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Briefcase className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>Tipi Prestazione</CardTitle>
                  <CardDescription>Gestisci servizi offerti</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Configura i tipi di prestazione professionale dello studio
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/impostazioni/studio">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-orange-600">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <CardTitle>Dati Studio</CardTitle>
                  <CardDescription>Anagrafica e logo</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Modifica i dati anagrafici dello studio e carica il logo
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/impostazioni/scadenzari">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-red-600">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 rounded-lg">
                  <CalendarCog className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <CardTitle>Generazione Scadenzari</CardTitle>
                  <CardDescription>Archivia e genera</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Archivia scadenze anno precedente e genera nuovi scadenzari
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/impostazioni/tipi-scadenze">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-teal-600">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-teal-100 rounded-lg">
                  <CalendarCog className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <CardTitle>Tipi Scadenze</CardTitle>
                  <CardDescription>Configura date e preavvisi</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Gestisci le date di scadenza centralizzate e le regole di notifica
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { studioService } from "@/services/studioService";
import { User, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/supabase/types";
import { hardLogout } from "@/services/logoutService";

type Studio = Database["public"]["Tables"]["tbstudio"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

interface HeaderProps {
  onMenuToggle?: () => void;
  title?: string;
}

export default function Header({ onMenuToggle, title }: HeaderProps) {
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);

  const loadUserAndStudio = async () => {
    try {
      const supabase = getSupabaseClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setCurrentUser(null);
        return;
      }

      const email = session.user.email;

      if (email) {
        const { data: utente, error: utenteError } = await supabase
          .from("tbutenti")
          .select("*")
          .eq("email", email)
          .single();

        if (utenteError) {
          console.warn("Impossibile caricare utente:", utenteError.message);
          setCurrentUser(null);
        } else {
          setCurrentUser(utente ?? null);
        }
      }

      const studioData = await studioService.getStudio();
      setStudio(studioData);
    } catch (e) {
      console.error("Errore caricamento dati header:", e);
    }
  };

  useEffect(() => {
    const supabase = getSupabaseClient();

    loadUserAndStudio();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setCurrentUser(null);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadUserAndStudio();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    console.log("🚪 Logout HARD in corso...");
    await hardLogout("/login");
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-50 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuToggle}
          >
            <Menu className="h-6 w-6" />
          </Button>

          {studio?.logo_url ? (
            <img
              src={studio.logo_url}
              alt="Logo Studio"
              className="h-12 w-auto object-contain"
            />
          ) : (
            <img
              src="/logo-elma.png"
              alt="ELMA Software"
              className="h-12 w-auto object-contain"
            />
          )}

          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {title ||
                studio?.denominazione_breve ||
                studio?.ragione_sociale ||
                "Studio Manager Pro"}
            </h1>
            <p className="text-sm text-gray-500">Sistema Gestionale Integrato</p>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                {currentUser.nome} {currentUser.cognome}
              </p>
              <p className="text-xs text-gray-500">
                {currentUser.tipo_utente === "Admin" ? "Amministratore" : "Utente"}
              </p>
            </div>

            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-gray-600 hover:text-red-600"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

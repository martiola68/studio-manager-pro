import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { studioService } from "@/services/studioService";
import { utenteService } from "@/services/utenteService";
import { User, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import type { Database } from "@/lib/supabase/types";

type Studio = Database["public"]["Tables"]["tbstudio"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

interface HeaderProps {
  onMenuToggle?: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadUserAndStudio();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setCurrentUser(null);
        router.push("/login");
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadUserAndStudio();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loadUserAndStudio = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const utenti = await utenteService.getUtenti();
        if (utenti.length > 0) {
            setCurrentUser(utenti[0]);
        }
      }

      const studioData = await studioService.getStudio();
      setStudio(studioData);
    } catch (error) {
      console.error("Errore caricamento dati header:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Errore logout:", error);
    }
  };

  const getInitials = (text: string): string => {
    return text
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-50 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
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
            <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
              {studio?.denominazione_breve ? getInitials(studio.denominazione_breve) : "SMP"}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {studio?.denominazione_breve || studio?.ragione_sociale || "Studio Manager Pro"}
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
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
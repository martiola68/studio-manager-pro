import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { studioService } from "@/services/studioService";
import { User, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hardLogout } from "@/services/logoutService";
import type { Database } from "@/lib/supabase/types";

type Studio = Database["public"]["Tables"]["tbstudio"]["Row"];
type UtenteRow = Database["public"]["Tables"]["tbutenti"]["Row"];

type HeaderUser = Pick<
  UtenteRow,
  | "id"
  | "nome"
  | "cognome"
  | "email"
  | "tipo_utente"
  | "studio_id"
  | "settore"
  | "ruolo_operatore_id"
  | "attivo"
  | "microsoft_connection_id"
>;

interface HeaderProps {
  onMenuToggle?: () => void;
  title?: string;
}

export default function Header({ onMenuToggle, title }: HeaderProps) {
  const [currentUser, setCurrentUser] = useState<HeaderUser | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);

  const getStudioLabelForUser = (
    utente: HeaderUser | null,
    studioData: Studio | null
  ) => {
    if (!studioData) return "";

    if (!utente?.microsoft_connection_id) {
      return studioData.ragione_sociale || "";
    }

    const isTenantSecondario =
      !!studioData.microsoft_connection_id_tenant2 &&
      utente.microsoft_connection_id === studioData.microsoft_connection_id_tenant2;

    if (isTenantSecondario) {
      return studioData.ragione_sociale_tenant2 || studioData.ragione_sociale || "";
    }

    return studioData.ragione_sociale || "";
  };

  const displayedStudioName = useMemo(() => {
    return getStudioLabelForUser(currentUser, studio);
  }, [currentUser, studio]);

  const loadUserAndStudio = async () => {
    try {
      const supabase = getSupabaseClient();

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        setCurrentUser(null);
        setStudio(null);
        return;
      }

      const email = session.user.email ?? null;
      if (!email) {
        setCurrentUser(null);
        setStudio(null);
        return;
      }

      const { data: utente, error: utenteError } = await supabase
        .from("tbutenti")
        .select(
          "id, nome, cognome, email, tipo_utente, studio_id, settore, ruolo_operatore_id, attivo, microsoft_connection_id"
        )
        .eq("email", email)
        .maybeSingle();

      if (utenteError) {
        console.warn("Impossibile caricare utente:", utenteError.message);
        setCurrentUser(null);
      } else {
        setCurrentUser((utente ?? null) as HeaderUser | null);
      }

      const studioData = await studioService.getStudio();
      setStudio((studioData ?? null) as Studio | null);
    } catch (e) {
      console.error("Errore caricamento dati header:", e);
      setCurrentUser(null);
      setStudio(null);
    }
  };

  useEffect(() => {
    const supabase = getSupabaseClient();

    loadUserAndStudio();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          setCurrentUser(null);
          setStudio(null);
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          loadUserAndStudio();
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await hardLogout("/login");
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={onMenuToggle}
            >
              <Menu className="h-6 w-6" />
            </Button>

            <img
              src="/logo-elma.png"
              alt="Studio Manager Pro"
              className="h-10 md:h-12 w-auto object-contain shrink-0"
            />

            <div className="min-w-0 hidden sm:block">
              <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-tight">
                {title || "Studio Manager Pro"}
              </h1>
              <p className="text-xs md:text-sm text-gray-500">
                Sistema Gestionale Integrato
              </p>
            </div>
          </div>

          {currentUser && (
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900 leading-tight">
                  {currentUser.nome} {currentUser.cognome}
                </p>
                <p className="text-xs text-gray-500">
                  {currentUser.tipo_utente === "Admin" ? "Amministratore" : "Utente"}
                </p>
              </div>

              <div className="h-9 w-9 md:h-10 md:w-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-blue-600" />
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-gray-600 hover:text-red-600 shrink-0"
                aria-label="Logout"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>

        <div className="mt-2 text-center">
          <div className="sm:hidden">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              {title || "Studio Manager Pro"}
            </h1>
            <p className="text-xs text-gray-500">Sistema Gestionale Integrato</p>
          </div>

          {currentUser && (
            <div className="text-xs md:text-sm text-gray-700 font-medium mt-1 break-words">
              Utente: {currentUser.nome} {currentUser.cognome}
              {displayedStudioName ? ` - ${displayedStudioName}` : ""}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 px-4 md:px-6 py-2 text-[10px] md:text-xs text-gray-500 text-center">
        © {new Date().getFullYear()} Studio Manager Pro. Creato da Artiola Mario.
        Tutti i diritti riservati. Opera tutelata ai sensi della Legge 22 aprile
        1941, n. 633, e successive modificazioni.
      </div>
    </header>
  );
}

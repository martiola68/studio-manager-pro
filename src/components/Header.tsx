import { useEffect, useState } from "react";
import { getCurrentUser, getStudio } from "@/lib/db";
import { Utente, Studio } from "@/types";
import { User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";

export function Header() {
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const router = useRouter();

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    setStudio(getStudio());

    const handleStorageChange = () => {
      setCurrentUser(getCurrentUser());
      setStudio(getStudio());
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("studio-updated", handleStorageChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("studio-updated", handleStorageChange);
    };
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("smp_current_user");
      router.push("/login");
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
          {studio?.Logo ? (
            <img 
              src={studio.Logo} 
              alt="Logo Studio" 
              className="h-12 w-auto object-contain"
            />
          ) : (
            <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
              {studio?.DenominazioneBreve ? getInitials(studio.DenominazioneBreve) : "SMP"}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {studio?.DenominazioneBreve || studio?.RagioneSociale || "Studio Manager Pro"}
            </h1>
            <p className="text-sm text-gray-500">Sistema Gestionale Integrato</p>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                {currentUser.Nome} {currentUser.Cognome}
              </p>
              <p className="text-xs text-gray-500">
                {currentUser.TipoUtente === "Admin" ? "Amministratore" : "Utente"}
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
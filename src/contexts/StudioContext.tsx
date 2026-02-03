import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface StudioContextType {
  studioId: string | null;
  isLoading: boolean;
}

const StudioContext = createContext<StudioContextType>({
  studioId: null,
  isLoading: false,
});

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error("useStudio must be used within StudioProvider");
  }
  return context;
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [studioId, setStudioId] = useState<string | null>(null);
  const [isLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    async function loadStudioId() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user || !isMounted) return;

        const { data: utente } = await supabase
          .from("tbutenti")
          .select("studio_id")
          .eq("id", user.id)
          .maybeSingle();
        
        if (isMounted && utente?.studio_id) {
          setStudioId(utente.studio_id);
        }
      } catch (error) {
        console.error("Errore caricamento studio_id:", error);
      }
    }

    loadStudioId();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user && isMounted) {
          const { data: utente } = await supabase
            .from("tbutenti")
            .select("studio_id")
            .eq("id", session.user.id)
            .maybeSingle();
          
          if (utente?.studio_id && isMounted) {
            setStudioId(utente.studio_id);
          }
        } else if (event === "SIGNED_OUT" && isMounted) {
          setStudioId(null);
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <StudioContext.Provider value={{ studioId, isLoading }}>
      {children}
    </StudioContext.Provider>
  );
}
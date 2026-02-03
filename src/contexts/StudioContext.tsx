import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface StudioContextType {
  studioId: string | null;
  isLoading: boolean;
}

const StudioContext = createContext<StudioContextType>({
  studioId: null,
  isLoading: true,
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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    async function loadStudioId() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (isMounted) {
            setIsLoading(false);
          }
          return;
        }

        const { data: utente, error } = await supabase
          .from("tbutenti")
          .select("studio_id")
          .eq("id", user.id)
          .single();
        
        if (error) {
          console.error("Errore caricamento studio_id:", error);
          if (isMounted) {
            setIsLoading(false);
          }
          return;
        }
        
        if (isMounted && utente?.studio_id) {
          setStudioId(utente.studio_id);
          console.log("Studio ID caricato:", utente.studio_id);
        }
        
        if (isMounted) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Errore nel caricamento dello studio_id:", error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStudioId();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user && isMounted) {
          try {
            const { data: utente, error } = await supabase
              .from("tbutenti")
              .select("studio_id")
              .eq("id", session.user.id)
              .single();
            
            if (!error && utente?.studio_id && isMounted) {
              setStudioId(utente.studio_id);
              console.log("Studio ID aggiornato:", utente.studio_id);
            }
          } catch (error) {
            console.error("Errore aggiornamento studio_id:", error);
          }
        } else if (event === "SIGNED_OUT" && isMounted) {
          setStudioId(null);
          console.log("Studio ID rimosso");
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
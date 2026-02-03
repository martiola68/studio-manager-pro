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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function loadStudioId() {
      try {
        // Timeout di 5 secondi per evitare blocchi infiniti
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );

        const loadPromise = (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) {
            console.log('📍 Nessun utente autenticato');
            return null;
          }

          const { data: utente, error } = await supabase
            .from("tbutenti")
            .select("studio_id")
            .eq("id", user.id)
            .single();
          
          if (error) {
            console.error("❌ Errore caricamento studio_id:", error);
            return null;
          }
          
          console.log('✅ Studio ID caricato:', utente?.studio_id);
          return utente?.studio_id || null;
        })();

        // Race tra caricamento e timeout
        const result = await Promise.race([loadPromise, timeoutPromise]) as string | null;
        
        if (isMounted && result) {
          setStudioId(result);
        }
      } catch (error) {
        console.warn('⚠️ Caricamento studio_id fallito o timeout:', error);
        // Non bloccare l'app se fallisce
      } finally {
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
              console.log('✅ Studio ID aggiornato dopo login:', utente.studio_id);
            }
          } catch (error) {
            console.warn('⚠️ Errore aggiornamento studio_id dopo auth:', error);
          }
        } else if (event === "SIGNED_OUT" && isMounted) {
          setStudioId(null);
          console.log('🔓 Studio ID rimosso dopo logout');
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
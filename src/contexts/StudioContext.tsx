import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface StudioContextType {
  studioId: string | null;
}

const StudioContext = createContext<StudioContextType>({
  studioId: null,
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

  useEffect(() => {
    async function loadStudioId() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: utente, error } = await supabase
            .from("tbutenti")
            .select("studio_id")
            .eq("id", user.id)
            .single();
          
          if (error) {
            console.error("Error loading studio_id:", error);
            return;
          }
          
          if (utente?.studio_id) {
            setStudioId(utente.studio_id);
          }
        }
      } catch (error) {
        console.error("Error loading studio_id:", error);
      }
    }

    loadStudioId();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          try {
            const { data: utente, error } = await supabase
              .from("tbutenti")
              .select("studio_id")
              .eq("id", session.user.id)
              .single();
            
            if (error) {
              console.error("Error loading studio_id on auth change:", error);
              return;
            }
            
            if (utente?.studio_id) {
              setStudioId(utente.studio_id);
            }
          } catch (error) {
            console.error("Error in auth state change:", error);
          }
        } else if (event === "SIGNED_OUT") {
          setStudioId(null);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <StudioContext.Provider value={{ studioId }}>
      {children}
    </StudioContext.Provider>
  );
}
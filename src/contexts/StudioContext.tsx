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
    let mounted = true;
    
    const loadStudio = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted) return;

        const { data } = await supabase
          .from("tbutenti")
          .select("studio_id")
          .eq("id", user.id)
          .maybeSingle();
        
        if (mounted && data?.studio_id) {
          setStudioId(data.studio_id);
        }
      } catch (err) {
        console.error("Studio load error:", err);
      }
    };

    loadStudio();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user && mounted) {
        const { data } = await supabase
          .from("tbutenti")
          .select("studio_id")
          .eq("id", session.user.id)
          .maybeSingle();
        
        if (mounted && data?.studio_id) {
          setStudioId(data.studio_id);
        }
      } else if (event === "SIGNED_OUT" && mounted) {
        setStudioId(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <StudioContext.Provider value={{ studioId, isLoading }}>
      {children}
    </StudioContext.Provider>
  );
}
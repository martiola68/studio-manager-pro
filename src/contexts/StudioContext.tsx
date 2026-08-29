import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type ModuloLicenza = "aml" | "revisione" | "controllo_gestione";

interface StudioContextType {
  studioId: string | null;
  isLoading: boolean;
  piano: string | null;
  addons: string[];
  hasModule: (modulo: ModuloLicenza) => boolean;
  refreshStudio: () => Promise<void>;
}

const StudioContext = createContext<StudioContextType | null>(null);

function normalizzaPiano(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function leggiAddons(note: unknown): string[] {
  if (!note) return [];
  try {
    const parsed = typeof note === "string" ? JSON.parse(note) : note;
    return Array.isArray((parsed as any)?.addons)
      ? (parsed as any).addons.map((x: unknown) => String(x).trim().toLowerCase()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) throw new Error("useStudio must be used within StudioProvider");
  return context;
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [studioId, setStudioId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [piano, setPiano] = useState<string | null>(null);
  const [addons, setAddons] = useState<string[]>([]);

  const loadStudio = useCallback(async () => {
    const supabase = getSupabaseClient();
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setStudioId(null);
        setPiano(null);
        setAddons([]);
        return;
      }

      let { data: utente, error: utenteError } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      // Compatibilità con utenti storici nei quali user_id può non essere valorizzato.
      if ((!utente || utenteError) && session.user.email) {
        const fallback = await supabase
          .from("tbutenti")
          .select("studio_id")
          .eq("email", session.user.email.toLowerCase())
          .maybeSingle();
        utente = fallback.data;
        utenteError = fallback.error;
      }

      if (utenteError) throw utenteError;
      const resolvedStudioId = String(utente?.studio_id || "").trim();
      if (!resolvedStudioId) {
        setStudioId(null);
        setPiano(null);
        setAddons([]);
        return;
      }

      setStudioId(resolvedStudioId);

      const { data: licenza, error: licenzaError } = await supabase
        .from("tbsoftware_licenze")
        .select("piano, note, stato")
        .eq("studio_id", resolvedStudioId)
        .eq("stato", "attivo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (licenzaError) {
        console.error("[StudioContext] Errore caricamento licenza:", licenzaError);
        setPiano(null);
        setAddons([]);
        return;
      }

      setPiano(licenza?.piano ? String(licenza.piano) : null);
      setAddons(leggiAddons(licenza?.note));
    } catch (error) {
      console.error("[StudioContext] Impossibile risolvere il tenant:", error);
      // FAIL CLOSED: in caso di dubbio non manteniamo mai un tenant precedente.
      setStudioId(null);
      setPiano(null);
      setAddons([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStudio();
    const supabase = getSupabaseClient();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void loadStudio());
    return () => listener.subscription.unsubscribe();
  }, [loadStudio]);

  const hasModule = useCallback((modulo: ModuloLicenza) => {
    const p = normalizzaPiano(piano);
    if (p.includes("full")) return true;
    if (modulo === "aml") return addons.includes("aml");
    if (modulo === "revisione") return addons.includes("revisione") || addons.includes("revisione_controllo");
    if (modulo === "controllo_gestione") return addons.includes("controllo_gestione");
    return false;
  }, [piano, addons]);

  const value = useMemo(() => ({ studioId, isLoading, piano, addons, hasModule, refreshStudio: loadStudio }), [studioId, isLoading, piano, addons, hasModule, loadStudio]);

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

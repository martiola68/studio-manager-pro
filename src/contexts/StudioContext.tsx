import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  const initializedRef = useRef(false);
  const loadInFlightRef = useRef(false);
  const loadedUserIdRef = useRef<string | null>(null);

  const loadStudio = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    const initialLoad = !initializedRef.current;
    const supabase = getSupabaseClient();
    if (initialLoad) setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        loadedUserIdRef.current = null;
        setStudioId(null);
        setPiano(null);
        setAddons([]);
        return;
      }

      loadedUserIdRef.current = session.user.id;

      let { data: utente, error: utenteError } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

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

      const db = supabase as any;
      const { data: licenza, error: licenzaError } = await db
        .from("tbsoftware_licenze")
        .select("piano, note, stato")
        .eq("studio_id", resolvedStudioId)
        .eq("stato", "attivo")
        .limit(1)
        .maybeSingle();

      if (licenzaError) {
        console.error("[StudioContext] Errore caricamento licenza:", licenzaError);
        if (initialLoad) {
          setPiano(null);
          setAddons([]);
        }
        return;
      }

      setPiano(licenza?.piano ? String(licenza.piano) : null);
      setAddons(leggiAddons(licenza?.note));
    } catch (error) {
      console.error("[StudioContext] Impossibile risolvere il tenant:", error);
      if (initialLoad) {
        setStudioId(null);
        setPiano(null);
        setAddons([]);
      }
    } finally {
      initializedRef.current = true;
      loadInFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStudio();
    const supabase = getSupabaseClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id || null;

      if (event === "SIGNED_OUT") {
        loadedUserIdRef.current = null;
        setStudioId(null);
        setPiano(null);
        setAddons([]);
        setIsLoading(false);
        return;
      }

      // Supabase può emettere SIGNED_IN/TOKEN_REFRESHED quando una scheda torna in primo piano.
      // Se è lo stesso utente non ricarichiamo tenant/licenza e non smontiamo il modulo corrente.
      if (event === "TOKEN_REFRESHED") return;
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && userId === loadedUserIdRef.current) return;

      if (event === "USER_UPDATED" || ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && userId)) {
        void loadStudio();
      }
    });
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

  const value = useMemo(
    () => ({ studioId, isLoading, piano, addons, hasModule, refreshStudio: loadStudio }),
    [studioId, isLoading, piano, addons, hasModule, loadStudio]
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

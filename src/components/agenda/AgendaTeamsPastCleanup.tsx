import { useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export function AgendaTeamsPastCleanup() {
  useEffect(() => {
    let cancelled = false;

    const cleanup = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || cancelled) return;

        const response = await fetch("/api/agenda/cleanup-teams-passati", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error || "Pulizia riunioni Teams passate non riuscita");
        }

        const result = await response.json().catch(() => ({ deleted: 0 }));
        if (!cancelled && Number(result?.deleted || 0) > 0) {
          window.dispatchEvent(new CustomEvent("agenda-updated"));
          window.setTimeout(() => window.location.reload(), 150);
        }
      } catch (error) {
        console.error("Errore pulizia riunioni Teams passate:", error);
      }
    };

    void cleanup();
    return () => { cancelled = true; };
  }, []);

  return null;
}

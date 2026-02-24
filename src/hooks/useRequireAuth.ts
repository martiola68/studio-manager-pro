import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";

type UseRequireAuthResult = {
  ready: boolean;
  session: Session | null;
};

export function useRequireAuth(): UseRequireAuthResult {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error) console.error("[useRequireAuth] getSession error:", error);

        const s = data?.session ?? null;
        setSession(s);

        // ✅ redirect auth SOLO QUI
        if (!s?.access_token) {
          router.replace("/login");
          return;
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void sync();

    const supabase = getSupabaseClient();

    // ✅ tieni allineato lo stato quando cambia auth
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (cancelled) return;

      setSession(newSession ?? null);

      if (!newSession?.access_token) {
        router.replace("/login");
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return { ready, session };
}

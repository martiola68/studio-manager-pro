import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
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

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error) console.error("[useRequireAuth] getSession error:", error);

        const s = data?.session ?? null;
        setSession(s);

        // Se NON c'è sessione → vai a /login e stop
        if (!s?.access_token) {
          router.replace("/login");
          return;
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return { ready, session };
}

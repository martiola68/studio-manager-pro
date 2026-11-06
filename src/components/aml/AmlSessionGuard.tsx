import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AML_INTERFACE_KEY } from "./AmlShell";

/**
 * Vercel preview URLs have their own browser session/cookies.
 * An unauthenticated visitor must see the login flow, not a misleading
 * "Modulo non abilitato" error from the licensing guard.
 *
 * This is a UI/session gate, not a replacement for API authorization or RLS.
 */
export function AmlSessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"verifying" | "authenticated" | "login-required">("verifying");

  useEffect(() => {
    if (!router.isReady) return;
    let active = true;
    const supabase = getSupabaseClient();

    const verify = async () => {
      try {
        // Validate with Supabase Auth (rather than trusting only local storage).
        const { data, error } = await supabase.auth.getUser();
        if (!active) return;
        if (error || !data.user) {
          setStatus("login-required");
          const target = router.asPath.startsWith("/") && !router.asPath.startsWith("//")
            ? router.asPath
            : "/aml";
          sessionStorage.setItem(AML_INTERFACE_KEY, "1");
          void router.replace(`/login?next=${encodeURIComponent(target)}`);
          return;
        }
        setStatus("authenticated");
      } catch {
        if (!active) return;
        setStatus("login-required");
        sessionStorage.setItem(AML_INTERFACE_KEY, "1");
        void router.replace("/login?next=%2Faml");
      }
    };

    void verify();
    return () => { active = false; };
  // We recheck on navigation, not on query-string changes.
  }, [router.isReady, router.pathname]);

  if (status === "authenticated") return <>{children}</>;

  return (
    <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-blue-600" />
      <h1 className="text-xl font-bold text-slate-900">
        {status === "verifying" ? "Verifica accesso SMP AML" : "Accedi per continuare"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        {status === "verifying"
          ? "Controllo della sessione in corso..."
          : "Questa anteprima Vercel usa una sessione di accesso distinta da quella dell'app pubblicata. Accedi con il tuo account Studio Manager Pro per visualizzare i dati autorizzati."}
      </p>
      {status === "login-required" && (
        <Link href="/login?next=%2Faml" className="mt-5 inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
          Vai all'accesso SMP
        </Link>
      )}
    </div>
  );
}

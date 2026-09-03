import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { StudioProvider } from "@/contexts/StudioContext";
import { ModuleAccessGuard } from "@/components/security/ModuleAccessGuard";
import { ClientiImportTemplateEnhancer } from "@/components/ClientiImportTemplateEnhancer";
import { Toaster } from "@/components/ui/toaster";

// Layout (Header + Nav) SOLO per pagine private
import Header from "@/components/Header";
import { TopNavBar } from "@/components/TopNavBar";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [scadenzariCleanupPending, setScadenzariCleanupPending] = useState(false);

  const isScadenzarioPage = router.pathname.startsWith("/scadenze/");

  useEffect(() => {
    if (!router.isReady || !isScadenzarioPage) return;

    let cancelled = false;

    const cleanup = async () => {
      setScadenzariCleanupPending(true);

      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) return;

        const response = await fetch("/api/scadenzari/cleanup-inattivi", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error || "Pulizia scadenzari non riuscita");
        }
      } catch (error) {
        console.error("Errore pulizia clienti inattivi dagli scadenzari:", error);
      } finally {
        if (!cancelled) setScadenzariCleanupPending(false);
      }
    };

    void cleanup();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, router.pathname, isScadenzarioPage]);

  // Pagine pubbliche / standalone: niente layout
  const isPublicPage =
    router.pathname === "/login" ||
    router.pathname === "/auth/callback" ||
    router.pathname === "/404" ||
    router.pathname === "/mobile/agenda" ||
    router.asPath.startsWith("/documento/") ||
    router.asPath.startsWith("/compilazione-av4/") ||
    router.asPath.startsWith("/stampa/");

  const pageClass = [
    router.pathname === "/presenze" ? "presenze-page" : "",
    router.pathname === "/clienti/organi-sociali" ? "organi-sociali-page" : "",
    router.pathname === "/microsoft365" ? "microsoft365-page" : "",
    router.pathname === "/scadenze/iva" ? "!min-h-0 !overflow-hidden" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const pageContent =
    isScadenzarioPage && scadenzariCleanupPending ? (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-gray-500">
        Aggiornamento scadenzari...
      </div>
    ) : (
      <Component {...pageProps} />
    );

  return (
    <ThemeProvider>
      <StudioProvider>
        {router.pathname === "/clienti" && <ClientiImportTemplateEnhancer />}
        {isPublicPage ? (
          <>
            {pageContent}
            <Toaster />
          </>
        ) : (
          <div className="flex min-h-screen flex-col bg-gray-50">
            <div className="sticky top-0 z-50">
              <Header onMenuToggle={() => {}} />
              <TopNavBar />
            </div>
            <main
              className={`flex-1 overflow-y-auto px-4 pb-4 pt-0 md:px-6 md:pb-6 md:pt-0 ${pageClass}`}
            >
              <ModuleAccessGuard>
                {pageContent}
              </ModuleAccessGuard>
            </main>
            <Toaster />
          </div>
        )}
      </StudioProvider>
    </ThemeProvider>
  );
}

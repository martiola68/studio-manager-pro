import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { StudioProvider } from "@/contexts/StudioContext";
import { ModuleAccessGuard } from "@/components/security/ModuleAccessGuard";
import { ClientiImportTemplateEnhancer } from "@/components/ClientiImportTemplateEnhancer";
import { AgendaMasterGraficaEnhancer } from "@/components/agenda/AgendaMasterGraficaEnhancer";
import { AgendaTeamsPastCleanup } from "@/components/agenda/AgendaTeamsPastCleanup";
import { CalendarioMasterGraficaEnhancer } from "@/components/scadenze/CalendarioMasterGraficaEnhancer";
import { CassettiFiscaliMasterGraficaEnhancer } from "@/components/cassetti-fiscali/CassettiFiscaliMasterGraficaEnhancer";
import { AccessoPortaliMasterGraficaEnhancer } from "@/components/accesso-portali/AccessoPortaliMasterGraficaEnhancer";
import { ComunicazioniClientiMasterGraficaEnhancer } from "@/components/comunicazioni/ComunicazioniClientiMasterGraficaEnhancer";
import { ComunicazioniInterneMasterGraficaEnhancer } from "@/components/comunicazioni/ComunicazioniInterneMasterGraficaEnhancer";
import { Toaster } from "@/components/ui/toaster";

import Header from "@/components/Header";
import { TopNavBar } from "@/components/TopNavBar";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

const SCADENZARI_VIEWPORT = new Set([
  "/scadenze/iva",
  "/scadenze/ccgg",
  "/scadenze/cu",
  "/scadenze/imu",
  "/scadenze/fiscali",
  "/scadenze/bilanci",
  "/scadenze/modello-770",
  "/scadenze/lipe",
  "/scadenze/esterometro",
  "/scadenze/elenco-generale",
  "/scadenze/calendario",
  "/scadenze/riepilogo",
]);

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [scadenzariCleanupPending, setScadenzariCleanupPending] = useState(false);

  const isScadenzarioPage = router.pathname.startsWith("/scadenze/");
  const isOperationalScadenzario = SCADENZARI_VIEWPORT.has(router.pathname);
  const isMasterGraficaPromemoria = router.pathname === "/promemoria";
  const isMasterGraficaAgenda = router.pathname === "/agenda";
  const isMasterGraficaCalendario = router.pathname === "/scadenze/calendario";
  const isMasterGraficaCassettiFiscali = router.pathname === "/cassetti-fiscali";
  const isMasterGraficaAccessoPortali = router.pathname === "/accesso-portali";
  const isMasterGraficaComunicazioniClienti = router.pathname === "/comunicazioni-clienti";
  const isMasterGraficaComunicazioniInterne = router.pathname === "/comunicazioni/interne";
  const isFixedViewportPage = isOperationalScadenzario || isMasterGraficaPromemoria || isMasterGraficaAgenda || isMasterGraficaCassettiFiscali || isMasterGraficaAccessoPortali || isMasterGraficaComunicazioniClienti || isMasterGraficaComunicazioniInterne;

  useEffect(() => {
    document.body.classList.toggle("master-grafica-promemoria", isMasterGraficaPromemoria);
    document.body.classList.toggle("master-grafica-agenda", isMasterGraficaAgenda);

    return () => {
      document.body.classList.remove("master-grafica-promemoria");
      document.body.classList.remove("master-grafica-agenda");
    };
  }, [isMasterGraficaPromemoria, isMasterGraficaAgenda]);

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
    isOperationalScadenzario ? "!min-h-0 !overflow-hidden" : "",
    isMasterGraficaPromemoria ? "promemoria-master-page !min-h-0 !overflow-hidden" : "",
    isMasterGraficaAgenda ? "agenda-master-page !min-h-0 !overflow-hidden" : "",
    isMasterGraficaCalendario ? "calendario-master-page" : "",
    isMasterGraficaCassettiFiscali ? "cassetti-fiscali-master-page !min-h-0 !overflow-hidden" : "",
    isMasterGraficaAccessoPortali ? "accesso-portali-master-page !min-h-0 !overflow-hidden" : "",
    isMasterGraficaComunicazioniClienti ? "comunicazioni-clienti-master-page !min-h-0 !overflow-hidden" : "",
    isMasterGraficaComunicazioniInterne ? "comunicazioni-interne-master-page !min-h-0 !overflow-hidden" : "",
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
        {isMasterGraficaAgenda && <AgendaMasterGraficaEnhancer />}
        {isMasterGraficaAgenda && <AgendaTeamsPastCleanup />}
        {isMasterGraficaCalendario && <CalendarioMasterGraficaEnhancer />}
        {isMasterGraficaCassettiFiscali && <CassettiFiscaliMasterGraficaEnhancer />}
        {isMasterGraficaAccessoPortali && <AccessoPortaliMasterGraficaEnhancer />}
        {isMasterGraficaComunicazioniClienti && <ComunicazioniClientiMasterGraficaEnhancer />}
        {isMasterGraficaComunicazioniInterne && <ComunicazioniInterneMasterGraficaEnhancer />}
        {isPublicPage ? (
          <>
            {pageContent}
            <Toaster />
          </>
        ) : (
          <div
            className={`flex min-h-screen flex-col bg-gray-50 ${
              isFixedViewportPage ? "h-screen overflow-hidden" : ""
            }`}
          >
            <div className="sticky top-0 z-50 shrink-0">
              <Header onMenuToggle={() => {}} />
              <TopNavBar />
            </div>
            <main
              className={`flex-1 overflow-y-auto px-4 pb-4 pt-0 md:px-6 md:pb-6 md:pt-0 ${pageClass}`}
            >
              <ModuleAccessGuard>{pageContent}</ModuleAccessGuard>
            </main>
            <Toaster />
          </div>
        )}
      </StudioProvider>
    </ThemeProvider>
  );
}

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

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

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
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ThemeProvider>
      <StudioProvider>
        {router.pathname === "/clienti" && <ClientiImportTemplateEnhancer />}
        {isPublicPage ? (
          <>
            <Component {...pageProps} />
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
                <Component {...pageProps} />
              </ModuleAccessGuard>
            </main>
            <Toaster />
          </div>
        )}
      </StudioProvider>
    </ThemeProvider>
  );
}

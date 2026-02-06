import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { StudioProvider } from "@/contexts/StudioContext";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Header from "@/components/Header";
import { TopNavBar } from "@/components/TopNavBar";
import { supabase } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  
  // Pagine pubbliche che non devono mostrare il layout
  const isPublicPage = router.pathname === "/login" || 
                       router.pathname === "/auth/callback" ||
                       router.pathname === "/404";

  useEffect(() => {
    // Setup session refresh e gestione errori
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event === "SIGNED_OUT" || event === "USER_DELETED") {
        // Pulizia completa su logout/cancellazione
        localStorage.clear();
        sessionStorage.clear();
        router.push("/login");
      }

      if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully");
      }

      // Gestione errori sessione
      if (event === "SIGNED_OUT" && !session) {
        const currentPath = router.pathname;
        // Evita loop se già su login
        if (currentPath !== "/login") {
          router.push("/login");
        }
      }
    });

    // Setup refresh automatico token ogni 50 minuti (prima della scadenza 60min)
    const refreshInterval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.error("Token refresh failed:", error);
          // Se refresh fallisce, redirect a login
          router.push("/login");
        }
      }
    }, 50 * 60 * 1000); // 50 minuti

    return () => {
      authListener?.subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [router]);

  return (
    <ThemeProvider>
      <StudioProvider>
        {isPublicPage ? (
          // Pagine pubbliche: solo il componente senza layout
          <>
            <Component {...pageProps} />
            <Toaster />
          </>
        ) : (
          // Pagine private: con layout completo (Header + TopNavBar)
          <div className="flex flex-col min-h-screen bg-gray-50">
            <Header onMenuToggle={() => {}} />
            <TopNavBar />
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
              <Component {...pageProps} />
            </main>
            <Toaster />
          </div>
        )}
      </StudioProvider>
    </ThemeProvider>
  );
}
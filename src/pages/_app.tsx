import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { StudioProvider } from "@/contexts/StudioContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { TopNavBar } from "@/components/TopNavBar";
import { supabase } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Pagine pubbliche che non devono mostrare il layout
  const isPublicPage = router.pathname === "/login" || 
                       router.pathname === "/auth/callback" ||
                       router.pathname === "/404";

  useEffect(() => {
    // ✅ FIX: Design Mode per Softgen Sandbox
    // Detection affidabile basata sulla presenza/validità della URL Supabase
    // Vercel (Production) ha SEMPRE queste variabili valorizzate correttamente
    // Softgen Sandbox le ha vuote o placeholder
    const isSandbox = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") ||
                      process.env.NEXT_PUBLIC_SUPABASE_URL === "";
    
    if (isSandbox) {
      console.log("Softgen Sandbox detected: Enabling Design Mode (Mock Session)");
      // Sandbox: Mock session per design/UI preview
      setUser({
        id: "sandbox-user-preview",
        email: "preview@softgen.sandbox",
        app_metadata: {},
        user_metadata: { 
          full_name: "Design Preview Mode" 
        },
        aud: "authenticated",
        created_at: new Date().toISOString()
      } as User);
      setLoading(false);
      return; // ⛔ STOP: Non inizializzare listener Supabase reale in Sandbox
    }

    // ✅ Vercel/Production: Auth listener Supabase normale
    // Questo codice viene eseguito SOLO su Vercel dove le env vars sono corrette
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Skip completo in sandbox
    const isSandbox = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") ||
                      process.env.NEXT_PUBLIC_SUPABASE_URL === "";
    
    if (isSandbox) return;

    // Setup session refresh e gestione errori (SOLO VERCEL)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event === "SIGNED_OUT") {
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
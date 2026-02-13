import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { StudioProvider } from "@/contexts/StudioContext";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { TopNavBar } from "@/components/TopNavBar";
import { Sidebar } from "@/components/Sidebar";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  
  const isPublicPage = router.pathname === "/login" || 
                       router.pathname === "/auth/callback" ||
                       router.pathname === "/404";

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !isPublicPage) {
        router.push("/login");
      }
    });

    return () => data.subscription.unsubscribe();
  }, [router, isPublicPage]);

  // Check for Microsoft OAuth callback errors
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=")) {
      const params = new URLSearchParams(hash.substring(1));
      const error = params.get("error");
      const errorDescription = params.get("error_description");
      
      console.error("Microsoft OAuth Error:", {
        error,
        errorDescription
      });
    }
  }, [router]);

  return (
    <ThemeProvider>
      <StudioProvider>
        {isPublicPage ? (
          <div className="min-h-screen bg-background">
            <Component {...pageProps} />
            <Toaster />
          </div>
        ) : (
          <div className="min-h-screen bg-background">
            <TopNavBar />
            <div className="flex h-[calc(100vh-4rem)]">
              <Sidebar />
              <main className="flex-1 overflow-auto p-6">
                <Component {...pageProps} />
              </main>
            </div>
            <Toaster />
          </div>
        )}
      </StudioProvider>
    </ThemeProvider>
  );
}
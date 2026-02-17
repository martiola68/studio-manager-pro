import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { StudioProvider } from "@/contexts/StudioContext";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { TopNavBar } from "@/components/TopNavBar";
import { supabase } from "@/lib/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Public routes (no layout, no auth required)
  const isPublicPage = useMemo(() => {
    return router.pathname === "/login" || router.pathname === "/auth/callback";
  }, [router.pathname]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // ✅ CRITICAL: getSession must run once on boot
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;

        if (error) {
          console.error("[Auth] getSession error:", error.message);
          setUser(null);
        } else {
          setUser(data.session?.user ?? null);
        }
      } finally {
        if (alive) setIsReady(true);
      }
    })();

    // ✅ Single listener only
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      if (!alive) return;
      setUser(session?.user ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ✅ AuthGate: single redirect point
  useEffect(() => {
    if (!isReady) return;

    const isAuthed = !!user;

    // If not authed and trying to access private page -> go login
    if (!isAuthed && !isPublicPage) {
      router.replace("/login");
      return;
    }

    // If authed and on login -> go dashboard
    if (isAuthed && router.pathname === "/login") {
      router.replace("/dashboard");
      return;
    }
  }, [isReady, user, isPublicPage, router]);

  // Loading screen while auth is resolving
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <StudioProvider>
        {isPublicPage ? (
          <>
            <Component {...pageProps} />
            <Toaster />
          </>
        ) : (
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

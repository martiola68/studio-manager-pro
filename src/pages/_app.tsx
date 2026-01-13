import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { Sidebar } from "@/components/Sidebar";
import Header from "@/components/Header";
import { useRouter } from "next/router";
import { useState } from "react";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLoginPage = router.pathname === "/login";
  const isAuthCallback = router.pathname === "/auth/callback";

  if (isLoginPage || isAuthCallback) {
    return (
      <ThemeProvider>
        <Component {...pageProps} />
        <Toaster />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="flex flex-col h-screen">
        <Header onMenuToggle={() => setMobileOpen(!mobileOpen)} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
          <main className="flex-1 overflow-auto bg-gray-50">
            <Component {...pageProps} />
          </main>
        </div>
      </div>
      <Toaster />
    </ThemeProvider>
  );
}
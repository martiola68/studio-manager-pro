import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { StudioProvider } from "@/contexts/StudioContext";
import { useRouter } from "next/router";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useState } from "react";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Pagine pubbliche che non devono mostrare il layout
  const isPublicPage = router.pathname === "/login" || 
                       router.pathname === "/auth/callback" ||
                       router.pathname === "/404";

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
          // Pagine private: con layout completo (Header + Sidebar)
          <div className="flex min-h-screen bg-gray-50">
            <Sidebar 
              mobileOpen={sidebarOpen} 
              onClose={() => setSidebarOpen(false)} 
            />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
              <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
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
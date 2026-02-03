import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { StudioProvider } from "@/contexts/StudioContext";
import { useRouter } from "next/router";
import Header from "@/components/Header";
import { TopNavBar } from "@/components/TopNavBar";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  
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
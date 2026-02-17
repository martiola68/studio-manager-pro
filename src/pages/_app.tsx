import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { StudioProvider } from "@/contexts/StudioContext";
import { Toaster } from "@/components/ui/toaster";

// Layout (Header + Nav) SOLO per pagine private
import Header from "@/components/Header";
import { TopNavBar } from "@/components/TopNavBar";
import { useRouter } from "next/router";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Pagine pubbliche: niente layout
  const isPublicPage =
    router.pathname === "/login" ||
    router.pathname === "/auth/callback" ||
    router.pathname === "/404";

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

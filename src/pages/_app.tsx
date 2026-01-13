import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { TopNavBar } from "@/components/TopNavBar";
import Header from "@/components/Header";
import { useRouter } from "next/router";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
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
        <Header onMenuToggle={() => {}} />
        <TopNavBar />
        <main className="flex-1 overflow-auto bg-gray-50">
          <Component {...pageProps} />
        </main>
      </div>
      <Toaster />
    </ThemeProvider>
  );
}
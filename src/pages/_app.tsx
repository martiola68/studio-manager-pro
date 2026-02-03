import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { StudioProvider } from "@/contexts/StudioContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <StudioProvider>
        <Component {...pageProps} />
        <Toaster />
      </StudioProvider>
    </ThemeProvider>
  );
}
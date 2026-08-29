import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { StudioProvider } from "@/contexts/StudioContext";
import { ModuleAccessGuard } from "@/components/security/ModuleAccessGuard";
import { Toaster } from "@/components/ui/toaster";

// Layout (Header + Nav) SOLO per pagine private
import Header from "@/components/Header";
import { TopNavBar } from "@/components/TopNavBar";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function AmlListSearch() {
  const [query, setQuery] = useState("");
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let observer: MutationObserver | null = null;

    const setupHost = () => {
      const select = Array.from(document.querySelectorAll("select")).find((item) =>
        Array.from(item.options).some((option) =>
          option.textContent?.includes("Seleziona soggetto responsabile")
        )
      );

      const container = select?.parentElement;
      if (!container) return false;

      let target = document.getElementById("aml-list-search-host");
      if (!target) {
        target = document.createElement("div");
        target.id = "aml-list-search-host";
        container.insertAdjacentElement("afterend", target);
      }

      setHost(target);
      return true;
    };

    if (!setupHost()) {
      observer = new MutationObserver(() => {
        if (setupHost()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      document.getElementById("aml-list-search-host")?.remove();
    };
  }, []);

  useEffect(() => {
    const applyFilter = () => {
      const normalized = query.trim().toLocaleLowerCase("it");

      document.querySelectorAll("main table tbody tr").forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 2) return;

        const cliente = (cells[1]?.textContent || "").toLocaleLowerCase("it");
        (row as HTMLElement).style.display =
          !normalized || cliente.includes(normalized) ? "" : "none";
      });
    };

    applyFilter();

    const main = document.querySelector("main");
    if (!main) return;

    const observer = new MutationObserver(applyFilter);
    observer.observe(main, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.querySelectorAll("main table tbody tr").forEach((row) => {
        (row as HTMLElement).style.display = "";
      });
    };
  }, [query]);

  if (!host) return null;

  return createPortal(
    <div className="mb-4 mt-3 max-w-md">
      <label className="mb-1 block text-sm font-medium">Ricerca cliente</label>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Cerca per nominativo..."
        className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
    </div>,
    host
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Pagine pubbliche / standalone: niente layout
  const isPublicPage =
    router.pathname === "/login" ||
    router.pathname === "/auth/callback" ||
    router.pathname === "/404" ||
    router.pathname === "/mobile/agenda" ||
    router.asPath.startsWith("/documento/") ||
    router.asPath.startsWith("/compilazione-av4/") ||
    router.asPath.startsWith("/stampa/");

  return (
    <ThemeProvider>
      <StudioProvider>
        {isPublicPage ? (
          <>
            <Component {...pageProps} />
            <Toaster />
          </>
        ) : (
          <div className="flex min-h-screen flex-col bg-gray-50">
            <div className="sticky top-0 z-50">
              <Header onMenuToggle={() => {}} />
              <TopNavBar />
            </div>
            <main
              className={`flex-1 overflow-y-auto px-4 pb-4 pt-0 md:px-6 md:pb-6 md:pt-0 ${
                router.pathname === "/presenze" ? "presenze-page" : ""
              }`}
            >
              <ModuleAccessGuard>
                <>
                  {router.pathname === "/antiriciclaggio" && <AmlListSearch />}
                  <Component {...pageProps} />
                </>
              </ModuleAccessGuard>
            </main>
            <Toaster />
          </div>
        )}
      </StudioProvider>
    </ThemeProvider>
  );
}

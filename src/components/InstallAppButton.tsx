"use client";

import { useEffect, useState } from "react";
import { Download, CheckCircle2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & {
      standalone?: boolean;
    };

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;

    setInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Registrazione service worker non riuscita:", error);
      });
    }

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstalled(true);
    }

    setInstallPrompt(null);
  };

  if (installed) {
    return (
      <div className="mt-4 flex items-center justify-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
        <CheckCircle2 className="h-5 w-5" />
        Studio Manager Pro è installato
      </div>
    );
  }

  return (
    <div className="mt-4">
      <Button
        type="button"
        variant="outline"
        className="w-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
        onClick={handleInstall}
      >
        <Download className="mr-2 h-5 w-5" />
        Installa Studio Manager Pro
      </Button>

      {showHelp && (
        <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-left text-xs leading-relaxed text-blue-800">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <Smartphone className="h-4 w-4" />
            Installazione dell’app
          </div>
          {isIOS ? (
            <p>
              Su iPhone o iPad tocca Condividi e scegli “Aggiungi alla schermata Home”.
            </p>
          ) : (
            <p>
              Se la finestra non compare, attendi qualche secondo e riprova. Il
              browser mostrerà il comando appena avrà completato la verifica
              dell’app.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

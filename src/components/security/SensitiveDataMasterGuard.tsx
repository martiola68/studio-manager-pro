"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import bcrypt from "bcryptjs";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useStudio } from "@/contexts/StudioContext";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  clearMasterPasswordEncryptionKey,
  syncEncryptionKeyFromMasterPassword,
} from "@/lib/security/masterPasswordEncryptionBridge";

const MASTER_UNLOCK_TIMEOUT = 15 * 60 * 1000;

const PROTECTED_PREFIXES = [
  "/clienti/organi-sociali",
  "/clienti/titolari-effettivi",
  "/anagrafiche/gruppi-societari",
  "/revisione-controllo",
  "/controllo-gestione",
  "/contatti",
  "/contenzioso",
  "/payroll",
  "/presenze",
  "/antiriciclaggio",
  "/scadenze",
  "/impostazioni/utenti",
  "/pratiche",
  "/comunicazioni-clienti",
  "/comunicazioni/interne",
  "/microsoft365",
] as const;

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function storageKey(studioId: string, userId: string) {
  return `smp_master_unlocked:${studioId}:${userId}`;
}

function activityKey(studioId: string, userId: string) {
  return `smp_master_last_activity:${studioId}:${userId}`;
}

function clearMasterSessionKeys() {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (
      key &&
      (key.startsWith("smp_master_unlocked:") ||
        key.startsWith("smp_master_last_activity:"))
    ) {
      keys.push(key);
    }
  }
  keys.forEach((key) => sessionStorage.removeItem(key));
}

export function SensitiveDataMasterGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { studioId, isLoading: studioLoading } = useStudio();
  const { toast } = useToast();

  const protectedPath = useMemo(
    () => isProtectedPath(router.pathname || ""),
    [router.pathname]
  );

  const [checking, setChecking] = useState(true);
  const [protectionEnabled, setProtectionEnabled] = useState(false);
  const [masterHash, setMasterHash] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const lock = useCallback(() => {
    if (typeof window !== "undefined" && studioId && userId) {
      sessionStorage.removeItem(storageKey(studioId, userId));
      sessionStorage.removeItem(activityKey(studioId, userId));
    }
    clearMasterPasswordEncryptionKey();
    setUnlocked(false);
    setPassword("");
  }, [studioId, userId]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearMasterSessionKeys();
        clearMasterPasswordEncryptionKey();
        setUnlocked(false);
        setUserId(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadProtection = async () => {
      if (!protectedPath || studioLoading) {
        if (!protectedPath) {
          setChecking(false);
          setProtectionEnabled(false);
        }
        return;
      }

      if (!studioId) {
        setChecking(false);
        setProtectionEnabled(false);
        setUnlocked(false);
        return;
      }

      setChecking(true);

      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const currentUserId = session?.user?.id || null;
        if (cancelled) return;
        setUserId(currentUserId);

        const { data: studio, error } = await (supabase as any)
          .from("tbstudio")
          .select("protezione_attiva, master_password_hash")
          .eq("id", studioId)
          .maybeSingle();

        if (error) throw error;
        if (cancelled) return;

        const enabled =
          studio?.protezione_attiva === true &&
          Boolean(studio?.master_password_hash);
        setProtectionEnabled(enabled);
        setMasterHash(studio?.master_password_hash || null);

        if (!enabled || !currentUserId || typeof window === "undefined") {
          setUnlocked(!enabled);
          return;
        }

        const unlockedKey = storageKey(studioId, currentUserId);
        const lastActivityKey = activityKey(studioId, currentUserId);
        const wasUnlocked = sessionStorage.getItem(unlockedKey) === "1";
        const lastActivity = Number(
          sessionStorage.getItem(lastActivityKey) || "0"
        );
        const stillValid =
          wasUnlocked &&
          lastActivity > 0 &&
          Date.now() - lastActivity <= MASTER_UNLOCK_TIMEOUT;

        if (stillValid) {
          setUnlocked(true);
          sessionStorage.setItem(lastActivityKey, String(Date.now()));
        } else {
          sessionStorage.removeItem(unlockedKey);
          sessionStorage.removeItem(lastActivityKey);
          clearMasterPasswordEncryptionKey();
          setUnlocked(false);
        }
      } catch (error) {
        console.error(
          "[SensitiveDataMasterGuard] Verifica protezione non riuscita:",
          error
        );
        // Non blocchiamo i flussi esistenti se il controllo configurazione fallisce.
        if (!cancelled) {
          setProtectionEnabled(false);
          setUnlocked(true);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    void loadProtection();
    return () => {
      cancelled = true;
    };
  }, [protectedPath, studioId, studioLoading, router.pathname]);

  useEffect(() => {
    if (
      !protectedPath ||
      !protectionEnabled ||
      !unlocked ||
      !studioId ||
      !userId
    ) {
      return;
    }

    const unlockedKey = storageKey(studioId, userId);
    const lastActivityKey = activityKey(studioId, userId);
    let lastWrite = 0;

    const markActivity = () => {
      const now = Date.now();
      if (now - lastWrite < 5000) return;
      lastWrite = now;
      sessionStorage.setItem(unlockedKey, "1");
      sessionStorage.setItem(lastActivityKey, String(now));
    };

    const checkTimeout = () => {
      const lastActivity = Number(
        sessionStorage.getItem(lastActivityKey) || "0"
      );
      if (!lastActivity || Date.now() - lastActivity > MASTER_UNLOCK_TIMEOUT) {
        lock();
      }
    };

    markActivity();
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "focus",
    ];
    events.forEach((event) =>
      window.addEventListener(event, markActivity, { passive: true })
    );
    const timer = window.setInterval(checkTimeout, 30000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActivity));
      window.clearInterval(timer);
    };
  }, [protectedPath, protectionEnabled, unlocked, studioId, userId, lock]);

  const handleUnlock = async () => {
    if (!masterHash || !studioId || !userId) return;

    try {
      setUnlocking(true);
      const valid = await bcrypt.compare(password, masterHash);
      if (!valid) {
        toast({
          title: "Master Password non corretta",
          description: "Verifica la password e riprova.",
          variant: "destructive",
        });
        return;
      }

      // Se lo studio usa anche la cifratura AES gia' esistente, proviamo a
      // sbloccarla con la stessa Master Password. Il bridge non inizializza
      // cifratura, non cambia salt e non migra alcun dato.
      const encryptionBridge = await syncEncryptionKeyFromMasterPassword(
        studioId,
        password
      );

      if (encryptionBridge.enabled && !encryptionBridge.unlocked) {
        console.info(
          "[SensitiveDataMasterGuard] Area sbloccata; chiave cifratura legacy non sincronizzata:",
          encryptionBridge.reason
        );
      }

      const now = Date.now();
      sessionStorage.setItem(storageKey(studioId, userId), "1");
      sessionStorage.setItem(activityKey(studioId, userId), String(now));
      setUnlocked(true);
      setDialogOpen(false);
      setPassword("");

      toast({
        title: "Dati sensibili sbloccati",
        description:
          "La protezione resta attiva fino a 15 minuti di inattività.",
      });
    } catch (error) {
      console.error("[SensitiveDataMasterGuard] Errore sblocco:", error);
      toast({
        title: "Errore",
        description: "Impossibile verificare la Master Password.",
        variant: "destructive",
      });
    } finally {
      setUnlocking(false);
    }
  };

  if (!protectedPath) return <>{children}</>;

  if (studioLoading || checking) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">
        Verifica protezione dati sensibili...
      </div>
    );
  }

  if (!protectionEnabled || unlocked) return <>{children}</>;

  return (
    <>
      <div className="flex min-h-[360px] items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <LockKeyhole className="h-6 w-6 text-slate-700" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Dati sensibili protetti
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Inserisci la Master Password dello studio per aprire quest&apos;area.
            La pagina resta invariata dopo lo sblocco.
          </p>
          <Button className="mt-6 gap-2" onClick={() => setDialogOpen(true)}>
            <ShieldCheck className="h-4 w-4" />
            Sblocca area
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Master Password</DialogTitle>
            <DialogDescription>
              La password viene verificata solo per autorizzare l&apos;accesso a
              questa sessione e non viene memorizzata.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              autoFocus
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Inserisci Master Password"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !unlocking) {
                  void handleUnlock();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => void handleUnlock()}
              disabled={unlocking || !password}
            >
              {unlocking ? "Verifica..." : "Sblocca"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

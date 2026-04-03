"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { unlockCassetti } from "@/services/encryptionService";

type PendingAction = (() => void | Promise<void>) | null;

type UseMasterPasswordGateParams = {
  studioId: string;
  onUnlocked?: () => void | Promise<void>;
};

export function useMasterPasswordGate({
  studioId,
  onUnlocked,
}: UseMasterPasswordGateParams) {
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [unlocking, setUnlocking] = useState(false);

  const requireUnlock = (action: () => void | Promise<void>) => {
    setPendingAction(() => action);
    setOpen(true);
  };

  const handleUnlock = async () => {
    try {
      if (!studioId) {
        toast({
          variant: "destructive",
          title: "Errore",
          description: "Studio non disponibile",
        });
        return;
      }

      setUnlocking(true);

      const result = await unlockCassetti(studioId, password);

      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Errore",
          description: result.error || "Password errata",
        });
        return;
      }

      if (onUnlocked) {
        await onUnlocked();
      }

      const action = pendingAction;

      setOpen(false);
      setPassword("");
      setPendingAction(null);

      toast({
        title: "🔓 Sbloccato",
        description: "Ora puoi usare i campi protetti.",
      });

      if (action) {
        await action();
      }
    } catch (error) {
      console.error("Unlock error:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile sbloccare i dati cifrati",
      });
    } finally {
      setUnlocking(false);
    }
  };

  const resetUnlockState = () => {
    setOpen(false);
    setPassword("");
    setPendingAction(null);
  };

  return {
    open,
    setOpen,
    password,
    setPassword,
    unlocking,
    requireUnlock,
    handleUnlock,
    resetUnlockState,
  };
}

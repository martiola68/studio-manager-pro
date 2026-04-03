"use client";

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
import { Loader2, Unlock } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  onUnlock: () => void | Promise<void>;
  loading?: boolean;
};

export function MasterPasswordDialog({
  open,
  onOpenChange,
  password,
  onPasswordChange,
  onUnlock,
  loading = false,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🔒 Sblocca Dati Cifrati</DialogTitle>
          <DialogDescription>
            Inserisci la Master Password per visualizzare, copiare o salvare i campi cifrati.
            <br />
            <span className="text-sm text-orange-600 mt-2 block">
              💡 Se non l’hai configurata: <strong>Impostazioni → Dati Studio</strong>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Master Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Inserisci Master Password"
              onKeyDown={(e) => {
                if (e.key === "Enter") onUnlock();
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onUnlock} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Unlock className="mr-2 h-4 w-4" />
            )}
            Sblocca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

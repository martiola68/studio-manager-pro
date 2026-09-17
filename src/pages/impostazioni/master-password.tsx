import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import bcrypt from "bcryptjs";
import { Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { studioService } from "@/services/studioService";
import { passwordResetService } from "@/services/passwordResetService";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Studio = Database["public"]["Tables"]["tbstudio"]["Row"];

export default function MasterPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [showResetRequestDialog, setShowResetRequestDialog] = useState(false);
  const [showOTPDialog, setShowOTPDialog] = useState(false);
  const [showNewPasswordDialog, setShowNewPasswordDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpTokenId, setOtpTokenId] = useState<string | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const loadStudio = async () => {
    const studioData = await studioService.getStudio();
    setStudio(studioData);
    setIsPasswordProtected(Boolean(studioData?.protezione_attiva));
  };

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user?.email) {
          await router.replace("/login");
          return;
        }

        const { data: utente, error } = await supabase
          .from("tbutenti")
          .select("tipo_utente")
          .eq("email", session.user.email)
          .maybeSingle();

        if (error) throw error;
        if (utente?.tipo_utente !== "Admin") {
          await router.replace("/dashboard");
          return;
        }

        await loadStudio();
      } catch (error) {
        console.error("Errore caricamento gestione Master Password:", error);
        toast({
          title: "Errore",
          description: "Impossibile caricare la gestione della Master Password",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPasswordStrength = (password: string) => {
    if (password.length < 8) return { label: "Debole", color: "text-red-600" };
    if (password.length < 12) return { label: "Media", color: "text-amber-600" };
    return { label: "Forte", color: "text-emerald-600" };
  };

  const handleToggleProtection = async (enabled: boolean) => {
    if (!studio) return;

    if (enabled && !studio.master_password_hash) {
      setShowPasswordDialog(true);
      return;
    }

    try {
      setSaving(true);
      await studioService.updateStudio(studio.id, { protezione_attiva: enabled });
      setIsPasswordProtected(enabled);
      toast({
        title: enabled ? "Protezione attivata" : "Protezione disattivata",
        description: enabled
          ? "La Master Password protegge le aree sensibili configurate."
          : "La protezione delle aree sensibili è stata disattivata.",
      });
      await loadStudio();
    } catch (error) {
      console.error("Errore aggiornamento protezione:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la protezione dati sensibili",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMasterPassword = async () => {
    if (!studio) return;
    if (masterPassword.length < 8) {
      toast({ title: "Errore", description: "La password deve avere almeno 8 caratteri", variant: "destructive" });
      return;
    }
    if (masterPassword !== confirmPassword) {
      toast({ title: "Errore", description: "Le password non coincidono", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const hashedPassword = await bcrypt.hash(masterPassword, 10);
      await studioService.updateStudio(studio.id, {
        master_password_hash: hashedPassword,
        protezione_attiva: true,
      });
      setIsPasswordProtected(true);
      setShowPasswordDialog(false);
      setMasterPassword("");
      setConfirmPassword("");
      toast({ title: "Master Password configurata", description: "La protezione dati sensibili è attiva." });
      await loadStudio();
    } catch (error) {
      console.error("Errore salvataggio Master Password:", error);
      toast({ title: "Errore", description: "Impossibile salvare la Master Password", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeMasterPassword = async () => {
    if (!studio?.master_password_hash) return;
    if (newPassword.length < 8) {
      toast({ title: "Errore", description: "La nuova password deve avere almeno 8 caratteri", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Errore", description: "Le nuove password non coincidono", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const valid = await bcrypt.compare(currentPassword, studio.master_password_hash);
      if (!valid) {
        toast({ title: "Errore", description: "Master Password attuale non corretta", variant: "destructive" });
        return;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await studioService.updateStudio(studio.id, { master_password_hash: hashedPassword });
      setShowChangePasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast({ title: "Master Password modificata", description: "La nuova Master Password è operativa." });
      await loadStudio();
    } catch (error) {
      console.error("Errore cambio Master Password:", error);
      toast({ title: "Errore", description: "Impossibile modificare la Master Password", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!studio || !resetEmail) return;
    if (resetEmail !== studio.email) {
      toast({
        title: "Errore",
        description: "L'email inserita non corrisponde all'email dello studio",
        variant: "destructive",
      });
      return;
    }

    try {
      setResettingPassword(true);
      const result = await passwordResetService.requestPasswordReset(studio.id, resetEmail);
      if (!result.success) {
        toast({ title: "Errore", description: result.error || "Impossibile inviare il codice", variant: "destructive" });
        return;
      }
      setShowResetRequestDialog(false);
      setShowOTPDialog(true);
      toast({ title: "Codice inviato", description: "Controlla la casella email dello studio." });
    } catch (error) {
      console.error("Errore richiesta recupero Master Password:", error);
      toast({ title: "Errore", description: "Errore durante la richiesta di recupero", variant: "destructive" });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!studio || otpCode.length !== 6) {
      toast({ title: "Errore", description: "Inserisci il codice di verifica di 6 cifre", variant: "destructive" });
      return;
    }

    try {
      setResettingPassword(true);
      const result = await passwordResetService.verifyOTP(studio.id, otpCode);
      if (!result.valid || !result.tokenId) {
        toast({ title: "Errore", description: result.error || "Codice non valido", variant: "destructive" });
        return;
      }
      setOtpTokenId(result.tokenId);
      setShowOTPDialog(false);
      setShowNewPasswordDialog(true);
    } catch (error) {
      console.error("Errore verifica OTP:", error);
      toast({ title: "Errore", description: "Errore durante la verifica del codice", variant: "destructive" });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleResetPasswordComplete = async () => {
    if (!studio || !otpTokenId) return;
    if (resetNewPassword.length < 8) {
      toast({ title: "Errore", description: "La nuova password deve avere almeno 8 caratteri", variant: "destructive" });
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      toast({ title: "Errore", description: "Le password non coincidono", variant: "destructive" });
      return;
    }

    try {
      setResettingPassword(true);
      const result = await passwordResetService.resetMasterPassword(otpTokenId, studio.id, resetNewPassword);
      if (!result.success) {
        toast({ title: "Errore", description: result.error || "Impossibile reimpostare la Master Password", variant: "destructive" });
        return;
      }

      setShowNewPasswordDialog(false);
      setResetEmail("");
      setOtpCode("");
      setOtpTokenId(null);
      setResetNewPassword("");
      setResetConfirmPassword("");
      toast({ title: "Master Password reimpostata", description: "La nuova Master Password è operativa." });
      await loadStudio();
    } catch (error) {
      console.error("Errore reset Master Password:", error);
      toast({ title: "Errore", description: "Errore durante il reset della Master Password", variant: "destructive" });
    } finally {
      setResettingPassword(false);
    }
  };

  const passwordStrength = getPasswordStrength(masterPassword);
  const newPasswordStrength = getPasswordStrength(newPassword);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-sm text-slate-500">Caricamento gestione Master Password...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gestione Master Password</h1>
            <p className="mt-1 text-sm text-slate-500">
              Configura e amministra la protezione centralizzata dei dati sensibili dello studio.
            </p>
          </div>
        </div>
      </div>

      <Card className="border-2 border-[#0d6f9f] shadow-sm">
        <CardHeader className="border-b border-[#0d6f9f]/20 bg-slate-50/70">
          <CardTitle className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#0d6f9f]" />
              Protezione dati sensibili
            </span>
            <Badge variant={isPasswordProtected ? "default" : "secondary"}>
              {isPasswordProtected ? "Attiva" : "Non attiva"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-slate-900">Master Password dello studio</div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Una sola Master Password governa l'accesso alle aree sensibili già abilitate nel gestionale.
              </p>
            </div>
            <Switch
              checked={isPasswordProtected}
              onCheckedChange={handleToggleProtection}
              disabled={saving}
              aria-label="Abilita protezione Master Password"
            />
          </div>

          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>
              La Master Password non viene mostrata in chiaro. Questa pagina resta raggiungibile dagli amministratori autenticati anche per consentire il recupero sicuro in caso di smarrimento.
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 md:grid-cols-2">
            {studio?.master_password_hash ? (
              <>
                <Button type="button" variant="outline" onClick={() => setShowChangePasswordDialog(true)}>
                  <Lock className="mr-2 h-4 w-4" />
                  Cambia Master Password
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setResetEmail(studio.email || "");
                    setShowResetRequestDialog(true);
                  }}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Recupera Master Password
                </Button>
              </>
            ) : (
              <Button type="button" className="md:col-span-2" onClick={() => setShowPasswordDialog(true)}>
                <Lock className="mr-2 h-4 w-4" />
                Configura Master Password
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configura Master Password</DialogTitle>
            <DialogDescription>Imposta una password di almeno 8 caratteri.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="master-password">Master Password</Label>
              <div className="relative">
                <Input id="master-password" type={showPassword ? "text" : "password"} value={masterPassword} onChange={(e) => setMasterPassword(e.target.value)} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {masterPassword && <p className={`text-sm ${passwordStrength.color}`}>Forza password: {passwordStrength.label}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-master-password">Conferma Master Password</Label>
              <div className="relative">
                <Input id="confirm-master-password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowPasswordDialog(false)}>Annulla</Button>
            <Button type="button" onClick={handleSaveMasterPassword} disabled={saving || masterPassword.length < 8 || masterPassword !== confirmPassword}>Salva Master Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambia Master Password</DialogTitle>
            <DialogDescription>Verifica la password attuale e imposta quella nuova.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-master-password">Master Password attuale</Label>
              <div className="relative">
                <Input id="current-master-password" type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-master-password">Nuova Master Password</Label>
              <div className="relative">
                <Input id="new-master-password" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowNewPassword(!showNewPassword)}>
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {newPassword && <p className={`text-sm ${newPasswordStrength.color}`}>Forza password: {newPasswordStrength.label}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-master-password">Conferma nuova Master Password</Label>
              <div className="relative">
                <Input id="confirm-new-master-password" type={showConfirmNewPassword ? "text" : "password"} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}>
                  {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowChangePasswordDialog(false)}>Annulla</Button>
            <Button type="button" onClick={handleChangeMasterPassword} disabled={saving || !currentPassword || newPassword.length < 8 || newPassword !== confirmNewPassword}>Cambia Master Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetRequestDialog} onOpenChange={setShowResetRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recupero Master Password</DialogTitle>
            <DialogDescription>Invia un codice OTP all'email dello studio.</DialogDescription>
          </DialogHeader>
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>Il codice verrà inviato a <strong>{studio?.email}</strong>.</AlertDescription>
          </Alert>
          <div className="space-y-2 py-4">
            <Label htmlFor="reset-email">Conferma email studio</Label>
            <Input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowResetRequestDialog(false)}>Annulla</Button>
            <Button type="button" onClick={handleRequestPasswordReset} disabled={!resetEmail || resettingPassword}>Invia codice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOTPDialog} onOpenChange={setShowOTPDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verifica codice OTP</DialogTitle>
            <DialogDescription>Inserisci il codice di 6 cifre ricevuto via email.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowOTPDialog(false)}>Annulla</Button>
            <Button type="button" onClick={handleVerifyOTP} disabled={otpCode.length !== 6 || resettingPassword}>Verifica codice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewPasswordDialog} onOpenChange={setShowNewPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova Master Password</DialogTitle>
            <DialogDescription>Imposta la nuova Master Password dopo la verifica OTP.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-new-master">Nuova Master Password</Label>
              <div className="relative">
                <Input id="reset-new-master" type={showResetNewPassword ? "text" : "password"} value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowResetNewPassword(!showResetNewPassword)}>
                  {showResetNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirm-master">Conferma Master Password</Label>
              <div className="relative">
                <Input id="reset-confirm-master" type={showResetConfirmPassword ? "text" : "password"} value={resetConfirmPassword} onChange={(e) => setResetConfirmPassword(e.target.value)} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}>
                  {showResetConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowNewPasswordDialog(false)}>Annulla</Button>
            <Button type="button" onClick={handleResetPasswordComplete} disabled={resettingPassword || resetNewPassword.length < 8 || resetNewPassword !== resetConfirmPassword}>Salva nuova Master Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

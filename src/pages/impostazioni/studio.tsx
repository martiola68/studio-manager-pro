import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { authService } from "@/services/authService";
import { studioService } from "@/services/studioService";
import { passwordResetService } from "@/services/passwordResetService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Upload, Save, Shield, Lock, Eye, EyeOff, Mail, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";
import bcrypt from "bcryptjs";

type Studio = Database["public"]["Tables"]["tbstudio"]["Row"];

export default function DatiStudioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Master Password states
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
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

  // Password Reset states
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

  const [formData, setFormData] = useState({
    ragione_sociale: "",
    denominazione_breve: "",
    partita_iva: "",
    codice_fiscale: "",
    indirizzo: "",
    cap: "",
    citta: "",
    provincia: "",
    telefono: "",
    email: "",
    pec: "",
    sito_web: "",
    note: ""
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user.email) {
        router.push("/login");
        return;
      }

      const { data: utente } = await supabase
        .from("tbutenti")
        .select("tipo_utente")
        .eq("email", session.user.email)
        .single();

      if (utente?.tipo_utente !== "Admin") {
        router.push("/dashboard");
        return;
      }

      await loadStudio();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadStudio = async () => {
    try {
      setLoading(true);
      const studioData = await studioService.getStudio();
      
      if (studioData) {
        setStudio(studioData);
        setIsPasswordProtected(studioData.protezione_attiva || false);
        setFormData({
          ragione_sociale: studioData.ragione_sociale || "",
          denominazione_breve: studioData.denominazione_breve || "",
          partita_iva: studioData.partita_iva || "",
          codice_fiscale: studioData.codice_fiscale || "",
          indirizzo: studioData.indirizzo || "",
          cap: studioData.cap || "",
          citta: studioData.citta || "",
          provincia: studioData.provincia || "",
          telefono: studioData.telefono || "",
          email: studioData.email || "",
          pec: studioData.pec || "",
          sito_web: studioData.sito_web || "",
          note: studioData.note || ""
        });
        if (studioData.logo_url) {
          setLogoPreview(studioData.logo_url);
        }
      }
    } catch (error) {
      console.error("Errore caricamento studio:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati dello studio",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Errore",
          description: "Il file è troppo grande. Massimo 2MB",
          variant: "destructive"
        });
        return;
      }
      
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Errore",
          description: "Il file deve essere un'immagine",
          variant: "destructive"
        });
        return;
      }

      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !studio) return null;

    try {
      const fileExt = logoFile.name.split(".").pop();
      const fileName = `${studio.id}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("studio-assets")
        .upload(filePath, logoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("studio-assets")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Errore upload logo:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare il logo",
        variant: "destructive"
      });
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studio) {
      toast({
        title: "Errore",
        description: "Dati studio non disponibili",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);

      let logoUrl = studio.logo_url;
      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
      }

      await studioService.updateStudio(studio.id, {
        ...formData,
        logo_url: logoUrl
      });

      toast({
        title: "Successo",
        description: "Dati studio salvati con successo"
      });

      await loadStudio();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare i dati dello studio",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getPasswordStrength = (password: string): { label: string; color: string } => {
    if (password.length < 8) return { label: "Debole", color: "text-red-600" };
    if (password.length < 12) return { label: "Media", color: "text-yellow-600" };
    return { label: "Forte", color: "text-green-600" };
  };

  const handleToggleProtection = async (enabled: boolean) => {
    if (!studio) return;

    if (enabled) {
      // Abilita protezione - mostra dialog per impostare password
      if (!studio.master_password_hash) {
        setShowPasswordDialog(true);
      } else {
        // Password già esistente, attiva solo il flag
        try {
          await studioService.updateStudio(studio.id, {
            protezione_attiva: true
          });
          setIsPasswordProtected(true);
          toast({
            title: "Successo",
            description: "Protezione dati sensibili attivata"
          });
          await loadStudio();
        } catch (error) {
          console.error("Errore attivazione protezione:", error);
          toast({
            title: "Errore",
            description: "Impossibile attivare la protezione",
            variant: "destructive"
          });
        }
      }
    } else {
      // Disabilita protezione
      try {
        await studioService.updateStudio(studio.id, {
          protezione_attiva: false
        });
        setIsPasswordProtected(false);
        toast({
          title: "Successo",
          description: "Protezione dati sensibili disattivata"
        });
        await loadStudio();
      } catch (error) {
        console.error("Errore disattivazione protezione:", error);
        toast({
          title: "Errore",
          description: "Impossibile disattivare la protezione",
          variant: "destructive"
        });
      }
    }
  };

  const handleSaveMasterPassword = async () => {
    if (!studio) return;

    if (masterPassword.length < 8) {
      toast({
        title: "Errore",
        description: "La password deve essere di almeno 8 caratteri",
        variant: "destructive"
      });
      return;
    }

    if (masterPassword !== confirmPassword) {
      toast({
        title: "Errore",
        description: "Le password non coincidono",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);

      // Hash della password
      const hashedPassword = await bcrypt.hash(masterPassword, 10);

      // Salva nel database
      await studioService.updateStudio(studio.id, {
        master_password_hash: hashedPassword,
        protezione_attiva: true
      });

      setIsPasswordProtected(true);
      setShowPasswordDialog(false);
      setMasterPassword("");
      setConfirmPassword("");

      toast({
        title: "Successo",
        description: "Master Password configurata con successo"
      });

      await loadStudio();
    } catch (error) {
      console.error("Errore salvataggio password:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare la Master Password",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeMasterPassword = async () => {
    if (!studio || !studio.master_password_hash) return;

    if (newPassword.length < 8) {
      toast({
        title: "Errore",
        description: "La nuova password deve essere di almeno 8 caratteri",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({
        title: "Errore",
        description: "Le nuove password non coincidono",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);

      // Verifica password attuale
      const isValid = await bcrypt.compare(currentPassword, studio.master_password_hash);
      if (!isValid) {
        toast({
          title: "Errore",
          description: "Password attuale non corretta",
          variant: "destructive"
        });
        return;
      }

      // Hash nuova password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Aggiorna nel database
      await studioService.updateStudio(studio.id, {
        master_password_hash: hashedPassword
      });

      setShowChangePasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      toast({
        title: "Successo",
        description: "Master Password modificata con successo"
      });

      await loadStudio();
    } catch (error) {
      console.error("Errore cambio password:", error);
      toast({
        title: "Errore",
        description: "Impossibile modificare la Master Password",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!studio || !resetEmail) {
      toast({
        title: "Errore",
        description: "Inserisci l'email per continuare",
        variant: "destructive"
      });
      return;
    }

    // Verifica che l'email corrisponda all'email dello studio
    if (resetEmail !== studio.email) {
      toast({
        title: "Errore",
        description: "L'email inserita non corrisponde all'email dello studio",
        variant: "destructive"
      });
      return;
    }

    try {
      setResettingPassword(true);
      const result = await passwordResetService.requestPasswordReset(studio.id, resetEmail);

      if (result.success) {
        setShowResetRequestDialog(false);
        setShowOTPDialog(true);
        toast({
          title: "Email Inviata",
          description: "Controlla la tua casella email per il codice di verifica"
        });
      } else {
        toast({
          title: "Errore",
          description: result.error || "Impossibile inviare l'email di reset",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Errore richiesta reset:", error);
      toast({
        title: "Errore",
        description: "Errore durante la richiesta di reset",
        variant: "destructive"
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!studio || !otpCode) {
      toast({
        title: "Errore",
        description: "Inserisci il codice di verifica",
        variant: "destructive"
      });
      return;
    }

    if (otpCode.length !== 6) {
      toast({
        title: "Errore",
        description: "Il codice deve essere di 6 cifre",
        variant: "destructive"
      });
      return;
    }

    try {
      setResettingPassword(true);
      const result = await passwordResetService.verifyOTP(studio.id, otpCode);

      if (result.valid && result.tokenId) {
        setOtpTokenId(result.tokenId);
        setShowOTPDialog(false);
        setShowNewPasswordDialog(true);
        toast({
          title: "Successo",
          description: "Codice verificato! Imposta la nuova password"
        });
      } else {
        toast({
          title: "Errore",
          description: result.error || "Codice non valido",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Errore verifica OTP:", error);
      toast({
        title: "Errore",
        description: "Errore durante la verifica del codice",
        variant: "destructive"
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleResetPasswordComplete = async () => {
    if (!studio || !otpTokenId) {
      toast({
        title: "Errore",
        description: "Sessione non valida",
        variant: "destructive"
      });
      return;
    }

    if (resetNewPassword.length < 8) {
      toast({
        title: "Errore",
        description: "La password deve essere di almeno 8 caratteri",
        variant: "destructive"
      });
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      toast({
        title: "Errore",
        description: "Le password non coincidono",
        variant: "destructive"
      });
      return;
    }

    try {
      setResettingPassword(true);
      const result = await passwordResetService.resetMasterPassword(
        otpTokenId,
        studio.id,
        resetNewPassword
      );

      if (result.success) {
        setShowNewPasswordDialog(false);
        setResetEmail("");
        setOtpCode("");
        setOtpTokenId(null);
        setResetNewPassword("");
        setResetConfirmPassword("");

        toast({
          title: "Successo",
          description: "Master Password resettata con successo!"
        });

        await loadStudio();
      } else {
        toast({
          title: "Errore",
          description: result.error || "Impossibile resettare la password",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Errore reset password:", error);
      toast({
        title: "Errore",
        description: "Errore durante il reset della password",
        variant: "destructive"
      });
    } finally {
      setResettingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  const passwordStrength = getPasswordStrength(masterPassword);
  const newPasswordStrength = getPasswordStrength(newPassword);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dati Studio</h1>
        <p className="text-gray-500 mt-1">Gestisci anagrafica e logo dello studio</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Logo Studio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo Studio"
                    className="w-32 h-32 object-contain border-2 border-gray-200 rounded-lg"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <Label htmlFor="logo" className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors">
                      <div className="text-center">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">
                          Clicca per caricare il logo
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          PNG, JPG fino a 2MB
                        </p>
                      </div>
                    </div>
                  </Label>
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dati Anagrafici</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ragione_sociale">Ragione Sociale *</Label>
                  <Input
                    id="ragione_sociale"
                    value={formData.ragione_sociale}
                    onChange={(e) => setFormData({ ...formData, ragione_sociale: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="denominazione_breve">Denominazione Breve *</Label>
                  <Input
                    id="denominazione_breve"
                    value={formData.denominazione_breve}
                    onChange={(e) => setFormData({ ...formData, denominazione_breve: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="partita_iva">Partita IVA *</Label>
                  <Input
                    id="partita_iva"
                    value={formData.partita_iva}
                    onChange={(e) => setFormData({ ...formData, partita_iva: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codice_fiscale">Codice Fiscale *</Label>
                  <Input
                    id="codice_fiscale"
                    value={formData.codice_fiscale}
                    onChange={(e) => setFormData({ ...formData, codice_fiscale: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="indirizzo">Indirizzo *</Label>
                <Input
                  id="indirizzo"
                  value={formData.indirizzo}
                  onChange={(e) => setFormData({ ...formData, indirizzo: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cap">CAP *</Label>
                  <Input
                    id="cap"
                    value={formData.cap}
                    onChange={(e) => setFormData({ ...formData, cap: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="citta">Città *</Label>
                  <Input
                    id="citta"
                    value={formData.citta}
                    onChange={(e) => setFormData({ ...formData, citta: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provincia">Provincia *</Label>
                  <Input
                    id="provincia"
                    value={formData.provincia}
                    onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                    maxLength={2}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contatti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefono">Telefono *</Label>
                  <Input
                    id="telefono"
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pec">PEC *</Label>
                  <Input
                    id="pec"
                    type="email"
                    value={formData.pec}
                    onChange={(e) => setFormData({ ...formData, pec: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sito_web">Sito Web</Label>
                  <Input
                    id="sito_web"
                    type="url"
                    value={formData.sito_web}
                    onChange={(e) => setFormData({ ...formData, sito_web: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={4}
                  placeholder="Note aggiuntive..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Protezione Dati Sensibili
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="protezione">Abilita Protezione</Label>
                    <Badge variant={isPasswordProtected ? "default" : "secondary"}>
                      {isPasswordProtected ? "Attiva" : "Non attiva"}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    Proteggi l'accesso alle credenziali e ai dati sensibili con una Master Password
                  </p>
                </div>
                <Switch
                  id="protezione"
                  checked={isPasswordProtected}
                  onCheckedChange={handleToggleProtection}
                />
              </div>

              {studio?.master_password_hash && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowChangePasswordDialog(true)}
                    className="w-full"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Cambia Master Password
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setResetEmail(studio.email || "");
                      setShowResetRequestDialog(true);
                    }}
                    className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    Password dimenticata? Recuperala
                  </Button>
                </div>
              )}

              {!studio?.master_password_hash && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPasswordDialog(true)}
                  className="w-full"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Configura Master Password
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salva Modifiche
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Dialog Configurazione Master Password */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configura Master Password</DialogTitle>
            <DialogDescription>
              Imposta una password sicura per proteggere l'accesso ai dati sensibili dello studio.
              La password deve essere di almeno 8 caratteri.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="master-password">Master Password *</Label>
              <div className="relative">
                <Input
                  id="master-password"
                  type={showPassword ? "text" : "password"}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Minimo 8 caratteri"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {masterPassword && (
                <p className={`text-sm ${passwordStrength.color}`}>
                  Forza password: {passwordStrength.label}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Conferma Password *</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ripeti la password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {confirmPassword && masterPassword !== confirmPassword && (
                <p className="text-sm text-red-600">Le password non coincidono</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false);
                setMasterPassword("");
                setConfirmPassword("");
              }}
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleSaveMasterPassword}
              disabled={!masterPassword || !confirmPassword || masterPassword !== confirmPassword || masterPassword.length < 8 || saving}
            >
              {saving ? (
                <>
                  <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Salvataggio...
                </>
              ) : (
                "Salva Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Cambio Master Password */}
      <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambia Master Password</DialogTitle>
            <DialogDescription>
              Inserisci la password attuale e imposta una nuova Master Password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Password Attuale *</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Password attuale"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Nuova Password *</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimo 8 caratteri"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {newPassword && (
                <p className={`text-sm ${newPasswordStrength.color}`}>
                  Forza password: {newPasswordStrength.label}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Conferma Nuova Password *</Label>
              <div className="relative">
                <Input
                  id="confirm-new-password"
                  type={showConfirmNewPassword ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Ripeti la nuova password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                >
                  {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {confirmNewPassword && newPassword !== confirmNewPassword && (
                <p className="text-sm text-red-600">Le password non coincidono</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowChangePasswordDialog(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmNewPassword("");
              }}
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleChangeMasterPassword}
              disabled={!currentPassword || !newPassword || !confirmNewPassword || newPassword !== confirmNewPassword || newPassword.length < 8 || saving}
            >
              {saving ? (
                <>
                  <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Salvataggio...
                </>
              ) : (
                "Cambia Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Richiesta Reset Password */}
      <Dialog open={showResetRequestDialog} onOpenChange={setShowResetRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recupero Master Password</DialogTitle>
            <DialogDescription>
              Ti invieremo un codice di verifica via email per resettare la Master Password.
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Il codice verrà inviato a: <strong>{studio?.email}</strong>
            </AlertDescription>
          </Alert>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Conferma Email Studio *</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="email@studio.it"
              />
              <p className="text-xs text-gray-500">
                Inserisci l'email dello studio per confermare l'identità
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowResetRequestDialog(false);
                setResetEmail("");
              }}
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleRequestPasswordReset}
              disabled={!resetEmail || resettingPassword}
            >
              {resettingPassword ? (
                <>
                  <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Invio...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Invia Codice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Verifica Codice OTP */}
      <Dialog open={showOTPDialog} onOpenChange={setShowOTPDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inserisci Codice di Verifica</DialogTitle>
            <DialogDescription>
              Abbiamo inviato un codice di 6 cifre alla tua email. Il codice è valido per 15 minuti.
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Hai massimo 3 tentativi</strong> per inserire il codice corretto.
            </AlertDescription>
          </Alert>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="otp-code">Codice di Verifica (6 cifre) *</Label>
              <Input
                id="otp-code"
                type="text"
                value={otpCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtpCode(value);
                }}
                placeholder="123456"
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowOTPDialog(false);
                setOtpCode("");
              }}
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleVerifyOTP}
              disabled={otpCode.length !== 6 || resettingPassword}
            >
              {resettingPassword ? (
                <>
                  <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Verifica...
                </>
              ) : (
                "Verifica Codice"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nuova Password dopo OTP */}
      <Dialog open={showNewPasswordDialog} onOpenChange={setShowNewPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imposta Nuova Master Password</DialogTitle>
            <DialogDescription>
              Codice verificato con successo! Ora imposta una nuova Master Password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-new-password">Nuova Password *</Label>
              <div className="relative">
                <Input
                  id="reset-new-password"
                  type={showResetNewPassword ? "text" : "password"}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="Minimo 8 caratteri"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                >
                  {showResetNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {resetNewPassword && (
                <p className={`text-sm ${getPasswordStrength(resetNewPassword).color}`}>
                  Forza password: {getPasswordStrength(resetNewPassword).label}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-confirm-password">Conferma Nuova Password *</Label>
              <div className="relative">
                <Input
                  id="reset-confirm-password"
                  type={showResetConfirmPassword ? "text" : "password"}
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  placeholder="Ripeti la password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                >
                  {showResetConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {resetConfirmPassword && resetNewPassword !== resetConfirmPassword && (
                <p className="text-sm text-red-600">Le password non coincidono</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowNewPasswordDialog(false);
                setResetNewPassword("");
                setResetConfirmPassword("");
                setOtpTokenId(null);
              }}
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleResetPasswordComplete}
              disabled={
                !resetNewPassword || 
                !resetConfirmPassword || 
                resetNewPassword !== resetConfirmPassword || 
                resetNewPassword.length < 8 || 
                resettingPassword
              }
            >
              {resettingPassword ? (
                <>
                  <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Salvataggio...
                </>
              ) : (
                "Salva Nuova Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
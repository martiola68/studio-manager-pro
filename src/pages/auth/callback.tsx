import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [authType, setAuthType] = useState<string>("");

  // Prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    handleAuthCallback();
  }, [mounted]);

  const handleAuthCallback = async () => {
    try {
      // STEP 1: Read query params (?) - Supabase puts type= here
      const urlParams = new URLSearchParams(window.location.search);
      const typeFromQuery = urlParams.get("type");
      const errorFromQuery = urlParams.get("error");
      const errorDescFromQuery = urlParams.get("error_description");

      // STEP 2: Read hash params (#) - Supabase puts tokens here
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const typeFromHash = hashParams.get("type");
      const errorCode = hashParams.get("error_code");
      const errorDescription = hashParams.get("error_description");

      // STEP 3: Combine type from query AND hash (priority to query)
      const type = typeFromQuery || typeFromHash;

      // Handle explicit errors
      if (errorFromQuery || errorCode) {
        setError(errorDescFromQuery || errorDescription || "Link non valido o scaduto. Richiedi un nuovo link.");
        setLoading(false);
        return;
      }

      // STEP 4: If tokens in hash, set session
      if (accessToken && refreshToken) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (sessionError) {
          setError("Link scaduto o non valido. Richiedi un nuovo invito o reset password.");
          setLoading(false);
          return;
        }

        // STEP 5: Determine if password is needed
        const requiresPassword = type === "recovery" || 
                                type === "invite" || 
                                type === "signup" ||
                                type === "magiclink";

        if (requiresPassword) {
          setAuthType(type || "");
          setNeedsPassword(true);
          setLoading(false);
          
          // Type-specific message
          if (type === "recovery") {
            toast({
              title: "🔐 Reset Password",
              description: "Imposta la tua nuova password per accedere"
            });
          } else if (type === "invite") {
            toast({
              title: "👋 Benvenuto!",
              description: "Imposta la tua password per completare la registrazione"
            });
          }
          return;
        }

        // No password needed, redirect to dashboard
        router.push("/dashboard");
        return;
      }

      // STEP 6: Fallback - check existing session
      const { data: existingSession } = await supabase.auth.getSession();

      if (existingSession.session) {
        // If recovery/invite/signup type in query, show password form
        if (type === "recovery" || 
            type === "invite" || 
            type === "signup") {
          setAuthType(type || "");
          setNeedsPassword(true);
          setLoading(false);
          
          if (type === "recovery") {
            toast({
              title: "🔐 Reset Password",
              description: "Imposta la tua nuova password per accedere"
            });
          }
        } else {
          router.push("/dashboard");
        }
      } else {
        // If type exists but no session, link expired
        if (type) {
          setError("Link di autenticazione scaduto. Richiedi un nuovo link.");
        } else {
          setError("Link di autenticazione non valido. Accedi normalmente.");
        }
        setLoading(false);
      }
    } catch (err) {
      console.error("Errore gestione callback:", err);
      setError("Errore imprevisto. Riprova o contatta il supporto.");
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La password deve essere di almeno 8 caratteri");
      return;
    }

    if (password !== confirmPassword) {
      setError("Le password non coincidono");
      return;
    }

    try {
      setUpdating(true);

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "✅ Password impostata!",
        description: authType === "recovery" 
          ? "Password aggiornata con successo. Accesso in corso..." 
          : "Account configurato con successo. Accesso in corso..."
      });

      // Brief pause to show message
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Redirect to dashboard
      router.push("/dashboard");

    } catch (err) {
      console.error("Errore impostazione password:", err);
      setError(err instanceof Error ? err.message : "Errore durante l'impostazione della password");
      setUpdating(false);
    }
  };

  // Prevent hydration by not rendering until mounted
  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 text-center">
            <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Verifica credenziali in corso...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <CardTitle className="text-red-900">Errore di Autenticazione</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-700">{error}</p>
            <Button 
              onClick={() => router.push("/login")} 
              className="w-full"
            >
              Torna al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (needsPassword) {
    const isRecovery = authType === "recovery";
    const title = isRecovery ? "Reimposta la tua Password" : "Imposta la tua Password";
    const description = isRecovery 
      ? "Scegli una nuova password sicura per il tuo account."
      : "Benvenuto in Studio Manager Pro! Crea una password sicura per accedere.";

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-2 ${
              isRecovery 
                ? "bg-gradient-to-br from-orange-600 to-orange-800" 
                : "bg-gradient-to-br from-green-600 to-green-800"
            }`}>
              <Lock className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <p className="text-gray-600 text-sm">{description}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPassword} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Nuova Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Almeno 8 caratteri"
                  required
                  disabled={updating}
                  minLength={8}
                  className="h-11"
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Conferma Password *</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ripeti la password"
                  required
                  disabled={updating}
                  minLength={8}
                  className="h-11"
                  autoComplete="new-password"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                <p className="font-semibold mb-1">📋 Requisiti password:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Almeno 8 caratteri</li>
                  <li>Si consiglia l&apos;uso di lettere, numeri e simboli</li>
                </ul>
              </div>

              <Button
                type="submit"
                className={`w-full h-11 text-base ${
                  isRecovery
                    ? "bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
                    : "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                }`}
                disabled={updating}
              >
                {updating ? (
                  <>
                    <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    {isRecovery ? "Aggiorna Password e Accedi" : "Conferma e Accedi"}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
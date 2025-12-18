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
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      // Gestisce il callback OAuth/Magic Link/Password Reset
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Errore callback auth:", error);
        setError("Errore durante l'autenticazione. Riprova.");
        setLoading(false);
        return;
      }

      if (data.session) {
        // Verifica se l'utente deve impostare la password
        const user = data.session.user;
        
        // Se è un nuovo utente invitato o reset password, chiede di impostare password
        if (user.user_metadata?.invited_by || router.query.type === "recovery") {
          setNeedsPassword(true);
          setLoading(false);
        } else {
          // Utente già configurato, redirect a dashboard
          router.push("/dashboard");
        }
      } else {
        setError("Sessione non valida. Riprova.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Errore gestione callback:", err);
      setError("Errore imprevisto. Riprova.");
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

      // Aggiorna la password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "✅ Password impostata!",
        description: "Accesso al sistema completato con successo"
      });

      // Redirect a dashboard dopo 1 secondo
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);

    } catch (err) {
      console.error("Errore impostazione password:", err);
      setError(err instanceof Error ? err.message : "Errore durante l'impostazione della password");
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 text-center">
            <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Verifica in corso...</p>
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center shadow-lg mb-2">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Imposta la tua Password</CardTitle>
            <p className="text-gray-600 text-sm">
              Benvenuto in Studio Manager Pro! Imposta una password sicura per accedere.
            </p>
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
                />
              </div>

              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-900">
                <p className="font-semibold mb-1">💡 Consigli per una password sicura:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Almeno 8 caratteri</li>
                  <li>Usa lettere maiuscole e minuscole</li>
                  <li>Includi numeri e simboli</li>
                  <li>Non usare password facilmente indovinabili</li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
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
                    Conferma e Accedi
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
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ClientOnlyAuthCallback() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [authType, setAuthType] = useState<string>("");

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const urlParams = new URLSearchParams(window.location.search);
      
      const type = urlParams.get("type") || hashParams.get("type");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const errorParam = urlParams.get("error");

      if (errorParam) {
        setError("Link non valido o scaduto. Torna al login.");
        setLoading(false);
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (sessionError) {
          setError("Sessione non valida. Torna al login.");
          setLoading(false);
          return;
        }

        if (type === "recovery" || type === "invite" || type === "signup") {
          setAuthType(type);
          setNeedsPassword(true);
          setLoading(false);
          return;
        }

        router.push("/dashboard");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        if (type === "recovery" || type === "invite") {
          setAuthType(type);
          setNeedsPassword(true);
          setLoading(false);
          return;
        }
        router.push("/dashboard");
      } else {
        setError("Sessione non valida. Torna al login.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Auth callback error:", err);
      setError("Errore di autenticazione. Torna al login.");
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

      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      toast({
        title: "✅ Password impostata!",
        description: "Accesso in corso..."
      });

      setTimeout(() => router.push("/dashboard"), 1000);
    } catch (err) {
      setError("Errore durante l'impostazione della password");
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 text-center">
            <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Verifica credenziali...</p>
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
              <CardTitle className="text-red-900">Errore</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-700">{error}</p>
            <Button onClick={() => router.push("/login")} className="w-full">
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
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPassword} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
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
                />
              </div>

              <Button type="submit" className="w-full h-11" disabled={updating}>
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
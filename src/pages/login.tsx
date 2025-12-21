import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error checking session:", error);
    } finally {
      setCheckingSession(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Errore",
        description: "Inserisci email e password",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) {
        toast({
          title: "Errore di autenticazione",
          description: error.message === "Invalid login credentials" 
            ? "Email o password non corretti"
            : error.message,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (data.session) {
        toast({
          title: "Accesso effettuato",
          description: "Benvenuto in Studio Manager Pro"
        });
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Errore login:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'accesso",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-4 text-center pb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center shadow-lg">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold text-gray-900">
              Studio Manager Pro
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Sistema Gestionale Integrato per Studi Commerciali
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="utente@studio.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-11"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-11"
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Accesso in corso...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  Accedi
                </>
              )}
            </Button>
          </form>

          <div className="pt-6 border-t border-gray-200">
            <div className="bg-blue-50 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                Credenziali Demo
              </p>
              <div className="space-y-1 text-sm text-blue-800">
                <p><strong>Email:</strong> admin@studiodemo.it</p>
                <p><strong>Password:</strong> Demo123!</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
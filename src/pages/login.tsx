import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);

  // ✅ se già loggato → /dashboard (redirect SOLO QUI)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error) console.error("[Login] getSession error:", error);

        if (data?.session?.access_token) {
          router.replace("/dashboard");
          return;
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Errore",
        description: "Inserisci email e password",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Errore di autenticazione",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (!data.session?.access_token) {
        toast({
          title: "Errore",
          description: "Nessuna sessione creata",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Accesso effettuato", description: "Benvenuto!" });

      // ✅ redirect SOLO QUI
      router.replace("/dashboard");
    } catch (err: any) {
      toast({
        title: "Errore",
        description: err?.message || "Errore durante il login",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-3 text-gray-600">Caricamento...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold text-gray-900">
            Studio Manager Pro
          </CardTitle>
          <p className="text-gray-600">Accedi al tuo account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="nome@studio.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Accesso in corso..." : "Accedi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

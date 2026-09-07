import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { InstallAppButton } from "@/components/InstallAppButton";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);

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
      toast({ title: "Errore", description: "Inserisci email e password", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Errore di autenticazione", description: error.message, variant: "destructive" });
        return;
      }
      if (!data.session?.access_token) {
        toast({ title: "Errore", description: "Nessuna sessione creata", variant: "destructive" });
        return;
      }
      toast({ title: "Accesso effettuato", description: "Benvenuto!" });
      router.replace("/dashboard");
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message || "Errore durante il login", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      toast({ title: "Email richiesta", description: "Inserisci l'email del tuo account.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?type=recovery`;
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
      if (error) throw error;

      toast({
        title: "Email inviata",
        description: "Controlla la posta e usa il link ricevuto per impostare una nuova password.",
      });
      setRecoveryMode(false);
    } catch (err: any) {
      toast({
        title: "Recupero password non riuscito",
        description: err?.message || "Impossibile inviare l'email di recupero.",
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
          <CardTitle className="text-3xl font-bold text-gray-900">Studio Manager Pro</CardTitle>
          <p className="text-gray-600">{recoveryMode ? "Recupera la password" : "Accedi al tuo account"}</p>
        </CardHeader>
        <CardContent>
          {recoveryMode ? (
            <form onSubmit={handlePasswordRecovery} className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-sm text-gray-700">
                Inserisci l'email utilizzata per accedere a SMP. Riceverai un link sicuro per scegliere una nuova password.
              </div>
              <div className="space-y-2">
                <label htmlFor="recovery-email" className="text-sm font-medium text-gray-700">Email</label>
                <Input id="recovery-email" type="email" placeholder="nome@studio.it" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required autoFocus />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Invio in corso..." : "Invia link di recupero"}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-gray-600" disabled={loading} onClick={() => setRecoveryMode(false)}>
                Torna all'accesso
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
                <Input id="email" type="email" placeholder="nome@studio.it" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
                  <button type="button" onClick={() => setRecoveryMode(true)} className="text-xs font-semibold text-blue-700 hover:underline">
                    Password dimenticata?
                  </button>
                </div>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} required />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Accesso in corso..." : "Accedi"}
              </Button>
            </form>
          )}

          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-center">
            <p className="text-sm font-medium text-gray-800">Problemi con l’abbonamento?</p>
            <a
              href="https://studiomanagerpro.it/abbonamento"
              className="mt-1 inline-block text-sm font-semibold text-blue-700 hover:underline"
            >
              Gestisci pagamento o riattiva il servizio →
            </a>
          </div>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400">App desktop</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <InstallAppButton />

          <Button variant="ghost" className="mt-2 w-full text-gray-600" asChild>
            <a href="https://studiomanagerpro.it">Torna al sito web</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

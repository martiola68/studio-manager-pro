import { useState, FormEvent } from "react";
import { useRouter } from "next/router";
import { login, initializeDatabase } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      initializeDatabase();
      const user = login(email, password);
      
      if (user) {
        router.push("/dashboard");
      } else {
        setError("Email o password non corretti");
      }
    } catch (err) {
      setError("Errore durante il login. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-xl mb-4">
            <Building2 className="h-10 w-10 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Studio Manager Pro</h1>
          <p className="text-blue-100">Sistema Gestionale per Studi Professionali</p>
        </div>

        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Accedi</CardTitle>
            <CardDescription>Inserisci le tue credenziali per continuare</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome@studio.it"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? "Accesso in corso..." : "Accedi"}
              </Button>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-gray-600">
                <p className="font-semibold mb-1">Credenziali di default:</p>
                <p>Email: admin@studio.it</p>
                <p>Password: admin123</p>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-blue-100 text-sm mt-6">
          © {new Date().getFullYear()} Studio Manager Pro. Tutti i diritti riservati.
        </p>
      </div>
    </div>
  );
}
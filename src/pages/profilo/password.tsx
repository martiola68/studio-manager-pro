import { FormEvent, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LockKeyhole, ArrowLeft } from "lucide-react";

export default function ModificaPasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!currentPassword) return setError("Inserisci la password attuale.");
    if (password.length < 10) return setError("La nuova password deve contenere almeno 10 caratteri.");
    if (password !== confirm) return setError("Le due password non coincidono.");
    if (currentPassword === password) return setError("La nuova password deve essere diversa dalla password attuale.");
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user?.email) throw new Error("Sessione non valida. Effettua nuovamente l’accesso.");

      // Prima di modificare la password richiediamo una nuova autenticazione
      // con la password attuale. La sola presenza di una sessione aperta non basta.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });
      if (verifyError) throw new Error("La password attuale non è corretta.");

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setCurrentPassword("");
      setPassword("");
      setConfirm("");
      setSuccess("Password modificata correttamente. Dal prossimo accesso utilizza la nuova password.");
    } catch (e: any) {
      setError(e?.message || "Impossibile modificare la password.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-10">
    <div className="mx-auto max-w-xl">
      <Button variant="ghost" className="mb-5" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />Torna indietro</Button>
      <Card>
        <CardHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-100"><LockKeyhole className="h-6 w-6 text-cyan-800" /></div>
          <CardTitle>Modifica password</CardTitle>
          <CardDescription>Per sicurezza verifica prima la password attuale, quindi inserisci e conferma la nuova password. Il recupero password dalla pagina di login resta riservato ai casi di smarrimento.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div><label className="mb-1 block text-sm font-medium">Password attuale</label><Input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></div>
            <div><label className="mb-1 block text-sm font-medium">Nuova password</label><Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} /></div>
            <div><label className="mb-1 block text-sm font-medium">Conferma nuova password</label><Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={10} /></div>
            {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {success && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Verifica e aggiornamento…" : "Modifica password"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  </main>;
}

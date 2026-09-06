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
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: currentPassword });
      if (verifyError) throw new Error("La password attuale non è corretta.");
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setCurrentPassword(""); setPassword(""); setConfirm("");
      setSuccess("Password modificata correttamente. Dal prossimo accesso utilizza la nuova password.");
    } catch (e: any) {
      setError(e?.message || "Impossibile modificare la password.");
    } finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-slate-100 px-6 py-6">
    <div className="mx-auto max-w-3xl">
      <Button variant="outline" className="mb-4 h-9 border-sky-400 bg-white text-sky-700 hover:bg-sky-50 hover:text-sky-800" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />Torna indietro</Button>
      <Card className="overflow-hidden rounded-xl border border-sky-300 bg-white shadow-sm">
        <CardHeader className="border-b border-sky-200 bg-sky-50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-600"><LockKeyhole className="h-5 w-5 text-white" /></div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">Modifica password</CardTitle>
              <CardDescription className="mt-1 text-sm text-slate-600">Per sicurezza verifica prima la password attuale, quindi inserisci e conferma la nuova password. Il recupero password dalla pagina di login resta riservato ai casi di smarrimento.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <form onSubmit={submit} className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-semibold text-slate-700">Password attuale</label><Input className="h-10 border-slate-300 bg-white focus-visible:ring-sky-500" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></div>
            <div><label className="mb-1.5 block text-sm font-semibold text-slate-700">Nuova password</label><Input className="h-10 border-slate-300 bg-white focus-visible:ring-sky-500" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} /></div>
            <div><label className="mb-1.5 block text-sm font-semibold text-slate-700">Conferma nuova password</label><Input className="h-10 border-slate-300 bg-white focus-visible:ring-sky-500" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={10} /></div>
            {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {success && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}
            <Button type="submit" className="h-10 w-full bg-sky-700 font-semibold text-white hover:bg-sky-600" disabled={loading}>{loading ? "Verifica e aggiornamento…" : "Modifica password"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  </main>;
}

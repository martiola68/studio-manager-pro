import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";

export default function TestNoreplyPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      router.push("/login");
      return;
    }

    setEmail(session.user.email || "");
  }

  async function handleTest() {
    setSending(true);
    setMessage(null);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessione non valida");

      const response = await fetch("/api/microsoft365/test-noreply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: email.trim() }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Test non riuscito");
      }

      setMessage(
        `Email di test inviata a ${result.to}. Controlla che il mittente visualizzato sia ${result.from}.`
      );
    } catch (e: any) {
      setError(e?.message || "Errore durante il test");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Test mittente noreply</h1>
        <p className="mt-2 text-sm text-gray-600">
          Test isolato: non modifica scadenze, contratti o configurazioni Microsoft 365.
        </p>

        <div className="mt-6">
          <label className="mb-1 block text-sm font-medium">Invia il test a</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="indirizzo@email.it"
          />
        </div>

        <div className="mt-4 rounded border bg-gray-50 p-3 text-sm">
          Mittente atteso: <strong>noreply@revisionicommerciali.it</strong>
        </div>

        {message && (
          <div className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/microsoft365")}
            className="rounded border px-4 py-2"
          >
            Torna a Microsoft 365
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={sending || !email.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {sending ? "Invio in corso..." : "Invia test noreply"}
          </button>
        </div>
      </div>
    </div>
  );
}

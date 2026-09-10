import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Props = { studioId: string };

export default function PayrollDailyPresenceEmailConfig({ studioId }: Props) {
  const supabase = getSupabaseClient() as any;
  const [email1, setEmail1] = useState("m.artiola@revisionicommerciali.it");
  const [email2, setEmail2] = useState("");
  const [attivo, setAttivo] = useState(false);
  const [oraInvio, setOraInvio] = useState("08:00");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!studioId) return;
    void (async () => {
      const { data, error } = await supabase
        .from("tbpresenze_report_email_config")
        .select("destinatari,attivo,ora_invio")
        .eq("studio_id", studioId)
        .maybeSingle();
      if (error) {
        setMessage(`Errore caricamento configurazione: ${error.message}`);
        return;
      }
      if (!data) return;
      const destinatari = Array.isArray(data.destinatari) ? data.destinatari : [];
      setEmail1(destinatari[0] || "m.artiola@revisionicommerciali.it");
      setEmail2(destinatari[1] || "");
      setAttivo(!!data.attivo);
      setOraInvio(String(data.ora_invio || "08:00").slice(0, 5));
    })();
  }, [studioId]);

  async function saveConfig() {
    setSaving(true);
    setMessage("");
    try {
      const destinatari = [email1.trim(), email2.trim()].filter(Boolean);
      if (!destinatari.length) throw new Error("Inserisci almeno un indirizzo email");
      const { error } = await supabase.from("tbpresenze_report_email_config").upsert(
        { studio_id: studioId, destinatari, ora_invio: oraInvio, attivo, updated_at: new Date().toISOString() },
        { onConflict: "studio_id" }
      );
      if (error) throw error;
      setMessage("Configurazione salvata.");
      return true;
    } catch (error: any) {
      setMessage(error?.message || "Errore salvataggio configurazione");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setMessage("");
    try {
      const ok = await saveConfig();
      if (!ok) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Sessione utente non disponibile");

      const response = await fetch(
        `/api/presenze/report-giornaliero-email?force=true&studio_id=${encodeURIComponent(studioId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const body = await response.json().catch(() => ({}));
      const result = Array.isArray(body?.results) ? body.results[0] : null;
      const recipientResults = Array.isArray(result?.recipients) ? result.recipients : [];
      const failed = recipientResults.filter((r: any) => !r?.success);

      if (!response.ok || !body?.success || !result?.sent || failed.length > 0) {
        const details = failed
          .map((r: any) => `${r?.to || "destinatario"}: ${r?.error || "invio non riuscito"}`)
          .join(" | ");
        throw new Error(
          details || body?.error || result?.reason || "Il server non ha confermato l'invio dell'email"
        );
      }

      const destinatariOk = recipientResults
        .filter((r: any) => r?.success)
        .map((r: any) => r.to)
        .join(", ");

      const fisiche = result?.presenze_fisiche ?? 0;
      const smart = result?.presenze_smart ?? 0;

      setMessage(
        `Email realmente accettata per l'invio a: ${destinatariOk}. Presenze fisiche: ${fisiche}. Smart working: ${smart}.`
      );
    } catch (error: any) {
      setMessage(`ERRORE INVIO: ${error?.message || "Errore invio email di test"}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-sky-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-900">Invio automatico presenze</div>
          <div className="text-xs text-slate-500">Report giornaliero delle presenze fisiche e in smart working, suddivise per settore.</div>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} />
          Invio automatico attivo
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_140px_auto_auto] md:items-end">
        <label className="text-sm"><span className="mb-1 block text-slate-600">Email 1</span><input type="email" value={email1} onChange={(e) => setEmail1(e.target.value)} className="w-full rounded border px-3 py-2" /></label>
        <label className="text-sm"><span className="mb-1 block text-slate-600">Email 2</span><input type="email" value={email2} onChange={(e) => setEmail2(e.target.value)} className="w-full rounded border px-3 py-2" /></label>
        <label className="text-sm"><span className="mb-1 block text-slate-600">Ora prevista</span><input type="time" value={oraInvio} onChange={(e) => setOraInvio(e.target.value)} className="w-full rounded border px-3 py-2" /></label>
        <button type="button" onClick={() => void saveConfig()} disabled={saving || testing} className="rounded border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">{saving ? "Salvataggio..." : "Salva"}</button>
        <button type="button" onClick={() => void sendTest()} disabled={saving || testing} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{testing ? "Invio..." : "Invia email di test"}</button>
      </div>
      {message && <div className="mt-3 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</div>}
      <div className="mt-3 text-xs text-slate-500">Mittente automatico: noreply@revisionicommerciali.it. Il test viene inviato a Email 1 e Email 2, se valorizzate. L'automatismo partirà solo quando il flag sarà attivo.</div>
    </div>
  );
}

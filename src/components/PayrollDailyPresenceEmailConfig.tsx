import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Props = { studioId: string };

export default function PayrollDailyPresenceEmailConfig({ studioId }: Props) {
  const supabase = getSupabaseClient() as any;
  const [emailFiscale, setEmailFiscale] = useState("");
  const [emailLavoro, setEmailLavoro] = useState("");
  const [emailConsulenza, setEmailConsulenza] = useState("");
  const [attivo, setAttivo] = useState(false);
  const [oraInvio, setOraInvio] = useState("08:00");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  useEffect(() => {
    if (!studioId) return;

    void (async () => {
      const token = await getToken();
      if (!token) {
        setAuthorized(false);
        return;
      }

      const response = await fetch(
        `/api/presenze/report-email-config?studio_id=${encodeURIComponent(studioId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 403 || response.status === 401) {
        setAuthorized(false);
        return;
      }

      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.success) {
        setAuthorized(false);
        return;
      }

      setAuthorized(true);
      const data = body.config;
      const destinatari = Array.isArray(data?.destinatari) ? data.destinatari : [];
      setEmailFiscale(destinatari[0] || "");
      setEmailLavoro(destinatari[1] || "");
      setEmailConsulenza(destinatari[2] || "");
      setAttivo(!!data?.attivo);
      setOraInvio(String(data?.ora_invio || "08:00").slice(0, 5));
    })();
  }, [studioId]);

  async function saveConfig() {
    if (!authorized) return false;
    setSaving(true);
    setMessage("");

    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione utente non disponibile");

      const response = await fetch("/api/presenze/report-email-config", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studio_id: studioId,
          destinatari: [emailFiscale.trim(), emailLavoro.trim(), emailConsulenza.trim()],
          ora_invio: oraInvio,
          attivo,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.success) {
        throw new Error(body?.error || "Errore salvataggio configurazione");
      }

      setMessage(attivo ? "Automatismo attivo e configurazione salvata." : "Configurazione salvata. Automatismo disattivato.");
      return true;
    } catch (error: any) {
      setMessage(error?.message || "Errore salvataggio configurazione");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!authorized) return;
    setTesting(true);
    setMessage("");

    try {
      const ok = await saveConfig();
      if (!ok) return;

      const token = await getToken();
      if (!token) throw new Error("Sessione utente non disponibile");

      const response = await fetch(
        `/api/presenze/report-giornaliero-email?force=true&studio_id=${encodeURIComponent(studioId)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        }
      );

      const body = await response.json().catch(() => ({}));
      const result = Array.isArray(body?.results) ? body.results[0] : null;
      const recipientResults = Array.isArray(result?.recipients) ? result.recipients : [];
      const failed = recipientResults.filter((r: any) => !r?.success);

      if (!response.ok || !body?.success || !result?.sent || failed.length > 0) {
        const details = failed
          .map((r: any) => `${r?.settore || "settore"} → ${r?.to || "destinatario"}: ${r?.error || "invio non riuscito"}`)
          .join(" | ");
        throw new Error(details || body?.error || result?.reason || "Il server non ha confermato l'invio delle email");
      }

      const inviati = recipientResults
        .filter((r: any) => r?.success)
        .map((r: any) => `${r.settore}: ${r.to}`)
        .join(" | ");
      const saltati = Array.isArray(result?.skipped_recipients) ? result.skipped_recipients.join(", ") : "";

      setMessage(
        `${inviati ? `Invii accettati: ${inviati}.` : "Nessun destinatario valorizzato: nessun invio eseguito."}${saltati ? ` Campi vuoti saltati: ${saltati}.` : ""}`
      );
    } catch (error: any) {
      setMessage(`ERRORE INVIO: ${error?.message || "Errore invio email di test"}`);
    } finally {
      setTesting(false);
    }
  }

  if (authorized !== true) return null;

  return (
    <div className="mb-6 rounded-lg border border-sky-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-900">Invio automatico presenze</div>
          <div className="text-xs text-slate-500">Ogni destinatario riceve esclusivamente le presenze del proprio settore.</div>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} />
          Invio automatico attivo
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_1fr_140px_auto_auto] xl:items-end">
        <label className="text-sm"><span className="mb-1 block text-slate-600">Destinatario fiscale</span><input type="email" value={emailFiscale} onChange={(e) => setEmailFiscale(e.target.value)} className="w-full rounded border px-3 py-2" /></label>
        <label className="text-sm"><span className="mb-1 block text-slate-600">Destinatario lavoro</span><input type="email" value={emailLavoro} onChange={(e) => setEmailLavoro(e.target.value)} className="w-full rounded border px-3 py-2" /></label>
        <label className="text-sm"><span className="mb-1 block text-slate-600">Destinatario consulenza</span><input type="email" value={emailConsulenza} onChange={(e) => setEmailConsulenza(e.target.value)} className="w-full rounded border px-3 py-2" /></label>
        <label className="text-sm"><span className="mb-1 block text-slate-600">Ora prevista</span><input type="time" value={oraInvio} onChange={(e) => setOraInvio(e.target.value)} className="w-full rounded border px-3 py-2" /></label>
        <button type="button" onClick={() => void saveConfig()} disabled={saving || testing} className="rounded border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">{saving ? "Salvataggio..." : "Salva"}</button>
        <button type="button" onClick={() => void sendTest()} disabled={saving || testing} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{testing ? "Invio..." : "Invia email di test"}</button>
      </div>

      {message && <div className="mt-3 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</div>}
      <div className="mt-3 text-xs text-slate-500">Pannello riservato all'Amministratore di sistema generale. Mittente automatico: noreply@revisionicommerciali.it.</div>
    </div>
  );
}

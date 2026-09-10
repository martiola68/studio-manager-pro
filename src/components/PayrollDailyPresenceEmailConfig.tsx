import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Props = { studioId: string };

export default function PayrollDailyPresenceEmailConfig({ studioId }: Props) {
  const supabase = getSupabaseClient() as any;
  const [emailFiscale, setEmailFiscale] = useState("m.artiola@revisionicommerciali.it");
  const [emailLavoro, setEmailLavoro] = useState("");
  const [emailConsulenza, setEmailConsulenza] = useState("");
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
      setEmailFiscale(destinatari[0] || "m.artiola@revisionicommerciali.it");
      setEmailLavoro(destinatari[1] || "");
      setEmailConsulenza(destinatari[2] || "");
      setAttivo(!!data.attivo);
      setOraInvio(String(data.ora_invio || "08:00").slice(0, 5));
    })();
  }, [studioId]);

  async function saveConfig() {
    setSaving(true);
    setMessage("");

    try {
      // L'ordine è intenzionale e costituisce la mappatura:
      // 0 = Fiscale, 1 = Lavoro, 2 = Consulenza.
      // I campi vuoti vengono mantenuti come stringa vuota così non si spostano i settori.
      const destinatari = [
        emailFiscale.trim(),
        emailLavoro.trim(),
        emailConsulenza.trim(),
      ];

      const { error } = await supabase
        .from("tbpresenze_report_email_config")
        .upsert(
          {
            studio_id: studioId,
            destinatari,
            ora_invio: oraInvio,
            attivo,
            updated_at: new Date().toISOString(),
          },
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
          .map(
            (r: any) =>
              `${r?.settore || "settore"} → ${r?.to || "destinatario"}: ${r?.error || "invio non riuscito"}`
          )
          .join(" | ");

        throw new Error(
          details ||
            body?.error ||
            result?.reason ||
            "Il server non ha confermato l'invio delle email"
        );
      }

      const inviati = recipientResults
        .filter((r: any) => r?.success)
        .map((r: any) => `${r.settore}: ${r.to}`)
        .join(" | ");

      const saltati = Array.isArray(result?.skipped_recipients)
        ? result.skipped_recipients.join(", ")
        : "";

      const parti = [
        inviati ? `Invii accettati: ${inviati}.` : "Nessun destinatario valorizzato: nessun invio eseguito.",
        saltati ? ` Campi vuoti saltati: ${saltati}.` : "",
      ];

      setMessage(parti.join(""));
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
          <div className="text-xs text-slate-500">
            Ogni destinatario riceve esclusivamente le presenze fisiche e Smart Working del proprio settore.
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={attivo}
            onChange={(e) => setAttivo(e.target.checked)}
          />
          Invio automatico attivo
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_1fr_140px_auto_auto] xl:items-end">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Destinatario fiscale</span>
          <input
            type="email"
            value={emailFiscale}
            onChange={(e) => setEmailFiscale(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Destinatario lavoro</span>
          <input
            type="email"
            value={emailLavoro}
            onChange={(e) => setEmailLavoro(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Destinatario consulenza</span>
          <input
            type="email"
            value={emailConsulenza}
            onChange={(e) => setEmailConsulenza(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Ora prevista</span>
          <input
            type="time"
            value={oraInvio}
            onChange={(e) => setOraInvio(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>

        <button
          type="button"
          onClick={() => void saveConfig()}
          disabled={saving || testing}
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva"}
        </button>

        <button
          type="button"
          onClick={() => void sendTest()}
          disabled={saving || testing}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {testing ? "Invio..." : "Invia email di test"}
        </button>
      </div>

      {message && (
        <div className="mt-3 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {message}
        </div>
      )}

      <div className="mt-3 text-xs text-slate-500">
        Mittente automatico: noreply@revisionicommerciali.it. I destinatari vuoti vengono semplicemente saltati, senza errore.
      </div>
    </div>
  );
}

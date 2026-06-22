import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  RefreshCw,
  Users,
} from "lucide-react";

type DashboardData = {
  kpi: {
    incarichi_attivi: number;
    controlli_da_eseguire: number;
    controlli_scaduti: number;
    followup_aperti: number;
    followup_critici: number;
    relazioni_generate_anno: number;
  };
  controlli_prossimi: any[];
  followup_aperti: any[];
  followup_scaduti: any[];
};

function formatDateIT(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("it-IT");
}

async function getCurrentStudioId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: utente, error } = await supabase
    .from("tbutenti")
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (error || !utente?.studio_id) {
    console.error("Errore recupero studio_id:", error);
    return null;
  }

  return utente.studio_id;
}

export default function DashboardRevisione() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setErrore("");

    const studioId = await getCurrentStudioId();

      if (!studioId) {
        setErrore("Studio non trovato. Effettua nuovamente l'accesso.");
        setData(null);
        return;
      }

      const res = await fetch(
        `/api/revisione-controllo/dashboard?studio_id=${studioId}`
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore caricamento dashboard");
      }

      setData(json.data);
    } catch (error: any) {
      console.error(error);
      setErrore(error?.message || "Errore caricamento dashboard revisione");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function generaTrimestri() {
  try {
    setLoading(true);
    setErrore("");

    const studioId = await getCurrentStudioId();

    if (!studioId) {
      setErrore("Studio non trovato");
      return;
    }

    const anno = new Date().getFullYear();

    const res = await fetch(
      "/api/revisione-controllo/genera-trimestri",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studio_id: studioId,
          anno,
        }),
      }
    );

    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(
        json.error || "Errore generazione trimestri"
      );
    }

    alert(
      `Generazione completata.\nCreati: ${json.creati || 0}\nSaltati: ${json.saltati || 0}`
    );

    await loadDashboard();
  } catch (error: any) {
    console.error(error);
    setErrore(
      error?.message || "Errore generazione trimestri"
    );
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    loadDashboard();
  }, []);

  const kpi = data?.kpi;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Dashboard Revisione e Controllo
          </h1>
          <p className="text-sm text-slate-500">
            Riepilogo incarichi, controlli trimestrali, follow-up e relazioni.
          </p>
        </div>

      <div className="flex gap-2">
  <button
    type="button"
    onClick={generaTrimestri}
    className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
  >
    Genera trimestri anno
  </button>

  <button
    type="button"
    onClick={loadDashboard}
    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
  >
    <RefreshCw className="h-4 w-4" />
    Aggiorna
 </button>
</div>
</div>

      {errore && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errore}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border bg-white p-6 text-sm text-slate-500">
          Caricamento dashboard...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              title="Incarichi attivi"
              value={kpi?.incarichi_attivi || 0}
              icon={<Users className="h-5 w-5" />}
            />
            <KpiCard
              title="Controlli da eseguire"
              value={kpi?.controlli_da_eseguire || 0}
              icon={<ClipboardList className="h-5 w-5" />}
            />
            <KpiCard
              title="Controlli scaduti"
              value={kpi?.controlli_scaduti || 0}
              icon={<AlertTriangle className="h-5 w-5" />}
              danger
            />
            <KpiCard
              title="Follow-up aperti"
              value={kpi?.followup_aperti || 0}
              icon={<CalendarClock className="h-5 w-5" />}
            />
            <KpiCard
              title="Follow-up critici"
              value={kpi?.followup_critici || 0}
              icon={<AlertTriangle className="h-5 w-5" />}
              danger
            />
            <KpiCard
              title="Relazioni generate anno"
              value={kpi?.relazioni_generate_anno || 0}
              icon={<FileText className="h-5 w-5" />}
            />
          </div>

          <Section title="Controlli prossimi 30 giorni">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Trimestre</th>
                  <th className="px-3 py-2">Scadenza</th>
                  <th className="px-3 py-2">Stato</th>
                </tr>
              </thead>
              <tbody>
                {(data?.controlli_prossimi || []).length === 0 ? (
                  <EmptyRow colSpan={4} text="Nessun controllo prossimo." />
                ) : (
                  data?.controlli_prossimi.map((item: any) => (
                    <tr key={item.id} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2">
                        {item.cliente || item.ragione_sociale || item.nominativo || "-"}
                      </td>
                      <td className="px-3 py-2">
                        T{item.trimestre} / {item.anno}
                      </td>
                      <td className="px-3 py-2">
                        {formatDateIT(item.data_scadenza)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge value={item.stato} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Section>

          <Section title="Follow-up aperti">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Descrizione</th>
                  <th className="px-3 py-2">Gravità</th>
                  <th className="px-3 py-2">Scadenza</th>
                </tr>
              </thead>
              <tbody>
                {(data?.followup_aperti || []).length === 0 ? (
                  <EmptyRow colSpan={4} text="Nessun follow-up aperto." />
                ) : (
                  data?.followup_aperti.map((item: any) => (
                    <tr key={item.id} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2">
                        {item.cliente || item.ragione_sociale || item.nominativo || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {item.descrizione ||
                          item.raccomandazione ||
                          item.note ||
                          "-"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge value={item.gravita} />
                      </td>
                      <td className="px-3 py-2">
                        {formatDateIT(item.data_follow_up)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Section>

          <Section title="Follow-up scaduti">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Descrizione</th>
                  <th className="px-3 py-2">Giorni ritardo</th>
                </tr>
              </thead>
              <tbody>
                {(data?.followup_scaduti || []).length === 0 ? (
                  <EmptyRow colSpan={3} text="Nessun follow-up scaduto." />
                ) : (
                  data?.followup_scaduti.map((item: any) => (
                    <tr key={item.id} className="border-b hover:bg-red-50">
                      <td className="px-3 py-2">
                        {item.cliente || item.ragione_sociale || item.nominativo || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {item.descrizione ||
                          item.raccomandazione ||
                          item.note ||
                          "-"}
                      </td>
                      <td className="px-3 py-2 font-semibold text-red-700">
                        {item.giorni_ritardo || 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Section>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/revisione-controllo/incarichi"
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Archivio incarichi
            </Link>
            <Link
              href="/revisione-controllo/controlli"
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Controlli trimestrali
            </Link>
            <Link
              href="/revisione-controllo/followup"
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Follow-up
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  danger = false,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-5 shadow-sm ${
        danger && value > 0 ? "border-red-200 bg-red-50" : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p
            className={`mt-2 text-3xl font-bold ${
              danger && value > 0 ? "text-red-700" : "text-slate-800"
            }`}
          >
            {value}
          </p>
        </div>
        <div
          className={`rounded-full p-3 ${
            danger && value > 0
              ? "bg-red-100 text-red-700"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-slate-400">
        {text}
      </td>
    </tr>
  );
}

function Badge({ value }: { value?: string | null }) {
  const label = value || "-";
  const normalized = label.toLowerCase();

  let cls = "bg-slate-100 text-slate-700";

  if (
    normalized.includes("scad") ||
    normalized.includes("crit") ||
    normalized.includes("alta")
  ) {
    cls = "bg-red-100 text-red-700";
  } else if (
    normalized.includes("complet") ||
    normalized.includes("chius") ||
    normalized.includes("bassa")
  ) {
    cls = "bg-green-100 text-green-700";
  } else if (normalized.includes("media")) {
    cls = "bg-yellow-100 text-yellow-700";
  }

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

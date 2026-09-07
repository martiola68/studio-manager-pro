import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  CloudCog,
  ExternalLink,
  Network,
  Settings2,
  ShieldCheck,
  Users,
  Building2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SetupStatus = {
  microsoft: boolean;
  users: boolean;
  client: boolean;
  organs: boolean;
  services: boolean;
  agenda: boolean;
};

const EMPTY_STATUS: SetupStatus = {
  microsoft: false,
  users: false,
  client: false,
  organs: false,
  services: false,
  agenda: false,
};

export default function SetupWizardCard() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SetupStatus>(EMPTY_STATUS);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const { data: authData } = await supabase.auth.getSession();
        const email = authData.session?.user?.email;
        if (!email) return;

        const { data: user } = await supabase
          .from("tbutenti")
          .select("id, studio_id, tipo_utente, amministratore_sistema_generale")
          .eq("email", email)
          .maybeSingle();

        const isAdmin =
          user?.tipo_utente === "Admin" || user?.amministratore_sistema_generale === true;
        if (!isAdmin || !user?.studio_id) {
          if (!cancelled) setVisible(false);
          return;
        }

        if (!cancelled) setVisible(true);

        const studioId = user.studio_id;
        const [usersResult, clientsResult, organsResult, ivaResult, agendaResult] = await Promise.all([
          supabase
            .from("tbutenti")
            .select("id, tipo_utente, microsoft_connection_id", { count: "exact" })
            .eq("studio_id", studioId)
            .neq("attivo", false),
          supabase
            .from("tbclienti")
            .select("id", { count: "exact", head: true })
            .eq("studio_id", studioId)
            .eq("attivo", true),
          (supabase as any)
            .from("tbclienti_organi")
            .select("id", { count: "exact", head: true })
            .eq("studio_id", studioId),
          (supabase as any)
            .from("tbscadiva")
            .select("id", { count: "exact", head: true })
            .eq("studio_id", studioId),
          supabase
            .from("tbagenda")
            .select("id", { count: "exact", head: true })
            .eq("utente_id", user.id),
        ]);

        const studioUsers = usersResult.data || [];
        const hasAdmin = studioUsers.some((item: any) => item.tipo_utente === "Admin");
        const hasUser = studioUsers.some((item: any) => item.tipo_utente !== "Admin");
        const hasMicrosoft = studioUsers.some((item: any) => Boolean(item.microsoft_connection_id));

        if (!cancelled) {
          setStatus({
            microsoft: hasMicrosoft,
            users: hasAdmin && hasUser,
            client: (clientsResult.count || 0) > 0,
            organs: !organsResult.error && (organsResult.count || 0) > 0,
            services: !ivaResult.error && (ivaResult.count || 0) > 0,
            agenda: !agendaResult.error && (agendaResult.count || 0) > 0,
          });
        }
      } catch (error) {
        console.warn("Verifica wizard configurazione non disponibile:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const steps = useMemo(
    () => [
      {
        key: "microsoft" as const,
        title: "Microsoft 365 e Azure",
        description: "Configura l'App Azure, inserisci Tenant/Client ID e crea la connessione Microsoft 365.",
        href: "/microsoft365?tab=connessioni",
        icon: CloudCog,
      },
      {
        key: "users" as const,
        title: "Utenti dello studio",
        description: "Crea almeno un Admin e un User e collega gli utenti alla connessione Microsoft corretta.",
        href: "/impostazioni/utenti",
        icon: Users,
      },
      {
        key: "client" as const,
        title: "Primo cliente società",
        description: "Inserisci l'anagrafica completa del primo cliente e assegna gli operatori.",
        href: "/clienti?nuovo=1",
        icon: Building2,
      },
      {
        key: "organs" as const,
        title: "Soci e organi sociali",
        description: "Completa soci, amministratori, eventuale organo di controllo e titolare effettivo.",
        href: "/clienti/organi-sociali",
        icon: Network,
      },
      {
        key: "services" as const,
        title: "Servizi e scadenzari",
        description: "Abilita i servizi del cliente e verifica la generazione dei relativi scadenzari.",
        href: "/clienti",
        icon: Settings2,
      },
      {
        key: "agenda" as const,
        title: "Agenda e sincronizzazione Outlook",
        description: "Crea un appuntamento e prova inserimento, modifica ed eliminazione sincronizzati con Outlook.",
        href: "/agenda",
        icon: CalendarCheck,
      },
    ],
    []
  );

  if (!visible) return null;

  const completed = steps.filter((step) => status[step.key]).length;
  const percent = Math.round((completed / steps.length) * 100);

  return (
    <Card className="mb-8 overflow-hidden border border-[#8cddff] border-l-4 border-l-[#0d6f9f] bg-white shadow-[0_12px_30px_rgba(14,78,112,0.12)]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#0d6f9f]" />
              <CardTitle className="text-lg text-[#071b36]">Prima configurazione SMP</CardTitle>
            </div>
            <p className="mt-1 text-sm text-[#5b7282]">
              Percorso guidato per rendere operativo lo studio senza saltare i passaggi essenziali.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold text-[#071b36]">
                {loading ? "Verifica..." : `${completed} di ${steps.length} completati`}
              </div>
              <div className="text-xs text-[#5b7282]">{loading ? "" : `${percent}% configurato`}</div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#8cddff] text-[#0b4f7d]"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-[#0d6f9f] transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {steps.map((step, index) => {
              const done = status[step.key];
              const Icon = step.icon;
              return (
                <div
                  key={step.key}
                  className={`rounded-xl border p-4 ${
                    done
                      ? "border-emerald-200 bg-emerald-50/70"
                      : "border-[#c7eafb] bg-[#f7fbfd]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${done ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-[#0d6f9f]"}`}>
                      {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#6b7e8b]">{index + 1}</span>
                        <h3 className="text-sm font-bold text-[#071b36]">{step.title}</h3>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#617887]">{step.description}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${done ? "text-emerald-700" : "text-amber-700"}`}>
                          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                          {done ? "Completato" : "Da completare"}
                        </span>
                        <Link href={step.href}>
                          <Button size="sm" variant="outline" className="h-8 border-[#8cddff] px-2.5 text-xs text-[#0b4f7d] hover:bg-[#e8f7ff]">
                            Apri <ExternalLink className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

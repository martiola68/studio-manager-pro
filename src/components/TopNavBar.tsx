import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { usePathname, useSearchParams } from "next/navigation";
import type { Database } from "@/lib/supabase/types";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Calendar,
  FileText,
  Mail,
  Settings,
  ChevronDown,
  Building2,
  MessageSquare,
  Key,
  Cloud,
  Link2,
  RefreshCcw,
  Clock,
  ShieldCheck,
  BriefcaseBusiness,
  FolderKanban,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type UtenteRow = Database["public"]["Tables"]["tbutenti"]["Row"];

type TopNavUser = Pick<
  UtenteRow,
  | "id"
  | "nome"
  | "cognome"
  | "email"
  | "tipo_utente"
  | "ruolo_operatore_id"
  | "attivo"
  | "created_at"
  | "updated_at"
>;

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  adminOnly?: boolean;
  children?: MenuItem[];
}

export function TopNavBar() {
  const [currentUser, setCurrentUser] = useState<TopNavUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [messaggiNonLetti, setMessaggiNonLetti] = useState(0);
  const [promemoriaRicevuti, setPromemoriaRicevuti] = useState(0);
  const [promemoriaAttivi, setPromemoriaAttivi] = useState(0);
  const [eventiImminenti, setEventiImminenti] = useState(0);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentRoute = searchParams?.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  const loadCurrentUser = async () => {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.email) {
        const { data: utente, error } = await supabase
          .from("tbutenti")
          .select(
            "id, nome, cognome, email, tipo_utente, ruolo_operatore_id, attivo, created_at, updated_at"
          )
          .eq("email", session.user.email)
          .maybeSingle();

        if (error) {
          console.error("Errore caricamento utente:", error);
          setCurrentUser(null);
        } else if (utente) {
          setCurrentUser(utente as TopNavUser);
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (error) {
      console.error("Errore caricamento utente:", error);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadMessaggiNonLetti = async () => {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        setMessaggiNonLetti(0);
        return;
      }

      const { messaggioService } = await import("@/services/messaggioService");
      const count = await messaggioService.getMessaggiNonLettiCount(session.user.id);
      setMessaggiNonLetti(count);
    } catch (error) {
      console.warn("⚠️ Errore caricamento messaggi non letti (gestito):", error);
      setMessaggiNonLetti(0);
    }
  };

  const loadPromemoriaAttivi = async () => {
    if (!currentUser) {
      setPromemoriaAttivi(0);
      return;
    }

    try {
      const supabase = getSupabaseClient();

      const { count, error } = await supabase
        .from("tbpromemoria")
        .select("*", { count: "exact", head: true })
        .eq("working_progress", "Aperto")
        .eq("destinatario_id", currentUser.id);

      if (error) throw error;

      setPromemoriaAttivi(count ?? 0);
    } catch (error) {
      console.error("Errore caricamento promemoria attivi (gestito):", error);
      setPromemoriaAttivi(0);
    }
  };

  const loadPromemoriaRicevuti = async () => {
    if (!currentUser) return;

    try {
      const supabase = getSupabaseClient();

      const { count, error } = await supabase
        .from("tbpromemoria")
        .select("*", { count: "exact", head: true })
        .eq("destinatario_id", currentUser.id)
        .eq("working_progress", "da_fare");

      if (error) {
        console.warn("⚠️ Errore query promemoria ricevuti:", error);
        return;
      }

      setPromemoriaRicevuti(count || 0);
    } catch (error) {
      console.warn("⚠️ Errore caricamento promemoria ricevuti:", error);
      setPromemoriaRicevuti(0);
    }
  };

  const loadEventiImminenti = async () => {
    if (!currentUser) return;

    try {
      const supabase = getSupabaseClient();

      const now = new Date();
      const twoDaysLater = new Date();
      twoDaysLater.setDate(now.getDate() + 2);

      const { count, error } = await supabase
        .from("tbagenda")
        .select("*", { count: "exact", head: true })
        .eq("utente_id", currentUser.id)
        .gte("data_inizio", now.toISOString())
        .lte("data_inizio", twoDaysLater.toISOString());

      if (error) {
        console.warn("⚠️ Errore query eventi imminenti:", error);
        return;
      }

      setEventiImminenti(count || 0);
    } catch (error) {
      console.warn("⚠️ Errore caricamento eventi imminenti:", error);
    }
  };

  const handlePromemoriaClick = () => {
    setPromemoriaRicevuti(0);
  };

  useEffect(() => {
    void loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    void loadMessaggiNonLetti();
    void loadPromemoriaAttivi();
    void loadPromemoriaRicevuti();
    void loadEventiImminenti();

    const interval = setInterval(() => {
      void loadMessaggiNonLetti();
      void loadPromemoriaAttivi();
      void loadPromemoriaRicevuti();
      void loadEventiImminenti();
    }, 60000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const handler = () => {
      void loadPromemoriaAttivi();
    };

    window.addEventListener("promemoria-updated", handler);
    return () => {
      window.removeEventListener("promemoria-updated", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const menuItems: MenuItem[] = [
    {
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
      href: "/dashboard",
    },
    {
      label: "Agenda",
      icon: <Calendar className="h-4 w-4" />,
      href: "/agenda",
    },
    {
      label: "Promemoria",
      icon: <FileText className="h-4 w-4" />,
      href: "/promemoria",
    },
   {
  label: "Strumenti",
  icon: <BriefcaseBusiness className="h-4 w-4" />,
  children: [
    { label: "Messaggistica", icon: <MessageSquare className="h-4 w-4" />, href: "/messaggi" },
    { label: "Rubrica", href: "/contatti", icon: <UserCircle className="h-4 w-4" /> },

    { label: "Newsletter", href: "/newsletter", icon: <Mail className="h-4 w-4" /> },
    { label: "Comunicazioni interne", href: "/comunicazioni/interne", icon: <MessageSquare className="h-4 w-4" /> },
    { label: "Comunicazioni clienti", href: "/comunicazioni/clienti", icon: <Mail className="h-4 w-4" /> },

    { label: "Accesso Portali", icon: <Key className="h-4 w-4" />, href: "/accesso-portali" },
    { label: "Cassetti Fiscali", icon: <FileText className="h-4 w-4" />, href: "/cassetti-fiscali" },
  ],
  },
    {
      label: "Scadenzario",
      icon: <Calendar className="h-4 w-4" />,
      children: [
        { label: "Elenco Generale", href: "/scadenze/elenco-generale", icon: <FileText className="h-4 w-4" /> },
        { label: "Calendario", href: "/scadenze/calendario", icon: <Calendar className="h-4 w-4" /> },
        { label: "Riepilogo", href: "/scadenze/riepilogo", icon: <FileText className="h-4 w-4" /> },
        { label: "IVA", href: "/scadenze/iva", icon: <FileText className="h-4 w-4" /> },
        { label: "CCGG", href: "/scadenze/ccgg", icon: <FileText className="h-4 w-4" /> },
        { label: "CU", href: "/scadenze/cu", icon: <FileText className="h-4 w-4" /> },
        { label: "IMU", href: "/scadenze/imu", icon: <FileText className="h-4 w-4" /> },
        { label: "Fiscali", href: "/scadenze/fiscali", icon: <FileText className="h-4 w-4" /> },
        { label: "Bilanci", href: "/scadenze/bilanci", icon: <FileText className="h-4 w-4" /> },
        { label: "770", href: "/scadenze/modello-770", icon: <FileText className="h-4 w-4" /> },
        { label: "Liquidazioni IVA - LIPE", href: "/scadenze/lipe", icon: <FileText className="h-4 w-4" /> },
        { label: "Esterometro", href: "/scadenze/esterometro", icon: <FileText className="h-4 w-4" /> },
        { label: "Affitti", href: "/scadenze/affitti", icon: <FileText className="h-4 w-4" /> },
        { label: "Proforma", href: "/scadenze/proforma", icon: <FileText className="h-4 w-4" /> },
      ],
    },
    {
      label: "Contenzioso",
      icon: <Scale className="h-4 w-4" />,
      children: [
        { label: "Pratiche contenzioso", href: "/contenzioso", icon: <FolderKanban className="h-4 w-4" /> },
        { label: "Regole scadenze", href: "/contenzioso/regole-scadenze", icon: <Settings className="h-4 w-4" /> },
        { label: "Sospensioni termini", href: "/contenzioso/sospensioni", icon: <Clock className="h-4 w-4" /> },
        { label: "Tipi atto", href: "/contenzioso/tipi-atto", icon: <FileText className="h-4 w-4" /> },
      ],
    },
    {
      label: "AML",
      icon: <ShieldCheck className="h-4 w-4" />,
      children: [
        { label: "Elenco Antiriciclaggio", href: "/antiriciclaggio", icon: <ShieldCheck className="h-4 w-4" /> },
        { label: "Rappresentanti legali", href: "/antiriciclaggio/rappresentanti", icon: <UserCircle className="h-4 w-4" /> },
        { label: "Prestazioni AR", href: "/impostazioni/elenco-prestazioni-ar", icon: <FileText className="h-4 w-4" /> },
        { label: "Professionisti", href: "/antiriciclaggio/responsabili-av", icon: <Users className="h-4 w-4" /> },
        { label: "Soggetti responsabili", href: "/antiriciclaggio/responsabili-av-societa", icon: <Users className="h-4 w-4" /> },
        { label: "Comunicazioni inviate", href: "/antiriciclaggio/comunicazioni", icon: <Mail className="h-4 w-4" /> },
      ],
    },
    {
      label: "Anagrafiche",
      icon: <Users className="h-4 w-4" />,
      children: [
        { label: "Clienti", href: "/clienti", icon: <Users className="h-4 w-4" /> },
        {
          label: "Rappresentanti legali",
          href: "/antiriciclaggio/rappresentanti",
          icon: <UserCircle className="h-4 w-4" />,
        },
      ],
    },
    {
      label: "Payroll",
      icon: <Clock className="h-4 w-4" />,
      children: [
        { label: "Presenze", href: "/presenze", icon: <Clock className="h-4 w-4" /> },
        { label: "Dipendenti", href: "/payroll/dipendenti", icon: <Users className="h-4 w-4" /> },
        { label: "Qualifiche", href: "/payroll/qualifiche", icon: <FileText className="h-4 w-4" /> },
      ],
    },
    {
      label: "Connessioni",
      icon: <Cloud className="h-4 w-4" />,
      children: [
        {
          label: "Microsoft 365 - Connessioni",
          href: "/microsoft365?tab=connessioni",
          icon: <Link2 className="h-4 w-4" />,
        },
        {
          label: "Microsoft 365 - Sync",
          href: "/microsoft365?tab=sync",
          icon: <RefreshCcw className="h-4 w-4" />,
        },
      ],
    },
    {
      label: "Impostazioni",
      icon: <Settings className="h-4 w-4" />,
      adminOnly: true,
      children: [
        { label: "Utenti", href: "/impostazioni/utenti", icon: <Users className="h-4 w-4" /> },
        { label: "Dati Studio", href: "/impostazioni/studio", icon: <Building2 className="h-4 w-4" /> },
        { label: "Ruoli", href: "/impostazioni/ruoli", icon: <Settings className="h-4 w-4" /> },
        { label: "Prestazioni", href: "/impostazioni/prestazioni", icon: <Settings className="h-4 w-4" /> },
        { label: "Scadenzari", href: "/impostazioni/scadenzari", icon: <Settings className="h-4 w-4" /> },
        { label: "Tipi Scadenze", href: "/impostazioni/tipi-scadenze", icon: <Settings className="h-4 w-4" /> },
        { label: "Tipo Promemoria", href: "/impostazioni/tipo-promemoria", icon: <Settings className="h-4 w-4" /> },
      ],
    },
  ];

  const isExactRoute = (href?: string) => {
    if (!href) return false;
    return currentRoute === href;
  };

  const isPathActive = (href?: string) => {
    if (!href) return false;

    const normalizedHref = href.split("?")[0];
    return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
  };

  const isActive = (item: MenuItem) => {
    const anagraficheOverrides = ["/antiriciclaggio/rappresentanti"];

    if (item.label === "Antiriciclaggio") {
      const isOverrideRoute = anagraficheOverrides.some((route) => {
        return pathname === route || pathname.startsWith(`${route}/`);
      });

      if (isOverrideRoute) {
        return false;
      }
    }

    if (item.href && (isExactRoute(item.href) || isPathActive(item.href))) {
      return true;
    }

    if (item.children?.length) {
      return item.children.some((child) => {
        if (!child.href) return false;

        return isExactRoute(child.href) || isPathActive(child.href);
      });
    }

    return false;
  };

  const renderMenuItem = (item: MenuItem) => {
    if (item.adminOnly && currentUser?.tipo_utente !== "Admin") return null;

    const hasChildren = !!(item.children && item.children.length > 0);
    const itemActive = isActive(item);

    const showMessaggiBadge = item.label === "Messaggi" && messaggiNonLetti > 0;
    const showPromemoriaRicevutiBadge = item.label === "Promemoria" && promemoriaRicevuti > 0;
    const showPromemoriaAlert = item.label === "Promemoria" && promemoriaAttivi > 0;
    const showAgendaBadge = item.label === "Agenda" && eventiImminenti > 0;

    if (hasChildren) {
      return (
        <DropdownMenu key={item.label}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-lg",
                itemActive
                  ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                  : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-56">
            {item.children?.map((child) => {
              const childActive = isActive(child);

              const childShowMessaggiBadge =
                child.label === "Messaggi" && messaggiNonLetti > 0;

              const childShowPromemoriaRicevutiBadge =
                child.label === "Promemoria" && promemoriaRicevuti > 0;

              const childShowPromemoriaAlert =
                child.label === "Promemoria" && promemoriaAttivi > 0;

              const childShowAgendaBadge =
                child.label === "Agenda" && eventiImminenti > 0;

              return (
                <DropdownMenuItem key={child.label} asChild>
                  <Link
                    href={child.href || "#"}
                    className={cn(
                      "flex items-center gap-2 px-2 py-2 cursor-pointer",
                      childActive && "bg-blue-50 text-blue-600 font-semibold"
                    )}
                  >
                    {child.icon}
                    <span>{child.label}</span>

                    {childShowMessaggiBadge && (
                      <Badge variant="destructive" className="ml-auto px-1.5 py-0 h-5 min-w-[20px] text-xs">
                        {messaggiNonLetti > 99 ? "99+" : messaggiNonLetti}
                      </Badge>
                    )}

                    {childShowPromemoriaRicevutiBadge && (
                      <Badge variant="destructive" className="ml-auto px-1.5 py-0 h-5 min-w-[20px] text-xs">
                        {promemoriaRicevuti > 99 ? "99+" : promemoriaRicevuti}
                      </Badge>
                    )}

                    {childShowPromemoriaAlert && (
                      <Badge variant="destructive" className="ml-auto px-1.5 py-0 h-5 min-w-[20px] text-xs">
                        {promemoriaAttivi > 99 ? "99+" : promemoriaAttivi}
                      </Badge>
                    )}

                    {childShowAgendaBadge && (
                      <Badge variant="destructive" className="ml-auto px-1.5 py-0 h-5 min-w-[20px] text-xs">
                        {eventiImminenti > 99 ? "99+" : eventiImminenti}
                      </Badge>
                    )}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <Link
        key={item.label}
        href={item.href || "#"}
        onClick={item.label === "Promemoria" ? handlePromemoriaClick : undefined}
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors relative",
          itemActive
            ? "bg-blue-600 text-white"
            : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
        )}
      >
        {item.icon}
        <span>{item.label}</span>

        {showMessaggiBadge && (
          <Badge variant="destructive" className="ml-1 px-1.5 py-0 h-5 min-w-[20px] text-xs">
            {messaggiNonLetti > 99 ? "99+" : messaggiNonLetti}
          </Badge>
        )}

        {showPromemoriaRicevutiBadge && (
          <Badge variant="destructive" className="ml-1 px-1.5 py-0 h-5 min-w-[20px] text-xs">
            {promemoriaRicevuti > 99 ? "99+" : promemoriaRicevuti}
          </Badge>
        )}

        {showPromemoriaAlert && (
          <Badge variant="destructive" className="ml-1 px-1.5 py-0 h-5 min-w-[20px] text-xs">
            {promemoriaAttivi > 99 ? "99+" : promemoriaAttivi}
          </Badge>
        )}

        {showAgendaBadge && (
          <Badge variant="destructive" className="ml-1 px-1.5 py-0 h-5 min-w-[20px] text-xs">
            {eventiImminenti > 99 ? "99+" : eventiImminenti}
          </Badge>
        )}
      </Link>
    );
  };

  if (loading) {
    return (
      <nav className="w-full bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
      </nav>
    );
  }

  return (
    <nav className="w-full bg-white border-b border-gray-200 shadow-sm sticky top-[140px] z-40">
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1 px-4 py-2 min-w-max">
          {menuItems.map((item) => renderMenuItem(item))}
        </div>
      </div>
    </nav>
  );
}

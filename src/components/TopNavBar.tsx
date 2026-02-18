import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
import type React from "react";
import type { Database } from "@/lib/supabase/types";
import { ShieldCheck } from "lucide-react";
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
  Bell,
  Key,
  FolderOpen,
  LogOut,
  Sun,
  Moon,
  User,
  BookOpen,
  FolderArchive,
  Tag,
  Cloud,
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

type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  adminOnly?: boolean;
  children?: MenuItem[];
}

export function TopNavBar() {
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  const [loading, setLoading] = useState(true);
  const [messaggiNonLetti, setMessaggiNonLetti] = useState(0);
  const [promemoriaRicevuti, setPromemoriaRicevuti] = useState(0);
  const [promemoriaAttivi, setPromemoriaAttivi] = useState(0);
  const [eventiImminenti, setEventiImminenti] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    if (currentUser) {
      loadMessaggiNonLetti();
      loadPromemoriaAttivi();
      loadPromemoriaRicevuti();
      loadEventiImminenti();
      const interval = setInterval(() => {
        loadMessaggiNonLetti();
        loadPromemoriaAttivi();
        loadPromemoriaRicevuti();
        loadEventiImminenti();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const loadEventiImminenti = async () => {
    if (!currentUser) return;

    try {
      const now = new Date();
      const twoDaysLater = new Date();
      twoDaysLater.setDate(now.getDate() + 2);
      
      const { count, error } = await supabase
        .from("tbagenda")
        .select("*", { count: 'exact', head: true })
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

  const loadMessaggiNonLetti = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.warn("⚠️ Nessuna sessione attiva, skip caricamento messaggi");
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

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadPromemoriaAttivi();
      const interval = setInterval(loadPromemoriaAttivi, 60000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

useEffect(() => {
  if (!currentUser) return;

  const handler = () => {
    loadPromemoriaAttivi();
  };

  window.addEventListener("promemoria-updated", handler);
  return () => {
    window.removeEventListener("promemoria-updated", handler);
  };
}, [currentUser]);
  
const loadPromemoriaAttivi = async () => {
  if (!currentUser) {
    setPromemoriaAttivi(0);
    return;
  }

  try {
    // Conta SOLO i promemoria "Aperto" destinati all'utente loggato (tbutenti.id)
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
      const { count, error } = await supabase
        .from("tbpromemoria")
        .select("*", { count: 'exact', head: true })
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

  const handlePromemoriaClick = () => {
    setPromemoriaRicevuti(0);
  };

  const loadCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.email) {
        const { data: utente } = await supabase
          .from("tbutenti")
          .select("*")
          .eq("email", session.user.email)
          .single();
        
        if (utente) {
          setCurrentUser(utente);
        }
      }
    } catch (error) {
      console.error("Errore caricamento utente:", error);
    } finally {
      setLoading(false);
    }
  };

  const menuItems: MenuItem[] = [
    {
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
      href: "/dashboard"
    },
    {
      label: "Messaggi",
      href: "/messaggi",
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      label: "Agenda",
      icon: <Calendar className="h-4 w-4" />,
      href: "/agenda"
    },
    {
      label: "Rubrica",
      icon: <UserCircle className="h-4 w-4" />,
      href: "/contatti"
    },
    {
      label: "Promemoria",
      icon: <FileText className="h-4 w-4" />,
      href: "/promemoria"
    },
    {
      label: "Scadenzario",
      icon: <FileText className="h-4 w-4" />,
      children: [
        { label: "Elenco Generale", href: "/scadenze/elenco-generale", icon: null },
        { label: "Calendario", href: "/scadenze/calendario", icon: null },
        { label: "IVA", href: "/scadenze/iva", icon: null },
        { label: "CCGG", href: "/scadenze/ccgg", icon: null },
        { label: "CU", href: "/scadenze/cu", icon: null },
        { label: "IMU", href: "/scadenze/imu", icon: null },
        { label: "Fiscali", href: "/scadenze/fiscali", icon: null },
        { label: "Bilanci", href: "/scadenze/bilanci", icon: null },
        { label: "770", href: "/scadenze/modello-770", icon: null },
        { label: "LIPE", href: "/scadenze/lipe", icon: null },
        { label: "Esterometro", href: "/scadenze/esterometro", icon: null },
        { label: "Proforma", href: "/scadenze/proforma", icon: null }
      ]
    },
    {
      label: "Accesso Portali",
      icon: <Key className="h-4 w-4" />,
      href: "/accesso-portali"
    },
    {
      label: "Cassetti Fiscali",
      icon: <FileText className="h-4 w-4" />,
      href: "/cassetti-fiscali"
    },
    {
  label: "Comunicazioni",
  icon: <Mail className="h-4 w-4" />,
  href: "/comunicazioni"
},
{
  label: "Antiriciclaggio",
  icon: <ShieldCheck className="h-4 w-4" />,
  href: "/antiriciclaggio",
},
{
  label: "Clienti",
  icon: <Users className="h-4 w-4" />,
  href: "/clienti"
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
        { label: "Microsoft 365", href: "/impostazioni/microsoft365", icon: <Cloud className="h-4 w-4" /> }
      ]
    }
  ];

  const isActive = (href: string) => pathname === href;

  const renderMenuItem = (item: MenuItem) => {
    if (item.adminOnly && currentUser?.tipo_utente !== "Admin") {
      return null;
    }

    const hasChildren = item.children && item.children.length > 0;
    const showMessaggiBadge = item.label === "Messaggi" && messaggiNonLetti > 0;
    const showPromemoriaRicevutiBadge = item.label === "Promemoria" && promemoriaRicevuti > 0;
    const showPromemoriaAlert = item.label === "Promemoria" && promemoriaAttivi > 0;
    const showAgendaBadge = item.label === "Agenda" && eventiImminenti > 0;
    const hasNotification = showMessaggiBadge || showPromemoriaAlert;

    if (hasChildren) {
      return (
        <DropdownMenu key={item.label}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
                "hover:bg-blue-50 hover:text-blue-600"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {item.children?.map(child => (
              <DropdownMenuItem key={child.label} asChild>
                <Link
                  href={child.href || "#"}
                  className={cn(
                    "flex items-center gap-2 px-2 py-2 cursor-pointer",
                    isActive(child.href || "") && "bg-blue-50 text-blue-600 font-semibold"
                  )}
                >
                  {child.icon}
                  <span>{child.label}</span>
                </Link>
              </DropdownMenuItem>
            ))}
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
          isActive(item.href || "")
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
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="w-full bg-white border-b border-gray-200 shadow-sm sticky top-16 z-30">
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1 px-4 py-2 min-w-max">
          {menuItems.map(item => renderMenuItem(item))}
        </div>
      </div>
    </nav>
  );
}

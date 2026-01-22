import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
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
  Bell,
  Key,
  FolderOpen,
  LogOut,
  Sun,
  Moon
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
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  const [loading, setLoading] = useState(true);
  const [messaggiNonLetti, setMessaggiNonLetti] = useState(0);

  // ⚠️ FEATURE DISABILITATA TEMPORANEAMENTE - Causava network errors
  // useEffect(() => {
  //   if (currentUser) {
  //     loadMessaggiNonLetti();
  //     const interval = setInterval(loadMessaggiNonLetti, 60000);
  //     return () => clearInterval(interval);
  //   }
  // }, [currentUser]);

  // const loadMessaggiNonLetti = async () => {
  //   try {
  //     const { data: { session } } = await supabase.auth.getSession();
  //     if (!session?.user?.id) {
  //       console.warn("⚠️ Nessuna sessione attiva, skip caricamento messaggi");
  //       setMessaggiNonLetti(0);
  //       return;
  //     }
  //
  //     const { messaggioService } = await import("@/services/messaggioService");
  //     const count = await messaggioService.getMessaggiNonLettiCount(session.user.id);
  //     setMessaggiNonLetti(count);
  //   } catch (error) {
  //     console.warn("⚠️ Errore caricamento messaggi non letti (gestito):", error);
  //     setMessaggiNonLetti(0);
  //   }
  // };

  useEffect(() => {
    loadCurrentUser();
  }, []);

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
        { label: "Proforma", href: "/scadenze/proforma", icon: null },
        { label: "Antiriciclaggio", href: "/scadenze/antiriciclaggio", icon: null }
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
      label: "Impostazioni",
      icon: <Settings className="h-4 w-4" />,
      adminOnly: true,
      children: [
        { label: "Clienti", href: "/clienti", icon: <Users className="h-4 w-4" /> },
        { label: "Utenti", href: "/impostazioni/utenti", icon: <Users className="h-4 w-4" /> },
        { label: "Dati Studio", href: "/impostazioni/studio", icon: <Building2 className="h-4 w-4" /> },
        { label: "Ruoli", href: "/impostazioni/ruoli", icon: <Settings className="h-4 w-4" /> },
        { label: "Prestazioni", href: "/impostazioni/prestazioni", icon: <Settings className="h-4 w-4" /> },
        { label: "Scadenzari", href: "/impostazioni/scadenzari", icon: <Settings className="h-4 w-4" /> },
        { label: "Tipi Scadenze", href: "/impostazioni/tipi-scadenze", icon: <Settings className="h-4 w-4" /> },
        { label: "Tipo Promemoria", href: "/impostazioni/tipo-promemoria", icon: <Settings className="h-4 w-4" /> }
      ]
    }
  ];

  const isActive = (href: string) => router.pathname === href;

  const renderMenuItem = (item: MenuItem) => {
    if (item.adminOnly && currentUser?.tipo_utente !== "Admin") {
      return null;
    }

    const hasChildren = item.children && item.children.length > 0;
    const showBadge = item.label === "Messaggi" && messaggiNonLetti > 0;

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
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors relative",
          isActive(item.href || "")
            ? "bg-blue-600 text-white"
            : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
        )}
      >
        {item.icon}
        <span>{item.label}</span>
        {showBadge && (
          <Badge variant="destructive" className="ml-1 px-1.5 py-0 h-5 min-w-[20px] text-xs">
            {messaggiNonLetti > 99 ? "99+" : messaggiNonLetti}
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
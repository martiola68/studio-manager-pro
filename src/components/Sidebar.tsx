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
  ChevronRight,
  Building2,
  MessageSquare,
  X,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  adminOnly?: boolean;
  children?: MenuItem[];
}

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ 
  mobileOpen = false, 
  onClose = () => {} 
}: SidebarProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [messaggiNonLetti, setMessaggiNonLetti] = useState(0);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadMessaggiNonLetti();
      // Aggiorna ogni 30 secondi
      const interval = setInterval(loadMessaggiNonLetti, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

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

  const loadMessaggiNonLetti = async () => {
    if (!currentUser) return;
    
    try {
      const { messaggioService } = await import("@/services/messaggioService");
      const count = await messaggioService.getMessaggiNonLettiCount(currentUser.id);
      setMessaggiNonLetti(count);
    } catch (error) {
      console.error("Errore caricamento messaggi non letti:", error);
    }
  };

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev => 
      prev.includes(label) 
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const menuItems: MenuItem[] = [
    {
      label: "Dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
      href: "/dashboard"
    },
    {
      label: "Messaggi",
      href: "/messaggi",
      icon: <MessageSquare className="h-5 w-5" />,
    },
    {
      label: "Agenda",
      icon: <Calendar className="h-5 w-5" />,
      href: "/agenda"
    },
    {
      label: "Contatti",
      icon: <UserCircle className="h-5 w-5" />,
      href: "/contatti"
    },
    {
      label: "Promemoria",
      icon: <FileText className="h-5 w-5" />,
      href: "/promemoria"
    },
    {
      label: "Scadenzario",
      icon: <FileText className="h-5 w-5" />,
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
      label: "Cassetti Fiscali",
      icon: <FileText className="h-5 w-5" />,
      href: "/cassetti-fiscali"
    },
    {
      label: "Comunicazioni",
      icon: <Mail className="h-5 w-5" />,
      href: "/comunicazioni"
    },
    {
      label: "Impostazioni",
      icon: <Settings className="h-5 w-5" />,
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

  const renderMenuItem = (item: MenuItem, depth: number = 0) => {
    // Se è un menu solo per admin e l'utente non è admin, non mostrarlo
    if (item.adminOnly && currentUser?.tipo_utente !== "Admin") {
      return null;
    }

    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.includes(item.label);

    if (hasChildren) {
      return (
        <div key={item.label}>
          <button
            onClick={() => toggleMenu(item.label)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors rounded-lg",
              depth > 0 && "pl-8"
            )}
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {item.children?.map(child => renderMenuItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Badge per messaggi non letti
    const showBadge = item.label === "Messaggi" && messaggiNonLetti > 0;

    return (
      <Link
        key={item.label}
        href={item.href || "#"}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative",
          depth > 0 && "pl-12 text-sm",
          isActive(item.href || "")
            ? "bg-blue-600 text-white font-semibold"
            : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
        )}
      >
        {item.icon}
        <span className={depth === 0 ? "font-medium" : ""}>{item.label}</span>
        {showBadge && (
          <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
            {messaggiNonLetti > 99 ? "99+" : messaggiNonLetti}
          </span>
        )}
      </Link>
    );
  };

  if (loading) {
    return (
      <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4">
        <div className="flex items-center justify-center py-8">
          <div className="inline-block h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "w-64 bg-white border-r border-gray-200 h-screen flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
        "fixed inset-y-0 left-0 z-40",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Mobile Close Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 lg:hidden"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </Button>

        <nav className="space-y-2 p-4 flex-1 overflow-y-auto">
          {menuItems.map(item => renderMenuItem(item))}
        </nav>
      </aside>
    </>
  );
}
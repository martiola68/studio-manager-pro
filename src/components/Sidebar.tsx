import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getCurrentUser } from "@/lib/db";
import { Utente } from "@/types";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Calendar,
  FileText,
  Mail,
  Settings,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  adminOnly?: boolean;
  children?: MenuItem[];
}

export function Sidebar() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["scadenze"]);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, []);

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
      label: "Clienti",
      icon: <Users className="h-5 w-5" />,
      href: "/clienti"
    },
    {
      label: "Contatti",
      icon: <UserCircle className="h-5 w-5" />,
      href: "/contatti"
    },
    {
      label: "Utenti",
      icon: <Users className="h-5 w-5" />,
      href: "/impostazioni/utenti",
      adminOnly: true
    },
    {
      label: "Dati Studio",
      icon: <Settings className="h-5 w-5" />,
      href: "/impostazioni/studio",
      adminOnly: true
    },
    {
      label: "Scadenze",
      icon: <FileText className="h-5 w-5" />,
      children: [
        { label: "IVA", href: "/scadenze/iva", icon: null },
        { label: "CCGG", href: "/scadenze/ccgg", icon: null },
        { label: "CU", href: "/scadenze/cu", icon: null },
        { label: "Fiscali", href: "/scadenze/fiscali", icon: null },
        { label: "Bilanci", href: "/scadenze/bilanci", icon: null },
        { label: "770", href: "/scadenze/770", icon: null },
        { label: "LIPE", href: "/scadenze/lipe", icon: null },
        { label: "Esterometro", href: "/scadenze/esterometro", icon: null },
        { label: "Proforma", href: "/scadenze/proforma", icon: null }
      ]
    },
    {
      label: "Agenda",
      icon: <Calendar className="h-5 w-5" />,
      href: "/agenda"
    },
    {
      label: "Comunicazioni",
      icon: <Mail className="h-5 w-5" />,
      href: "/comunicazioni"
    },
    {
      label: "Impostazioni",
      icon: <Settings className="h-5 w-5" />,
      href: "/impostazioni",
      adminOnly: true
    }
  ];

  const isActive = (href: string) => router.pathname === href;

  const renderMenuItem = (item: MenuItem, depth: number = 0) => {
    if (item.adminOnly && currentUser?.TipoUtente !== "Admin") {
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

    return (
      <Link
        key={item.label}
        href={item.href || "#"}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
          depth > 0 && "pl-12 text-sm",
          isActive(item.href || "")
            ? "bg-blue-600 text-white font-semibold"
            : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
        )}
      >
        {item.icon}
        <span className={depth === 0 ? "font-medium" : ""}>{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4">
      <nav className="space-y-2">
        {menuItems.map(item => renderMenuItem(item))}
      </nav>
    </aside>
  );
}
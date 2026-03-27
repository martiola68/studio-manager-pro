// ⭐ VERSIONE COMPLETA CON MENU ATTIVO CORRETTO

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
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
  Key,
  Cloud,
  Link2,
  RefreshCcw,
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

  // 🔥 ACTIVE LOGIC COMPLETA
  const isActive = (href?: string, children?: MenuItem[]) => {
    if (!href && !children) return false;

    if (href && (pathname === href || pathname.startsWith(href + "/"))) {
      return true;
    }

    if (children) {
      return children.some(
        (child) =>
          child.href &&
          (pathname === child.href ||
            pathname.startsWith(child.href + "/"))
      );
    }

    return false;
  };

  const loadCurrentUser = async () => {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.email) {
      const { data } = await supabase
        .from("tbutenti")
        .select("id, nome, cognome, email, tipo_utente")
        .eq("email", session.user.email)
        .maybeSingle();

      setCurrentUser(data as TopNavUser);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadCurrentUser();
  }, []);

  const menuItems: MenuItem[] = [
    { label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, href: "/dashboard" },
    { label: "Messaggi", icon: <MessageSquare className="h-4 w-4" />, href: "/messaggi" },
    { label: "Agenda", icon: <Calendar className="h-4 w-4" />, href: "/agenda" },
    { label: "Rubrica", icon: <UserCircle className="h-4 w-4" />, href: "/contatti" },
    { label: "Promemoria", icon: <FileText className="h-4 w-4" />, href: "/promemoria" },

    {
      label: "Antiriciclaggio",
      icon: <ShieldCheck className="h-5 w-5" />,
      children: [
        { label: "Elenco Antiriciclaggio", href: "/antiriciclaggio" },
        { label: "Prestazioni AR", href: "/impostazioni/elenco-prestazioni-ar" },
        { label: "Professionisti", href: "/antiriciclaggio/responsabili-av" },
        { label: "Soggetti responsabili", href: "/antiriciclaggio/responsabili-av-societa" },
        { label: "Comunicazioni inviate", href: "/antiriciclaggio/comunicazioni" },
      ],
    },

    {
      label: "Anagrafiche",
      icon: <Users className="h-4 w-4" />,
      children: [
        { label: "Clienti", href: "/clienti" },
        { label: "Rappresentanti e soci", href: "/antiriciclaggio/rappresentanti" },
      ],
    },

    {
      label: "Microsoft 365",
      icon: <Cloud className="h-4 w-4" />,
      children: [
        { label: "Connessioni", href: "/microsoft365?tab=connessioni" },
        { label: "Sync", href: "/microsoft365?tab=sync" },
      ],
    },
  ];

  const renderMenuItem = (item: MenuItem) => {
    const hasChildren = !!item.children;
    const active = isActive(item.href, item.children);

    if (hasChildren) {
      return (
        <DropdownMenu key={item.label}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium",
                active
                  ? "bg-blue-600 text-white"
                  : "hover:bg-blue-50 hover:text-blue-600"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-56">
            {item.children?.map((child) => (
              <DropdownMenuItem key={child.label} asChild>
                <Link
                  href={child.href || "#"}
                  className={cn(
                    "flex items-center gap-2 px-2 py-2",
                    pathname === child.href ||
                      pathname.startsWith(child.href + "/")
                      ? "bg-blue-50 text-blue-600 font-semibold"
                      : ""
                  )}
                >
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
          "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg",
          active
            ? "bg-blue-600 text-white"
            : "hover:bg-blue-50 hover:text-blue-600"
        )}
      >
        {item.icon}
        <span>{item.label}</span>
      </Link>
    );
  };

  if (loading) return null;

  return (
    <nav className="w-full bg-white border-b shadow-sm sticky top-16 z-30">
      <div className="flex items-center gap-1 px-4 py-2">
        {menuItems.map((item) => renderMenuItem(item))}
      </div>
    </nav>
  );
}

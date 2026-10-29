import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  BellRing, Building2, CalendarDays, ChevronRight, ClipboardCheck,
  FileCheck2, FileText, FolderOpen, LayoutDashboard, LogOut,
  Menu, ShieldCheck, Users, X, ArrowLeftRight, Cloud
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { hardLogout } from "@/services/logoutService";

export const AML_INTERFACE_KEY = "smp_interface_aml";

const navigation = [
  { label: "Cruscotto AML", href: "/aml", icon: LayoutDashboard },
  { label: "Dati Studio", href: "/impostazioni/studio", icon: Building2, adminOnly: true },
  { label: "Utenti", href: "/impostazioni/utenti", icon: Users, adminOnly: true },
  { label: "Microsoft 365", href: "/microsoft365", icon: Cloud },
  { label: "Centro Alert", href: "/aml/alert", icon: BellRing },
  { label: "Anagrafiche clienti", href: "/clienti", icon: Users },
  { label: "Pratiche AML", href: "/antiriciclaggio", icon: ClipboardCheck },
  { label: "Adeguata verifica AV1", href: "/antiriciclaggio/modello-av1", icon: FileCheck2 },
  { label: "Modello AV4", href: "/antiriciclaggio/modello-av4", icon: FileText },
  { label: "Fascicoli e documenti", href: "/antiriciclaggio/fascicolo-documenti", icon: FolderOpen },
  { label: "Scadenze e controlli", href: "/aml/alert?ambito=aml", icon: CalendarDays },
] as const;

type Profile = { nome: string; cognome: string; tipo_utente: string; studio_id: string | null };

export function AmlShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseClient();
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data } = await supabase.from("tbutenti")
        .select("nome,cognome,tipo_utente,studio_id")
        .eq("email", user.email)
        .maybeSingle();
      if (active && data) setProfile(data as Profile);
    };
    void load();
    return () => { active = false; };
  }, []);

  const openFullSmp = () => {
    sessionStorage.removeItem(AML_INTERFACE_KEY);
    window.location.assign("/dashboard");
  };

  const nav = (
    <nav aria-label="Navigazione Studio Manager Pro AML" className="space-y-1 px-3 py-4">
      {navigation.filter((item) => !("adminOnly" in item && item.adminOnly) || profile?.tipo_utente === "Admin").map(({ href, label, icon: Icon }) => {
        const pathname = router.asPath.split("?")[0];
        const dest = href.split("?")[0];
        const active = pathname === dest || (dest === "/antiriciclaggio" && pathname.startsWith("/antiriciclaggio/") && !navigation.some((other) => other.href === pathname));
        return (
          <Link key={label} href={href} onClick={() => setMobileOpen(false)}
            className={"flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors " + (active ? "bg-blue-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-700/70 hover:text-white")}>
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex-1">{label}</span>
            {active && <ChevronRight className="h-4 w-4" />}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-900">
      {mobileOpen && <button type="button" className="fixed inset-0 z-[60] bg-slate-950/60 lg:hidden" aria-label="Chiudi menu" onClick={() => setMobileOpen(false)} />}
      <aside className={"fixed inset-y-0 left-0 z-[70] flex w-64 flex-col bg-[#102238] text-white shadow-2xl transition-transform lg:translate-x-0 " + (mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-3 border-b border-slate-700/70 px-5 py-5">
          <ShieldCheck className="h-10 w-10 shrink-0 text-sky-400" />
          <div className="min-w-0"><div className="text-[15px] font-bold tracking-tight">Studio Manager Pro</div><div className="text-xs text-sky-300">AML · Antiriciclaggio</div></div>
          <button type="button" className="ml-auto lg:hidden" aria-label="Chiudi menu" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-slate-700/70 p-3 space-y-1">
          <button type="button" onClick={openFullSmp} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
            <ArrowLeftRight className="h-4 w-4" /> Apri SMP completo
          </button>
          <button type="button" onClick={() => void hardLogout("/login")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
            <LogOut className="h-4 w-4" /> Esci
          </button>
        </div>
      </aside>
      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-40 flex min-h-[72px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-sm md:px-7">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Apri menu AML" className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button>
            <div><div className="font-bold text-slate-900">Studio Manager Pro <span className="text-blue-600">AML</span></div>
              <div className="text-xs text-slate-500">Interfaccia dedicata · motore SMP condiviso</div></div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/aml/alert" title="Centro Alert" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><BellRing className="h-5 w-5" /></Link>
            <Link href="/microsoft365" title="Microsoft 365" className="hidden rounded-lg px-2 py-2 font-semibold text-blue-700 hover:bg-blue-50 sm:inline-flex">Microsoft 365</Link>
            <div className="hidden border-l border-slate-200 pl-3 text-right sm:block"><div className="font-semibold text-slate-800">{profile ? profile.nome + " " + profile.cognome : "Utente"}</div><div className="text-xs text-slate-500">{profile?.tipo_utente === "Admin" ? "Amministratore" : "Operatore"}</div></div>
          </div>
        </header>
        <main className="min-h-[calc(100vh-72px)] px-4 py-6 md:px-7 md:py-7">{children}</main>
      </div>
    </div>
  );
}

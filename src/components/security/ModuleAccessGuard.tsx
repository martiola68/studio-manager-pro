import type { ReactNode } from "react";
import { useRouter } from "next/router";
import { ShieldAlert } from "lucide-react";
import { useStudio } from "@/contexts/StudioContext";

type ModuloLicenza = "aml" | "revisione" | "controllo_gestione";

const MODULI: Array<{ modulo: ModuloLicenza; label: string; prefixes: string[] }> = [
  {
    modulo: "aml",
    label: "Antiriciclaggio (AML)",
    prefixes: ["/antiriciclaggio", "/impostazioni/elenco-prestazioni-ar"],
  },
  {
    modulo: "revisione",
    label: "Revisione e Controllo",
    prefixes: ["/revisione-controllo"],
  },
  {
    modulo: "controllo_gestione",
    label: "Controllo di gestione",
    prefixes: ["/controllo-gestione"],
  },
];

function moduloPerPath(path: string) {
  const pathname = path.split("?")[0].split("#")[0];
  return MODULI.find((item) =>
    item.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

export function ModuleAccessGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { studioId, isLoading, piano, hasModule } = useStudio();
  const protectedModule = moduloPerPath(router.asPath || router.pathname || "");

  if (!protectedModule) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="text-center text-sm text-slate-500">Verifica licenza in corso...</div>
      </div>
    );
  }

  const allowed = Boolean(studioId && piano && hasModule(protectedModule.modulo));
  if (allowed) return <>{children}</>;

  return (
    <div className="flex min-h-[55vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-600" />
        <h1 className="text-2xl font-bold text-slate-900">Modulo non abilitato</h1>
        <p className="mt-3 text-slate-600">
          Il modulo <strong>{protectedModule.label}</strong> non è incluso nella licenza attiva di questo studio.
        </p>
        <button
          type="button"
          className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white"
          onClick={() => void router.push("/")}
        >
          Torna alla dashboard
        </button>
      </div>
    </div>
  );
}

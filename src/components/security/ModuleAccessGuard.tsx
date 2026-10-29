import type { ReactNode } from "react";
import { useRouter } from "next/router";
import { ShieldAlert } from "lucide-react";
import { useStudio } from "@/contexts/StudioContext";

type ModuloLicenza = "aml" | "revisione" | "controllo_gestione";

const MODULI: Array<{ modulo: ModuloLicenza; label: string; prefixes: string[] }> = [
  {
    modulo: "aml",
    label: "Antiriciclaggio (AML)",
    prefixes: ["/aml", "/antiriciclaggio", "/impostazioni/elenco-prestazioni-ar"],
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
  const { studioId, isLoading, piano, amlOnly, hasModule } = useStudio();
  const protectedModule = moduloPerPath(router.asPath || router.pathname || "");


  // Un piano "AML standalone" non concede le altre funzioni di SMP.
  // Protezione di navigazione: le API e RLS devono applicare la stessa policy
  // prima che il prodotto sia commercializzabile.
  const amlAllowedPaths = [
    "/aml", "/antiriciclaggio", "/impostazioni/studio", "/microsoft365",
  ];
  const currentPath = (router.asPath || router.pathname || "").split("?")[0].split("#")[0];
  const isAllowedStandalonePath = amlAllowedPaths.some(
    prefix => currentPath === prefix || currentPath.startsWith(prefix + "/")
  );

  if (isLoading) {
    return <div className="flex min-h-[55vh] items-center justify-center text-sm text-slate-500">Verifica licenza in corso...</div>;
  }

  if (amlOnly && !isAllowedStandalonePath) {
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-blue-600" />
        <h1 className="text-xl font-bold">Funzione non inclusa nella licenza AML</h1>
        <p className="mt-2 text-sm text-slate-600">Questa licenza autorizza esclusivamente l'interfaccia antiriciclaggio.</p>
        <button type="button" className="mt-5 rounded-lg bg-blue-600 px-5 py-2 text-white" onClick={() => void router.replace("/aml")}>Torna a SMP AML</button>
      </div>
    );
  }

  if (!protectedModule) return <>{children}</>;

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

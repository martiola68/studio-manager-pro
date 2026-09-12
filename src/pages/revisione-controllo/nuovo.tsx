import { useEffect } from "react";
import { useRouter } from "next/router";

export default function NuovoIncaricoRevisioneLegacyRedirect() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/revisione-controllo/presa-in-carico");
  }, [router]);

  return (
    <div className="flex min-h-[220px] items-center justify-center text-sm text-slate-500">
      Apertura della nuova presa in carico...
    </div>
  );
}

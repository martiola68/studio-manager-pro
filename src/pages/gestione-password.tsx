import { useEffect } from "react";
import { useRouter } from "next/router";

export default function GestionePasswordLegacyRedirect() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/impostazioni/master-password");
  }, [router]);

  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">
      Reindirizzamento alla gestione Master Password...
    </div>
  );
}

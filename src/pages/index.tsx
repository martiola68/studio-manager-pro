import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";

export default function HomePage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const checkAuthAndRedirect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          await router.push("/dashboard");
        } else {
          await router.push("/login");
        }
      } catch (error) {
        console.error("Errore verifica sessione:", error);
        await router.push("/login");
      }
    };

    checkAuthAndRedirect();
  }, [isClient, router]);

  // Rendering identico per SSR e CSR
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="text-center">
        <div className="inline-block h-16 w-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 font-medium">Caricamento...</p>
      </div>
    </div>
  );
}
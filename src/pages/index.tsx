import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getCurrentUser, initializeDatabase } from "@/lib/db";

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initializeDatabase();
    
    const user = getCurrentUser();
    if (user) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  }, [router]);

  // Render consistente tra SSR e CSR
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="inline-block h-16 w-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 font-medium">Caricamento Studio Manager Pro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="text-center">
        <div className="inline-block h-16 w-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 font-medium">Caricamento Studio Manager Pro...</p>
      </div>
    </div>
  );
}
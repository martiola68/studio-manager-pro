import dynamic from "next/dynamic";

// Forza rendering solo client-side per evitare hydration mismatch
const ClientOnlyHome = dynamic(
  () => import("@/components/ClientOnlyHome"),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="inline-block h-16 w-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 font-medium">Caricamento...</p>
        </div>
      </div>
    )
  }
);

export default function HomePage() {
  return <ClientOnlyHome />;
}
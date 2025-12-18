import dynamic from "next/dynamic";

const ClientOnlyAuthCallback = dynamic(() => import("@/components/ClientOnlyAuthCallback"), {
  ssr: false
});

export default function AuthCallbackPage() {
  return <ClientOnlyAuthCallback />;
}
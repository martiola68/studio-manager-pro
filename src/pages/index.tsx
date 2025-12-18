import dynamic from "next/dynamic";

const ClientOnlyHome = dynamic(() => import("@/components/ClientOnlyHome"), {
  ssr: false
});

export default function Home() {
  return <ClientOnlyHome />;
}
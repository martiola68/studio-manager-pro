import dynamic from "next/dynamic";

const PresenzeClient = dynamic(
  () => import("@/components/presenze/PresenzeClient"),
  {
    ssr: false,
  }
);

export default function PresenzePage() {
  return <PresenzeClient />;
}

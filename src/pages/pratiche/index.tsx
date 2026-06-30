import { useEffect } from "react";
import { useRouter } from "next/router";

export default function PraticheRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/pratiche/variazioni");
  }, [router]);

  return null;
}

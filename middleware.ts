import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Frontend autonomo AML: stesso backend, navigazione solo AML.
  // Il vincolo di dominio non dipende da sessionStorage e non tocca SMP.
  const standaloneDeployment = ["1", "true"].includes(
    (process.env.AML_STANDALONE_DEPLOYMENT || "").trim().toLowerCase()
  );
  const isAmlHost =
    standaloneDeployment ||
    request.nextUrl.hostname.toLowerCase() === "aml.studiomanagerpro.it";
  if (isAmlHost) {
    if (pathname === "/") return NextResponse.redirect(new URL("/aml", request.url));
    const allowedPages = [
      "/aml", "/antiriciclaggio", "/login", "/auth/callback",
      "/impostazioni/studio", "/microsoft365", "/documento",
      "/compilazione-av4", "/stampa", "/404",
    ];
    const isAllowedPage = allowedPages.some(
      prefix => pathname === prefix || pathname.startsWith(prefix + "/")
    );
    const isAssetOrApi = pathname.startsWith("/_next/") ||
      pathname.startsWith("/api/") || pathname.includes(".");
    if (!isAllowedPage && !isAssetOrApi) {
      return NextResponse.redirect(new URL("/aml", request.url));
    }
  }

  // Blocca il vecchio polling globale del calendario Microsoft 365.
  // Le sincronizzazioni mirate (webhook/utente specifico) continuano a passare.
  if (pathname === "/api/microsoft365/calendar/sync-cron") {
    const userId = searchParams.get("userId");
    const microsoftConnectionId = searchParams.get("microsoftConnectionId");

    if (!userId || !microsoftConnectionId) {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          reason: "Legacy global Microsoft 365 calendar sync disabled",
        },
        { status: 200 }
      );
    }
  }

  return NextResponse.next();
}

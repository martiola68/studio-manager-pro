import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Deploy AML autonomo: le pagine del gestionale generale non sono
  // navigabili sul dominio commerciale AML. Le API devono comunque
  // controllare licenza, studio e permessi lato server (non basta il middleware).
  if (process.env.AML_STANDALONE_DEPLOYMENT === "1") {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/aml", request.url));
    }
    const allowedPages = [
      "/aml", "/antiriciclaggio", "/login", "/auth/callback",
      "/impostazioni/studio", "/microsoft365",
      "/documento", "/compilazione-av4", "/stampa", "/404",
    ];
    const isAllowedPage = allowedPages.some(
      prefix => pathname === prefix || pathname.startsWith(prefix + "/")
    );
    const isPlatformPath = pathname.startsWith("/_next/") ||
      pathname.startsWith("/api/") || pathname.includes(".");
    if (!isAllowedPage && !isPlatformPath) {
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

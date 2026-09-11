import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

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

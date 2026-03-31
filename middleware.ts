import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  const isPublicDocumento = url.pathname.startsWith("/public/documento");
  const isApiPublic = url.pathname.startsWith("/api/public");

  if (isPublicDocumento || isApiPublic) {
    return NextResponse.next();
  }

  // BLOCCO TOTALE (NON redirect)
  return new NextResponse(
    `
    <html>
      <head>
        <title>Accesso non consentito</title>
      </head>
      <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
        <div style="text-align:center;">
          <h2>Accesso non consentito</h2>
        </div>
      </body>
    </html>
    `,
    {
      status: 403,
      headers: {
        "content-type": "text/html",
      },
    }
  );
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};

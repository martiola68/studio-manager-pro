import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // CONSENTI SOLO:
  const isPublicDocumento = url.pathname.startsWith("/public/documento");
  const isApiPublic = url.pathname.startsWith("/api/public");

  if (isPublicDocumento || isApiPublic) {
    return NextResponse.next();
  }

  // BLOCCA TUTTO IL RESTO
  return NextResponse.redirect(new URL("/bloccato", request.url));
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};

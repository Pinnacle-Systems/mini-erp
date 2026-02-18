import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from "@/features/auth/server/token";

const LOGIN_PATH = "/login";
const OFFLINE_PATH = "/offline";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const isLoginRoute = pathname === LOGIN_PATH;
  const isOfflineRoute = pathname === OFFLINE_PATH;

  if (isOfflineRoute) {
    return NextResponse.next();
  }

  if (!token) {
    if (isLoginRoute) {
      return NextResponse.next();
    }

    const loginUrl = new URL(LOGIN_PATH, request.url);
    return NextResponse.redirect(loginUrl);
  }

  const isTokenValid = await verifyAccessToken(token);

  if (!isTokenValid) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    return response;
  }

  if (isLoginRoute) {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\..*).*)",
  ],
};

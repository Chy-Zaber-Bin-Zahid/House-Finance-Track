import { NextResponse, type NextRequest } from "next/server";

/**
 * An optimistic redirect only, never the authorization boundary.
 *
 * This checks nothing but the presence of a cookie: it cannot tell whether the
 * session is live, or what the account's role is. A matcher here also does not
 * cover server functions, which post to the route that defines them. Every
 * actual check lives in the data access layer, which each route re-enters.
 */
const SESSION_COOKIE = "house_session";
const PUBLIC_PATHS = ["/sign-in", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = request.cookies.has(SESSION_COOKIE);

  if (!signedIn && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  if (signedIn && PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

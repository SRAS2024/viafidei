import { NextResponse, type NextRequest } from "next/server";
import { REQUEST_ID_HEADER, ensureRequestId } from "@/lib/observability";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Paths under /admin that should NOT require an admin session — the login page
// itself, and the login/logout API endpoints that the form posts to.
const ADMIN_PUBLIC_PATHS = new Set(["/admin/login", "/api/admin/login", "/api/admin/logout"]);

function isProtectedAdminPath(pathname: string): boolean {
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) return false;
  if (ADMIN_PUBLIC_PATHS.has(pathname)) return false;
  return true;
}

export function middleware(req: NextRequest) {
  const requestId = ensureRequestId(req.headers.get(REQUEST_ID_HEADER));

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  // Coarse, defense-in-depth gate for the admin surface. The session cookie
  // is httpOnly and encrypted, so we can only verify *presence* here — the
  // page handler still calls requireAdmin() to confirm role === "ADMIN".
  // This redirect short-circuits unauthenticated /admin page requests so
  // they never hit a server component that has nothing to render.
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && isProtectedAdminPath(pathname)) {
    const hasSession = req.cookies.get(SESSION_COOKIE_NAME);
    if (!hasSession) {
      const loginUrl = new URL("/admin/login", req.url);
      return NextResponse.redirect(loginUrl, 303);
    }
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set(REQUEST_ID_HEADER, requestId);

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https://res.cloudinary.com https://images.unsplash.com",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), payment=()");
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|api/health).*)"],
};

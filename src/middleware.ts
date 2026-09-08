import { NextResponse, type NextRequest } from "next/server";
import { REQUEST_ID_HEADER, ensureRequestId } from "@/lib/observability";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { appConfig } from "@/lib/config";

/**
 * Server-issued device-credential cookie. Long opaque random string,
 * HTTP-only + same-site=Lax. The raw value never leaves the browser,
 * and only the HMAC fingerprint of this value is stored anywhere on
 * the server (SecurityEvent.deviceCredentialHash,
 * BannedDevice.deviceCredentialHash, Session.deviceCredentialHash).
 *
 * Set by middleware on first request so a session-less visitor still
 * has a stable identifier the ban link can target.
 */
export const DEVICE_CREDENTIAL_COOKIE = "vf_dev_id";
const DEVICE_CREDENTIAL_MAX_AGE_S = 60 * 60 * 24 * 365; // 1 year

function ensureDeviceCredentialCookie(req: NextRequest, res: NextResponse): void {
  const existing = req.cookies.get(DEVICE_CREDENTIAL_COOKIE);
  if (existing && existing.value && existing.value.length >= 32) return;
  // Edge-safe random. Two UUIDv4s (32 hex chars each) -> 64 hex string.
  const value = `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
  res.cookies.set({
    name: DEVICE_CREDENTIAL_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEVICE_CREDENTIAL_MAX_AGE_S,
  });
}

// Paths under /admin that should NOT require an admin session — the login page
// itself, and the login/logout API endpoints that the form posts to.
const ADMIN_PUBLIC_PATHS = new Set(["/admin/login", "/api/admin/login", "/api/admin/logout"]);

function isProtectedAdminPath(pathname: string): boolean {
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) return false;
  if (ADMIN_PUBLIC_PATHS.has(pathname)) return false;
  return true;
}

/**
 * Inlined here (instead of imported from @/lib/security/request) so the
 * middleware bundle stays edge-runtime clean — the helper file imports
 * NextResponse for its non-middleware redirectTo() helper, which is also
 * edge-safe but keeping the middleware self-contained avoids future
 * accidental imports from request.ts that could drag in node-only deps.
 *
 * Same logic as `getPublicOrigin` in @/lib/security/request: prefer the
 * proxy-supplied X-Forwarded-Host / X-Forwarded-Proto, fall back to the
 * Host header, never echo a local-bind hostname (0.0.0.0:8080,
 * 127.0.0.1:3000, localhost) — Safari rejects port 8080 over HTTPS with
 * "Not allowed to use restricted network port", which surfaces as the
 * mysterious "no access to the port" error users see otherwise.
 */
function isLocalBindHost(host: string): boolean {
  const lower = host.toLowerCase().split(":")[0];
  return lower === "0.0.0.0" || lower === "127.0.0.1" || lower === "localhost" || lower === "::1";
}

function stripUpstreamPort(host: string, proto: string): string {
  if (proto !== "https") return host;
  if (host.endsWith("]")) return host;
  const portIdx = host.lastIndexOf(":");
  if (portIdx <= 0) return host;
  const port = host.slice(portIdx + 1);
  if (port === "443") return host;
  return host.slice(0, portIdx);
}

/**
 * Hosts this deployment serves in production, taken from the hard-coded
 * canonical / app URLs in src/lib/config.ts. Mirrors CANONICAL_ORIGINS in
 * @/lib/security/request; kept as its own copy so the middleware bundle
 * stays edge-runtime clean (config.ts is a dependency-free literal).
 *
 * WHY: without this, a forged X-Forwarded-Host decides where the /admin
 * login redirect points, which is an open redirect — the victim lands on
 * the attacker's copy of the login page with the URL bar showing a
 * redirect that started on the real site.
 */
const CANONICAL_HOSTNAMES: ReadonlySet<string> = (() => {
  const names = new Set<string>();
  for (const raw of [appConfig.canonicalUrl, appConfig.appUrl]) {
    try {
      const url = new URL(raw);
      names.add(url.hostname.toLowerCase());
      if (!url.hostname.startsWith("www.")) names.add(`www.${url.hostname.toLowerCase()}`);
    } catch {
      // Hard-coded literals; unreachable in practice.
    }
  }
  return names;
})();

const PRIMARY_CANONICAL_ORIGIN = (() => {
  try {
    return new URL(appConfig.canonicalUrl).origin;
  } catch {
    return "https://etviafidei.com";
  }
})();

function isCanonicalHost(host: string): boolean {
  const hostname = host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1).toLowerCase()
    : (host.split(":")[0] ?? "").toLowerCase();
  return CANONICAL_HOSTNAMES.has(hostname);
}

function publicOriginForMiddleware(req: NextRequest): string {
  const inProduction = process.env.NODE_ENV === "production";
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = (req.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  let sawUntrustedHost = false;
  if (forwardedHost && !isLocalBindHost(forwardedHost)) {
    const proto = forwardedProto || "https";
    if (!inProduction || isCanonicalHost(forwardedHost)) {
      return `${proto}://${stripUpstreamPort(forwardedHost, proto)}`;
    }
    sawUntrustedHost = true;
  }
  const hostHeader = req.headers.get("host");
  if (hostHeader && !isLocalBindHost(hostHeader)) {
    const proto = forwardedProto || (inProduction ? "https" : "http");
    if (!inProduction || isCanonicalHost(hostHeader)) {
      return `${proto}://${stripUpstreamPort(hostHeader, proto)}`;
    }
    sawUntrustedHost = true;
  }
  if (inProduction && sawUntrustedHost) return PRIMARY_CANONICAL_ORIGIN;
  return req.nextUrl.origin;
}

/**
 * Per-request CSP nonce. 16 bytes of CSPRNG output, base64-encoded —
 * `crypto.getRandomValues` and `btoa` are both available in the edge
 * runtime, so no node:crypto import sneaks into the middleware bundle.
 *
 * The character set matters: Next only picks the nonce out of the CSP
 * header when it matches /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/, which
 * standard base64 satisfies.
 */
function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Build the Content-Security-Policy for one request.
 *
 * script-src carries a per-request nonce instead of 'unsafe-inline'.
 * Next.js reads that nonce back out of the *request* CSP header (see
 * getScriptNonceFromHeader in next/dist/server/app-render) and stamps it
 * onto every framework script it emits — the bootstrap script and the
 * `self.__next_f.push(...)` flight-data scripts — so the app keeps
 * hydrating while an injected inline script does not execute.
 *
 * 'unsafe-eval' is added OUTSIDE production only: the webpack dev build
 * evaluates modules with eval(), and the production bundle never does.
 */
function buildCsp(nonce: string): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`];
  if (process.env.NODE_ENV !== "production") scriptSrc.push("'unsafe-eval'");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    // Tailwind emits a stylesheet, but Next still inlines critical CSS and
    // next/font injects a <style> block, so style-src keeps 'unsafe-inline'.
    // Inline *styles* cannot execute script, so this is a far weaker
    // concession than the script-src one that was just removed.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https://res.cloudinary.com https://images.unsplash.com",
    "connect-src 'self'",
    // The app embeds no plugins, applets, or <object>/<embed> content, so
    // deny them outright — this is the classic SVG/Flash-style XSS vector.
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const requestId = ensureRequestId(req.headers.get(REQUEST_ID_HEADER));
  const nonce = generateCspNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  // Next reads the nonce off the REQUEST header during app render; the
  // identical policy goes on the response below so the browser enforces
  // exactly what the renderer signed its scripts with.
  requestHeaders.set("Content-Security-Policy", csp);

  // Coarse, defense-in-depth gate for the admin surface. The session cookie
  // is httpOnly and encrypted, so we can only verify *presence* here — the
  // page handler still calls requireAdmin() to confirm role === "ADMIN".
  // This redirect short-circuits unauthenticated /admin page requests so
  // they never hit a server component that has nothing to render.
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && isProtectedAdminPath(pathname)) {
    const hasSession = req.cookies.get(SESSION_COOKIE_NAME);
    if (!hasSession) {
      const loginUrl = new URL("/admin/login", publicOriginForMiddleware(req));
      return NextResponse.redirect(loginUrl, 303);
    }
  }

  // Expose the path to server components via a request header so the
  // root layout can suppress the public navigation on /admin routes
  // without having to import next/navigation in a layout that needs to
  // stay async-server-component-safe.
  requestHeaders.set("x-pathname", pathname);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set(REQUEST_ID_HEADER, requestId);
  ensureDeviceCredentialCookie(req, res);

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

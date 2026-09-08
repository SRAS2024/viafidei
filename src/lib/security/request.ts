import { NextResponse, type NextRequest } from "next/server";
import { appConfig } from "@/lib/config";

const ANONYMOUS_IP = "0.0.0.0";

function isLikelyValidIp(value: string): boolean {
  if (!value) return false;
  if (value.length > 64) return false;
  return /^[0-9a-fA-F:.]+$/.test(value);
}

function extractFirstForwardedIp(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  if (!first) return null;
  return isLikelyValidIp(first) ? first : null;
}

export function getClientIp(req: NextRequest): string {
  return getClientIpOrNull(req) ?? ANONYMOUS_IP;
}

export function getClientIpOrNull(req: NextRequest): string | null {
  return (
    extractFirstForwardedIp(req.headers.get("x-forwarded-for")) ??
    extractFirstForwardedIp(req.headers.get("x-real-ip")) ??
    null
  );
}

export function getUserAgent(req: NextRequest): string | null {
  const ua = req.headers.get("user-agent");
  if (!ua) return null;
  return ua.length > 512 ? ua.slice(0, 512) : ua;
}

/**
 * Discard hosts that obviously belong to the local server bind, not the
 * public-facing URL. Behind a reverse proxy (Railway, Vercel, etc.) the
 * incoming request's `req.url` is built from the locally-bound socket —
 * `0.0.0.0:8080`, `127.0.0.1:3000`, `localhost:8080` — so following it
 * blindly produces an absolute redirect that the user's browser then
 * tries to load. Modern browsers reject high-restricted ports
 * (Safari blocks 8080 over HTTPS with WebKitErrorDomain:103, Chrome with
 * ERR_UNSAFE_PORT), which is the symptom users see as
 * "do not have access to the port".
 */
function isLocalBindHost(host: string): boolean {
  const lower = host.toLowerCase().split(":")[0];
  return lower === "0.0.0.0" || lower === "127.0.0.1" || lower === "localhost" || lower === "::1";
}

/**
 * Strip the upstream service port (8080, 3000, …) from a host string when
 * the public scheme is HTTPS. Browsers reject HTTPS URLs that point at
 * non-443 ports — Safari surfaces "Not allowed to use restricted network
 * port" (WebKitErrorDomain:103) for 8080, Chrome shows ERR_UNSAFE_PORT —
 * so emitting `https://etviafidei.com:8080` from a redirect is the same
 * class of bug as emitting `https://0.0.0.0:8080`. The load balancer
 * terminates TLS at 443; the public origin never carries the internal
 * port. Standard HTTPS port (443) and bracketed IPv6 hosts are left
 * untouched.
 */
function stripUpstreamPort(host: string, proto: string): string {
  if (proto !== "https") return host;
  if (host.endsWith("]")) return host; // bracketed IPv6 with no explicit port
  const portIdx = host.lastIndexOf(":");
  if (portIdx <= 0) return host;
  const port = host.slice(portIdx + 1);
  if (port === "443") return host;
  return host.slice(0, portIdx);
}

/**
 * The origins this deployment answers to in production, derived ONLY from
 * the hard-coded canonical / app URLs in src/lib/config.ts.
 *
 * WHY this is not derived from request headers: `X-Forwarded-Host` is
 * attacker-supplied on any proxy chain that appends rather than replaces
 * it, and `Host` is attacker-supplied whenever the edge routes by SNI
 * alone. Letting either header name the origin means the app validates a
 * request against an origin the attacker chose — which turns the CSRF
 * check into a no-op and turns the /admin login redirect into an open
 * redirect. In production the trusted set is therefore a constant.
 *
 * The `www.` sibling of the canonical apex is included because both names
 * resolve to the same deployment and either can be the one the browser
 * actually used.
 */
const CANONICAL_ORIGINS: readonly string[] = (() => {
  const origins = new Set<string>();
  for (const raw of [appConfig.canonicalUrl, appConfig.appUrl]) {
    try {
      const url = new URL(raw);
      origins.add(url.origin);
      if (!url.hostname.startsWith("www.")) {
        origins.add(`${url.protocol}//www.${url.host}`);
      }
    } catch {
      // appConfig holds hard-coded literals, so this is unreachable in
      // practice; swallowing keeps a typo from crashing every request.
    }
  }
  return [...origins];
})();

const CANONICAL_HOSTNAMES: ReadonlySet<string> = new Set(
  CANONICAL_ORIGINS.map((origin) => new URL(origin).hostname.toLowerCase()),
);

/** The one origin production falls back to when no header can be trusted. */
export const PRIMARY_CANONICAL_ORIGIN = CANONICAL_ORIGINS[0] ?? "https://etviafidei.com";

function hostnameOf(host: string): string {
  // Bracketed IPv6 (`[::1]:8080`) keeps its brackets; everything else is
  // split on the port separator.
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host.toLowerCase() : host.slice(0, end + 1).toLowerCase();
  }
  return (host.split(":")[0] ?? "").toLowerCase();
}

/** True when a Host / X-Forwarded-Host value names a known production host. */
export function isCanonicalHost(host: string): boolean {
  return CANONICAL_HOSTNAMES.has(hostnameOf(host));
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

/**
 * The origins a state-changing request may legitimately come from.
 *
 * Production: the constant canonical set — never anything a header said.
 * Development / test: the origin the request actually arrived on, so a
 * LAN address, a tunnel hostname, or a non-default port keeps working;
 * loopback is additionally accepted by `isTrustedRequestOrigin`.
 */
export function getTrustedOrigins(req: NextRequest): string[] {
  if (process.env.NODE_ENV === "production") return [...CANONICAL_ORIGINS];
  const origins = new Set<string>();
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = (req.headers.get("x-forwarded-proto") ?? "").split(",")[0]!.trim();
  const proto = forwardedProto || "http";
  const host = forwardedHost ?? req.headers.get("host");
  if (host) origins.add(`${proto}://${host}`);
  try {
    origins.add(new URL(req.url).origin);
  } catch {
    // A synthetic request with an unparseable URL: the header-derived
    // origin above is still usable.
  }
  return [...origins];
}

/**
 * Whether `origin` (an absolute origin string) is one the app trusts for
 * this request. Outside production any loopback origin is also accepted so
 * `next dev`, Playwright, and unit tests can post to themselves on whatever
 * port they happened to bind.
 */
export function isTrustedRequestOrigin(origin: string, trusted: readonly string[]): boolean {
  if (trusted.includes(origin)) return true;
  if (process.env.NODE_ENV === "production") return false;
  try {
    return isLoopbackHostname(new URL(origin).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Produce the public-facing origin for the request — the one the user
 * actually typed in their browser. Prefers the proxy-supplied
 * `X-Forwarded-Host` / `X-Forwarded-Proto` headers (Railway, Vercel, and
 * most other PaaS hosts set both), falls back to the `Host` header, and
 * only then to `req.url`. Local-bind hosts (0.0.0.0, 127.0.0.1, localhost)
 * are dropped at every layer so a redirect never echoes the server's
 * internal listening address back to the client.
 */
export function getPublicOrigin(req: NextRequest): string {
  const inProduction = process.env.NODE_ENV === "production";
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = (req.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  // Tracks whether a real (non-local-bind) host was offered but rejected as
  // untrusted, so we can answer with the canonical origin instead of
  // echoing the request URL back — see the fallback at the bottom.
  let sawUntrustedHost = false;
  if (forwardedHost && !isLocalBindHost(forwardedHost)) {
    const proto = forwardedProto || "https";
    // In production the forwarded host only names the origin when it names
    // a host this deployment actually serves. Otherwise a spoofed
    // X-Forwarded-Host would turn every redirect built from this helper
    // into an open redirect to a domain the attacker chose.
    if (!inProduction || isCanonicalHost(forwardedHost)) {
      return `${proto}://${stripUpstreamPort(forwardedHost, proto)}`;
    }
    sawUntrustedHost = true;
  }
  const hostHeader = req.headers.get("host");
  if (hostHeader && !isLocalBindHost(hostHeader)) {
    // No explicit X-Forwarded-Proto: in production assume https (the
    // load balancer terminates TLS), in dev fall back to whatever the
    // incoming URL already used.
    const proto =
      forwardedProto || (inProduction ? "https" : new URL(req.url).protocol.replace(":", ""));
    if (!inProduction || isCanonicalHost(hostHeader)) {
      return `${proto}://${stripUpstreamPort(hostHeader, proto)}`;
    }
    sawUntrustedHost = true;
  }
  // Production saw a host it does not serve: answer with the canonical
  // origin rather than the attacker-supplied one.
  if (inProduction && sawUntrustedHost) return PRIMARY_CANONICAL_ORIGIN;
  // Last-resort fallback: req.url itself. May be a local-bind URL but at
  // least won't crash the redirect; the validation above is what
  // prevents that case from being reached when a proxy is present.
  return new URL(req.url).origin;
}

/**
 * Build a redirect to a relative path that will resolve against the
 * public origin (not the local socket bind). Always use this instead of
 * `NextResponse.redirect(new URL(path, req.url), …)` in route handlers
 * that may be reached through a reverse proxy.
 */
export function redirectTo(req: NextRequest, path: string, status = 303): NextResponse {
  const origin = getPublicOrigin(req);
  return NextResponse.redirect(new URL(path, origin), status);
}

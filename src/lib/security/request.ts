import { NextResponse, type NextRequest } from "next/server";

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
 * Produce the public-facing origin for the request — the one the user
 * actually typed in their browser. Prefers the proxy-supplied
 * `X-Forwarded-Host` / `X-Forwarded-Proto` headers (Railway, Vercel, and
 * most other PaaS hosts set both), falls back to the `Host` header, and
 * only then to `req.url`. Local-bind hosts (0.0.0.0, 127.0.0.1, localhost)
 * are dropped at every layer so a redirect never echoes the server's
 * internal listening address back to the client.
 */
export function getPublicOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = (req.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  if (forwardedHost && !isLocalBindHost(forwardedHost)) {
    const proto = forwardedProto || "https";
    return `${proto}://${stripUpstreamPort(forwardedHost, proto)}`;
  }
  const hostHeader = req.headers.get("host");
  if (hostHeader && !isLocalBindHost(hostHeader)) {
    // No explicit X-Forwarded-Proto: in production assume https (the
    // load balancer terminates TLS), in dev fall back to whatever the
    // incoming URL already used.
    const proto =
      forwardedProto ||
      (process.env.NODE_ENV === "production"
        ? "https"
        : new URL(req.url).protocol.replace(":", ""));
    return `${proto}://${stripUpstreamPort(hostHeader, proto)}`;
  }
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

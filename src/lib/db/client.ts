import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Build the datasource URL with a bounded connection pool.
 *
 * The web service and the Admin Worker run as separate processes against a
 * single (Railway) Postgres with a limited `max_connections`. Prisma's default
 * pool is `num_cpus * 2 + 1`, which on a multi-core host is large enough that
 * the two services together exhaust the server — `P2037: too many clients
 * already`, which crashes the worker and starves page requests of connections.
 *
 * Capping `connection_limit` keeps each process' footprint small; `pool_timeout`
 * makes queries wait briefly for a free connection instead of failing. An
 * explicit `connection_limit` already present in the URL is respected.
 *
 * The default is 10 (was 5) so the worker's concurrent lane set
 * (ADMIN_WORKER_LANE_CONCURRENCY, default 8) has enough pooled connections to
 * run many workstreams at once plus the main decision pass + heartbeat, without
 * hitting `P2037`. Still bounded and modest (Postgres `max_connections` is ~100
 * by default). Raise `PRISMA_CONNECTION_LIMIT` (and the lane cap) together on
 * bigger machines; lower it if several web instances share a small Postgres.
 *
 * QUERY TIMEOUTS, opt-in per process. `PRISMA_STATEMENT_TIMEOUT` (seconds)
 * becomes `options=-c statement_timeout=Ns`, so Postgres itself cancels a
 * statement that runs too long (a lock wait, a bad plan) and frees the pooled
 * connection; `PRISMA_SOCKET_TIMEOUT` (seconds) becomes Prisma's
 * `socket_timeout`, so the client stops waiting on a connection that went
 * half-open (the Mac slept, Wi-Fi changed) — the server's own cancel can never
 * arrive over that one. Unset, blank or 0 means no timeout, which is what the
 * web service and every script keep; the local worker host and its worker
 * child set both (launch-worker-host.sh, local-worker-host.ts). Migrations
 * never come through here: `prisma migrate deploy` reads DATABASE_URL itself.
 * Explicit parameters in the URL win, as for everything else in this function.
 */
export function databaseUrlWithPool(
  raw: string | undefined,
  opts: { timeouts?: boolean; connectionLimit?: number } = {},
): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set(
        "connection_limit",
        opts.connectionLimit !== undefined
          ? String(opts.connectionLimit)
          : (process.env.PRISMA_CONNECTION_LIMIT ?? "10"),
      );
    }
    if (opts.timeouts !== false) {
      const statementS = timeoutSeconds("PRISMA_STATEMENT_TIMEOUT");
      const existingOptions = url.searchParams.get("options") ?? "";
      if (statementS !== null && !/statement_timeout/.test(existingOptions)) {
        url.searchParams.set(
          "options",
          `${existingOptions ? `${existingOptions} ` : ""}-c statement_timeout=${statementS}s`,
        );
      }
      const socketS = timeoutSeconds("PRISMA_SOCKET_TIMEOUT");
      if (socketS !== null && !url.searchParams.has("socket_timeout")) {
        url.searchParams.set("socket_timeout", String(socketS));
      }
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", process.env.PRISMA_POOL_TIMEOUT ?? "20");
    }
    // A database reached over the internet (the Admin Worker on the operator's
    // Mac talking to Railway's public TCP proxy) must never fall back to a
    // plaintext session: Prisma's default `sslmode=prefer` silently downgrades
    // when TLS negotiation fails. Require TLS for every non-local host (Railway's
    // Postgres presents its own certificate, which `require` accepts without a
    // CA bundle), and bound the connect attempt so an unreachable host fails in
    // seconds rather than hanging a pass. Explicit parameters in the URL win.
    if (!isLocalHost(url.hostname)) {
      if (!url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");
      if (!url.searchParams.has("connect_timeout")) {
        url.searchParams.set("connect_timeout", process.env.PRISMA_CONNECT_TIMEOUT ?? "15");
      }
    }
    return url.toString();
  } catch {
    return raw; // non-URL DSN — leave it untouched
  }
}

/** localhost / loopback / private-network hosts get no forced TLS. */
export function isLocalHost(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    h === "localhost" ||
    h === "::1" ||
    h.startsWith("127.") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.endsWith(".internal") ||
    h.endsWith(".local")
  );
}

/**
 * A PRISMA_*_TIMEOUT variable in whole seconds, or null for "no timeout":
 * unset, blank, 0, negative or not a number.
 */
function timeoutSeconds(name: string): number | null {
  const raw = (process.env[name] ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null;
}

/** True when this process runs its queries under a statement or socket timeout. */
export function queryTimeoutsConfigured(): boolean {
  return (
    timeoutSeconds("PRISMA_STATEMENT_TIMEOUT") !== null ||
    timeoutSeconds("PRISMA_SOCKET_TIMEOUT") !== null
  );
}

function createPrismaClient(url = databaseUrlWithPool(process.env.DATABASE_URL)): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });
}

/**
 * Run `fn` on a client WITHOUT the query timeouts, for the few statements that
 * are legitimately long and must not be cut off half-way: a VACUUM of a large
 * ledger table (cancelling it throws the whole pass of work away, and the
 * space it would have made reusable never is), or the monthly report's read of
 * a month of log rows over the public proxy. With no timeout configured there
 * is nothing to lift and `fn` simply gets `shared`; otherwise a short-lived
 * two-connection client is opened for the call and closed after it.
 */
export async function withoutQueryTimeouts<T>(
  shared: PrismaClient,
  fn: (db: PrismaClient) => Promise<T>,
): Promise<T> {
  if (!queryTimeoutsConfigured()) return fn(shared);
  const url = databaseUrlWithPool(process.env.DATABASE_URL, {
    timeouts: false,
    connectionLimit: 2,
  });
  if (!url) return fn(shared);
  const untimed = createPrismaClient(url);
  try {
    return await fn(untimed);
  } finally {
    await untimed.$disconnect().catch(() => undefined);
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Cache on globalThis in every environment so hot-reload (dev) and repeated
// imports within a single process never spin up extra connection pools.
globalForPrisma.prisma = prisma;

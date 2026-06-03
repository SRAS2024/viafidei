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
 */
export function databaseUrlWithPool(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", process.env.PRISMA_CONNECTION_LIMIT ?? "5");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", process.env.PRISMA_POOL_TIMEOUT ?? "20");
    }
    return url.toString();
  } catch {
    return raw; // non-URL DSN — leave it untouched
  }
}

function createPrismaClient(): PrismaClient {
  const url = databaseUrlWithPool(process.env.DATABASE_URL);
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Cache on globalThis in every environment so hot-reload (dev) and repeated
// imports within a single process never spin up extra connection pools.
globalForPrisma.prisma = prisma;

import crypto from "node:crypto";
import { prisma } from "../db/client";

/**
 * Postgres session-level advisory lock. The lock is automatically released when
 * the connection is closed, so even if the process crashes the next runner can
 * acquire it.
 *
 * The lock key is a deterministic 32-bit hash of the input string so different
 * jobs never collide.
 */

function hashKey(key: string): number {
  const digest = crypto.createHash("sha1").update(key).digest();
  return digest.readInt32BE(0);
}

export async function tryAdvisoryLock(key: string): Promise<boolean> {
  const id = hashKey(key);
  const rows = await prisma.$queryRawUnsafe<Array<{ pg_try_advisory_lock: boolean }>>(
    `SELECT pg_try_advisory_lock($1) AS pg_try_advisory_lock`,
    id,
  );
  return rows[0]?.pg_try_advisory_lock === true;
}

export async function releaseAdvisoryLock(key: string): Promise<void> {
  const id = hashKey(key);
  await prisma.$queryRawUnsafe(
    `SELECT pg_advisory_unlock($1) AS released`,
    id,
  );
}

/**
 * Convenience wrapper: acquire, run, release. If the lock is unavailable the
 * `onContended` callback is invoked and the function returns null.
 */
export async function withAdvisoryLock<T>(
  key: string,
  fn: () => Promise<T>,
  onContended?: () => Promise<void> | void,
): Promise<T | null> {
  const acquired = await tryAdvisoryLock(key);
  if (!acquired) {
    if (onContended) await onContended();
    return null;
  }
  try {
    return await fn();
  } finally {
    await releaseAdvisoryLock(key);
  }
}

import crypto from "node:crypto";
import { prisma } from "../db/client";
import { ensureAccountEmailTables } from "../startup/ensure-email-tables";
import { hashPassword, verifyPassword } from "./password";

// Password reset tokens are short-lived by design — a 15-minute window is
// long enough for the user to switch tabs, find the email, and click the
// link, but short enough that an intercepted reset email is no longer a
// valid attack vector by the time it reaches anyone else.
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function generateRawToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export type IssuedToken = { token: string; expiresAt: Date };

/**
 * Re-export the SHA-256 hash so other modules can identify a token by its
 * hash without ever storing the raw value.
 */
export function hashRawToken(rawToken: string): string {
  return hashToken(rawToken);
}

/**
 * Process-wide once-per-boot guard for the table-create fallback.
 * `ensureAccountEmailTables` is itself idempotent (every statement is
 * `IF NOT EXISTS` or guarded by a pg_constraint check) so calling it
 * twice is safe — but checking the existence with `pg_tables` on every
 * token write would be wasteful, so we cache the in-process flag and
 * skip the SQL on subsequent calls within the same process.
 */
let tablesEnsuredInThisProcess = false;
async function ensureTablesOnce(): Promise<void> {
  if (tablesEnsuredInThisProcess) return;
  await ensureAccountEmailTables();
  tablesEnsuredInThisProcess = true;
}

/**
 * Run a Prisma write that targets one of the token tables, transparently
 * creating the missing schema and retrying once if the first attempt
 * throws "relation does not exist". This is the request-time safety net
 * for the case where neither `prisma migrate deploy` nor the
 * instrumentation-level safety net created the tables — which can
 * happen on hosting that bypasses scripts/start.sh.
 *
 * The retry never loops more than once. If the second attempt still
 * throws, we re-throw so the caller's structured log line carries the
 * real error (likely a permission issue: the runtime DB role lacks
 * CREATE TABLE).
 */
async function withTableSelfHeal<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!/relation .* does not exist/i.test(message)) throw error;
    // Self-heal: create the missing table(s) and retry exactly once.
    // ensureAccountEmailTables runs every IF-NOT-EXISTS statement so
    // even if only one of the two token tables was missing this is
    // safe.
    await ensureAccountEmailTables();
    tablesEnsuredInThisProcess = true;
    return operation();
  }
}

export async function issuePasswordResetToken(userId: string): Promise<IssuedToken> {
  const token = generateRawToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await ensureTablesOnce().catch(() => {
    // Don't throw here — the actual create below will throw with a
    // more useful error if the schema is broken AND we cannot
    // create it. Swallowing here means a permission error doesn't
    // mask itself with the unrelated "ensure failed" message.
  });
  await withTableSelfHeal(() =>
    prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    }),
  );
  return { token, expiresAt };
}

export type ConsumePasswordResetResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "not_found" | "expired" | "used" };

export async function consumePasswordResetToken(
  rawToken: string,
  newPassword: string,
): Promise<ConsumePasswordResetResult> {
  const tokenHash = hashToken(rawToken);
  await ensureTablesOnce().catch(() => {});
  const record = await withTableSelfHeal(() =>
    prisma.passwordResetToken.findUnique({ where: { tokenHash } }),
  );
  if (!record) return { ok: false, reason: "not_found" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  const passwordHash = await hashPassword(newPassword);
  // Atomically: rotate the password hash, mark this token consumed,
  // invalidate all reset tokens (so a previously issued one cannot be
  // replayed by a different actor), and revoke every session for the user.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  return { ok: true, userId: record.userId };
}

export async function issueEmailVerificationToken(userId: string): Promise<IssuedToken> {
  const token = generateRawToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  await ensureTablesOnce().catch(() => {});
  await withTableSelfHeal(() =>
    prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    }),
  );
  return { token, expiresAt };
}

export type ConsumeEmailVerificationResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "not_found" | "expired" | "used" };

export async function consumeEmailVerificationToken(
  rawToken: string,
): Promise<ConsumeEmailVerificationResult> {
  const tokenHash = hashToken(rawToken);
  await ensureTablesOnce().catch(() => {});
  const record = await withTableSelfHeal(() =>
    prisma.emailVerificationToken.findUnique({ where: { tokenHash } }),
  );
  if (!record) return { ok: false, reason: "not_found" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);
  return { ok: true, userId: record.userId };
}

export async function pruneExpiredTokens(now: Date = new Date()): Promise<number> {
  const [reset, verify] = await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return reset.count + verify.count;
}

export async function verifyCurrentPassword(
  userId: string,
  currentPassword: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return false;
  return verifyPassword(user.passwordHash, currentPassword);
}

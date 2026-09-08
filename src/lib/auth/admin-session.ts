/**
 * Server-side admin session lifecycle (security spec items 3 / 12).
 *
 * WHY THIS EXISTS
 * ---------------
 * Before this module the only evidence that a request came from the human
 * administrator was an encrypted cookie carrying `role: "ADMIN"`. That is a
 * bearer token with no server-side lifecycle: it cannot express "password
 * accepted, second factor still outstanding", it survives sign-out on any
 * copy of the cookie, and it cannot be expired for idleness or revoked from
 * the server. Every admin authorization decision therefore now resolves
 * against a row in the `AdminSession` table, which tracks:
 *
 *   • a unique admin session id (opaque, rotated after the second factor);
 *   • the original password-authentication time;
 *   • the 2FA verification time;
 *   • last activity, with a sliding idle window;
 *   • an absolute expiry that idleness cannot extend;
 *   • revocation state (who/why/when).
 *
 * A PENDING row means "password verified, second factor outstanding". It is
 * NOT an admin: `resolveAdminSession` returns `pending_two_factor`, so
 * `requireAdmin()`, `evaluateAdminTrust()` and `gateAdminApiCall()` all deny.
 *
 * SECRETS
 * -------
 * The opaque session id lives only inside the encrypted iron-session cookie.
 * What is persisted is an HMAC of that id under the app's session-purpose
 * subkey, so a dump of this table cannot be replayed as a session, and no
 * code path here logs, returns, or stores the raw id.
 *
 * SCOPE
 * -----
 * HUMAN administrators signing into the interactive admin interface only.
 * The Admin Worker and every other automated process authenticate by their
 * own machine paths and never touch this module — see
 * tests/security/fail-closed.test.ts, which pins that separation.
 *
 * STORAGE
 * -------
 * Raw SQL rather than a Prisma model: the table is owned by migration
 * 0060_admin_session_store and the generated client may not know about it
 * yet. Every statement is parameterised through `Prisma.sql`.
 */

import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { getPurposeKey } from "../security/keys";
import { deviceCredentialFingerprint, ipFingerprint, userAgentFingerprint } from "../security/hash";
import { getSession } from "./session";

/**
 * Security constants. Deliberately compiled in rather than configured: the
 * security brief forbids new environment variables, and an admin session
 * window is not something an operator should be able to widen by accident.
 */

/** Hard ceiling on an admin session. Activity cannot extend it. */
export const ADMIN_SESSION_ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
/** Sliding idle window — an unattended admin browser stops being an admin. */
export const ADMIN_SESSION_IDLE_TTL_MS = 30 * 60 * 1000; // 30 minutes
/** How long a password-verified session may wait for its second factor. */
export const ADMIN_PENDING_SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
/**
 * Don't write `lastActivityAt` on every single admin request — one write per
 * minute is enough to keep the idle window accurate without turning every
 * page render into a row update.
 */
export const ADMIN_SESSION_ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;
/**
 * How long dead rows are kept before the cleanup lane deletes them. Revoked
 * and expired sessions are evidence ("was this session still alive when the
 * breach happened?"), so they outlive the session itself by a week.
 */
export const ADMIN_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type AdminSessionStage = "PENDING" | "AUTHENTICATED";

/**
 * Why a session stopped being trustworthy. Every value denies; they exist so
 * the caller can record WHICH control fired.
 *
 * `indeterminate` is the fail-closed case: the store could not be read, so we
 * cannot prove the session is valid and therefore treat it as invalid.
 */
export type AdminSessionDenyReason =
  | "no_server_session"
  | "pending_two_factor"
  | "revoked"
  | "expired_absolute"
  | "expired_idle"
  | "indeterminate";

export type AdminSessionRecord = {
  /** Stored id (the HMAC), never the raw session id. */
  storedId: string;
  adminUsername: string;
  stage: AdminSessionStage;
  authenticatedAt: Date;
  twoFactorVerifiedAt: Date | null;
  lastActivityAt: Date;
  absoluteExpiresAt: Date;
  idleExpiresAt: Date;
  revokedAt: Date | null;
};

export type AdminSessionResolution =
  | { valid: true; record: AdminSessionRecord }
  | { valid: false; reason: AdminSessionDenyReason };

type SessionActor = {
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceCredential?: string | null;
};

/**
 * The slice of PrismaClient this module needs. Declared structurally so the
 * worker's own client can be passed to the cleanup sweep without importing
 * anything from the worker here.
 */
export type RawQueryClient = { $queryRaw: (query: Prisma.Sql) => Promise<unknown> };

type RawRow = {
  id: string;
  adminUsername: string;
  stage: string;
  authenticatedAt: Date;
  twoFactorVerifiedAt: Date | null;
  lastActivityAt: Date;
  absoluteExpiresAt: Date;
  idleExpiresAt: Date;
  revokedAt: Date | null;
};

/**
 * Mint a fresh opaque session id. 32 bytes of CSPRNG output — this is the
 * only place the raw id is created, and it is handed straight to the
 * encrypted cookie.
 */
function newSessionId(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * The stored key for a session id. Uses the app's existing session-purpose
 * subkey rather than the root secret directly, so an oracle against another
 * key purpose (at-rest encryption, event fingerprints) says nothing about
 * these. Derivation throws in production when SESSION_SECRET is missing,
 * which is the fail-closed answer: no key material, no admin session.
 */
function storedIdFor(sessionId: string): string {
  return crypto
    .createHmac("sha256", getPurposeKey("session"))
    .update(`admin-session:${sessionId}`)
    .digest("hex");
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Normalise one raw row. Returns null when a column is missing or unparsable
 * — an unreadable row is treated as no row at all, never as a valid session.
 */
function toRecord(row: RawRow | undefined): AdminSessionRecord | null {
  if (!row || typeof row.id !== "string") return null;
  const authenticatedAt = toDate(row.authenticatedAt);
  const lastActivityAt = toDate(row.lastActivityAt);
  const absoluteExpiresAt = toDate(row.absoluteExpiresAt);
  const idleExpiresAt = toDate(row.idleExpiresAt);
  if (!authenticatedAt || !lastActivityAt || !absoluteExpiresAt || !idleExpiresAt) return null;
  const stage = row.stage === "AUTHENTICATED" ? "AUTHENTICATED" : "PENDING";
  return {
    storedId: row.id,
    adminUsername: typeof row.adminUsername === "string" ? row.adminUsername : "",
    stage,
    authenticatedAt,
    twoFactorVerifiedAt: toDate(row.twoFactorVerifiedAt),
    lastActivityAt,
    absoluteExpiresAt,
    idleExpiresAt,
    revokedAt: toDate(row.revokedAt),
  };
}

/**
 * Report a store failure. Fail-closed decisions have to be visible or they
 * look like an ordinary sign-out; this routes through the existing
 * diagnostics (structured log + the deduped Suspicious Activity channel).
 * Never carries the session id, the username's credentials, or key material.
 */
function reportIndeterminate(operation: string, error: unknown): void {
  logger.error("admin.session.store_unavailable", {
    operation,
    error: error instanceof Error ? error.message : String(error),
  });
  void (async () => {
    try {
      const { reportSuspiciousActivity } = await import("../security/security-events");
      await reportSuspiciousActivity({
        kind: "admin_session_store_unavailable",
        summary: `The admin session store could not be read during "${operation}" — admin authorization is failing closed until it recovers.`,
        route: "/admin",
        recommendedAction:
          "Check database availability. Admin access stays denied while the store is unreadable; ordinary users and the Admin Worker are unaffected.",
      });
    } catch {
      // Reporting is best-effort; the deny already happened.
    }
  })();
}

/** Rows come back as `unknown` from `$queryRaw`; only an array is usable. */
function asRows(value: unknown): RawRow[] | null {
  return Array.isArray(value) ? (value as RawRow[]) : null;
}

/**
 * Create the PENDING half of an admin sign-in: the password was accepted,
 * the second factor has not been verified yet. The returned id belongs in
 * the encrypted session cookie and nowhere else.
 *
 * Returns null when the store is unreachable — the caller must then refuse
 * the sign-in rather than fall back to a cookie-only session.
 */
export async function createPendingAdminSession(
  input: { username: string } & SessionActor,
): Promise<{ sessionId: string; authenticatedAt: Date } | null> {
  const sessionId = newSessionId();
  const now = new Date();
  const pendingExpiry = new Date(now.getTime() + ADMIN_PENDING_SESSION_TTL_MS);
  try {
    const rows = asRows(
      await prisma.$queryRaw(Prisma.sql`
        INSERT INTO "AdminSession" (
          "id", "adminUsername", "stage", "authenticatedAt", "twoFactorVerifiedAt",
          "lastActivityAt", "absoluteExpiresAt", "idleExpiresAt",
          "ipHash", "userAgentHash", "deviceCredentialHash", "createdAt", "updatedAt"
        ) VALUES (
          ${storedIdFor(sessionId)}, ${input.username}, 'PENDING', ${now}, NULL,
          ${now}, ${pendingExpiry}, ${pendingExpiry},
          ${ipFingerprint(input.ipAddress)}, ${userAgentFingerprint(input.userAgent)},
          ${deviceCredentialFingerprint(input.deviceCredential)}, ${now}, ${now}
        )
        RETURNING "id"
      `),
    );
    if (!rows || rows.length === 0) return null;
    return { sessionId, authenticatedAt: now };
  } catch (error) {
    reportIndeterminate("createPendingAdminSession", error);
    return null;
  }
}

/**
 * Resolve a session id to its server-side record and decide whether it may
 * act as an administrator.
 *
 * Fails closed everywhere: an unreachable store, an unparsable row and a
 * missing row all deny. Only a row that is AUTHENTICATED, carries a 2FA
 * timestamp, is unrevoked and sits inside BOTH the absolute and idle windows
 * is valid.
 */
export async function resolveAdminSession(
  sessionId: string,
  options: { now?: Date } = {},
): Promise<AdminSessionResolution> {
  const now = options.now ?? new Date();
  let storedId: string;
  try {
    storedId = storedIdFor(sessionId);
  } catch (error) {
    // Key derivation throws when production secret material is missing.
    reportIndeterminate("resolveAdminSession.key", error);
    return { valid: false, reason: "indeterminate" };
  }

  let rows: RawRow[] | null;
  try {
    rows = asRows(
      await prisma.$queryRaw(Prisma.sql`
        SELECT "id", "adminUsername", "stage", "authenticatedAt", "twoFactorVerifiedAt",
               "lastActivityAt", "absoluteExpiresAt", "idleExpiresAt", "revokedAt"
        FROM "AdminSession"
        WHERE "id" = ${storedId}
        LIMIT 1
      `),
    );
  } catch (error) {
    reportIndeterminate("resolveAdminSession", error);
    return { valid: false, reason: "indeterminate" };
  }
  // A non-array result means the query did not actually answer the question
  // (a stubbed client, a driver quirk). We cannot prove validity, so deny.
  if (!rows) return { valid: false, reason: "indeterminate" };

  const record = toRecord(rows[0]);
  if (!record) return { valid: false, reason: "no_server_session" };
  if (record.revokedAt) return { valid: false, reason: "revoked" };
  if (record.absoluteExpiresAt.getTime() <= now.getTime()) {
    return { valid: false, reason: "expired_absolute" };
  }
  if (record.idleExpiresAt.getTime() <= now.getTime()) {
    return { valid: false, reason: "expired_idle" };
  }
  // Both halves must agree: a PENDING row, or an AUTHENTICATED row with no
  // 2FA timestamp, is a password-only session and is never an admin.
  if (record.stage !== "AUTHENTICATED" || !record.twoFactorVerifiedAt) {
    return { valid: false, reason: "pending_two_factor" };
  }

  await touchAdminSession(record, now);
  return { valid: true, record };
}

/**
 * Slide the idle window. Throttled, and best-effort: a failed touch must not
 * revoke a session that just proved itself valid — the worst case is that the
 * idle window stops sliding and the admin re-authenticates sooner.
 */
async function touchAdminSession(record: AdminSessionRecord, now: Date): Promise<void> {
  if (now.getTime() - record.lastActivityAt.getTime() < ADMIN_SESSION_ACTIVITY_WRITE_INTERVAL_MS) {
    return;
  }
  const idleExpiresAt = new Date(
    Math.min(now.getTime() + ADMIN_SESSION_IDLE_TTL_MS, record.absoluteExpiresAt.getTime()),
  );
  try {
    await prisma.$queryRaw(Prisma.sql`
      UPDATE "AdminSession"
         SET "lastActivityAt" = ${now},
             "idleExpiresAt" = ${idleExpiresAt},
             "updatedAt" = ${now}
       WHERE "id" = ${record.storedId}
         AND "revokedAt" IS NULL
         AND "stage" = 'AUTHENTICATED'
       RETURNING "id"
    `);
    record.lastActivityAt = now;
    record.idleExpiresAt = idleExpiresAt;
  } catch (error) {
    logger.warn("admin.session.touch_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export type PromoteAdminSessionResult =
  | {
      ok: true;
      /** The ROTATED session id — replaces the pending one in the cookie. */
      sessionId: string;
      username: string;
      authenticatedAt: Date;
      twoFactorVerifiedAt: Date;
    }
  | { ok: false; reason: AdminSessionDenyReason };

/**
 * Promote a PENDING session to AUTHENTICATED after the second factor was
 * verified, ROTATING the session identifier in the same statement.
 *
 * Rotation matters: the id that existed while the session was only
 * password-verified must never be the id that carries full admin authority,
 * so a fixated or leaked pending id is worthless afterwards.
 *
 * The whole promotion is one CTE so it is atomic — the old row is revoked and
 * the new row inserted together, or neither happens. The `WHERE` clause is
 * the authorization: only an unrevoked, unexpired PENDING row is eligible, so
 * a replayed or already-promoted id returns zero rows and is refused.
 *
 * NOTE for callers: this only moves the STORE forward. `completeAdminTwoFactor`
 * is the wrapper that also rewrites the cookie; prefer it.
 */
export async function promoteAdminSession(
  pendingSessionId: string,
  actor: SessionActor & { now?: Date } = {},
): Promise<PromoteAdminSessionResult> {
  const now = actor.now ?? new Date();
  const newSid = newSessionId();
  const absoluteExpiresAt = new Date(now.getTime() + ADMIN_SESSION_ABSOLUTE_TTL_MS);
  const idleExpiresAt = new Date(now.getTime() + ADMIN_SESSION_IDLE_TTL_MS);

  let oldStoredId: string;
  let newStoredId: string;
  try {
    oldStoredId = storedIdFor(pendingSessionId);
    newStoredId = storedIdFor(newSid);
  } catch (error) {
    reportIndeterminate("promoteAdminSession.key", error);
    return { ok: false, reason: "indeterminate" };
  }

  try {
    const rows = asRows(
      await prisma.$queryRaw(Prisma.sql`
        WITH promoted AS (
          UPDATE "AdminSession"
             SET "revokedAt" = ${now},
                 "revokedReason" = 'rotated_after_two_factor',
                 "updatedAt" = ${now}
           WHERE "id" = ${oldStoredId}
             AND "stage" = 'PENDING'
             AND "revokedAt" IS NULL
             AND "absoluteExpiresAt" > ${now}
          RETURNING "adminUsername", "authenticatedAt", "ipHash", "userAgentHash",
                    "deviceCredentialHash"
        )
        INSERT INTO "AdminSession" (
          "id", "adminUsername", "stage", "authenticatedAt", "twoFactorVerifiedAt",
          "lastActivityAt", "absoluteExpiresAt", "idleExpiresAt", "rotatedFromId",
          "ipHash", "userAgentHash", "deviceCredentialHash", "createdAt", "updatedAt"
        )
        SELECT ${newStoredId}, p."adminUsername", 'AUTHENTICATED', p."authenticatedAt", ${now},
               ${now}, ${absoluteExpiresAt}, ${idleExpiresAt}, ${oldStoredId},
               COALESCE(${ipFingerprint(actor.ipAddress)}, p."ipHash"),
               COALESCE(${userAgentFingerprint(actor.userAgent)}, p."userAgentHash"),
               COALESCE(${deviceCredentialFingerprint(actor.deviceCredential)}, p."deviceCredentialHash"),
               ${now}, ${now}
          FROM promoted p
        RETURNING "adminUsername", "authenticatedAt"
      `),
    );
    if (!rows) return { ok: false, reason: "indeterminate" };
    const row = rows[0];
    // Zero rows: the pending session was missing, already promoted, revoked
    // or past its window. Every one of those is a refusal.
    if (!row) return { ok: false, reason: "pending_two_factor" };
    return {
      ok: true,
      sessionId: newSid,
      username: typeof row.adminUsername === "string" ? row.adminUsername : "",
      authenticatedAt: toDate(row.authenticatedAt) ?? now,
      twoFactorVerifiedAt: now,
    };
  } catch (error) {
    reportIndeterminate("promoteAdminSession", error);
    return { ok: false, reason: "indeterminate" };
  }
}

/**
 * Revoke one session. Returns true when a live row was actually revoked.
 * Idempotent — revoking an already-revoked or unknown session is a no-op.
 */
export async function revokeAdminSession(
  sessionId: string,
  reason: string,
  options: { now?: Date } = {},
): Promise<boolean> {
  const now = options.now ?? new Date();
  try {
    const rows = asRows(
      await prisma.$queryRaw(Prisma.sql`
        UPDATE "AdminSession"
           SET "revokedAt" = ${now}, "revokedReason" = ${reason}, "updatedAt" = ${now}
         WHERE "id" = ${storedIdFor(sessionId)}
           AND "revokedAt" IS NULL
        RETURNING "id"
      `),
    );
    return Boolean(rows && rows.length > 0);
  } catch (error) {
    logger.warn("admin.session.revoke_failed", {
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Revoke every live session, optionally for one admin account. Used when the
 * authentication state itself becomes invalid (credentials rotated, forced
 * sign-out everywhere). Returns the number of rows revoked.
 */
export async function revokeAllAdminSessions(
  reason: string,
  options: { adminUsername?: string; now?: Date } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const username = options.adminUsername;
  try {
    const rows = asRows(
      await prisma.$queryRaw(
        username
          ? Prisma.sql`
              UPDATE "AdminSession"
                 SET "revokedAt" = ${now}, "revokedReason" = ${reason}, "updatedAt" = ${now}
               WHERE "revokedAt" IS NULL AND "adminUsername" = ${username}
              RETURNING "id"
            `
          : Prisma.sql`
              UPDATE "AdminSession"
                 SET "revokedAt" = ${now}, "revokedReason" = ${reason}, "updatedAt" = ${now}
               WHERE "revokedAt" IS NULL
              RETURNING "id"
            `,
      ),
    );
    return rows?.length ?? 0;
  } catch (error) {
    logger.warn("admin.session.revoke_all_failed", {
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Delete dead rows. Called by the Admin Worker's existing cleanup lane — the
 * worker maintains this table, it never authenticates against it.
 *
 * Only rows that have been dead for `ADMIN_SESSION_RETENTION_MS` are removed,
 * and the delete is bounded by `limit` so the sweep can never take a long
 * lock on a live table. Never throws — a failed sweep must not break the lane.
 */
export async function pruneExpiredAdminSessions(
  options: { now?: Date; limit?: number; client?: RawQueryClient } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(options.limit ?? 500, 5000));
  const cutoff = new Date(now.getTime() - ADMIN_SESSION_RETENTION_MS);
  // The Admin Worker's cleanup lane runs on its own client; accept it rather
  // than forcing a second connection pool through this module's import.
  const client = options.client ?? prisma;
  try {
    const rows = asRows(
      await client.$queryRaw(Prisma.sql`
        DELETE FROM "AdminSession"
         WHERE "id" IN (
           SELECT "id" FROM "AdminSession"
            WHERE "absoluteExpiresAt" < ${cutoff}
               OR ("revokedAt" IS NOT NULL AND "revokedAt" < ${cutoff})
            LIMIT ${limit}
         )
        RETURNING "id"
      `),
    );
    return rows?.length ?? 0;
  } catch (error) {
    logger.warn("admin.session.prune_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/* Cookie-aware wrappers — the API the login / 2FA / logout routes use */
/* ------------------------------------------------------------------ */

export type BeginAdminSessionResult =
  | { ok: true; adminSessionId: string }
  | { ok: false; reason: "store_unavailable" };

/**
 * Stage one of an admin sign-in: the password has been verified. Creates the
 * PENDING server-side session and writes its id into the encrypted cookie.
 *
 * Deliberately does NOT set `role`, `userEmail` or any other marker of an
 * authenticated admin — until the second factor lands, this cookie carries no
 * authority at all.
 */
export async function beginAdminSession(
  input: { username: string } & SessionActor,
): Promise<BeginAdminSessionResult> {
  const created = await createPendingAdminSession(input);
  if (!created) return { ok: false, reason: "store_unavailable" };

  const session = await getSession();
  // Drop any authority the cookie already carried: re-authenticating always
  // starts from zero, so a stale ADMIN role can never survive into stage two.
  if (session.adminSessionId && session.adminSessionId !== created.sessionId) {
    await revokeAdminSession(session.adminSessionId, "superseded_by_new_sign_in");
  }
  session.role = undefined;
  session.adminSessionId = created.sessionId;
  session.adminAuthStage = "PENDING";
  session.adminSignedInAt = created.authenticatedAt.getTime();
  await session.save();
  return { ok: true, adminSessionId: created.sessionId };
}

export type PendingAdminSession = {
  adminSessionId: string;
  username: string;
  authenticatedAt: Date;
  expiresAt: Date;
};

/**
 * The pending (password-verified, 2FA outstanding) session for this request,
 * or null. This is how the 2FA route learns which admin account is mid
 * sign-in without trusting anything the client sent.
 */
export async function getPendingAdminSession(
  options: { now?: Date } = {},
): Promise<PendingAdminSession | null> {
  const now = options.now ?? new Date();
  let sessionId: string | undefined;
  try {
    const session = await getSession();
    sessionId = session.adminSessionId;
  } catch (error) {
    reportIndeterminate("getPendingAdminSession.cookie", error);
    return null;
  }
  if (!sessionId) return null;

  try {
    const rows = asRows(
      await prisma.$queryRaw(Prisma.sql`
        SELECT "id", "adminUsername", "stage", "authenticatedAt", "twoFactorVerifiedAt",
               "lastActivityAt", "absoluteExpiresAt", "idleExpiresAt", "revokedAt"
        FROM "AdminSession"
        WHERE "id" = ${storedIdFor(sessionId)}
        LIMIT 1
      `),
    );
    const record = toRecord(rows?.[0]);
    if (!record) return null;
    if (record.revokedAt) return null;
    if (record.stage !== "PENDING") return null;
    if (record.absoluteExpiresAt.getTime() <= now.getTime()) return null;
    return {
      adminSessionId: sessionId,
      username: record.adminUsername,
      authenticatedAt: record.authenticatedAt,
      expiresAt: record.absoluteExpiresAt,
    };
  } catch (error) {
    reportIndeterminate("getPendingAdminSession", error);
    return null;
  }
}

export type CompleteAdminTwoFactorResult =
  | {
      ok: true;
      adminSessionId: string;
      username: string;
      authenticatedAt: Date;
      twoFactorVerifiedAt: Date;
    }
  | { ok: false; reason: AdminSessionDenyReason };

/**
 * Stage two: the second factor has been verified. Promotes this request's
 * PENDING session to AUTHENTICATED with a rotated id and, only then, marks
 * the cookie as ADMIN.
 *
 * This is the ONLY function in the codebase that grants the ADMIN role. It
 * refuses unless the store confirms an eligible pending session, so no caller
 * can shortcut the second factor by writing to the cookie.
 *
 * Applies to a human administrator at the interactive admin login only —
 * automated processes never reach it.
 */
export async function completeAdminTwoFactor(
  actor: SessionActor & { now?: Date } = {},
): Promise<CompleteAdminTwoFactorResult> {
  let session: Awaited<ReturnType<typeof getSession>>;
  try {
    session = await getSession();
  } catch (error) {
    reportIndeterminate("completeAdminTwoFactor.cookie", error);
    return { ok: false, reason: "indeterminate" };
  }
  const pendingId = session.adminSessionId;
  if (!pendingId) return { ok: false, reason: "no_server_session" };

  const promoted = await promoteAdminSession(pendingId, actor);
  if (!promoted.ok) return promoted;

  session.role = "ADMIN";
  session.userEmail = promoted.username;
  session.adminSessionId = promoted.sessionId;
  session.adminAuthStage = "AUTHENTICATED";
  session.adminSignedInAt = promoted.authenticatedAt.getTime();
  await session.save();

  return {
    ok: true,
    adminSessionId: promoted.sessionId,
    username: promoted.username,
    authenticatedAt: promoted.authenticatedAt,
    twoFactorVerifiedAt: promoted.twoFactorVerifiedAt,
  };
}

/**
 * Sign out: revoke the server-side row FIRST, then clear the cookie.
 *
 * Order matters. Clearing the cookie alone leaves the row live, so any copy
 * of the cookie taken before sign-out would still authorize. Revoking first
 * means the session is dead even if the cookie write never lands.
 *
 * Returns true when a live admin session was revoked (used for audit copy).
 */
export async function revokeCurrentAdminSession(reason: string): Promise<boolean> {
  let sessionId: string | undefined;
  try {
    const session = await getSession();
    sessionId = session.adminSessionId;
  } catch (error) {
    logger.warn("admin.session.logout_cookie_unreadable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
  if (!sessionId) return false;
  return revokeAdminSession(sessionId, reason);
}

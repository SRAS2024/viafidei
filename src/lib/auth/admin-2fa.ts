/**
 * Interactive admin two-factor challenge lifecycle (security spec items 1 / 11).
 *
 * WHAT CHANGED
 * ------------
 * Admin sign-in used to be "username + password -> authenticated administrator".
 * It is now "username + password -> PENDING administrator -> six-digit email
 * code -> authenticated administrator". A verified password produces only a
 * PENDING `AdminSession` row (see ./admin-session.ts); this module owns the
 * second half of the gate. Nothing here grants authority — the only thing that
 * does is `completeAdminTwoFactor()`, and it refuses unless a challenge in
 * this table was verified first.
 *
 * SCOPE — READ THIS BEFORE ADDING A CALLER
 * ---------------------------------------
 * A HUMAN administrator at the interactive admin login, and nothing else.
 * Ordinary user accounts never see a code. The Admin Worker and every other
 * automated, machine or scheduled process authenticate by their own paths
 * (`src/lib/security/cron-auth.ts`) and must never reach this module — a
 * worker that had to read an inbox would not be autonomous. That separation
 * is pinned by tests/security/admin-2fa-worker-exempt.test.ts.
 *
 * THE CODE
 * --------
 *   • exactly six digits, generated with `crypto.randomInt` (never
 *     `Math.random()`), zero-padded so "000123" is a legal code;
 *   • lives for ~5 minutes;
 *   • single use — accepted once, then `consumedAt` is set;
 *   • at most 5 verification attempts;
 *   • superseded the moment a replacement is issued;
 *   • NEVER logged, never returned to a client, never placed in an error
 *     message, an analytics field or a security-event payload, and never
 *     stored in plaintext. The one place it appears is the body of the email
 *     addressed to the configured admin mailbox.
 *
 * WHY AN HMAC AND NOT A DIGEST
 * ----------------------------
 * The six-digit space is 10^6. A plain SHA-256 of the code is reversible from
 * a database dump by trying every value — under a second. What is stored is
 * therefore HMAC-SHA256 keyed on the purpose-separated "admin-2fa" subkey
 * (`getTwoFactorHmacKey()`), with the challenge id mixed into the message as
 * a per-row salt so two challenges that happen to draw the same code do not
 * produce the same stored value. Reversing it needs SESSION_SECRET, which a
 * table dump does not contain.
 *
 * NO NEW ENVIRONMENT VARIABLE: the key comes from the existing root secret
 * through the existing key registry, and the destination address is the
 * already-configured ADMIN_EMAIL read through the existing email module.
 *
 * STORAGE
 * -------
 * Parameterised raw SQL rather than a Prisma model, matching ./admin-session.ts:
 * the table is owned by migration 0061_admin_two_factor_challenge and the
 * generated client may not know about it yet.
 */

import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { readAdminEmail } from "../email/admin-send";
import { renderAdminEmail } from "../email/admin-templates";
import { isEmailConfigured, sendTransactionalEmail } from "../email/resend";
import { describeDevice } from "../security/device-info";
import {
  constantTimeEquals,
  deviceCredentialFingerprint,
  ipFingerprint,
  userAgentFingerprint,
} from "../security/hash";
import { getTwoFactorHmacKey } from "../security/keys";
import { rateLimit, type RatePolicy } from "../security/rate-limit";
import { reportSuspiciousActivity } from "../security/security-events";

/* ------------------------------------------------------------------ */
/* Constants — compiled in, never configurable                         */
/* ------------------------------------------------------------------ */

/** Exactly six numeric digits. */
export const ADMIN_2FA_CODE_LENGTH = 6;
/** ~5 minutes. Long enough for an email to land, short enough to be useless later. */
export const ADMIN_2FA_CODE_TTL_MS = 5 * 60 * 1000;
/** At most five guesses at one challenge — 5 in 10^6, then the attempt dies. */
export const ADMIN_2FA_MAX_ATTEMPTS = 5;
/**
 * How long spent challenge rows are kept before the cleanup lane deletes
 * them. They are evidence of a sign-in attempt, so they outlive the
 * challenge itself.
 */
export const ADMIN_2FA_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Persistent rate-limit policies (item 11). Declared here rather than in
 * RATE_POLICIES because that map is owned elsewhere; `rateLimit` accepts any
 * RatePolicy, and the bucket rows land in the same durable table as every
 * other limiter, so this is the existing infrastructure and not a parallel one.
 */
export const ADMIN_2FA_ISSUE_POLICY: RatePolicy = { windowMs: 15 * 60_000, max: 5 };
export const ADMIN_2FA_VERIFY_POLICY: RatePolicy = { windowMs: 15 * 60_000, max: 15 };

/**
 * Security event types for the two-factor stage. Mirrors the vocabulary in
 * `src/lib/security/event-types.ts` (owned elsewhere — the request to fold
 * these in is in the report). No payload built from these ever contains the
 * code, the key, or the raw session id.
 */
export const ADMIN_2FA_EVENT = {
  /** Password accepted, second factor requested. Benign audit, no email. */
  requested: "admin_two_factor_requested",
  /** Second factor verified — this is the moment ADMIN is granted. */
  verified: "admin_two_factor_verified",
  /** A wrong / malformed code was submitted. Benign audit. */
  invalid: "admin_two_factor_invalid",
  /** The challenge had already expired when a code arrived. */
  expired: "admin_two_factor_expired",
  /** Five wrong guesses at one challenge — Suspicious Activity. */
  attemptsExhausted: "admin_two_factor_attempts_exhausted",
  /** Too many codes requested — Suspicious Activity. */
  resendRateLimited: "admin_two_factor_resend_rate_limited",
  /** Too many verification submissions — Suspicious Activity. */
  verifyRateLimited: "admin_two_factor_verify_rate_limited",
} as const;

const ADMIN_2FA_ROUTE = "/api/auth/admin-2fa";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type TwoFactorActor = {
  /** The PENDING admin session id from the encrypted cookie. Never persisted raw. */
  adminSessionId: string;
  username: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceCredential?: string | null;
};

export type IssueAdminTwoFactorResult =
  | {
      ok: true;
      expiresAt: Date;
      /** Whether the message actually left the building. Never contains the code. */
      delivery: "sent" | "skipped" | "failed";
    }
  | { ok: false; reason: "rate_limited" | "store_unavailable" };

/**
 * Why a submission failed. INTERNAL ONLY — used to pick which security event
 * to record. Routes must collapse every one of these into a single generic
 * client response so an attacker cannot tell "wrong code" from "expired" from
 * "already used" (item 11).
 */
export type TwoFactorVerifyFailure =
  | "no_challenge"
  | "expired"
  | "attempts_exhausted"
  | "invalid_code"
  | "rate_limited"
  | "indeterminate";

export type VerifyAdminTwoFactorResult =
  | { ok: true }
  | {
      ok: false;
      reason: TwoFactorVerifyFailure;
      /**
       * True when this login attempt is over and the caller should tear the
       * pending session down rather than offer another guess.
       */
      terminal: boolean;
    };

type ChallengeRow = {
  id: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  supersededAt: Date | null;
};

/* ------------------------------------------------------------------ */
/* Code generation + keyed representation                              */
/* ------------------------------------------------------------------ */

/**
 * Six digits from the CSPRNG. `crypto.randomInt` is uniform over the
 * half-open range — no modulo bias — and `Math.random()` is never used here
 * or anywhere else in this file.
 */
export function generateAdminTwoFactorCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(ADMIN_2FA_CODE_LENGTH, "0");
}

/**
 * The stored key for a pending session id. HMAC under the 2FA subkey with its
 * own message prefix, so the value here cannot be correlated with the
 * session store's own HMAC of the same id.
 */
export function adminSessionChallengeKey(adminSessionId: string): string {
  return crypto
    .createHmac("sha256", getTwoFactorHmacKey())
    .update(`admin-2fa-session:${adminSessionId}`)
    .digest("hex");
}

/** Keyed, per-challenge-salted representation of a code. Never reversible without the key. */
function codeHashFor(challengeId: string, code: string): string {
  return crypto
    .createHmac("sha256", getTwoFactorHmacKey())
    .update(`admin-2fa-code:${challengeId}:${code}`)
    .digest("hex");
}

/** Rows come back as `unknown` from `$queryRaw`; only an array is usable. */
function asRows<T>(value: unknown): T[] | null {
  return Array.isArray(value) ? (value as T[]) : null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Security events                                                     */
/* ------------------------------------------------------------------ */

/**
 * Benign-audit SecurityEvent for a two-factor stage transition. Classified
 * "Audit" for the same reason `admin-login-events.ts` does it: a human
 * administrator completing their own sign-in is expected activity and must
 * never inflate the Suspicious / Breach counters or send a security email.
 *
 * The payload carries the stage and the fingerprinted request identity. It
 * never carries the code, the challenge id, the session id or key material.
 */
async function writeTwoFactorAuditEvent(input: {
  eventType: string;
  severity: "info" | "warning";
  actor: Pick<TwoFactorActor, "ipAddress" | "userAgent" | "deviceCredential">;
}): Promise<string | null> {
  try {
    const row = await prisma.securityEvent.create({
      data: {
        eventType: input.eventType,
        classification: "Audit",
        severity: input.severity,
        ipAddressHash: ipFingerprint(input.actor.ipAddress),
        deviceCredentialHash: deviceCredentialFingerprint(input.actor.deviceCredential),
        userAgentHash: userAgentFingerprint(input.actor.userAgent),
        userAgent: input.actor.userAgent ?? null,
        targetRoute: ADMIN_2FA_ROUTE,
        httpMethod: "POST",
        attemptedAction: input.eventType,
        adminAccount: true,
        emailSent: false,
        banTokenIssued: false,
      },
    });
    return row?.id ?? null;
  } catch (error) {
    logger.warn("admin.two_factor.audit_event_failed", {
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Rate limiting (item 11)                                             */
/* ------------------------------------------------------------------ */

/**
 * Persistent, multi-key rate limiting. Every bucket must allow the call, so
 * the tightest one wins: an attacker cannot spread guesses across devices to
 * stay under the per-device limit, nor rotate IPs to stay under the
 * per-account one.
 *
 * Bucket keys hold only derived values — an HMAC of the pending session, a
 * device-credential fingerprint, the configured admin username and the IP the
 * limiter already stores. No raw session id or device credential is written.
 */
async function withinRateLimits(
  scope: "issue" | "verify",
  actor: TwoFactorActor,
  policy: RatePolicy,
): Promise<boolean> {
  const challengeKey = adminSessionChallengeKey(actor.adminSessionId).slice(0, 32);
  const deviceKey = deviceCredentialFingerprint(actor.deviceCredential)?.slice(0, 32) ?? "none";
  const keys = [
    `admin-2fa-${scope}:chal:${challengeKey}`,
    `admin-2fa-${scope}:ip:${actor.ipAddress ?? "unknown"}`,
    `admin-2fa-${scope}:dev:${deviceKey}`,
    `admin-2fa-${scope}:acct:${actor.username}`,
  ];
  const results = await Promise.all(
    keys.map((key) => rateLimit(key, policy, { ipAddress: actor.ipAddress ?? null })),
  );
  return results.every((r) => r.ok);
}

/* ------------------------------------------------------------------ */
/* Delivery                                                            */
/* ------------------------------------------------------------------ */

/**
 * Mail the code to the admin address that is already configured for
 * operational alerts (ADMIN_EMAIL, read through the existing email module —
 * no new environment variable, and no address is ever accepted from the
 * request). Uses the project's existing Resend transport and admin template.
 *
 * The code appears here and nowhere else. The structured log records only
 * whether delivery happened.
 */
async function deliverCode(params: {
  code: string;
  expiresAt: Date;
  actor: TwoFactorActor;
}): Promise<"sent" | "skipped" | "failed"> {
  const to = readAdminEmail();
  if (!to || !isEmailConfigured()) {
    // No mailbox or no provider: the challenge still exists and still has to
    // be answered. Failing open here would mean "email down => no second
    // factor", which is exactly the bypass this feature exists to prevent.
    logger.warn("admin.two_factor.delivery_skipped", {
      reason: to ? "email_provider_not_configured" : "admin_email_not_set",
    });
    return "skipped";
  }
  const device = describeDevice(params.actor.userAgent);
  const rendered = renderAdminEmail({
    subject: "Admin sign-in code",
    heading: "Admin sign-in code",
    intro:
      "Someone entered the administrator password and needs a second factor to finish signing in. " +
      "The code below is valid for five minutes and can be used once.",
    sections: [
      {
        title: "Your code",
        paragraphs: [params.code],
      },
      {
        title: "Request details",
        table: {
          columns: [
            { key: "key", label: "Field" },
            { key: "value", label: "Value" },
          ],
          rows: [
            { key: "Requested at", value: new Date().toISOString() },
            { key: "Expires at", value: params.expiresAt.toISOString() },
            { key: "Username", value: params.actor.username },
            { key: "IP address", value: params.actor.ipAddress ?? "IP address unavailable" },
            { key: "Browser", value: device.browser ?? "Browser unavailable" },
            {
              key: "Operating system",
              value: device.operatingSystem ?? "Operating system unavailable",
            },
          ],
        },
      },
    ],
    signoff:
      "If you did not just enter the administrator password, do not use this code — change the admin password and review the security log.",
  });
  const result = await sendTransactionalEmail({
    to,
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
  });
  if (!result.ok) {
    // Only the failure reason — never the body, and therefore never the code.
    logger.error("admin.two_factor.delivery_failed", { reason: result.reason });
    return "failed";
  }
  return result.delivery === "sent" ? "sent" : "skipped";
}

/* ------------------------------------------------------------------ */
/* Issue                                                               */
/* ------------------------------------------------------------------ */

/**
 * Issue (or re-issue) the challenge for a password-verified login attempt.
 *
 * Any challenge already outstanding for the same pending session is
 * superseded in the same call, so exactly one code is ever live: a resend
 * invalidates the previous code rather than widening the guessable set.
 *
 * Returns no code, no challenge id and no hash — the caller has nothing it
 * could accidentally leak.
 */
export async function issueAdminTwoFactorChallenge(
  actor: TwoFactorActor,
  options: { now?: Date } = {},
): Promise<IssueAdminTwoFactorResult> {
  const now = options.now ?? new Date();

  if (!(await withinRateLimits("issue", actor, ADMIN_2FA_ISSUE_POLICY))) {
    // Excessive generation / resend. Warning sign, not a confirmed attack.
    void reportSuspiciousActivity({
      kind: ADMIN_2FA_EVENT.resendRateLimited,
      summary: `Admin two-factor codes were requested more than ${ADMIN_2FA_ISSUE_POLICY.max} times in ${Math.round(ADMIN_2FA_ISSUE_POLICY.windowMs / 60000)} minutes from ${actor.ipAddress ?? "unknown"}.`,
      ipAddress: actor.ipAddress ?? undefined,
      userAgent: actor.userAgent ?? undefined,
      route: ADMIN_2FA_ROUTE,
      deviceCredential: actor.deviceCredential ?? undefined,
      attemptedAccountOrRoute: actor.username,
      attemptedAction: ADMIN_2FA_EVENT.resendRateLimited,
      adminAccount: true,
      recommendedAction:
        "Confirm the administrator is signing in. If not, treat as an attempt to flood the admin mailbox or to fish for a code.",
    });
    return { ok: false, reason: "rate_limited" };
  }

  const sessionHash = adminSessionChallengeKey(actor.adminSessionId);
  const challengeId = crypto.randomUUID();
  const code = generateAdminTwoFactorCode();
  const expiresAt = new Date(now.getTime() + ADMIN_2FA_CODE_TTL_MS);

  try {
    // Supersede first: from this statement on, the previous code is dead even
    // if the insert below fails. The failure mode is "no valid code", never
    // "two valid codes".
    await prisma.$queryRaw(Prisma.sql`
      UPDATE "AdminTwoFactorChallenge"
         SET "supersededAt" = ${now}, "updatedAt" = ${now}
       WHERE "adminSessionHash" = ${sessionHash}
         AND "consumedAt" IS NULL
         AND "supersededAt" IS NULL
      RETURNING "id"
    `);

    const inserted = asRows<{ id: string }>(
      await prisma.$queryRaw(Prisma.sql`
        INSERT INTO "AdminTwoFactorChallenge" (
          "id", "adminSessionHash", "adminUsername", "codeHash", "attempts", "maxAttempts",
          "issuedAt", "expiresAt", "consumedAt", "supersededAt",
          "ipHash", "userAgentHash", "deviceCredentialHash", "createdAt", "updatedAt"
        ) VALUES (
          ${challengeId}, ${sessionHash}, ${actor.username}, ${codeHashFor(challengeId, code)},
          0, ${ADMIN_2FA_MAX_ATTEMPTS}, ${now}, ${expiresAt}, NULL, NULL,
          ${ipFingerprint(actor.ipAddress)}, ${userAgentFingerprint(actor.userAgent)},
          ${deviceCredentialFingerprint(actor.deviceCredential)}, ${now}, ${now}
        )
        RETURNING "id"
      `),
    );
    if (!inserted || inserted.length === 0) return { ok: false, reason: "store_unavailable" };
  } catch (error) {
    logger.error("admin.two_factor.issue_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: "store_unavailable" };
  }

  const delivery = await deliverCode({ code, expiresAt, actor });

  // "Password verified and 2FA requested" — the audit trail of stage one.
  await writeTwoFactorAuditEvent({
    eventType: ADMIN_2FA_EVENT.requested,
    severity: "info",
    actor,
  });

  return { ok: true, expiresAt, delivery };
}

/* ------------------------------------------------------------------ */
/* Verify (item 11)                                                    */
/* ------------------------------------------------------------------ */

/** A submitted value is only ever six digits; anything else can never match. */
function normalizeSubmittedCode(raw: string): string | null {
  const trimmed = raw.replace(/[\s-]/g, "");
  return /^[0-9]{6}$/.test(trimmed) ? trimmed : null;
}

/**
 * Classify why a challenge was not eligible, for the security event only.
 * Runs AFTER the decision, and its answer never reaches the client.
 */
async function classifyIneligible(
  sessionHash: string,
  now: Date,
): Promise<"no_challenge" | "expired" | "attempts_exhausted"> {
  try {
    const rows = asRows<ChallengeRow>(
      await prisma.$queryRaw(Prisma.sql`
        SELECT "id", "codeHash", "attempts", "expiresAt", "consumedAt", "supersededAt"
          FROM "AdminTwoFactorChallenge"
         WHERE "adminSessionHash" = ${sessionHash}
           AND "consumedAt" IS NULL
           AND "supersededAt" IS NULL
         ORDER BY "issuedAt" DESC
         LIMIT 1
      `),
    );
    const row = rows?.[0];
    if (!row) return "no_challenge";
    if (Number(row.attempts) >= ADMIN_2FA_MAX_ATTEMPTS) return "attempts_exhausted";
    const expiresAt = toDate(row.expiresAt);
    if (!expiresAt || expiresAt.getTime() <= now.getTime()) return "expired";
    return "no_challenge";
  } catch {
    return "no_challenge";
  }
}

/**
 * Verify a submitted code against this login attempt's live challenge.
 *
 * The eligibility check and the attempt increment are ONE statement. Its
 * WHERE clause is the authorization — a consumed, superseded, expired or
 * attempt-exhausted challenge matches zero rows and is refused, and two
 * concurrent submissions cannot both read `attempts` before either writes it.
 *
 * The comparison is constant-time over the keyed representation, so no timing
 * signal distinguishes a code that is one digit wrong from one that is
 * entirely wrong.
 *
 * A correct code is consumed with a conditional UPDATE, so the challenge is
 * not reusable after success even if two requests race.
 */
export async function verifyAdminTwoFactorCode(
  actor: TwoFactorActor,
  submitted: string,
  options: { now?: Date } = {},
): Promise<VerifyAdminTwoFactorResult> {
  const now = options.now ?? new Date();

  if (!(await withinRateLimits("verify", actor, ADMIN_2FA_VERIFY_POLICY))) {
    void reportSuspiciousActivity({
      kind: ADMIN_2FA_EVENT.verifyRateLimited,
      summary: `Admin two-factor verification was attempted more than ${ADMIN_2FA_VERIFY_POLICY.max} times in ${Math.round(ADMIN_2FA_VERIFY_POLICY.windowMs / 60000)} minutes from ${actor.ipAddress ?? "unknown"}.`,
      ipAddress: actor.ipAddress ?? undefined,
      userAgent: actor.userAgent ?? undefined,
      route: ADMIN_2FA_ROUTE,
      deviceCredential: actor.deviceCredential ?? undefined,
      attemptedAccountOrRoute: actor.username,
      attemptedAction: ADMIN_2FA_EVENT.verifyRateLimited,
      adminAccount: true,
      recommendedAction:
        "Confirm the administrator is signing in. If not, treat as an attempt to guess the six-digit code.",
    });
    return { ok: false, reason: "rate_limited", terminal: true };
  }

  const sessionHash = adminSessionChallengeKey(actor.adminSessionId);

  let row: ChallengeRow | undefined;
  try {
    // Claim one attempt. Every "is this challenge usable" condition lives in
    // the WHERE clause, so the row we get back is by definition eligible.
    const rows = asRows<ChallengeRow>(
      await prisma.$queryRaw(Prisma.sql`
        UPDATE "AdminTwoFactorChallenge"
           SET "attempts" = "attempts" + 1, "updatedAt" = ${now}
         WHERE "id" = (
           SELECT "id" FROM "AdminTwoFactorChallenge"
            WHERE "adminSessionHash" = ${sessionHash}
              AND "consumedAt" IS NULL
              AND "supersededAt" IS NULL
              AND "expiresAt" > ${now}
              AND "attempts" < ${ADMIN_2FA_MAX_ATTEMPTS}
            ORDER BY "issuedAt" DESC
            LIMIT 1
         )
        RETURNING "id", "codeHash", "attempts", "expiresAt", "consumedAt", "supersededAt"
      `),
    );
    if (!rows) return { ok: false, reason: "indeterminate", terminal: true };
    row = rows[0];
  } catch (error) {
    logger.error("admin.two_factor.verify_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: "indeterminate", terminal: true };
  }

  if (!row) {
    // Nothing eligible. Work out which control fired, for the event only.
    const reason = await classifyIneligible(sessionHash, now);
    if (reason === "expired") {
      await writeTwoFactorAuditEvent({
        eventType: ADMIN_2FA_EVENT.expired,
        severity: "warning",
        actor,
      });
    } else if (reason === "attempts_exhausted") {
      await recordAttemptsExhausted(actor);
    }
    return { ok: false, reason, terminal: true };
  }

  const normalized = normalizeSubmittedCode(submitted);
  // A malformed submission still costs an attempt (it was already counted
  // above) and is compared anyway, so a syntactically invalid guess is not a
  // cheaper probe than a valid-looking one.
  const candidate = codeHashFor(row.id, normalized ?? "");
  const matches = normalized !== null && constantTimeEquals(candidate, String(row.codeHash));

  if (!matches) {
    const attempts = Number(row.attempts);
    if (attempts >= ADMIN_2FA_MAX_ATTEMPTS) {
      // That was the last guess. Kill the challenge so nothing can retry it.
      await supersedeChallenge(row.id, now);
      await recordAttemptsExhausted(actor);
      return { ok: false, reason: "attempts_exhausted", terminal: true };
    }
    await writeTwoFactorAuditEvent({
      eventType: ADMIN_2FA_EVENT.invalid,
      severity: "warning",
      actor,
    });
    return { ok: false, reason: "invalid_code", terminal: false };
  }

  // Correct. Consume it — conditionally, so a racing duplicate submission
  // cannot also succeed on the same challenge.
  try {
    const consumed = asRows<{ id: string }>(
      await prisma.$queryRaw(Prisma.sql`
        UPDATE "AdminTwoFactorChallenge"
           SET "consumedAt" = ${now}, "updatedAt" = ${now}
         WHERE "id" = ${row.id}
           AND "consumedAt" IS NULL
           AND "supersededAt" IS NULL
        RETURNING "id"
      `),
    );
    if (!consumed || consumed.length === 0) {
      // Already consumed between the read and here: a challenge is single use.
      return { ok: false, reason: "no_challenge", terminal: true };
    }
  } catch (error) {
    logger.error("admin.two_factor.consume_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: "indeterminate", terminal: true };
  }

  await writeTwoFactorAuditEvent({
    eventType: ADMIN_2FA_EVENT.verified,
    severity: "info",
    actor,
  });
  return { ok: true };
}

async function recordAttemptsExhausted(actor: TwoFactorActor): Promise<void> {
  void reportSuspiciousActivity({
    kind: ADMIN_2FA_EVENT.attemptsExhausted,
    summary: `${ADMIN_2FA_MAX_ATTEMPTS} incorrect admin two-factor codes were submitted for one sign-in attempt from ${actor.ipAddress ?? "unknown"}.`,
    ipAddress: actor.ipAddress ?? undefined,
    userAgent: actor.userAgent ?? undefined,
    route: ADMIN_2FA_ROUTE,
    deviceCredential: actor.deviceCredential ?? undefined,
    attemptedAccountOrRoute: actor.username,
    attemptedAction: ADMIN_2FA_EVENT.attemptsExhausted,
    adminAccount: true,
    recommendedAction:
      "Someone holds a password-verified session but not the admin mailbox. Change the admin password if the sign-in was not you.",
  });
}

async function supersedeChallenge(challengeId: string, now: Date): Promise<void> {
  try {
    await prisma.$queryRaw(Prisma.sql`
      UPDATE "AdminTwoFactorChallenge"
         SET "supersededAt" = ${now}, "updatedAt" = ${now}
       WHERE "id" = ${challengeId} AND "supersededAt" IS NULL
      RETURNING "id"
    `);
  } catch (error) {
    logger.warn("admin.two_factor.supersede_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Invalidate every live challenge for one login attempt. Called when the
 * attempt is abandoned or torn down (sign-out, exhausted attempts, restart)
 * so no code outlives the session it belongs to.
 */
export async function abandonAdminTwoFactorChallenges(
  adminSessionId: string,
  options: { now?: Date } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  try {
    const rows = asRows<{ id: string }>(
      await prisma.$queryRaw(Prisma.sql`
        UPDATE "AdminTwoFactorChallenge"
           SET "supersededAt" = ${now}, "updatedAt" = ${now}
         WHERE "adminSessionHash" = ${adminSessionChallengeKey(adminSessionId)}
           AND "consumedAt" IS NULL
           AND "supersededAt" IS NULL
        RETURNING "id"
      `),
    );
    return rows?.length ?? 0;
  } catch (error) {
    logger.warn("admin.two_factor.abandon_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Delete spent challenge rows. Maintenance for the Admin Worker's existing
 * cleanup lane — the worker never verifies a code, it only keeps the table
 * small. Bounded so the sweep cannot take a long lock, and never throws.
 */
export async function pruneExpiredAdminTwoFactorChallenges(
  options: {
    now?: Date;
    limit?: number;
    client?: { $queryRaw: (q: Prisma.Sql) => Promise<unknown> };
  } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(options.limit ?? 500, 5000));
  const cutoff = new Date(now.getTime() - ADMIN_2FA_RETENTION_MS);
  const client = options.client ?? prisma;
  try {
    const rows = asRows<{ id: string }>(
      await client.$queryRaw(Prisma.sql`
        DELETE FROM "AdminTwoFactorChallenge"
         WHERE "id" IN (
           SELECT "id" FROM "AdminTwoFactorChallenge"
            WHERE "expiresAt" < ${cutoff}
            LIMIT ${limit}
         )
        RETURNING "id"
      `),
    );
    return rows?.length ?? 0;
  } catch (error) {
    logger.warn("admin.two_factor.prune_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

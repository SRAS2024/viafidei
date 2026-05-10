import { type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/admin";
import { hashPassword } from "@/lib/auth/password";
import { encryptAtRest } from "@/lib/security/crypto";
import { issueEmailVerificationToken, issuePasswordResetToken } from "@/lib/auth/tokens";
import { sendEmailVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/email";
import { jsonError, jsonOk } from "@/lib/http";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

type Step = {
  /** Stable key the UI uses to look up icons / copy. */
  step:
    | "create_user"
    | "issue_verification_token"
    | "issue_password_reset_token"
    | "send_welcome"
    | "send_password_reset"
    | "send_verify"
    | "cleanup";
  ok: boolean;
  message: string;
};

/**
 * POST /api/admin/email/self-test
 *
 * The single most decisive diagnostic for "the diagnostic templates send
 * but the user-side flows don't." Runs the **exact** code path the
 * registration / forgot-password / resend-verification routes run —
 * including the database token writes — against a throwaway test user
 * that this endpoint owns end-to-end.
 *
 * Sequence:
 *   1. Create a test User row (random email at @selftest.local).
 *   2. Issue an EmailVerificationToken via the same helper register uses.
 *   3. Issue a PasswordResetToken via the same helper forgot-password uses.
 *   4. Send the welcome email (renders the real template, dispatches via
 *      Resend, but to the admin-supplied recipient instead of the test
 *      user's fake address).
 *   5. Send the password-reset email (same).
 *   6. Send the verify email (same).
 *   7. Delete the test user — cascading FKs wipe both token rows.
 *
 * Each step's outcome is reported individually. The first failing step
 * is the answer. If every step is green and the user-facing flows still
 * fail, the issue is somewhere outside this code path.
 *
 * Recipient: caller passes `?to=email`. All three sends go there. No
 * mail is ever sent to the throwaway user's @selftest.local address.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const url = new URL(req.url);
  const to = url.searchParams.get("to")?.trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return jsonError("invalid", { message: "to_required" });
  }

  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  const steps: Step[] = [];
  let testUserId: string | null = null;

  // 1. create_user — same Prisma create as the register route, scoped
  // to a throwaway address the cleanup step removes at the end.
  try {
    const fakeEmail = `selftest+${Date.now()}.${Math.random().toString(36).slice(2, 8)}@selftest.local`;
    const passwordHash = await hashPassword("selftest-password-not-usable-1234");
    const created = await prisma.user.create({
      data: {
        email: fakeEmail,
        passwordHash,
        firstName: "SelfTest",
        lastName: "Diagnostic",
        language: "en",
        emailEncrypted: encryptAtRest(fakeEmail),
        nameEncrypted: encryptAtRest("SelfTest Diagnostic"),
        profile: { create: { languageOverride: "en" } },
      },
      select: { id: true, email: true, firstName: true, lastName: true, language: true },
    });
    testUserId = created.id;
    steps.push({
      step: "create_user",
      ok: true,
      message: `created throwaway user ${created.id} (${created.email})`,
    });

    // 2. issue_verification_token — same helper register uses.
    let verifyIssued: Awaited<ReturnType<typeof issueEmailVerificationToken>> | null = null;
    try {
      verifyIssued = await issueEmailVerificationToken(created.id);
      steps.push({
        step: "issue_verification_token",
        ok: true,
        message: `EmailVerificationToken row written (expires ${verifyIssued.expiresAt.toISOString()})`,
      });
    } catch (error) {
      steps.push({ step: "issue_verification_token", ok: false, message: describe(error) });
    }

    // 3. issue_password_reset_token — same helper forgot-password uses.
    let resetIssued: Awaited<ReturnType<typeof issuePasswordResetToken>> | null = null;
    try {
      resetIssued = await issuePasswordResetToken(created.id);
      steps.push({
        step: "issue_password_reset_token",
        ok: true,
        message: `PasswordResetToken row written (expires ${resetIssued.expiresAt.toISOString()})`,
      });
    } catch (error) {
      steps.push({ step: "issue_password_reset_token", ok: false, message: describe(error) });
    }

    // 4-6. The same email helpers the live routes call. Recipient is
    // the admin-supplied address, NOT the throwaway @selftest.local
    // mailbox (which would bounce). Skip a send when its token never
    // got issued — that step is already marked failed above.
    const userForEmail = { ...created, email: to };

    if (verifyIssued) {
      const r = await sendWelcomeEmail({
        user: userForEmail,
        token: verifyIssued.token,
        expiresAt: verifyIssued.expiresAt,
      });
      steps.push({
        step: "send_welcome",
        ok: r.ok && r.delivery === "sent",
        message: describeSend(r),
      });
    } else {
      steps.push({
        step: "send_welcome",
        ok: false,
        message: "skipped — verification token was never issued",
      });
    }

    if (resetIssued) {
      const r = await sendPasswordResetEmail({
        user: userForEmail,
        token: resetIssued.token,
        expiresAt: resetIssued.expiresAt,
      });
      steps.push({
        step: "send_password_reset",
        ok: r.ok && r.delivery === "sent",
        message: describeSend(r),
      });
    } else {
      steps.push({
        step: "send_password_reset",
        ok: false,
        message: "skipped — password reset token was never issued",
      });
    }

    if (verifyIssued) {
      const r = await sendEmailVerificationEmail({
        user: userForEmail,
        token: verifyIssued.token,
        expiresAt: verifyIssued.expiresAt,
      });
      steps.push({
        step: "send_verify",
        ok: r.ok && r.delivery === "sent",
        message: describeSend(r),
      });
    } else {
      steps.push({
        step: "send_verify",
        ok: false,
        message: "skipped — verification token was never issued",
      });
    }
  } catch (error) {
    steps.push({ step: "create_user", ok: false, message: describe(error) });
  }

  // 7. Cleanup. ALWAYS attempt — even if intermediate steps failed,
  // the test user (and any token rows that did get written) must not
  // outlive the diagnostic. Cascading FKs wipe Profile, Session,
  // PasswordResetToken, EmailVerificationToken, and every UserSaved*.
  if (testUserId) {
    try {
      await prisma.user.delete({ where: { id: testUserId } });
      steps.push({
        step: "cleanup",
        ok: true,
        message: `deleted throwaway user ${testUserId} (cascade removed any token rows)`,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        // Already gone — fine.
        steps.push({ step: "cleanup", ok: true, message: "throwaway user already removed" });
      } else {
        steps.push({
          step: "cleanup",
          ok: false,
          message: `cleanup failed — manual delete required for user ${testUserId}: ${describe(error)}`,
        });
      }
    }
  }

  const passed = steps.every((s) => s.ok);
  logger.info("admin.email.self_test", {
    actor: admin.username,
    requestId,
    passed,
    failedStep: steps.find((s) => !s.ok)?.step,
  });

  return jsonOk({ passed, steps });
}

function describe(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return raw.split("\n").slice(0, 3).join(" ").slice(0, 400);
}

function describeSend(r: Awaited<ReturnType<typeof sendWelcomeEmail>>): string {
  if (r.ok) {
    return r.delivery === "sent"
      ? "Resend accepted the message"
      : `skipped at transport (reason: ${r.reason})`;
  }
  const parts: string[] = [`reason=${r.reason}`];
  if (r.errorName) parts.push(`name=${r.errorName}`);
  if (r.errorMessage) parts.push(`message=${r.errorMessage}`);
  if (r.statusCode) parts.push(`status=${r.statusCode}`);
  return parts.join(" ");
}

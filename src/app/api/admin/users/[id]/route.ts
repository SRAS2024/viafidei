import { type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { requireAdmin, verifyAdminCredentials } from "@/lib/auth/admin";
import { writeAudit } from "@/lib/audit";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

const deleteSchema = z.object({
  // The admin re-types their password in the confirmation dialog. This
  // is a deliberate friction point: deleting a user account wipes their
  // saved content irreversibly, so we require the admin to prove
  // they're still the principal that signed in (not a tab left open,
  // not someone walking up to an unlocked browser).
  password: z.string().min(1).max(256),
});

/**
 * DELETE /api/admin/users/:id
 *
 * Permanently removes a user account and every row that cascades from
 * it (Profile, Session, JournalEntry, Goal, Milestone, every
 * UserSaved*, PasswordResetToken, EmailVerificationToken). The Prisma
 * schema declares `onDelete: Cascade` on each child relation so the
 * single `prisma.user.delete` triggers the cascade in a single
 * transaction at the database level — no risk of leaving orphan rows.
 *
 * Guardrails:
 *   - Caller must already be a signed-in admin (`requireAdmin`).
 *   - Caller must re-type the admin password (`verifyAdminCredentials`)
 *     so a hijacked admin session cannot wipe accounts with a single
 *     click.
 *   - Admins cannot delete a User row with role=ADMIN through this
 *     endpoint — admin credentials live in env vars, not the User
 *     table, so any ADMIN-role row is a defensive safety check we
 *     refuse to honor here.
 *   - Writes an `admin.user_account.deleted` row to AdminAuditLog with
 *     the previousValue (email + name) so the action is traceable
 *     even after the User row is gone.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const ip = getClientIp(req);
  const limit = await rateLimit(`admin-user-delete:${admin.username}`, RATE_POLICIES.adminWrite, {
    ipAddress: ip,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = deleteSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  // Re-verify the admin password before wiping data. `requireAdmin`
  // alone only proves the session cookie is valid; this proves the
  // human is currently at the keyboard.
  const passwordOk = verifyAdminCredentials(admin.username, parsed.data.password);
  if (!passwordOk) {
    logger.warn("admin.user_account.delete_password_invalid", {
      actor: admin.username,
      targetUserId: params.id,
    });
    return jsonError("unauthorized", { message: "password_invalid" });
  }

  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });
  if (!target) return jsonError("not_found");
  if (target.role === "ADMIN") {
    // Defense-in-depth. There should be no ADMIN-role rows because
    // admin auth uses env vars; if one exists it's likely a seed or
    // misconfiguration and deleting it through the user-management UI
    // would be confusing.
    logger.warn("admin.user_account.delete_refused_admin_role", {
      actor: admin.username,
      targetUserId: target.id,
    });
    return jsonError("forbidden", { message: "cannot_delete_admin" });
  }

  try {
    // Cascading deletes wipe Profile, Session, JournalEntry, Goal,
    // GoalChecklistItem (via Goal), Milestone, UserSavedPrayer,
    // UserSavedSaint, UserSavedApparition, UserSavedParish,
    // UserSavedDevotion, PasswordResetToken, EmailVerificationToken.
    // See `onDelete: Cascade` declarations in prisma/schema.prisma.
    await prisma.user.delete({ where: { id: target.id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      // Concurrent delete — already gone. Treat as success so the
      // admin UI doesn't show a misleading error.
      return jsonOk({ deleted: true, id: target.id });
    }
    const message = error instanceof Error ? error.message : "unknown_error";
    logger.error("admin.user_account.delete_failed", {
      actor: admin.username,
      targetUserId: target.id,
      requestId,
      message,
    });
    return jsonError("server_error");
  }

  await writeAudit({
    action: "admin.user_account.deleted",
    entityType: "User",
    entityId: target.id,
    actorUsername: admin.username,
    ipAddress: ip,
    userAgent: req.headers.get("user-agent"),
    requestId,
    previousValue: {
      email: target.email,
      firstName: target.firstName,
      lastName: target.lastName,
    },
  });
  logger.info("admin.user_account.deleted", {
    actor: admin.username,
    targetUserId: target.id,
    requestId,
  });
  return jsonOk({ deleted: true, id: target.id });
}

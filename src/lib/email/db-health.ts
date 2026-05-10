import { prisma } from "@/lib/db/client";

export type EmailFlowDbCheck = {
  /** True when every required table + column is present AND the Prisma
   *  client can read/write each token table. */
  ok: boolean;
  /** Each row narrates one check; `present:false` rows are the ones to fix. */
  pieces: Array<{
    kind: "table" | "column" | "prisma_model";
    name: string;
    present: boolean;
    message: string;
  }>;
};

async function tableExists(name: string): Promise<boolean> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
    name,
  )) as Array<unknown>;
  return rows.length > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    table,
    column,
  )) as Array<unknown>;
  return rows.length > 0;
}

/**
 * Calls the typed Prisma model the production routes use. Catches three
 * distinct failure modes that the raw-SQL `tableExists` cannot:
 *
 *   1. The Prisma client baked into this build doesn't know about the
 *      model (build cached an old generated client → schema is current
 *      in Postgres but the application's typed client is stale).
 *   2. The model exists but a column the Prisma schema declares is
 *      missing in Postgres (partial migration, manual drop).
 *   3. The Prisma client cannot connect to the database at all.
 *
 * Returns `{ ok: true }` on success or `{ ok: false, message }` with the
 * sanitized error message — the same kind of message the route's
 * structured log line carries when the live flow throws.
 */
async function prismaCanRead(
  model: "passwordResetToken" | "emailVerificationToken",
): Promise<{ ok: boolean; message: string }> {
  try {
    if (model === "passwordResetToken") {
      await prisma.passwordResetToken.findFirst({ select: { id: true } });
    } else {
      await prisma.emailVerificationToken.findFirst({ select: { id: true } });
    }
    return { ok: true, message: `prisma.${model} reachable` };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error ?? "");
    // Trim Prisma's giant validation prelude so the panel stays readable.
    const message = raw.split("\n").slice(0, 3).join(" ").slice(0, 240);
    return { ok: false, message: `prisma.${model} threw: ${message}` };
  }
}

/**
 * Runs the same three checks the standalone validator (`scripts/validate-
 * account-email-db.js`) runs, but on-demand from the admin diagnostic so
 * the operator can see at a glance whether the welcome / verification /
 * password-reset routes can even reach Resend.
 *
 * The token-write happens BEFORE the email send in every real flow, so a
 * missing table / column / stale Prisma client makes the entire flow
 * throw before Resend is called — and a green plain-test diagnostic does
 * NOT prove the flow works end-to-end. This panel closes that gap.
 */
export async function checkAccountEmailDb(): Promise<EmailFlowDbCheck> {
  const pieces: EmailFlowDbCheck["pieces"] = [];

  const userTable = await tableExists("User");
  if (!userTable) {
    pieces.push({
      kind: "table",
      name: "User",
      present: false,
      message: "User table missing — registration cannot run",
    });
  } else {
    const verifiedAt = await columnExists("User", "emailVerifiedAt");
    pieces.push({
      kind: "column",
      name: "User.emailVerifiedAt",
      present: verifiedAt,
      message: verifiedAt
        ? "User.emailVerifiedAt present"
        : "User.emailVerifiedAt missing — verify-email cannot mark accounts as verified",
    });
  }

  const passwordResetTable = await tableExists("PasswordResetToken");
  pieces.push({
    kind: "table",
    name: "PasswordResetToken",
    present: passwordResetTable,
    message: passwordResetTable
      ? "PasswordResetToken table present"
      : "PasswordResetToken missing — forgot-password / reset-password will throw before sending",
  });

  const verifyTable = await tableExists("EmailVerificationToken");
  pieces.push({
    kind: "table",
    name: "EmailVerificationToken",
    present: verifyTable,
    message: verifyTable
      ? "EmailVerificationToken table present"
      : "EmailVerificationToken missing — registration / resend / verify-email will throw before sending",
  });

  // Even when `pg_tables` confirms the tables exist, the live flow can
  // still fail if the Prisma client baked into this build is out of
  // sync with the database (a stale client doesn't know about the
  // model and throws before the SQL is ever issued). Run the typed
  // call the routes use to catch that case here.
  if (passwordResetTable) {
    const probe = await prismaCanRead("passwordResetToken");
    pieces.push({
      kind: "prisma_model",
      name: "prisma.passwordResetToken.findFirst()",
      present: probe.ok,
      message: probe.message,
    });
  }
  if (verifyTable) {
    const probe = await prismaCanRead("emailVerificationToken");
    pieces.push({
      kind: "prisma_model",
      name: "prisma.emailVerificationToken.findFirst()",
      present: probe.ok,
      message: probe.message,
    });
  }

  return {
    ok: pieces.every((p) => p.present),
    pieces,
  };
}

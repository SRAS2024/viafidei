import { prisma } from "@/lib/db/client";

export type EmailFlowDbCheck = {
  /** True when every required table + column is present. */
  ok: boolean;
  /** Each row narrates one check; `present:false` rows are the ones to fix. */
  pieces: Array<{
    kind: "table" | "column";
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
 * Runs the same three checks the standalone validator (`scripts/validate-
 * account-email-db.js`) runs, but on-demand from the admin diagnostic so
 * the operator can see at a glance whether the welcome / verification /
 * password-reset routes can even reach Resend.
 *
 * The token-write happens BEFORE the email send in every real flow, so a
 * missing table / column makes the entire flow throw before Resend is
 * called — and a green plain-test diagnostic does NOT prove the flow
 * works end-to-end. This panel closes that gap.
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

  return {
    ok: pieces.every((p) => p.present),
    pieces,
  };
}

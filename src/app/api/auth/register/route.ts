import { NextResponse, type NextRequest } from "next/server";
import {
  createUser,
  registerSchema,
  findUserByEmail,
  getSession,
  issueEmailVerificationToken,
} from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { sendEmailVerificationEmail } from "@/lib/email";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

function classifyError(parsed: ReturnType<typeof registerSchema.safeParse>): string {
  if (parsed.success) return "invalid";
  const issue = parsed.error.issues[0];
  if (issue?.message === "mismatch") return "mismatch";
  if (issue?.path.includes("password")) return "weak";
  return "invalid";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const parsed = registerSchema.safeParse({
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    email: form.get("email"),
    password: form.get("password"),
    passwordConfirm: form.get("passwordConfirm"),
  });

  if (!parsed.success) {
    const error = classifyError(parsed);
    return NextResponse.redirect(new URL(`/register?error=${error}`, req.url), 303);
  }

  const ip = getClientIp(req);
  const limit = await rateLimit(`register:${ip}`, RATE_POLICIES.register, { ipAddress: ip });
  if (!limit.ok) {
    return NextResponse.redirect(new URL("/register?error=exists", req.url), 303);
  }

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) {
    return NextResponse.redirect(new URL("/register?error=exists", req.url), 303);
  }

  const user = await createUser(parsed.data);

  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  try {
    const issued = await issueEmailVerificationToken(user.id);
    logger.info("auth.email_verification.requested", {
      userId: user.id,
      requestId,
      expiresAt: issued.expiresAt.toISOString(),
    });
    const result = await sendEmailVerificationEmail({
      to: user.email,
      token: issued.token,
      expiresAt: issued.expiresAt,
    });
    if (!result.ok) {
      logger.error("auth.email_verification.email_failed", {
        userId: user.id,
        requestId,
        reason: result.reason,
      });
    }
  } catch (error) {
    logger.error("auth.email_verification.issue_failed", {
      userId: user.id,
      requestId,
      error,
    });
  }

  const session = await getSession();
  session.userId = user.id;
  session.userEmail = user.email;
  session.userName = `${user.firstName} ${user.lastName}`;
  session.role = "USER";
  await session.save();

  return NextResponse.redirect(new URL("/profile", req.url), 303);
}

import { NextResponse, type NextRequest } from "next/server";
import { authenticate, loginSchema, getSession } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

const LOGIN_INVALID = "/login?error=invalid";
const DEFAULT_NEXT = "/profile";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") ? raw : DEFAULT_NEXT;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const parsed = loginSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  const next = safeNext((form.get("next") as string | null) ?? null);

  if (!parsed.success) {
    return NextResponse.redirect(new URL(LOGIN_INVALID, req.url), 303);
  }

  const ip = getClientIp(req);
  const limit = rateLimit(`login:${ip}:${parsed.data.email.toLowerCase()}`, RATE_POLICIES.login);
  if (!limit.ok) {
    return NextResponse.redirect(new URL(LOGIN_INVALID, req.url), 303);
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.redirect(new URL(LOGIN_INVALID, req.url), 303);
  }

  const session = await getSession();
  session.userId = user.id;
  session.userEmail = user.email;
  session.userName = `${user.firstName} ${user.lastName}`;
  session.role = "USER";
  await session.save();

  return NextResponse.redirect(new URL(next, req.url), 303);
}

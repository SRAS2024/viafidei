import { NextResponse, type NextRequest } from "next/server";
import { authenticate, loginSchema } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { rateLimit, RATE_POLICIES } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const parsed = loginSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  const next = (form.get("next") as string) || "/profile";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!parsed.success) {
    return NextResponse.redirect(new URL("/login?error=invalid", req.url), 303);
  }

  const rateKey = `login:${ip}:${parsed.data.email.toLowerCase()}`;
  const limit = rateLimit(rateKey, RATE_POLICIES.login);
  if (!limit.ok) {
    return NextResponse.redirect(new URL("/login?error=invalid", req.url), 303);
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=invalid", req.url), 303);
  }

  const session = await getSession();
  session.userId = user.id;
  session.userEmail = user.email;
  session.userName = `${user.firstName} ${user.lastName}`;
  session.role = "USER";
  await session.save();

  return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/profile", req.url), 303);
}

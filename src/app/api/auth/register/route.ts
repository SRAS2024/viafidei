import { NextResponse, type NextRequest } from "next/server";
import { createUser, registerSchema } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { rateLimit, RATE_POLICIES } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

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
    const issue = parsed.error.issues[0];
    const error =
      issue?.message === "mismatch"
        ? "mismatch"
        : issue?.path.includes("password")
          ? "weak"
          : "invalid";
    return NextResponse.redirect(new URL(`/register?error=${error}`, req.url), 303);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`register:${ip}`, RATE_POLICIES.register);
  if (!limit.ok) {
    return NextResponse.redirect(new URL("/register?error=exists", req.url), 303);
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email.trim().toLowerCase() },
  });
  if (existing) {
    return NextResponse.redirect(new URL("/register?error=exists", req.url), 303);
  }

  const user = await createUser(parsed.data);

  const session = await getSession();
  session.userId = user.id;
  session.userEmail = user.email;
  session.userName = `${user.firstName} ${user.lastName}`;
  session.role = "USER";
  await session.save();

  return NextResponse.redirect(new URL("/profile", req.url), 303);
}

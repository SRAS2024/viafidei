import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit, RATE_POLICIES } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);

  const ok = rateLimit(`journal:${user.id}`, RATE_POLICIES.userWrite);
  if (!ok.ok) return NextResponse.redirect(new URL("/profile/journal", req.url), 303);

  const form = await req.formData();
  const parsed = schema.safeParse({ title: form.get("title"), body: form.get("body") });
  if (!parsed.success) return NextResponse.redirect(new URL("/profile/journal", req.url), 303);

  await prisma.journalEntry.create({
    data: { userId: user.id, title: parsed.data.title, body: parsed.data.body },
  });
  return NextResponse.redirect(new URL("/profile/journal", req.url), 303);
}

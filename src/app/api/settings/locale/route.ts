import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { isSupportedLocale } from "@/lib/i18n/locales";
import { LOCALE_COOKIE_NAME, LOCALE_COOKIE_OPTIONS } from "@/lib/i18n/cookie";
import { requireUser } from "@/lib/auth/user";
import { redirectTo } from "@/lib/security/request";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const raw = String(form.get("locale") ?? "");
  const c = await cookies();
  if (raw && isSupportedLocale(raw)) {
    c.set(LOCALE_COOKIE_NAME, raw, LOCALE_COOKIE_OPTIONS);
  } else {
    c.delete(LOCALE_COOKIE_NAME);
  }

  // For signed-in users, save the explicit language to the database so
  // future emails go out in the user's preferred language. An "automatic"
  // selection (no `raw`) leaves the existing saved language untouched.
  // Through requireUser, so a sign-in a password reset has ended cannot write here.
  const user = raw && isSupportedLocale(raw) ? await requireUser().catch(() => null) : null;
  if (user) {
    try {
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { language: raw } }),
        prisma.profile.upsert({
          where: { userId: user.id },
          update: { languageOverride: raw },
          create: { userId: user.id, languageOverride: raw },
        }),
      ]);
    } catch {
      // Non-fatal: cookie remains the source of truth for this request.
    }
  }

  return redirectTo(req, "/profile/settings");
}

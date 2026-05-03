import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  const { t } = await getTranslator();
  return (
    <div className="mx-auto max-w-md pt-12">
      <div className="text-center">
        <p className="vf-eyebrow">{t("auth.signIn")}</p>
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-4xl">{t("auth.forgot.title")}</h1>
        <p className="mx-auto mt-3 max-w-sm font-serif text-ink-soft">
          {t("auth.forgot.subtitle")}
        </p>
      </div>

      <div className="vf-card mt-10 rounded-sm p-8">
        <ForgotPasswordForm
          labels={{
            email: t("auth.email"),
            submit: t("auth.forgot.submit"),
            success: t("auth.forgot.success"),
            rateLimited: t("auth.forgot.rateLimited"),
            error: t("auth.forgot.error"),
          }}
        />
      </div>

      <p className="mt-6 text-center text-sm text-ink-faint">
        <Link
          href="/login"
          className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
        >
          {t("auth.forgot.backToLogin")}
        </Link>
      </p>
    </div>
  );
}

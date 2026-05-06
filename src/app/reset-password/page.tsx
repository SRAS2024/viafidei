import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const { t } = await getTranslator();
  const token = typeof searchParams.token === "string" ? searchParams.token : "";

  return (
    <div className="mx-auto max-w-md pt-12">
      <div className="text-center">
        <p className="vf-eyebrow">{t("auth.signIn")}</p>
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-4xl">{t("auth.reset.title")}</h1>
        <p className="mx-auto mt-3 max-w-sm font-serif text-ink-soft">{t("auth.reset.subtitle")}</p>
      </div>

      <div className="vf-card mt-10 rounded-sm p-8">
        {token ? (
          <ResetPasswordForm
            token={token}
            labels={{
              newPassword: t("auth.reset.newPassword"),
              confirmPassword: t("auth.reset.confirmPassword"),
              submit: t("auth.reset.submit"),
              successHeading: t("auth.reset.successHeading"),
              backToLogin: t("auth.reset.backToLogin"),
              weakPassword: t("auth.weakPassword"),
              mismatch: t("auth.mismatch"),
              invalidToken: t("auth.reset.invalidToken"),
              expiredToken: t("auth.reset.expiredToken"),
              usedToken: t("auth.reset.usedToken"),
              rateLimited: t("auth.forgot.rateLimited"),
              error: t("auth.forgot.error"),
            }}
          />
        ) : (
          <p role="alert" className="text-center text-sm" style={{ color: "#8b1a1a" }}>
            {t("auth.reset.missingToken")}
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-ink-faint">
        <Link
          href="/forgot-password"
          className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
        >
          {t("auth.forgot.title")}
        </Link>
      </p>
    </div>
  );
}

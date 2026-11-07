import Link from "next/link";
import { AccountPage } from "@/components/profile/AccountPage";
import { getTranslator } from "@/lib/i18n/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Reset password" };

/**
 * What to say when a plain post of the form comes back refused. A Map because the code
 * comes from the URL: on a plain object "constructor" and its like would find inherited
 * members.
 */
const FAILURE_KEY: ReadonlyMap<unknown, string> = new Map([
  ["weak", "auth.weakPassword"],
  ["mismatch", "auth.mismatch"],
  ["not_found", "auth.reset.invalidToken"],
  ["expired", "auth.reset.expiredToken"],
  ["used", "auth.reset.usedToken"],
  ["rate_limited", "auth.forgot.rateLimitedFallback"],
]);

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string | string[] }>;
}) {
  const { t } = await getTranslator();
  const { token: rawToken, error } = await searchParams;
  const token = typeof rawToken === "string" ? rawToken : "";

  return (
    <AccountPage
      title={t("auth.reset.title")}
      subtitle={t("auth.reset.subtitle")}
      links={
        <Link href="/forgot-password" className="vf-link-action">
          {t("auth.forgot.title")}
        </Link>
      }
    >
      {token ? (
        <ResetPasswordForm
          token={token}
          failure={error ? t(FAILURE_KEY.get(error) ?? "auth.forgot.error") : undefined}
          labels={{
            newPassword: t("auth.reset.newPassword"),
            confirmPassword: t("auth.reset.confirmPassword"),
            submit: t("auth.reset.submit"),
            successHeading: t("auth.reset.successHeading"),
            backToLogin: t("auth.reset.backToLogin"),
            show: t("auth.showPassword"),
            hide: t("auth.hidePassword"),
            weakPassword: t("auth.weakPassword"),
            mismatch: t("auth.mismatch"),
            invalidToken: t("auth.reset.invalidToken"),
            expiredToken: t("auth.reset.expiredToken"),
            usedToken: t("auth.reset.usedToken"),
            rateLimited: t("auth.forgot.rateLimitedFallback"),
            error: t("auth.forgot.error"),
          }}
        />
      ) : (
        <p role="alert" className="vf-notice vf-notice-error">
          {t("auth.reset.missingToken")}
        </p>
      )}
    </AccountPage>
  );
}

import Link from "next/link";
import { AccountPage } from "@/components/profile/AccountPage";
import { getTranslator } from "@/lib/i18n/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { t } = await getTranslator();
  const { token: rawToken } = await searchParams;
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
            rateLimited: t("auth.forgot.rateLimited"),
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

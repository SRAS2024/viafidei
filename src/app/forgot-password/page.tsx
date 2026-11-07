import Link from "next/link";
import { AccountPage } from "@/components/profile/AccountPage";
import { getTranslator } from "@/lib/i18n/server";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  const { t } = await getTranslator();
  return (
    <AccountPage
      title={t("auth.forgot.title")}
      subtitle={t("auth.forgot.subtitle")}
      links={
        <Link href="/login" className="vf-link-action">
          {t("auth.forgot.backToLogin")}
        </Link>
      }
    >
      <ForgotPasswordForm
        labels={{
          email: t("auth.email"),
          submit: t("auth.forgot.submit"),
          success: t("auth.forgot.success"),
          notFound: t("auth.forgot.notFound"),
          rateLimited: t("auth.forgot.rateLimited"),
          rateLimitedFallback: t("auth.forgot.rateLimitedFallback"),
          deliveryFailed: t("auth.forgot.deliveryFailed"),
          error: t("auth.forgot.error"),
        }}
      />
    </AccountPage>
  );
}

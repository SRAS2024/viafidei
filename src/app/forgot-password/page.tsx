import Link from "next/link";
import { AccountPage } from "@/components/profile/AccountPage";
import { readKeptFields } from "@/lib/auth/form-flash";
import { getTranslator } from "@/lib/i18n/server";
import { ForgotPasswordForm, type ForgotPasswordOutcome } from "./ForgotPasswordForm";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string | string[]; error?: string | string[] }>;
}) {
  const { t } = await getTranslator();
  const { sent, error } = await searchParams;
  // A form pressed before its script has run comes back here with its answer. The address
  // comes in a cookie, not the URL, and with no address there is nothing to confirm.
  const kept = sent || error ? await readKeptFields() : {};
  const outcome: ForgotPasswordOutcome | undefined =
    sent === "1" && kept.email
      ? { kind: "ok", email: kept.email }
      : error === "rate_limited"
        ? { kind: "rate_limited", retryAfterSeconds: null }
        : error === "invalid"
          ? { kind: "invalid_address" }
          : error
            ? { kind: "error" }
            : undefined;
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
        outcome={outcome}
        email={kept.email}
        labels={{
          email: t("auth.email"),
          submit: t("auth.forgot.submit"),
          success: t("auth.forgot.success"),
          notFound: t("auth.forgot.notFound"),
          rateLimited: t("auth.forgot.rateLimited"),
          rateLimitedFallback: t("auth.forgot.rateLimitedFallback"),
          deliveryFailed: t("auth.forgot.deliveryFailed"),
          invalidAddress: t("auth.forgot.invalidAddress"),
          error: t("auth.forgot.error"),
        }}
      />
    </AccountPage>
  );
}

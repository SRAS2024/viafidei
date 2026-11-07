import Link from "next/link";
import { AccountPage } from "@/components/profile/AccountPage";
import { getTranslator } from "@/lib/i18n/server";
import { VerifyEmailClient } from "./VerifyEmailClient";

export const metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { t } = await getTranslator();
  const { token: rawToken } = await searchParams;
  const token = typeof rawToken === "string" ? rawToken : "";

  return (
    <AccountPage
      title={t("auth.verify.title")}
      links={
        <Link href="/profile" className="vf-link-action">
          {t("nav.profile")}
        </Link>
      }
    >
      {token ? (
        <VerifyEmailClient
          token={token}
          labels={{
            checking: t("auth.verify.checking"),
            success: t("auth.verify.success"),
            invalid: t("auth.verify.invalidToken"),
            expired: t("auth.verify.expiredToken"),
            used: t("auth.verify.usedToken"),
            rateLimited: t("auth.error.rateLimited"),
            error: t("auth.error.generic"),
          }}
        />
      ) : (
        <p role="alert" className="vf-notice vf-notice-error">
          {t("auth.verify.missingToken")}
        </p>
      )}
    </AccountPage>
  );
}

import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { VerifyEmailClient } from "./VerifyEmailClient";

export const metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const { t } = await getTranslator();
  const token = typeof searchParams.token === "string" ? searchParams.token : "";

  return (
    <div className="mx-auto max-w-md pt-12">
      <div className="text-center">
        <p className="vf-eyebrow">{t("nav.profile")}</p>
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-4xl">{t("auth.verify.title")}</h1>
      </div>

      <div className="vf-card mt-10 rounded-sm p-8">
        {token ? (
          <VerifyEmailClient
            token={token}
            labels={{
              checking: t("auth.verify.checking"),
              success: t("auth.verify.success"),
              invalid: t("auth.verify.invalidToken"),
              expired: t("auth.verify.expiredToken"),
              used: t("auth.verify.usedToken"),
            }}
          />
        ) : (
          <p role="alert" className="text-center text-sm" style={{ color: "#8b1a1a" }}>
            {t("auth.verify.missingToken")}
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-ink-faint">
        <Link
          href="/profile"
          className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
        >
          {t("nav.profile")}
        </Link>
      </p>
    </div>
  );
}

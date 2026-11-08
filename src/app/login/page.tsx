import Link from "next/link";
import { AccountPage } from "@/components/profile/AccountPage";
import { readKeptFields } from "@/lib/auth/form-flash";
import { safeNextPath } from "@/lib/auth/safe-next";
import { getTranslator } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    next?: string | string[];
    notice?: string;
    registered?: string;
  }>;
}) {
  const { t } = await getTranslator();
  const sp = await searchParams;
  // A value that could leave the site never reaches the form or its links.
  const next = safeNextPath(sp.next) ?? undefined;
  const failed = sp.error === "invalid" || sp.error === "rate_limited";
  const kept = failed ? await readKeptFields() : {};
  return (
    <AccountPage
      title={t("auth.signIn")}
      subtitle={t("auth.signInSubtitle")}
      links={
        <>
          <Link href="/forgot-password" className="vf-link-action">
            {t("auth.forgot")}
          </Link>
          {/* The page a gated control sent the visitor from comes along, so
              creating an account lands them back on it too. */}
          <Link
            href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
            className="vf-link-action"
          >
            {t("auth.toRegister")}
          </Link>
        </>
      }
      note={t("auth.adminNotice")}
    >
      {sp.notice === "password_reset" ? (
        <p role="status" className="vf-notice mb-4">
          {t("auth.login.passwordReset")}
        </p>
      ) : null}
      {sp.registered === "1" ? (
        <p role="status" className="vf-notice mb-4">
          {t("auth.login.registered")}
        </p>
      ) : null}
      <LoginForm
        labels={{
          email: t("auth.email"),
          password: t("auth.password"),
          submit: t("auth.submitLogin"),
          show: t("auth.showPassword"),
          hide: t("auth.hidePassword"),
        }}
        next={next}
        email={kept.email}
        error={
          sp.error === "rate_limited"
            ? t("auth.error.rateLimited")
            : failed
              ? t("auth.invalid")
              : undefined
        }
      />
    </AccountPage>
  );
}

import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: { error?: string } }) {
  const { t } = await getTranslator();

  const errorMessage =
    searchParams.error === "mismatch"
      ? t("auth.mismatch")
      : searchParams.error === "weak"
        ? t("auth.weakPassword")
        : searchParams.error === "exists"
          ? t("auth.error.exists")
          : searchParams.error === "rate_limited"
            ? t("auth.error.rateLimited")
            : searchParams.error === "server"
              ? t("auth.error.generic")
              : searchParams.error
                ? t("auth.error.generic")
                : null;

  return (
    <div className="mx-auto max-w-md pt-12">
      <div className="text-center">
        <p className="vf-eyebrow">{t("nav.register")}</p>
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-4xl">{t("auth.register")}</h1>
        <p className="mx-auto mt-3 max-w-sm font-serif text-ink-soft">
          {t("auth.registerSubtitle")}
        </p>
      </div>

      <div className="vf-card mt-10 rounded-sm p-8">
        <RegisterForm
          labels={{
            firstName: t("auth.firstName"),
            lastName: t("auth.lastName"),
            email: t("auth.email"),
            password: t("auth.password"),
            passwordConfirm: t("auth.passwordConfirm"),
            passwordRequirements: t("auth.passwordRequirements"),
            submit: t("auth.submitRegister"),
            show: t("auth.showPassword"),
            hide: t("auth.hidePassword"),
            weakPassword: t("auth.weakPassword"),
            mismatch: t("auth.mismatch"),
            privacyBefore: t("auth.privacyNotice.before"),
            privacyLink: t("auth.privacyNotice.linkText"),
            privacyAfter: t("auth.privacyNotice.after"),
          }}
        />
        {errorMessage ? (
          <p role="alert" className="mt-4 text-center text-sm" style={{ color: "#8b1a1a" }}>
            {errorMessage}
          </p>
        ) : null}
      </div>

      <p className="mt-6 text-center text-sm text-ink-faint">
        <Link
          href="/login"
          className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
        >
          {t("auth.toLogin")}
        </Link>
      </p>
    </div>
  );
}

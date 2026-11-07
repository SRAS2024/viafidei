import Link from "next/link";
import { AccountPage } from "@/components/profile/AccountPage";
import { getTranslator } from "@/lib/i18n/server";
import { RegisterForm, type RegisterErrorField } from "./RegisterForm";

export const metadata = { title: "Create account" };

/** Which field a failure from the server belongs to, so it can be tied to it. */
const ERROR_FIELD: Readonly<Record<string, RegisterErrorField>> = {
  exists: "email",
  weak: "password",
  mismatch: "passwordConfirm",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { t } = await getTranslator();
  const { error, next } = await searchParams;

  const errorMessage =
    error === "mismatch"
      ? t("auth.mismatch")
      : error === "weak"
        ? t("auth.weakPassword")
        : error === "exists"
          ? t("auth.error.exists")
          : error === "rate_limited"
            ? t("auth.error.rateLimited")
            : error === "server"
              ? t("auth.error.generic")
              : error
                ? t("auth.error.generic")
                : null;

  return (
    <AccountPage
      title={t("auth.register")}
      subtitle={t("auth.registerSubtitle")}
      links={
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="vf-link-action"
        >
          {t("auth.toLogin")}
        </Link>
      }
    >
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
        next={next}
        error={errorMessage}
        errorField={error ? ERROR_FIELD[error] : undefined}
      />
    </AccountPage>
  );
}

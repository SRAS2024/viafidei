import Link from "next/link";
import { AccountPage } from "@/components/profile/AccountPage";
import { readKeptFields } from "@/lib/auth/form-flash";
import { safeNextPath } from "@/lib/auth/safe-next";
import { getTranslator } from "@/lib/i18n/server";
import { RegisterForm, type RegisterErrorField } from "./RegisterForm";

export const metadata = { title: "Create account" };

/**
 * Which field a failure from the server belongs to, so it can be tied to it. A Map
 * because the code comes from the URL: on a plain object "constructor" and its like
 * would find inherited members, and a function cannot be handed to a client component.
 */
const ERROR_FIELD: ReadonlyMap<unknown, RegisterErrorField> = new Map([
  ["exists", "email"],
  ["weak", "password"],
  ["mismatch", "passwordConfirm"],
]);

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>;
}) {
  const { t } = await getTranslator();
  const { error, next: rawNext } = await searchParams;
  // A value that could leave the site never reaches the form or its links.
  const next = safeNextPath(rawNext) ?? undefined;
  const kept = error ? await readKeptFields() : {};

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
        values={kept}
        error={errorMessage}
        errorField={ERROR_FIELD.get(error)}
      />
    </AccountPage>
  );
}

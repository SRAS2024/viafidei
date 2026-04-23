import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const { t } = await getTranslator();
  return (
    <div className="mx-auto max-w-md pt-12">
      <div className="text-center">
        <p className="vf-eyebrow">{t("nav.login")}</p>
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-4xl">{t("auth.signIn")}</h1>
        <p className="mx-auto mt-3 max-w-sm font-serif text-ink-soft">
          {t("auth.signInSubtitle")}
        </p>
      </div>

      <div className="vf-card mt-10 rounded-sm p-8">
        <LoginForm
          labels={{
            email: t("auth.email"),
            password: t("auth.password"),
            submit: t("auth.submitLogin"),
            forgot: t("auth.forgot"),
            show: t("auth.showPassword"),
            hide: t("auth.hidePassword"),
          }}
          next={searchParams.next}
        />
        {searchParams.error === "invalid" ? (
          <p className="mt-4 text-center text-sm text-liturgical-red" style={{ color: "#8b1a1a" }}>
            {t("auth.invalid")}
          </p>
        ) : null}
      </div>

      <p className="mt-6 text-center text-sm text-ink-faint">
        <Link href="/register" className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
          {t("auth.toRegister")}
        </Link>
      </p>

      <p className="mt-8 text-center font-serif text-xs italic text-ink-faint">
        {t("auth.adminNotice")}
      </p>
    </div>
  );
}

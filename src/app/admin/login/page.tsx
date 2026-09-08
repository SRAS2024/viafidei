import { redirect } from "next/navigation";
import { getTranslator } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { getPendingAdminSession } from "@/lib/auth/admin-session";
import { AdminLoginForm } from "./AdminLoginForm";
import { AdminTwoFactorForm } from "./AdminTwoFactorForm";

/**
 * The interactive admin sign-in, now in two stages (security spec item 1).
 *
 * Which stage the page renders is decided by the SERVER — a pending
 * `AdminSession` row means the password was accepted and the second factor is
 * outstanding. It is never decided by the query string, so no one can reach
 * the code form (or skip it) by editing a URL. A pending session carries no
 * authority whatsoever until /api/auth/admin-2fa/verify promotes it.
 */
export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; stage?: string; notice?: string }>;
}) {
  const existing = await requireAdmin();
  if (existing) redirect("/admin?welcome=1");
  const { t } = await getTranslator();
  const { error, notice } = await searchParams;
  const pending = await getPendingAdminSession();

  return (
    <div className="mx-auto max-w-md pt-6">
      <div className="text-center">
        <h1 className="font-display text-4xl text-ink">{t("admin.login.title")}</h1>
        <p className="mx-auto mt-4 max-w-sm font-serif text-ink-soft">
          {pending
            ? "A six-digit code has been sent to the administrator address. It is valid for five minutes and can be used once."
            : t("admin.login.subtitle")}
        </p>
      </div>

      <div className="vf-card mt-10 rounded-sm p-8">
        {pending ? (
          <AdminTwoFactorForm />
        ) : (
          <AdminLoginForm
            labels={{
              username: t("admin.login.username"),
              password: t("admin.login.password"),
              submit: t("admin.login.submit"),
              show: t("auth.showPassword"),
              hide: t("auth.hidePassword"),
            }}
          />
        )}
        {/* One generic refusal for every way a code can fail — wrong, expired,
            already used, superseded, out of attempts. Naming the cause would
            tell an attacker holding a pending session which control fired. */}
        {pending && error === "code" ? (
          <p className="mt-4 text-center text-sm" style={{ color: "#8b1a1a" }}>
            That code is not valid.
          </p>
        ) : null}
        {pending && notice === "undelivered" ? (
          <p className="mt-4 text-center text-sm" style={{ color: "#8b1a1a" }}>
            The code could not be delivered. Check the administrator email configuration.
          </p>
        ) : null}
        {pending && notice === "sent" ? (
          <p className="mt-4 text-center text-sm text-ink-soft">
            A new code has been sent. Any earlier code no longer works.
          </p>
        ) : null}
        {!pending && error === "invalid" ? (
          <p className="mt-4 text-center text-sm" style={{ color: "#8b1a1a" }}>
            {t("admin.login.invalid")}
          </p>
        ) : null}
      </div>

      <p className="mt-6 text-center text-xs italic text-ink-faint">
        {t("admin.login.userRedirect")}
      </p>
    </div>
  );
}

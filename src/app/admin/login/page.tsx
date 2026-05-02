import { redirect } from "next/navigation";
import { getTranslator } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { AdminLoginForm } from "./AdminLoginForm";

export default async function AdminLogin({ searchParams }: { searchParams: { error?: string } }) {
  const existing = await requireAdmin();
  if (existing) redirect("/admin?welcome=1");
  const { t } = await getTranslator();

  return (
    <div className="mx-auto max-w-md pt-6">
      <div className="text-center">
        <h1 className="font-display text-4xl text-ink">{t("admin.login.title")}</h1>
        <p className="mx-auto mt-4 max-w-sm font-serif text-ink-soft">
          {t("admin.login.subtitle")}
        </p>
      </div>

      <div className="vf-card mt-10 rounded-sm p-8">
        <AdminLoginForm
          labels={{
            username: t("admin.login.username"),
            password: t("admin.login.password"),
            submit: t("admin.login.submit"),
            show: t("auth.showPassword"),
            hide: t("auth.hidePassword"),
          }}
        />
        {searchParams.error === "invalid" ? (
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

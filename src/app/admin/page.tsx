import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getTranslator } from "@/lib/i18n/server";
import { AdminWelcomeGate } from "./AdminWelcomeGate";
import { AdminDashboard } from "./AdminDashboard";

export default async function AdminHome({ searchParams }: { searchParams: { welcome?: string } }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const { t, locale } = await getTranslator();

  const dashboard = <AdminDashboard t={t} />;

  if (searchParams.welcome === "1") {
    return (
      <AdminWelcomeGate
        greeting={t("admin.loading.greeting")}
        locale={locale}
        loadingLabel={t("common.loading")}
      >
        {dashboard}
      </AdminWelcomeGate>
    );
  }

  return dashboard;
}

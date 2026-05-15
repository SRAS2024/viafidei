import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getTranslator } from "@/lib/i18n/server";
import { AdminWelcomeGate } from "./AdminWelcomeGate";
import { AdminDashboard } from "./AdminDashboard";

// The dashboard renders an email-not-configured banner that depends on
// `process.env.RESEND_API_KEY`. Without `force-dynamic`, Next.js could
// render the page once at build time (when the env var has whatever
// value the build runner had) and serve that snapshot indefinitely —
// hiding the banner even after the operator sets the key.
export const dynamic = "force-dynamic";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const { t, locale } = await getTranslator();
  const { welcome } = await searchParams;

  const dashboard = <AdminDashboard t={t} />;

  if (welcome === "1") {
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

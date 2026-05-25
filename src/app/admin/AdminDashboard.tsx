import type { Translator } from "@/lib/i18n/translator";
import { DashboardHeader, DashboardCardGrid, DashboardSignOut } from "./_dashboard";
import { EmailNotConfiguredBanner } from "./_dashboard/EmailNotConfiguredBanner";
import { AdminWorkerStatusBanner } from "./_dashboard/AdminWorkerStatusBanner";

export async function AdminDashboard({ t }: { t: Translator }) {
  return (
    <div>
      <DashboardHeader t={t} />
      <EmailNotConfiguredBanner />
      <AdminWorkerStatusBanner />
      <DashboardCardGrid t={t} />
      <DashboardSignOut t={t} />
    </div>
  );
}

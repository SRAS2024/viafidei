import type { Translator } from "@/lib/i18n/translator";
import { DashboardHeader, DashboardCardGrid, DashboardSignOut } from "./_dashboard";
import { EmailNotConfiguredBanner } from "./_dashboard/EmailNotConfiguredBanner";
import { IngestionStatusBanner } from "./_dashboard/IngestionStatusBanner";

export async function AdminDashboard({ t }: { t: Translator }) {
  return (
    <div>
      <DashboardHeader t={t} />
      <EmailNotConfiguredBanner />
      <IngestionStatusBanner />
      <DashboardCardGrid t={t} />
      <DashboardSignOut t={t} />
    </div>
  );
}

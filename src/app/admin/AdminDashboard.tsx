import type { Translator } from "@/lib/i18n/translator";
import {
  DashboardHeader,
  DashboardCardGrid,
  DashboardSignOut,
} from "./_dashboard";

export function AdminDashboard({ t }: { t: Translator }) {
  return (
    <div>
      <DashboardHeader t={t} />
      <DashboardCardGrid t={t} />
      <DashboardSignOut t={t} />
    </div>
  );
}

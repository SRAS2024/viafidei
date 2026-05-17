import type { Metadata } from "next";
import "../globals.css";
import { getLocale, getTranslator } from "@/lib/i18n/server";
import { SecurityTamperDetector } from "@/components/SecurityTamperDetector";
import { isCurrentDeviceBanned } from "@/lib/security/banned-guard";

export const metadata: Metadata = {
  title: "Administrator · Via Fidei",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Banned-device gate at the admin boundary. A banned device cannot
  // see any admin page — the layout short-circuits before any nested
  // server component runs, and there is no admin UI to lift the ban.
  if (await isCurrentDeviceBanned()) {
    return (
      <div lang="en" data-admin-banned className="min-h-screen">
        <main
          className="mx-auto max-w-2xl px-6 pt-32 pb-20 text-center"
          data-testid="admin-banned-block"
        >
          <h1 className="font-display text-4xl text-ink">Access denied</h1>
          <p className="mt-4 font-serif text-ink-soft">
            This device has been banned by a Security Breach response. Bans are permanent.
          </p>
        </main>
      </div>
    );
  }

  const locale = await getLocale();
  const { t } = await getTranslator();
  return (
    <div lang={locale} data-admin-surface className="min-h-screen">
      <SecurityTamperDetector />
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-10 pb-6">
        <span className="vf-wordmark text-[1.1rem] text-ink">{t("admin.brand")}</span>
        <div className="vf-rule mt-5" />
      </div>
      <main className="mx-auto max-w-5xl px-6 pb-20">{children}</main>
    </div>
  );
}

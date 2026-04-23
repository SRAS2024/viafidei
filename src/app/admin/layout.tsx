import type { Metadata } from "next";
import "../globals.css";
import { getLocale, getTranslator } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Administrator · Via Fidei",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const { t } = await getTranslator();
  return (
    <div lang={locale} data-admin-surface className="min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-10 pb-6">
        <span className="vf-wordmark text-[1.1rem] text-ink">{t("admin.brand")}</span>
        <div className="vf-rule mt-5" />
      </div>
      <main className="mx-auto max-w-5xl px-6 pb-20">{children}</main>
    </div>
  );
}

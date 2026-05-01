import type { Translator } from "@/lib/i18n/translator";

export function DashboardHeader({ t }: { t: Translator }) {
  return (
    <section className="text-center">
      <h1 className="font-display text-5xl text-ink">{t("admin.dashboard.title")}</h1>
      <p className="mx-auto mt-4 max-w-reading font-serif text-lg text-ink-soft">
        {t("admin.dashboard.subtitle")}
      </p>
      <p className="mt-3 text-xs italic text-ink-faint">{t("admin.welcomeLine")}</p>
    </section>
  );
}

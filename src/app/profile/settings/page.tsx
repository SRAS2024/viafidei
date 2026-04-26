import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/PageHero";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@/lib/i18n/locales";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile/settings");
  const { t } = await getTranslator();

  return (
    <div>
      <div className="mb-4">
        <Link href="/profile" className="vf-nav-link">← {t("common.back")}</Link>
      </div>
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.settings")} />
      <form
        method="post"
        action="/api/settings/locale"
        className="vf-card mx-auto max-w-md rounded-sm p-6"
      >
        <label className="vf-label" htmlFor="locale">
          {t("profile.settings.language")}
        </label>
        <select id="locale" name="locale" className="vf-input">
          <option value="">{t("common.languageAuto")}</option>
          {SUPPORTED_LOCALES.map((loc) => (
            <option key={loc} value={loc}>
              {LOCALE_LABELS[loc]}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-ink-faint">
          {t("profile.settings.languageHint")}
        </p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <Link href="/profile" className="vf-btn vf-btn-cancel">
            {t("common.cancel")}
          </Link>
          <button type="submit" className="vf-btn vf-btn-primary">
            {t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}

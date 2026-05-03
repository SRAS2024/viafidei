import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { getProfileForUser } from "@/lib/data/profile";
import { CATHOLIC_RITES, RITE_LABEL_KEYS } from "@/lib/content/rites";
import { getRiteCookieValue } from "@/lib/i18n/rite-cookie";
import { ThemeAppearancePicker } from "./ThemeAppearancePicker";
import { RitePicker } from "./RitePicker";

export default async function SettingsPage() {
  // Settings is signed-in only — anonymous visitors are bounced to login.
  const user = await requireUser();
  if (!user) redirect("/login?next=/profile/settings");
  const { t } = await getTranslator();

  const profile = await getProfileForUser(user.id);
  const initialTheme =
    profile?.theme === "dark" || profile?.theme === "light" ? profile.theme : null;
  const initialRite = await getRiteCookieValue();

  return (
    <div>
      <div className="mb-4">
        <Link href="/profile" className="vf-nav-link">
          ← {t("common.back")}
        </Link>
      </div>
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.settings")} />

      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {/* Profile section */}
        <section className="vf-card rounded-sm p-6">
          <h2 className="font-display text-2xl">{t("profile.settings.section.profile")}</h2>
          <p className="mt-2 font-serif text-sm text-ink-soft">
            {t("profile.settings.section.profile.body")}
          </p>
          <div className="mt-4">
            <Link href="/profile" className="vf-btn vf-btn-ghost">
              {t("profile.settings.openProfile")}
            </Link>
          </div>
        </section>

        {/* Language section */}
        <section className="vf-card rounded-sm p-6">
          <h2 className="font-display text-2xl">{t("profile.settings.section.language")}</h2>
          <form method="post" action="/api/settings/locale" className="mt-4">
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
            <p className="mt-2 text-xs text-ink-faint">{t("profile.settings.languageHint")}</p>
            <div className="mt-4 flex justify-end">
              <button type="submit" className="vf-btn vf-btn-primary">
                {t("common.save")}
              </button>
            </div>
          </form>
        </section>

        {/* Appearance section */}
        <section className="vf-card rounded-sm p-6">
          <h2 className="font-display text-2xl">{t("profile.settings.section.appearance")}</h2>
          <p className="mt-2 font-serif text-sm text-ink-soft">
            {t("profile.settings.section.appearance.body")}
          </p>
          <div className="mt-4">
            <ThemeAppearancePicker
              initialTheme={initialTheme}
              labels={{
                light: t("profile.settings.appearance.light"),
                dark: t("profile.settings.appearance.dark"),
                heading: t("profile.settings.theme"),
              }}
            />
          </div>
        </section>

        {/* Catholic rite section */}
        <section className="vf-card rounded-sm p-6">
          <h2 className="font-display text-2xl">{t("rite.label")}</h2>
          <p className="mt-2 font-serif text-sm text-ink-soft">{t("rite.help")}</p>
          <div className="mt-4">
            <RitePicker
              initialRite={initialRite}
              options={CATHOLIC_RITES.map((value) => ({
                value,
                label: t(RITE_LABEL_KEYS[value]),
              }))}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

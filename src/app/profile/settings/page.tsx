import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/server";
import { ProfileBackLink } from "@/components/profile/ProfileBackLink";
import { PageHero } from "@/components/ui/PageHero";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/cookie";
import { LOCALE_LABELS, SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/locales";
import { CATHOLIC_RITES, RITE_LABEL_KEYS } from "@/lib/content-shared/rites";
import { getRiteCookieValue } from "@/lib/i18n/rite-cookie";
import { getThemeCookieValue } from "@/lib/i18n/theme-cookie";
import { ThemeAppearancePicker } from "./ThemeAppearancePicker";
import { RitePicker } from "./RitePicker";
import { UnverifiedEmailNotice } from "@/components/profile/UnverifiedEmailNotice";
import { logPageError } from "@/lib/observability/page-errors";

// Reads the auth session (cookies), so it can never be statically prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("profile.tab.settings") };
}

export default async function SettingsPage() {
  // Settings is signed-in only — anonymous visitors are bounced to login.
  let user: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    user = await requireUser();
  } catch (err) {
    logPageError({ route: "/profile/settings", entityType: "User", error: err });
  }
  if (!user) redirect("/login?next=/profile/settings");
  const { t } = await getTranslator();

  // The theme in effect right now, which is what the two buttons must show as
  // chosen: the cookie first, as the page itself renders by it, then the profile.
  const initialTheme = await getThemeCookieValue();
  const initialRite = await getRiteCookieValue();
  // The language the reader chose, or none: "Automatic" is a real choice, and the
  // menu has to show which of them is in effect.
  const chosenLocale = (await cookies()).get(LOCALE_COOKIE_NAME)?.value ?? "";
  const initialLocale = isSupportedLocale(chosenLocale) ? chosenLocale : "";

  return (
    <div className="vf-column">
      <ProfileBackLink label={t("common.back")} />
      <PageHero eyebrow={t("profile.title")} title={t("profile.tab.settings")} />

      <div className="vf-panel-list">
        {!user.emailVerifiedAt ? (
          <UnverifiedEmailNotice
            labels={{
              notice: t("auth.verify.unverifiedNotice"),
              resend: t("auth.verify.resend"),
              sent: t("auth.verify.resendSent"),
              rateLimited: t("auth.verify.resendRateLimited"),
              deliveryFailed: t("auth.verify.resendDeliveryFailed"),
              error: t("auth.verify.resendError"),
            }}
          />
        ) : null}
        {/* Profile section */}
        <section className="vf-panel">
          <h2 className="vf-subhead">{t("profile.settings.section.profile")}</h2>
          <p className="vf-panel-text mt-0">{t("profile.settings.section.profile.body")}</p>
          <div className="vf-panel-actions">
            <Link href="/profile" className="vf-btn vf-btn-sm vf-btn-ghost">
              {t("profile.settings.openProfile")}
            </Link>
          </div>
        </section>

        {/* Language section */}
        <section className="vf-panel">
          <h2 className="vf-subhead">{t("profile.settings.section.language")}</h2>
          <form method="post" action="/api/settings/locale">
            <label className="vf-label" htmlFor="locale">
              {t("profile.settings.language")}
            </label>
            <select
              id="locale"
              name="locale"
              className="vf-input"
              defaultValue={initialLocale}
              aria-describedby="locale-hint"
            >
              <option value="">{t("common.languageAuto")}</option>
              {SUPPORTED_LOCALES.map((loc) => (
                <option key={loc} value={loc}>
                  {LOCALE_LABELS[loc]}
                </option>
              ))}
            </select>
            <p id="locale-hint" className="vf-fineprint mt-1.5">
              {t("profile.settings.languageHint")}
            </p>
            <div className="vf-panel-actions">
              <button type="submit" className="vf-btn vf-btn-sm vf-btn-primary">
                {t("common.save")}
              </button>
            </div>
          </form>
        </section>

        {/* Appearance section */}
        <section className="vf-panel">
          <h2 className="vf-subhead">{t("profile.settings.section.appearance")}</h2>
          <p className="vf-panel-text mt-0">{t("profile.settings.section.appearance.body")}</p>
          <div className="mt-3">
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
        <section className="vf-panel">
          <h2 className="vf-subhead">{t("rite.label")}</h2>
          <p className="vf-panel-text mt-0">{t("rite.help")}</p>
          <div className="mt-3">
            <RitePicker
              initialRite={initialRite}
              label={t("rite.label")}
              savedLabel={t("common.savedItem")}
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

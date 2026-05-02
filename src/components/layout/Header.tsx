import { getTranslator } from "@/lib/i18n/server";
import { getSession } from "@/lib/auth/session";
import { HeaderBrand } from "./HeaderBrand";
import { HeaderNav } from "./HeaderNav";
import { HeaderSearch } from "./HeaderSearch";
import { HeaderUserMenu } from "./HeaderUserMenu";

export async function Header() {
  const { t, locale } = await getTranslator();
  const session = await getSession();
  const isAuthedUser = session.role === "USER" && !!session.userId;

  return (
    <header className="w-full border-b border-ink/10 bg-paper/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-8 pb-5 sm:px-6 sm:pt-10 sm:pb-6">
        <HeaderBrand brandName={t("brand.name")} tagline={t("brand.tagline")} locale={locale} />
        <div className="vf-rule my-5 sm:my-6" aria-hidden="true" />
        <HeaderNav t={t} />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-ink/10 px-4 py-3 text-xs sm:flex-row sm:px-6">
        <HeaderSearch placeholder={t("search.placeholder")} ariaLabel={t("nav.search")} />
        {isAuthedUser ? (
          <HeaderUserMenu
            isAuthed
            labels={{ profile: t("nav.profile"), logout: t("nav.logout") }}
          />
        ) : (
          <HeaderUserMenu
            isAuthed={false}
            labels={{ login: t("nav.login"), register: t("nav.register") }}
          />
        )}
      </div>
    </header>
  );
}

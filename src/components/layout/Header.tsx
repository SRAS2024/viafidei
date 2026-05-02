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
    <header className="sticky top-0 z-40 w-full border-b border-ink/10 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-4 pb-3 sm:flex-nowrap sm:px-6 sm:pt-5 sm:pb-4">
        <HeaderBrand brandName={t("brand.name")} locale={locale} />
        <div className="flex items-center gap-3 text-xs sm:gap-6">
          <div className="hidden sm:block">
            <HeaderSearch placeholder={t("search.placeholder")} ariaLabel={t("nav.search")} />
          </div>
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
      </div>

      <div className="border-t border-ink/10">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <HeaderNav t={t} />
        </div>
      </div>

      <div className="border-t border-ink/10 sm:hidden">
        <div className="mx-auto max-w-6xl px-4 py-2.5">
          <HeaderSearch placeholder={t("search.placeholder")} ariaLabel={t("nav.search")} />
        </div>
      </div>
    </header>
  );
}

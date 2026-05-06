import { getTranslator } from "@/lib/i18n/server";
import { getSession } from "@/lib/auth/session";
import { logger } from "@/lib/observability";
import { getProfileForUser } from "@/lib/data/profile";
import { logoutAction } from "@/app/_actions/auth";
import { HeaderBrand } from "./HeaderBrand";
import { HeaderNav, PRIMARY_NAV } from "./HeaderNav";
import { HeaderSearch } from "./HeaderSearch";
import { HeaderUserMenu } from "./HeaderUserMenu";
import { HeaderMobileMenu } from "./HeaderMobileMenu";

type AuthState = { isAuthed: boolean; userId: string | null };

async function readAuthState(): Promise<AuthState> {
  try {
    const session = await getSession();
    const isAuthed = session.role === "USER" && !!session.userId;
    return { isAuthed, userId: isAuthed ? (session.userId ?? null) : null };
  } catch (error: unknown) {
    // iron-session throws when SESSION_SECRET rotates or a cookie is malformed.
    // The header must still render so navigation never disappears mid-session.
    logger.warn("header.session.read_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { isAuthed: false, userId: null };
  }
}

async function readAvatarSrc(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const profile = await getProfileForUser(userId);
    return profile?.avatarMedia?.url ?? null;
  } catch (error: unknown) {
    logger.warn("header.avatar.read_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function Header() {
  const { t, locale } = await getTranslator();
  const { isAuthed, userId } = await readAuthState();
  const avatarSrc = await readAvatarSrc(userId);

  const navItems = PRIMARY_NAV.map((item) => ({ href: item.href, label: t(item.key) }));
  const signInItem = isAuthed ? null : { href: "/login", label: t("nav.login") };
  const authedActions = isAuthed
    ? [
        { type: "link" as const, href: "/profile", label: t("nav.profile") },
        // Sign-out goes through a Server Action (not a POST to a route
        // handler) so the Next.js Router Cache is invalidated as part of
        // the redirect — without this, the previously-cached "signed in"
        // Header keeps rendering until the user hard-refreshes.
        { type: "form-button" as const, action: logoutAction, label: t("nav.logout") },
      ]
    : undefined;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-ink/10 bg-paper/85 backdrop-blur-md">
      {/* MOBILE — single bar with brand on the left and hamburger on the right */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-3 pb-3 sm:hidden">
        <HeaderBrand brandName={t("brand.name")} locale={locale} />
        <HeaderMobileMenu
          navItems={navItems}
          signInItem={signInItem}
          authedActions={authedActions}
          openLabel={t("nav.menu.open")}
          closeLabel={t("nav.menu.close")}
          showSettings={isAuthed}
          settingsLabel={t("nav.settings")}
        />
      </div>

      {/* DESKTOP / TABLET — centered brand at the top */}
      <div className="hidden sm:block">
        <div className="mx-auto flex max-w-6xl items-center justify-center px-6 pt-6 pb-4">
          <HeaderBrand brandName={t("brand.name")} locale={locale} centered />
        </div>

        {/* Tabs row, with sign-in / profile and search on the right */}
        <div className="border-t border-ink/10">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
            <div className="min-w-0 flex-1">
              <HeaderNav t={t} />
            </div>
            <div className="flex shrink-0 items-center gap-4">
              {isAuthed ? (
                <HeaderUserMenu
                  isAuthed
                  labels={{ profile: t("nav.profile"), logout: t("nav.logout") }}
                  avatarSrc={avatarSrc}
                />
              ) : (
                <HeaderUserMenu isAuthed={false} labels={{ login: t("nav.login") }} />
              )}
              <div className="w-56 lg:w-64">
                <HeaderSearch placeholder={t("search.placeholder")} ariaLabel={t("nav.search")} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE — search bar pinned below the header so it remains accessible */}
      <div className="border-t border-ink/10 sm:hidden">
        <div className="mx-auto max-w-6xl px-4 py-2.5">
          <HeaderSearch placeholder={t("search.placeholder")} ariaLabel={t("nav.search")} />
        </div>
      </div>
    </header>
  );
}

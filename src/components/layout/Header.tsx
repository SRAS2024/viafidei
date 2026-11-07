import { getTranslator } from "@/lib/i18n/server";
import { getSession } from "@/lib/auth/session";
import { logger } from "@/lib/observability";
import { getProfileForUser } from "@/lib/data/profile";
import { logoutAction } from "@/app/_actions/auth";
import { HeaderBrand } from "./HeaderBrand";
import { HeaderNav, NAV_GROUPS } from "./HeaderNav";
import { HeaderSearch } from "./HeaderSearch";
import { HeaderSearchSlot } from "./HeaderSearchSlot";
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

  // Mobile menu mirrors the desktop tab structure: top-level tabs, with
  // grouped tabs (Saints, Sacraments, Liturgy, History) carrying their
  // sub-tabs so they expand inline in the 3-line menu.
  const navItems = NAV_GROUPS.map((entry) =>
    entry.kind === "link"
      ? { href: entry.href, label: t(entry.key) }
      : {
          href: entry.href,
          label: t(entry.key),
          items: entry.items.map((sub) => ({ href: sub.href, label: t(sub.key) })),
        },
  );
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
    <header className="sticky top-0 z-40 w-full border-b border-ink/10 bg-paper/90 backdrop-blur-md">
      {/* PHONE / TABLET — one bar: brand on the left, search and menu on the right */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-1.5 sm:px-6 min-[900px]:hidden">
        <HeaderBrand brandName={t("brand.name")} locale={locale} />
        <div className="flex items-center gap-1">
          <HeaderSearchSlot>
            <HeaderSearch
              placeholder={t("search.placeholder")}
              ariaLabel={t("nav.search")}
              variant="panel"
            />
          </HeaderSearchSlot>
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
      </div>

      {/* DESKTOP — centred masthead, with the account and search controls at its
          right edge so the tabs below never move between pages. The account link
          keeps its place on the homepage, where no search sits beside it. */}
      <div className="hidden min-[900px]:block">
        <div className="relative mx-auto flex max-w-6xl items-center justify-center px-6 py-1.5">
          <HeaderBrand brandName={t("brand.name")} locale={locale} centered />
          <div className="absolute inset-y-0 right-6 flex items-center gap-4">
            <HeaderSearchSlot>
              <HeaderSearch placeholder={t("search.placeholder")} ariaLabel={t("nav.search")} />
            </HeaderSearchSlot>
            {isAuthed ? (
              <HeaderUserMenu
                isAuthed
                labels={{
                  profile: t("nav.profile"),
                  settings: t("nav.settings"),
                  logout: t("nav.logout"),
                }}
                avatarSrc={avatarSrc}
                logoutAction={logoutAction}
              />
            ) : (
              <HeaderUserMenu isAuthed={false} labels={{ login: t("nav.login") }} />
            )}
          </div>
        </div>

        <div className="border-t border-ink/10">
          <div className="mx-auto max-w-6xl px-6 py-2.5">
            <HeaderNav t={t} />
          </div>
        </div>
      </div>
    </header>
  );
}

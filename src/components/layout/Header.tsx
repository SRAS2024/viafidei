import { getTranslator } from "@/lib/i18n/server";
import { getSession } from "@/lib/auth/session";
import { sessionCredentialsCurrent } from "@/lib/auth/user";
import { logger } from "@/lib/observability";
import { getProfileForUser } from "@/lib/data/profile";
import { logoutAction } from "@/app/_actions/auth";
import { HeaderBrand } from "./HeaderBrand";
import { HeaderHeight } from "./HeaderHeight";
import { HeaderNav, NAV_GROUPS } from "./HeaderNav";
import { HeaderSearch } from "./HeaderSearch";
import { HeaderSearchSlot } from "./HeaderSearchSlot";
import { HeaderUserMenu } from "./HeaderUserMenu";
import { HeaderMobileMenu } from "./HeaderMobileMenu";

type AuthState = { isAuthed: boolean; userId: string | null };

async function readAuthState(): Promise<AuthState> {
  try {
    const session = await getSession();
    // A password reset ends every earlier sign-in, and this browser may hold one of them.
    // A failed lookup says nothing about the sign-in, so the header leaves it standing.
    const isAuthed =
      session.role === "USER" &&
      !!session.userId &&
      (await sessionCredentialsCurrent(session).catch(() => true));
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
    // Opaque: reading text scrolling beneath a see-through header ghosts through the
    // tabs. Which of the two layouts shows is the header's own container query.
    <header className="vf-header sticky top-0 z-40 w-full border-b border-ink/10 bg-paper">
      <HeaderHeight />
      {/* PHONE / TABLET, AND ENLARGED TEXT — one bar: brand on the left, search and
          menu on the right */}
      <div className="vf-header-bar mx-auto flex max-w-6xl items-center justify-between gap-2 px-[min(1rem,5vw)] py-1.5 sm:px-6">
        <HeaderBrand brandName={t("brand.name")} locale={locale} />
        <div className="flex items-center gap-1">
          <HeaderSearchSlot>
            <HeaderSearch t={t} locale={locale} variant="panel" />
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
          keeps its place on the homepage, where no search sits beside it. The two
          outer columns share what the mark leaves, so the mark stays centred and
          the controls, whatever their length or the reader's text size, cannot
          reach it. */}
      <div className="vf-header-tabs">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-6 py-1.5">
          <div className="col-start-2 flex">
            <HeaderBrand brandName={t("brand.name")} locale={locale} centered />
          </div>
          <div className="flex min-w-0 items-center justify-end gap-4 pl-4">
            <HeaderSearchSlot>
              <HeaderSearch t={t} locale={locale} />
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

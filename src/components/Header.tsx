import Link from "next/link";
import { Logo } from "./Logo";
import { getTranslator } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";

export async function Header() {
  const { t, locale } = await getTranslator();
  const session = await getSession();
  const isAuthedUser = session.role === "USER" && !!session.userId;

  const navItems = [
    { href: "/", key: "nav.home" },
    { href: "/prayers", key: "nav.prayers" },
    { href: "/spiritual-life", key: "nav.spiritualLife" },
    { href: "/spiritual-guidance", key: "nav.spiritualGuidance" },
    { href: "/liturgy-history", key: "nav.liturgyHistory" },
    { href: "/saints", key: "nav.saints" },
  ];

  return (
    <header className="w-full border-b border-ink/10 bg-paper/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-8 pb-5 sm:px-6 sm:pt-10 sm:pb-6">
        <Link
          href="/"
          aria-label={t("brand.name")}
          className="group flex items-center gap-3 sm:gap-4"
        >
          <Logo size={56} className="shrink-0" />
          <span className="flex flex-col items-start">
            <span className="vf-wordmark text-[1.15rem] leading-none text-ink sm:text-[1.4rem]">
              {t("brand.name")}
            </span>
            <span className="vf-eyebrow mt-1.5" lang={locale}>
              {t("brand.tagline")}
            </span>
          </span>
        </Link>

        <div className="vf-rule my-5 sm:my-6" aria-hidden="true" />

        <nav
          aria-label="Primary"
          className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:gap-x-7"
        >
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="vf-nav-link">
              {t(item.key)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-ink/10 px-4 py-3 text-xs sm:flex-row sm:px-6">
        <form
          method="get"
          action="/search"
          role="search"
          className="vf-header-search flex w-full items-center gap-2 sm:w-auto sm:max-w-xs"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
            className="shrink-0 text-ink-faint"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            name="q"
            placeholder={t("search.placeholder")}
            aria-label={t("nav.search")}
            className="vf-header-search-input"
          />
        </form>

        <div className="flex items-center gap-5">
          {isAuthedUser ? (
            <>
              <Link href="/profile" className="vf-nav-link">
                {t("nav.profile")}
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="vf-nav-link">
                  {t("nav.logout")}
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="vf-nav-link">
                {t("nav.login")}
              </Link>
              <Link href="/register" className="vf-nav-link">
                {t("nav.register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

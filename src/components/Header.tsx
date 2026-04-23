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
      <div className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-10 pb-6">
        <Link href="/" className="group flex flex-col items-center gap-3">
          <Logo size={44} />
          <span className="vf-wordmark text-[1.35rem] text-ink">{t("brand.name")}</span>
          <span className="vf-eyebrow" lang={locale}>
            {t("brand.tagline")}
          </span>
        </Link>

        <div className="vf-rule my-6" aria-hidden="true" />

        <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="vf-nav-link">
              {t(item.key)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between border-t border-ink/10 px-6 py-3 text-xs">
        <Link href="/search" className="vf-nav-link flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          {t("nav.search")}
        </Link>
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

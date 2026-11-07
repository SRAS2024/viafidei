import Link from "next/link";
import type { Translator } from "@/lib/i18n/translator";

export type QuickLink = { href: string; key: string };

export const QUICK_LINKS: QuickLink[] = [
  { href: "/sacraments", key: "home.ql.sacraments" },
  { href: "/guides/ocia-rcia-overview", key: "home.ql.ocia" },
  { href: "/guides/how-to-pray-the-rosary", key: "home.ql.rosary" },
  { href: "/guides/how-to-go-to-confession", key: "home.ql.confession" },
  { href: "/parishes", key: "home.ql.parish" },
];

/**
 * The first places to go: the second half of "Begin here". Safari stops calling a
 * list a list once its markers are gone, so the role is said out loud.
 */
export function HomeQuickLinks({
  t,
  links = QUICK_LINKS,
  labelledBy,
}: {
  t: Translator;
  links?: QuickLink[];
  /** The heading that names the list for a screen reader. */
  labelledBy?: string;
}) {
  return (
    <ul className="vf-link-rows vf-home-begin-links" role="list" aria-labelledby={labelledBy}>
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} className="vf-link-row">
            {t(link.key)}
            <span className="vf-link-row-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

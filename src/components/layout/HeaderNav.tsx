import type { Translator } from "@/lib/i18n/translator";
import { HeaderNavClient, type NavItem as ClientNavItem } from "./HeaderNavClient";

export type NavItem = { href: string; key: string };

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", key: "nav.home" },
  { href: "/prayers", key: "nav.prayers" },
  { href: "/spiritual-life", key: "nav.spiritualLife" },
  { href: "/spiritual-guidance", key: "nav.spiritualGuidance" },
  { href: "/liturgy-history", key: "nav.liturgyHistory" },
  { href: "/saints", key: "nav.saints" },
];

type Props = {
  items?: NavItem[];
  t: Translator;
};

export function HeaderNav({ items = PRIMARY_NAV, t }: Props) {
  const enriched: ClientNavItem[] = items.map((item) => ({ ...item, label: t(item.key) }));
  return <HeaderNavClient items={enriched} />;
}

import type { Translator } from "@/lib/i18n/translator";

import { HeaderNavClient, type ClientNavEntry } from "./HeaderNavClient";

export type NavItem = { href: string; key: string };

/**
 * Desktop navigation, grouped into dropdowns. The first entry is a plain
 * link (Home); the rest are groups whose children open in a dropdown. The
 * mobile menu uses the flattened {@link PRIMARY_NAV} so every tab stays one
 * tap away.
 */
export type NavGroup =
  | { kind: "link"; href: string; key: string }
  | { kind: "group"; key: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  { kind: "link", href: "/", key: "nav.home" },
  {
    kind: "group",
    key: "nav.group.prayer",
    items: [
      { href: "/prayers", key: "nav.prayers" },
      { href: "/spiritual-life", key: "nav.spiritualLife" },
      { href: "/sacraments", key: "nav.sacraments" },
    ],
  },
  {
    kind: "group",
    key: "nav.group.holyPeople",
    items: [
      { href: "/saints", key: "nav.saintsTab" },
      { href: "/our-lady", key: "nav.spiritualGuidance" },
      { href: "/popes", key: "nav.popes" },
      { href: "/doctors", key: "nav.doctors" },
    ],
  },
  {
    kind: "group",
    key: "nav.group.liturgy",
    items: [
      { href: "/liturgy", key: "nav.liturgy" },
      { href: "/liturgical-calendar", key: "nav.liturgicalCalendar" },
      { href: "/rites", key: "nav.rites" },
    ],
  },
  {
    kind: "group",
    key: "nav.group.church",
    items: [
      { href: "/parishes", key: "nav.parishes" },
      { href: "/history", key: "nav.history" },
      { href: "/church-documents", key: "nav.churchDocuments" },
    ],
  },
];

/** Flattened list of every primary tab (drives the mobile menu + route coverage). */
export const PRIMARY_NAV: NavItem[] = NAV_GROUPS.flatMap((entry) =>
  entry.kind === "link" ? [{ href: entry.href, key: entry.key }] : entry.items,
);

type Props = { t: Translator };

export function HeaderNav({ t }: Props) {
  const entries: ClientNavEntry[] = NAV_GROUPS.map((entry) =>
    entry.kind === "link"
      ? { kind: "link", href: entry.href, label: t(entry.key) }
      : {
          kind: "group",
          key: entry.key,
          label: t(entry.key),
          items: entry.items.map((item) => ({ href: item.href, label: t(item.key) })),
        },
  );
  return <HeaderNavClient entries={entries} />;
}

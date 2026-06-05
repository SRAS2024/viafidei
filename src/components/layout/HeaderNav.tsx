import type { Translator } from "@/lib/i18n/translator";

import { HeaderNavClient, type ClientNavEntry } from "./HeaderNavClient";

export type NavItem = { href: string; key: string };

/**
 * Desktop navigation. Each top-level tab is itself a link; a tab with
 * children also opens a dropdown of its sub-tabs (the parent label
 * navigates, the chevron toggles the menu). The mobile menu uses the
 * flattened {@link PRIMARY_NAV} so every tab stays one tap away.
 */
export type NavGroup =
  | { kind: "link"; href: string; key: string }
  | { kind: "group"; href: string; key: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  { kind: "link", href: "/", key: "nav.home" },
  {
    kind: "group",
    href: "/prayers",
    key: "nav.prayers",
    items: [{ href: "/litanies", key: "nav.litanies" }],
  },
  {
    kind: "group",
    href: "/saints",
    key: "nav.saintsTab",
    items: [
      { href: "/our-lady", key: "nav.spiritualGuidance" },
      { href: "/doctors", key: "nav.doctors" },
      { href: "/popes", key: "nav.popes" },
    ],
  },
  {
    kind: "group",
    href: "/sacraments",
    key: "nav.sacraments",
    items: [
      { href: "/parishes", key: "nav.parishes" },
      { href: "/spiritual-life", key: "nav.spiritualLife" },
    ],
  },
  { kind: "link", href: "/guides", key: "nav.guides" },
  {
    kind: "group",
    href: "/liturgy",
    key: "nav.liturgy",
    items: [
      { href: "/liturgical-calendar", key: "nav.liturgicalCalendar" },
      { href: "/rites", key: "nav.rites" },
    ],
  },
  {
    kind: "group",
    href: "/history",
    key: "nav.history",
    items: [{ href: "/church-documents", key: "nav.churchDocuments" }],
  },
];

/**
 * Flattened list of every primary tab — the parent tab of each group plus its
 * children — drives the mobile menu (which lists every tab) and route
 * coverage.
 */
export const PRIMARY_NAV: NavItem[] = NAV_GROUPS.flatMap((entry) =>
  entry.kind === "link"
    ? [{ href: entry.href, key: entry.key }]
    : [{ href: entry.href, key: entry.key }, ...entry.items],
);

type Props = { t: Translator };

export function HeaderNav({ t }: Props) {
  const entries: ClientNavEntry[] = NAV_GROUPS.map((entry) =>
    entry.kind === "link"
      ? { kind: "link", href: entry.href, label: t(entry.key) }
      : {
          kind: "group",
          href: entry.href,
          key: entry.key,
          label: t(entry.key),
          items: entry.items.map((item) => ({ href: item.href, label: t(item.key) })),
        },
  );
  return <HeaderNavClient entries={entries} />;
}

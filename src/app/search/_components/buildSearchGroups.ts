import type { SearchHits } from "@/lib/data/search";
import type { Translator } from "@/lib/i18n/translator";
import type { SearchGroup } from "./SearchResultGroup";

export function buildSearchGroups(hits: SearchHits, t: Translator): SearchGroup[] {
  return [
    {
      key: "prayers",
      label: t("nav.prayers"),
      count: hits.prayers.length,
      items: hits.prayers.map((p) => ({
        id: p.id,
        primary: p.defaultTitle,
        secondary: p.category ?? undefined,
        href: `/prayers/${p.slug}`,
      })),
    },
    {
      key: "saints",
      label: t("nav.saints"),
      count: hits.saints.length,
      items: hits.saints.map((s) => ({
        id: s.id,
        primary: s.canonicalName,
        secondary: s.feastDay ?? undefined,
        href: `/saints/${s.slug}`,
      })),
    },
    {
      key: "apparitions",
      label: t("search.group.apparitions"),
      count: hits.apparitions.length,
      items: hits.apparitions.map((a) => ({
        id: a.id,
        primary: a.title,
        secondary: a.location ?? undefined,
        href: `/saints/${a.slug}`,
      })),
    },
    {
      key: "parishes",
      label: t("search.group.parishes"),
      count: hits.parishes.length,
      items: hits.parishes.map((p) => ({
        id: p.id,
        primary: p.name,
        secondary: [p.city, p.country].filter(Boolean).join(", "),
        href: `/spiritual-guidance/${p.slug}`,
      })),
    },
    {
      key: "devotions",
      label: t("search.group.devotions"),
      count: hits.devotions.length,
      items: hits.devotions.map((d) => ({
        id: d.id,
        primary: d.title,
        secondary: d.durationMinutes ? `${d.durationMinutes} min` : undefined,
        href: `/devotions/${d.slug}`,
      })),
    },
    {
      key: "liturgy",
      label: t("search.group.liturgy"),
      count: hits.liturgy.length,
      items: hits.liturgy.map((e) => ({
        id: e.id,
        primary: e.title,
        secondary: e.summary ?? undefined,
        href: `/liturgy-history/${e.slug}`,
      })),
    },
    {
      key: "spiritualLife",
      label: t("search.group.spiritualLife"),
      count: hits.spiritualLife.length,
      items: hits.spiritualLife.map((g) => ({
        id: g.id,
        primary: g.title,
        secondary: g.summary,
        href: `/spiritual-life/${g.slug}`,
      })),
    },
  ];
}

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
        href: "/prayers",
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
        href: "/saints",
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
        href: "/saints",
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
        href: "/spiritual-guidance",
      })),
    },
  ];
}

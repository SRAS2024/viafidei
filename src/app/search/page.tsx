import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { searchAll } from "@/lib/data/search";
import {
  SearchInput,
  SearchResultGroup,
  buildSearchGroups,
} from "./_components";

export const metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const { t } = await getTranslator();
  const q = (searchParams.q ?? "").trim();

  const hits = await searchAll(q);
  const groups = buildSearchGroups(hits, t);
  const total = groups.reduce((acc, g) => acc + g.count, 0);

  return (
    <div>
      <PageHero
        eyebrow={t("nav.search")}
        title={t("search.title")}
        subtitle={t("search.subtitle")}
      />

      <SearchInput
        defaultValue={q}
        placeholder={t("search.placeholder")}
        ariaLabel={t("nav.search")}
        submitLabel={t("nav.search")}
      />

      {q ? (
        <p className="mb-8 text-center font-serif text-ink-faint">
          {total === 0
            ? t("search.noResults")
            : t("search.resultsCount", { count: total, query: q })}
        </p>
      ) : null}

      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        {groups
          .filter((g) => g.count > 0)
          .map((g) => (
            <SearchResultGroup key={g.key} group={g} query={q} />
          ))}
      </div>
    </div>
  );
}

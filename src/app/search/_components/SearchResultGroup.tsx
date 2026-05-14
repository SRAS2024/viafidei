import Link from "next/link";
import { SearchHighlight } from "./SearchHighlight";

export type SearchResultItem = {
  id: string;
  primary: string;
  secondary?: string;
  href?: string;
};

export type SearchGroup = {
  key: string;
  label: string;
  /**
   * Short content-type tag stamped onto every row in the group so a
   * user scanning a mixed result list can tell at a glance whether
   * a hit is a Parish, Saint, Prayer, Apparition, etc. Defaults to a
   * sensible value derived from `key` when omitted.
   */
  typeLabel?: string;
  count: number;
  items: SearchResultItem[];
};

const DEFAULT_TYPE_LABEL: Record<string, string> = {
  prayers: "Prayer",
  saints: "Saint",
  apparitions: "Apparition",
  parishes: "Parish",
  devotions: "Devotion",
  liturgy: "Church teaching",
  spiritualLife: "Spiritual life",
};

type Props = {
  group: SearchGroup;
  query: string;
};

export function SearchResultGroup({ group, query }: Props) {
  const typeLabel = group.typeLabel ?? DEFAULT_TYPE_LABEL[group.key] ?? group.label;
  return (
    <section>
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="break-words font-display text-2xl text-ink">{group.label}</h2>
        <span className="vf-eyebrow shrink-0">{group.count}</span>
      </header>
      <ul className="vf-card divide-y divide-ink/10 rounded-sm">
        {group.items.map((item) => (
          <SearchResultRow
            key={`${group.key}:${item.id}`}
            item={item}
            query={query}
            typeLabel={typeLabel}
          />
        ))}
      </ul>
    </section>
  );
}

function SearchResultRow({
  item,
  query,
  typeLabel,
}: {
  item: SearchResultItem;
  query: string;
  typeLabel: string;
}) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="break-words font-serif text-base text-ink sm:text-lg">
            <SearchHighlight text={item.primary} query={query} />
          </p>
          <span className="rounded-full border border-ink/15 px-2 py-0.5 font-serif text-[0.65rem] uppercase tracking-wider text-ink-faint">
            {typeLabel}
          </span>
        </div>
        {item.secondary ? <p className="vf-eyebrow mt-1 break-words">{item.secondary}</p> : null}
      </div>
      {item.href ? (
        <span aria-hidden="true" className="shrink-0 text-ink-faint">
          →
        </span>
      ) : null}
    </>
  );

  return (
    <li className="px-4 py-3 sm:px-5 sm:py-4">
      {item.href ? (
        <Link href={item.href} className="flex items-center justify-between gap-4">
          {content}
        </Link>
      ) : (
        <div className="flex items-center justify-between gap-4">{content}</div>
      )}
    </li>
  );
}

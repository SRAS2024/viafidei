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
  count: number;
  items: SearchResultItem[];
};

type Props = {
  group: SearchGroup;
  query: string;
};

export function SearchResultGroup({ group, query }: Props) {
  return (
    <section>
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-2xl text-ink">{group.label}</h2>
        <span className="vf-eyebrow">{group.count}</span>
      </header>
      <ul className="vf-card divide-y divide-ink/10 rounded-sm">
        {group.items.map((item) => (
          <SearchResultRow key={`${group.key}:${item.id}`} item={item} query={query} />
        ))}
      </ul>
    </section>
  );
}

function SearchResultRow({ item, query }: { item: SearchResultItem; query: string }) {
  const content = (
    <>
      <div className="min-w-0">
        <p className="font-serif text-lg text-ink">
          <SearchHighlight text={item.primary} query={query} />
        </p>
        {item.secondary ? <p className="vf-eyebrow mt-1">{item.secondary}</p> : null}
      </div>
      {item.href ? <span aria-hidden="true" className="text-ink-faint">→</span> : null}
    </>
  );

  return (
    <li className="px-5 py-4">
      {item.href ? (
        <Link href={item.href} className="flex items-center justify-between gap-4">
          {content}
        </Link>
      ) : (
        <div>{content}</div>
      )}
    </li>
  );
}

import type { ReactNode } from "react";

export interface FactItem {
  label: string;
  value: ReactNode;
}

/**
 * The identifying facts of a person or thing: dates, feast day, patronage. One
 * definition list with one label style, so facts align the same way on every
 * biography. A fact with no value is left out, and an empty list renders nothing.
 */
export function FactList({
  items,
  className = "",
  valueLang,
}: {
  items: ReadonlyArray<FactItem | null | undefined>;
  className?: string;
  /**
   * The language of the values when it is not the page's: a record's English dates and
   * patronages under labels in the reader's language.
   */
  valueLang?: string;
}) {
  const shown = items.filter(
    (item): item is FactItem =>
      !!item && item.value != null && item.value !== "" && item.value !== false,
  );
  if (shown.length === 0) return null;
  return (
    <dl className={`vf-facts ${className}`.trim()}>
      {shown.map((item) => (
        <div key={item.label} className="contents">
          <dt>{item.label}</dt>
          <dd lang={valueLang}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

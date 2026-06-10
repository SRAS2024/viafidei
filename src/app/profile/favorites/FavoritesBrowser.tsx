"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

import { FilterChips } from "@/components/ui";

export type FavoriteItem = {
  id: string;
  contentType: "PRAYER" | "SAINT" | "APPARITION" | "DEVOTION" | "PARISH" | "NOVENA";
  kind: "prayers" | "saints" | "apparitions" | "devotions" | "parishes" | "novenas";
  slug: string;
  title: string;
  href: string;
  typeLabel: string;
  savedAt: string;
};

type Filter = "ALL" | FavoriteItem["contentType"];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PRAYER", label: "Prayers" },
  { key: "SAINT", label: "Saints" },
  { key: "APPARITION", label: "Our Lady" },
  { key: "DEVOTION", label: "Devotions" },
  { key: "NOVENA", label: "Novenas" },
  { key: "PARISH", label: "Parishes" },
];

export function FavoritesBrowser({ items: initial }: { items: FavoriteItem[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      ALL: items.length,
      PRAYER: 0,
      SAINT: 0,
      APPARITION: 0,
      DEVOTION: 0,
      NOVENA: 0,
      PARISH: 0,
    };
    for (const it of items) c[it.contentType] += 1;
    return c;
  }, [items]);

  const visible = filter === "ALL" ? items : items.filter((i) => i.contentType === filter);

  function remove(item: FavoriteItem) {
    if (typeof window !== "undefined" && !window.confirm("Remove this from your favorites?"))
      return;
    setPendingId(item.id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/saved/${item.kind}?id=${encodeURIComponent(item.slug)}`, {
          method: "DELETE",
        });
        if (res.ok) setItems((prev) => prev.filter((i) => i.id !== item.id));
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div>
      <FilterChips
        ariaLabel="Filter favorites by type"
        activeKey={filter}
        className="mb-6"
        resetKey="ALL"
        onSelect={(k) => setFilter(k as Filter)}
        items={FILTERS.map((f) => ({ key: f.key, label: f.label, count: counts[f.key] }))}
      />

      {visible.length === 0 ? (
        <p className="py-16 text-center font-serif text-ink-faint">
          {items.length === 0
            ? "You haven't favorited anything yet. Tap Favorite on any prayer, saint, devotion, or apparition to save it here."
            : "No favorites in this category."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <div
              key={item.id}
              className="vf-card flex flex-col justify-between rounded-sm p-5 transition hover:border-ink/30"
            >
              <Link href={item.href} className="block">
                <p className="vf-eyebrow">{item.typeLabel}</p>
                <h3 className="mt-2 font-display text-xl text-ink">{item.title}</h3>
              </Link>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => remove(item)}
                  disabled={pendingId === item.id}
                  className="text-xs uppercase tracking-liturgical text-ink-faint underline-offset-2 hover:text-liturgical-red hover:underline disabled:opacity-50"
                >
                  {pendingId === item.id ? "…" : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

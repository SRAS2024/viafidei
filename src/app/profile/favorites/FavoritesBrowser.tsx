"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

// Import the leaf components directly, NOT through "@/components/ui".
// The barrel also re-exports PublishedDetail / PublishedList /
// RelatedContentLinks, which import values from "@/lib/data/published";
// that module uses Prisma.sql for search, so a client component pulling
// the barrel drags the Prisma client into the browser bundle and every
// page dies at hydration with "sqltag is unable to run in this browser
// environment". Caught by the e2e smoke suite.
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ContentCard } from "@/components/ui/ContentCard";
import { FilterChips } from "@/components/ui/FilterChips";
import { ListControls } from "@/components/ui/ListSearch";
import { PaginatedGrid } from "@/components/ui/PaginatedGrid";

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

const DEFAULT_LABELS = {
  remove: "Remove",
  cancel: "Cancel",
  removeTitle: "Remove saved item",
  removeBody: 'Remove "{name}" from your saved items?',
};

export function FavoritesBrowser({
  items: initial,
  labels = DEFAULT_LABELS,
}: {
  items: FavoriteItem[];
  labels?: typeof DEFAULT_LABELS;
}) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<FavoriteItem | null>(null);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();
  const frameRef = useRef<HTMLDivElement>(null);
  // Which card to land on once a removed one has gone from the page.
  const focusAfterRemoval = useRef<number | null>(null);

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

  // The Remove button a reader just used is gone with its card, so focus moves to
  // the card that took its place, or to the filter when none is left.
  useEffect(() => {
    const index = focusAfterRemoval.current;
    if (index === null) return;
    focusAfterRemoval.current = null;
    const frame = frameRef.current;
    if (!frame) return;
    const links = frame.querySelectorAll<HTMLElement>(".vf-entry-link");
    const target = links[Math.min(index, links.length - 1)] ?? frame.querySelector("button");
    target?.focus();
  }, [items]);

  function remove(item: FavoriteItem) {
    setConfirming(null);
    setFailed(false);
    setPendingId(item.id);
    const index = visible.findIndex((i) => i.id === item.id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/saved/${item.kind}?id=${encodeURIComponent(item.slug)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          focusAfterRemoval.current = Math.max(index, 0);
          setItems((prev) => prev.filter((i) => i.id !== item.id));
        } else {
          setFailed(true);
        }
      } catch {
        setFailed(true);
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div ref={frameRef}>
      <ListControls>
        <FilterChips
          ariaLabel="Filter favorites by type"
          activeKey={filter}
          resetKey="ALL"
          onSelect={(k) => setFilter(k as Filter)}
          items={FILTERS.map((f) => ({ key: f.key, label: f.label, count: counts[f.key] }))}
        />
      </ListControls>

      {/* The count of what remains, said aloud, after a removal or a new filter. */}
      <p role="status" aria-live="polite" className="sr-only">
        {failed ? "" : `${visible.length} ${visible.length === 1 ? "favorite" : "favorites"}`}
      </p>

      {failed ? (
        <p role="alert" className="vf-notice vf-notice-error vf-column mb-4">
          Could not remove that favorite. Please try again.
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="vf-section-lede text-center">
          {items.length === 0
            ? // Every type with a Favorite control is named here, parishes and
              // novenas included — leaving them out reads as "parishes can't be
              // favorited", which is exactly the confusion this list must not create.
              "You haven't favorited anything yet. Tap Favorite on any prayer, saint, devotion, apparition, novena, or parish to save it here."
            : "No favorites in this category."}
        </p>
      ) : (
        <PaginatedGrid
          columns={3}
          items={visible.map((item) => (
            <ContentCard
              key={item.id}
              href={item.href}
              title={item.title}
              titleAs="h2"
              meta={[item.typeLabel]}
            >
              <div className="vf-entry-foot vf-entry-control">
                <button
                  type="button"
                  onClick={() => {
                    if (pendingId !== item.id) setConfirming(item);
                  }}
                  aria-disabled={pendingId === item.id}
                  aria-busy={pendingId === item.id}
                  aria-label={`${labels.remove}: ${item.title}`}
                  className="vf-link-danger"
                >
                  {labels.remove}
                </button>
              </div>
            </ContentCard>
          ))}
        />
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={labels.removeTitle}
        body={labels.removeBody}
        entityName={confirming?.title}
        cancelLabel={labels.cancel}
        confirmLabel={labels.remove}
        destructive
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) remove(confirming);
        }}
      />
    </div>
  );
}

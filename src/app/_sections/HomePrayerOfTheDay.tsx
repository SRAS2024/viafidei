"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useLocalToday } from "@/components/ui/useLocalToday";
import { prayerCategoryLabel } from "@/lib/content-shared/prayer-categories";

import { SkeletonLine } from "./SkeletonLine";

type Prayer = {
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  excerpt: string;
};

type State = { kind: "loading" } | { kind: "loaded"; prayer: Prayer | null } | { kind: "error" };

/**
 * Homepage "Prayer of the Day" block. The visitor's local date is computed on
 * the client (device timezone) and handed to the API, which picks the day's
 * prayer deterministically from the published library — so the prayer changes
 * at the visitor's midnight, is the same for everyone on the same date, and
 * keeps cycling whether or not the Admin Worker is running.
 */
export function HomePrayerOfTheDay({ loadingLabel }: { loadingLabel: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const today = useLocalToday();

  useEffect(() => {
    if (!today) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/prayers/today?date=${today}`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setState({ kind: "error" });
          return;
        }
        const data = (await res.json()) as { prayer: Prayer | null };
        if (!cancelled) setState({ kind: "loaded", prayer: data.prayer ?? null });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [today]);

  const prayer = state.kind === "loaded" ? state.prayer : null;

  return (
    // The prayer's title is the part's one link, stretched over the whole part.
    <div className="vf-card vf-entry vf-home-part">
      <h3 className="vf-subhead">Prayer of the Day</h3>
      <p role="status" className="sr-only">
        {state.kind === "loading" ? loadingLabel : ""}
      </p>
      {state.kind === "loading" ? (
        <div className="vf-home-part-body" aria-hidden="true">
          <p className="vf-entry-title">
            <SkeletonLine className="w-11/12" />
            <SkeletonLine className="w-3/5" />
          </p>
          <p className="vf-entry-meta">
            <SkeletonLine className="w-1/4" />
          </p>
          <p className="vf-entry-summary">
            <SkeletonLine />
            <SkeletonLine />
            <SkeletonLine className="w-11/12" />
            <SkeletonLine className="w-3/4" />
          </p>
        </div>
      ) : prayer ? (
        <div className="vf-home-part-body">
          <p className="vf-entry-title font-display font-medium text-ink">
            <Link href={`/prayers/${prayer.slug}`} className="vf-entry-link">
              {prayer.title}
            </Link>
          </p>
          {prayer.category && prayer.category !== "general" ? (
            <p className="vf-entry-meta">{prayerCategoryLabel(prayer.category)}</p>
          ) : null}
          {prayer.excerpt ? (
            <p
              className="vf-entry-summary vf-clamp italic"
              style={{ "--clamp": 4 } as React.CSSProperties}
            >
              {prayer.excerpt}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="vf-home-part-body">
          <p className="font-serif text-ink-soft">
            <Link href="/prayers" className="vf-link">
              Browse the prayer library
            </Link>
            .
          </p>
        </div>
      )}
      {state.kind === "error" || (state.kind === "loaded" && !prayer) ? null : (
        <div className="vf-home-part-actions">
          <p className="vf-entry-action" aria-hidden="true">
            Pray it in full <span>→</span>
          </p>
        </div>
      )}
    </div>
  );
}

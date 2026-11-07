"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useLocalToday } from "@/components/ui/useLocalToday";

import { SkeletonLine } from "./SkeletonLine";

type SaintSummary = {
  slug: string;
  name: string;
  biography?: string;
};

type DataState =
  | { kind: "loading" }
  | { kind: "loaded"; total: number; items: SaintSummary[]; month: number; day: number }
  | { kind: "error" };

/**
 * Homepage "Today's Feast Day Saints" block.
 *
 * Reads the current date in the user's device timezone (useLocalToday, so it
 * follows the user wherever they are, and across midnight) and
 * lists up to five saints whose feast falls on that date. Saints are linked to
 * their detail page; a "See more" link below the fifth saint takes the user
 * to /saints/today with the complete feast list. Saints are returned
 * pre-ordered by `venerationRank()` in the API so the most widely
 * recognised figures land first — the ranking is not surfaced as a
 * label on the page per the spec.
 */
export function HomeToday({
  loadingLabel,
  errorLabel,
}: {
  loadingLabel: string;
  /** What the same live region says, and the part shows, when the list cannot load. */
  errorLabel: string;
}) {
  const [state, setState] = useState<DataState>({ kind: "loading" });
  const today = useLocalToday();

  useEffect(() => {
    if (!today) return;
    const month = Number(today.slice(5, 7));
    const day = Number(today.slice(8, 10));
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/saints/today?month=${month}&day=${day}&take=5`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setState({ kind: "error" });
          return;
        }
        const data = (await res.json()) as {
          month: number;
          day: number;
          total: number;
          items: SaintSummary[];
        };
        if (!cancelled) {
          setState({
            kind: "loaded",
            total: data.total,
            items: data.items,
            month: data.month,
            day: data.day,
          });
        }
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [today]);

  return (
    <div className="vf-card vf-home-part">
      <h3 id="home-saints-title" className="vf-subhead">
        Today&apos;s Feast Day Saints
      </h3>
      {/* One live region: it says it is loading, and says so if the list fails. */}
      <p role="status" className={state.kind === "error" ? "font-serif text-ink-soft" : "sr-only"}>
        {state.kind === "loading" ? loadingLabel : state.kind === "error" ? errorLabel : ""}
      </p>
      {state.kind === "loading" ? (
        <SaintsPlaceholder />
      ) : state.kind === "error" ? null : state.items.length === 0 ? (
        <div className="vf-home-part-body">
          <p className="font-serif text-ink-soft">
            No saints in our catalog match today&apos;s feast yet.{" "}
            <Link href="/saints" className="vf-link">
              Browse all saints
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="vf-home-part-body">
            <ul
              className="vf-link-rows vf-link-rows--compact"
              role="list"
              aria-labelledby="home-saints-title"
            >
              {state.items.map((s) => (
                <li key={s.slug}>
                  <Link href={`/saints/${s.slug}`} className="vf-link-row">
                    {s.name}
                    <span className="vf-link-row-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="vf-home-part-actions">
            <Link
              href={`/saints/today?month=${state.month}&day=${state.day}`}
              className="vf-link-action"
            >
              {state.total > state.items.length
                ? `See more saints (${state.total - state.items.length})`
                : "See the full feast day list"}{" "}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/** The finished part's shape: five rows and the link beneath them. */
function SaintsPlaceholder() {
  const widths = ["w-3/5", "w-4/5", "w-1/2", "w-3/4", "w-3/5"];
  return (
    <>
      <div className="vf-home-part-body" aria-hidden="true">
        <div className="vf-link-rows vf-link-rows--compact">
          {widths.map((width, i) => (
            <div key={i}>
              <div className="vf-link-row">
                <span className="w-full">
                  <SkeletonLine className={width} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="vf-home-part-actions" aria-hidden="true">
        <span className="vf-link-action w-2/5">
          <SkeletonLine />
        </span>
      </div>
    </>
  );
}

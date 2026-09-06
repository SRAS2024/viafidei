"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Prayer = {
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  excerpt: string;
};

type State = { kind: "loading" } | { kind: "loaded"; prayer: Prayer | null } | { kind: "error" };

const CATEGORY_LABEL: Record<string, string> = {
  marian: "Marian",
  angelic: "Angelic",
  eucharistic: "Eucharistic",
  trinitarian: "Trinitarian",
  penitential: "Penitential",
  litany: "Litany",
  liturgical: "Liturgical",
  saintly: "To a saint",
  novena: "Novena",
  chaplet: "Chaplet",
  consecration: "Consecration",
  devotional: "Devotional",
  general: "Prayer",
};

/**
 * Homepage "Prayer of the Day" block. The visitor's local date is computed on
 * the client (device timezone) and handed to the API, which picks the day's
 * prayer deterministically from the published library — so the prayer changes
 * at the visitor's midnight, is the same for everyone on the same date, and
 * keeps cycling whether or not the Admin Worker is running.
 */
export function HomePrayerOfTheDay() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/prayers/today?date=${iso}`, { cache: "no-store" });
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
  }, []);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 text-center sm:px-6">
      <p className="vf-eyebrow text-ink-faint">Today</p>
      <h2 className="mt-2 font-display text-xl text-ink sm:text-2xl">Prayer of the Day</h2>
      <div className="vf-rule mx-auto my-5" />
      <div className="min-h-[7rem]">
        {state.kind === "loading" ? (
          <p className="font-serif text-sm text-ink-faint">Choosing today&apos;s prayer…</p>
        ) : state.kind === "error" || !state.prayer ? (
          <p className="font-serif text-sm text-ink-faint">
            <Link href="/prayers" className="vf-nav-link">
              Browse the prayer library
            </Link>
            .
          </p>
        ) : (
          <Link href={`/prayers/${state.prayer.slug}`} className="block">
            <article className="vf-card mx-auto max-w-xl rounded-sm p-6 text-left transition hover:-translate-y-0.5 hover:border-ink/30 sm:p-7">
              <p className="vf-eyebrow">
                {CATEGORY_LABEL[state.prayer.category] ?? CATEGORY_LABEL.general}
              </p>
              <h3 className="mt-3 break-words font-display text-2xl text-ink">
                {state.prayer.title}
              </h3>
              {state.prayer.excerpt ? (
                <p className="mt-4 line-clamp-4 font-serif italic leading-relaxed text-ink-soft">
                  {state.prayer.excerpt}
                </p>
              ) : null}
              <p className="mt-4 font-serif text-sm text-ink-faint">Pray it in full →</p>
            </article>
          </Link>
        )}
      </div>
    </section>
  );
}

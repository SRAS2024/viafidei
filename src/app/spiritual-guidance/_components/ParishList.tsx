"use client";

import { useState } from "react";
import Link from "next/link";

type Parish = {
  id: string;
  slug: string;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
};

type Props = {
  parishes: Parish[];
  placeholder: string;
};

export function ParishList({ parishes, placeholder }: Props) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? parishes.filter((p) => {
        const s = q.toLowerCase();
        return (
          p.name.toLowerCase().includes(s) ||
          (p.city ?? "").toLowerCase().includes(s) ||
          (p.region ?? "").toLowerCase().includes(s) ||
          (p.country ?? "").toLowerCase().includes(s)
        );
      })
    : parishes;

  return (
    <>
      <div className="mx-auto mb-10 max-w-lg">
        <input
          className="vf-input"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
            {q.trim()
              ? "No parishes match your search."
              : "Parish index will appear here after ingestion from approved official Catholic directories."}
          </div>
        ) : (
          filtered.map((p) => (
            <Link key={p.id} href={`/spiritual-guidance/${p.slug}`}>
              <article className="vf-card h-full rounded-sm p-7 transition hover:border-ink/30 hover:-translate-y-0.5">
                <h2 className="font-display text-2xl">{p.name}</h2>
                <p className="mt-2 font-serif text-ink-soft">
                  {[p.address, p.city, p.region, p.country].filter(Boolean).join(", ")}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-ink-faint">
                  {p.phone ? <span>{p.phone}</span> : null}
                  {p.websiteUrl ? (
                    <span className="underline underline-offset-4">Website ↗</span>
                  ) : null}
                </div>
              </article>
            </Link>
          ))
        )}
      </div>
    </>
  );
}

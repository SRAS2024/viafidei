import Link from "next/link";

import {
  LIST_PAGE_SIZE,
  PageHero,
  PaginatedGrid,
  Pagination,
  pageSlice,
  parsePageParam,
} from "@/components/ui";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Popes" };

function startYear(payload: Record<string, unknown>): number {
  const m = String(payload.papacyStart ?? "").match(/\d{1,4}/);
  return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER;
}

function reignLabel(payload: Record<string, unknown>): string {
  const start = String(payload.papacyStart ?? "").trim();
  const end = String(payload.papacyEnd ?? "").trim();
  if (!start) return "";
  return `${start}–${end || "Present"}`;
}

export default async function PopesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  // A pope card shows the reign years, which live in the payload, so the list
  // (bounded by the ~266 Roman Pontiffs) is read whole and paged here: only
  // one page of cards is rendered and serialised into the response.
  const popes = await listPublished("POPE");
  // Chronological order, earliest pontificate first.
  const ordered = [...popes].sort(
    (a, b) =>
      startYear(a.payload as Record<string, unknown>) -
      startYear(b.payload as Record<string, unknown>),
  );
  const page = pageSlice(ordered, parsePageParam(pageParam), LIST_PAGE_SIZE);

  return (
    <div>
      <PageHero
        eyebrow="The Roman Pontiffs"
        title="Popes"
        subtitle="The successors of Saint Peter, in chronological order."
      />

      {ordered.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          The chronological list of popes will appear here as records are approved and published
          through the checklist-first worker.
        </div>
      ) : (
        <>
          <PaginatedGrid
            items={page.items.map((p) => {
              const reign = reignLabel(p.payload as Record<string, unknown>);
              return (
                <Link
                  key={p.id}
                  href={`/popes/${p.slug}`}
                  className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:-translate-y-0.5 hover:border-ink/30"
                >
                  {reign ? <p className="vf-eyebrow">{reign}</p> : null}
                  <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">{p.title}</h2>
                </Link>
              );
            })}
          />
          <Pagination basePath="/popes" page={page.page} totalPages={page.pageCount} />
        </>
      )}
    </div>
  );
}

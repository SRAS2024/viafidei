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
export const metadata = { title: "Doctors of the Church" };

export default async function DoctorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  // A closed list (37 Doctors), and each card shows the Doctor's epithet from
  // the payload, so the type is read whole and paged here.
  const doctors = await listPublished("DOCTOR");
  const page = pageSlice(doctors, parsePageParam(pageParam), LIST_PAGE_SIZE);

  return (
    <div>
      <PageHero
        eyebrow="The Church's great teachers"
        title="Doctors of the Church"
        subtitle="A Doctor of the Church is a saint recognized by the Church for an eminent contribution to theology or doctrine through their writing, teaching, and holiness."
      />

      {doctors.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          The Doctors of the Church will appear here as records are approved and published through
          the checklist-first worker.
        </div>
      ) : (
        <>
          <PaginatedGrid
            items={page.items.map((d) => {
              const payload = d.payload as Record<string, unknown>;
              const epithet = typeof payload.doctorTitle === "string" ? payload.doctorTitle : "";
              return (
                <Link
                  key={d.id}
                  href={`/doctors/${d.slug}`}
                  className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:-translate-y-0.5 hover:border-ink/30"
                >
                  {epithet ? <p className="vf-eyebrow">{epithet}</p> : null}
                  <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">{d.title}</h2>
                </Link>
              );
            })}
          />
          <Pagination basePath="/doctors" page={page.page} totalPages={page.pageCount} />
        </>
      )}
    </div>
  );
}

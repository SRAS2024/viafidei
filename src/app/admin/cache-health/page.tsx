import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getCacheHealthSnapshot } from "@/lib/cache/revalidate";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Admin "cache health" page (spec §19).
 *
 * Surfaces the in-memory cache revalidation log so an admin can
 * answer "did the factory revalidate after this persistence?" and
 * "is the live site fresh?". The log is reset on every server
 * restart — for long-term tracking, look at queue audit + persist
 * timestamps.
 */
export default async function CacheHealthPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const snapshot = getCacheHealthSnapshot(50);

  return (
    <AdminSection
      titleKey="admin.cacheHealth.title"
      subtitle={`${snapshot.totalLogged} total revalidations · ${snapshot.okCount} ok · ${snapshot.failCount} failed`}
    >
      <div
        className="mx-auto mb-6 grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3"
        data-testid="cache-health-totals"
      >
        <div className="rounded-2xl border border-ink/10 bg-paper px-5 py-4">
          <p className="font-mono text-xs uppercase text-ink-soft">total logged</p>
          <p className="font-display text-3xl">{snapshot.totalLogged}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4">
          <p className="font-mono text-xs uppercase text-emerald-700">ok</p>
          <p className="font-display text-3xl text-emerald-900">{snapshot.okCount}</p>
        </div>
        <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4">
          <p className="font-mono text-xs uppercase text-red-700">failed</p>
          <p className="font-display text-3xl text-red-900">{snapshot.failCount}</p>
        </div>
      </div>

      <div className="mx-auto mb-6 max-w-6xl rounded-2xl border border-ink/10 bg-paper px-5 py-4">
        <h2 className="font-serif text-base font-semibold">By reason</h2>
        {snapshot.byReason.length === 0 ? (
          <p className="mt-2 font-serif text-sm text-ink-soft">
            No revalidations have been logged yet on this worker process.
          </p>
        ) : (
          <table className="mt-3 w-full font-mono text-xs">
            <thead className="text-ink-soft">
              <tr className="text-left">
                <th className="py-1">Reason</th>
                <th className="py-1">Count</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.byReason.map((row) => (
                <tr
                  key={row.reason}
                  className="border-t border-ink/5"
                  data-testid={`cache-health-reason-${row.reason}`}
                >
                  <td className="py-1">{row.reason.replace(/_/g, " ")}</td>
                  <td className="py-1">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mx-auto max-w-6xl rounded-2xl border border-ink/10 bg-paper px-5 py-4">
        <h2 className="font-serif text-base font-semibold">Recent revalidations</h2>
        {snapshot.recent.length === 0 ? (
          <p
            className="mt-2 font-serif text-sm text-ink-soft"
            data-testid="cache-health-recent-empty"
          >
            No revalidations have been logged yet on this worker process.
          </p>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="cache-health-recent">
            {snapshot.recent.map((entry, idx) => (
              <li
                key={`${entry.at.toISOString()}-${idx}`}
                className="rounded-xl border border-ink/5 px-3 py-2 font-mono text-xs"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    <strong>{entry.reason}</strong> ·{" "}
                    <span className={entry.ok ? "text-emerald-700" : "text-red-800"}>
                      {entry.ok ? "ok" : "failed"}
                    </span>
                    {entry.contentType && (
                      <>
                        {" · "}
                        {entry.contentType}
                      </>
                    )}
                    {entry.slug && (
                      <>
                        {" · "}
                        {entry.slug}
                      </>
                    )}
                  </span>
                  <span className="text-ink-soft">{entry.at.toISOString()}</span>
                </div>
                <p className="mt-1 text-ink-soft">tags: {entry.tags.join(", ")}</p>
                {entry.errorMessage && <p className="mt-1 text-red-800">{entry.errorMessage}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminSection>
  );
}

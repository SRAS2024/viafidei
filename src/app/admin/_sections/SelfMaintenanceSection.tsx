/**
 * "Self-maintenance" block for the admin diagnostics page.
 *
 * The Admin Worker maintains ITSELF — it senses its own health, trims its own
 * telemetry, resets its own wedged lanes, restores content it took down, and
 * escalates what it cannot fix. The owner asked for that work to appear in the
 * developer audit exactly like publishing does, because the failure it exists
 * to catch (three months, ~7 M ledger rows, zero published items, `worker_stuck`
 * 207,830 times) was invisible precisely because nothing reported it.
 *
 * PURELY PRESENTATIONAL. It takes the already-read `SelfMaintenanceSummary` and
 * renders it in the same visual language as the page's other blocks — no
 * queries, no imports of worker machinery (the type is erased at compile time),
 * so it costs the web server nothing.
 *
 * A healthy system reads as healthy: one calm line, no empty tables, no red.
 */

import type {
  SelfMaintenanceCondition,
  SelfMaintenanceSummary,
} from "@/lib/admin-worker/operational-summary";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).filter(([, v]) => v !== 0);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k} ${v.toLocaleString("en-US")}`).join(", ");
}

function ConditionRow({ condition }: { condition: SelfMaintenanceCondition }) {
  const critical = condition.severity === "critical";
  const tone = critical
    ? "border-rose-600 bg-rose-100 text-black"
    : "border-amber-500 bg-amber-50 text-amber-900";
  const badge = critical ? "bg-rose-600 text-white" : "bg-amber-500 text-black";
  return (
    <div
      className={`rounded border-l-4 ${tone} px-4 py-3`}
      data-condition={condition.name}
      data-severity={condition.severity}
    >
      <div className="flex items-center gap-3">
        <span className={`rounded px-2 py-0.5 text-xs uppercase ${badge}`}>
          {condition.severity}
        </span>
        <span className="font-display text-lg">{condition.name}</span>
      </div>
      {condition.detail && <p className="mt-1 font-serif text-sm">{condition.detail}</p>}
      <p className="mt-2 text-xs italic">→ remedy: {condition.remedy}</p>
    </div>
  );
}

export function SelfMaintenanceSection({ summary }: { summary: SelfMaintenanceSummary }) {
  const {
    everRan,
    healthy,
    headline,
    conditions,
    repairs,
    escalations,
    backedOff,
    size,
    contentRestored24h,
  } = summary;
  const state = !everRan ? "unmeasured" : healthy ? "healthy" : "attention";

  return (
    <section data-self-maintenance={state}>
      <h2 className="font-display text-2xl text-ink">Self-maintenance</h2>
      <p className="mb-2 text-xs italic text-ink-soft">
        The maintenance the worker performs on itself: what its last sweep found, what it repaired,
        and whether the repair actually moved the signal. It sweeps from the maint-self-heal lane,
        so it runs only while the Admin Worker is on.
      </p>

      <div
        className={`rounded-sm border-l-4 px-4 py-3 ${
          state === "healthy"
            ? "border-green-500 bg-green-50 text-green-900"
            : state === "unmeasured"
              ? "border-slate-400 bg-slate-50 text-slate-900"
              : "border-amber-500 bg-amber-50 text-amber-900"
        }`}
      >
        <p className="font-serif text-sm">{headline}</p>
        {size && (
          <p className="mt-1 text-xs">
            Database {formatBytes(size.databaseBytes)}
            {size.databaseThresholdBytes > 0
              ? ` of a ${formatBytes(size.databaseThresholdBytes)} trim threshold`
              : ""}
            {size.largestTable
              ? `; largest telemetry table ${size.largestTable} at ${size.largestTableRows.toLocaleString("en-US")} rows`
              : ""}
            {size.rowThreshold > 0
              ? ` (threshold ${size.rowThreshold.toLocaleString("en-US")})`
              : ""}
            .
          </p>
        )}
      </div>

      {conditions.length > 0 && (
        <div className="mt-3 space-y-2">
          {conditions.map((c) => (
            <ConditionRow key={`${c.name}-${c.remedy}`} condition={c} />
          ))}
        </div>
      )}

      {backedOff.length > 0 && (
        <div className="mt-3 rounded border-l-4 border-rose-600 bg-rose-100 px-4 py-3 text-black">
          <p className="font-display text-lg">Repairs the worker gave up on</p>
          <ul className="mt-1 list-disc pl-6 text-xs">
            {backedOff.map((b) => (
              <li key={b.condition}>
                {b.condition} — {b.failures} repair(s) in a row moved nothing; left alone until{" "}
                <span className="font-mono">{b.until.toISOString().slice(0, 16)}Z</span>.
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs italic">
            → the worker stopped retrying on purpose; a person needs to fix the underlying cause.
          </p>
        </div>
      )}

      {escalations.length > 0 && (
        <div className="mt-3 rounded border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-amber-900">
          <p className="font-display text-lg">
            Escalated to a person ({escalations.length} in 24 h)
          </p>
          <ul className="mt-1 list-disc pl-6 text-xs">
            {escalations.map((e) => (
              <li key={`${e.condition}-${e.at.toISOString()}`}>
                <span className="font-mono">{e.at.toISOString().slice(0, 16)}Z</span> {e.condition}:{" "}
                {e.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {repairs.length > 0 ? (
        <div className="mt-3">
          <h3 className="font-display text-lg text-ink">Repairs applied in the last 24 hours</h3>
          <table className="mt-1 w-full text-xs">
            <thead>
              <tr className="text-left uppercase text-ink-soft">
                <th className="py-1">Condition</th>
                <th>Repair</th>
                <th className="text-right">Tried</th>
                <th className="text-right">OK</th>
                <th>What it moved</th>
                <th>Verified</th>
                <th>Last</th>
              </tr>
            </thead>
            <tbody>
              {repairs.map((r) => (
                <tr key={`${r.condition}-${r.repair}`} className="border-t" data-repair={r.repair}>
                  <td className="py-1">{r.condition}</td>
                  <td className="font-mono">{r.repair}</td>
                  <td className="text-right">{r.attempts}</td>
                  <td className="text-right">{r.succeeded}</td>
                  <td>{formatCounts(r.counts)}</td>
                  <td>{r.verified ? "yes" : "no change"}</td>
                  <td className="font-mono">{r.lastAt.toISOString().slice(0, 16)}Z</td>
                </tr>
              ))}
            </tbody>
          </table>
          {contentRestored24h > 0 && (
            <p className="mt-1 text-xs text-ink-soft">
              {contentRestored24h} content row(s) re-published after the gate that blocked them
              passed again.
            </p>
          )}
        </div>
      ) : (
        // No alarming empty state: nothing to repair is the good outcome.
        everRan && (
          <p className="mt-3 text-xs italic text-ink-soft">
            No repairs were needed in the last 24 hours.
          </p>
        )
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

type Counts = {
  prayers: number;
  saints: number;
  parishes: number;
  churchDocuments: number;
  sacraments: number;
  consecrations: number;
};

type Progress = {
  counts: Counts;
  targets: Counts;
  metAll: boolean;
  mode: string;
};

type StatusKind =
  | "active"
  | "paused"
  | "disabled"
  | "running"
  | "failed"
  | "idle"
  | "maintenance"
  | "stale"
  | "blocked"
  | "failing";

type Snapshot = {
  progress: Progress | null;
  settings: { autoCleanupEnabled: boolean; hardDeleteAfterDays: number };
  activity24h: Record<string, number>;
  status: StatusKind;
  statusDetail: string;
  latestRun: {
    status: string;
    startedAt: string;
    finishedAt: string | null;
    recordsCreated: number;
    recordsUpdated: number;
    recordsSkipped: number;
    errorMessage: string | null;
    jobName: string;
    sourceName: string;
  } | null;
};

const COUNT_TO_CONTENT_TYPES: Record<keyof Counts, string[]> = {
  prayers: ["Prayer"],
  saints: ["Saint"],
  parishes: ["Parish"],
  // The backlog mixes encyclicals + Catechism + Canon Law + Councils under
  // LiturgyEntry, so all DataManagementLog rows for liturgy land here.
  churchDocuments: ["LiturgyEntry"],
  sacraments: ["SpiritualLifeGuide"],
  consecrations: ["SpiritualLifeGuide"],
};

const LABELS: Record<keyof Counts, string> = {
  prayers: "Prayers",
  saints: "Saints",
  parishes: "Parishes",
  churchDocuments: "Church Documents",
  sacraments: "Sacraments",
  consecrations: "Consecrations",
};

const STATUS_LABEL: Record<StatusKind, string> = {
  active: "Active",
  paused: "Paused",
  disabled: "Disabled",
  running: "Running",
  failed: "Failed",
  idle: "Idle",
  maintenance: "Maintenance",
  stale: "Stale",
  blocked: "Blocked",
  failing: "Failing",
};

const STATUS_COLOR: Record<StatusKind, string> = {
  active: "#185c2a",
  paused: "#9b6b00",
  disabled: "#3b3f4a",
  running: "#0b4477",
  failed: "#8b1a1a",
  idle: "#3b3f4a",
  maintenance: "#185c2a",
  stale: "#9b6b00",
  blocked: "#8b1a1a",
  failing: "#8b1a1a",
};

type Props = {
  initialSnapshot: Snapshot;
};

/**
 * Live-polling replacement for the static backlog panel on the
 * Ingestion & Data Management admin page. Polls
 * /api/admin/ingestion-status every 15 seconds so an admin watching
 * the page sees content counts climb, status changes (active → running
 * → failed), and the 24-hour edit counts under each bucket without
 * having to refresh.
 *
 * The initial snapshot is taken at server-render time so the page is
 * useful immediately even before the first poll lands.
 */
export function LiveBacklogPanel({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot);
  const [polling, setPolling] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date());
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      setPolling(true);
      try {
        const res = await fetch("/api/admin/ingestion-status", { cache: "no-store" });
        if (!res.ok) {
          setPollError(`Poll failed: ${res.status}`);
        } else {
          const data = (await res.json()) as Snapshot;
          setSnapshot(data);
          setLastUpdatedAt(new Date());
          setPollError(null);
        }
      } catch (err) {
        setPollError((err as Error).message);
      } finally {
        if (!cancelled) setPolling(false);
      }
      timer = setTimeout(tick, 15_000);
    }

    timer = setTimeout(tick, 15_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const { progress, status, statusDetail, activity24h, settings, latestRun } = snapshot;

  function activityFor(key: keyof Counts): number {
    const types = COUNT_TO_CONTENT_TYPES[key];
    let total = 0;
    for (const t of types) total += activity24h[t] ?? 0;
    // For sacrament / consecration which share SpiritualLifeGuide,
    // the same number shows under both — the activity feed cannot
    // distinguish them without re-reading the slugs, so we just show
    // the SLG total under each.
    return total;
  }

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl">Backlog progress</h2>
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-0.5 font-serif text-xs text-white"
          style={{ backgroundColor: STATUS_COLOR[status] }}
        >
          {STATUS_LABEL[status]}
        </span>
        <span className="vf-eyebrow text-ink-faint">
          {polling ? "Updating…" : `Updated ${lastUpdatedAt.toLocaleTimeString()}`}
        </span>
        {pollError ? (
          <span className="font-serif text-xs text-liturgical-red">{pollError}</span>
        ) : null}
      </div>
      <p className="mb-4 font-serif text-sm text-ink-soft">
        {statusDetail}
        {settings.autoCleanupEnabled ? null : (
          <span className="ml-1 font-medium">
            Auto Data Management is paused — toggle it back on at the top of the page.
          </span>
        )}
      </p>

      {progress ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(LABELS) as Array<keyof Counts>).map((key) => {
            const count = progress.counts[key];
            const target = progress.targets[key];
            const pct = Math.min(100, Math.round((count / Math.max(1, target)) * 100));
            const met = count >= target;
            const edits = activityFor(key);
            return (
              <div key={key} className="vf-card rounded-sm p-5">
                <p className="vf-eyebrow">{LABELS[key]}</p>
                <p className="mt-2 font-display text-3xl">
                  {count.toLocaleString()}{" "}
                  <span className="text-base text-ink-faint">/ {target.toLocaleString()}</span>
                </p>
                <div className="mt-3 h-2 w-full rounded-sm bg-ink/10">
                  <div
                    className={`h-2 rounded-sm ${met ? "bg-emerald-600" : "bg-ink"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  {pct}% · {met ? "target met" : "below target"}
                </p>
                <p className="mt-2 text-xs text-ink-faint">
                  {edits === 0
                    ? status === "disabled"
                      ? "0 edits in last 24h · auto-cleanup disabled"
                      : status === "blocked"
                        ? "0 edits in last 24h · scheduler blocked"
                        : status === "stale"
                          ? "0 edits in last 24h · no recent runs"
                          : "0 edits in last 24h · no new upstream content (skipped)"
                    : `${edits} edit${edits === 1 ? "" : "s"} in last 24h`}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="font-serif text-sm text-ink-faint">Backlog progress is unavailable.</p>
      )}

      {latestRun ? (
        <p className="mt-4 font-serif text-xs text-ink-faint">
          Last run · {latestRun.sourceName} → {latestRun.jobName} ·{" "}
          {new Date(latestRun.startedAt).toLocaleString()} · {latestRun.status} · created{" "}
          {latestRun.recordsCreated} / updated {latestRun.recordsUpdated} / skipped{" "}
          {latestRun.recordsSkipped}
          {latestRun.errorMessage ? (
            <>
              {" · "}
              <span className="text-liturgical-red">{latestRun.errorMessage.slice(0, 200)}</span>
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

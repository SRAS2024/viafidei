"use client";

import { useEffect, useState, useTransition } from "react";

type QueueRow = {
  id: string;
  jobName: string;
  contentType: string | null;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  lastError: string | null;
  sentToReviewAt: string | null;
};

const FILTER_PRESETS: Array<{
  key: string;
  label: string;
  status?: string[];
  needsReview?: boolean;
  errorLike?: string;
}> = [
  { key: "all", label: "All" },
  { key: "failed", label: "Failed jobs", status: ["failed"] },
  { key: "skipped", label: "Skipped jobs", status: ["skipped"] },
  { key: "review", label: "Review required", needsReview: true },
  {
    key: "source",
    label: "Source errors",
    status: ["failed", "retrying"],
    errorLike: "HTTP",
  },
  {
    key: "format",
    label: "Formatting errors",
    status: ["failed", "retrying"],
    errorLike: "format",
  },
];

export function QueueFilters({ initial }: { initial: QueueRow[] }) {
  const [rows, setRows] = useState<QueueRow[]>(initial);
  const [activeKey, setActiveKey] = useState<string>("all");
  const [pending, startTransition] = useTransition();

  const preset = FILTER_PRESETS.find((p) => p.key === activeKey) ?? FILTER_PRESETS[0];

  useEffect(() => {
    if (activeKey === "all") {
      setRows(initial);
      return;
    }
    const params = new URLSearchParams();
    if (preset.status) params.set("status", preset.status.join(","));
    if (preset.needsReview) params.set("needsReview", "1");
    params.set("take", "100");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/ingestion/queue/list?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { rows: QueueRow[] };
        let filtered = data.rows;
        if (preset.errorLike) {
          const needle = preset.errorLike.toLowerCase();
          filtered = filtered.filter(
            (r) =>
              (r.errorMessage ?? "").toLowerCase().includes(needle) ||
              (r.lastError ?? "").toLowerCase().includes(needle),
          );
        }
        setRows(filtered);
      } catch {
        // silent — keep previous rows
      }
    });
  }, [activeKey, preset, initial]);

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="vf-eyebrow">Filter</span>
        {FILTER_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setActiveKey(p.key)}
            className={`rounded-sm border px-2 py-1 font-serif text-xs ${
              activeKey === p.key ? "border-ink bg-ink text-white" : "border-ink/30 hover:bg-ink/5"
            }`}
          >
            {p.label}
          </button>
        ))}
        {pending ? <span className="font-serif text-xs text-ink-faint">loading…</span> : null}
      </div>
      <div className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <div className="vf-card rounded-sm p-8 text-center font-serif text-ink-faint">
            No queue rows match this filter.
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="vf-card rounded-sm p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base">{r.jobName}</h3>
                  <p className="font-serif text-xs text-ink-faint">
                    {r.contentType ?? "—"} · status: {r.status} · attempt {r.attempts}/
                    {r.maxAttempts}
                  </p>
                </div>
                <span
                  className={`font-serif text-xs ${
                    r.status === "failed"
                      ? "text-red-700"
                      : r.status === "retrying"
                        ? "text-amber-700"
                        : r.status === "completed"
                          ? "text-emerald-700"
                          : "text-ink-soft"
                  }`}
                >
                  {r.status}
                </span>
              </div>
              {r.errorMessage ? (
                <p className="mt-2 font-serif text-xs text-red-700">{r.errorMessage}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";

export interface ReviewItem {
  id: string;
  contentType: string | null;
  contentTitle: string | null;
  proposedAction: string;
  reason: string;
  confidence: number;
  /** The proposed change, extracted for display (e.g. the proposed Latin/Greek). */
  proposedText: string | null;
}

/**
 * The actual approve/deny interface for the human-review queue. Approving POSTs
 * to the review endpoint, which applies the change to live content; denying
 * rejects it. Resolved rows drop out of the list immediately.
 */
export function ReviewQueueClient({ items: initial }: { items: ReviewItem[] }) {
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const decide = (id: string, decision: "APPROVED" | "REJECTED") => {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/admin-worker/review/${id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision }),
        });
        if (!res.ok) throw new Error((await res.text()) || `Failed with ${res.status}`);
        setItems((xs) => xs.filter((x) => x.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    });
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-ink-soft">Nothing pending — the worker has cleared the queue.</p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {items.map((it) => (
        <div key={it.id} className="rounded border border-ink/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-medium text-ink">
                {it.contentTitle ?? it.contentType ?? "Item"}
              </span>{" "}
              <span className="text-[10px] uppercase tracking-wide text-ink-faint">
                {it.proposedAction}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => decide(it.id, "APPROVED")}
                disabled={busyId === it.id}
                className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => decide(it.id, "REJECTED")}
                disabled={busyId === it.id}
                className="rounded bg-rose-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                Deny
              </button>
            </div>
          </div>
          <p className="mt-1 text-sm text-ink-soft">{it.reason}</p>
          {it.proposedText ? (
            <p
              translate="no"
              className="mt-2 whitespace-pre-line rounded bg-slate-50 p-2 font-serif text-sm text-ink"
            >
              {it.proposedText}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

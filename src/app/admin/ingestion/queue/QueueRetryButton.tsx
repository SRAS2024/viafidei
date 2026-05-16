"use client";

import { useState, useTransition } from "react";

export function QueueRetryButton({ jobQueueId }: { jobQueueId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const res = await fetch("/api/admin/ingestion/queue/retry", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ jobQueueId }),
            });
            if (!res.ok) {
              setMessage(`Failed: HTTP ${res.status}`);
              return;
            }
            setMessage("Re-queued.");
          })
        }
        className="rounded-sm border border-ink/30 px-3 py-1 font-serif text-xs hover:bg-ink/5 disabled:opacity-50"
      >
        {pending ? "Re-queuing…" : "Retry"}
      </button>
      {message ? <p className="font-serif text-xs text-ink-faint">{message}</p> : null}
    </div>
  );
}

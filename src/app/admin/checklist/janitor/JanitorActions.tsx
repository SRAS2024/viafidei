"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { JanitorAction } from "@/lib/checklist";

interface Props {
  itemId: string;
  action: JanitorAction;
}

export function JanitorActions({ itemId, action }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (op: "accept" | "dismiss") => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/checklist/janitor/${itemId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op, action }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status}: ${text}`);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run("accept")}
        className={`rounded px-2 py-1 text-xs text-white disabled:opacity-50 ${
          action === "delete" ? "bg-rose-600" : "bg-emerald-600"
        }`}
      >
        {action === "delete" ? "Unpublish" : "Rebuild"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run("dismiss")}
        className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
      >
        Dismiss
      </button>
      {error && (
        <span className="ml-2 text-xs text-rose-700" title={error}>
          ⚠
        </span>
      )}
    </div>
  );
}

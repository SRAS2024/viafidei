"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ChecklistApprovalStatus } from "@prisma/client";

interface Props {
  itemId: string;
  status: ChecklistApprovalStatus;
}

async function postAction(itemId: string, action: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`/api/admin/checklist/${itemId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export function ItemActionsClient({ itemId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [citationUrl, setCitationUrl] = useState("");

  const run = (action: string, body: Record<string, unknown> = {}) => {
    setError(null);
    startTransition(async () => {
      try {
        await postAction(itemId, action, body);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <h2 className="font-display text-lg text-ink">Actions</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={pending || (status !== "DISCOVERED" && status !== "SOURCE_VERIFIED")}
          onClick={() => run("verify-sources")}
        >
          Mark source verified
        </button>
        <button
          type="button"
          className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={pending || status !== "SOURCE_VERIFIED"}
          onClick={() => run("approve")}
        >
          Approve for build
        </button>
        <button
          type="button"
          className="rounded bg-amber-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={pending}
          onClick={() => run("rebuild")}
        >
          Rebuild
        </button>
        <button
          type="button"
          className="rounded bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={pending || status === "PUBLISHED"}
          onClick={() => run("publish")}
        >
          Publish (bypass QA review)
        </button>
        <button
          type="button"
          className="rounded bg-slate-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={pending || status !== "PUBLISHED"}
          onClick={() => run("unpublish")}
        >
          Unpublish
        </button>
        <button
          type="button"
          className="rounded bg-rose-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={pending}
          onClick={() => {
            const reason = window.prompt("Reject reason?");
            if (!reason) return;
            run("reject", { reason });
          }}
        >
          Reject
        </button>
      </div>

      <div className="mt-4 flex gap-2 items-end">
        <label className="flex-1 text-sm">
          <span className="block text-xs text-ink-soft">Add citation URL</span>
          <input
            type="url"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="https://www.vatican.va/..."
            value={citationUrl}
            onChange={(e) => setCitationUrl(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={pending || !citationUrl}
          onClick={() => {
            run("add-citation", { sourceUrl: citationUrl });
            setCitationUrl("");
          }}
        >
          Add
        </button>
      </div>

      {error && <p className="mt-3 rounded bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
    </section>
  );
}

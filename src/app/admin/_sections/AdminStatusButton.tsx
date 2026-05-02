"use client";

import { useState } from "react";

type ContentStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

type Props = {
  id: string;
  currentStatus: ContentStatus;
  apiBase: string;
  onStatusChange?: (id: string, newStatus: ContentStatus) => void;
};

const NEXT_ACTIONS: Record<
  ContentStatus,
  Array<{ label: string; status: ContentStatus; className: string }>
> = {
  DRAFT: [
    {
      label: "Publish",
      status: "PUBLISHED",
      className: "text-green-700 border-green-200 hover:bg-green-50",
    },
    {
      label: "Review",
      status: "REVIEW",
      className: "text-amber-600 border-amber-200 hover:bg-amber-50",
    },
  ],
  REVIEW: [
    {
      label: "Publish",
      status: "PUBLISHED",
      className: "text-green-700 border-green-200 hover:bg-green-50",
    },
    {
      label: "Archive",
      status: "ARCHIVED",
      className: "text-red-600 border-red-200 hover:bg-red-50",
    },
  ],
  PUBLISHED: [
    {
      label: "Archive",
      status: "ARCHIVED",
      className: "text-red-600 border-red-200 hover:bg-red-50",
    },
    {
      label: "To Review",
      status: "REVIEW",
      className: "text-amber-600 border-amber-200 hover:bg-amber-50",
    },
  ],
  ARCHIVED: [
    {
      label: "Republish",
      status: "PUBLISHED",
      className: "text-green-700 border-green-200 hover:bg-green-50",
    },
    {
      label: "To Draft",
      status: "DRAFT",
      className: "text-ink-faint border-ink/10 hover:bg-ink/5",
    },
  ],
};

export function AdminStatusButton({ id, currentStatus, apiBase, onStatusChange }: Props) {
  const [status, setStatus] = useState<ContentStatus>(currentStatus);
  const [busy, setBusy] = useState(false);
  const actions = NEXT_ACTIONS[status] ?? [];

  async function applyStatus(newStatus: ContentStatus) {
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        onStatusChange?.(id, newStatus);
      } else {
        console.error("Status change failed", await res.text());
      }
    } catch (e) {
      console.error("Status change error", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {actions.map((action) => (
        <button
          key={action.status}
          disabled={busy}
          onClick={() => applyStatus(action.status)}
          className={`vf-btn vf-btn-ghost !py-1 !px-3 text-xs disabled:opacity-50 ${action.className}`}
        >
          {busy ? "…" : action.label}
        </button>
      ))}
    </div>
  );
}

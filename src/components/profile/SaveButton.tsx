"use client";

import { useState, useTransition } from "react";

export type SaveKind = "prayers" | "saints" | "apparitions" | "parishes" | "devotions";

type Props = {
  kind: SaveKind;
  entityId: string;
  initiallySaved: boolean;
  labels?: {
    save?: string;
    saved?: string;
    remove?: string;
    confirmRemove?: string;
  };
  className?: string;
};

const DEFAULT_LABELS = {
  save: "Save",
  saved: "Saved",
  remove: "Remove",
  confirmRemove: "Remove this from your saved items?",
};

export function SaveButton({ kind, entityId, initiallySaved, labels, className }: Props) {
  const merged = { ...DEFAULT_LABELS, ...labels };
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        if (saved) {
          if (typeof window !== "undefined" && !window.confirm(merged.confirmRemove)) return;
          const res = await fetch(`/api/saved/${kind}?id=${encodeURIComponent(entityId)}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error(await res.text());
          setSaved(false);
        } else {
          const res = await fetch(`/api/saved/${kind}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: entityId }),
          });
          if (!res.ok) throw new Error(await res.text());
          setSaved(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "error");
      }
    });
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-liturgical transition ${
          saved
            ? "border-liturgical-gold bg-liturgical-gold/10 text-ink"
            : "border-ink/20 hover:bg-ink/5"
        } disabled:opacity-50`}
      >
        {pending ? "…" : saved ? merged.saved : merged.save}
      </button>
      {error ? <span className="ml-2 text-xs text-liturgical-red">{error}</span> : null}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  entryId: string;
  initialTitle: string;
  initialBody: string;
  labels: {
    edit: string;
    title: string;
    body: string;
    save: string;
    cancel: string;
  };
};

export function JournalEditButton({ entryId, initialTitle, initialBody, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/journal/${entryId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      if (!res.ok) {
        setError("Failed to save. Please try again.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-sm text-ink-faint hover:text-ink"
        onClick={() => setOpen(true)}
      >
        {labels.edit}
      </button>
    );
  }

  return (
    <div className="mt-4 vf-card rounded-sm p-6">
      <label className="vf-label" htmlFor={`edit-title-${entryId}`}>
        {labels.title}
      </label>
      <input
        id={`edit-title-${entryId}`}
        className="vf-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <label className="vf-label mt-4" htmlFor={`edit-body-${entryId}`}>
        {labels.body}
      </label>
      <textarea
        id={`edit-body-${entryId}`}
        rows={6}
        className="vf-input"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {error ? <p className="mt-2 text-sm text-liturgical-red">{error}</p> : null}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          className="vf-btn vf-btn-cancel"
          onClick={() => {
            setOpen(false);
            setTitle(initialTitle);
            setBody(initialBody);
          }}
        >
          {labels.cancel}
        </button>
        <button
          type="button"
          className="vf-btn vf-btn-primary"
          disabled={pending || !title.trim() || !body.trim()}
          onClick={handleSave}
        >
          {pending ? "…" : labels.save}
        </button>
      </div>
    </div>
  );
}

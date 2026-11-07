"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  const titleRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const refocusEdit = useRef(false);

  useEffect(() => {
    if (open) {
      titleRef.current?.focus();
    } else if (refocusEdit.current) {
      refocusEdit.current = false;
      editRef.current?.focus();
    }
  }, [open]);

  function handleSave() {
    if (pending) return;
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
      refocusEdit.current = true;
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        ref={editRef}
        type="button"
        className="vf-btn vf-btn-sm vf-btn-ghost"
        aria-label={`${labels.edit}: ${initialTitle}`}
        onClick={() => setOpen(true)}
      >
        {labels.edit}
      </button>
    );
  }

  return (
    <form
      className="vf-panel-inset vf-form !mt-0 w-full"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div>
        <label className="vf-label" htmlFor={`edit-title-${entryId}`}>
          {labels.title}
        </label>
        <input
          ref={titleRef}
          id={`edit-title-${entryId}`}
          className="vf-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label className="vf-label" htmlFor={`edit-body-${entryId}`}>
          {labels.body}
        </label>
        <textarea
          id={`edit-body-${entryId}`}
          rows={6}
          className="vf-input vf-input-prose"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="vf-notice vf-notice-error">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="vf-btn vf-btn-primary"
          disabled={!title.trim() || !body.trim()}
          aria-disabled={pending}
          aria-busy={pending}
        >
          {labels.save}
        </button>
        <button
          type="button"
          className="vf-btn vf-btn-ghost"
          onClick={() => {
            refocusEdit.current = true;
            setOpen(false);
            setTitle(initialTitle);
            setBody(initialBody);
          }}
        >
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}

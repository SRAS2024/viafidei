"use client";

import { useState } from "react";

export function JournalEditor({
  labels,
}: {
  labels: { title: string; body: string; save: string; cancel: string; newEntry: string };
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex justify-center">
        <button className="vf-btn vf-btn-primary" onClick={() => setOpen(true)}>
          {labels.newEntry}
        </button>
      </div>
    );
  }

  return (
    <form method="post" action="/api/journal" className="vf-card mx-auto max-w-2xl rounded-sm p-6">
      <label className="vf-label" htmlFor="journalTitle">{labels.title}</label>
      <input id="journalTitle" name="title" required className="vf-input" />
      <label className="vf-label mt-4" htmlFor="journalBody">{labels.body}</label>
      <textarea id="journalBody" name="body" rows={6} required className="vf-input" />
      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" className="vf-btn vf-btn-cancel" onClick={() => setOpen(false)}>
          {labels.cancel}
        </button>
        <button type="submit" className="vf-btn vf-btn-primary">{labels.save}</button>
      </div>
    </form>
  );
}

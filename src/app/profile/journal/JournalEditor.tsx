"use client";

import { useRef, useState } from "react";

type ToolbarAction = {
  label: string;
  insertBefore: string;
  insertAfter: string;
  /** ARIA label for the button. */
  aria: string;
};

const TOOLBAR: ToolbarAction[] = [
  { label: "B", insertBefore: "**", insertAfter: "**", aria: "Bold" },
  { label: "I", insertBefore: "_", insertAfter: "_", aria: "Italic" },
  { label: "H", insertBefore: "\n## ", insertAfter: "\n", aria: "Heading" },
  { label: "“ ”", insertBefore: "\n> ", insertAfter: "\n", aria: "Blockquote" },
  { label: "• ", insertBefore: "\n- ", insertAfter: "", aria: "Bulleted list item" },
  { label: "1.", insertBefore: "\n1. ", insertAfter: "", aria: "Numbered list item" },
];

function wrapSelection(textarea: HTMLTextAreaElement, insertBefore: string, insertAfter: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);
  const next = value.slice(0, start) + insertBefore + selected + insertAfter + value.slice(end);
  textarea.value = next;
  const newPos = start + insertBefore.length + selected.length;
  textarea.setSelectionRange(newPos, newPos);
  textarea.focus();
}

export function JournalEditor({
  labels,
}: {
  labels: { title: string; body: string; save: string; cancel: string; newEntry: string };
}) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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
      <label className="vf-label" htmlFor="journalTitle">
        {labels.title}
      </label>
      <input id="journalTitle" name="title" required className="vf-input" />
      <label className="vf-label mt-4" htmlFor="journalBody">
        {labels.body}
      </label>
      {/* Lightweight formatting toolbar. Inserts simple Markdown syntax
          into the textarea so the journal stays plain text but renders
          richly in the PDF export. */}
      <div
        role="toolbar"
        aria-label="Formatting"
        className="mb-1 flex flex-wrap gap-1 border border-ink/15 bg-ink/[0.02] p-1"
      >
        {TOOLBAR.map((a) => (
          <button
            key={a.aria}
            type="button"
            aria-label={a.aria}
            className="rounded-sm px-2 py-1 font-serif text-sm text-ink-soft transition hover:bg-ink/10 hover:text-ink"
            onClick={() => {
              const ta = bodyRef.current;
              if (!ta) return;
              wrapSelection(ta, a.insertBefore, a.insertAfter);
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <textarea
        id="journalBody"
        name="body"
        rows={10}
        required
        ref={bodyRef}
        className="vf-input font-serif leading-relaxed"
        placeholder="Write freely. Markdown shortcuts: **bold**, _italic_, ## heading, > quote, - bullet."
      />
      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" className="vf-btn vf-btn-cancel" onClick={() => setOpen(false)}>
          {labels.cancel}
        </button>
        <button type="submit" className="vf-btn vf-btn-primary">
          {labels.save}
        </button>
      </div>
    </form>
  );
}

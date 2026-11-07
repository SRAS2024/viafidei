"use client";

import { useEffect, useRef, useState } from "react";

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
  const titleRef = useRef<HTMLInputElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const refocusOpen = useRef(false);

  // Opening puts the reader in the first field; cancelling puts them back on the
  // button that opened it.
  useEffect(() => {
    if (open) {
      titleRef.current?.focus();
    } else if (refocusOpen.current) {
      refocusOpen.current = false;
      openRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return (
      <button
        ref={openRef}
        type="button"
        className="vf-btn vf-btn-primary"
        onClick={() => setOpen(true)}
      >
        {labels.newEntry}
      </button>
    );
  }

  return (
    <form method="post" action="/api/journal" className="vf-panel vf-form w-full">
      <div>
        <label className="vf-label" htmlFor="journalTitle">
          {labels.title}
        </label>
        <input ref={titleRef} id="journalTitle" name="title" required className="vf-input" />
      </div>
      <div>
        <label className="vf-label" htmlFor="journalBody">
          {labels.body}
        </label>
        {/* Lightweight formatting bar. Inserts simple Markdown syntax into the
            textarea so the journal stays plain text but renders richly in the PDF
            export. A plain group: each mark is its own stop for the Tab key. */}
        <div role="group" aria-label="Formatting" className="vf-format-bar">
          {TOOLBAR.map((a) => (
            <button
              key={a.aria}
              type="button"
              aria-label={a.aria}
              className="vf-btn vf-btn-sm vf-btn-ghost"
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
          className="vf-input vf-input-prose"
          placeholder="Write freely. Markdown shortcuts: **bold**, _italic_, ## heading, > quote, - bullet."
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="vf-btn vf-btn-primary">
          {labels.save}
        </button>
        <button
          type="button"
          className="vf-btn vf-btn-ghost"
          onClick={() => {
            refocusOpen.current = true;
            setOpen(false);
          }}
        >
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}

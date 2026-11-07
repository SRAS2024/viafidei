"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  JournalDraftNotice,
  JournalSaveAlert,
  forgetJournalDraft,
  journalFieldProblems,
  keepJournalDraft,
  readJournalDraft,
  sendJournalEntry,
  useJournalLeaveGuard,
  type JournalDraft,
  type JournalFieldProblems,
  type JournalSaveFailure,
  type JournalSaveLabels,
} from "./journal-save";

const TITLE_ERROR_ID = "journal-title-error";
const BODY_ERROR_ID = "journal-body-error";

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
  draftKey,
  labels,
}: {
  /** Where this form's unsaved words are kept. Carries the account, so that nobody else
      who signs in with this tab open is handed them. */
  draftKey: string;
  labels: {
    title: string;
    body: string;
    save: string;
    cancel: string;
    newEntry: string;
    saved: string;
  } & JournalSaveLabels;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<JournalSaveFailure | null>(null);
  const [problems, setProblems] = useState<JournalFieldProblems>({ title: null, body: null });
  const [restored, setRestored] = useState<JournalDraft | null>(null);
  const router = useRouter();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const refocusOpen = useRef(false);

  useJournalLeaveGuard(draftKey, labels.leaveWarning);

  // Words left unsaved when the reader went elsewhere are waiting when they come back.
  useEffect(() => {
    const draft = readJournalDraft(draftKey);
    if (!draft) return;
    setRestored(draft);
    setOpen(true);
  }, [draftKey]);

  // Opening puts the reader in the first field, unless the draft's notice has taken focus
  // to say why the form is open; cancelling puts them back on the button that opened it.
  useEffect(() => {
    if (open) {
      if (!restored) titleRef.current?.focus();
    } else if (refocusOpen.current) {
      refocusOpen.current = false;
      openRef.current?.focus();
    }
  }, [open, restored]);

  function keepDraft() {
    keepJournalDraft(draftKey, {
      title: titleRef.current?.value ?? "",
      body: bodyRef.current?.value ?? "",
    });
  }

  function checkFields(): JournalFieldProblems {
    const found = journalFieldProblems(
      titleRef.current?.value ?? "",
      bodyRef.current?.value ?? "",
      labels,
    );
    setProblems(found);
    return found;
  }

  // Once a field has been found too long, its message goes as soon as its reason does.
  function onFieldChange() {
    keepDraft();
    if (problems.title || problems.body) checkFields();
  }

  function closeForm() {
    forgetJournalDraft(draftKey);
    setRestored(null);
    refocusOpen.current = true;
    setOpen(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Never a plain post: its failure would be a fresh page, and the words would be gone.
    event.preventDefault();
    if (saving) return;
    setFailure(null);
    const found = checkFields();
    if (found.title || found.body) {
      (found.title ? titleRef : bodyRef).current?.focus();
      return;
    }
    setSaving(true);
    const { failure: failed } = await sendJournalEntry("/api/journal", "POST", {
      title: titleRef.current?.value ?? "",
      body: bodyRef.current?.value ?? "",
    });
    setSaving(false);
    if (failed) {
      setFailure(failed);
      return;
    }
    closeForm();
    setSaved(true);
    router.refresh();
  }

  return (
    <>
      {open ? (
        <form
          method="post"
          action="/api/journal"
          className="vf-panel vf-form w-full"
          onSubmit={handleSubmit}
        >
          {restored ? <JournalDraftNotice text={labels.draftBack} /> : null}
          <div>
            <label className="vf-label" htmlFor="journalTitle">
              {labels.title}
            </label>
            <input
              ref={titleRef}
              id="journalTitle"
              name="title"
              required
              className="vf-input"
              defaultValue={restored?.title}
              onInput={onFieldChange}
              aria-invalid={problems.title ? true : undefined}
              aria-describedby={problems.title ? TITLE_ERROR_ID : undefined}
            />
            {problems.title ? (
              <p id={TITLE_ERROR_ID} role="alert" className="vf-field-error">
                {problems.title}
              </p>
            ) : null}
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
                    onFieldChange();
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
              defaultValue={restored?.body}
              onInput={onFieldChange}
              aria-invalid={problems.body ? true : undefined}
              aria-describedby={problems.body ? BODY_ERROR_ID : undefined}
            />
            {problems.body ? (
              <p id={BODY_ERROR_ID} role="alert" className="vf-field-error">
                {problems.body}
              </p>
            ) : null}
          </div>
          <JournalSaveAlert failure={failure} labels={labels} />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="vf-btn vf-btn-primary"
              aria-disabled={saving}
              aria-busy={saving}
            >
              {labels.save}
            </button>
            <button
              type="button"
              className="vf-btn vf-btn-ghost"
              onClick={() => {
                closeForm();
                setFailure(null);
                setProblems({ title: null, body: null });
              }}
            >
              {labels.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button
          ref={openRef}
          type="button"
          className="vf-btn vf-btn-primary"
          onClick={() => {
            setSaved(false);
            setOpen(true);
          }}
        >
          {labels.newEntry}
        </button>
      )}
      {/* Always in the page, so that the words appearing in it are announced. Last in
          the toolbar's row: an entry saved in the favorites view does not show in the
          list below, so a sighted reader needs telling too. */}
      <p role="status" className={saved ? "vf-notice order-last w-full" : "sr-only"}>
        {saved ? labels.saved : null}
      </p>
    </>
  );
}

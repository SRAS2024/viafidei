"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  JournalDraftNotice,
  JournalSaveAlert,
  forgetJournalDraft,
  journalFieldProblems,
  keepJournalDraft,
  readJournalDraft,
  sendJournalEntry,
  useJournalLeaveGuard,
  type JournalFieldProblems,
  type JournalSaveFailure,
  type JournalSaveLabels,
} from "./journal-save";

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
  } & JournalSaveLabels;
};

export function JournalEditButton({ entryId, initialTitle, initialBody, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<JournalSaveFailure | null>(null);
  const [problems, setProblems] = useState<JournalFieldProblems>({ title: null, body: null });
  const [restored, setRestored] = useState(false);
  const router = useRouter();
  const titleRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const refocusEdit = useRef(false);
  const titleErrorId = `edit-title-${entryId}-error`;
  const bodyErrorId = `edit-body-${entryId}-error`;
  const draftKey = `entry:${entryId}`;

  useJournalLeaveGuard(draftKey, labels.leaveWarning);

  // A change left unsaved when the reader went elsewhere is waiting when they come back.
  useEffect(() => {
    const draft = readJournalDraft(draftKey);
    if (!draft) return;
    setTitle(draft.title);
    setBody(draft.body);
    setRestored(true);
    setOpen(true);
  }, [draftKey]);

  useEffect(() => {
    if (open) {
      // The draft's notice has taken focus, to say why the form is open.
      if (!restored) titleRef.current?.focus();
    } else if (refocusEdit.current) {
      refocusEdit.current = false;
      editRef.current?.focus();
    }
  }, [open, restored]);

  // Only a change is unsaved: the entry itself is already safe.
  function keepDraft(nextTitle: string, nextBody: string) {
    if (nextTitle === initialTitle && nextBody === initialBody) forgetJournalDraft(draftKey);
    else keepJournalDraft(draftKey, { title: nextTitle, body: nextBody });
  }

  function closeForm() {
    forgetJournalDraft(draftKey);
    setRestored(false);
    refocusEdit.current = true;
    setOpen(false);
  }

  // Once a field has been found too long, its message goes as soon as its reason does.
  useEffect(() => {
    setProblems((current) =>
      current.title || current.body ? journalFieldProblems(title, body, labels) : current,
    );
  }, [title, body, labels]);

  async function handleSave() {
    if (saving) return;
    setFailure(null);
    const found = journalFieldProblems(title, body, labels);
    setProblems(found);
    if (found.title || found.body) {
      (found.title ? titleRef : bodyRef).current?.focus();
      return;
    }
    setSaving(true);
    const { failure: failed } = await sendJournalEntry(`/api/journal/${entryId}`, "PATCH", {
      title,
      body,
    });
    setSaving(false);
    if (failed) {
      setFailure(failed);
      return;
    }
    closeForm();
    router.refresh();
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
        void handleSave();
      }}
    >
      {restored ? <JournalDraftNotice text={labels.draftBack} /> : null}
      <div>
        <label className="vf-label" htmlFor={`edit-title-${entryId}`}>
          {labels.title}
        </label>
        <input
          ref={titleRef}
          id={`edit-title-${entryId}`}
          className="vf-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            keepDraft(e.target.value, body);
          }}
          aria-invalid={problems.title ? true : undefined}
          aria-describedby={problems.title ? titleErrorId : undefined}
        />
        {problems.title ? (
          <p id={titleErrorId} role="alert" className="vf-field-error">
            {problems.title}
          </p>
        ) : null}
      </div>
      <div>
        <label className="vf-label" htmlFor={`edit-body-${entryId}`}>
          {labels.body}
        </label>
        <textarea
          ref={bodyRef}
          id={`edit-body-${entryId}`}
          rows={6}
          className="vf-input vf-input-prose"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            keepDraft(title, e.target.value);
          }}
          aria-invalid={problems.body ? true : undefined}
          aria-describedby={problems.body ? bodyErrorId : undefined}
        />
        {problems.body ? (
          <p id={bodyErrorId} role="alert" className="vf-field-error">
            {problems.body}
          </p>
        ) : null}
      </div>
      <JournalSaveAlert failure={failure} labels={labels} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="vf-btn vf-btn-primary"
          disabled={!title.trim() || !body.trim()}
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
            setTitle(initialTitle);
            setBody(initialBody);
            setFailure(null);
            setProblems({ title: null, body: null });
          }}
        >
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}

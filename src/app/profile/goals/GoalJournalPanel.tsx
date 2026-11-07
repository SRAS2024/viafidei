"use client";

import { useEffect, useId, useRef, useState } from "react";
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
} from "../journal/journal-save";

export type GoalJournalEntry = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

type Props = {
  goalId: string;
  /** Initial entries supplied by the server when the goal first renders. */
  initialEntries?: GoalJournalEntry[];
  /** When true, the panel is open and lazily fetches the user's
   *  journal entries scoped to this goal. */
  open: boolean;
  labels: JournalSaveLabels;
};

/** Where a goal's panel keeps its unsaved words. The goal's own card reads it too. */
export function goalDraftKey(goalId: string): string {
  return `goal:${goalId}`;
}

/**
 * Inline journal panel rendered under each goal card. Lets a user
 * record reflections, progress, struggles, graces received, and
 * completion notes against the goal they're walking. Entries persist
 * with the goal: when the goal is later marked complete, they show
 * up under the user's Completed Goals view on their profile.
 */
export function GoalJournalPanel({ goalId, initialEntries, open, labels }: Props) {
  const [entries, setEntries] = useState<GoalJournalEntry[]>(initialEntries ?? []);
  const [loaded, setLoaded] = useState(!!initialEntries);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<JournalSaveFailure | null>(null);
  const [problems, setProblems] = useState<JournalFieldProblems>({ title: null, body: null });
  const [restored, setRestored] = useState(false);
  const [pending, setPending] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const uid = useId();
  const titleErrorId = `${uid}-title-error`;
  const bodyErrorId = `${uid}-body-error`;
  const draftKey = goalDraftKey(goalId);

  useJournalLeaveGuard(draftKey, labels.leaveWarning);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/journal?goalId=${encodeURIComponent(goalId)}&sort=newest&take=200`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { entries: GoalJournalEntry[] };
        if (!cancelled) {
          setEntries(data.entries ?? []);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setError("Could not load journal entries.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goalId, open, loaded]);

  // Words left unsaved when the reader went elsewhere are waiting when they come back. The
  // goal's card opens the panel for them.
  useEffect(() => {
    const draft = readJournalDraft(draftKey);
    if (!draft) return;
    setTitle(draft.title);
    setBody(draft.body);
    setRestored(true);
  }, [draftKey]);

  // What is checked is what gets sent, and that is trimmed. Once a field has been found too
  // long, its message goes as soon as its reason does.
  useEffect(() => {
    setProblems((current) =>
      current.title || current.body
        ? journalFieldProblems(title.trim(), body.trim(), labels)
        : current,
    );
  }, [title, body, labels]);

  async function submit() {
    const t = title.trim();
    const b = body.trim();
    if (!t || !b || pending) return;
    setError(null);
    setFailure(null);
    const found = journalFieldProblems(t, b, labels);
    setProblems(found);
    if (found.title || found.body) {
      (found.title ? titleRef : bodyRef).current?.focus();
      return;
    }
    setPending(true);
    const sent = await sendJournalEntry("/api/journal", "POST", { title: t, body: b, goalId });
    setPending(false);
    if (sent.failure) {
      setFailure(sent.failure);
      return;
    }
    // It is saved, whatever becomes of this answer. If it cannot be read, the list is
    // fetched again.
    const data = (await sent.response.json().catch(() => null)) as {
      entry?: GoalJournalEntry;
    } | null;
    if (data?.entry) {
      const entry = data.entry;
      setEntries((prev) => [entry, ...prev]);
    } else {
      setLoaded(false);
    }
    forgetJournalDraft(draftKey);
    setRestored(false);
    setTitle("");
    setBody("");
    titleRef.current?.focus();
  }

  if (!open) return null;

  return (
    <div className="vf-panel-inset">
      {/* The count is live so a saved entry is announced where it is made. */}
      <p className="vf-eyebrow" aria-live="polite">
        Journal · {entries.length}
      </p>
      <p className="vf-fineprint mt-1">
        Record reflections, progress, struggles, graces, and completion notes — kept with this goal
        in your spiritual history.
      </p>

      <form
        className="vf-form mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {restored ? <JournalDraftNotice text={labels.draftBack} /> : null}
        <div>
          <label className="vf-label" htmlFor={`${uid}-title`}>
            Entry title
          </label>
          {/* No maxLength here or below: a browser cuts pasted text at it without a word,
              so the limits are checked at Save, as on the journal page. */}
          <input
            ref={titleRef}
            id={`${uid}-title`}
            className="vf-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              keepJournalDraft(draftKey, { title: e.target.value, body });
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
          <label className="vf-label" htmlFor={`${uid}-body`}>
            What did God do in you today through this goal?
          </label>
          <textarea
            ref={bodyRef}
            id={`${uid}-body`}
            className="vf-input vf-input-prose"
            rows={3}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              keepJournalDraft(draftKey, { title, body: e.target.value });
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
        {error ? (
          <p role="alert" className="vf-notice vf-notice-error">
            {error}
          </p>
        ) : null}
        <JournalSaveAlert failure={failure} labels={labels} logInNext="/profile/goals" />
        <div>
          <button
            type="submit"
            className="vf-btn vf-btn-sm vf-btn-primary"
            disabled={!title.trim() || !body.trim()}
            aria-disabled={pending}
            aria-busy={pending}
          >
            Save entry
          </button>
        </div>
      </form>

      {entries.length > 0 ? (
        <ul className="vf-rows mt-4 border-t border-[color:var(--rule)]">
          {entries.map((entry) => {
            const created = new Date(entry.createdAt);
            return (
              <li key={entry.id} className="py-3">
                <h3 className="vf-row-title">{entry.title}</h3>
                <p className="vf-entry-meta">
                  {created.toLocaleDateString(labels.locale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <p className="vf-panel-text whitespace-pre-wrap">{entry.body}</p>
              </li>
            );
          })}
        </ul>
      ) : loaded ? (
        <p className="vf-fineprint mt-3">No journal entries yet for this goal.</p>
      ) : null}
    </div>
  );
}

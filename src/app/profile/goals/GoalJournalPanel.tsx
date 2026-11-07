"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

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
};

/**
 * Inline journal panel rendered under each goal card. Lets a user
 * record reflections, progress, struggles, graces received, and
 * completion notes against the goal they're walking. Entries persist
 * with the goal: when the goal is later marked complete, they show
 * up under the user's Completed Goals view on their profile.
 */
export function GoalJournalPanel({ goalId, initialEntries, open }: Props) {
  const [entries, setEntries] = useState<GoalJournalEntry[]>(initialEntries ?? []);
  const [loaded, setLoaded] = useState(!!initialEntries);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);
  const uid = useId();

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

  function submit() {
    const t = title.trim();
    const b = body.trim();
    if (!t || !b || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: t, body: b, goalId }),
      });
      if (!res.ok) {
        setError("Could not save journal entry.");
        return;
      }
      const data = (await res.json()) as { entry: GoalJournalEntry };
      setEntries((prev) => [data.entry, ...prev]);
      setTitle("");
      setBody("");
      titleRef.current?.focus();
    });
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
          submit();
        }}
      >
        <div>
          <label className="vf-label" htmlFor={`${uid}-title`}>
            Entry title
          </label>
          <input
            ref={titleRef}
            id={`${uid}-title`}
            className="vf-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>
        <div>
          <label className="vf-label" htmlFor={`${uid}-body`}>
            What did God do in you today through this goal?
          </label>
          <textarea
            id={`${uid}-body`}
            className="vf-input vf-input-prose"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={20000}
          />
        </div>
        {error ? (
          <p role="alert" className="vf-notice vf-notice-error">
            {error}
          </p>
        ) : null}
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
                  {created.toLocaleDateString(undefined, {
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

"use client";

import { useEffect, useState, useTransition } from "react";

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
    if (!t || !b) return;
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
    });
  }

  if (!open) return null;

  return (
    <div className="mt-4 rounded-sm border border-ink/10 bg-parchment/40 p-4">
      <p className="vf-eyebrow text-ink-faint">Journal · {entries.length}</p>
      <p className="mt-1 font-serif text-xs text-ink-faint">
        Record reflections, progress, struggles, graces, and completion notes — kept with this goal
        in your spiritual history.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <input
          className="vf-input"
          placeholder="Entry title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <textarea
          className="vf-input"
          rows={3}
          placeholder="What did God do in you today through this goal?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={20000}
        />
        {error ? <p className="font-serif text-xs text-liturgical-red">{error}</p> : null}
        <div className="flex justify-end">
          <button
            type="button"
            className="vf-btn vf-btn-primary text-xs"
            onClick={submit}
            disabled={pending || !title.trim() || !body.trim()}
          >
            {pending ? "…" : "Save entry"}
          </button>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          {entries.map((entry) => {
            const created = new Date(entry.createdAt);
            return (
              <div key={entry.id} className="rounded-sm border border-ink/10 bg-parchment p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="break-words font-display text-base">{entry.title}</h4>
                  <p className="vf-eyebrow text-ink-faint">
                    {created.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words font-serif text-sm leading-relaxed text-ink-soft">
                  {entry.body}
                </p>
              </div>
            );
          })}
        </div>
      ) : loaded ? (
        <p className="mt-3 text-center font-serif text-xs text-ink-faint">
          No journal entries yet for this goal.
        </p>
      ) : null}
    </div>
  );
}

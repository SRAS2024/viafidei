"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Disclosure } from "@/components/ui/Disclosure";
import { readJournalDraft, type JournalSaveLabels } from "../journal/journal-save";
import { GoalJournalPanel, goalDraftKey } from "./GoalJournalPanel";

type ChecklistItem = {
  id: string;
  label: string;
  sortOrder: number;
  isCompleted: boolean;
};

type Goal = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  checklist: ChecklistItem[];
};

type Labels = {
  newGoal: string;
  title: string;
  description: string;
  dueDate: string;
  save: string;
  startGoal: string;
  alreadyCompleted: string;
  cancel: string;
  edit: string;
  complete: string;
  archive: string;
  delete: string;
  addChecklist: string;
  deleteTitle: string;
  deleteBody: string;
  checklist: string;
  /** The name of a checklist step's remove control; "Remove" when absent. */
  remove?: string;
  /** What each goal's journal panel says about saving, as the journal page says it. */
  journalSave: JournalSaveLabels;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A goal's due date is a calendar day stored as midnight UTC. It is not overdue
 * until that whole day has passed, and it prints as that day whatever the reader's
 * time zone, not as the evening before.
 */
function isOverdue(status: string, dueDate: string | null): boolean {
  if (!dueDate || status === "COMPLETED" || status === "ARCHIVED") return false;
  return new Date(dueDate).getTime() + DAY_MS < Date.now();
}

function formatDueDate(dueDate: string, locale: string): string {
  try {
    return new Date(dueDate).toLocaleDateString(locale, { dateStyle: "medium", timeZone: "UTC" });
  } catch {
    return dueDate.slice(0, 10);
  }
}

function statusLabel(status: string, dueDate: string | null): string {
  if (isOverdue(status, dueDate)) return "Overdue";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function CreateForm({
  labels,
  onCreated,
  onCancel,
}: {
  labels: Labels;
  onCreated: (g: Goal) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(completed: boolean) {
    if (!title.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: desc.trim() || null,
          dueDate: due ? new Date(due).toISOString() : null,
          completed,
        }),
      });
      if (!res.ok) {
        setError("Failed to create goal.");
        return;
      }
      const data = await res.json();
      onCreated(data.goal);
    });
  }

  return (
    <form
      className="vf-panel vf-form mb-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <div>
        <label className="vf-label" htmlFor="goal-title">
          {labels.title}
        </label>
        <input
          id="goal-title"
          className="vf-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          autoFocus
        />
      </div>
      <div>
        <label className="vf-label" htmlFor="goal-desc">
          {labels.description}
        </label>
        <textarea
          id="goal-desc"
          rows={3}
          className="vf-input"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          maxLength={4000}
        />
      </div>
      <div>
        <label className="vf-label" htmlFor="goal-due">
          {labels.dueDate}
        </label>
        <input
          id="goal-due"
          type="date"
          className="vf-input"
          value={due}
          onChange={(e) => setDue(e.target.value)}
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
          disabled={!title.trim()}
          aria-disabled={pending}
          aria-busy={pending}
        >
          {labels.startGoal}
        </button>
        {/* Manual completion: for a goal the user finished before joining.
            Creates it already-completed and awards its milestone. */}
        <button
          type="button"
          className="vf-btn vf-btn-ghost"
          onClick={() => submit(true)}
          disabled={!title.trim()}
          aria-disabled={pending}
        >
          {labels.alreadyCompleted}
        </button>
        <button type="button" className="vf-btn vf-btn-ghost" onClick={onCancel}>
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}

function GoalCard({
  goal,
  labels,
  locale,
  onUpdate,
  onDelete,
  onLeave,
}: {
  goal: Goal;
  labels: Labels;
  locale: string;
  onUpdate: (updated: Goal) => void;
  onDelete: (id: string) => void;
  /** Says where focus should go when this card leaves the list it was in. */
  onLeave: (to: "completed" | "archived") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [desc, setDesc] = useState(goal.description ?? "");
  const [newItem, setNewItem] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [journalOpen, setJournalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemPending, setItemPending] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const newItemRef = useRef<HTMLInputElement>(null);
  const refocusEdit = useRef(false);
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const stepId = `${uid}-step`;
  const headingId = `${uid}-heading`;
  const journalId = `${uid}-journal`;

  // A journal left unsaved in this goal's panel opens again with its words.
  useEffect(() => {
    if (readJournalDraft(goalDraftKey(goal.id))) setJournalOpen(true);
  }, [goal.id]);

  // Editing swaps the card's text for its fields and back; focus goes with it.
  useEffect(() => {
    if (editing) {
      titleInputRef.current?.focus();
    } else if (refocusEdit.current) {
      refocusEdit.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  async function patchGoal(body: object) {
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      onUpdate({ ...data.goal, checklist: goal.checklist });
      return true;
    }
    setError("Could not save this goal. Please try again.");
    return false;
  }

  function saveEdit() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      if (await patchGoal({ title: title.trim(), description: desc.trim() || null })) {
        refocusEdit.current = true;
        setEditing(false);
      }
    });
  }

  function complete() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/goals/${goal.id}/complete`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        onLeave("completed");
        onUpdate({ ...data.goal, checklist: goal.checklist });
      } else {
        setError("Could not update this goal. Please try again.");
      }
    });
  }

  function archive() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/goals/${goal.id}/archive`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        onLeave("archived");
        onUpdate({ ...data.goal, checklist: goal.checklist });
      } else {
        setError("Could not update this goal. Please try again.");
      }
    });
  }

  function confirmAndDelete() {
    setConfirmDelete(false);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      if (res.ok) onDelete(goal.id);
      else setError("Could not delete this goal. Please try again.");
    });
  }

  function toggleItem(item: ChecklistItem) {
    // The box changes at once, as a checkbox should, and goes back if the save
    // fails; waiting for the server left it looking unresponsive.
    const next = !item.isCompleted;
    const withValue = (value: boolean) =>
      goal.checklist.map((c) => (c.id === item.id ? { ...c, isCompleted: value } : c));
    setError(null);
    setItemPending(item.id);
    onUpdate({ ...goal, checklist: withValue(next) });
    startTransition(async () => {
      try {
        const res = await fetch(`/api/goals/${goal.id}/checklist/${item.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isCompleted: next }),
        });
        if (!res.ok) throw new Error("save failed");
      } catch {
        onUpdate({ ...goal, checklist: withValue(item.isCompleted) });
        setError("Could not save that step. Please try again.");
      } finally {
        setItemPending(null);
      }
    });
  }

  function addItem() {
    if (!newItem.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/goals/${goal.id}/checklist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: newItem.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdate({ ...goal, checklist: [...goal.checklist, data.item] });
        setNewItem("");
        newItemRef.current?.focus();
      } else {
        setError("Could not add that step. Please try again.");
      }
    });
  }

  function removeItem(itemId: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/goals/${goal.id}/checklist/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        onUpdate({ ...goal, checklist: goal.checklist.filter((c) => c.id !== itemId) });
        // Its button has gone with the step; the field below is the nearest
        // control that always remains.
        newItemRef.current?.focus();
      } else {
        setError("Could not remove that step. Please try again.");
      }
    });
  }

  const canChange = goal.status !== "COMPLETED" && goal.status !== "ARCHIVED";
  const stepsDone = goal.checklist.filter((c) => c.isCompleted).length;

  return (
    <article className="vf-panel" aria-labelledby={editing ? undefined : headingId}>
      {editing ? (
        <div className="vf-form">
          <div>
            <label className="vf-label" htmlFor={titleId}>
              {labels.title}
            </label>
            <input
              ref={titleInputRef}
              id={titleId}
              className="vf-input"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="vf-label" htmlFor={descId}>
              {labels.description}
            </label>
            <textarea
              id={descId}
              className="vf-input"
              rows={2}
              value={desc}
              maxLength={4000}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="vf-btn vf-btn-primary"
              disabled={!title.trim()}
              aria-disabled={pending}
              aria-busy={pending}
              onClick={saveEdit}
            >
              {labels.save}
            </button>
            <button
              type="button"
              className="vf-btn vf-btn-ghost"
              onClick={() => {
                refocusEdit.current = true;
                setEditing(false);
                setTitle(goal.title);
                setDesc(goal.description ?? "");
              }}
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2 id={headingId} className="vf-entry-title">
            {goal.title}
          </h2>
          {/* A date's punctuation can differ between server and browser; both are right. */}
          <p className="vf-entry-meta" suppressHydrationWarning>
            <span className={isOverdue(goal.status, goal.dueDate) ? "vf-overdue" : undefined}>
              {statusLabel(goal.status, goal.dueDate)}
            </span>
            {goal.dueDate ? ` · Due ${formatDueDate(goal.dueDate, locale)}` : ""}
          </p>
          {goal.description ? <p className="vf-panel-text">{goal.description}</p> : null}
        </>
      )}

      {goal.checklist.length > 0 ? (
        <>
          <p className="vf-eyebrow mt-4">
            {labels.checklist} · {stepsDone}/{goal.checklist.length}
          </p>
          <ul className="vf-checklist mt-1.5">
            {goal.checklist.map((item) => (
              <li key={item.id}>
                <label className="vf-check">
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    aria-busy={itemPending === item.id}
                    onChange={() => {
                      if (itemPending !== item.id) toggleItem(item);
                    }}
                  />
                  <span className="min-w-0">{item.label}</span>
                </label>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="vf-icon-btn"
                  aria-label={`${labels.remove ?? "Remove"}: ${item.label}`}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {canChange ? (
        <form
          className="vf-add-row"
          onSubmit={(e) => {
            e.preventDefault();
            addItem();
          }}
        >
          <label htmlFor={stepId} className="sr-only">
            {labels.addChecklist}
          </label>
          <input
            ref={newItemRef}
            id={stepId}
            className="vf-input"
            placeholder={labels.addChecklist}
            value={newItem}
            maxLength={200}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <button
            type="submit"
            className="vf-btn vf-btn-sm vf-btn-ghost"
            disabled={!newItem.trim()}
            aria-disabled={pending}
            aria-label={labels.addChecklist}
          >
            <span aria-hidden="true">+</span>
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="vf-notice vf-notice-error mt-3">
          {error}
        </p>
      ) : null}

      {!editing ? (
        <div className="vf-panel-actions">
          {goal.status === "ACTIVE" || goal.status === "OVERDUE" ? (
            <>
              <button
                ref={editButtonRef}
                type="button"
                className="vf-btn vf-btn-sm vf-btn-ghost"
                aria-label={`${labels.edit}: ${goal.title}`}
                onClick={() => setEditing(true)}
              >
                {labels.edit}
              </button>
              <button
                type="button"
                className="vf-btn vf-btn-sm vf-btn-ghost"
                aria-disabled={pending}
                aria-label={`${labels.complete}: ${goal.title}`}
                onClick={complete}
              >
                {labels.complete}
              </button>
              <button
                type="button"
                className="vf-btn vf-btn-sm vf-btn-ghost"
                aria-disabled={pending}
                aria-label={`${labels.archive}: ${goal.title}`}
                onClick={archive}
              >
                {labels.archive}
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="vf-btn vf-btn-sm vf-btn-ghost"
            onClick={() => setJournalOpen((v) => !v)}
            aria-expanded={journalOpen}
            aria-controls={journalId}
          >
            {journalOpen ? "Hide journal" : "Open journal"}
          </button>
          <button
            type="button"
            className="vf-link-danger"
            aria-disabled={pending}
            aria-label={`${labels.delete}: ${goal.title}`}
            onClick={() => setConfirmDelete(true)}
          >
            {labels.delete}
          </button>
        </div>
      ) : null}

      <div id={journalId}>
        <GoalJournalPanel goalId={goal.id} open={journalOpen} labels={labels.journalSave} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={labels.deleteTitle}
        body={labels.deleteBody}
        entityName={goal.title}
        cancelLabel={labels.cancel}
        confirmLabel={labels.delete}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={confirmAndDelete}
      />
    </article>
  );
}

type Props = {
  initialGoals: Goal[];
  /**
   * Total count of COMPLETED goals across the user's history. Drives
   * the "View completed goals" link rendered alongside the New goal
   * button — completed goals themselves live on a dedicated page so
   * the active list stays short.
   */
  completedCount?: number;
  /** The reader's language, for due dates: the same on the server and the client. */
  locale?: string;
  labels: Labels;
};

type FocusTarget = "new" | "completed" | "archived" | "first-goal";

export function GoalManager({ initialGoals, completedCount = 0, locale = "en", labels }: Props) {
  const [goals, setGoals] = useState(initialGoals);
  const [showCreate, setShowCreate] = useState(false);
  // Completed here since the page was rendered, until the server's count catches up.
  const [completedHere, setCompletedHere] = useState(0);
  const router = useRouter();
  const newGoalRef = useRef<HTMLButtonElement>(null);
  const completedLinkRef = useRef<HTMLAnchorElement>(null);
  const archivedRef = useRef<HTMLDivElement>(null);
  const activeListRef = useRef<HTMLDivElement>(null);
  // A goal that completes, archives or deletes takes its focused button with it,
  // and a new one has just arrived. Focus moves to where things went, which also
  // tells a screen reader what happened.
  const [focusRequest, setFocusRequest] = useState<{ to: FocusTarget } | null>(null);

  useEffect(() => {
    if (!focusRequest) return;
    const { to } = focusRequest;
    if (to === "completed") {
      completedLinkRef.current?.focus();
    } else if (to === "archived") {
      archivedRef.current?.querySelector("button")?.focus();
    } else if (to === "first-goal") {
      const heading = activeListRef.current?.querySelector<HTMLElement>("h2");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    } else {
      newGoalRef.current?.focus();
    }
  }, [focusRequest]);

  // The server's count includes what was completed here once a refresh lands.
  useEffect(() => {
    setCompletedHere(0);
  }, [completedCount]);

  const shownCompleted = completedCount + completedHere;

  function handleCreated(g: Goal) {
    setShowCreate(false);
    // "Already Completed" creates a finished goal, which belongs on the completed
    // page, not in this list.
    if (g.status === "COMPLETED") {
      setCompletedHere((n) => n + 1);
      setFocusRequest({ to: "completed" });
      router.refresh();
      return;
    }
    setGoals((prev) => [{ ...g, checklist: g.checklist ?? [] }, ...prev]);
    setFocusRequest({ to: "first-goal" });
  }

  function handleUpdate(updated: Goal) {
    // A goal flipped to COMPLETED leaves the active list immediately —
    // it shows up under /profile/goals/completed from now on. Removing
    // it from local state matches what the next server fetch will
    // return (listGoalsForUser excludes COMPLETED rows).
    if (updated.status === "COMPLETED") {
      setCompletedHere((n) => n + 1);
      setGoals((prev) => prev.filter((g) => g.id !== updated.id));
      router.refresh();
      return;
    }
    const before = goals.find((g) => g.id === updated.id);
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    // Ticking a step or rewording a title changes nothing the server renders here.
    if (before?.status !== updated.status) router.refresh();
  }

  function handleDelete(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setFocusRequest({ to: "new" });
  }

  // Completed goals migrate to /profile/goals/completed where they are
  // preserved as part of the user's spiritual history. Archived goals
  // stay collapsed at the bottom of the active list so a user can
  // un-archive one without leaving the page.
  const active = goals.filter((g) => g.status === "ACTIVE" || g.status === "OVERDUE");
  const archived = goals.filter((g) => g.status === "ARCHIVED");

  return (
    <div>
      <div className="vf-toolbar">
        <button
          ref={newGoalRef}
          type="button"
          className="vf-btn vf-btn-primary"
          aria-expanded={showCreate}
          onClick={() => setShowCreate((v) => !v)}
        >
          {labels.newGoal}
        </button>
        {shownCompleted > 0 ? (
          <Link
            ref={completedLinkRef}
            href="/profile/goals/completed"
            className="vf-btn vf-btn-ghost"
          >
            View completed goals ({shownCompleted})
          </Link>
        ) : null}
      </div>

      {showCreate ? (
        <CreateForm
          labels={labels}
          onCreated={handleCreated}
          onCancel={() => {
            setShowCreate(false);
            setFocusRequest({ to: "new" });
          }}
        />
      ) : null}

      {active.length === 0 && archived.length === 0 && !showCreate ? (
        <p className="vf-section-lede text-center">
          No active goals. Create one above
          {shownCompleted > 0 ? (
            <>
              {" "}
              or revisit your{" "}
              <Link href="/profile/goals/completed" className="vf-link">
                completed goals
              </Link>
            </>
          ) : null}
          .
        </p>
      ) : null}

      {active.length > 0 ? (
        <div ref={activeListRef} className="vf-panel-list">
          {active.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              labels={labels}
              locale={locale}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onLeave={(to) => setFocusRequest({ to })}
            />
          ))}
        </div>
      ) : null}

      {archived.length > 0 ? (
        <div ref={archivedRef} className="mt-[var(--space-related)]">
          <Disclosure title={`Archived (${archived.length})`}>
            <div className="vf-panel-list">
              {archived.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  labels={labels}
                  locale={locale}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onLeave={(to) => setFocusRequest({ to })}
                />
              ))}
            </div>
          </Disclosure>
        </div>
      ) : null}
    </div>
  );
}

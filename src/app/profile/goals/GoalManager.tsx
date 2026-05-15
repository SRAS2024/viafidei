"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GoalJournalPanel } from "./GoalJournalPanel";

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
  cancel: string;
  edit: string;
  complete: string;
  archive: string;
  delete: string;
  addChecklist: string;
  deleteTitle: string;
  deleteBody: string;
  checklist: string;
};

function statusBadge(status: string, dueDate: string | null) {
  const overdue =
    dueDate && new Date(dueDate) < new Date() && status !== "COMPLETED" && status !== "ARCHIVED";
  const label = overdue ? "Overdue" : status.charAt(0) + status.slice(1).toLowerCase();
  const colour =
    status === "COMPLETED"
      ? "text-emerald-700"
      : overdue || status === "OVERDUE"
        ? "text-liturgical-red"
        : status === "ARCHIVED"
          ? "text-ink-faint"
          : "text-ink-soft";
  return <span className={`vf-eyebrow ${colour}`}>{label}</span>;
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

  function submit() {
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: desc.trim() || null,
          dueDate: due ? new Date(due).toISOString() : null,
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
    <div className="vf-card mb-6 rounded-sm p-6">
      <label className="vf-label" htmlFor="goal-title">
        {labels.title}
      </label>
      <input
        id="goal-title"
        className="vf-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <label className="vf-label mt-4" htmlFor="goal-desc">
        {labels.description}
      </label>
      <textarea
        id="goal-desc"
        rows={3}
        className="vf-input"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      <label className="vf-label mt-4" htmlFor="goal-due">
        {labels.dueDate}
      </label>
      <input
        id="goal-due"
        type="date"
        className="vf-input"
        value={due}
        onChange={(e) => setDue(e.target.value)}
      />
      {error ? <p className="mt-2 text-sm text-liturgical-red">{error}</p> : null}
      <div className="mt-4 flex gap-3">
        <button type="button" className="vf-btn vf-btn-cancel" onClick={onCancel}>
          {labels.cancel}
        </button>
        <button
          type="button"
          className="vf-btn vf-btn-primary"
          onClick={submit}
          disabled={pending || !title.trim()}
        >
          {pending ? "…" : labels.save}
        </button>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  labels,
  onUpdate,
  onDelete,
}: {
  goal: Goal;
  labels: Labels;
  onUpdate: (updated: Goal) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [desc, setDesc] = useState(goal.description ?? "");
  const [newItem, setNewItem] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [journalOpen, setJournalOpen] = useState(false);

  async function patchGoal(body: object) {
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      onUpdate({ ...data.goal, checklist: goal.checklist });
    }
  }

  function saveEdit() {
    startTransition(async () => {
      await patchGoal({ title: title.trim(), description: desc.trim() || null });
      setEditing(false);
    });
  }

  function complete() {
    startTransition(async () => {
      const res = await fetch(`/api/goals/${goal.id}/complete`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        onUpdate({ ...data.goal, checklist: goal.checklist });
      }
    });
  }

  function archive() {
    startTransition(async () => {
      const res = await fetch(`/api/goals/${goal.id}/archive`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        onUpdate({ ...data.goal, checklist: goal.checklist });
      }
    });
  }

  function confirmAndDelete() {
    setConfirmDelete(false);
    startTransition(async () => {
      const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      if (res.ok) onDelete(goal.id);
    });
  }

  function toggleItem(item: ChecklistItem) {
    startTransition(async () => {
      const res = await fetch(`/api/goals/${goal.id}/checklist/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isCompleted: !item.isCompleted }),
      });
      if (res.ok) {
        onUpdate({
          ...goal,
          checklist: goal.checklist.map((c) =>
            c.id === item.id ? { ...c, isCompleted: !c.isCompleted } : c,
          ),
        });
      }
    });
  }

  function addItem() {
    if (!newItem.trim()) return;
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
      }
    });
  }

  function removeItem(itemId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/goals/${goal.id}/checklist/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        onUpdate({ ...goal, checklist: goal.checklist.filter((c) => c.id !== itemId) });
      }
    });
  }

  return (
    <article className="vf-card rounded-sm p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          {statusBadge(goal.status, goal.dueDate)}
          {editing ? (
            <div className="mt-2">
              <input
                className="vf-input text-lg font-display"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className="vf-input mt-2"
                rows={2}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder={labels.description}
              />
              <div className="mt-2 flex gap-2">
                <button
                  className="vf-btn vf-btn-cancel text-sm"
                  onClick={() => {
                    setEditing(false);
                    setTitle(goal.title);
                    setDesc(goal.description ?? "");
                  }}
                >
                  {labels.cancel}
                </button>
                <button
                  className="vf-btn vf-btn-primary text-sm"
                  disabled={pending}
                  onClick={saveEdit}
                >
                  {pending ? "…" : labels.save}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="mt-2 break-words font-display text-xl sm:text-2xl">{goal.title}</h2>
              {goal.description ? (
                <p className="mt-1 break-words font-serif text-ink-soft">{goal.description}</p>
              ) : null}
            </>
          )}
        </div>

        {!editing ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {goal.status === "ACTIVE" || goal.status === "OVERDUE" ? (
              <>
                <button className="vf-btn vf-btn-ghost text-xs" onClick={() => setEditing(true)}>
                  {labels.edit}
                </button>
                <button
                  className="vf-btn vf-btn-ghost text-xs"
                  disabled={pending}
                  onClick={complete}
                >
                  {labels.complete}
                </button>
                <button
                  className="vf-btn vf-btn-ghost text-xs"
                  disabled={pending}
                  onClick={archive}
                >
                  {labels.archive}
                </button>
              </>
            ) : null}
            <button
              className="vf-link-danger text-xs"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              {labels.delete}
            </button>
          </div>
        ) : null}
      </div>

      {goal.checklist.length > 0 ? (
        <ul className="mt-4 divide-y divide-ink/5">
          {goal.checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={item.isCompleted}
                onChange={() => toggleItem(item)}
                className="h-4 w-4 accent-liturgical-gold"
              />
              <span
                className={`flex-1 font-serif text-sm ${item.isCompleted ? "line-through text-ink-faint" : "text-ink-soft"}`}
              >
                {item.label}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="text-xs text-ink-faint hover:text-liturgical-red"
                aria-label="Remove"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {goal.status !== "COMPLETED" && goal.status !== "ARCHIVED" ? (
        <div className="mt-3 flex gap-2">
          <input
            className="vf-input flex-1 py-1 text-sm"
            placeholder={labels.addChecklist}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
          />
          <button
            type="button"
            className="vf-btn vf-btn-ghost text-sm"
            disabled={!newItem.trim() || pending}
            onClick={addItem}
          >
            +
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="vf-nav-link text-xs"
          onClick={() => setJournalOpen((v) => !v)}
          aria-expanded={journalOpen}
        >
          {journalOpen ? "Hide journal" : "Open journal"}
        </button>
      </div>
      <GoalJournalPanel goalId={goal.id} open={journalOpen} />

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
  labels: Labels;
};

export function GoalManager({ initialGoals, completedCount = 0, labels }: Props) {
  const [goals, setGoals] = useState(initialGoals);
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  function handleCreated(g: Goal) {
    setGoals((prev) => [g, ...prev]);
    setShowCreate(false);
  }

  function handleUpdate(updated: Goal) {
    // A goal flipped to COMPLETED leaves the active list immediately —
    // it shows up under /profile/goals/completed from now on. Removing
    // it from local state matches what the next server fetch will
    // return (listGoalsForUser excludes COMPLETED rows).
    if (updated.status === "COMPLETED") {
      setGoals((prev) => prev.filter((g) => g.id !== updated.id));
      router.refresh();
      return;
    }
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    router.refresh();
  }

  function handleDelete(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  // Completed goals migrate to /profile/goals/completed where they are
  // preserved as part of the user's spiritual history. Archived goals
  // stay collapsed at the bottom of the active list so a user can
  // un-archive one without leaving the page.
  const active = goals.filter((g) => g.status === "ACTIVE" || g.status === "OVERDUE");
  const archived = goals.filter((g) => g.status === "ARCHIVED");

  return (
    <div>
      <div className="mb-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          className="vf-btn vf-btn-primary"
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? labels.cancel : labels.newGoal}
        </button>
        {completedCount > 0 ? (
          <Link href="/profile/goals/completed" className="vf-btn vf-btn-ghost">
            View completed goals ({completedCount})
          </Link>
        ) : null}
      </div>

      {showCreate ? (
        <CreateForm
          labels={labels}
          onCreated={handleCreated}
          onCancel={() => setShowCreate(false)}
        />
      ) : null}

      {active.length === 0 && archived.length === 0 && !showCreate ? (
        <p className="text-center font-serif text-ink-faint">
          No active goals. Create one above
          {completedCount > 0 ? (
            <>
              {" "}
              or revisit your{" "}
              <Link href="/profile/goals/completed" className="vf-nav-link">
                completed goals
              </Link>
            </>
          ) : null}
          .
        </p>
      ) : null}

      {active.length > 0 ? (
        <div className="flex flex-col gap-4">
          {active.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              labels={labels}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : null}

      {archived.length > 0 ? (
        <details className="mt-8">
          <summary className="cursor-pointer font-display text-lg text-ink-faint">
            Archived ({archived.length})
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            {archived.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                labels={labels}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

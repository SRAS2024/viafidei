"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  language: string;
  createdAt: string;
  emailVerified: boolean;
  role: string;
};

type ApiResponse = {
  ok?: boolean;
  users?: UserRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  pageCount?: number;
  error?: string;
};

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      users: UserRow[];
      total: number;
      page: number;
      pageSize: number;
      pageCount: number;
    };

const PAGE_SIZE = 20;
const DANGER_COLOR = "#8b1a1a";

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

export function UserAccountsClient() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [confirmTarget, setConfirmTarget] = useState<UserRow | null>(null);
  // Bumping this triggers the list-load effect. We bump it after a
  // successful delete so the row disappears without the admin having
  // to refresh the page.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ kind: "loading" });
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("q", search.trim());
        params.set("page", String(page));
        params.set("pageSize", String(PAGE_SIZE));
        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as ApiResponse;
        if (cancelled) return;
        if (!data.ok || !Array.isArray(data.users)) {
          setState({ kind: "error" });
          return;
        }
        setState({
          kind: "ready",
          users: data.users,
          total: data.total ?? 0,
          page: data.page ?? page,
          pageSize: data.pageSize ?? PAGE_SIZE,
          pageCount: data.pageCount ?? 1,
        });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    }
    const handle = setTimeout(load, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search, page, reloadToken]);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Search users"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="vf-input max-w-xs"
        />
        {state.kind === "ready" ? (
          <span className="font-serif text-sm text-ink-faint" data-testid="users-total">
            {state.total} users
          </span>
        ) : null}
      </div>

      {state.kind === "loading" ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-8 text-center font-serif text-sm text-ink-soft"
          data-testid="users-loading"
        >
          Loading users…
        </p>
      ) : null}

      {state.kind === "error" ? (
        <p
          role="alert"
          className="mt-8 text-center text-sm"
          style={{ color: DANGER_COLOR }}
          data-testid="users-error"
        >
          Could not load users. Please try again.
        </p>
      ) : null}

      {state.kind === "ready" && state.users.length === 0 ? (
        <p
          role="status"
          className="mt-8 text-center font-serif text-sm text-ink-soft"
          data-testid="users-empty"
        >
          No users found.
        </p>
      ) : null}

      {state.kind === "ready" && state.users.length > 0 ? (
        <ul className="mt-6 divide-y divide-ink/10 border-y border-ink/10" data-testid="users-list">
          {state.users.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-baseline gap-3 py-3 text-sm"
              data-testid="user-row"
            >
              <span className="font-display text-base text-ink">
                {u.firstName} {u.lastName}{" "}
                <span
                  className="ml-1 font-sans text-[11px] uppercase tracking-[0.2em] text-ink-faint"
                  data-testid="user-language"
                >
                  {u.language}
                </span>
              </span>
              <span className="font-serif text-ink-soft" data-testid="user-email">
                {u.email}
              </span>
              <span className="ml-auto font-sans text-xs text-ink-faint" data-testid="user-created">
                {formatDate(u.createdAt)}
              </span>
              {u.role !== "ADMIN" ? (
                <button
                  type="button"
                  className="font-sans text-xs underline decoration-1 underline-offset-4 hover:opacity-80"
                  style={{ color: DANGER_COLOR }}
                  onClick={() => setConfirmTarget(u)}
                  data-testid="user-delete-link"
                >
                  Delete user account
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {state.kind === "ready" && state.pageCount > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-6 flex items-center justify-between gap-3 font-serif text-sm text-ink-soft"
        >
          <button
            type="button"
            className="vf-btn vf-btn-ghost"
            disabled={state.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span>
            Page {state.page} of {state.pageCount}
          </span>
          <button
            type="button"
            className="vf-btn vf-btn-ghost"
            disabled={state.page >= state.pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </nav>
      ) : null}

      {confirmTarget ? (
        <DeleteUserDialog
          user={confirmTarget}
          onCancel={() => setConfirmTarget(null)}
          onDeleted={() => {
            setConfirmTarget(null);
            setReloadToken((t) => t + 1);
          }}
        />
      ) : null}
    </section>
  );
}

type DeleteStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "password_invalid" }
  | { kind: "rate_limited" }
  | { kind: "error"; message: string };

function DeleteUserDialog({
  user,
  onCancel,
  onDeleted,
}: {
  user: UserRow;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<DeleteStatus>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === "submitting") return;
    if (password.length === 0) {
      setStatus({ kind: "password_invalid" });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.status === 429) {
        setStatus({ kind: "rate_limited" });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (data.ok) {
        onDeleted();
        return;
      }
      if (data.error === "unauthorized" && data.message === "password_invalid") {
        setStatus({ kind: "password_invalid" });
        return;
      }
      setStatus({ kind: "error", message: data.error ?? "unknown_error" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "network_error",
      });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-user-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      tabIndex={-1}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-sm border border-ink/15 bg-paper p-6 shadow-xl"
        data-testid="delete-user-dialog"
      >
        <h2 id="delete-user-title" className="font-display text-2xl text-ink">
          Are you sure you want to delete {user.firstName} {user.lastName}&apos;s account?
        </h2>
        <p className="mt-3 font-serif text-sm text-ink-soft">
          This permanently erases the account and every piece of saved content (journal entries,
          goals, saved prayers, saints, devotions, parishes, apparitions). This cannot be undone.
        </p>
        <label htmlFor="admin-password-confirm" className="vf-label mt-5 block">
          Retype the admin password to confirm
        </label>
        <input
          id="admin-password-confirm"
          type="password"
          autoComplete="current-password"
          required
          className="vf-input"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (status.kind === "password_invalid" || status.kind === "error") {
              setStatus({ kind: "idle" });
            }
          }}
          aria-invalid={status.kind === "password_invalid"}
          aria-describedby={status.kind === "password_invalid" ? "admin-password-error" : undefined}
          disabled={status.kind === "submitting"}
          data-testid="delete-user-password"
        />
        {status.kind === "password_invalid" ? (
          <p
            id="admin-password-error"
            role="alert"
            className="mt-1 font-serif text-xs"
            style={{ color: DANGER_COLOR }}
          >
            That password is not correct.
          </p>
        ) : null}
        {status.kind === "rate_limited" ? (
          <p role="alert" className="mt-3 font-serif text-xs" style={{ color: DANGER_COLOR }}>
            Too many attempts. Wait a moment and try again.
          </p>
        ) : null}
        {status.kind === "error" ? (
          <p role="alert" className="mt-3 font-serif text-xs" style={{ color: DANGER_COLOR }}>
            {status.message === "not_found"
              ? "Account already deleted."
              : "Could not delete the account. Try again."}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="vf-btn vf-btn-ghost"
            onClick={onCancel}
            disabled={status.kind === "submitting"}
            data-testid="delete-user-cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="vf-btn vf-btn-primary"
            style={{ backgroundColor: DANGER_COLOR, borderColor: DANGER_COLOR }}
            disabled={status.kind === "submitting"}
            aria-busy={status.kind === "submitting"}
            data-testid="delete-user-confirm"
          >
            {status.kind === "submitting" ? "Deleting…" : "Delete"}
          </button>
        </div>
      </form>
    </div>
  );
}

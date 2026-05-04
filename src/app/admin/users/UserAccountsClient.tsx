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
  }, [search, page]);

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
          style={{ color: "#8b1a1a" }}
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
    </section>
  );
}

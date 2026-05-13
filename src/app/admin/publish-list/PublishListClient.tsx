"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  entityType:
    | "Prayer"
    | "Saint"
    | "MarianApparition"
    | "Parish"
    | "Devotion"
    | "LiturgyEntry"
    | "SpiritualLifeGuide";
  type: string;
  title: string;
  slug: string;
  status: "DRAFT" | "REVIEW";
  page: string;
  updatedAt: string;
  createdAt: string;
};

const ENTITY_API: Record<Row["entityType"], string> = {
  Prayer: "/api/admin/prayers",
  Saint: "/api/admin/saints",
  MarianApparition: "/api/admin/apparitions",
  Parish: "/api/admin/parishes",
  Devotion: "/api/admin/devotions",
  LiturgyEntry: "/api/admin/liturgy",
  SpiritualLifeGuide: "/api/admin/spiritual-life",
};

function fmt(ts: string): string {
  const d = new Date(ts);
  // 2026-05-13 07:46 UTC
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

export function PublishListClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/publish-list", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = (await res.json()) as { ok: boolean; items?: Row[] };
      if (!body.ok || !body.items) throw new Error("malformed response");
      setRows(body.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function publishOne(row: Row) {
    setBusy(row.id);
    setMessage(null);
    try {
      const res = await fetch(`${ENTITY_API[row.entityType]}/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setMessage(`Published "${row.title}".`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(null);
    }
  }

  async function removeOne(row: Row) {
    if (!confirm(`Remove "${row.title}"? This deletes the record.`)) return;
    setBusy(row.id);
    setMessage(null);
    try {
      const res = await fetch(`${ENTITY_API[row.entityType]}/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setMessage(`Removed "${row.title}".`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(null);
    }
  }

  async function publishAll() {
    if (rows.length === 0) return;
    if (!confirm(`Publish all ${rows.length} pending item${rows.length === 1 ? "" : "s"}?`))
      return;
    setBusy("all");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/publish-list/publish-all", { method: "POST" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = (await res.json()) as { ok: boolean; total?: number };
      setRows([]);
      setMessage(`Published ${body.total ?? 0} item${body.total === 1 ? "" : "s"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish-all failed");
    } finally {
      setBusy(null);
    }
  }

  const hasRows = rows.length > 0;

  return (
    <div className="vf-card rounded-sm p-0">
      <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 px-5 py-4">
        <div>
          <h2 className="font-display text-2xl">Pending items</h2>
          <p className="mt-1 font-serif text-xs text-ink-faint">
            DRAFT or REVIEW rows across every content type. Click Publish to push a row to the
            public site, or Remove to delete it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="vf-btn vf-btn-ghost !py-1 !px-3 text-xs"
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {message ? (
        <p className="border-b border-ink/10 px-5 py-2 font-serif text-xs text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="border-b border-ink/10 px-5 py-2 font-serif text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.2em] text-ink-faint">
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Page</th>
              <th className="px-5 py-3">Date / Time</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center font-serif text-ink-faint">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center font-serif text-ink-faint">
                  Nothing pending. Auto-ingested content publishes itself — only items you have
                  manually edited or created land here.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-ink/5 font-serif text-sm">
                  <td className="px-5 py-3 align-top">
                    <span className="font-medium">{r.type}</span>
                    <div className="text-xs text-ink-faint">{r.status}</div>
                  </td>
                  <td className="px-5 py-3 align-top">
                    <a
                      href={r.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      {r.title}
                    </a>
                    <div className="text-xs text-ink-faint break-all">{r.page}</div>
                  </td>
                  <td className="px-5 py-3 align-top text-ink-soft">{fmt(r.updatedAt)}</td>
                  <td className="px-5 py-3 align-top text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy === r.id || busy === "all"}
                        onClick={() => void publishOne(r)}
                        className="vf-btn vf-btn-ghost !py-1 !px-3 text-xs text-green-700 border-green-200 hover:bg-green-50 disabled:opacity-50"
                      >
                        Publish
                      </button>
                      <button
                        type="button"
                        disabled={busy === r.id || busy === "all"}
                        onClick={() => void removeOne(r)}
                        className="vf-btn vf-btn-ghost !py-1 !px-3 text-xs text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-ink/10 px-5 py-4">
        <p className="font-serif text-xs text-ink-faint">
          {hasRows
            ? `${rows.length} item${rows.length === 1 ? "" : "s"} pending`
            : "0 items pending"}
        </p>
        <button
          type="button"
          onClick={() => void publishAll()}
          disabled={!hasRows || busy === "all"}
          aria-disabled={!hasRows}
          className={`vf-btn !py-2 !px-5 ${
            hasRows ? "vf-btn-primary" : "vf-btn-ghost opacity-50 cursor-not-allowed"
          }`}
        >
          {busy === "all" ? "Publishing…" : "Publish all"}
        </button>
      </div>
    </div>
  );
}

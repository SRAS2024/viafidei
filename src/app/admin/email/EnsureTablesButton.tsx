"use client";

import { useState } from "react";

const SUCCESS_COLOR = "#185c2a";
const ERROR_COLOR = "#8b1a1a";

type Status =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; created: string[] }
  | { kind: "error"; message: string };

/**
 * On-demand "create the missing token tables now" button. Hits the
 * admin endpoint that runs the same idempotent SQL the 0006 migration
 * runs; safe to click on a healthy database (no-op when nothing is
 * missing). Shown on /admin/email under the Database panel so the
 * operator can fix a deployment without re-running migrations
 * manually or redeploying.
 */
export function EnsureTablesButton() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function run() {
    if (status.kind === "running") return;
    setStatus({ kind: "running" });
    try {
      const res = await fetch("/api/admin/email/ensure-tables", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        created?: string[];
        message?: string;
      };
      if (!data.ok) {
        setStatus({ kind: "error", message: data.message ?? "unknown_error" });
        return;
      }
      setStatus({ kind: "done", created: data.created ?? [] });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "network_error",
      });
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      <button
        type="button"
        onClick={run}
        disabled={status.kind === "running"}
        aria-busy={status.kind === "running"}
        className="vf-btn vf-btn-primary self-start"
      >
        {status.kind === "running"
          ? "Creating missing tables…"
          : "Create missing tables now (idempotent)"}
      </button>
      {status.kind === "done" ? (
        <p
          role="status"
          className="rounded-sm border p-3 font-serif text-sm"
          style={{
            borderColor: SUCCESS_COLOR,
            backgroundColor: "#f3faf5",
            color: SUCCESS_COLOR,
          }}
        >
          {status.created.length > 0 ? (
            <>
              Created: <code>{status.created.join(", ")}</code>. Reload this page to refresh the
              Database panel; the user-side flows can now write tokens and send mail.
            </>
          ) : (
            <>
              Nothing to create — every required table and column already existed. The user-side
              flows are not blocked by missing schema. If they still fail, run the End-to-end
              self-test below to find the actual cause.
            </>
          )}
        </p>
      ) : null}
      {status.kind === "error" ? (
        <p
          role="alert"
          className="rounded-sm border p-3 font-serif text-sm"
          style={{ borderColor: ERROR_COLOR, backgroundColor: "#fdf6f6", color: ERROR_COLOR }}
        >
          Could not create the tables: <code className="text-xs">{status.message}</code>. Most
          common cause: the runtime database role lacks <code>CREATE TABLE</code> permission. Run{" "}
          <code>prisma migrate deploy</code> against the production database with a privileged role
          instead.
        </p>
      ) : null}
    </div>
  );
}

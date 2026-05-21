"use client";

/**
 * Developer Report control for the top of the admin Diagnostics panel.
 *
 * A "Developer Report" button with a download icon opens a small menu
 * offering three report periods — Last 24 Hours, Last 7 Days, and a
 * Month dropdown of months that have diagnostic / log data. Selecting
 * any period POSTs to the protected developer-report API route,
 * receives the generated PDF, and downloads it.
 *
 * The control owns a loading state (while the PDF is generated) and an
 * error state (which names the failed report source and never exposes
 * a secret, because the route already redacts the message).
 */

import { useCallback, useId, useState } from "react";

export type ReportMonth = { value: string; label: string };

type RequestState =
  | { kind: "idle" }
  | { kind: "loading"; label: string }
  | { kind: "error"; message: string }
  | { kind: "done"; fileName: string };

const ENDPOINT = "/api/admin/diagnostics/developer-report";

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-testid="developer-report-download-icon"
    >
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function DeveloperReportButton({ availableMonths }: { availableMonths: ReportMonth[] }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<RequestState>({ kind: "idle" });
  const menuId = useId();

  const generate = useCallback(
    async (period: "last-24-hours" | "last-7-days" | "month", label: string, month?: string) => {
      if (period === "month" && !month) return;
      setState({ kind: "loading", label });
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(period === "month" ? { period, month } : { period }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { message?: string } | null;
          setState({
            kind: "error",
            message:
              data?.message ??
              `The Developer Audit report could not be generated (HTTP ${res.status}).`,
          });
          return;
        }
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const match = /filename="([^"]+)"/.exec(disposition);
        const fileName = match?.[1] ?? `developer-audit-${period}.pdf`;
        if (typeof URL.createObjectURL === "function") {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = fileName;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
        }
        setState({ kind: "done", fileName });
        setOpen(false);
      } catch (error) {
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? `The Developer Audit report could not be generated: ${error.message}`
              : "The Developer Audit report could not be generated.",
        });
      }
    },
    [],
  );

  const loading = state.kind === "loading";

  return (
    <div className="relative inline-block text-left" data-testid="developer-report">
      <button
        type="button"
        className="vf-btn vf-btn-ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={loading}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Developer Report</span>
        <DownloadIcon />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Developer Report period"
          className="absolute left-0 z-20 mt-2 w-64 vf-card rounded-sm p-3 shadow-lg"
        >
          <p className="vf-eyebrow mb-2">Report period</p>
          <button
            type="button"
            role="menuitem"
            className="vf-btn vf-btn-ghost w-full justify-start"
            disabled={loading}
            onClick={() => void generate("last-24-hours", "Last 24 Hours")}
          >
            Last 24 Hours
          </button>
          <button
            type="button"
            role="menuitem"
            className="vf-btn vf-btn-ghost mt-2 w-full justify-start"
            disabled={loading}
            onClick={() => void generate("last-7-days", "Last 7 Days")}
          >
            Last 7 Days
          </button>
          <div className="mt-3">
            <label htmlFor={`${menuId}-month`} className="block font-serif text-xs text-ink-soft">
              Month
            </label>
            <select
              id={`${menuId}-month`}
              aria-label="Month"
              className="mt-1 w-full rounded-sm border border-ink/20 bg-paper px-2 py-1.5 font-serif text-sm text-ink"
              disabled={loading || availableMonths.length === 0}
              defaultValue=""
              onChange={(event) => {
                const value = event.target.value;
                if (!value) return;
                const month = availableMonths.find((m) => m.value === value);
                void generate("month", month?.label ?? value, value);
              }}
            >
              <option value="">
                {availableMonths.length === 0 ? "No months available" : "Select a month…"}
              </option>
              {availableMonths.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <p
              className="mt-3 font-serif text-xs text-ink-faint"
              role="status"
              data-testid="developer-report-loading"
            >
              Generating the Developer Audit PDF for {state.label}…
            </p>
          ) : null}
        </div>
      ) : null}

      {state.kind === "loading" && !open ? (
        <p className="mt-2 font-serif text-xs text-ink-faint" role="status">
          Generating the Developer Audit PDF…
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p
          className="mt-2 max-w-sm font-serif text-xs text-red-700"
          role="alert"
          data-testid="developer-report-error"
        >
          {state.message}
        </p>
      ) : null}
      {state.kind === "done" ? (
        <p className="mt-2 font-serif text-xs text-emerald-700" role="status">
          Downloaded {state.fileName}
        </p>
      ) : null}
    </div>
  );
}

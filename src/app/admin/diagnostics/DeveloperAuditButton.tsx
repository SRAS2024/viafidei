"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Period values map to the new POST /api/admin/developer-audit route
 * (uppercase enum) plus the legacy GET /api/admin/diagnostics/developer-audit
 * (lowercase string). The button targets the new route; the legacy
 * route stays for backwards compatibility but is no longer used.
 */
type Period = "LAST_24_HOURS" | "LAST_7_DAYS" | "LAST_30_DAYS";

const PERIOD_LABELS: Record<Period, string> = {
  LAST_24_HOURS: "Last 24 hours",
  LAST_7_DAYS: "Last 7 days",
  LAST_30_DAYS: "Last 30 days",
};

const ALL_SECTIONS = [
  "Diagnostics Results",
  "Worker Logs",
  "System Logs",
  "Security Logs",
  "Content Growth and Publishing",
  "Homepage Actions",
  "Recommended Repairs",
] as const;
type Section = (typeof ALL_SECTIONS)[number];

export function DeveloperAuditButton() {
  const [period, setPeriod] = useState<Period>("LAST_24_HOURS");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<Set<Section>>(new Set(ALL_SECTIONS));
  const ref = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside, so the panel never lingers over content.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleSection = (s: Section) => {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const download = async () => {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/developer-audit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          period,
          sections: Array.from(sections),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text || "Failed to generate audit"}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `viafidei-developer-audit-${period.toLowerCase()}-${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative z-50 inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
        aria-expanded={open}
      >
        <span>Developer Report</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-auto z-50 mt-2 max-h-[min(75vh,32rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-3 text-sm shadow-xl sm:left-auto sm:right-0">
          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs uppercase text-ink-soft">Report period</legend>
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <label key={p} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="period"
                  value={p}
                  checked={period === p}
                  onChange={() => setPeriod(p)}
                />
                <span>{PERIOD_LABELS[p]}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="mt-3 space-y-1">
            <legend className="mb-1 text-xs uppercase text-ink-soft">Sections</legend>
            {ALL_SECTIONS.map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sections.has(s)}
                  onChange={() => toggleSection(s)}
                />
                <span>{s}</span>
              </label>
            ))}
          </fieldset>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-ink-soft underline"
            >
              cancel
            </button>
            <button
              type="button"
              disabled={pending || sections.size === 0}
              onClick={download}
              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? "Generating PDF…" : "Download PDF"}
            </button>
          </div>

          {error && (
            <p className="mt-2 text-xs text-rose-700" title={error}>
              ⚠ {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

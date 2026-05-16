"use client";

import { useMemo, useState, useTransition } from "react";

type Props = {
  previousTitle: string | null;
  previousBody: string | null;
  currentTitle: string | null;
  currentBody: string | null;
  contentVersionId: string;
};

/**
 * Tiny line-by-line diff renderer. Each line of `previousBody` and
 * `currentBody` is rendered with a +/-/= marker so the admin can see
 * what changed. Pure UI — no diff library dependency. For very
 * large bodies the rendering caps at the first ~200 lines.
 */
function diffLines(a: string, b: string): Array<{ kind: "=" | "-" | "+"; text: string }> {
  const aLines = a.split(/\n/);
  const bLines = b.split(/\n/);
  const bSet = new Set(bLines);
  const aSet = new Set(aLines);
  const out: Array<{ kind: "=" | "-" | "+"; text: string }> = [];
  // Lines in A removed:
  for (const line of aLines) {
    if (!bSet.has(line)) out.push({ kind: "-", text: line });
  }
  // Lines in B added:
  for (const line of bLines) {
    if (!aSet.has(line)) out.push({ kind: "+", text: line });
  }
  // Common (capped).
  const common: string[] = [];
  for (const line of aLines) {
    if (bSet.has(line)) common.push(line);
    if (common.length >= 8) break;
  }
  if (common.length > 0) {
    out.push({ kind: "=", text: `… ${common.length} unchanged line(s) …` });
  }
  return out.slice(0, 200);
}

export function ContentDiff(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const [decision, setDecision] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const titleDiffers = props.previousTitle !== props.currentTitle;
  const bodyDiffers = props.previousBody !== props.currentBody;
  const diff = useMemo(
    () => diffLines(props.previousBody ?? "", props.currentBody ?? ""),
    [props.previousBody, props.currentBody],
  );

  async function review(d: "APPROVED" | "REJECTED" | "REVISION_REQUESTED"): Promise<void> {
    setDecision(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/ingestion/changes/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentVersionId: props.contentVersionId, decision: d }),
      });
      setDecision(res.ok ? d : `Failed: HTTP ${res.status}`);
    });
  }

  async function restore(): Promise<void> {
    setDecision(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/ingestion/changes/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentVersionId: props.contentVersionId }),
      });
      setDecision(res.ok ? "RESTORED" : `Failed: HTTP ${res.status}`);
    });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        className="cursor-pointer font-serif text-xs text-ink-soft underline"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? "Hide diff" : "Show diff"}
      </button>
      {expanded ? (
        <div className="mt-2 rounded-sm bg-ink/5 p-3 font-mono text-xs">
          {titleDiffers ? (
            <div className="mb-2">
              <div className="text-red-700">- {props.previousTitle ?? "(empty)"}</div>
              <div className="text-emerald-700">+ {props.currentTitle ?? "(empty)"}</div>
            </div>
          ) : (
            <div className="text-ink-faint">title unchanged</div>
          )}
          {bodyDiffers ? (
            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap">
              {diff.map((d, i) => (
                <span
                  key={i}
                  className={
                    d.kind === "-"
                      ? "text-red-700"
                      : d.kind === "+"
                        ? "text-emerald-700"
                        : "text-ink-faint"
                  }
                >
                  {d.kind} {d.text}
                  {"\n"}
                </span>
              ))}
            </pre>
          ) : (
            <div className="text-ink-faint">body unchanged</div>
          )}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void review("APPROVED")}
          className="rounded-sm border border-ink/30 bg-emerald-50 px-2 py-1 font-serif text-xs hover:bg-emerald-100 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void review("REJECTED")}
          className="rounded-sm border border-ink/30 bg-red-50 px-2 py-1 font-serif text-xs hover:bg-red-100 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void review("REVISION_REQUESTED")}
          className="rounded-sm border border-ink/30 px-2 py-1 font-serif text-xs hover:bg-ink/5 disabled:opacity-50"
        >
          Request revision
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void restore()}
          className="rounded-sm border border-ink/30 bg-amber-50 px-2 py-1 font-serif text-xs hover:bg-amber-100 disabled:opacity-50"
        >
          Restore previous version
        </button>
        {decision ? (
          <span className="self-center font-serif text-xs text-ink-faint">{decision}</span>
        ) : null}
      </div>
    </div>
  );
}
